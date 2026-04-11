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
import { createClient } from '@supabase/supabase-js';
import { upsertShiftRow, upsertDailyRow } from '@/lib/google-sheets';
import { shiftReportToRow, type ShiftReportForSheets, type PrevBoilerTotalizer } from '@/lib/sheets-mapper';
import { dailyReportToRow, type SolarSummary } from '@/lib/daily-sheets-mapper';
import type { ShiftTab } from '@/lib/google-sheets';

// ─── Supabase client (service role / anon fallback) ───────────────────────────

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase env vars missing');
    return createClient(url, key);
}

// ─── Fetch all daily report child tables for a given date ─────────────────────

async function fetchDailyReport(isoDate: string) {
    const supabase = getSupabase();

    const { data: report } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('date', isoDate)
        .maybeSingle();

    if (!report) return null;
    const id = (report as { id: string }).id;

    const [steam, power, coal, turbine, stock, transfer, totalizer] = await Promise.all([
        supabase.from('daily_report_steam').select('*').eq('daily_report_id', id).maybeSingle(),
        supabase.from('daily_report_power').select('*').eq('daily_report_id', id).maybeSingle(),
        supabase.from('daily_report_coal').select('*').eq('daily_report_id', id).maybeSingle(),
        supabase.from('daily_report_turbine_misc').select('*').eq('daily_report_id', id).maybeSingle(),
        supabase.from('daily_report_stock_tank').select('*').eq('daily_report_id', id).maybeSingle(),
        supabase.from('daily_report_coal_transfer').select('*').eq('daily_report_id', id).maybeSingle(),
        supabase.from('daily_report_totalizer').select('*').eq('daily_report_id', id).maybeSingle(),
    ]);

    return {
        steam:     steam.data     ?? null,
        power:     power.data     ?? null,
        coal:      coal.data      ?? null,
        turbine:   turbine.data   ?? null,
        stock:     stock.data     ?? null,
        transfer:  transfer.data  ?? null,
        totalizer: totalizer.data ?? null,
    };
}

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
            const dbData = await fetchDailyReport(date);
            if (!dbData) {
                return NextResponse.json({ warning: `Daily report untuk ${date} tidak ditemukan di database` });
            }

            // Fetch previous day for selisih calculation
            const prevDate = new Date(date);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = prevDate.toISOString().slice(0, 10);
            const prevData = await fetchDailyReport(prevDateStr);

            // Fetch solar unloadings & usages for this date
            const supabase = getSupabase();
            const [solarIn, solarOut] = await Promise.all([
                supabase.from('solar_unloadings').select('liters').eq('date', date),
                supabase.from('solar_usages').select('liters, tujuan').eq('date', date),
            ]);
            const solarSummary: SolarSummary = {
                kedatangan: (solarIn.data ?? []).reduce((s, r) => s + (Number(r.liters) || 0), 0),
                bengkel:    (solarOut.data ?? []).filter((r: { tujuan: string }) => r.tujuan === 'Bengkel').reduce((s, r) => s + (Number(r.liters) || 0), 0),
                sasu:       (solarOut.data ?? []).filter((r: { tujuan: string }) => r.tujuan === 'SA/SU 3B').reduce((s, r) => s + (Number(r.liters) || 0), 0),
            };

            const row = dailyReportToRow(
                date,
                dbData.steam,
                dbData.power,
                dbData.coal,
                dbData.turbine,
                dbData.stock,
                dbData.transfer,
                dbData.totalizer,
                prevData,
                solarSummary,
            );

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
