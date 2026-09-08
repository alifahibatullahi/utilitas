/**
 * Google Sheets API v4 client for PowerOps.
 * Uses service account credentials stored in env vars.
 *
 * TAB NAMES:
 *   shift pagi  → "Pagi"
 *   shift sore  → "Sore"
 *   shift malam → "Malam"
 *   laporan harian → "LHUBB"
 */

import { google } from 'googleapis';

// ─── Config ──────────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const RCW_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_RCW_ID || '1V5QtlqcmpXZAd0AEIbrR0jm-Tr1nfk4DR3yQXJKFtro';
const RCW_SHEET_TAB = 'Level UBB';
const RCW_ANCHOR_ROW = 1277;        // Row pertama tanggal 17 April 2026, jam 1
const RCW_ANCHOR_DATE = '2026-04-17'; // Tanggal anchor (ISO)

export const SHEET_TABS = {
    pagi: 'Pagi',
    sore: 'Sore',
    malam: 'Malam',
    harian: 'LHUBB',
} as const;

export type ShiftTab = 'pagi' | 'sore' | 'malam';

// ─── Auth ─────────────────────────────────────────────────────────────────────

// Singleton per instance server: GoogleAuth meng-cache & me-refresh access token
// sendiri, jadi membangun client baru tiap panggilan hanya menambah token exchange
// (4-6x per save). Umur cache = umur module, sama seperti cache judul tab di bawah.
let sheetsClientSingleton: ReturnType<typeof google.sheets> | null = null;

export function getSheetsClient() {
    if (sheetsClientSingleton) return sheetsClientSingleton;
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
        throw new Error('Google Sheets credentials not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)');
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
                .replace(/^["']|["']$/g, '')   // strip surrounding quotes if accidentally included
                .replace(/\\n/g, '\n'),         // convert literal \n to real newlines
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClientSingleton = google.sheets({ version: 'v4', auth });
    return sheetsClientSingleton;
}

// ─── Retry (transient Google Sheets API failures) ─────────────────────────────

/**
 * Retry a Google Sheets API call on transient errors (rate limit 429, server 5xx,
 * jaringan terputus/timeout). Error non-transien (mis. 400/403 — kredensial/range
 * salah) langsung dilempar tanpa retry. Backoff: 400ms, 800ms.
 */
export async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err: unknown) {
            lastErr = err;
            const e = err as { code?: number | string; status?: number; response?: { status?: number }; message?: string };
            const httpStatus = typeof e.code === 'number' ? e.code : (e.status ?? e.response?.status);
            const netCode = typeof e.code === 'string' ? e.code : '';
            const transient =
                httpStatus === 429 ||
                (typeof httpStatus === 'number' && httpStatus >= 500) ||
                /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|EPIPE|ENOTFOUND/i.test(netCode) ||
                /network|timeout|socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(e.message ?? '');
            if (!transient || attempt === maxAttempts) throw err;
            const delay = 400 * 2 ** (attempt - 1); // 400ms, 800ms
            console.warn(`[sheets retry] ${label} attempt ${attempt}/${maxAttempts} gagal (${httpStatus ?? netCode ?? 'unknown'}); retry ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastErr;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert ISO date "2025-04-07" → Indonesian "07 April 2025" */
export function toIndonesianDate(isoDate: string): string {
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const [year, month, day] = isoDate.split('-');
    return `${String(parseInt(day)).padStart(2, '0')} ${months[parseInt(month) - 1]} ${year}`;
}

/** Convert Indonesian date "07 April 2025" → ISO "2025-04-07" */
export function fromIndonesianDate(indonesianDate: string): string | null {
    const months: Record<string, string> = {
        'Januari': '01', 'Februari': '02', 'Maret': '03', 'April': '04',
        'Mei': '05', 'Juni': '06', 'Juli': '07', 'Agustus': '08',
        'September': '09', 'Oktober': '10', 'November': '11', 'Desember': '12',
    };
    const parts = indonesianDate.trim().split(' ');
    if (parts.length !== 3) return null;
    const [day, monthName, year] = parts;
    const month = months[monthName];
    if (!month) return null;
    return `${year}-${month}-${String(parseInt(day)).padStart(2, '0')}`;
}

// ─── Core operations ──────────────────────────────────────────────────────────

/**
 * Fetch all data rows from a sheet tab (skips first 5 header rows).
 * Returns array of row arrays, 0-indexed (row[0] = data row 6 in Sheets).
 */
export async function getSheetRows(tab: string): Promise<string[][]> {
    const sheets = getSheetsClient();
    const res = await withRetry(() => sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A6:EZ`, // Start from row 6 (after 5 header rows)
    }), `get ${tab}!A6:EZ`);
    return (res.data.values ?? []) as string[][];
}

/**
 * Baca HANYA kolom B (Tanggal) mulai baris 6 → array string ter-trim.
 * Jauh lebih kecil/cepat dari getSheetRows (A6:EZ, ~150 kolom × ribuan baris),
 * sehingga lookup tanggal saat user simpan cepat & kecil peluang timeout.
 */
