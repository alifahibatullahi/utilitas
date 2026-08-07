/**
 * Critical Maintenance — loader Google Sheets (sheet = sumber kebenaran).
 *
 * Spreadsheet berisi DUA TAB (di-resolve by gid, tahan rename):
 *   1. Critical Equipment : No | Tanggal Dilaporkan | Yang Melaporkan | Nama dan Nomor Item |
 *                           Varian | Uraian | Notif | Scope | Status | Tanggal di OK | Yang Meng"OK" | Gabungan
 *   2. Maintenance        : No | Tanggal Dilaporkan | Shift | Nama dan Nomor Item | Varian |
 *                           Uraian | Scope | Status | Notifikasi | Foreman | gabungan | (Ref Critical)
 * Posisi header TIDAK di-hardcode — dideteksi dari isi sel (tahan sisip baris/kolom).
 * Per Agt 2026 kolom "ID" ada di AA (dulu B) dan kolom foto bernama "Dokumentasi" di
 * K (critical) / I (maintenance) — dulu "Link Foto" di N/L. Karena deteksinya by nama,
 * pemindahan itu tidak butuh perubahan kode; penggantian NAMA-nya yang butuh.
 * Input data tetap di spreadsheet; app hanya MENULIS kolom "ID" (identitas baris yang
 * dipakai relasi foto) dan tidak pernah menyentuh kolom isian operator.
 *
 * Skala (trial, Jul 2026): ±4.5rb baris critical + ±23rb baris maintenance. Terlalu
 * besar untuk unstable_cache (limit entry ±2MB), jadi cache di memori module dengan
 * TTL — di Vercel berarti per-instance lambda; instance warm melayani dari memori,
 * cold start baca ulang. Kuota Sheets (300 read/menit) tetap aman.
 */

import { createHash, randomInt } from 'crypto';
import { getSheetsClient, withRetry, fromIndonesianDate } from './google-sheets';

// ─── Config ──────────────────────────────────────────────────────────────────
// Spreadsheet + kedua gid WAJIB dari env — tanpa default. Fitur ini masih memakai
// spreadsheet percobaan; kalau ada default hardcoded, salah set env di produksi berarti
// app diam-diam membaca (dan menulis web_uid ke) sheet percobaan.
function requireEnv(name: string): string {
    const v = (process.env[name] ?? '').trim();
    if (!v) throw new Error(`Env ${name} belum di-set — fitur Critical Maintenance butuh ID/gid spreadsheet yang eksplisit.`);
    return v;
}

function sheetId(): string {
    return requireEnv('GOOGLE_SHEETS_CRITICAL_ID');
}

function tabGid(envName: string): number {
    const raw = requireEnv(envName);
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) throw new Error(`Env ${envName} bukan angka gid yang valid: "${raw}"`);
    return n;
}

// Kolom yang dikelola app dicari BY NAMA HEADER, bukan posisi — supaya tahan sisip kolom
// dan supaya spreadsheet produksi (urutan kolomnya bisa beda) tidak perlu ubah kode.
const UID_HEADER_NAME = 'id';                 // sudah dinormalisasi (lihat normHeader)
const UID_HEADER_LEGACY_PREFIX = 'web_uid';   // nama lama, sebelum kolom dipindah ke B
// Kolom foto sekarang bernama "Dokumentasi" (Critical kolom K, Maintenance kolom I);
// sebelumnya "Link Foto" di kolom N/L. Kedua nama diterima supaya spreadsheet yang
// belum diganti — dan salinan lama untuk uji coba — tetap terbaca tanpa ubah kode.
const PHOTO_HEADER = 'Dokumentasi';
const PHOTO_HEADER_NAMES = ['dokumentasi', 'link foto'];   // sudah dinormalisasi

// Dulu di sini ada cache in-memory ber-TTL, karena tiap request memuat seluruh
// spreadsheet. Cache itu sudah tidak ada: halaman web membaca cermin Postgres
// (lib/critical-sheet-db.ts), dan file ini hanya dipakai cron & script. Cache per
// instance lambda juga tidak pernah benar-benar bekerja — tombol "Perbarui data" hanya
// menyegarkan instance yang kebetulan menerima request itu.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CriticalRow {
    /** Identitas baris untuk relasi foto — dari URL di dalam sel "Dokumentasi", '' bila belum berfoto. */
    uid: string;
    /** Sidik jari isi baris: identitas cadangan saat `uid` masih kosong. */
    sig?: string;
    /** Isi kolom "ID" (AA). Arsip: tidak pernah ditulis lagi, hanya untuk pemulihan. */
    legacyId: string;
    rowIndex: number;              // baris sheet 1-based
    no: number | null;
    tanggal: string | null;        // ISO dari "Tanggal Dilaporkan"
    tanggalRaw: string;
    pelapor: string;
    item: string;
    varian: string;
    uraian: string;
    notif: string;
    scope: string;
    status: string;
    tanggalOk: string | null;
    tanggalOkRaw: string;
    pengOk: string;
    gabungan: string;
    linkFoto: string;              // isi sel "Dokumentasi" (formula HYPERLINK, '' bila kosong)
}

export interface MaintenanceRow {
    uid: string;
    sig?: string;
    legacyId: string;
    rowIndex: number;
    no: number | null;
    tanggal: string | null;
    tanggalRaw: string;
    shift: string;
    item: string;
    varian: string;
    uraian: string;
    scope: string;
    status: string;
    notifikasi: string;
    foreman: string;
    gabungan: string;
    linkFoto: string;
}

/** Info satu tab + posisi kolom yang dikelola app (hasil deteksi by nama header). */
export interface TabRef {
    kind: 'critical' | 'maintenance';
    gid: number;
    title: string;
    headerRowIndex: number;         // 1-based
    uidColIndex: number | null;     // 0-based; null = kolom "ID" tidak ada di baris header
    photoColIndex: number | null;   // null = kolom "Dokumentasi" belum dibuat di sheet
}

export interface CriticalSheetData {
    criticals: CriticalRow[];
    maintenances: MaintenanceRow[];
    tabs: { critical: TabRef; maintenance: TabRef };
    /** Pemisah argumen formula sesuai locale spreadsheet (lihat argSeparatorForLocale). */
    argSeparator: ArgSeparator;
    fetchedAt: string;
    /**
     * Peta baris → uid dari kolom "Dokumentasi", untuk SELURUH sheet. Pada pembacaan ekor
     * cakupannya tetap penuh (kolomnya murah dibaca utuh), jadi sync bisa memperbaiki uid
     * baris lama tanpa harus ikut membaca isinya.
     */
    uidMaps: { critical: Map<number, string>; maintenance: Map<number, string> };
}

/**
 * Metadata tab sebagaimana tersimpan di cermin (`critical_sheet_sync.tabs`). Bentuknya sama
 * dengan `TabsMeta` di lib/critical-sheet-db.ts; sengaja dideklarasikan ulang di sini supaya
 * file ini tidak perlu mengimpor modul yang justru mengimpornya.
 */
