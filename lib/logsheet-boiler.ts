/**
 * Sinkronisasi station Bunker & Lapangan Boiler ke spreadsheet "LogSheet Boiler".
 *
 * Spreadsheet TERPISAH dari sheet utama (GOOGLE_SHEETS_ID). Tab: "Shift Malam" /
 * "Shift Pagi" / "Shift Sore". Kolom A = Tanggal, format "Senin, Mei 02, 2022".
 *
 * Pemetaan kolom diverifikasi langsung dari header sheet. Offset di bawah ini basis
 * "Shift Malam"; tab Pagi & Sore semua geser +1 kolom.
 *
 * Tiap blok ditulis terpisah sesuai station yang submit (bunker / lapangan_boiler).
 * Sel null DILEWATI update (preserve), jadi blok antar-station tidak saling timpa —
 * pola merge yang sama dengan sheet utama.
 */

import { getSheetsClient, withRetry } from './google-sheets';

const LOGSHEET_BOILER_ID =
    process.env.GOOGLE_SHEETS_LOGSHEET_BOILER_ID || '1WYvAIag7BcjHafR9bWcZOQtRklAi-hU6j_ouDTaFskE';

export type LogsheetShift = 'pagi' | 'sore' | 'malam';

const TABS: Record<LogsheetShift, string> = {
    malam: 'Shift Malam',
    pagi: 'Shift Pagi',
    sore: 'Shift Sore',
};

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Kolom 1-based pada tab "Shift Malam". Pagi/Sore = +1.
const BUNKER_START_COL_MALAM = 90; // CL
const LAB_START_COL_MALAM = 97;    // CS (blok lab + personnel kontigu CS..EQ)

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** ISO "2022-05-02" → "Senin, Mei 02, 2022" (hari + bulan Indonesia). */
export function toLogsheetDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return `${HARI[dt.getUTCDay()]}, ${BULAN[m - 1]} ${String(d).padStart(2, '0')}, ${y}`;
}