async function getDateColumn(tab: string): Promise<string[]> {
    const sheets = getSheetsClient();
    const res = await withRetry(() => sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!B6:B`,
    }), `get ${tab}!B6:B`);
    return ((res.data.values ?? []) as string[][]).map(r => (r[0] ?? '').trim());
}

/**
 * Find the 1-based row index for a given date (kolom B). Returns null if not found.
 */
export async function findShiftRow(tab: string, isoDate: string): Promise<number | null> {
    const dates = await getDateColumn(tab);
    const targetDate = toIndonesianDate(isoDate);
    for (let i = 0; i < dates.length; i++) {
        if (dates[i] === targetDate) return i + 6; // 5 headers + 1-based index
    }
    return null;
}

/**
 * Get a specific row's data by 1-based row index.
 */
export async function getShiftRow(tab: string, rowIndex: number): Promise<string[]> {
    const sheets = getSheetsClient();
    const res = await withRetry(() => sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A${rowIndex}:EZ${rowIndex}`,
    }), `get ${tab}!A${rowIndex}`);
    const rows = res.data.values ?? [];
    return (rows[0] ?? []) as string[];
}

/**
 * Count existing data rows in a tab (to generate the next row number).
 */
async function countDataRows(tab: string): Promise<number> {
    const dates = await getDateColumn(tab);
    return dates.filter(d => d !== '').length;
}

/**
 * Append a new row to the sheet.
 */
