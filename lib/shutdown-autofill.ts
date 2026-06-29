/**
 * Auto-isi laporan unit yang SHUTDOWN — supaya operator tidak perlu membuka station
 * tiap shift/harian hanya untuk mencatat status shutdown.
 *
 * Dipicu server-side dari cron (app/api/cron/notify-shift). Idempotent: hanya membuat
 * baris kalau belum ada / status belum di-set; TIDAK menimpa data unit yang running.
 *
 * Sumber status = `getInheritedUnitStatus` (status terakhir per unit). Saat unit
 * shutdown: status='shutdown' + totalizer dibawa (meter tak bergerak) + field operasi
 * di-nol — mirror auto-zero form (TabBoiler/TabTurbin). Lalu sync ke Google Sheets.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getInheritedUnitStatus } from './unit-status';
import { getGroupForShift } from './constants';

// Mirror daftar field auto-zero di TabBoiler.tsx / TabTurbin.tsx.
const NON_TOTALIZER_BOILER_FIELDS = [
    'press_steam', 'temp_steam', 'flow_steam', 'bfw_press', 'temp_bfw', 'flow_bfw',
    'air_heater_ti113', 'excess_air', 'temp_flue_gas', 'primary_air', 'secondary_air',
    'o2', 'steam_drum_press', 'solar_m3',
];
const TURBIN_NON_TOTALIZER_FIELDS = [
    'press_steam', 'temp_steam', 'flow_steam', 'flow_cond', 'exh_steam', 'vacuum',
    'hpo_durasi', 'thrust_bearing', 'metal_bearing', 'vibrasi', 'winding',
    'axial_displacement', 'level_condenser', 'temp_cw_in', 'temp_cw_out',
];

type ShiftKind = 'pagi' | 'sore' | 'malam';

function zeros(keys: string[]): Record<string, number> {
    return Object.fromEntries(keys.map(k => [k, 0]));
}

async function postSheets(type: string, data: Record<string, unknown>): Promise<void> {
    const base = process.env.NEXT_PUBLIC_APP_URL;
    if (!base) return; // tanpa URL publik, lewati sync (DB tetap tersimpan)
    try {
        await fetch(`${base.replace(/\/$/, '')}/api/sheets/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, data }),
        });
    } catch (e) {
        console.warn('[shutdown-autofill] sheets sync gagal:', e);
    }
}

/** Pastikan baris shift_reports (draft) ada; kembalikan id-nya. */
async function ensureShiftReport(supabase: SupabaseClient, date: string, shift: ShiftKind): Promise<string | null> {
    const group = getGroupForShift(date, shift) ?? '';
    const { data: existing } = await supabase
        .from('shift_reports').select('id').eq('date', date).eq('shift', shift).limit(1);
    if (existing && existing.length > 0) return (existing[0] as { id: string }).id;
    const { data: ins } = await supabase
        .from('shift_reports')
        .insert({ date, shift, group_name: group || 'A', supervisor: '', status: 'draft' } as never)
        .select('id').single();
    return (ins as { id: string } | null)?.id ?? null;
}

export interface AutofillResult {
    date: string; shift?: string;
    boilerA?: boolean; boilerB?: boolean; turbin?: boolean;
}

/**
 * Auto-isi unit shutdown untuk satu shift. Idempotent (skip unit yang barisnya sudah ada).
 */
