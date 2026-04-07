/**
 * POST /api/sheets/write
 * Write shift report or daily report data to Google Sheets.
 *
 * Body: { type: 'shift_report' | 'daily_report', data: {...} }
 *
 * Returns 200 with { action, rowIndex } on success.
 * Returns 200 with { warning } if Sheets write fails (Supabase already saved).
 */

import { NextRequest, NextResponse } from 'next/server';
import { upsertShiftRow, upsertDailyRow } from '@/lib/google-sheets';
import { shiftReportToRow, type ShiftReportForSheets, type PrevBoilerTotalizer } from '@/lib/sheets-mapper';
import type { ShiftTab } from '@/lib/google-sheets';

export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { type, data } = body as { type: string; data: Record<string, unknown> };

    if (!type || !data) {
        return NextResponse.json({ error: 'Missing type or data' }, { status: 400 });
    }

    // ─── Shift Report ──────────────────────────────────────────────────────────
    if (type === 'shift_report') {
        const { shift, group_name, prevBoilerA, prevBoilerB, ...reportData } = data as unknown as {
            shift: ShiftTab;
            group_name: string;
            prevBoilerA?: PrevBoilerTotalizer;
            prevBoilerB?: PrevBoilerTotalizer;
        } & ShiftReportForSheets;

        if (!shift || !reportData.date) {
            return NextResponse.json({ error: 'Missing shift or date' }, { status: 400 });
        }

        try {
            const row = shiftReportToRow(reportData, { boilerA: prevBoilerA, boilerB: prevBoilerB });
            const result = await upsertShiftRow(shift, reportData.date, group_name ?? '', row);
            return NextResponse.json(result);
        } catch (err) {
            console.error('[sheets/write] shift_report error:', err);
            return NextResponse.json({
                warning: `Supabase OK, Google Sheets gagal: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }

    // ─── Daily Report ──────────────────────────────────────────────────────────
    if (type === 'daily_report') {
        const { date } = data as { date: string };

        if (!date) {
            return NextResponse.json({ error: 'Missing date' }, { status: 400 });
        }

        try {
            // Daily report: for now just write date + notes as a placeholder row.
            // Full column mapping for LHUBB can be added once the tab structure is known.
            const row: (string | number | null)[] = new Array(10).fill(null);
            row[0] = null; // No — set by upsertDailyRow
            row[1] = data.tanggal as string ?? date;
            // Additional columns can be mapped here once LHUBB structure is confirmed.

            const result = await upsertDailyRow(date, row);
            return NextResponse.json(result);
        } catch (err) {
            console.error('[sheets/write] daily_report error:', err);
            return NextResponse.json({
                warning: `Supabase OK, Google Sheets gagal: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }

    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
}