async function appendSheetRow(tab: string, values: (string | number | null)[]): Promise<void> {
    const sheets = getSheetsClient();
    await withRetry(() => sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A6`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
            values: [values],
        },
    }), `append ${tab}!A6`);
}

/**
 * Update an existing row by 1-based row index.
 */
async function updateSheetRow(tab: string, rowIndex: number, values: (string | number | null)[]): Promise<void> {
    const sheets = getSheetsClient();
    const nonNullCount = values.filter(v => v !== null && v !== '').length;
    console.log(`[updateSheetRow] spreadsheet=${SPREADSHEET_ID.slice(0,8)}... tab=${tab} row=${rowIndex} cells=${nonNullCount}/${values.length}`);
    const res = await withRetry(() => sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [values],
        },
    }), `update ${tab}!A${rowIndex}`);
    console.log(`[updateSheetRow] response: updatedCells=${res.data.updatedCells} updatedRange=${res.data.updatedRange}`);
}

/**
 * Upsert a shift row: find existing row by date+group, update it.
 * If not found, append a new row.
 */
export async function upsertShiftRow(
    shift: ShiftTab,
    isoDate: string,
    _groupName: string,
    values: (string | number | null)[],
): Promise<{ action: 'updated' | 'appended'; rowIndex: number }> {
    const tab = SHEET_TABS[shift];
    const existingRow = await findShiftRow(tab, isoDate);

    if (existingRow !== null) {
        await updateSheetRow(tab, existingRow, values);
        return { action: 'updated', rowIndex: existingRow };
    } else {
        const rowCount = await countDataRows(tab);
        // Set col 0 (No) to the next row number
        values[0] = rowCount + 1;
        await appendSheetRow(tab, values);
        return { action: 'appended', rowIndex: rowCount + 6 };
    }
}

/**
 * Fetch shift row data by date + group name.
 * Returns the raw string array or null if not found.
 */
export async function fetchShiftRow(
    shift: ShiftTab,
    isoDate: string,
): Promise<string[] | null> {
    const tab = SHEET_TABS[shift];
    const rowIndex = await findShiftRow(tab, isoDate);
    if (rowIndex === null) return null;
    return getShiftRow(tab, rowIndex);
}

/**
 * Upsert a daily report row in LHUBB tab.
 * Finds by date (col B), updates or appends.
 */
export async function upsertDailyRow(
    isoDate: string,
    values: (string | number | null)[],
): Promise<{ action: 'updated' | 'appended'; rowIndex: number }> {
    const tab = SHEET_TABS.harian;
    const dates = await getDateColumn(tab);
    const targetDate = toIndonesianDate(isoDate);

    let existingRow: number | null = null;
    for (let i = 0; i < dates.length; i++) {
        if (dates[i] === targetDate) { existingRow = i + 6; break; }
    }

    if (existingRow !== null) {
        await updateSheetRow(tab, existingRow, values);
        return { action: 'updated', rowIndex: existingRow };
    } else {
        const rowCount = dates.filter(d => d !== '').length;
        values[0] = rowCount + 1;
        await appendSheetRow(tab, values);
        return { action: 'appended', rowIndex: rowCount + 6 };
    }
}

/**
 * Fetch daily row data by date.
 */
export async function fetchDailyRow(isoDate: string): Promise<string[] | null> {
    const tab = SHEET_TABS.harian;
    const rows = await getSheetRows(tab);
    const targetDate = toIndonesianDate(isoDate);

    for (let i = 0; i < rows.length; i++) {
        const rowDate = (rows[i][1] ?? '').trim();
        if (rowDate === targetDate) {
            return rows[i];
        }
    }
    return null;
}

// ─── RCW Level Sheet ──────────────────────────────────────────────────────────


/**
 * Hitung jam WIB (bilangan ganjil 1–23) dari timestamp ISO.
 * Dibulatkan ke jam ganjil terdekat berikutnya.
 * Contoh: 22:45 WIB → jam 23, 00:10 WIB → jam 1, 02:30 WIB → jam 3.
 *
 * Logika: setiap slot 2 jam dimulai pada jam ganjil.
 * Slot jam N mencakup (N-1):00 – (N+1):00, tengahnya di N:00.
 * Bulatkan ke atas ke jam ganjil terdekat.
 */
export function getCurrentRcwJam(isoTimestamp?: string): { jam: number; isoDate: string } {
    // Gunakan WIB (UTC+7)
    const now = isoTimestamp ? new Date(isoTimestamp) : new Date();
    const wibOffsetMs = 7 * 60 * 60 * 1000;
    const wib = new Date(now.getTime() + wibOffsetMs);

    const hour = wib.getUTCHours();
    const minute = wib.getUTCMinutes();

    // Total menit dari tengah malam WIB
    const totalMin = hour * 60 + minute;

    // Slot dimulai setiap :30 (00:30, 02:30, 04:30, ..., 22:30)
    // Slot 0: 00:30–02:30 → jam 1
    // Slot 1: 02:30–04:30 → jam 3
    // ...
    // Slot 11: 22:30–00:30 → jam 23
    // Menit sebelum 00:30 (00:00–00:29) masuk slot 11 (jam 23)
    const minutesFrom0030 = (totalMin - 30 + 24 * 60) % (24 * 60);
    const slot = Math.floor(minutesFrom0030 / 120);
    const jam = slot * 2 + 1; // 1, 3, 5, ..., 23

    // Tanggal WIB
    const isoDate = wib.toISOString().slice(0, 10);

    return { jam, isoDate };
}

export interface RcwEntry {
    isoDate: string;
    jam: number;
    level: number;
}

/**
 * Build 1 RCW entry dari nilai level dan timestamp submit.
 * @param level   Nilai level RCW (m³)
 * @param submittedAt  Timestamp ISO saat form disubmit (opsional, default sekarang)
 */
export function buildRcwEntry(level: number, submittedAt?: string): RcwEntry {
    const { jam, isoDate } = getCurrentRcwJam(submittedAt);
    return { isoDate, jam, level };
}


/**
 * Upsert multiple RCW entries to the dedicated RCW Google Sheet.
 * Col B = tanggal (Indonesian), Col C = jam WIB, Col D = level RCW.
 * Finds existing row by tanggal+jam, updates col D; otherwise appends.
 */
export interface RcwUpsertResult {
    updated: number;
    appended: number;
    details: { action: 'updated' | 'appended'; rowIndex: number; jam: number; date: string; level: number }[];
}

/**
 * Hitung 1-based spreadsheet row untuk entry RCW berdasarkan anchor.
 * Anchor: row 1277 = 17 April 2026, jam 1.
 * Setiap tanggal = 12 baris (jam 1,3,5,...,23).
 * jam slot index: jam 1→0, jam 3→1, ..., jam 23→11.
 */
function rcwRowIndex(isoDate: string, jam: number): number {
    const anchorMs = Date.UTC(2026, 3, 17); // 17 April 2026
    const [y, m, d] = isoDate.split('-').map(Number);
    const targetMs = Date.UTC(y, m - 1, d);
    const dayOffset = Math.round((targetMs - anchorMs) / 86_400_000);
    const jamSlot = (jam - 1) / 2; // 0–11
    return RCW_ANCHOR_ROW + dayOffset * 12 + jamSlot;
}

export async function upsertRcwRows(entries: RcwEntry[]): Promise<RcwUpsertResult> {
    if (entries.length === 0) return { updated: 0, appended: 0, details: [] };

    const sheets = getSheetsClient();
    const tab = RCW_SHEET_TAB;

    let updated = 0;
    const appended = 0;
    const details: RcwUpsertResult['details'] = [];

    for (const entry of entries) {
        const rowIndex = rcwRowIndex(entry.isoDate, entry.jam);
        await withRetry(() => sheets.spreadsheets.values.update({
            spreadsheetId: RCW_SPREADSHEET_ID,
            range: `${tab}!D${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[entry.level]] },
        }), `update RCW ${tab}!D${rowIndex}`);
        updated++;
        details.push({ action: 'updated', rowIndex, jam: entry.jam, date: entry.isoDate, level: entry.level });
    }

    return { updated, appended, details };
}

// ─── Tank Levels — Logsheet Handling Spreadsheet (per shift) ─────────────────
//
// Spreadsheet: 11rkQbshn3CbZpKCnOX6sLVj6n6KtxlR-4t7u9PaXOcA
// 4 baris merge per tanggal. Anchor:
//   Shift malam / Shift Pagi / Shift sore  → row 1737 = 02 Mei 2026
//   Laporan Harian Handling (Pkl 24.00 )   → row 1738 = 02 Mei 2026
//
// Kolom (per shift):
//   Shift malam : AU Solar | AV RCW | AW Demin
//   Shift Pagi  : AX Solar | AY RCW | AZ Demin
//   Shift sore  : AV Solar | AW RCW | AX Demin
// Laporan Harian Handling : D Solar | E RCW | F Demin
//
// Window jam (WIB) — saling lepas, semua pakai tanggal hari ini:
//   00:00 – 06:30 → Shift malam
//   06:30 – 14:30 → Shift Pagi
//   14:30 – 22:30 → Shift sore
//   22:30 – 24:00 → Laporan Harian Handling