export async function autofillShutdownShift(supabase: SupabaseClient, date: string, shift: ShiftKind): Promise<AutofillResult> {
    const st = await getInheritedUnitStatus(supabase, date, shift);
    const result: AutofillResult = { date, shift };
    const anyShutdown = st.statusBoilerA === 'shutdown' || st.statusBoilerB === 'shutdown' || st.statusTurbin === 'shutdown';
    if (!anyShutdown) return result;

    const reportId = await ensureShiftReport(supabase, date, shift);
    if (!reportId) return result;

    // Baris child yang sudah ada → jangan timpa (operator menang).
    const [{ data: boilers }, { data: turb }, { data: cbRows }] = await Promise.all([
        supabase.from('shift_boiler').select('boiler').eq('shift_report_id', reportId),
        supabase.from('shift_turbin').select('id').eq('shift_report_id', reportId),
        supabase.from('shift_coal_bunker').select('id').eq('shift_report_id', reportId),
    ]);
    const existingBoilers = new Set(((boilers ?? []) as { boiler: string }[]).map(b => String(b.boiler).toUpperCase()));
    const cbId = (cbRows ?? [])[0] ? ((cbRows as { id: string }[])[0]).id : null;

    // Payload Sheets (washift) — hanya unit yang di-autofill; sel lain undefined → tidak ditulis.
    const sheetsData: Record<string, unknown> = { shift, date, group_name: getGroupForShift(date, shift) ?? '' };

    // ─── Boiler A / B ───
    for (const id of ['A', 'B'] as const) {
        const status = id === 'A' ? st.statusBoilerA : st.statusBoilerB;
        if (status !== 'shutdown' || existingBoilers.has(id)) continue;
        const prev = id === 'A' ? st.prevBoilerA : st.prevBoilerB;
        const feederKeys = id === 'A' ? ['feeder_a', 'feeder_b', 'feeder_c'] : ['feeder_d', 'feeder_e', 'feeder_f'];
        const boilerRow: Record<string, unknown> = {
            shift_report_id: reportId, boiler: id, status_boiler: 'shutdown',
            totalizer_steam: prev.totalizer_steam ?? 0, totalizer_bfw: prev.totalizer_bfw ?? 0,
            batubara_ton: 0, stream_days: 0,
            ...zeros(NON_TOTALIZER_BOILER_FIELDS),
            ...zeros(feederKeys.map(f => `${f}_flow`)),
        };
        await supabase.from('shift_boiler').insert(boilerRow as never);
        result[id === 'A' ? 'boilerA' : 'boilerB'] = true;

        // shift_coal_bunker feeders (standby + totalizer dibawa) — merge per kolom.
        const cbPatch: Record<string, unknown> = {};
        for (const f of feederKeys) { cbPatch[f] = st.prevFeeders[f] ?? 0; cbPatch[`status_${f}`] = 'standby'; }
        if (cbId) await supabase.from('shift_coal_bunker').update(cbPatch as never).eq('id', cbId);
        else await supabase.from('shift_coal_bunker').insert({ shift_report_id: reportId, ...cbPatch } as never);

        // Sheets payload boiler + feeders. status_boiler='shutdown' WAJIB disertakan
        // supaya mapper menulis parameter 0 sebagai 0 (bukan sel kosong via n()).
        sheetsData[id === 'A' ? 'boilerA' : 'boilerB'] = {
            status_boiler: 'shutdown',
            totalizer_steam: prev.totalizer_steam ?? 0, batubara_ton: 0, solar_m3: 0, stream_days: 0,
            press_steam: 0, temp_steam: 0, flow_steam: 0, flow_bfw: 0, temp_bfw: 0, temp_furnace: 0,
            temp_flue_gas: 0, o2: 0, air_heater_ti113: 0, steam_drum_press: 0, bfw_press: 0,
            ...zeros(feederKeys.map(f => `${f}_flow`)),
        };
        sheetsData[id === 'A' ? 'prevBoilerA' : 'prevBoilerB'] = { totalizer_steam: prev.totalizer_steam ?? 0 };
        const cb = (sheetsData.coalBunker ?? {}) as Record<string, unknown>;
        for (const f of feederKeys) { cb[f] = st.prevFeeders[f] ?? 0; cb[`status_${f}`] = 'standby'; }
        sheetsData.coalBunker = cb;
    }

    // ─── Turbin ───
    if (st.statusTurbin === 'shutdown' && !(turb && turb.length > 0)) {
        const turbinRow: Record<string, unknown> = {
            shift_report_id: reportId, status_turbin: 'shutdown',
            totalizer_steam_inlet: st.prevTurbin.totalizer_steam_inlet ?? 0,
            totalizer_condensate: st.prevTurbin.totalizer_condensate ?? 0,
            stream_days: 0,
            ...zeros(TURBIN_NON_TOTALIZER_FIELDS),
        };
        await supabase.from('shift_turbin').insert(turbinRow as never);
        result.turbin = true;
        // Cascade generator output 0 (STG off saat turbin shutdown).
        const { data: genRows } = await supabase.from('shift_generator_gi').select('id').eq('shift_report_id', reportId);
        const genPatch = zeros(['gen_load', 'gen_ampere', 'gen_amp_react', 'gen_cos_phi', 'gen_tegangan', 'gen_frequensi']);
        if ((genRows ?? []).length > 0) await supabase.from('shift_generator_gi').update(genPatch as never).eq('shift_report_id', reportId);
        else await supabase.from('shift_generator_gi').insert({ shift_report_id: reportId, ...genPatch } as never);

        // status_turbin WAJIB di payload → mapper menulis param turbin & generator 0 sebagai 0.
        sheetsData.turbin = { status_turbin: 'shutdown', ...zeros(TURBIN_NON_TOTALIZER_FIELDS), stream_days: 0 };
        sheetsData.generatorGi = genPatch;
    }

    // Sync ke Google Sheets washift (best-effort).
    if (result.boilerA || result.boilerB || result.turbin) {
        await postSheets('shift_report', sheetsData);
    }
    return result;
}

