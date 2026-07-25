/**
 * Critical Maintenance — loader Google Sheets (sheet = sumber kebenaran).
 *
 * Spreadsheet berisi DUA TAB (di-resolve by gid, tahan rename):
 *   1. Critical Equipment : No | Tanggal Dilaporkan | Yang Melaporkan | Nama dan Nomor Item |
 *                           Varian | Uraian | Notif | Scope | Status | Tanggal di OK | Yang Meng"OK" | Gabungan
 *   2. Maintenance        : No | Tanggal Dilaporkan | Shift | Nama dan Nomor Item | Varian |
 *                           Uraian | Scope | Status | Notifikasi | Foreman | gabungan | (Ref Critical)
 * Posisi header TIDAK di-hardcode — dideteksi dari isi sel (tahan sisip baris/kolom).
 * Input data tetap di spreadsheet; app hanya MENULIS kolom web_uid (ID stabil untuk
 * relasi foto) dan tidak pernah menyentuh kolom isian operator.
 *
 * Skala (trial, Jul 2026): ±4.5rb baris critical + ±23rb baris maintenance. Terlalu
 * besar untuk unstable_cache (limit entry ±2MB), jadi cache di memori module dengan
 * TTL — di Vercel berarti per-instance lambda; instance warm melayani dari memori,
 * cold start baca ulang. Kuota Sheets (300 read/menit) tetap aman.
 */

import { randomUUID } from 'crypto';
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
const UID_HEADER = 'web_uid (jangan diubah)';
const UID_HEADER_PREFIX = 'web_uid';       // sudah dinormalisasi (lihat normHeader)
const PHOTO_HEADER = 'link foto';
// Dipakai HANYA bila kolom web_uid belum ada sama sekali (sheet yang belum pernah
// di-backfill). Kolom A–M data operator, N/P/R sisa formula, T–Z daftar master.
const UID_COL_FALLBACK = 27; // 0-based → kolom 'AB'

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
    uidColIndex: number;            // 0-based
    photoColIndex: number | null;   // null = kolom "Link Foto" belum dibuat di sheet
}

export interface CriticalSheetData {
    criticals: CriticalRow[];
    maintenances: MaintenanceRow[];
    tabs: { critical: TabRef; maintenance: TabRef };
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
    headerRowIndex: number; // 1-based
    uidColIndex: number;    // 0-based, hasil deteksi header (fallback AB)
    photoColIndex: number | null;
    rows: T[];
}

/**
 * Cari index kolom dari nama header yang sudah dinormalisasi. Cocok bila nama header
 * DIAWALI `prefix` — header uid ditulis "web_uid (jangan diubah)", jadi teks dalam
 * kurung boleh berubah tanpa memutus deteksi. Object.entries mengikuti urutan sisip =
 * urutan kolom, jadi kecocokan pertama = kolom paling kiri.
 */
function findColByPrefix(map: HeaderMap, prefix: string): number | undefined {
    for (const [name, idx] of Object.entries(map)) {
        if (name.startsWith(prefix)) return idx;
    }
    return undefined;
}

/** Kolom yang dikelola app di satu tab. Kolom foto opsional (null = belum dibuat). */
function resolveManagedCols(map: HeaderMap): { uidColIndex: number; photoColIndex: number | null } {
    return {
        uidColIndex: findColByPrefix(map, UID_HEADER_PREFIX) ?? UID_COL_FALLBACK,
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
            uid: cell(r, uidColIndex),
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
            uid: cell(r, uidColIndex),
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
 * Isi UID untuk baris yang belum punya di satu tab, tulis balik HANYA kolom AB.
 * Backfill pertama bisa puluhan ribu baris → tulis per BLOK KONTIGU (bukan per sel)
 * supaya payload batchUpdate kecil. Re-read kolom AB fresh sebelum menulis untuk
 * mempersempit race antar instance (sel yang keburu terisi tidak ditimpa; sisa race
 * last-writer-wins dan tidak berbahaya).
 */
async function ensureRowUids(
    sheets: ReturnType<typeof getSheetsClient>,
    tab: TabInfo,
    parsed: { headerRowIndex: number; uidColIndex: number; rows: { uid: string; rowIndex: number }[] },
): Promise<void> {
    const needy = parsed.rows.filter(r => !r.uid);
    if (needy.length === 0) return;

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
        if (existing) { row.uid = existing; continue; }
        row.uid = randomUUID();
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
    }), `backfill ${toWrite.length} uid (${data.length} blok) ${tab.title}`);
    console.log(`[critical-sheet] backfill ${toWrite.length} web_uid di tab ${tab.title}`);
}

// ─── Loader (in-memory cache, TTL 60s) ───────────────────────────────────────