const TANK_SHIFT_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_TANK_SHIFT_ID || '11rkQbshn3CbZpKCnOX6sLVj6n6KtxlR-4t7u9PaXOcA';
const TANK_SHIFT_ANCHOR_DATE = '2026-05-02';
const TANK_SHIFT_ANCHOR_ROW = 1737;
const LAPORAN_HARIAN_ANCHOR_ROW = 1738;
const ROWS_PER_DAY = 4;

const SHIFT_TAB_NAMES: Record<'pagi' | 'sore' | 'malam', string> = {
    pagi:  'Shift Pagi',
    sore:  'Shift sore',
    malam: 'Shift malam',
};
const LAPORAN_HARIAN_TAB = 'Laporan Harian Handling (Pkl 24.00 )';

const SHIFT_COLUMNS: Record<'pagi' | 'sore' | 'malam', { solar: string; rcw: string; demin: string }> = {
    malam: { solar: 'AU', rcw: 'AV', demin: 'AW' },
    pagi:  { solar: 'AX', rcw: 'AY', demin: 'AZ' },
    sore:  { solar: 'AV', rcw: 'AW', demin: 'AX' },
};
const LAPORAN_HARIAN_COLUMNS = { solar: 'D', rcw: 'E', demin: 'F' } as const;

function fmtDateUTC(d: Date): string {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
}

/** Konversi ke jam WIB dari Date (UTC). Kembalikan {totalMin, dateUTC: Date in WIB}. */
function toWibParts(now: Date): { totalMin: number; wib: Date } {
    const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const totalMin = wib.getUTCHours() * 60 + wib.getUTCMinutes();
    return { totalMin, wib };
}

export type TankWindow = 'malam' | 'pagi' | 'sore' | 'laporan_harian';

/**
 * Tentukan window aktif berdasar jam WIB sekarang. Tanggal selalu hari ini (WIB).
 *   00:00–06:30 = malam, 06:30–14:30 = pagi, 14:30–22:30 = sore, 22:30–24:00 = laporan_harian
 */
export function detectTankShift(now?: Date): { window: TankWindow; isoDate: string } {
    const { totalMin, wib } = toWibParts(now ?? new Date());
    const isoDate = fmtDateUTC(wib);
    // 06:30=390, 14:30=870, 22:30=1350
    if (totalMin < 390)                     return { window: 'malam',          isoDate };
    if (totalMin < 870)                     return { window: 'pagi',           isoDate };
    if (totalMin < 1350)                    return { window: 'sore',           isoDate };
    return                                         { window: 'laporan_harian', isoDate };
}

function tankShiftRow(isoDate: string, anchorRow: number): number {
    const [ay, am, ad] = TANK_SHIFT_ANCHOR_DATE.split('-').map(Number);
    const anchorMs = Date.UTC(ay, am - 1, ad);
    const [y, m, d] = isoDate.split('-').map(Number);
    const targetMs = Date.UTC(y, m - 1, d);
    const dayOffset = Math.round((targetMs - anchorMs) / 86_400_000);
    return anchorRow + dayOffset * ROWS_PER_DAY;
}

export interface TankLevelsInput {
    solar?: number | null;
    rcw?: number | null;
    demin?: number | null;
}

export interface TankShiftUpdateResult {
    window: TankWindow;
    isoDate: string;
    tab: string;
    row: number;
    updates: { range: string; value: number }[];
}

/**
 * Tulis level Solar/RCW/Demin ke spreadsheet handling.
 * Tujuan tab/kolom/row ditentukan oleh window WIB saat ini (lihat detectTankShift).
 * Hanya field non-null/undefined yang ditulis.
 */
export async function upsertTankLevelsShift(levels: TankLevelsInput, now?: Date): Promise<TankShiftUpdateResult> {
    const _now = now ?? new Date();
    const sheets = getSheetsClient();

    const { window, isoDate } = detectTankShift(_now);

    let tab: string;
    let row: number;
    let cols: { solar: string; rcw: string; demin: string };
    if (window === 'laporan_harian') {
        tab  = LAPORAN_HARIAN_TAB;
        row  = tankShiftRow(isoDate, LAPORAN_HARIAN_ANCHOR_ROW);
        cols = LAPORAN_HARIAN_COLUMNS;
    } else {
        tab  = SHIFT_TAB_NAMES[window];
        row  = tankShiftRow(isoDate, TANK_SHIFT_ANCHOR_ROW);
        cols = SHIFT_COLUMNS[window];
    }

    const queue: { range: string; value: number }[] = [];
    const push = (col: string, value: number | null | undefined) => {
        if (value == null) return;
        queue.push({ range: `${tab}!${col}${row}`, value });
    };
    push(cols.solar, levels.solar);
    push(cols.rcw,   levels.rcw);
    push(cols.demin, levels.demin);

    const updates: TankShiftUpdateResult['updates'] = [];
    for (const u of queue) {
        await withRetry(() => sheets.spreadsheets.values.update({
            spreadsheetId: TANK_SHIFT_SPREADSHEET_ID,
            range: u.range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[u.value]] },
        }), `update tank ${u.range}`);
        updates.push(u);
    }

    return { window, isoDate, tab, row, updates };
}

