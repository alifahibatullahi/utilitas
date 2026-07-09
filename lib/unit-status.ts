/**
 * Status unit (Boiler A/B & Turbin) yang DIWARISI dari periode sebelumnya — versi
 * SERVER-SIDE dari hook `useLatestBoilerStatus` (hooks/useShiftReport.tsx).
 *
 * Dipakai oleh auto-fill shutdown (lib/shutdown-autofill.ts): kalau status terakhir
 * sebuah unit = 'shutdown', sistem mengisi laporannya otomatis tiap shift/harian.
 *
 * Walkback 15 shift_reports + 15 daily_reports, exclude sel sekarang, urut tanggal+shift,
 * ambil status pertama non-null per unit + totalizer terakhir (untuk carry-forward).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface InheritedUnitStatus {
    statusBoilerA: string | null;
    statusBoilerB: string | null;
    statusTurbin: string | null;
    /** Totalizer terakhir (untuk dibawa saat shutdown — meter tidak bergerak). */
    prevBoilerA: { totalizer_steam: number | null; totalizer_bfw: number | null };
    prevBoilerB: { totalizer_steam: number | null; totalizer_bfw: number | null };
    /** Feeder totalizer terakhir: feeder_a..f. */
    prevFeeders: Record<string, number | null>;
    prevTurbin: { totalizer_steam_inlet: number | null; totalizer_condensate: number | null };
}

const FEEDER_KEYS = ['feeder_a', 'feeder_b', 'feeder_c', 'feeder_d', 'feeder_e', 'feeder_f'];
const FEEDER_STATUS_KEYS = ['status_feeder_a', 'status_feeder_b', 'status_feeder_c', 'status_feeder_d', 'status_feeder_e', 'status_feeder_f'];
// malam(0) → pagi(1) → sore(2) → harian(3): entry terakhir per-hari = harian.
const shiftOrder: Record<string, number> = { malam: 0, pagi: 1, sore: 2, harian: 3 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arr = (x: any): any[] => (Array.isArray(x) ? x : x ? [x] : []);
const num = (v: unknown): number | null => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));

/**
 * Hitung status unit yang diwarisi + totalizer terakhir untuk (date, shift|'harian').
 * `excludeShift` adalah sel yang sedang diproses (jangan inherit dari diri sendiri).
 */
