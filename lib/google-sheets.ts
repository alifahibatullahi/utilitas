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

export const SHEET_TABS = {
    pagi: 'Pagi',
    sore: 'Sore',
    malam: 'Malam',
    harian: 'LHUBB',
} as const;

export type ShiftTab = 'pagi' | 'sore' | 'malam';

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getSheetsClient() {
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

    return google.sheets({ version: 'v4', auth });
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
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A6:EZ`, // Start from row 6 (after 5 header rows)
    });
    return (res.data.values ?? []) as string[][];
}

/**
 * Find the 1-based row index in the spreadsheet for a given date + group name.
 * Searches col A (No) and col B (Tanggal). Returns null if not found.
 * rowIndex is the actual Sheets row number (accounting for 5 header rows).
 */
export async function findShiftRow(tab: string, isoDate: string): Promise<number | null> {
    const rows = await getSheetRows(tab);
    const targetDate = toIndonesianDate(isoDate);

    for (let i = 0; i < rows.length; i++) {
        const rowDate = (rows[i][1] ?? '').trim(); // col B = Tanggal (0-indexed col 1)
        if (rowDate === targetDate) return i + 6;  // 5 headers + 1-based index
    }
    return null;
}

/**
 * Get a specific row's data by 1-based row index.
 */
export async function getShiftRow(tab: string, rowIndex: number): Promise<string[]> {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A${rowIndex}:EZ${rowIndex}`,
    });
    const rows = res.data.values ?? [];
    return (rows[0] ?? []) as string[];
}

/**
 * Count existing data rows in a tab (to generate the next row number).
 */
async function countDataRows(tab: string): Promise<number> {
    const rows = await getSheetRows(tab);
    return rows.filter(r => r.some(c => c && c.trim() !== '')).length;
}

/**
 * Append a new row to the sheet.
 */
async function appendSheetRow(tab: string, values: (string | number | null)[]): Promise<void> {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A6`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
            values: [values],
        },
    });
}

/**
 * Update an existing row by 1-based row index.
 */
async function updateSheetRow(tab: string, rowIndex: number, values: (string | number | null)[]): Promise<void> {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [values],
        },
    });
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
    const rows = await getSheetRows(tab);
    const targetDate = toIndonesianDate(isoDate);

    let existingRow: number | null = null;
    for (let i = 0; i < rows.length; i++) {
        const rowDate = (rows[i][1] ?? '').trim();
        if (rowDate === targetDate) {
            existingRow = i + 6;
            break;
        }
    }

    if (existingRow !== null) {
        await updateSheetRow(tab, existingRow, values);
        return { action: 'updated', rowIndex: existingRow };
    } else {
        const rowCount = rows.filter(r => r.some(c => c && c.trim() !== '')).length;
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