// ─── Catatan Operasional Sheet ────────────────────────────────────────────────
//
// Spreadsheet catatan operasional yang juga diisi manual oleh user. Sheet-nya
// BERKOLOM PER KATEGORI (header di baris 2):
//   Kolom B = tanggal (nilai sel DD/MM/YYYY, dirender "12 Juni 2026" oleh format kolom)
//   Kolom C = shift (dropdown data-validation: Malam/Pagi/Sore)
//   Kolom D = Operasional        ← ditulis aplikasi
//   Kolom E = Switch Equipment     (manual — aplikasi tidak punya sumbernya)
//   Kolom F = Unloading Fly Ash  ← ditulis aplikasi
//   Kolom G = In-Out Solar       ← ditulis aplikasi
//   Kolom H = In-Out Batubara      (manual)
// Pembagian barisnya dilakukan partisiCatatanPerKolom di lib/shift-catatan.ts.
// Konten dari aplikasi dibungkus penanda TAK TERLIHAT (karakter zero-width)
// supaya terbedakan dari isian manual tanpa mengotori sel; teks di luar penanda
// TIDAK PERNAH diubah. Tiap kolom punya blok penandanya sendiri.
// Upsert per (tanggal, shift): baris existing → update kolom D/F/G yang berubah
// saja; belum ada → baris baru di bawah baris terakhir yang kolom B-nya terisi.

const CATATAN_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_CATATAN_ID || '1qbN1nrpJmVJ_WY2YPGB4TCJixLrf5cwAyycqqHZC1mw';
const CATATAN_SHEET_GID = 457458234;
// Penanda pembungkus blok aplikasi di tiap kolom yang ditulis (D, F, G).
// Zero-width: tidak kelihatan di Sheets, tapi ikut tersimpan apa adanya karena
// sel-selnya ditulis dengan
// valueInputOption RAW. Jangan pakai \uFEFF — satu-satunya zero-width yang ikut
// dibuang String.trim(), sehingga akan merusak cek "sel kosong" di bawah.
export const CATATAN_MARKER_START = '\u2060\u200B\u2060'; // WJ + ZWSP + WJ
export const CATATAN_MARKER_END = '\u2060\u200C\u2060';   // WJ + ZWNJ + WJ
// Penanda teks versi lama. Masih dikenali supaya baris yang sudah terlanjur
// berisi tag ini ikut rapi sendiri saat baris itu ditulis ulang — tidak perlu
// migrasi massal.
const CATATAN_LEGACY_START = '<Web Laporan UBB>';
const CATATAN_LEGACY_END = '</Web Laporan UBB>';
const CATATAN_SHIFT_LABEL: Record<'malam' | 'pagi' | 'sore', string> = {
    malam: 'Malam',
    pagi: 'Pagi',
    sore: 'Sore',
};

/** Quote judul tab untuk A1 range (judul bisa mengandung spasi/petik). */
function quoteTab(title: string): string {
    return `'${title.replace(/'/g, "''")}'`;
}

let catatanTabTitleCache: string | null = null;

/** Resolve judul tab dari gid (tahan rename tab). Cache per instance. */
async function resolveCatatanTab(sheets: ReturnType<typeof getSheetsClient>, force = false): Promise<string> {
    if (catatanTabTitleCache && !force) return catatanTabTitleCache;
    const meta = await withRetry(() => sheets.spreadsheets.get({
        spreadsheetId: CATATAN_SPREADSHEET_ID,
        fields: 'sheets.properties(sheetId,title)',
    }), 'get catatan tab meta');
    const tab = meta.data.sheets?.find(s => s.properties?.sheetId === CATATAN_SHEET_GID);
    const title = tab?.properties?.title;
    if (!title) throw new Error(`Tab gid=${CATATAN_SHEET_GID} tidak ditemukan di spreadsheet catatan`);
    catatanTabTitleCache = title;
    return title;
}

/** Parse nilai kolom B ke ISO "YYYY-MM-DD". Terima "12 Juni 2026" (FORMATTED_VALUE
 *  dgn format Indonesia), "12/06/2026" / "1/6/2026" (D/M/YYYY locale id), dan ISO. */
export function parseCatatanSheetDate(raw: string): string | null {
    const s = (raw ?? '').trim();
    if (!s) return null;
    const indo = fromIndonesianDate(s);
    if (indo) return indo;
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return null;
}

export function buildCatatanBlock(canonical: string): string {
    return `${CATATAN_MARKER_START}${canonical.trim()}${CATATAN_MARKER_END}`;
}

/** Batas blok aplikasi di sel: penanda tak-terlihat dulu, lalu penanda teks lama.
 *  null = sel tidak punya blok. Index-based (bukan regex) supaya karakter apa pun
 *  di teks user aman. */
function findCatatanBlock(cell: string): { start: number; endExclusive: number } | null {
    const pairs = [
        [CATATAN_MARKER_START, CATATAN_MARKER_END],
        [CATATAN_LEGACY_START, CATATAN_LEGACY_END],
    ] as const;
    for (const [open, close] of pairs) {
        const start = cell.indexOf(open);
        if (start < 0) continue;
        const end = cell.indexOf(close, start + open.length);
        if (end < 0) continue;
        return { start, endExclusive: end + close.length };
    }
    return null;
}