export async function getInheritedUnitStatus(
    supabase: SupabaseClient,
    date: string,
    excludeShift: 'pagi' | 'sore' | 'malam' | 'harian',
): Promise<InheritedUnitStatus> {
    const [shiftRes, dailyRes] = await Promise.all([
        supabase
            .from('shift_reports')
            .select('date, shift, shift_boiler(boiler, status_boiler, totalizer_steam, totalizer_bfw), shift_turbin(status_turbin, totalizer_steam_inlet, totalizer_condensate), shift_coal_bunker(feeder_a,feeder_b,feeder_c,feeder_d,feeder_e,feeder_f,status_feeder_a,status_feeder_b,status_feeder_c,status_feeder_d,status_feeder_e,status_feeder_f)')
            .lte('date', date)
            .order('date', { ascending: false })
            .limit(15),
        supabase
            .from('daily_reports')
            .select('date, daily_report_turbine_misc(status_boiler_a, status_boiler_b, status_turbin)')
            .lte('date', date)
            .order('date', { ascending: false })
            .limit(15),
    ]);

    interface Entry {
        date: string; shift: string;
        statusBoilerA: string | null; statusBoilerB: string | null; statusTurbin: string | null;
        totA: { totalizer_steam: number | null; totalizer_bfw: number | null };
        totB: { totalizer_steam: number | null; totalizer_bfw: number | null };
        feeders: Record<string, number | null>;
        turbinTot: { totalizer_steam_inlet: number | null; totalizer_condensate: number | null };
    }
    const entries: Entry[] = [];

    for (const r of (shiftRes.data ?? []) as Record<string, unknown>[]) {
        const boilers = arr(r.shift_boiler);
        const a = boilers.find(b => String(b.boiler).toUpperCase() === 'A');
        const b = boilers.find(b => String(b.boiler).toUpperCase() === 'B');
        const tb = arr(r.shift_turbin)[0];
        const cb = arr(r.shift_coal_bunker)[0] ?? {};
        const feeders: Record<string, number | null> = {};
        FEEDER_KEYS.forEach(k => { feeders[k] = num((cb as Record<string, unknown>)[k]); });
        entries.push({
            date: r.date as string,
            shift: r.shift as string,
            statusBoilerA: (a?.status_boiler as string) ?? null,
            statusBoilerB: (b?.status_boiler as string) ?? null,
            statusTurbin: (tb?.status_turbin as string) ?? null,
            totA: { totalizer_steam: num(a?.totalizer_steam), totalizer_bfw: num(a?.totalizer_bfw) },
            totB: { totalizer_steam: num(b?.totalizer_steam), totalizer_bfw: num(b?.totalizer_bfw) },
            feeders,
            turbinTot: { totalizer_steam_inlet: num(tb?.totalizer_steam_inlet), totalizer_condensate: num(tb?.totalizer_condensate) },
        });
    }

    for (const r of (dailyRes.data ?? []) as Record<string, unknown>[]) {
        const tm = arr(r.daily_report_turbine_misc)[0];
        if (!tm) continue;
        entries.push({
            date: r.date as string,
            shift: 'harian',
            statusBoilerA: (tm.status_boiler_a as string) ?? null,
            statusBoilerB: (tm.status_boiler_b as string) ?? null,
            statusTurbin: (tm.status_turbin as string) ?? null,
            totA: { totalizer_steam: null, totalizer_bfw: null },
            totB: { totalizer_steam: null, totalizer_bfw: null },
            feeders: {},
            turbinTot: { totalizer_steam_inlet: null, totalizer_condensate: null },
        });
    }

    const sorted = entries
        .filter(e => !(e.date === date && e.shift === excludeShift))
        .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : (shiftOrder[b.shift] ?? 0) - (shiftOrder[a.shift] ?? 0)));

    const out: InheritedUnitStatus = {
        statusBoilerA: null, statusBoilerB: null, statusTurbin: null,
        prevBoilerA: { totalizer_steam: null, totalizer_bfw: null },
        prevBoilerB: { totalizer_steam: null, totalizer_bfw: null },
        prevFeeders: {},
        prevTurbin: { totalizer_steam_inlet: null, totalizer_condensate: null },
    };

    for (const e of sorted) {
        if (!out.statusBoilerA && e.statusBoilerA) out.statusBoilerA = e.statusBoilerA;
        if (!out.statusBoilerB && e.statusBoilerB) out.statusBoilerB = e.statusBoilerB;
        if (!out.statusTurbin && e.statusTurbin) out.statusTurbin = e.statusTurbin;
        if (out.prevBoilerA.totalizer_steam == null && e.totA.totalizer_steam != null) out.prevBoilerA.totalizer_steam = e.totA.totalizer_steam;
        if (out.prevBoilerA.totalizer_bfw == null && e.totA.totalizer_bfw != null) out.prevBoilerA.totalizer_bfw = e.totA.totalizer_bfw;
        if (out.prevBoilerB.totalizer_steam == null && e.totB.totalizer_steam != null) out.prevBoilerB.totalizer_steam = e.totB.totalizer_steam;
        if (out.prevBoilerB.totalizer_bfw == null && e.totB.totalizer_bfw != null) out.prevBoilerB.totalizer_bfw = e.totB.totalizer_bfw;
        FEEDER_KEYS.forEach(k => { if (out.prevFeeders[k] == null && e.feeders[k] != null) out.prevFeeders[k] = e.feeders[k]; });
        if (out.prevTurbin.totalizer_steam_inlet == null && e.turbinTot.totalizer_steam_inlet != null) out.prevTurbin.totalizer_steam_inlet = e.turbinTot.totalizer_steam_inlet;
        if (out.prevTurbin.totalizer_condensate == null && e.turbinTot.totalizer_condensate != null) out.prevTurbin.totalizer_condensate = e.turbinTot.totalizer_condensate;
    }

    return out;
}

export { FEEDER_KEYS, FEEDER_STATUS_KEYS };