/** "Senin, Mei 02, 2022" (atau "Mei 02, 2022") → ISO "2022-05-02"; null bila gagal. */
export function fromLogsheetDate(cell: string | undefined): string | null {
    if (!cell) return null;
    // Buang prefix hari ("Senin, ") bila ada.
    const afterDay = cell.includes(',') ? cell.slice(cell.indexOf(',') + 1) : cell;
    const parts = afterDay.replace(',', ' ').trim().split(/\s+/);
    if (parts.length < 3) return null;
    const [monthName, day, year] = parts;
    const monthIdx = BULAN.findIndex(b => b.toLowerCase() === monthName.toLowerCase());
    if (monthIdx < 0) return null;
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);
    if (isNaN(d) || isNaN(y)) return null;
    return `${y}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Cell = string | number | null;

/** Konversi nomor kolom 1-based → huruf A1 ("90" → "CL"). */
function colLetter(n: number): string {
    let s = '';
    while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

function num(v: unknown): Cell {
    if (v == null || v === '') return null;
    const x = Number(v);
    return isNaN(x) ? null : x;
}

function str(v: unknown): Cell {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface LogsheetBunker {
    bunker_a?: number | null; bunker_b?: number | null; bunker_c?: number | null;
    bunker_d?: number | null; bunker_e?: number | null; bunker_f?: number | null;
}

/** Gabungan waterQuality + chemicalDosing (semua field lab). */
export type LogsheetLab = Record<string, number | string | null | undefined>;

export interface LogsheetPersonnel {
    operator_boiler_a?: string | null;
    operator_boiler_b?: string | null;
    operator_coal_mill?: string | null;
    foreman?: string | null;
    supervisor?: string | null;
    group?: string | null;
}

export interface LogsheetBoilerPayload {
    bunker?: LogsheetBunker;
    lab?: LogsheetLab;
    personnel?: LogsheetPersonnel;
}

export interface LogsheetUpsertResult {
    action: 'updated' | 'appended';
    tab: string;
    row: number;
    blocks: string[];
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function bunkerValues(b: LogsheetBunker): Cell[] {
    return [b.bunker_a, b.bunker_b, b.bunker_c, b.bunker_d, b.bunker_e, b.bunker_f].map(num);
}

/** 51 nilai kontigu CS..EQ (lab + personnel) sesuai urutan header sheet. */
function labValues(lab: LogsheetLab, p: LogsheetPersonnel): Cell[] {
    const L = lab;
    return [
        // Demin (4)
        num(L.demin_1250_ph), num(L.demin_1250_conduct), num(L.demin_1250_th), num(L.demin_1250_sio2),
        // Produk Steam (5)
        num(L.product_steam_ph), num(L.product_steam_conduct), num(L.product_steam_th), num(L.product_steam_sio2), num(L.product_steam_nh4),
        // BFW (7) — termasuk Fe
        num(L.bfw_ph), num(L.bfw_conduct), num(L.bfw_th), num(L.bfw_sio2), num(L.bfw_nh4), num(L.bfw_chz), num(L.bfw_fe),
        // Boiler Water A (5) — termasuk TH
        num(L.boiler_water_a_ph), num(L.boiler_water_a_conduct), num(L.boiler_water_a_th), num(L.boiler_water_a_sio2), num(L.boiler_water_a_po4),
        // Boiler Water B (5) — termasuk TH
        num(L.boiler_water_b_ph), num(L.boiler_water_b_conduct), num(L.boiler_water_b_th), num(L.boiler_water_b_sio2), num(L.boiler_water_b_po4),
        // Phosphate A (4)
        num(L.phosphate_level_tanki), num(L.phosphate_stroke_pompa), num(L.phosphate_penambahan_air), num(L.phosphate_penambahan_chemical),
        // Phosphate B (4)
        num(L.phosphate_b_level_tanki), num(L.phosphate_b_stroke_pompa), num(L.phosphate_b_penambahan_air), num(L.phosphate_b_penambahan_chemical),
        // Amine (4)
        num(L.amine_level_tanki), num(L.amine_stroke_pompa), num(L.amine_penambahan_air), num(L.amine_penambahan_chemical),
        // Hydrazine (4)
        num(L.hydrazine_level_tanki), num(L.hydrazine_stroke_pompa), num(L.hydrazine_penambahan_air), num(L.hydrazine_penambahan_chemical),
        // Stock Chemical (3)
        num(L.stock_phosphate), num(L.stock_amine), num(L.stock_hydrazine),
        // Operator (3) + Atasan (2) + Group (1)
        str(p.operator_boiler_a), str(p.operator_boiler_b), str(p.operator_coal_mill),
        str(p.foreman), str(p.supervisor), str(p.group),
    ];
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

/**
 * Tulis blok bunker dan/atau lab+personnel ke baris tanggal di tab shift.
 * Cari baris via tanggal di kolom A; bila tidak ada → append baris baru.
 * Hanya blok yang dikirim yang ditulis; sel null dilewati (preserve blok lain).
 */
export async function upsertLogsheetBoiler(
    shift: LogsheetShift,
    isoDate: string,
    payload: LogsheetBoilerPayload,
): Promise<LogsheetUpsertResult> {
    const tab = TABS[shift];
    const shiftOffset = shift === 'malam' ? 0 : 1;
    const sheets = getSheetsClient();

    // Cari baris berdasar tanggal di kolom A.
    const colA = await withRetry(
        () => sheets.spreadsheets.values.get({ spreadsheetId: LOGSHEET_BOILER_ID, range: `${tab}!A1:A` }),
        `logsheet get ${tab}!A`,
    );
    const rows = (colA.data.values ?? []) as string[][];
    let row = -1;
    for (let i = 0; i < rows.length; i++) {
        if (fromLogsheetDate(rows[i]?.[0]) === isoDate) { row = i + 1; break; }
    }
    const appending = row === -1;
    if (appending) row = rows.length + 1;

    const data: { range: string; values: Cell[][] }[] = [];
    if (appending) {
        data.push({ range: `${tab}!A${row}`, values: [[toLogsheetDate(isoDate)]] });
    }
    if (payload.bunker) {
        const startLetter = colLetter(BUNKER_START_COL_MALAM + shiftOffset);
        data.push({ range: `${tab}!${startLetter}${row}`, values: [bunkerValues(payload.bunker)] });
    }
    if (payload.lab) {
        const startLetter = colLetter(LAB_START_COL_MALAM + shiftOffset);
        data.push({ range: `${tab}!${startLetter}${row}`, values: [labValues(payload.lab, payload.personnel ?? {})] });
    }

    const blocks: string[] = [];
    if (payload.bunker) blocks.push('bunker');
    if (payload.lab) blocks.push('lab');

    if (data.length > 0) {
        await withRetry(
            () => sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: LOGSHEET_BOILER_ID,
                requestBody: { valueInputOption: 'USER_ENTERED', data },
            }),
            `logsheet batchUpdate ${tab} row ${row}`,
        );
    }

    console.log(`[logsheet-boiler] ${tab} row=${row} ${appending ? 'appended' : 'updated'} blocks=${blocks.join('+') || 'none'}`);
    return { action: appending ? 'appended' : 'updated', tab, row, blocks };
}
