/**
 * POST /api/sheets/sync
 * Baca data dari Google Sheets (semua tab shift) untuk N hari terakhir
 * dan sync ke Supabase (upsert shift_reports + child tables).
 *
 * Body: { days?: number }  — default 7
 * Returns: { synced: number, skipped: number, errors: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSheetRows, SHEET_TABS, fromIndonesianDate } from '@/lib/google-sheets';
import { rowToShiftReport } from '@/lib/sheets-mapper';
import type { ShiftTab } from '@/lib/google-sheets';

// ─── Supabase admin client (service role, bypasses RLS) ───────────────────────

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error(`Supabase env vars missing: URL=${!!url} KEY=${!!key}`);
    return createClient(url, key);
}

// ─── Valid DB columns per table ───────────────────────────────────────────────

const VALID_COLS: Record<string, string[]> = {
    shift_boiler: ['press_steam','temp_steam','flow_steam','totalizer_steam','flow_bfw','temp_bfw','totalizer_bfw','bfw_press','temp_furnace','temp_flue_gas','excess_air','air_heater_ti113','batubara_ton','solar_m3','stream_days','steam_drum_press','primary_air','secondary_air','o2','feeder_a_flow','feeder_b_flow','feeder_c_flow','feeder_d_flow','feeder_e_flow','feeder_f_flow'],
    shift_turbin: ['flow_steam','flow_cond','press_steam','temp_steam','exh_steam','vacuum','hpo_durasi','thrust_bearing','metal_bearing','vibrasi','winding','axial_displacement','level_condenser','temp_cw_in','temp_cw_out','press_deaerator','temp_deaerator','press_lps','stream_days','totalizer_steam_inlet','totalizer_condensate'],
    shift_steam_dist: ['pabrik1_flow','pabrik1_temp','pabrik2_flow','pabrik2_temp','pabrik3a_flow','pabrik3a_temp','pabrik3b_flow','pabrik3b_temp'],
    shift_generator_gi: ['gen_load','gen_ampere','gen_amp_react','gen_cos_phi','gen_tegangan','gen_frequensi','gi_sum_p','gi_sum_q','gi_cos_phi'],
    shift_power_dist: ['power_ubb','power_pabrik2','power_pabrik3a','power_pie','power_pabrik3b'],
    shift_esp_handling: ['esp_a1','esp_a2','esp_a3','esp_b1','esp_b2','esp_b3','silo_a','silo_b','unloading_a','unloading_b','loading','hopper','conveyor','pf1','pf2'],
    shift_tankyard: ['tk_rcw','tk_demin','tk_solar_ab'],
    shift_personnel: ['turbin_grup','turbin_karu','turbin_kasi'],
    shift_coal_bunker: ['feeder_a','feeder_b','feeder_c','feeder_d','feeder_e','feeder_f','bunker_a','bunker_b','bunker_c','bunker_d','bunker_e','bunker_f'],
    shift_water_quality: ['demin_1250_ph','demin_1250_conduct','demin_1250_th','demin_1250_sio2','demin_750_ph','demin_750_conduct','demin_750_th','demin_750_sio2','bfw_ph','bfw_conduct','bfw_th','bfw_sio2','bfw_nh4','bfw_chz','boiler_water_a_ph','boiler_water_a_conduct','boiler_water_a_sio2','boiler_water_a_po4','boiler_water_b_ph','boiler_water_b_conduct','boiler_water_b_sio2','boiler_water_b_po4','product_steam_ph','product_steam_conduct','product_steam_th','product_steam_sio2','product_steam_nh4'],
};

function pickValidCols(table: string, data: Record<string, unknown>): Record<string, unknown> {
    const valid = new Set(VALID_COLS[table] || []);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
        if (valid.has(k) && v !== undefined && v !== null) result[k] = v;
    }
    return result;
}

// ─── Save one parsed row to Supabase ─────────────────────────────────────────

async function saveRowToSupabase(
    supabase: ReturnType<typeof getSupabase>,
    shift: ShiftTab,
    date: string,
    parsed: ReturnType<typeof rowToShiftReport>,
    errors: string[],
): Promise<'synced' | 'skipped'> {
    const group_name = parsed.personnel?.turbin_grup || 'A';
    const supervisor = parsed.personnel?.turbin_karu || 'Sheets Sync';

    // Upsert shift_reports
    const { data: sr, error: srErr } = await supabase
        .from('shift_reports')
        .upsert(
            { date, shift, group_name, supervisor, status: 'draft' },
            { onConflict: 'date,shift,group_name' },
        )
        .select('id')
        .single();

    if (srErr || !sr) {
        errors.push(`[${date}/${shift}] shift_reports: ${srErr?.message || 'no data'}`);
        return 'skipped';
    }

    const reportId = (sr as { id: string }).id;

    // Save child table helper
    async function saveChild(table: string, data: Record<string, unknown>) {
        const filtered = pickValidCols(table, data);
        if (Object.keys(filtered).length === 0) return;
        await supabase.from(table).delete().eq('shift_report_id', reportId);
        const { error } = await supabase
            .from(table)
            .insert({ shift_report_id: reportId, ...filtered } as Record<string, unknown>);
        if (error) errors.push(`[${date}/${shift}] ${table}: ${error.message}`);
    }

    // Save boiler A & B
    for (const [boilerId, boilerData] of [['A', parsed.boilerA], ['B', parsed.boilerB]] as [string, Record<string, number | null>][]) {
        if (!boilerData) continue;
        const filtered = pickValidCols('shift_boiler', boilerData as Record<string, unknown>);
        if (Object.keys(filtered).length === 0) continue;
        await supabase.from('shift_boiler').delete().eq('shift_report_id', reportId).eq('boiler', boilerId);
        const { error } = await supabase
            .from('shift_boiler')
            .insert({ shift_report_id: reportId, boiler: boilerId, ...filtered } as Record<string, unknown>);
        if (error) errors.push(`[${date}/${shift}] shift_boiler_${boilerId}: ${error.message}`);
    }

    if (parsed.turbin) await saveChild('shift_turbin', parsed.turbin as Record<string, unknown>);
    if (parsed.steamDist) await saveChild('shift_steam_dist', parsed.steamDist as Record<string, unknown>);
    if (parsed.generatorGi) await saveChild('shift_generator_gi', parsed.generatorGi as Record<string, unknown>);
    if (parsed.powerDist) await saveChild('shift_power_dist', parsed.powerDist as Record<string, unknown>);
    if (parsed.espHandling) await saveChild('shift_esp_handling', parsed.espHandling as Record<string, unknown>);
    if (parsed.tankyard) await saveChild('shift_tankyard', parsed.tankyard as Record<string, unknown>);
    if (parsed.personnel) await saveChild('shift_personnel', parsed.personnel as Record<string, unknown>);
    if (parsed.coalBunker) await saveChild('shift_coal_bunker', parsed.coalBunker as Record<string, unknown>);
    if (parsed.waterQuality) await saveChild('shift_water_quality', parsed.waterQuality as Record<string, unknown>);

    return 'synced';
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function runSync(days: number) {

    // Build set of ISO dates to include
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days + 1);
    const isoStart = startDate.toISOString().split('T')[0];
    const isoEnd = today.toISOString().split('T')[0];

    const supabase = getSupabase();
    const errors: string[] = [];
    let synced = 0;
    let skipped = 0;

    const shiftTabs: { shift: ShiftTab; tab: string }[] = [
        { shift: 'pagi', tab: SHEET_TABS.pagi },
        { shift: 'sore', tab: SHEET_TABS.sore },
        { shift: 'malam', tab: SHEET_TABS.malam },
    ];

    for (const { shift, tab } of shiftTabs) {
        let rows: string[][];
        try {
            rows = await getSheetRows(tab);
        } catch (err) {
            errors.push(`Gagal baca tab ${tab}: ${err instanceof Error ? err.message : String(err)}`);
            continue;
        }

        for (const row of rows) {
            const indonesianDate = (row[1] ?? '').trim();
            if (!indonesianDate) continue;

            const isoDate = fromIndonesianDate(indonesianDate);
            if (!isoDate) continue;
            if (isoDate < isoStart || isoDate > isoEnd) continue;

            // Skip rows with no data beyond date
            const hasData = row.slice(2).some(c => c && c.trim() !== '');
            if (!hasData) continue;

            try {
                const parsed = rowToShiftReport(row);
                const result = await saveRowToSupabase(supabase, shift, isoDate, parsed, errors);
                if (result === 'synced') synced++;
                else skipped++;
            } catch (err) {
                errors.push(`[${isoDate}/${shift}] parse/save error: ${err instanceof Error ? err.message : String(err)}`);
                skipped++;
            }
        }
    }

    return {
        synced,
        skipped,
        range: { from: isoStart, to: isoEnd },
        errors: errors.length > 0 ? errors : undefined,
    };
}

// GET — dipanggil oleh Vercel Cron (setiap jam, default 7 hari)
export async function GET() {
    const result = await runSync(7);
    return NextResponse.json(result);
}

// POST — dipanggil manual dengan body { days?: number }
export async function POST(req: NextRequest) {
    let days = 7;
    try {
        const body = await req.json().catch(() => ({}));
        if (body?.days && typeof body.days === 'number') days = Math.min(body.days, 30);
    } catch { /* use default */ }
    const result = await runSync(days);
    return NextResponse.json(result);
}
