/**
 * Critical Maintenance — loader Google Sheets (sheet = sumber kebenaran).
 *
 * Spreadsheet berisi DUA TAB (di-resolve by gid, tahan rename):
 *   1. Critical Equipment : No | Tanggal Dilaporkan | Yang Melaporkan | Nama dan Nomor Item |
 *                           Varian | Uraian | Notif | Scope | Status | Tanggal di OK | Yang Meng"OK" | Gabungan
 *   2. Maintenance        : No | Tanggal Dilaporkan | Shift | Nama dan Nomor Item | Varian |
 *                           Uraian | Scope | Status | Notifikasi | Foreman | gabungan | (Ref Critical)
 * Posisi header TIDAK di-hardcode — dideteksi dari isi sel (tahan sisip baris/kolom).
 * Input data tetap di spreadsheet; app hanya MENULIS kolom "ID" (identitas baris yang
 * dipakai relasi foto) dan tidak pernah menyentuh kolom isian operator.
 *
 * Skala (trial, Jul 2026): ±4.5rb baris critical + ±23rb baris maintenance. Terlalu
 * besar untuk unstable_cache (limit entry ±2MB), jadi cache di memori module dengan
 * TTL — di Vercel berarti per-instance lambda; instance warm melayani dari memori,
 * cold start baca ulang. Kuota Sheets (300 read/menit) tetap aman.
 */

import { randomInt } from 'crypto';
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
const UID_HEADER = 'ID';
const UID_HEADER_NAME = 'id';                 // sudah dinormalisasi (lihat normHeader)
const UID_HEADER_LEGACY_PREFIX = 'web_uid';   // nama lama, sebelum kolom dipindah ke B
const PHOTO_HEADER = 'link foto';

const CACHE_TTL_MS = 60_000;
// Tombol "Perbarui data" & menu di spreadsheet memanggil force-load. Satu load penuh =
// ~84rb baris dua tab, jadi force yang datang beruntun (banyak operator klik bersamaan)
// tetap dilayani dari cache selama masih lebih baru dari ambang ini.
const MIN_FORCE_INTERVAL_MS = 15_000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CriticalRow {
    uid: string;
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
    linkFoto: string;              // isi sel "Link Foto" (formula HYPERLINK, '' bila kosong)
}

export interface MaintenanceRow {
    uid: string;
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
    photoColIndex: number | null;   // null = kolom "Link Foto" belum dibuat di sheet
}

export interface CriticalSheetData {
    criticals: CriticalRow[];
    maintenances: MaintenanceRow[];
    tabs: { critical: TabRef; maintenance: TabRef };
    /** Pemisah argumen formula sesuai locale spreadsheet (lihat argSeparatorForLocale). */
    argSeparator: ArgSeparator;
    fetchedAt: string;
}

// ─── Parsing helpers ─────────────────────────────────────────────────────────