async function loadCriticalSheetUncached(): Promise<CriticalSheetData> {
    const sheets = getSheetsClient();

    // Resolve kedua tab by gid tiap load (murah; sekaligus tahan rename tab).
    const meta = await withRetry(() => sheets.spreadsheets.get({
        spreadsheetId: sheetId(),
        fields: 'sheets.properties(sheetId,title,gridProperties.columnCount)',
    }), 'get critical spreadsheet meta');
    const findTab = (gid: number): TabInfo => {
        const t = meta.data.sheets?.find(s => s.properties?.sheetId === gid);
        if (!t?.properties?.title) throw new Error(`Tab gid=${gid} tidak ditemukan di spreadsheet critical`);
        return { gid, title: t.properties.title, columnCount: t.properties.gridProperties?.columnCount ?? 26 };
    };
    const criticalTab = findTab(tabGid('GOOGLE_SHEETS_CRITICAL_GID'));
    const maintenanceTab = findTab(tabGid('GOOGLE_SHEETS_MAINTENANCE_GID'));

    // Satu batchGet untuk kedua tab. A:AE = data operator + kolom Link Foto + kolom uid,
    // dengan sisa ruang setelah kolom uid bergeser akibat penyisipan kolom.
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

    await ensureRowUids(sheets, criticalTab, criticalParsed);
    await ensureRowUids(sheets, maintenanceTab, maintenanceParsed);

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

export interface ItemIndexEntry {
    key: string;              // normalisasi(item)|normalisasi(varian)
    itemName: string;         // display (kolom D asli)
    variant: string;          // kolom E asli
    code: string;             // kode item mis. K-08.17 (bila terdeteksi)
    criticalCount: number;
    maintenanceCount: number;
    lastDate: string | null;  // ISO tanggal terakhir ada aktivitas
}

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

/** Bangun daftar item unik dgn agregat count & tanggal terakhir. Record multi-varian
 *  dihitung di TIAP halaman varian (D/E/F muncul di halaman D, E, dan F). */
export function buildItemIndex(data: CriticalSheetData): ItemIndexEntry[] {
    const map = new Map<string, ItemIndexEntry>();
    const touch = (item: string, varian: string, tanggal: string | null, kind: 'critical' | 'maintenance') => {
        const tokens = variantTokens(varian);
        const list = tokens.length ? tokens : ['']; // '' = halaman tanpa varian
        for (const tok of list) {
            const key = itemKeyOf(item, tok);
            if (!key) continue;
            let e = map.get(key);
            if (!e) {
                e = {
                    key,
                    itemName: (item ?? '').replace(/\s+/g, ' ').trim(),
                    variant: tok,
                    code: extractCode(item),
                    criticalCount: 0,
                    maintenanceCount: 0,
                    lastDate: null,
                };
                map.set(key, e);
            }
            if (kind === 'critical') e.criticalCount++; else e.maintenanceCount++;
            if (tanggal && (!e.lastDate || tanggal > e.lastDate)) e.lastDate = tanggal;
        }
    };
    for (const c of data.criticals) touch(c.item, c.varian, c.tanggal, 'critical');
    for (const m of data.maintenances) touch(m.item, m.varian, m.tanggal, 'maintenance');
    // Urut: aktivitas terakhir terbaru dulu, lalu nama + varian.
    return Array.from(map.values()).sort((a, b) => {
        if (a.lastDate && b.lastDate && a.lastDate !== b.lastDate) return b.lastDate.localeCompare(a.lastDate);
        if (a.lastDate && !b.lastDate) return -1;
        if (!a.lastDate && b.lastDate) return 1;
        return a.itemName.localeCompare(b.itemName) || a.variant.localeCompare(b.variant);
    });
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

export interface RecentEntry {
    uid: string;
    kind: 'critical' | 'maintenance';
    tanggal: string | null;
    tanggalRaw: string;
    itemName: string;
    variant: string;         // varian mentah (kolom E) — bisa gabungan
    code: string;
    uraian: string;
    status: string;
    scope: string;
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
                itemName: (c.item ?? '').replace(/\s+/g, ' ').trim(), variant: c.varian,
                code: extractCode(c.item), uraian: c.uraian, status: c.status, scope: c.scope,
                itemKey: recordItemKeys(c.item, c.varian)[0],
            });
        }
    }
    if (kind !== 'critical') {
        for (const m of data.maintenances) {
            out.push({
                uid: m.uid, kind: 'maintenance', tanggal: m.tanggal, tanggalRaw: m.tanggalRaw,
                itemName: (m.item ?? '').replace(/\s+/g, ' ').trim(), variant: m.varian,
                code: extractCode(m.item), uraian: m.uraian, status: m.status, scope: m.scope,
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

// ─── Kolom "Link Foto" ───────────────────────────────────────────────────────

/** Lokasi satu baris sheet berdasarkan web_uid-nya. */
export interface RowLocation {
    kind: 'critical' | 'maintenance';
    tabTitle: string;
    rowIndex: number;             // 1-based
    photoColIndex: number | null;
    itemKey: string;              // halaman item tujuan link
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
        };
    }
    return null;
}

/** URL halaman web yang membuka galeri foto satu record (dipakai di sel & tombol salin). */
export function photoPageUrl(itemKey: string, uid: string): string {
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
    return `${base}/critical-maintenance?item=${encodeURIComponent(itemKey)}&foto=${encodeURIComponent(uid)}`;
}

/** Isi sel "Link Foto": kosong bila belum ada foto, HYPERLINK bila sudah. */
export function photoCellFormula(count: number, url: string): string {
    if (count <= 0) return '';
    // Tanda kutip ganda di dalam formula HYPERLINK di-escape dengan menggandakannya.
    const safeUrl = url.replace(/"/g, '""');
    return `=HYPERLINK("${safeUrl}","📷 Foto (${count})")`;
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
    const value = photoCellFormula(count, photoPageUrl(loc.itemKey, uid));
    await withRetry(() => getSheetsClient().spreadsheets.values.update({
        spreadsheetId: sheetId(),
        range: `${quoteTab(loc!.tabTitle)}!${col}${loc!.rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] },
    }), `tulis Link Foto ${loc.tabTitle}!${col}${loc.rowIndex}`);
    return true;
}