/** Kunci pembanding untuk dedup baris: abaikan bullet/strip di depan, spasi
 *  berlebih, dan beda huruf besar-kecil. Operator sering mengetik kalimat yang
 *  sama persis tapi tanpa bullet (mis. di kolom Unloading Fly Ash); tanpa
 *  normalisasi ini blok aplikasi akan mendobel kalimat yang sudah ada. */
function kunciBaris(line: string): string {
    return line.replace(/^[•\-*]\s*/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Buang semua penanda (baru & lama) — dipakai untuk membandingkan isi, bukan
 *  untuk menulis balik ke sel. */
export function stripCatatanMarkers(cell: string): string {
    return [CATATAN_MARKER_START, CATATAN_MARKER_END, CATATAN_LEGACY_START, CATATAN_LEGACY_END]
        .reduce((acc, marker) => acc.split(marker).join(''), cell);
}

/** Merge catatan kanonik ke isi sel D existing. Aturan:
 *  - Blok penanda ada → ganti HANYA isi blok (pasangan penanda pertama); teks di
 *    luar blok preserved byte-for-byte. Blok ber-penanda LAMA ikut tergantikan
 *    blok ber-penanda baru, jadi baris lama bersih sendiri sekali tulis.
 *  - Blok ada + canonical kosong → no-op (anti-wipe — catatan yang dikosongkan di
 *    app tidak menghapus blok, konsisten guard di useShiftReport).
 *  - Tidak ada blok + sel berisi → append blok dgn pemisah baris kosong, dedup per
 *    baris: baris canonical yang sudah ada persis (trim-compare) di sel tidak
 *    ditulis ulang. Menangani kasus user menghapus penanda manual: bekas tulisan
 *    app tidak didobel, hanya baris baru yang masuk blok baru.
 *  - Sel kosong → blok = seluruh isi. Canonical kosong tanpa blok → no-op.
 *  Index-based (bukan regex) supaya karakter apapun di teks user aman. */
export function mergeCatatanCell(existing: string, canonical: string): { next: string; changed: boolean } {
    const cell = existing ?? '';
    const trimmedCanonical = canonical.trim();
    const block = findCatatanBlock(cell);

    if (block) {
        if (!trimmedCanonical) return { next: cell, changed: false };
        const next = cell.slice(0, block.start) + buildCatatanBlock(trimmedCanonical) + cell.slice(block.endExclusive);
        return { next, changed: next !== cell };
    }
    if (!trimmedCanonical) return { next: cell, changed: false };
    // Bandingkan tanpa penanda: String.trim() tidak membuang ZWSP/WJ, jadi sel
    // yang tinggal sisa penanda harus tetap dianggap kosong.
    const bare = stripCatatanMarkers(cell);
    if (!bare.trim()) return { next: buildCatatanBlock(trimmedCanonical), changed: true };
    const existingLines = new Set(bare.split('\n').map(kunciBaris).filter(Boolean));
    const newLines = trimmedCanonical.split('\n').map(l => l.trim()).filter(Boolean).filter(l => !existingLines.has(kunciBaris(l)));
    if (newLines.length === 0) return { next: cell, changed: false };
    return { next: `${cell.replace(/\s+$/, '')}\n\n${buildCatatanBlock(newLines.join('\n'))}`, changed: true };
}

export interface CatatanUpsertResult {
    action: 'updated' | 'created' | 'skipped';
    tab: string;
    rowIndex?: number;
    reason?: string;
    /** Huruf kolom yang benar-benar ditulis, mis. ['D','F'] — untuk log. */
    kolom?: string[];
}

/** Isi catatan per kolom sheet. Lihat partisiCatatanPerKolom di lib/shift-catatan.ts. */
export interface CatatanKolomInput {
    operasional: string;
    flyAsh: string;
    solar: string;
}

// Peta ember → kolom sheet. Offset dihitung dari kolom B karena rentang baca
// dianchor di B (B=0, C=1, D=2, E=3, F=4, G=5, H=6).
const CATATAN_KOLOM: { key: keyof CatatanKolomInput; huruf: string; offset: number }[] = [
    { key: 'operasional', huruf: 'D', offset: 2 },
    { key: 'flyAsh', huruf: 'F', offset: 4 },
    { key: 'solar', huruf: 'G', offset: 5 },
];

/**
 * Upsert catatan operasional kanonik ke spreadsheet catatan.
 * Cari baris by (tanggal kolom B, shift kolom C); ketemu → merge kolom D/F/G
 * masing-masing (lihat mergeCatatanCell), tidak → tulis baris baru di bawah baris
 * terakhir ber-tanggal. Kolom yang embernya kosong TIDAK disentuh (anti-wipe dari
 * mergeCatatanCell), jadi isian manual di F/G aman saat shift itu tidak punya
 * aktivitas fly ash/solar. Kolom E & H tidak pernah ditulis aplikasi.
 * Kolom C adalah dropdown — values.update hanya menulis nilai, rule dropdown utuh.
 * Concurrency: read-modify-write bisa race antar station yang save hampir
 * bersamaan; karena blok dihitung ulang dari DB tiap tulis, last-writer-wins
 * konvergen ke isi yang benar.
 */
export async function upsertCatatanOperasional(
    isoDate: string,
    shift: 'malam' | 'pagi' | 'sore',
    catatan: CatatanKolomInput,
): Promise<CatatanUpsertResult> {
    const sheets = getSheetsClient();
    let tab = await resolveCatatanTab(sheets);

    const readRows = async (): Promise<string[][]> => {
        const res = await withRetry(() => sheets.spreadsheets.values.get({
            spreadsheetId: CATATAN_SPREADSHEET_ID,
            range: `${quoteTab(tab)}!B1:H`,
            valueRenderOption: 'FORMATTED_VALUE',
        }), `get catatan ${tab}!B1:H`);
        return (res.data.values ?? []) as string[][];
    };

    let rows: string[][];
    try {
        rows = await readRows();
    } catch (err) {
        // Judul tab basi (tab di-rename setelah di-cache) → refresh dari gid, 1x ulang.
        if (!/unable to parse range/i.test(err instanceof Error ? err.message : String(err))) throw err;
        tab = await resolveCatatanTab(sheets, true);
        rows = await readRows();
    }

    // Scan: baris pertama yang match (tanggal, shift) + baris terakhir ber-kolom B.
    // Mulai dari B1 tanpa asumsi jumlah header — baris header gagal parse tanggal.
    const shiftLabel = CATATAN_SHIFT_LABEL[shift];
    let matchRow: number | null = null; // 1-based sheet row
    let matchCells: string[] = [];
    let lastNonEmptyB = 0;              // 1-based sheet row; 0 = kolom B kosong semua
    for (let i = 0; i < rows.length; i++) {
        const b = (rows[i][0] ?? '').trim();
        if (b !== '') lastNonEmptyB = i + 1;
        if (matchRow === null
            && parseCatatanSheetDate(b) === isoDate
            && (rows[i][1] ?? '').trim().toLowerCase() === shiftLabel.toLowerCase()) {
            matchRow = i + 1;
            matchCells = rows[i];
        }
    }

    // RAW: teks catatan tidak boleh ditafsirkan formula/angka oleh Sheets.
    const tulis = async (data: { range: string; values: string[][] }[], label: string) => {
        await withRetry(() => sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: CATATAN_SPREADSHEET_ID,
            requestBody: { valueInputOption: 'RAW', data },
        }), label);
    };

    if (matchRow !== null) {
        // Tiap kolom di-merge sendiri: ember kosong → mergeCatatanCell no-op → sel
        // tidak masuk daftar tulis sama sekali.
        const data: { range: string; values: string[][] }[] = [];
        const kolom: string[] = [];
        for (const k of CATATAN_KOLOM) {
            const { next, changed } = mergeCatatanCell(matchCells[k.offset] ?? '', catatan[k.key]);
            if (!changed) continue;
            data.push({ range: `${quoteTab(tab)}!${k.huruf}${matchRow}`, values: [[next]] });
            kolom.push(k.huruf);
        }
        if (data.length === 0) return { action: 'skipped', tab, rowIndex: matchRow, reason: 'tidak ada perubahan' };
        await tulis(data, `batchUpdate catatan ${tab} baris ${matchRow} (${kolom.join(',')})`);
        return { action: 'updated', tab, rowIndex: matchRow, kolom };
    }

    const adaIsi = CATATAN_KOLOM.some(k => catatan[k.key].trim() !== '');
    if (!adaIsi) return { action: 'skipped', tab, reason: 'catatan kosong' };

    const newRow = (lastNonEmptyB || rows.length) + 1;
    const [y, m, d] = isoDate.split('-');
    // B:C dulu, isi belakangan — kalau tulis isi gagal, save berikutnya match baris
    // ini dan mengisinya (self-healing). USER_ENTERED supaya B jadi date serial yang
    // dirender format kolom ("12 Juni 2026"); bukan values.append karena append
    // menebak luas tabel dari kolom lain dan bisa salah taruh baris.
    await withRetry(() => sheets.spreadsheets.values.update({
        spreadsheetId: CATATAN_SPREADSHEET_ID,
        range: `${quoteTab(tab)}!B${newRow}:C${newRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[`${d}/${m}/${y}`, shiftLabel]] },
    }), `update catatan ${tab}!B${newRow}:C${newRow}`);
    const dataBaru: { range: string; values: string[][] }[] = [];
    const kolomBaru: string[] = [];
    for (const k of CATATAN_KOLOM) {
        const isi = catatan[k.key].trim();
        if (!isi) continue;
        dataBaru.push({ range: `${quoteTab(tab)}!${k.huruf}${newRow}`, values: [[buildCatatanBlock(isi)]] });
        kolomBaru.push(k.huruf);
    }
    await tulis(dataBaru, `batchUpdate catatan ${tab} baris ${newRow} (${kolomBaru.join(',')})`);
    return { action: 'created', tab, rowIndex: newRow, kolom: kolomBaru };
}

// ─── EVAL CM (Total PA/SA coal mill per boiler, shift pagi) ───────────────────
//
// Sheet "EVAL CM" (gid 773770664) di spreadsheet catatan yang sama:
//   Baris 2 header, data mulai baris 4. Kolom A = tanggal (satu baris per
//   tanggal, pre-filled berurutan s/d ~Agustus 2026), kolom B = shift
//   (historis selalu "PAGI" — parameter dicatat sekali sehari di shift pagi).
//   Blok boiler A: Total PA kolom R, Total SA kolom S.
//   Blok boiler B: Total PA kolom AL, Total SA kolom AM.
// Ditulis HANYA dari laporan shift pagi. Baris dicari by tanggal kolom A
// (bukan anchor offset) supaya tahan baris sisipan/gap; tidak ketemu → skip
// dengan reason (baris tanggal diisi manual oleh user, kita tidak menambah).

const EVAL_CM_GID = 773770664;
const EVAL_CM_COLUMNS = { aPa: 'R', aSa: 'S', bPa: 'AL', bSa: 'AM' } as const;

let evalCmTabTitleCache: string | null = null;

async function resolveEvalCmTab(sheets: ReturnType<typeof getSheetsClient>, force = false): Promise<string> {
    if (evalCmTabTitleCache && !force) return evalCmTabTitleCache;
    const meta = await withRetry(() => sheets.spreadsheets.get({
        spreadsheetId: CATATAN_SPREADSHEET_ID,
        fields: 'sheets.properties(sheetId,title)',
    }), 'get eval cm tab meta');
    const tab = meta.data.sheets?.find(s => s.properties?.sheetId === EVAL_CM_GID);
    const title = tab?.properties?.title;
    if (!title) throw new Error(`Tab gid=${EVAL_CM_GID} (EVAL CM) tidak ditemukan di spreadsheet catatan`);
    evalCmTabTitleCache = title;
    return title;
}

export interface EvalCmAirValues {
    aPa?: number | null;  // boiler A primary air   → kolom R
    aSa?: number | null;  // boiler A secondary air → kolom S
    bPa?: number | null;  // boiler B primary air   → kolom AL
    bSa?: number | null;  // boiler B secondary air → kolom AM
}

export interface EvalCmUpdateResult {
    action: 'updated' | 'skipped';
    tab?: string;
    rowIndex?: number;
    updates?: { range: string; value: number | string }[];
    reason?: string;
}

/**
 * Tulis Total PA/SA boiler A/B (input station Panel Boiler, shift pagi) ke
 * sheet EVAL CM. Nilai null/undefined dilewati sehingga station Panel A tidak
 * menimpa kolom milik Panel B (dan sebaliknya) — pola scoping yang sama
 * dengan upsertShiftRow. Kolom B diisi "PAGI" hanya bila masih kosong
 * (tidak menimpa isian manual).
 */
export async function upsertEvalCmAir(isoDate: string, values: EvalCmAirValues): Promise<EvalCmUpdateResult> {
    const entries = (Object.entries(EVAL_CM_COLUMNS) as [keyof EvalCmAirValues, string][])
        .filter(([key]) => values[key] != null)
        .map(([key, col]) => ({ col, value: values[key] as number }));
    if (entries.length === 0) return { action: 'skipped', reason: 'tidak ada nilai PA/SA' };

    const sheets = getSheetsClient();
    let tab = await resolveEvalCmTab(sheets);

    const readRows = async (): Promise<string[][]> => {
        const res = await withRetry(() => sheets.spreadsheets.values.get({
            spreadsheetId: CATATAN_SPREADSHEET_ID,
            range: `${quoteTab(tab)}!A1:B`,
            valueRenderOption: 'FORMATTED_VALUE',
        }), `get eval cm ${tab}!A1:B`);
        return (res.data.values ?? []) as string[][];
    };

    let rows: string[][];
    try {
        rows = await readRows();
    } catch (err) {
        // Judul tab basi (di-rename setelah di-cache) → refresh dari gid, 1x ulang.
        if (!/unable to parse range/i.test(err instanceof Error ? err.message : String(err))) throw err;
        tab = await resolveEvalCmTab(sheets, true);
        rows = await readRows();
    }

    let matchRow: number | null = null; // 1-based sheet row
    let shiftCellEmpty = false;
    for (let i = 0; i < rows.length; i++) {
        if (parseCatatanSheetDate((rows[i][0] ?? '').trim()) === isoDate) {
            matchRow = i + 1;
            shiftCellEmpty = (rows[i][1] ?? '').trim() === '';
            break;
        }
    }
    if (matchRow === null) {
        return { action: 'skipped', tab, reason: `tanggal ${isoDate} tidak ditemukan di kolom A EVAL CM` };
    }

    const data: { range: string; values: (number | string)[][] }[] = entries.map(e => ({
        range: `${quoteTab(tab)}!${e.col}${matchRow}`,
        values: [[e.value]],
    }));
    if (shiftCellEmpty) {
        data.push({ range: `${quoteTab(tab)}!B${matchRow}`, values: [['PAGI']] });
    }
    await withRetry(() => sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: CATATAN_SPREADSHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data },
    }), `batchUpdate eval cm baris ${matchRow}`);

    return {
        action: 'updated', tab, rowIndex: matchRow,
        updates: entries.map(e => ({ range: `${e.col}${matchRow}`, value: e.value })),
    };
}