function quoteTab(title: string): string {
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
 * Kolom ID dikenali dari header "ID" (nama sekarang, kolom B) maupun "web_uid …"
 * (nama lama sebelum kolomnya dipindah) — sheet lama tetap terbaca tanpa diubah dulu.
 */
export function isUidHeader(normalizedName: string): boolean {
    return normalizedName === UID_HEADER_NAME || normalizedName.startsWith(UID_HEADER_LEGACY_PREFIX);
}

/** Kolom yang dikelola app di satu tab. Kolom foto opsional (null = belum dibuat). */
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
    // Tidak ada tebakan posisi di sini. Dulu ada fallback ke kolom AB, dan itu berbahaya
    // sekarang: kolom ID hidup di B, di tengah data operator. Salah tebak = menimpa isian
    // operator ATAU mengisi ID baru di kolom kosong sehingga SELURUH relasi foto putus.
    // Lebih baik berhenti mengelola ID (baca tetap jalan) dan berteriak di log.
    if (uidCols.length === 0) {
        console.error(
            `[critical-sheet] Kolom "${UID_HEADER}" TIDAK DITEMUKAN di baris header. Foto tidak bisa ` +
            `dikaitkan ke baris sampai kolomnya ada. Periksa: npx tsx scripts/check-critical-sheet.ts`,
        );
    }
    return {
        uidColIndex: uidCols[0] ?? null,
        photoColIndex: map[PHOTO_HEADER] ?? null,
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
            uid: uidColIndex === null ? '' : cell(r, uidColIndex),
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
            uid: uidColIndex === null ? '' : cell(r, uidColIndex),
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

// ─── UID backfill ────────────────────────────────────────────────────────────

function colLetter(index0: number): string {
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
 * Isi ID untuk baris yang belum punya di satu tab, tulis balik HANYA kolom ID.
 * Backfill pertama bisa puluhan ribu baris → tulis per BLOK KONTIGU (bukan per sel)
 * supaya payload batchUpdate kecil. Re-read kolom ID fresh sebelum menulis untuk
 * mempersempit race antar instance (sel yang keburu terisi tidak ditimpa; sisa race
 * last-writer-wins dan tidak berbahaya).
 */
async function ensureRowUids(
    sheets: ReturnType<typeof getSheetsClient>,
    tab: TabInfo,
    parsed: { headerRowIndex: number; uidColIndex: number | null; rows: { uid: string; rowIndex: number; item: string; varian: string }[] },
    /** Seluruh ID yang sudah terpakai di spreadsheet — penjaga agar tidak ada yang kembar. */
    taken: Set<string>,
): Promise<void> {
    // Kolom ID tidak ada → tidak ada tempat yang aman untuk menulis (sudah dilaporkan
    // di resolveManagedCols). Membaca sheet tetap jalan, hanya foto yang nonaktif.
    if (parsed.uidColIndex === null) return;
    const needy = parsed.rows.filter(r => !r.uid);
    if (needy.length === 0) return;

    // ── Rem darurat ──────────────────────────────────────────────────────────
    // Baris baru datang beberapa per hari. Kalau tiba-tiba SEBAGIAN BESAR baris di tab
    // yang sudah besar kehilangan ID, itu bukan baris baru — itu kolom ID yang salah
    // dibaca (kolom bergeser karena penyisipan, kolom ID ganda, atau header berubah).
    // Menulis ulang puluhan ribu ID akan memutus SELURUH relasi foto, jadi lebih baik
    // batal mengisi dan berteriak di log; membaca tetap jalan.
    if (parsed.rows.length > 200 && needy.length > parsed.rows.length / 2) {
        console.error(
            `[critical-sheet] BACKFILL DIBATALKAN di tab ${tab.title}: ${needy.length} dari ` +
            `${parsed.rows.length} baris tidak punya ID di kolom ${colLetter(parsed.uidColIndex)}. ` +
            `Ini pola "kolom salah", bukan baris baru. Periksa posisi kolom ID ` +
            `(npx tsx scripts/check-critical-sheet.ts) sebelum melanjutkan.`,
        );
        return;
    }

    const uidColIndex = parsed.uidColIndex;

    // Grid bisa lebih sempit dari kolom uid → lebarkan sekali.
    if (tab.columnCount < uidColIndex + 1) {
        await withRetry(() => sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId(),
            requestBody: {
                requests: [{
                    appendDimension: {
                        sheetId: tab.gid,
                        dimension: 'COLUMNS',
                        length: uidColIndex + 1 - tab.columnCount,
                    },
                }],
            },
        }), `expand columns ${tab.title}`);
    }

    const uidCol = colLetter(uidColIndex);
    const fresh = await withRetry(() => sheets.spreadsheets.values.get({
        spreadsheetId: sheetId(),
        range: `${quoteTab(tab.title)}!${uidCol}1:${uidCol}`,
    }), `get uid column ${tab.title}`);
    const freshCol = (fresh.data.values ?? []) as string[][];
    const freshAt = (rowIndex1: number): string => (freshCol[rowIndex1 - 1]?.[0] ?? '').trim();

    // Kumpulkan sel yang benar-benar perlu ditulis (masih kosong setelah re-read).
    const toWrite: { rowIndex: number; value: string }[] = [];
    if (!freshAt(parsed.headerRowIndex)) {
        toWrite.push({ rowIndex: parsed.headerRowIndex, value: UID_HEADER });
    }
    for (const row of needy) {
        const existing = freshAt(row.rowIndex);
        if (existing) { row.uid = existing; taken.add(existing); continue; }
        row.uid = buildRowUid(row.item, row.varian, taken);
        toWrite.push({ rowIndex: row.rowIndex, value: row.uid });
    }
    if (toWrite.length === 0) return;

    // Grup blok kontigu → satu range per blok.
    toWrite.sort((a, b) => a.rowIndex - b.rowIndex);
    const data: { range: string; values: string[][] }[] = [];
    let block: { start: number; values: string[][] } | null = null;
    for (const w of toWrite) {
        if (block && w.rowIndex === block.start + block.values.length) {
            block.values.push([w.value]);
        } else {
            if (block) {
                data.push({ range: `${quoteTab(tab.title)}!${uidCol}${block.start}:${uidCol}${block.start + block.values.length - 1}`, values: block.values });
            }
            block = { start: w.rowIndex, values: [[w.value]] };
        }
    }
    if (block) {
        data.push({ range: `${quoteTab(tab.title)}!${uidCol}${block.start}:${uidCol}${block.start + block.values.length - 1}`, values: block.values });
    }

    await withRetry(() => sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId(),
        requestBody: { valueInputOption: 'RAW', data },
    }), `backfill ${toWrite.length} ID (${data.length} blok) ${tab.title}`);
    console.log(`[critical-sheet] backfill ${toWrite.length} ID di tab ${tab.title}`);
}