/**
 * Auto-isi unit shutdown untuk laporan HARIAN (LHUBB). Idempotent (skip kalau status
 * sudah di-set di daily_report_turbine_misc).
 */
export async function autofillShutdownDaily(supabase: SupabaseClient, date: string): Promise<AutofillResult> {
    const st = await getInheritedUnitStatus(supabase, date, 'harian');
    const result: AutofillResult = { date };
    const anyShutdown = st.statusBoilerA === 'shutdown' || st.statusBoilerB === 'shutdown' || st.statusTurbin === 'shutdown';
    if (!anyShutdown) return result;

    // Pastikan daily_reports ada.
    let reportId: string | null = null;
    const { data: existing } = await supabase.from('daily_reports').select('id').eq('date', date).limit(1);
    if (existing && existing.length > 0) reportId = (existing[0] as { id: string }).id;
    else {
        const { data: ins } = await supabase.from('daily_reports').insert({ date, status: 'draft' } as never).select('id').single();
        reportId = (ins as { id: string } | null)?.id ?? null;
    }
    if (!reportId) return result;

    // Status sekarang di turbine_misc — skip unit yang sudah di-set.
    const { data: tmRows } = await supabase.from('daily_report_turbine_misc')
        .select('id, status_boiler_a, status_boiler_b, status_turbin').eq('daily_report_id', reportId);
    const tm = (tmRows ?? [])[0] as { id: string; status_boiler_a?: string; status_boiler_b?: string; status_turbin?: string } | undefined;

    // Kolom 24h LHUBB (prod_boiler_*_24, coal_*_24, bfw_boiler_*, inlet_turbine_24)
    // ditulis ke Sheets sebagai SELISIH today−yesterday (daily-sheets-mapper.ts `sel`).
    // Supaya unit shutdown muncul 0 (raw tak berubah), bawa nilai RAW dari laporan
    // harian KEMARIN (date−1, = `prev` yang dipakai mapper) — bukan 0 — agar
    // today == yesterday → selisih tepat 0. Fallback ke totalizer shift terakhir
    // kalau laporan kemarin belum ada (selisih jadi null/blank, DB tetap berisi raw wajar).
    const [py, pm, pd] = date.split('-').map(Number);
    const prevDateStr = new Date(Date.UTC(py, pm - 1, pd - 1)).toISOString().slice(0, 10);
    const { data: prevDr } = await supabase.from('daily_reports').select('id').eq('date', prevDateStr).limit(1);
    const prevDrId = (prevDr ?? [])[0] ? ((prevDr as { id: string }[])[0]).id : null;
    let prevSteam: Record<string, unknown> = {};
    let prevCoal: Record<string, unknown> = {};
    let prevStock: Record<string, unknown> = {};
    if (prevDrId) {
        const [ps, pc, pstk] = await Promise.all([
            supabase.from('daily_report_steam').select('prod_boiler_a_24, prod_boiler_b_24, inlet_turbine_24').eq('daily_report_id', prevDrId).maybeSingle(),
            supabase.from('daily_report_coal').select('coal_a_24, coal_b_24, coal_c_24, coal_d_24, coal_e_24, coal_f_24').eq('daily_report_id', prevDrId).maybeSingle(),
            supabase.from('daily_report_stock_tank').select('bfw_boiler_a, bfw_boiler_b').eq('daily_report_id', prevDrId).maybeSingle(),
        ]);
        prevSteam = (ps.data ?? {}) as Record<string, unknown>;
        prevCoal = (pc.data ?? {}) as Record<string, unknown>;
        prevStock = (pstk.data ?? {}) as Record<string, unknown>;
    }
    const numOr = (v: unknown, fallback: number): number => (v == null || v === '' || isNaN(Number(v)) ? fallback : Number(v));

    const tmPatch: Record<string, unknown> = {};
    const steamPatch: Record<string, unknown> = {};
    const stockPatch: Record<string, unknown> = {};
    const coalPatch: Record<string, unknown> = {};

    for (const b of ['a', 'b'] as const) {
        const status = b === 'a' ? st.statusBoilerA : st.statusBoilerB;
        const already = b === 'a' ? tm?.status_boiler_a : tm?.status_boiler_b;
        if (status !== 'shutdown' || already) continue;
        const prevBoiler = b === 'a' ? st.prevBoilerA : st.prevBoilerB;
        tmPatch[`status_boiler_${b}`] = 'shutdown';
        // 24h = raw totalizer dibawa (selisih 0); 00:00 = pembacaan langsung, historis 0.
        steamPatch[`prod_boiler_${b}_24`] = numOr(prevSteam[`prod_boiler_${b}_24`], prevBoiler.totalizer_steam ?? 0);
        steamPatch[`prod_boiler_${b}_00`] = 0;
        stockPatch[`bfw_boiler_${b}`] = numOr(prevStock[`bfw_boiler_${b}`], prevBoiler.totalizer_bfw ?? 0);
        for (const f of (b === 'a' ? ['a', 'b', 'c'] : ['d', 'e', 'f'])) {
            coalPatch[`coal_${f}_24`] = numOr(prevCoal[`coal_${f}_24`], st.prevFeeders[`feeder_${f}`] ?? 0);
        }
        result[b === 'a' ? 'boilerA' : 'boilerB'] = true;
    }
    if (st.statusTurbin === 'shutdown' && !tm?.status_turbin) {
        tmPatch.status_turbin = 'shutdown';
        steamPatch.inlet_turbine_24 = numOr(prevSteam.inlet_turbine_24, st.prevTurbin.totalizer_steam_inlet ?? 0);
        result.turbin = true;
    }

    if (Object.keys(tmPatch).length === 0) return result; // tidak ada yang baru

    const upsertChild = async (table: string, patch: Record<string, unknown>, existsId?: string) => {
        if (Object.keys(patch).length === 0) return;
        const { data: rows } = await supabase.from(table).select('id').eq('daily_report_id', reportId);
        const id = (rows ?? [])[0] ? ((rows as { id: string }[])[0]).id : existsId;
        if (id) await supabase.from(table).update(patch as never).eq('id', id);
        else await supabase.from(table).insert({ daily_report_id: reportId, ...patch } as never);
    };
    await upsertChild('daily_report_turbine_misc', tmPatch, tm?.id);
    await upsertChild('daily_report_steam', steamPatch);
    await upsertChild('daily_report_stock_tank', stockPatch);
    await upsertChild('daily_report_coal', coalPatch);

    // Sync LHUBB (server re-baca DB).
    await postSheets('daily_report', { date });
    return result;
}