export interface TabsSnapshot {
    tabs: { critical: TabRef; maintenance: TabRef };
    argSeparator: ArgSeparator;
}

// ─── Parsing helpers ─────────────────────────────────────────────────────────

export function quoteTab(title: string): string {
    return `'${title.replace(/'/g, "''")}'`;
}

/** Normalisasi sel header: lowercase, buang tanda kutip/titik dua, rapikan spasi. */
function normHeader(cellValue: string): string {
    return (cellValue ?? '').toLowerCase().replace(/["'.:]/g, '').replace(/\s+/g, ' ').trim();
}

/** Parse "1 Juni 2020" / "01 Juni 2020" / "1/6/2020" / ISO → ISO, else null. */
function parseSheetDate(raw: string): string | null {
    const s = (raw ?? '').trim();
    if (!s) return null;
    const indo = fromIndonesianDate(s);
    if (indo) return indo;
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return null;
}

function parseNo(cellValue: string): number | null {
    const s = (cellValue ?? '').trim();
    return /^\d+$/.test(s) ? parseInt(s, 10) : null;
}

export type ArgSeparator = ';' | ',';

/**
 * Pemisah argumen formula mengikuti LOCALE spreadsheet, bukan konvensi US.
 * Sheets API mem-parse nilai `USER_ENTERED` persis seperti operator mengetiknya di UI,
 * jadi di sheet berlokal in_ID (desimal koma) `=HYPERLINK("…","…")` menjadi sel
 * #ERROR! "Formula parse error" — yang benar `=HYPERLINK("…";"…")`.
 * Locale dari API berformat "in_ID"/"en_US"; Intl menerimanya setelah _ jadi -.
 */
export function argSeparatorForLocale(locale: string): ArgSeparator {
    const tag = (locale || '').trim().replace(/_/g, '-');
    if (!tag) return ',';
    try {
        // Desimal koma (1,5) ⇒ koma sudah dipakai angka, pemisah argumen jadi titik koma.
        return Intl.NumberFormat(tag).format(1.5).includes(',') ? ';' : ',';
    } catch {
        return ',';
    }
}

type HeaderMap = Record<string, number>;

function buildHeaderMap(row: string[]): HeaderMap {
    const map: HeaderMap = {};
    row.forEach((c, idx) => {
        const name = normHeader(c);
        if (name && !(name in map)) map[name] = idx;
    });
    return map;
}

const cell = (row: string[], idx: number | undefined): string =>
    idx === undefined ? '' : (row[idx] ?? '').trim();

/** Cari baris header di sebuah tab berdasarkan nama kolom wajib. */
function findHeader(rows: string[][], required: string[]): { rowIdx: number; map: HeaderMap } {
    const scanLimit = Math.min(rows.length, 30); // header selalu di baris-baris awal
    for (let i = 0; i < scanLimit; i++) {
        const map = buildHeaderMap(rows[i] ?? []);
        if (required.every(r => r in map)) return { rowIdx: i, map };
    }
    throw new Error(`Header dengan kolom [${required.join(', ')}] tidak ditemukan`);
}

interface ParsedTab<T> {
    headerRowIndex: number;       // 1-based
    uidColIndex: number | null;   // 0-based; null = kolom "ID" tidak ada di baris header
    photoColIndex: number | null;
    rows: T[];
}

/**
 * Kolom ID dikenali dari header "ID" maupun "web_uid …" (nama lama sebelum kolomnya
 * dipindah). Kolomnya sendiri OPSIONAL: sejak identitas pindah ke sel "Dokumentasi",
 * isinya hanya arsip pemulihan dan app tidak pernah menulisnya lagi. Sheet tanpa kolom
 * ini berjalan normal.
 */
export function isUidHeader(normalizedName: string): boolean {
    return normalizedName === UID_HEADER_NAME || normalizedName.startsWith(UID_HEADER_LEGACY_PREFIX);
}

/** Kolom yang dikelola app di satu tab. Kolom Dokumentasi opsional (null = belum dibuat). */
function resolveManagedCols(map: HeaderMap): { uidColIndex: number | null; photoColIndex: number | null } {
    // Object.entries mengikuti urutan sisip = urutan kolom, jadi yang pertama = paling kiri.
    // Kolom ID ganda = tanda ada versi kode/sheet lain yang menulis ID di kolom berbeda.
    // Jangan diam: separuh datanya akan menunjuk ID yang salah.
    const uidCols = Object.entries(map).filter(([name]) => isUidHeader(name)).map(([, idx]) => idx);
    if (uidCols.length > 1) {
        console.error(
            `[critical-sheet] ADA ${uidCols.length} kolom ID (${uidCols.map(colLetter).join(', ')}). ` +
            `Memakai ${colLetter(uidCols[0])}. Hapus kolom duplikatnya — biasanya sisa kolom "web_uid" lama.`,
        );
    }
    // Kolom ID TIDAK ADA bukan lagi kesalahan — sejak identitas pindah ke sel Dokumentasi,
    // kolom ini hanya arsip pemulihan dan tidak pernah ditulis lagi. Dulu di sini ada
    // console.error yang menyatakan "foto tidak bisa dikaitkan"; membiarkannya berarti
    // menakut-nakuti setiap kali sheet yang sudah bersih disinkronkan.
    // Nama depan daftar yang menang bila (untuk sementara) kedua nama ada di satu sheet.
    const photoName = PHOTO_HEADER_NAMES.find(name => name in map);
    // Tanpa kolom ini TIDAK ADA identitas baris sama sekali: foto tetap tersimpan tapi
    // tidak pernah menempel ke baris mana pun. Persis yang terjadi saat kolomnya diganti
    // nama dari "Link Foto" menjadi "Dokumentasi" — diam-diam mati selama berhari-hari.
    if (photoName === undefined) {
        console.error(
            `[critical-sheet] Kolom "${PHOTO_HEADER}" TIDAK DITEMUKAN di baris header ` +
            `(nama yang diterima: ${PHOTO_HEADER_NAMES.join(', ')}). Foto tidak bisa dikaitkan ` +
            `ke baris sampai kolomnya ada. Periksa: npx tsx scripts/check-critical-sheet.ts`,
        );
    }
    return {
        uidColIndex: uidCols[0] ?? null,
        photoColIndex: photoName === undefined ? null : map[photoName],
    };
}

export function parseCriticalTab(rows: string[][]): ParsedTab<CriticalRow> {
    const { rowIdx, map } = findHeader(rows, ['no', 'tanggal dilaporkan', 'yang melaporkan', 'nama dan nomor item', 'uraian']);
    const { uidColIndex, photoColIndex } = resolveManagedCols(map);
    const out: CriticalRow[] = [];
    for (let i = rowIdx + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const item = cell(r, map['nama dan nomor item']);
        const uraian = cell(r, map['uraian']);
        const tanggalRaw = cell(r, map['tanggal dilaporkan']);
        // Baris valid minimal punya uraian atau tanggal — menyaring baris sisa/coretan
        // (mis. sel item terisi sendirian ribuan baris di bawah data asli).
        if ((!item && !uraian) || (!uraian && !tanggalRaw)) continue;
        const tanggalOkRaw = cell(r, map['tanggal di ok']);
        out.push({
            // uid diisi belakangan dari sel Dokumentasi (lihat applyPhotoUids) — kolom ID
            // di AA tidak lagi menjadi kunci, hanya ikut terbawa sebagai arsip.
            uid: '',
            legacyId: uidColIndex === null ? '' : cell(r, uidColIndex),
            rowIndex: i + 1,
            no: parseNo(cell(r, map['no'])),
            tanggal: parseSheetDate(tanggalRaw),
            tanggalRaw,
            pelapor: cell(r, map['yang melaporkan']),
            item,
            varian: cell(r, map['varian']),
            uraian,
            notif: cell(r, map['notif']),
            scope: cell(r, map['scope']),
            status: cell(r, map['status']),
            tanggalOk: parseSheetDate(tanggalOkRaw),
            tanggalOkRaw,
            pengOk: cell(r, map['yang mengok']),
            gabungan: cell(r, map['gabungan']),
            linkFoto: photoColIndex === null ? '' : cell(r, photoColIndex),
        });
    }
    return { headerRowIndex: rowIdx + 1, uidColIndex, photoColIndex, rows: out };
}

export function parseMaintenanceTab(rows: string[][]): ParsedTab<MaintenanceRow> {
    const { rowIdx, map } = findHeader(rows, ['no', 'tanggal dilaporkan', 'shift', 'nama dan nomor item', 'uraian']);
    const { uidColIndex, photoColIndex } = resolveManagedCols(map);
    const out: MaintenanceRow[] = [];
    for (let i = rowIdx + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const item = cell(r, map['nama dan nomor item']);
        const uraian = cell(r, map['uraian']);
        const tanggalRaw = cell(r, map['tanggal dilaporkan']);
        // Sama seperti tab critical: saring baris kosong/sisa (kolom A tab ini terisi
        // formula sampai puluhan ribu baris di bawah data asli).
        if ((!item && !uraian) || (!uraian && !tanggalRaw)) continue;
        out.push({
            uid: '',
            legacyId: uidColIndex === null ? '' : cell(r, uidColIndex),
            rowIndex: i + 1,
            no: parseNo(cell(r, map['no'])),
            tanggal: parseSheetDate(tanggalRaw),
            tanggalRaw,
            shift: cell(r, map['shift']),
            item,
            varian: cell(r, map['varian']),
            uraian,
            scope: cell(r, map['scope']),
            status: cell(r, map['status']),
            notifikasi: cell(r, map['notifikasi']),
            foreman: cell(r, map['foreman']),
            gabungan: cell(r, map['gabungan']),
            linkFoto: photoColIndex === null ? '' : cell(r, photoColIndex),
        });
    }
    return { headerRowIndex: rowIdx + 1, uidColIndex, photoColIndex, rows: out };
}

// ─── Identitas baris ─────────────────────────────────────────────────────────

export function colLetter(index0: number): string {
    let n = index0 + 1;
    let s = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

interface TabInfo { gid: number; title: string; columnCount: number }

/**
 * Ambil uid dari isi sel "Dokumentasi" — yaitu dari URL di dalam formula HYPERLINK
 * (`=HYPERLINK("…?item=…&foto=<uid>"; "📷 …")`, lihat photoCellFormula).
 * '' bila selnya kosong atau bukan tautan buatan app.
 */
export function uidFromPhotoFormula(formula: string): string {
    const m = /[?&]foto=([^"&\s]+)/.exec(formula ?? '');
    if (!m) return '';
    try {
        return decodeURIComponent(m[1]).trim();
    } catch {
        return m[1].trim();
    }
}

/**
 * Peta baris → uid untuk tiap tab, dibaca dari kolom "Dokumentasi".
 *
 * Kenapa dari sel Dokumentasi, bukan dari kolom ID: sel ini berada DI DALAM blok data
 * operator, jadi ia ikut berpindah saat baris disortir atau dipindahkan. Kolom ID (AA)
 * ada di luar blok itu dan akan tertinggal — persis kerusakan yang paling sering terjadi
 * dan paling sulit dilihat.
 *
 * `startRow` (1-based) membatasi pembacaan mulai baris berapa. Pembacaan PENUH (syncFull)
 * memakai 1; pembacaan ekor memakai baris awal ekornya. Dulu ekor pun selalu membaca dari
 * baris 1: satu kolom memang tipis, tapi Google memulangkan array sampai baris terisi
 * terakhir — tab Maintenance mengirim ±23rb entri kosong demi SATU baris yang berisi, dan
 * ongkos itu ditanggung tiap kali operator membuka menu di spreadsheet.
 *
 * WAJIB `valueRenderOption: 'FORMULA'` — dengan FORMATTED_VALUE yang kembali hanyalah
 * teks tampilannya ("📷 Critical P-02.10 D (3)"), tanpa uid di dalamnya.
 */
async function readPhotoUidMap(
    sheets: ReturnType<typeof getSheetsClient>,
    tabs: { title: string; photoColIndex: number | null; startRow?: number }[],
): Promise<Map<number, string>[]> {
    const hasil = tabs.map(() => new Map<number, string>());
    const ranges: string[] = [];
    const pemilik: number[] = [];        // ranges[i] milik tabs[pemilik[i]]
    const mulai: number[] = [];          // baris sheet pertama yang dicakup ranges[i]
    tabs.forEach((t, i) => {
        if (t.photoColIndex === null) return;   // kolomnya belum dibuat → tab ini dilewati
        const col = colLetter(t.photoColIndex);
        const awal = Math.max(1, t.startRow ?? 1);
        ranges.push(`${quoteTab(t.title)}!${col}${awal}:${col}`);
        pemilik.push(i);
        mulai.push(awal);
    });
    if (ranges.length === 0) return hasil;

    const res = await withRetry(() => sheets.spreadsheets.values.batchGet({
        spreadsheetId: sheetId(),
        ranges,
        valueRenderOption: 'FORMULA',
    }), 'batchGet kolom Dokumentasi');

    (res.data.valueRanges ?? []).forEach((vr, i) => {
        const map = hasil[pemilik[i]];
        const rows = (vr.values ?? []) as string[][];
        rows.forEach((r, idx) => {
            const uid = uidFromPhotoFormula(String(r?.[0] ?? ''));
            if (uid) map.set(idx + mulai[i], uid);   // idx 0 = baris sheet `mulai[i]`
        });
    });
    return hasil;
}

/** Tempelkan uid hasil readPhotoUidMap ke baris-baris yang sudah di-parse. */
function applyPhotoUids<T extends { rowIndex: number; uid: string }>(rows: T[], map: Map<number, string>): void {
    for (const r of rows) r.uid = map.get(r.rowIndex) ?? '';
}

/**
 * Sidik jari isi satu baris — identitas cadangan yang tidak bergantung pada sel mana pun.
 *
 * Dipakai dua arah: (1) menemukan baris untuk foto PERTAMA-nya, saat sel Dokumentasi
 * memang belum ada isinya, dan (2) menemukan kembali baris sebuah foto kalau selnya
 * kelak terhapus atau tergeser (scripts/repair-photo-links.ts).
 *
 * Dinormalisasi seadanya (huruf kecil, spasi dirapikan) — cukup untuk tahan beda
 * kapitalisasi dan spasi ganda, tapi sengaja TIDAK longgar: kalau operator mengoreksi
 * ejaan uraian, sidik jarinya memang berubah, dan lebih baik gagal mencocokkan daripada
 * menempelkan foto ke baris yang salah.
 */
export function rowFingerprint(item: string, varian: string, uraian: string, tanggalRaw: string): string {
    const norm = (v: string) => (v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    const bahan = [norm(item), norm(varian), norm(uraian), norm(tanggalRaw)].join('|');
    return createHash('sha1').update(bahan).digest('hex').slice(0, 10);
}

/**
 * Dua kerusakan yang dulu tidak pernah ketahuan, dilaporkan tiap kali sheet dibaca.
 * Sengaja HANYA melapor — uid tidak pernah diperbaiki otomatis, karena menggantinya
 * berarti memutus foto yang menempel padanya, dan ketidakcocokan bisa saja berasal dari
 * koreksi nama item yang sah.
 *
 * Sekarang hanya menyangkut baris BERFOTO (uid datang dari sel Dokumentasi), jadi tiap
 * temuan di sini benar-benar berarti ada foto yang berisiko tampil di baris yang salah.
 */
function reportUidAnomalies(label: string, rows: { uid: string; rowIndex: number; item: string; varian: string }[]): void {
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    const mismatched: string[] = [];

    for (const r of rows) {
        if (!r.uid) continue;
        const before = seen.get(r.uid);
        if (before !== undefined) duplicates.push(`baris ${before} & ${r.rowIndex} → ${r.uid}`);
        else seen.set(r.uid, r.rowIndex);

        if (!uidMatchesRow(r.uid, r.item, r.varian)) {
            mismatched.push(`baris ${r.rowIndex}: ID ${r.uid} vs item "${r.item}"${r.varian ? ` varian ${r.varian}` : ''}`);
        }
    }

    if (duplicates.length) {
        console.error(
            `[critical-sheet] ${label}: ${duplicates.length} uid KEMBAR di kolom Dokumentasi — ` +
            `foto akan tampil di baris yang salah. ` +
            duplicates.slice(0, 5).join('; '),
        );
    }
    if (mismatched.length) {
        console.error(
            `[critical-sheet] ${label}: ${mismatched.length} sel Dokumentasi TIDAK COCOK dengan itemnya — ` +
            `biasanya tanda isi baris tergeser (memblok sebagian kolom lalu menyortirnya). ` +
            mismatched.slice(0, 5).join('; '),
        );
    }
}

// ─── Loader dari spreadsheet ─────────────────────────────────────────────────
//
// PENTING: fungsi di bawah ini MAHAL — satu pembacaan penuh = 8,75 MB JSON, ±51 MB heap,
// dan ±5 detik. Plan gratis Vercel memutus fungsi di 10 detik, jadi ini TIDAK BOLEH
// berada di jalur request. Tempatnya hanya di cron dan script (lib/critical-sheet-sync.ts);
// halaman web membaca cermin di Postgres (lib/critical-sheet-db.ts), yang untuk satu
// halaman hanya ±7 KB.

/** Metadata spreadsheet + kedua tab, di-resolve by gid (tahan rename tab). */
async function resolveTabs(sheets: ReturnType<typeof getSheetsClient>) {
    const meta = await withRetry(() => sheets.spreadsheets.get({
        spreadsheetId: sheetId(),
        fields: 'properties.locale,sheets.properties(sheetId,title,gridProperties.columnCount)',
    }), 'get critical spreadsheet meta');
    const findTab = (gid: number): TabInfo => {
        const t = meta.data.sheets?.find(s => s.properties?.sheetId === gid);
        if (!t?.properties?.title) throw new Error(`Tab gid=${gid} tidak ditemukan di spreadsheet critical`);
        return { gid, title: t.properties.title, columnCount: t.properties.gridProperties?.columnCount ?? 26 };
    };
    return {
        criticalTab: findTab(tabGid('GOOGLE_SHEETS_CRITICAL_GID')),
        maintenanceTab: findTab(tabGid('GOOGLE_SHEETS_MAINTENANCE_GID')),
        argSeparator: argSeparatorForLocale(meta.data.properties?.locale ?? ''),
    };
}

/** Baca SELURUH isi kedua tab. Mahal — lihat catatan di atas. */
export async function loadCriticalSheetFull(): Promise<CriticalSheetData> {
    const sheets = getSheetsClient();
    const { criticalTab, maintenanceTab, argSeparator } = await resolveTabs(sheets);

    // Satu batchGet untuk kedua tab. A:AE = data operator + kolom Dokumentasi + kolom ID
    // di AA, dengan sisa ruang bila kolomnya bergeser akibat penyisipan kolom baru.
    const res = await withRetry(() => sheets.spreadsheets.values.batchGet({
        spreadsheetId: sheetId(),
        ranges: [
            `${quoteTab(criticalTab.title)}!A1:AE`,
            `${quoteTab(maintenanceTab.title)}!A1:AE`,
        ],
        valueRenderOption: 'FORMATTED_VALUE',
    }), 'batchGet critical+maintenance values');
    const [criticalRows, maintenanceRows] = (res.data.valueRanges ?? []).map(v => (v.values ?? []) as string[][]);

    const criticalParsed = parseCriticalTab(criticalRows ?? []);
    const maintenanceParsed = parseMaintenanceTab(maintenanceRows ?? []);

    // Identitas baris datang dari sel Dokumentasi, bukan dari kolom ID. App TIDAK PERNAH
    // lagi menulis kolom ID: dulu tiap pembacaan mengisi ID untuk semua baris yang belum
    // punya (27rb sel) padahal yang benar-benar dipakai hanya baris berfoto — segelintir.
    // Kolom ID di AA tetap dibaca sebagai `legacyId`, murni sebagai arsip pemulihan.
    const [criticalUids, maintenanceUids] = await readPhotoUidMap(sheets, [
        { title: criticalTab.title, photoColIndex: criticalParsed.photoColIndex },
        { title: maintenanceTab.title, photoColIndex: maintenanceParsed.photoColIndex },
    ]);
    applyPhotoUids(criticalParsed.rows, criticalUids);
    applyPhotoUids(maintenanceParsed.rows, maintenanceUids);

    reportUidAnomalies('Critical Equipment', criticalParsed.rows);
    reportUidAnomalies('Maintenance', maintenanceParsed.rows);

    // Terbaru dulu (urutan input sheet = kronologis).
    criticalParsed.rows.reverse();
    maintenanceParsed.rows.reverse();

    return {
        criticals: criticalParsed.rows,
        maintenances: maintenanceParsed.rows,
        tabs: {
            critical: toTabRef('critical', criticalTab, criticalParsed),
            maintenance: toTabRef('maintenance', maintenanceTab, maintenanceParsed),
        },
        argSeparator,
        fetchedAt: new Date().toISOString(),
        uidMaps: { critical: criticalUids, maintenance: maintenanceUids },
    };
}

/** TabRef tersimpan → TabInfo. `columnCount` tidak dipakai di jalur ekor, jadi diisi bawaan. */
function toTabInfo(ref: TabRef): TabInfo {
    return { gid: ref.gid, title: ref.title, columnCount: 26 };
}

function toTabRef(kind: 'critical' | 'maintenance', tab: TabInfo, parsed: ParsedTab<unknown>): TabRef {
    return {
        kind,
        gid: tab.gid,
        title: tab.title,
        headerRowIndex: parsed.headerRowIndex,
        uidColIndex: parsed.uidColIndex,
        photoColIndex: parsed.photoColIndex,
    };
}

/**
 * Baca EKOR kedua tab — dari baris `start*` ke bawah — ditambah 30 baris pertama supaya
 * baris header tetap ikut terbaca (posisinya tidak di-hardcode).
 *
 * Inilah pembaruan rutin. Dasarnya kebiasaan operator: urutan baris masih berubah selama
 * shift berjalan, tapi begitu harinya lewat posisinya tetap — jadi yang perlu dilihat
 * ulang tiap beberapa menit hanyalah ujung sheet, bukan 27rb baris.
 *
 * Kolom "Dokumentasi" dibaca dari baris awal ekor juga, bukan dari baris 1. Uid baris di
 * LUAR ekor sudah dicerminkan langsung oleh writePhotoCell saat fotonya diunggah, jadi yang
 * tersisa untuk pembacaan penuh hanyalah memulihkan uid yang berpindah karena operator
 * menyortir baris — dan itu bagian syncFull.
 *
 * `tabsMeta` = metadata tab yang sudah tersimpan di cermin. Bila diberikan, `resolveTabs()`
 * dilewati: satu panggilan Sheets berurutan hilang dari jalur yang dipakai tombol "Perbarui
 * data". Judul tab yang basi (tab di-rename) membuat batchGet gagal, dan pemanggil boleh
 * mencoba lagi tanpa `tabsMeta`.
 *
 * Baris di antara header dan ekor menjadi lubang di array; parser memang sudah melewati
 * baris tanpa uraian/tanggal, jadi penomoran barisnya tetap benar tanpa parser terpisah.
 */
export async function loadCriticalSheetTailFrom(
    startCritical: number,
    startMaintenance: number,
    tabsMeta?: TabsSnapshot | null,
): Promise<CriticalSheetData> {
    const sheets = getSheetsClient();
    const { criticalTab, maintenanceTab, argSeparator } = tabsMeta
        ? {
            criticalTab: toTabInfo(tabsMeta.tabs.critical),
            maintenanceTab: toTabInfo(tabsMeta.tabs.maintenance),
            argSeparator: tabsMeta.argSeparator,
        }
        : await resolveTabs(sheets);

    // Baris header selalu ikut (findHeader memindai 30 baris pertama), lalu ekornya.
    const HEADER_SCAN = 30;
    const cMulai = Math.max(HEADER_SCAN + 1, startCritical);
    const mMulai = Math.max(HEADER_SCAN + 1, startMaintenance);

    const res = await withRetry(() => sheets.spreadsheets.values.batchGet({
        spreadsheetId: sheetId(),
        ranges: [
            `${quoteTab(criticalTab.title)}!A1:AE${HEADER_SCAN}`,
            `${quoteTab(criticalTab.title)}!A${cMulai}:AE`,
            `${quoteTab(maintenanceTab.title)}!A1:AE${HEADER_SCAN}`,
            `${quoteTab(maintenanceTab.title)}!A${mMulai}:AE`,
        ],
        valueRenderOption: 'FORMATTED_VALUE',
    }), 'batchGet ekor critical+maintenance');

    const vr = (res.data.valueRanges ?? []).map(v => (v.values ?? []) as string[][]);
    // Susun ulang jadi array bernomor baris sheet; sisanya sengaja dibiarkan berlubang.
    const rakit = (kepala: string[][], ekor: string[][], mulai: number): string[][] => {
        const rows: string[][] = [];
        kepala.forEach((r, i) => { rows[i] = r; });
        ekor.forEach((r, i) => { rows[mulai - 1 + i] = r; });
        return rows;
    };
    const criticalRows = rakit(vr[0] ?? [], vr[1] ?? [], cMulai);
    const maintenanceRows = rakit(vr[2] ?? [], vr[3] ?? [], mMulai);

    const criticalParsed = parseCriticalTab(criticalRows);
    const maintenanceParsed = parseMaintenanceTab(maintenanceRows);

    const [criticalUids, maintenanceUids] = await readPhotoUidMap(sheets, [
        { title: criticalTab.title, photoColIndex: criticalParsed.photoColIndex, startRow: cMulai },
        { title: maintenanceTab.title, photoColIndex: maintenanceParsed.photoColIndex, startRow: mMulai },
    ]);
    applyPhotoUids(criticalParsed.rows, criticalUids);
    applyPhotoUids(maintenanceParsed.rows, maintenanceUids);

    criticalParsed.rows.reverse();
    maintenanceParsed.rows.reverse();

    return {
        criticals: criticalParsed.rows,
        maintenances: maintenanceParsed.rows,
        tabs: {
            critical: toTabRef('critical', criticalTab, criticalParsed),
            maintenance: toTabRef('maintenance', maintenanceTab, maintenanceParsed),
        },
        argSeparator,
        fetchedAt: new Date().toISOString(),
        /** Peta uid SEBATAS EKOR — di luar itu cermin sudah dijaga writePhotoCell & syncFull. */
        uidMaps: { critical: criticalUids, maintenance: maintenanceUids },
    };
}

/**
 * Baca SATU baris saja, plus blok header di atasnya. Dipakai saat deep-link dari spreadsheet
 * menunjuk baris yang belum tercermin — yaitu baris yang baru diketik operator, justru kasus
 * yang paling sering. Dulu satu-satunya jalan adalah menunggu syncTail seluruhnya selesai.
 *
 * Satu panggilan Sheets berisi dua rentang, dan metadata tabnya diserahkan pemanggil
 * (tersimpan di cermin), jadi tidak ada `spreadsheets.get` sama sekali.
 *
 * null = barisnya kosong / bukan baris data / nomor barisnya di luar sheet. Pemanggil WAJIB
 * mencocokkan sidik jari hasilnya sebelum mempercayainya: nomor baris saja bisa basi.
 */
export async function loadSingleSheetRow(
    kind: 'critical' | 'maintenance',
    tabTitle: string,
    rowIndex: number,
): Promise<CriticalRow | MaintenanceRow | null> {
    if (!Number.isInteger(rowIndex) || rowIndex < 1) return null;
    const sheets = getSheetsClient();
    const HEADER_SCAN = 30;

    const res = await withRetry(() => sheets.spreadsheets.values.batchGet({
        spreadsheetId: sheetId(),
        ranges: [
            `${quoteTab(tabTitle)}!A1:AE${HEADER_SCAN}`,
            `${quoteTab(tabTitle)}!A${rowIndex}:AE${rowIndex}`,
        ],
        valueRenderOption: 'FORMATTED_VALUE',
    }), `batchGet baris ${tabTitle}!${rowIndex}`);

    const vr = (res.data.valueRanges ?? []).map(v => (v.values ?? []) as string[][]);
    // Array bernomor baris sheet, berlubang di antaranya — bentuk yang sama dengan
    // pembacaan ekor, jadi parser yang sama bisa dipakai apa adanya.
    const rows: string[][] = [];
    (vr[0] ?? []).forEach((r, i) => { rows[i] = r; });
    const target = (vr[1] ?? [])[0];
    if (target) rows[rowIndex - 1] = target;

    const parsed = kind === 'critical' ? parseCriticalTab(rows) : parseMaintenanceTab(rows);
    // Baris di dalam blok header ikut terparse; ambil yang nomornya memang diminta.
    return parsed.rows.find(r => r.rowIndex === rowIndex) ?? null;
}

/** Status selesai = "OK" (case-insensitive). Selain itu dianggap masih aktif. */
export function isStatusDone(status: string): boolean {
    return status.trim().toLowerCase() === 'ok';
}

// ─── Lapisan item (item-centric) ─────────────────────────────────────────────

export interface ItemDetail {
    key: string;
    itemName: string;
    variant: string;
    code: string;
    criticals: CriticalRow[];
    maintenances: MaintenanceRow[];
}

function normItem(item: string): string {
    return (item ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * Pecah kolom Varian yang sering diketik gabungan/kotor menjadi token varian
 * tunggal. Satu record bisa menyangkut >1 varian dan diperlakukan satu-per-satu:
 *   "DEF" / "D/E/F" / "D E F" / "D , F" / "A&C" / "D/E./F" → ['D','E','F'] dst.
 * Pemisah: / , & + . - dan spasi. Chunk semua-huruf (≤6, rentang varian A–F umum)
 * dipecah per huruf. Varian kosong → [] (item tanpa varian, satu halaman sendiri).
 */
export function variantTokens(varian: string): string[] {
    const cleaned = (varian ?? '').toUpperCase().replace(/[/,&+.\-]/g, ' ');
    const chunks = cleaned.split(/\s+/).map(c => c.trim()).filter(Boolean);
    const tokens: string[] = [];
    for (const ch of chunks) {
        if (/^[A-Z]+$/.test(ch) && ch.length <= 6) {
            for (const letter of ch) tokens.push(letter);
        } else {
            tokens.push(ch);
        }
    }
    return Array.from(new Set(tokens));
}

/** Key satu halaman item = normalisasi(item) + '|' + token varian (kosong → tanpa suffix). */
export function itemKeyOf(item: string, variantToken: string): string {
    const nItem = normItem(item);
    const nVar = (variantToken ?? '').trim().toUpperCase();
    return nVar ? `${nItem}|${nVar}` : nItem;
}

/** Semua key halaman item yang dimiliki satu record (satu per token varian). */
export function recordItemKeys(item: string, varian: string): string[] {
    const tokens = variantTokens(varian);
    if (tokens.length === 0) return [itemKeyOf(item, '')];
    return tokens.map(t => itemKeyOf(item, t));
}

/** Ekstrak kode equipment (mis. "B-02.01", "K-08.17") dari nama item. */
export function extractCode(item: string): string {
    const m = (item ?? '').match(/([A-Za-z]{1,5}-\d{2}\.\d{2})/);
    return m ? m[1].toUpperCase() : '';
}

// ─── Format ID baris ─────────────────────────────────────────────────────────
//
// ID = <kode item>-<varian>-<acak>, mis. "L-08.12-A-a1". Ditulis di kolom B ("ID").
//
// Bagian acaknya yang menjamin tiap baris beda; bagian kode item yang membuat ID
// BISA DIPERIKSA: kalau `L-08.12-A-a1` duduk di baris "M-08.15 Coal Feeder",
// itu tanda isi barisnya tergeser (mis. sortir kolom data tanpa ikut kolom ID) —
// pergeseran yang, dengan UUID acak murni, mustahil dideteksi manusia maupun mesin.
//
// Kode equipment dipilih, bukan nama item, karena 4% baris memang tidak punya kode
// (dipakai slug nama) DAN karena satu kode kerap punya beberapa ejaan nama
// ("P-02.22 CEDIMENT PUMP" vs "… PUMP B") — kode selamat dari koreksi ejaan.
//
// Sufiks acaknya sependek mungkin (2 karakter) karena kolom ID ada di antara data yang
// dibaca operator: yang perlu dijamin cuma "beda dari baris lain PADA ITEM YANG SAMA",
// bukan unik sedunia. 2 karakter = 1.296 kemungkinan per item; kalau satu item sampai
// sesak, panjangnya baru bertambah sendiri per baris — bukan serentak.

const UID_SUFFIX_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const UID_SUFFIX_MIN_LEN = 2;
const UID_SUFFIX_MAX_LEN = 4;
/**
 * Sufiks di ujung ID: 2–4 karakter basis-36 (format sekarang) atau 6 hex (format
 * sebelum ID diringkas). Sengaja HURUF KECIL saja — varian selalu huruf besar, jadi
 * "L-08.12-AB" tidak akan salah dikira sufiks saat prefiksnya dipotong.
 */
const UID_RANDOM_RE = /-[0-9a-z]{2,8}$/;
/** UUID v4 = format paling lama (sebelum ID ber-item). Tidak bisa dicek kecocokannya. */
const LEGACY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nama item tanpa kode → slug pendek, mis. "03 UBB" → "03-UBB". */
function itemSlug(item: string): string {
    return (item ?? '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 16)
        .replace(/-+$/, '');
}

/**
 * Bagian UID yang menyebut barisnya milik apa: kode equipment (atau slug nama bila
 * tidak berkode) + varian. Inilah yang dibandingkan dengan isi baris saat memeriksa.
 */
export function uidPrefixFor(item: string, varian: string): string {
    const base = extractCode(item) || itemSlug(item) || 'ITEM';
    const v = (varian ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
    return v ? `${base}-${v}` : base;
}

/**
 * Label baris untuk dibaca manusia: "P-02.10 D". Sama isinya dengan prefix uid, hanya
 * dipisah spasi — jangan diturunkan dari uidPrefixFor dengan mengganti semua tanda
 * hubung, karena tanda hubung di dalam kode equipment ("P-02.10") ikut rusak.
 */
export function rowItemLabel(item: string, varian: string): string {
    const base = extractCode(item) || itemSlug(item) || '';
    const v = (varian ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
    return v ? `${base} ${v}` : base;
}

function randomSuffix(len: number): string {
    let s = '';
    for (let i = 0; i < len; i++) s += UID_SUFFIX_ALPHABET[randomInt(UID_SUFFIX_ALPHABET.length)];
    return s;
}

/** ID baru untuk satu baris. `taken` menjamin tidak ada yang kembar di spreadsheet. */
export function buildRowUid(item: string, varian: string, taken: Set<string>): string {
    const prefix = uidPrefixFor(item, varian);
    // Mulai dari sufiks terpendek; baru memanjang kalau ruang selebar itu memang penuh
    // (item dengan ratusan catatan), dan hanya untuk baris yang kebetulan bentrok.
    for (let len = UID_SUFFIX_MIN_LEN; len <= UID_SUFFIX_MAX_LEN; len++) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const uid = `${prefix}-${randomSuffix(len)}`;
            if (!taken.has(uid)) { taken.add(uid); return uid; }
        }
    }
    // Praktis mustahil (butuh jutaan baris pada satu item); tetap disediakan supaya
    // fungsi ini tidak pernah mengembalikan ID kembar.
    const uid = `${prefix}-${Date.now().toString(36)}`;
    taken.add(uid);
    return uid;
}

/**
 * Apakah ID ini masih cocok dengan isi barisnya?
 * UUID lama (sebelum ID ber-item) selalu dianggap cocok — tidak ada yang bisa diperiksa.
 */
export function uidMatchesRow(uid: string, item: string, varian: string): boolean {
    if (!uid || LEGACY_UUID_RE.test(uid)) return true;
    const prefix = uid.replace(UID_RANDOM_RE, '');
    return prefix === uidPrefixFor(item, varian);
}

// ─── Feed aktivitas terbaru ──────────────────────────────────────────────────
//
// Penyaringan, pencarian, dan pengambilan per item TIDAK lagi dilakukan di sini.
// Dulu ada getItemDetail/buildRecentFeed/filterRecentFeed yang menyaring 27rb baris di
// memori tiap request; sekarang semuanya query SQL di lib/critical-sheet-db.ts. Fungsi
// lamanya sengaja dihapus, bukan dibiarkan: dua implementasi untuk semantik yang sama
// (urutan feed, aturan pencocokan kata kunci) pasti menyimpang tanpa ada yang menyadari.
// Tipe di bawah tetap di sini karena dipakai bersama oleh lapis DB dan klien.

/**
 * Satu baris di daftar record. Kolom yang hanya ada di salah satu tab diisi ''
 * untuk tab lainnya (shift → maintenance, tanggalOk → critical) supaya konsumen
 * tidak perlu narrowing per kind.
 */
export interface RecentEntry {
    /** '' selama baris itu belum punya foto — identitasnya baru lahir saat foto pertama. */
    uid: string;
    kind: 'critical' | 'maintenance';
    /** Baris sheet 1-based + sidik jari isinya: identitas baris yang BELUM punya uid. */
    rowIndex: number;
    sig: string;
    tanggal: string | null;
    tanggalRaw: string;
    shift: string;           // maintenance saja
    itemName: string;
    variant: string;         // varian mentah (kolom E) — bisa gabungan
    code: string;
    uraian: string;
    notifikasi: string;      // "Notif" (critical) & "Notifikasi" (maintenance) = hal yang sama
    scope: string;
    status: string;
    pelapor: string;         // critical saja ("Yang Melaporkan")
    foreman: string;         // maintenance saja
    tanggalOkRaw: string;    // critical saja
    itemKey: string;         // target navigasi ke halaman item (token varian pertama)
}

/**
 * Normalisasi teks untuk pencocokan pencarian: lowercase, spasi dirapatkan.
 * Dipakai sync untuk mengisi kolom `search`, sehingga hasil query SQL sama persis
 * dengan aturan pencocokan yang dulu dijalankan di memori.
 */
export function normSearch(v: string): string {
    return (v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ─── Kolom "Dokumentasi" ─────────────────────────────────────────────────────

/** Lokasi satu baris sheet berdasarkan uid-nya. */
export interface RowLocation {
    kind: 'critical' | 'maintenance';
    tabTitle: string;
    rowIndex: number;             // 1-based
    photoColIndex: number | null;
    itemKey: string;              // halaman item tujuan link
    /** Kode + varian baris itu — dipakai sebagai label sel Dokumentasi. */
    itemLabel: string;
}

/**
 * Sidik jari baris yang disimpan bersama fotonya di `sheet_photos`. Dipakai untuk
 * menemukan baris ketika uid belum (atau tidak lagi) ada di sel Dokumentasi.
 */
export interface RowHint {
    kind: 'critical' | 'maintenance';
    rowIndex: number | null;
    item: string;
    varian: string;
    uraian: string;
    tanggalRaw: string;
}

type AnyRow = CriticalRow | MaintenanceRow;

function toLocation(data: CriticalSheetData, kind: 'critical' | 'maintenance', row: AnyRow): RowLocation {
    const tab = kind === 'critical' ? data.tabs.critical : data.tabs.maintenance;
    return {
        kind,
        tabTitle: tab.title,
        rowIndex: row.rowIndex,
        photoColIndex: tab.photoColIndex,
        itemKey: recordItemKeys(row.item, row.varian)[0],
        itemLabel: rowItemLabel(row.item, row.varian),
    };
}

/**
 * Cari baris pemilik sebuah uid, berlapis dari yang paling dapat dipercaya:
 *
 *   1. sel Dokumentasi — satu-satunya sumber yang selalu ikut berpindah bersama barisnya;
 *   2. sidik jari isi baris (`hint`) — WAJIB ada jalur ini, karena foto PERTAMA sebuah
 *      baris justru ditulis saat selnya masih kosong: tanpa ini, sel tidak akan pernah
 *      terisi dan uid-nya tidak akan pernah muncul di lapis 1 (buntu);
 *   3. kolom ID di AA — arsip dari masa sebelum identitas pindah. Berguna untuk baris
 *      lama, dan nilainya memang menyusut seiring waktu karena tidak ditulis lagi.
 *
 * `hint.rowIndex` dicoba lebih dulu sebagai tebakan, tapi selalu diverifikasi dengan
 * sidik jarinya — nomor baris bisa bergeser kapan saja oleh penyisipan di atasnya.
 * Sidik jari yang cocok di LEBIH DARI SATU baris dianggap tidak menentukan (null),
 * karena menebak di situ berarti menempelkan foto ke baris yang mungkin salah.
 */
export function findRowByUid(data: CriticalSheetData, uid: string, hint?: RowHint | null): RowLocation | null {
    if (!uid) return null;

    // 1. Sel Dokumentasi.
    const critical = data.criticals.find(c => c.uid === uid);
    if (critical) return toLocation(data, 'critical', critical);
    const maintenance = data.maintenances.find(m => m.uid === uid);
    if (maintenance) return toLocation(data, 'maintenance', maintenance);

    // 2. Sidik jari.
    if (hint) {
        const rows: AnyRow[] = hint.kind === 'critical' ? data.criticals : data.maintenances;
        const sidik = rowFingerprint(hint.item, hint.varian, hint.uraian, hint.tanggalRaw);
        const cocok = (r: AnyRow) => rowFingerprint(r.item, r.varian, r.uraian, r.tanggalRaw) === sidik;

        if (hint.rowIndex !== null) {
            const tebakan = rows.find(r => r.rowIndex === hint.rowIndex);
            if (tebakan && cocok(tebakan)) return toLocation(data, hint.kind, tebakan);
        }
        const kandidat = rows.filter(cocok);
        if (kandidat.length === 1) return toLocation(data, hint.kind, kandidat[0]);
        if (kandidat.length > 1) {
            console.warn(
                `[critical-sheet] uid ${uid}: ${kandidat.length} baris ${hint.kind} bersidik jari sama ` +
                `(baris ${kandidat.map(k => k.rowIndex).join(', ')}) — tidak ditebak.`,
            );
            return null;
        }
    }

    // 3. Arsip kolom ID.
    const lamaC = data.criticals.find(c => c.legacyId === uid);
    if (lamaC) return toLocation(data, 'critical', lamaC);
    const lamaM = data.maintenances.find(m => m.legacyId === uid);
    if (lamaM) return toLocation(data, 'maintenance', lamaM);

    return null;
}

/** URL halaman web yang membuka galeri foto satu record (dipakai di sel & tombol salin). */
export function photoPageUrl(itemKey: string, uid: string): string {
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
    return `${base}/critical-maintenance?item=${encodeURIComponent(itemKey)}&foto=${encodeURIComponent(uid)}`;
}

/** Nama jenis record untuk dibaca manusia (sel spreadsheet & label di web). */
export function recordKindLabel(kind: 'critical' | 'maintenance'): string {
    return kind === 'critical' ? 'Critical' : 'Maintenance';
}

/**
 * Isi sel "Dokumentasi": kosong bila belum ada foto, HYPERLINK bila sudah.
 *
 * Labelnya menyebut JENIS + ITEM baris itu ("📷 Critical P-02.10 D (3)"), bukan sekadar
 * "Foto (3)", dengan alasan yang sama seperti kode item di dalam ID: sel yang menyebut
 * miliknya sendiri membuat pergeseran baris terlihat mata. Kalau sel di baris Coal Feeder
 * berbunyi "Critical P-02.10 D", ada yang salah dan operator langsung melihatnya.
 *
 * `sep` WAJIB dari locale spreadsheet (lihat argSeparatorForLocale) — memakai pemisah
 * yang salah membuat selnya jadi #ERROR! alih-alih tautan.
 */
export function photoCellFormula(
    count: number | MediaCount,
    url: string,
    sep: ArgSeparator,
    itemLabel = '',
    kindLabel = '',
): string {
    if (totalMedia(count) <= 0) return '';
    // Tanda kutip ganda di dalam formula HYPERLINK di-escape dengan menggandakannya.
    const safeUrl = url.replace(/"/g, '""');
    return `=HYPERLINK("${safeUrl}"${sep}"${photoCellLabel(count, itemLabel, kindLabel)}")`;
}

/**
 * Teks yang TERLIHAT di sel Dokumentasi — juga yang tersimpan di cermin Postgres, karena
 * dari sheet yang terbaca memang tampilannya (FORMATTED_VALUE), bukan formulanya.
 */
export function photoCellLabel(count: number | MediaCount, itemLabel = '', kindLabel = ''): string {
    const escape = (v: string) => v.trim().replace(/"/g, '""');
    const c = normalizeMediaCount(count);
    // Angkanya TOTAL media, tanpa kata "foto"/"video" — selnya duduk di antara kolom yang
    // dibaca cepat, jadi ia harus sependek mungkin. Jenisnya disampaikan lewat ikon saja:
    // record berisi video jangan berikon kamera foto, operator akan salah menduga isinya.
    const ikon = c.video > 0 ? (c.foto > 0 ? '📷🎬' : '🎬') : '📷';
    const total = c.foto + c.video;
    const bagian = [escape(kindLabel), escape(itemLabel)].filter(Boolean).join(' ');
    return bagian ? `${ikon} ${bagian} (${total})` : `${ikon} Dokumentasi (${total})`;
}

/** Jumlah media satu baris, dipisah per jenis — sel Dokumentasi menyebut keduanya. */
export interface MediaCount { foto: number; video: number }

/** Angka telanjang = jumlah foto (bentuk lama, dari sebelum video ada). */
function normalizeMediaCount(c: number | MediaCount): MediaCount {
    return typeof c === 'number' ? { foto: c, video: 0 } : c;
}

export function totalMedia(c: number | MediaCount): number {
    const n = normalizeMediaCount(c);
    return n.foto + n.video;
}

/**
 * Posisi kolom "Dokumentasi" yang SEDANG berlaku di sebuah tab, dibaca langsung dari baris
 * headernya. `null` = kolomnya tidak ada di baris itu.
 *
 * Dipakai sebagai pemeriksaan tepat sebelum menulis. Posisi yang tersimpan di cermin baru
 * diperbarui saat sync berjalan (cron ~15 menit), sedangkan operator sesekali memindah
 * kolom — Dokumentasi tab Maintenance pernah bergeser K → I. Menulis dengan posisi basi
 * berarti menaruh formula HYPERLINK di kolom milik data operator, menimpanya diam-diam.
 * Satu pembacaan sebaris ini murah: upload foto jarang, dan salahnya tidak bisa dibatalkan.
 */
export async function readPhotoColIndex(tabTitle: string, headerRowIndex: number): Promise<number | null> {
    const res = await withRetry(() => getSheetsClient().spreadsheets.values.get({
        spreadsheetId: sheetId(),
        range: `${quoteTab(tabTitle)}!A${headerRowIndex}:AE${headerRowIndex}`,
    }), `baca baris header ${tabTitle}`);
    const row = ((res.data.values ?? [])[0] ?? []) as string[];
    const map = buildHeaderMap(row);
    const name = PHOTO_HEADER_NAMES.find(n => n in map);
    return name === undefined ? null : map[name];
}

/**
 * Tulis satu sel "Dokumentasi" — primitif, tanpa tahu asal barisnya.
 * Pemilihan barisnya ada di lib/critical-sheet-db.ts (writePhotoCell), yang mencarinya di
 * cermin Postgres alih-alih memuat ulang seluruh spreadsheet.
 */
export async function updatePhotoCell(
    tabTitle: string,
    photoColIndex: number,
    rowIndex: number,
    value: string,
): Promise<void> {
    const col = colLetter(photoColIndex);
    await withRetry(() => getSheetsClient().spreadsheets.values.update({
        spreadsheetId: sheetId(),
        range: `${quoteTab(tabTitle)}!${col}${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] },
    }), `tulis Dokumentasi ${tabTitle}!${col}${rowIndex}`);
}