/**
 * Dua kerusakan yang dulu tidak pernah ketahuan, sekarang dilaporkan tiap kali sheet
 * dibaca penuh. Sengaja HANYA melapor — ID tidak pernah diperbaiki otomatis, karena
 * mengganti ID berarti memutus foto yang menempel padanya, dan ketidakcocokan bisa
 * saja berasal dari koreksi nama item yang sah.
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
            `[critical-sheet] ${label}: ${duplicates.length} ID KEMBAR — foto akan tampil di baris yang salah. ` +
            duplicates.slice(0, 5).join('; '),
        );
    }
    if (mismatched.length) {
        console.error(
            `[critical-sheet] ${label}: ${mismatched.length} baris ID-nya TIDAK COCOK dengan itemnya — ` +
            `biasanya tanda isi baris tergeser (sortir tanpa ikut kolom uid). ` +
            mismatched.slice(0, 5).join('; '),
        );
    }
}

// ─── Loader (in-memory cache, TTL 60s) ───────────────────────────────────────

async function loadCriticalSheetUncached(): Promise<CriticalSheetData> {
    const sheets = getSheetsClient();

    // Resolve kedua tab by gid tiap load (murah; sekaligus tahan rename tab).
    const meta = await withRetry(() => sheets.spreadsheets.get({
        spreadsheetId: sheetId(),
        fields: 'properties.locale,sheets.properties(sheetId,title,gridProperties.columnCount)',
    }), 'get critical spreadsheet meta');
    const findTab = (gid: number): TabInfo => {
        const t = meta.data.sheets?.find(s => s.properties?.sheetId === gid);
        if (!t?.properties?.title) throw new Error(`Tab gid=${gid} tidak ditemukan di spreadsheet critical`);
        return { gid, title: t.properties.title, columnCount: t.properties.gridProperties?.columnCount ?? 26 };
    };
    const criticalTab = findTab(tabGid('GOOGLE_SHEETS_CRITICAL_GID'));
    const maintenanceTab = findTab(tabGid('GOOGLE_SHEETS_MAINTENANCE_GID'));

    // Satu batchGet untuk kedua tab. A:AE = kolom ID + data operator + kolom Link Foto,
    // dengan sisa ruang bila kolomnya bergeser akibat penyisipan kolom baru.
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

    // Satu himpunan ID untuk KEDUA tab: foto dicari lintas tab lewat ID, jadi kembar
    // antar-tab pun berbahaya.
    const taken = new Set<string>();
    for (const r of [...criticalParsed.rows, ...maintenanceParsed.rows]) if (r.uid) taken.add(r.uid);

    await ensureRowUids(sheets, criticalTab, criticalParsed, taken);
    await ensureRowUids(sheets, maintenanceTab, maintenanceParsed, taken);

    reportUidAnomalies('Critical Equipment', criticalParsed.rows);
    reportUidAnomalies('Maintenance', maintenanceParsed.rows);

    // Terbaru dulu (urutan input sheet = kronologis).
    criticalParsed.rows.reverse();
    maintenanceParsed.rows.reverse();

    const toRef = (kind: 'critical' | 'maintenance', tab: TabInfo, parsed: ParsedTab<unknown>): TabRef => ({
        kind,
        gid: tab.gid,
        title: tab.title,
        headerRowIndex: parsed.headerRowIndex,
        uidColIndex: parsed.uidColIndex,
        photoColIndex: parsed.photoColIndex,
    });

    return {
        criticals: criticalParsed.rows,
        maintenances: maintenanceParsed.rows,
        tabs: {
            critical: toRef('critical', criticalTab, criticalParsed),
            maintenance: toRef('maintenance', maintenanceTab, maintenanceParsed),
        },
        argSeparator: argSeparatorForLocale(meta.data.properties?.locale ?? ''),
        fetchedAt: new Date().toISOString(),
    };
}

let cache: { data: CriticalSheetData; at: number } | null = null;
let inflight: Promise<CriticalSheetData> | null = null;

/**
 * Loader ter-cache in-memory (TTL 60 detik) dengan dedup request paralel:
 * viewer serentak berbagi satu fetch. `force` (tombol "Perbarui data" & menu di
 * spreadsheet) memangkas TTL menjadi MIN_FORCE_INTERVAL_MS — bukan mengabaikannya sama
 * sekali — supaya klik beruntun dari banyak operator tidak menjadi belasan pembacaan
 * penuh sekaligus. Kalau baca sheet gagal (jaringan/kuota) tapi masih ada cache lama,
 * sajikan cache lama (stale-while-error) alih-alih error.
 */
