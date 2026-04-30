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
import { upsertShiftRow, upsertDailyRow, upsertRcwRows, buildRcwEntry } from '@/lib/google-sheets';
import { shiftReportToRow, type ShiftReportForSheets, type PrevBoilerTotalizer } from '@/lib/sheets-mapper';
import { dailyReportToRow, type SolarSummary, type ChemicalSummary } from '@/lib/daily-sheets-mapper';
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
    console.log('[sheets/write] POST received, SPREADSHEET_ID=', process.env.GOOGLE_SHEETS_ID);
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
            const row = shiftReportToRow({ ...reportData, shift }, { boilerA: prevBoilerA, boilerB: prevBoilerB });
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

            // Fetch previous day for selisih calculation (use UTC to avoid server timezone offset)
            const [dy, dm, dd] = date.split('-').map(Number);
            const prevDateObj = new Date(Date.UTC(dy, dm - 1, dd - 1));
            const prevDateStr = prevDateObj.toISOString().slice(0, 10);
            const prevData = await fetchDailyReport(prevDateStr);

            // Fetch solar unloadings, usages, and chemical consumption for this date
            const supabase = getSupabase();
            const [solarIn, solarOut, shiftChem] = await Promise.all([
                supabase.from('solar_unloadings').select('liters').eq('date', date),
                supabase.from('solar_usages').select('liters, tujuan').eq('date', date),
                supabase
                    .from('shift_reports')
                    .select('shift_water_quality(phosphate_penambahan_chemical, phosphate_b_penambahan_chemical, amine_penambahan_chemical, hydrazine_penambahan_chemical)')
                    .eq('date', date),
            ]);
            const solarSummary: SolarSummary = {
                kedatangan: (solarIn.data ?? []).reduce((s, r) => s + (Number(r.liters) || 0), 0),
                bengkel:    (solarOut.data ?? []).filter((r: { tujuan: string }) => r.tujuan === 'Bengkel').reduce((s, r) => s + (Number(r.liters) || 0), 0),
                sasu:       (solarOut.data ?? []).filter((r: { tujuan: string }) => r.tujuan === 'SA/SU 3B').reduce((s, r) => s + (Number(r.liters) || 0), 0),
            };

            let phosphateTotal = 0, amineTotal = 0, hydrazineTotal = 0;
            let hasPhosphate = false, hasAmine = false, hasHydrazine = false;
            for (const sr of (shiftChem.data ?? []) as any[]) {
                const wq = Array.isArray(sr.shift_water_quality) ? sr.shift_water_quality[0] : sr.shift_water_quality;
                if (!wq) continue;
                if (wq.phosphate_penambahan_chemical != null || wq.phosphate_b_penambahan_chemical != null) {
                    phosphateTotal += (Number(wq.phosphate_penambahan_chemical) || 0) + (Number(wq.phosphate_b_penambahan_chemical) || 0);
                    hasPhosphate = true;
                }
                if (wq.amine_penambahan_chemical != null) { amineTotal += Number(wq.amine_penambahan_chemical) || 0; hasAmine = true; }
                if (wq.hydrazine_penambahan_chemical != null) { hydrazineTotal += Number(wq.hydrazine_penambahan_chemical) || 0; hasHydrazine = true; }
            }
            const chemicalSummary: ChemicalSummary = {
                phosphate:  hasPhosphate  ? phosphateTotal  : null,
                amine:      hasAmine      ? amineTotal      : null,
                hydrazine:  hasHydrazine  ? hydrazineTotal  : null,
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
                chemicalSummary,
            );

            const result = await upsertDailyRow(date, row);
            console.log(`[sheets/write] daily_report ${date} →`, result);
            return NextResponse.json(result);
        } catch (err) {
            console.error('[sheets/write] daily_report error:', err);
            return NextResponse.json({
                warning: `Supabase OK, Google Sheets gagal: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }

    // ─── RCW Level ────────────────────────────────────────────────────────────
    if (type === 'rcw_level') {
        const { level, submitted_at } = data as { level: number; submitted_at?: string };

        if (level == null) {
            return NextResponse.json({ error: 'Missing level' }, { status: 400 });
        }

        try {
            const entry = buildRcwEntry(level, submitted_at);
            const result = await upsertRcwRows([entry]);
            return NextResponse.json(result);
        } catch (err) {
            console.error('[sheets/write] rcw_level error:', err);
            return NextResponse.json({
                warning: `RCW Sheets gagal: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }

    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
}
