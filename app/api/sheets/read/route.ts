/**
 * GET /api/sheets/read
 * Read shift report or daily report data from Google Sheets.
 *
 * Query params:
 *   type=shift_report&date=2025-04-07&shift=pagi&group=GroupName
 *   type=daily_report&date=2025-04-07
 *
 * Returns parsed form data ready to populate the input forms.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchShiftRow, fetchDailyRow } from '@/lib/google-sheets';
import { rowToShiftReport } from '@/lib/sheets-mapper';
import type { ShiftTab } from '@/lib/google-sheets';

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get('type');
    const date = searchParams.get('date');

    if (!type || !date) {
        return NextResponse.json({ error: 'Missing type or date' }, { status: 400 });
    }

    // ─── Shift Report ──────────────────────────────────────────────────────────
    if (type === 'shift_report') {
        const shift = searchParams.get('shift') as ShiftTab | null;
        const group = searchParams.get('group') ?? undefined;

        if (!shift || !['pagi', 'sore', 'malam'].includes(shift)) {
            return NextResponse.json({ error: 'Missing or invalid shift (pagi|sore|malam)' }, { status: 400 });
        }

        try {
            const row = await fetchShiftRow(shift, date);
            if (!row) {
                return NextResponse.json({ found: false, data: null });
            }
            const parsed = rowToShiftReport(row);
            return NextResponse.json({ found: true, data: parsed });
        } catch (err) {
            console.error('[sheets/read] shift_report error:', err);
            return NextResponse.json(
                { error: `Gagal baca Sheets: ${err instanceof Error ? err.message : String(err)}` },
                { status: 500 },
            );
        }
    }

    // ─── Daily Report ──────────────────────────────────────────────────────────
    if (type === 'daily_report') {
        try {
            const row = await fetchDailyRow(date);
            if (!row) {
                return NextResponse.json({ found: false, data: null });
            }
            // Daily report column mapping for LHUBB tab — to be expanded
            // once the full tab structure is confirmed.
            return NextResponse.json({ found: true, data: { raw: row } });
        } catch (err) {
            console.error('[sheets/read] daily_report error:', err);
            return NextResponse.json(
                { error: `Gagal baca Sheets: ${err instanceof Error ? err.message : String(err)}` },
                { status: 500 },
            );
        }
    }

    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
}