export async function loadCriticalSheet(force = false): Promise<CriticalSheetData> {
    const ttl = force ? MIN_FORCE_INTERVAL_MS : CACHE_TTL_MS;
    if (cache && Date.now() - cache.at < ttl) return cache.data;
    if (inflight) return inflight;
    inflight = loadCriticalSheetUncached()
        .then(data => {
            cache = { data, at: Date.now() };
            return data;
        })
        .catch(err => {
            if (cache) {
                console.warn('[critical-sheet] load gagal, sajikan cache lama:', err instanceof Error ? err.message : err);
                return cache.data;
            }
            throw err;
        })
        .finally(() => { inflight = null; });
    return inflight;
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

/** Ambil semua record critical & maintenance untuk satu item key (data sudah terbaru-dulu).
 *  Record multi-varian (mis. "DEF") ikut muncul di tiap halaman varian penyusunnya. */
export function getItemDetail(data: CriticalSheetData, key: string): ItemDetail | null {
    const criticals = data.criticals.filter(c => recordItemKeys(c.item, c.varian).includes(key));
    const maintenances = data.maintenances.filter(m => recordItemKeys(m.item, m.varian).includes(key));
    if (criticals.length === 0 && maintenances.length === 0) return null;
    const sample = criticals[0] ?? maintenances[0];
    const barIdx = key.lastIndexOf('|');
    const variant = barIdx >= 0 ? key.slice(barIdx + 1) : '';
    return {
        key,
        itemName: (sample.item ?? '').replace(/\s+/g, ' ').trim(),
        variant,
        code: extractCode(sample.item),
        criticals,
        maintenances,
    };
}

// ─── Feed aktivitas terbaru ──────────────────────────────────────────────────

/**
 * Satu baris di daftar record. Kolom yang hanya ada di salah satu tab diisi ''
 * untuk tab lainnya (shift → maintenance, tanggalOk → critical) supaya konsumen
 * tidak perlu narrowing per kind.
 */
export interface RecentEntry {
    uid: string;
    kind: 'critical' | 'maintenance';
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
 * Gabungkan record critical + maintenance jadi satu feed terurut tanggal terbaru dulu.
 * `itemKey` = halaman item tujuan saat record diklik (token varian pertama; record
 * multi-varian tetap dapat ditemukan di halaman varian lain lewat pencarian item).
 */
export function buildRecentFeed(data: CriticalSheetData, kind: 'all' | 'critical' | 'maintenance'): RecentEntry[] {
    const out: RecentEntry[] = [];
    if (kind !== 'maintenance') {
        for (const c of data.criticals) {
            out.push({
                uid: c.uid, kind: 'critical', tanggal: c.tanggal, tanggalRaw: c.tanggalRaw,
                shift: '', itemName: (c.item ?? '').replace(/\s+/g, ' ').trim(), variant: c.varian,
                code: extractCode(c.item), uraian: c.uraian, notifikasi: c.notif,
                scope: c.scope, status: c.status, pelapor: c.pelapor, foreman: '', tanggalOkRaw: c.tanggalOkRaw,
                itemKey: recordItemKeys(c.item, c.varian)[0],
            });
        }
    }
    if (kind !== 'critical') {
        for (const m of data.maintenances) {
            out.push({
                uid: m.uid, kind: 'maintenance', tanggal: m.tanggal, tanggalRaw: m.tanggalRaw,
                shift: m.shift, itemName: (m.item ?? '').replace(/\s+/g, ' ').trim(), variant: m.varian,
                code: extractCode(m.item), uraian: m.uraian, notifikasi: m.notifikasi,
                scope: m.scope, status: m.status, pelapor: '', foreman: m.foreman, tanggalOkRaw: '',
                itemKey: recordItemKeys(m.item, m.varian)[0],
            });
        }
    }
    // Tanggal terbaru dulu; tanpa tanggal ditaruh paling akhir.
    out.sort((a, b) => {
        if (a.tanggal && b.tanggal) return a.tanggal === b.tanggal ? 0 : b.tanggal.localeCompare(a.tanggal);
        if (a.tanggal && !b.tanggal) return -1;
        if (!a.tanggal && b.tanggal) return 1;
        return 0;
    });
    return out;
}

/** Normalisasi teks untuk pencocokan pencarian: lowercase, spasi dirapatkan. */
function normSearch(v: string): string {
    return (v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Filter feed dengan kata kunci bebas: cocok bila SEMUA kata kunci muncul di
 * gabungan nama item + kode + uraian + notifikasi ("B-02 bearing" ikut ketemu).
 * Dipisah dari buildRecentFeed karena `code` baru ada setelah tahap build, dan
 * dipanggil sebelum paginasi supaya `total` di respons mengikuti hasil filter.
 */
export function filterRecentFeed(entries: RecentEntry[], q: string): RecentEntry[] {
    const tokens = normSearch(q).split(' ').filter(Boolean);
    if (tokens.length === 0) return entries;
    return entries.filter(e => {
        const hay = normSearch(`${e.itemName} ${e.code} ${e.uraian} ${e.notifikasi}`);
        return tokens.every(t => hay.includes(t));
    });
}

// ─── Kolom "Link Foto" ───────────────────────────────────────────────────────

/** Lokasi satu baris sheet berdasarkan web_uid-nya. */
export interface RowLocation {
    kind: 'critical' | 'maintenance';
    tabTitle: string;
    rowIndex: number;             // 1-based
    photoColIndex: number | null;
    itemKey: string;              // halaman item tujuan link
    /** Kode + varian baris itu — dipakai sebagai label sel Link Foto. */
    itemLabel: string;
}

export function findRowByUid(data: CriticalSheetData, uid: string): RowLocation | null {
    if (!uid) return null;
    const critical = data.criticals.find(c => c.uid === uid);
    if (critical) {
        return {
            kind: 'critical',
            tabTitle: data.tabs.critical.title,
            rowIndex: critical.rowIndex,
            photoColIndex: data.tabs.critical.photoColIndex,
            itemKey: recordItemKeys(critical.item, critical.varian)[0],
            itemLabel: rowItemLabel(critical.item, critical.varian),
        };
    }
    const maintenance = data.maintenances.find(m => m.uid === uid);
    if (maintenance) {
        return {
            kind: 'maintenance',
            tabTitle: data.tabs.maintenance.title,
            rowIndex: maintenance.rowIndex,
            photoColIndex: data.tabs.maintenance.photoColIndex,
            itemKey: recordItemKeys(maintenance.item, maintenance.varian)[0],
            itemLabel: rowItemLabel(maintenance.item, maintenance.varian),
        };
    }
    return null;
}

/** URL halaman web yang membuka galeri foto satu record (dipakai di sel & tombol salin). */
export function photoPageUrl(itemKey: string, uid: string): string {
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
    return `${base}/critical-maintenance?item=${encodeURIComponent(itemKey)}&foto=${encodeURIComponent(uid)}`;
}

/**
 * Isi sel "Link Foto": kosong bila belum ada foto, HYPERLINK bila sudah.
 *
 * Labelnya menyebut ITEM baris itu ("📷 Foto P-02.10 D (3)"), bukan sekadar "Foto (3)",
 * dengan alasan yang sama seperti kode item di dalam web_uid: sel yang menyebut miliknya
 * sendiri membuat pergeseran baris terlihat mata. Kalau sel di baris Coal Feeder
 * berbunyi "Foto P-02.10 D", ada yang salah dan operator bisa langsung melihatnya.
 *
 * `sep` WAJIB dari locale spreadsheet (lihat argSeparatorForLocale) — memakai pemisah
 * yang salah membuat selnya jadi #ERROR! alih-alih tautan.
 */
export function photoCellFormula(count: number, url: string, sep: ArgSeparator, itemLabel = ''): string {
    if (count <= 0) return '';
    // Tanda kutip ganda di dalam formula HYPERLINK di-escape dengan menggandakannya.
    const safeUrl = url.replace(/"/g, '""');
    const label = itemLabel.trim()
        ? `📷 Foto ${itemLabel.trim().replace(/"/g, '""')} (${count})`
        : `📷 Foto (${count})`;
    return `=HYPERLINK("${safeUrl}"${sep}"${label}")`;
}

/**
 * Tulis ulang satu sel "Link Foto" setelah jumlah foto baris berubah.
 * Dipanggil best-effort dari API upload/hapus: kegagalan di sini TIDAK boleh
 * menggagalkan operasi foto, jadi pemanggil membungkusnya dengan try/catch.
 * Return false bila baris/kolom tidak ketemu (mis. kolom Link Foto belum dibuat).
 */
export async function writePhotoCell(uid: string, count: number): Promise<boolean> {
    let data = await loadCriticalSheet();
    let loc = findRowByUid(data, uid);
    // Baris yang baru saja ditambahkan operator bisa belum ada di cache → coba sekali lagi
    // dengan force (tetap dibatasi MIN_FORCE_INTERVAL_MS).
    if (!loc) {
        data = await loadCriticalSheet(true);
        loc = findRowByUid(data, uid);
    }
    if (!loc || loc.photoColIndex === null) return false;

    const col = colLetter(loc.photoColIndex);
    const value = photoCellFormula(count, photoPageUrl(loc.itemKey, uid), data.argSeparator, loc.itemLabel);
    await withRetry(() => getSheetsClient().spreadsheets.values.update({
        spreadsheetId: sheetId(),
        range: `${quoteTab(loc!.tabTitle)}!${col}${loc!.rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] },
    }), `tulis Link Foto ${loc.tabTitle}!${col}${loc.rowIndex}`);
    return true;
}
