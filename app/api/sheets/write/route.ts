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
import { upsertShiftRow, upsertDailyRow, upsertRcwRows, buildRcwEntry, upsertTankLevelsShift, upsertCatatanOperasional, upsertEvalCmAir, type EvalCmUpdateResult } from '@/lib/google-sheets';
import { getShiftCatatanCanonical } from '@/lib/shift-catatan';
import { upsertLogsheetBoiler, type LogsheetShift, type LogsheetBunker, type LogsheetLab, type LogsheetPersonnel } from '@/lib/logsheet-boiler';
import { shiftReportToRow, type ShiftReportForSheets, type PrevBoilerTotalizer } from '@/lib/sheets-mapper';
import { dailyReportToRow, type SolarSummary, type ChemicalSummary, type CoalSummary } from '@/lib/daily-sheets-mapper';
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

            // EVAL CM: Total PA/SA panel boiler A/B — hanya shift pagi. Payload
            // boilerA/boilerB sudah di-scope per station di klien, jadi Panel A
            // tidak membawa (dan tidak menimpa) kolom milik Panel B. Gagal EVAL CM
            // → warning (klien retry; upsert idempotent), baris utama sudah masuk.
            let evalCm: EvalCmUpdateResult | undefined;
            if (shift === 'pagi') {
                const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
                const bA = (reportData.boilerA ?? {}) as Record<string, unknown>;
                const bB = (reportData.boilerB ?? {}) as Record<string, unknown>;
                const air = {
                    aPa: reportData.boilerA ? num(bA.primary_air) : null,
                    aSa: reportData.boilerA ? num(bA.secondary_air) : null,
                    bPa: reportData.boilerB ? num(bB.primary_air) : null,
                    bSa: reportData.boilerB ? num(bB.secondary_air) : null,
                };
                if (air.aPa != null || air.aSa != null || air.bPa != null || air.bSa != null) {
                    try {
                        evalCm = await upsertEvalCmAir(reportData.date, air);
                        console.log(`[sheets/write] eval_cm ${reportData.date} →`, evalCm);
                    } catch (evalErr) {
                        console.error('[sheets/write] eval_cm error:', evalErr);
                        return NextResponse.json({
                            ...result,
                            warning: `Sheet utama OK, EVAL CM gagal: ${evalErr instanceof Error ? evalErr.message : String(evalErr)}`,
                        });
                    }
                }
            }

            return NextResponse.json({ ...result, evalCm });
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
            // Previous day for selisih calculation (use UTC to avoid server timezone offset)
            const [dy, dm, dd] = date.split('-').map(Number);
            const prevDateObj = new Date(Date.UTC(dy, dm - 1, dd - 1));
            const prevDateStr = prevDateObj.toISOString().slice(0, 10);

            // Semua read Supabase diparalelkan (dulu 3 tahap serial: current →
            // prev → aux) — memangkas latensi route sebelum tulis Sheets.
            const supabase = getSupabase();
            const [dbData, prevData, solarIn, solarOut, shiftChem] = await Promise.all([
                fetchDailyReport(date),
                fetchDailyReport(prevDateStr),
                supabase.from('solar_unloadings').select('liters').eq('date', date),
                supabase.from('solar_usages').select('liters, tujuan').eq('date', date),
                supabase
                    .from('shift_reports')
                    .select('shift_water_quality(phosphate_penambahan_chemical, phosphate_b_penambahan_chemical, amine_penambahan_chemical, hydrazine_penambahan_chemical)')
                    .eq('date', date),
            ]);
            if (!dbData) {
                return NextResponse.json({ warning: `Daily report untuk ${date} tidak ditemukan di database` });
            }
            const sumByTujuan = (t: string) =>
                (solarOut.data ?? []).filter((r: { tujuan: string }) => r.tujuan === t).reduce((s, r) => s + (Number(r.liters) || 0), 0);
            // Boiler A+B (CL) TIDAK diagregasi di sini — diambil mapper dari daily_report_stock_tank.solar_boiler (manual supervisor).
            const solarSummary: SolarSummary = {
                kedatangan: (solarIn.data ?? []).reduce((s, r) => s + (Number(r.liters) || 0), 0),
                bengkel:    sumByTujuan('Bengkel'),
                sasu:       sumByTujuan('SA/SU 3B'),
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

            // In/Out batubara — dari daily_report_coal_transfer (form per kategori, default 0).
            const tr = (dbData.transfer ?? {}) as Record<string, unknown>;
            const trn = (k: string) => Number(tr[k]) || 0;
            const coalSummary: CoalSummary = {
                daratTon:   trn('darat_24_ton'),
                lautTon:    trn('laut_24_ton'),
                pb2Pf1Rit:  trn('pb2_pf1_rit'),
                pb2Pf1Ton:  trn('pb2_pf1_ton'),
                pb2Pf2Rit:  trn('pb2_pf2_rit'),
                pb2Pf2Ton:  trn('pb2_pf2_ton'),
                pb3CalcRit: trn('pb3_calc_rit'),
                pb3CalcTon: trn('pb3_calc_ton'),
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
                coalSummary,
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

    // ─── Tank Levels Shift (Solar / RCW / Demin → spreadsheet handling) ───────
    if (type === 'tank_levels_shift') {
        const { solar, rcw, demin } = data as { solar?: number | null; rcw?: number | null; demin?: number | null };
        if (solar == null && rcw == null && demin == null) {
            return NextResponse.json({ error: 'No level provided' }, { status: 400 });
        }
        try {
            const result = await upsertTankLevelsShift({ solar, rcw, demin });
            return NextResponse.json(result);
        } catch (err) {
            console.error('[sheets/write] tank_levels_shift error:', err);
            return NextResponse.json({
                warning: `Tank levels Sheets gagal: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }

    // ─── Catatan Operasional (spreadsheet catatan, kolom B/C/D) ───────────────
    if (type === 'catatan_operasional') {
        const { date, shift } = data as { date: string; shift: 'malam' | 'pagi' | 'sore' };
        if (!date || !shift || !['malam', 'pagi', 'sore'].includes(shift)) {
            return NextResponse.json({ error: 'Missing/invalid date or shift' }, { status: 400 });
        }
        try {
            const supabase = getSupabase();
            const { data: row } = await supabase
                .from('shift_reports')
                .select('date, shift, catatan, station_catatan, shift_coal_bunker(*)')
                .eq('date', date)
                .eq('shift', shift)
                .maybeSingle();
            if (!row) {
                return NextResponse.json({ action: 'skipped', reason: `shift report ${date}/${shift} tidak ditemukan` });
            }
            // Catatan kanonik dari DB (catatan utama + semua station + auto-lines);
            // skip-kosong & anti-wipe ditangani di upsertCatatanOperasional.
            const canonical = await getShiftCatatanCanonical(supabase, row);
            const result = await upsertCatatanOperasional(date, shift, canonical);
            console.log(`[sheets/write] catatan_operasional ${date}/${shift} →`, result);
            return NextResponse.json(result);
        } catch (err) {
            console.error('[sheets/write] catatan_operasional error:', err);
            return NextResponse.json({
                warning: `Supabase OK, Sheets catatan gagal: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }

    // ─── LogSheet Boiler (Bunker + Lapangan Boiler → spreadsheet terpisah) ───────
    if (type === 'logsheet_boiler') {
        const { shift, date, bunker, lab } = data as {
            shift: LogsheetShift;
            date: string;
            bunker?: LogsheetBunker;
            lab?: LogsheetLab;
        };
        if (!shift || !date) {
            return NextResponse.json({ error: 'Missing shift or date' }, { status: 400 });
        }
        if (!bunker && !lab) {
            return NextResponse.json({ error: 'No block provided' }, { status: 400 });
        }

        try {
            // Personnel untuk blok lab:
            //  - Operator Boiler A/B → DIKETIK di form Lapangan Boiler (dropdown), ikut di payload lab.
            //  - Operator Coal Mill  → otomatis dari pengisi station bunker (station_fillers).
            //  - Foreman/Supervisor/Grup → otomatis dari shift_personnel.
            let personnel: LogsheetPersonnel | undefined;
            if (lab) {
                const supabase = getSupabase();
                const { data: reps } = await supabase
                    .from('shift_reports')
                    .select('group_name, station_fillers, shift_personnel(boiler_karu, boiler_kasi, boiler_grup)')
                    .eq('date', date)
                    .eq('shift', shift)
                    .order('updated_at', { ascending: false })
                    .limit(1);
                const rep = (reps ?? [])[0] as
                    | { group_name?: string; station_fillers?: Record<string, string> | null; shift_personnel?: unknown }
                    | undefined;
                const sf = (rep?.station_fillers ?? {}) as Record<string, string>;
                const sp = (Array.isArray(rep?.shift_personnel) ? rep?.shift_personnel[0] : rep?.shift_personnel) as
                    | { boiler_karu?: string | null; boiler_kasi?: string | null; boiler_grup?: string | null }
                    | undefined;
                const labRec = lab as Record<string, unknown>;
                personnel = {
                    operator_boiler_a: (labRec.operator_boiler_a as string | null) ?? null,
                    operator_boiler_b: (labRec.operator_boiler_b as string | null) ?? null,
                    operator_coal_mill: sf['bunker'] ?? null,
                    foreman: sp?.boiler_karu ?? null,
                    supervisor: sp?.boiler_kasi ?? null,
                    group: sp?.boiler_grup ?? rep?.group_name ?? null,
                };
            }

            const result = await upsertLogsheetBoiler(shift, date, { bunker, lab, personnel });
            console.log(`[sheets/write] logsheet_boiler ${date} ${shift} →`, result);
            return NextResponse.json(result);
        } catch (err) {
            console.error('[sheets/write] logsheet_boiler error:', err);
            return NextResponse.json({
                warning: `LogSheet Boiler gagal: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }

    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
}
