'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ShiftType, ReportStatus } from '@/lib/supabase/types';

// Determine the previous shift based on chronological report order:
// 06.00 (malam) → prev is sore (22.00) from yesterday
// 14.00 (pagi)  → prev is malam (06.00) same day
// 22.00 (sore)  → prev is pagi (14.00) same day
function getPreviousShift(date: string, shift: ShiftType): { prevDate: string; prevShift: ShiftType } {
    if (shift === 'malam') {
        const d = new Date(date + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        const prevDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { prevDate, prevShift: 'sore' };
    }
    if (shift === 'pagi') return { prevDate: date, prevShift: 'malam' };
    return { prevDate: date, prevShift: 'pagi' };
}

export function usePreviousShiftData(date: string, shift: ShiftType) {
    const [prevBoilerA, setPrevBoilerA] = useState<Record<string, number | string | null>>({});
    const [prevBoilerB, setPrevBoilerB] = useState<Record<string, number | string | null>>({});
    const [prevCoalBunker, setPrevCoalBunker] = useState<Record<string, number | string | null>>({});
    const [prevTurbin, setPrevTurbin] = useState<Record<string, number | string | null>>({});
    const [prevSteamDist, setPrevSteamDist] = useState<Record<string, number | null>>({});
    const [prevPowerDist, setPrevPowerDist] = useState<Record<string, number | null>>({});

    const { prevDate, prevShift } = useMemo(() => getPreviousShift(date, shift), [date, shift]);

    useEffect(() => {
        if (!isSupabaseConfigured() || !date) {
            setPrevBoilerA({});
            setPrevBoilerB({});
            setPrevCoalBunker({});
            setPrevTurbin({});
            setPrevSteamDist({});
            setPrevPowerDist({});
            return;
        }

        const supabase = createClient();
        let stale = false;

        async function fetchPrev() {
            const { data } = await supabase
                .from('shift_reports')
                .select('shift_boiler(boiler, totalizer_steam, totalizer_bfw, status_boiler), shift_coal_bunker(feeder_a, feeder_b, feeder_c, feeder_d, feeder_e, feeder_f, status_feeder_a, status_feeder_b, status_feeder_c, status_feeder_d, status_feeder_e, status_feeder_f), shift_turbin(totalizer_steam_inlet, totalizer_condensate, status_turbin), shift_steam_dist(pabrik1_totalizer, pabrik2_totalizer, pabrik3a_totalizer), shift_power_dist(power_ubb_totalizer, power_pabrik2_totalizer, power_pabrik3a_totalizer, power_revamping_totalizer, power_pie_totalizer, power_stg_ubb_totalizer)')
                .eq('date', prevDate)
                .eq('shift', prevShift)
                .maybeSingle();

            if (stale) return;

            if (data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const boilers = (data as any).shift_boiler;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const coal = (data as any).shift_coal_bunker;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const turbin = (data as any).shift_turbin;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const steamDist = (data as any).shift_steam_dist;

                if (Array.isArray(boilers)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const a = boilers.find((b: any) => b.boiler === 'A');
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const b = boilers.find((b: any) => b.boiler === 'B');
                    setPrevBoilerA(a ? { totalizer_steam: a.totalizer_steam, totalizer_bfw: a.totalizer_bfw, status_boiler: a.status_boiler } : {});
                    setPrevBoilerB(b ? { totalizer_steam: b.totalizer_steam, totalizer_bfw: b.totalizer_bfw, status_boiler: b.status_boiler } : {});
                } else {
                    setPrevBoilerA({});
                    setPrevBoilerB({});
                }

                const cb = Array.isArray(coal) ? coal[0] : coal;
                if (cb) {
                    setPrevCoalBunker({
                        feeder_a: cb.feeder_a, feeder_b: cb.feeder_b, feeder_c: cb.feeder_c,
                        feeder_d: cb.feeder_d, feeder_e: cb.feeder_e, feeder_f: cb.feeder_f,
                        status_feeder_a: cb.status_feeder_a, status_feeder_b: cb.status_feeder_b,
                        status_feeder_c: cb.status_feeder_c, status_feeder_d: cb.status_feeder_d,
                        status_feeder_e: cb.status_feeder_e, status_feeder_f: cb.status_feeder_f,
                    });
                } else {
                    setPrevCoalBunker({});
                }

                const tb = Array.isArray(turbin) ? turbin[0] : turbin;
                if (tb) {
                    setPrevTurbin({
                        totalizer_steam_inlet: tb.totalizer_steam_inlet,
                        totalizer_condensate: tb.totalizer_condensate,
                        status_turbin: tb.status_turbin,
                    });
                } else {
                    setPrevTurbin({});
                }

                const sd = Array.isArray(steamDist) ? steamDist[0] : steamDist;
                if (sd) {
                    setPrevSteamDist({
                        pabrik1_totalizer: sd.pabrik1_totalizer,
                        pabrik2_totalizer: sd.pabrik2_totalizer,
                        pabrik3a_totalizer: sd.pabrik3a_totalizer,
                    });
                } else {
                    setPrevSteamDist({});
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const pd = (data as any).shift_power_dist;
                const pdRow = Array.isArray(pd) ? pd[0] : pd;
                if (pdRow) {
                    setPrevPowerDist({
                        power_ubb_totalizer: pdRow.power_ubb_totalizer,
                        power_pabrik2_totalizer: pdRow.power_pabrik2_totalizer,
                        power_pabrik3a_totalizer: pdRow.power_pabrik3a_totalizer,
                        power_revamping_totalizer: pdRow.power_revamping_totalizer,
                        power_pie_totalizer: pdRow.power_pie_totalizer,
                        power_stg_ubb_totalizer: pdRow.power_stg_ubb_totalizer,
                    });
                } else {
                    setPrevPowerDist({});
                }
            } else {
                setPrevBoilerA({});
                setPrevBoilerB({});
                setPrevCoalBunker({});
                setPrevTurbin({});
                setPrevSteamDist({});
                setPrevPowerDist({});
            }
        }

        fetchPrev();
        return () => { stale = true; };
    }, [prevDate, prevShift, date]);

    return { prevBoilerA, prevBoilerB, prevCoalBunker, prevTurbin, prevSteamDist, prevPowerDist };
}

// Track when each bunker started being "Berasap"
export interface BunkerBerasapInfo {
    [bunkerKey: string]: { date: string; shift: ShiftType } | null;
}

export function useBunkerBerasapHistory(date: string, shift: ShiftType) {
    const [berasapSince, setBerasapSince] = useState<BunkerBerasapInfo>({});

    useEffect(() => {
        if (!isSupabaseConfigured() || !date) {
            setBerasapSince({});
            return;
        }

        const supabase = createClient();
        let stale = false;
        const BUNKER_KEYS = ['status_bunker_a', 'status_bunker_b', 'status_bunker_c', 'status_bunker_d', 'status_bunker_e', 'status_bunker_f'];

        async function fetchHistory() {
            // Fetch the last 30 shift reports with coal bunker status, ordered by date desc
            const { data } = await supabase
                .from('shift_reports')
                .select('date, shift, shift_coal_bunker(status_bunker_a, status_bunker_b, status_bunker_c, status_bunker_d, status_bunker_e, status_bunker_f)')
                .lte('date', date)
                .order('date', { ascending: false })
                .limit(30);

            if (stale || !data) return;

            // Sort by date desc, then shift order (sore > pagi > malam for same date)
            const shiftOrder: Record<string, number> = { sore: 2, pagi: 1, malam: 0 };
            const sorted = (data as { date: string; shift: ShiftType; shift_coal_bunker: Record<string, string | null>[] | Record<string, string | null> | null }[])
                .filter(r => {
                    // Exclude current shift itself
                    if (r.date === date && r.shift === shift) return false;
                    // Exclude future shifts on same date
                    if (r.date === date && shiftOrder[r.shift] >= shiftOrder[shift]) return false;
                    return true;
                })
                .sort((a, b) => {
                    if (a.date !== b.date) return b.date.localeCompare(a.date);
                    return (shiftOrder[b.shift] || 0) - (shiftOrder[a.shift] || 0);
                });

            const result: BunkerBerasapInfo = {};

            for (const key of BUNKER_KEYS) {
                let berasapStart: { date: string; shift: ShiftType } | null = null;

                for (const report of sorted) {
                    const cb = Array.isArray(report.shift_coal_bunker) ? report.shift_coal_bunker[0] : report.shift_coal_bunker;
                    if (!cb) break; // No coal bunker data, stop searching
                    const status = cb[key];
                    if (status === 'Berasap') {
                        berasapStart = { date: report.date, shift: report.shift };
                    } else {
                        break; // Found Normal or null, stop walking back
                    }
                }

                result[key] = berasapStart;
            }

            setBerasapSince(result);
        }

        fetchHistory();
        return () => { stale = true; };
    }, [date, shift]);

    return berasapSince;
}

export interface LatestBoilerStatus {
    statusBoilerA: string | null;
    statusBoilerB: string | null;
    statusTurbin: string | null;
    statusFeeders: Record<string, string | null>;
}

// Cari status boiler & feeder terbaru dengan walkback hingga 10 shift ke belakang
// Lebih andal dari usePreviousShiftData yang hanya lihat 1 shift sebelumnya
export function useLatestBoilerStatus(date: string, shift: ShiftType | 'harian'): LatestBoilerStatus {
    const [result, setResult] = useState<LatestBoilerStatus>({
        statusBoilerA: null, statusBoilerB: null, statusTurbin: null, statusFeeders: {},
    });

    useEffect(() => {
        if (!isSupabaseConfigured() || !date) return;
        const supabase = createClient();
        let stale = false;
        // Cycle: malam(0) → pagi(1) → sore(2) → harian(3) → malam-besok(0). Harian
        // ditreat sebagai entry terakhir per-hari supaya inherit malam berikutnya pakai
        // status terbaru dari LHUBB kalau ada (fallback ke sore kalau LHUBB belum diisi).
        const shiftOrder: Record<string, number> = { malam: 0, pagi: 1, sore: 2, harian: 3 };
        const FEEDER_KEYS = ['status_feeder_a','status_feeder_b','status_feeder_c','status_feeder_d','status_feeder_e','status_feeder_f'];

        async function fetch() {
            // Fetch dari shift_reports & daily_reports paralel.
            const [shiftRes, dailyRes] = await Promise.all([
                supabase
                    .from('shift_reports')
                    .select('date, shift, shift_boiler(boiler, status_boiler), shift_turbin(status_turbin), shift_coal_bunker(status_feeder_a,status_feeder_b,status_feeder_c,status_feeder_d,status_feeder_e,status_feeder_f)')
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

            if (stale) return;

            // Gabungkan: tiap entry punya { date, shift|'harian', boilerA, boilerB, turbin, feeders }.
            type Entry = {
                date: string; shift: string;
                statusBoilerA: string | null;
                statusBoilerB: string | null;
                statusTurbin: string | null;
                feeders: Record<string, string | null>;
            };
            const entries: Entry[] = [];

            for (const r of (shiftRes.data ?? []) as {
                date: string; shift: ShiftType;
                shift_boiler: { boiler: string; status_boiler: string | null }[];
                shift_turbin: { status_turbin: string | null }[] | { status_turbin: string | null } | null;
                shift_coal_bunker: Record<string, string | null>[] | Record<string, string | null> | null;
            }[]) {
                const boilers = Array.isArray(r.shift_boiler) ? r.shift_boiler : [];
                const a = boilers.find(b => b.boiler === 'A');
                const b = boilers.find(b => b.boiler === 'B');
                const tb = Array.isArray(r.shift_turbin) ? r.shift_turbin[0] : r.shift_turbin;
                const cb = Array.isArray(r.shift_coal_bunker) ? r.shift_coal_bunker[0] : r.shift_coal_bunker;
                const feeders: Record<string, string | null> = {};
                if (cb) FEEDER_KEYS.forEach(k => { feeders[k] = (cb as Record<string, string | null>)[k] ?? null; });
                entries.push({
                    date: r.date,
                    shift: r.shift,
                    statusBoilerA: a?.status_boiler ?? null,
                    statusBoilerB: b?.status_boiler ?? null,
                    statusTurbin: tb?.status_turbin ?? null,
                    feeders,
                });
            }

            for (const r of (dailyRes.data ?? []) as {
                date: string;
                daily_report_turbine_misc: { status_boiler_a: string | null; status_boiler_b: string | null; status_turbin: string | null }[] | { status_boiler_a: string | null; status_boiler_b: string | null; status_turbin: string | null } | null;
            }[]) {
                const tm = Array.isArray(r.daily_report_turbine_misc) ? r.daily_report_turbine_misc[0] : r.daily_report_turbine_misc;
                if (!tm) continue;
                entries.push({
                    date: r.date,
                    shift: 'harian',
                    statusBoilerA: tm.status_boiler_a ?? null,
                    statusBoilerB: tm.status_boiler_b ?? null,
                    statusTurbin: tm.status_turbin ?? null,
                    feeders: {}, // harian tidak punya feeder status
                });
            }

            // Exclude current cell (kalau view sekarang sudah punya entry, jangan inherit
            // dari dirinya sendiri).
            const sorted = entries
                .filter(e => !(e.date === date && e.shift === shift))
                .sort((a, b) => {
                    if (a.date !== b.date) return b.date.localeCompare(a.date);
                    return (shiftOrder[b.shift] ?? 0) - (shiftOrder[a.shift] ?? 0);
                });

            let foundA: string | null = null;
            let foundB: string | null = null;
            let foundT: string | null = null;
            const foundFeeders: Record<string, string | null> = {};

            for (const e of sorted) {
                if (!foundA && e.statusBoilerA) foundA = e.statusBoilerA;
                if (!foundB && e.statusBoilerB) foundB = e.statusBoilerB;
                if (!foundT && e.statusTurbin) foundT = e.statusTurbin;
                FEEDER_KEYS.forEach(k => { if (!foundFeeders[k] && e.feeders[k]) foundFeeders[k] = e.feeders[k]; });
                if (foundA && foundB && foundT && FEEDER_KEYS.every(k => foundFeeders[k])) break;
            }

            if (!stale) setResult({
                statusBoilerA: foundA,
                statusBoilerB: foundB,
                statusTurbin: foundT,
                statusFeeders: foundFeeders,
            });
        }

        fetch();
        return () => { stale = true; };
    }, [date, shift]);

    return result;
}

export interface BoilerShutdownInfo {
    boiler_a: { date: string; shift: ShiftType } | null;
    boiler_b: { date: string; shift: ShiftType } | null;
}

export function useBoilerShutdownHistory(date: string, shift: ShiftType): BoilerShutdownInfo {
    const [info, setInfo] = useState<BoilerShutdownInfo>({ boiler_a: null, boiler_b: null });

    useEffect(() => {
        if (!isSupabaseConfigured() || !date) { setInfo({ boiler_a: null, boiler_b: null }); return; }
        const supabase = createClient();
        let stale = false;
        const shiftOrder: Record<string, number> = { sore: 2, pagi: 1, malam: 0 };

        async function fetchHistory() {
            const { data } = await supabase
                .from('shift_reports')
                .select('date, shift, shift_boiler(boiler, status_boiler)')
                .lte('date', date)
                .order('date', { ascending: false })
                .limit(90);

            if (stale || !data) return;

            const sorted = (data as { date: string; shift: ShiftType; shift_boiler: { boiler: string; status_boiler: string | null }[] }[])
                .filter(r => !(r.date === date && shiftOrder[r.shift] >= shiftOrder[shift]))
                .sort((a, b) => {
                    if (a.date !== b.date) return b.date.localeCompare(a.date);
                    return (shiftOrder[b.shift] || 0) - (shiftOrder[a.shift] || 0);
                });

            const findStart = (boilerId: 'A' | 'B') => {
                let start: { date: string; shift: ShiftType } | null = null;
                for (const report of sorted) {
                    const boilerRow = report.shift_boiler?.find(b => b.boiler === boilerId);
                    if (!boilerRow) break;
                    if (boilerRow.status_boiler === 'shutdown') {
                        start = { date: report.date, shift: report.shift };
                    } else {
                        break;
                    }
                }
                return start;
            };

            if (!stale) setInfo({ boiler_a: findStart('A'), boiler_b: findStart('B') });
        }

        fetchHistory();
        return () => { stale = true; };
    }, [date, shift]);

    return info;
}

export interface ShiftReportData {
    id: string;
    date: string;
    shift: ShiftType;
    group_name: string;
    supervisor: string;
    status: ReportStatus;
    catatan: string | null;
    /** Catatan operasional per-station (panel_boiler/turbin), key = station id.
     *  Digabung dgn catatan utama jadi satu catatan shift saat publish. */
    station_catatan: Record<string, string> | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_by: string;
    shift_boiler: {
        boiler: 'A' | 'B';
        press_steam: number | null;
        temp_steam: number | null;
        flow_steam: number | null;
        totalizer_steam: number | null;
        flow_bfw: number | null;
        temp_bfw: number | null;
        totalizer_bfw: number | null;
        temp_furnace: number | null;
        temp_flue_gas: number | null;
        excess_air: number | null;
        air_heater_ti113: number | null;
        batubara_ton: number | null;
        solar_m3: number | null;
        stream_days: number | null;
        steam_drum_press: number | null;
        bfw_press: number | null;
    }[];
    shift_turbin: {
        flow_steam: number | null;
        flow_cond: number | null;
        press_steam: number | null;
        temp_steam: number | null;
        exh_steam: number | null;
        vacuum: number | null;
        hpo_durasi: number | null;
        thrust_bearing: number | null;
        metal_bearing: number | null;
        vibrasi: number | null;
        winding: number | null;
        axial_displacement: number | null;
        level_condenser: number | null;
        temp_cw_in: number | null;
        temp_cw_out: number | null;
        press_deaerator: number | null;
        temp_deaerator: number | null;
        press_lps: number | null;
        stream_days: number | null;
        totalizer_steam_inlet: number | null;
        totalizer_condensate: number | null;
    }[];
    shift_steam_dist: {
        pabrik1_flow: number | null;
        pabrik1_temp: number | null;
        pabrik2_flow: number | null;
        pabrik2_temp: number | null;
        pabrik3a_flow: number | null;
        pabrik3a_temp: number | null;
        pabrik3a_totalizer: number | null;
        pabrik1_totalizer: number | null;
        pabrik2_totalizer: number | null;
        pabrik3b_flow: number | null;
        pabrik3b_temp: number | null;
    }[];
    shift_generator_gi: {
        gen_load: number | null;
        gen_ampere: number | null;
        gen_amp_react: number | null;
        gen_cos_phi: number | null;
        gen_tegangan: number | null;
        gen_frequensi: number | null;
        gi_sum_p: number | null;
        gi_sum_q: number | null;
        gi_cos_phi: number | null;
    }[];
    shift_power_dist: {
        power_ubb: number | null;
        power_ubb_totalizer: number | null;
        power_pabrik2: number | null;
        power_pabrik2_totalizer: number | null;
        power_pabrik3a: number | null;
        power_pabrik3a_totalizer: number | null;
        power_revamping: number | null;
        power_revamping_totalizer: number | null;
        power_pie: number | null;
        power_pie_totalizer: number | null;
        power_pabrik3b: number | null;
        power_stg_ubb_totalizer: number | null;
    }[];
    shift_esp_handling: {
        esp_a1: number | null;
        esp_a2: number | null;
        esp_a3: number | null;
        esp_b1: number | null;
        esp_b2: number | null;
        esp_b3: number | null;
        silo_a: number | null;
        silo_b: number | null;
        unloading_a: string | null;
        unloading_b: number | null;
        loading: string | null;
        hopper: string | null;
        conveyor: string | null;
        pf1: number | null;
        pf2: number | null;
    }[];
    shift_tankyard: {
        tk_rcw: number | null;
        tk_demin: number | null;
        tk_solar_ab: number | null;
    }[];
    shift_personnel: {
        turbin_grup: string | null;
        turbin_karu: string | null;
        turbin_kasi: string | null;
        boiler_grup: string | null;
        boiler_karu: string | null;
        boiler_kasi: string | null;
    }[];
    shift_coal_bunker: {
        feeder_a: number | null;
        feeder_b: number | null;
        feeder_c: number | null;
        feeder_d: number | null;
        feeder_e: number | null;
        feeder_f: number | null;
        bunker_a: number | null;
        bunker_b: number | null;
        bunker_c: number | null;
        bunker_d: number | null;
        bunker_e: number | null;
        bunker_f: number | null;
        status_bunker_a: string | null;
        status_bunker_b: string | null;
        status_bunker_c: string | null;
        status_bunker_d: string | null;
        status_bunker_e: string | null;
        status_bunker_f: string | null;
    }[];
    shift_water_quality: {
        demin_1250_ph: number | null;
        demin_1250_conduct: number | null;
        demin_1250_th: number | null;
        demin_1250_sio2: number | null;
        demin_750_ph: number | null;
        demin_750_conduct: number | null;
        demin_750_th: number | null;
        demin_750_sio2: number | null;
        bfw_ph: number | null;
        bfw_conduct: number | null;
        bfw_th: number | null;
        bfw_sio2: number | null;
        bfw_nh4: number | null;
        bfw_chz: number | null;
        boiler_water_a_ph: number | null;
        boiler_water_a_conduct: number | null;
        boiler_water_a_sio2: number | null;
        boiler_water_a_po4: number | null;
        boiler_water_b_ph: number | null;
        boiler_water_b_conduct: number | null;
        boiler_water_b_sio2: number | null;
        boiler_water_b_po4: number | null;
        product_steam_ph: number | null;
        product_steam_conduct: number | null;
        product_steam_th: number | null;
        product_steam_sio2: number | null;
        product_steam_nh4: number | null;
        phosphate_level_tanki: number | null;
        phosphate_stroke_pompa: number | null;
        phosphate_penambahan_air: number | null;
        phosphate_penambahan_chemical: number | null;
        phosphate_b_level_tanki: number | null;
        phosphate_b_stroke_pompa: number | null;
        phosphate_b_penambahan_air: number | null;
        phosphate_b_penambahan_chemical: number | null;
        amine_level_tanki: number | null;
        amine_stroke_pompa: number | null;
        amine_penambahan_air: number | null;
        amine_penambahan_chemical: number | null;
        hydrazine_level_tanki: number | null;
        hydrazine_stroke_pompa: number | null;
        hydrazine_penambahan_air: number | null;
        hydrazine_penambahan_chemical: number | null;
        stock_phosphate: number | null;
        stock_amine: number | null;
        stock_hydrazine: number | null;
    }[];
    critical_equipment: {
        date: string;
        item: string;
        deskripsi: string;
        scope: string;
        foreman: string;
        status: string | null;
        reported_by: string | null;
    }[];
    maintenance_logs: {
        critical_id: string | null;
        date: string;
        item: string;
        uraian: string;
        scope: string;
        foreman: string;
        tipe: string;
        status: string;
        keterangan: string | null;
        notif: string | null;
        reported_by: string | null;
    }[];
    shift_notes: {
        content: string;
        timestamp: string;
    }[];
}

function isSupabaseConfigured(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return !!url && !url.includes('YOUR_PROJECT_ID');
}

export function useShiftReport(date: string, shift: ShiftType) {
    const [report, setReport] = useState<ShiftReportData | null>(null);
    const [activeMaintenance, setActiveMaintenance] = useState<import('@/lib/supabase/types').MaintenanceWithCritical[]>([]);
    const [openCriticals, setOpenCriticals] = useState<import('@/lib/supabase/types').CriticalEquipmentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchKey, setFetchKey] = useState(0);

    const refetch = useCallback(() => setFetchKey(k => k + 1), []);

    useEffect(() => {
        if (!isSupabaseConfigured()) {
            setLoading(false);
            return;
        }

        // Reset report saat date/shift berubah — kalau tidak, populate-from-report di
        // app/input-shift/page.tsx akan jalankan dengan data STALE dari shift sebelumnya
        // dan mengisi form state dengan nilai lama, membuat inherit useEffect ke-skip
        // (karena prev.status_boiler/turbin sudah terisi).
        setReport(null);

        let stale = false;
        const supabase = createClient();

        async function fetchReport() {
            console.log(`[useShiftReport] fetch starting: date=${date}, shift=${shift}`);
            setLoading(true);
            setError(null);

            // Hitung shift window untuk filter timestamp
            const { getShiftWindow } = await import('@/lib/constants');
            const win = getShiftWindow(date, shift as 'pagi' | 'sore' | 'malam');
            const winStart = win.start.toISOString();
            const winEnd = win.end.toISOString();

            // Filter timestamp-based: maintenance status IP/OK dengan updated_at di dalam window shift
            const [{ data, error: fetchError }, maintRes, critRes] = await Promise.all([
                supabase
                    .from('shift_reports')
                    .select(`
                        *,
                        shift_boiler(*),
                        shift_turbin(*),
                        shift_steam_dist(*),
                        shift_generator_gi(*),
                        shift_power_dist(*),
                        shift_esp_handling(*),
                        shift_tankyard(*),
                        shift_personnel(*),
                        shift_coal_bunker(*),
                        shift_water_quality(*),
                        critical_equipment(*),
                        maintenance_logs(*),
                        shift_notes(*)
                    `)
                    .eq('date', date)
                    .eq('shift', shift)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                supabase
                    .from('maintenance_logs')
                    .select('*, critical_equipment(item, deskripsi)')
                    .in('status', ['IP', 'OK'])
                    .gte('updated_at', winStart)
                    .lte('updated_at', winEnd)
                    .order('created_at', { ascending: true }),
                supabase
                    .from('critical_equipment')
                    .select('*')
                    .eq('status', 'OPEN')
                    .order('created_at', { ascending: true }),
            ]);

            if (stale) {
                console.log(`[useShiftReport] STALE fetch discarded: date=${date}, shift=${shift}`);
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setActiveMaintenance((maintRes.data ?? []) as any[]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setOpenCriticals((critRes.data ?? []) as any[]);

            if (fetchError) {
                setError(fetchError.message);
            } else if (data) {
                // PostgREST returns single objects for one-to-one relations (UNIQUE on FK)
                // but our types/consumers expect arrays. Normalize here.
                const oneToOneKeys = [
                    'shift_turbin', 'shift_steam_dist', 'shift_generator_gi',
                    'shift_power_dist', 'shift_esp_handling', 'shift_tankyard',
                    'shift_coal_bunker', 'shift_personnel', 'shift_water_quality',
                    'shift_notes',
                ] as const;
                for (const key of oneToOneKeys) {
                    const val = (data as Record<string, unknown>)[key];
                    if (val && !Array.isArray(val)) {
                        (data as Record<string, unknown>)[key] = [val];
                    }
                }
                console.log('[useShiftReport] fetch OK, child counts:', {
                    boiler: data.shift_boiler?.length,
                    turbin: (data as Record<string, unknown[]>).shift_turbin?.length,
                    steamDist: (data as Record<string, unknown[]>).shift_steam_dist?.length,
                    generatorGi: (data as Record<string, unknown[]>).shift_generator_gi?.length,
                    powerDist: (data as Record<string, unknown[]>).shift_power_dist?.length,
                    espHandling: (data as Record<string, unknown[]>).shift_esp_handling?.length,
                    tankyard: (data as Record<string, unknown[]>).shift_tankyard?.length,
                    coalBunker: (data as Record<string, unknown[]>).shift_coal_bunker?.length,
                });
                setReport(data as unknown as ShiftReportData);
            } else {
                console.log('[useShiftReport] fetch OK, no data found');
                setReport(null);
            }

            setLoading(false);
        }

        fetchReport();

        return () => { stale = true; };
    }, [date, shift, fetchKey]);

    // Valid DB columns per table (prevents unknown column errors)
    const VALID_COLS: Record<string, string[]> = {
        shift_boiler: ['press_steam','temp_steam','flow_steam','totalizer_steam','flow_bfw','temp_bfw','totalizer_bfw','bfw_press','temp_furnace','temp_flue_gas','excess_air','air_heater_ti113','batubara_ton','solar_m3','stream_days','steam_drum_press','primary_air','secondary_air','o2','feeder_a_flow','feeder_b_flow','feeder_c_flow','feeder_d_flow','feeder_e_flow','feeder_f_flow','status_boiler','selisih_steam','selisih_bfw'],
        shift_turbin: ['flow_steam','flow_cond','press_steam','temp_steam','exh_steam','vacuum','hpo_durasi','thrust_bearing','metal_bearing','vibrasi','winding','axial_displacement','level_condenser','temp_cw_in','temp_cw_out','press_deaerator','temp_deaerator','stream_days','totalizer_steam_inlet','totalizer_condensate','selisih_steam_inlet','selisih_condensate','status_turbin'],
        shift_steam_dist: ['pabrik1_flow','pabrik1_temp','pabrik1_totalizer','pabrik2_flow','pabrik2_temp','pabrik2_totalizer','pabrik3a_flow','pabrik3a_temp','pabrik3a_totalizer','pabrik3b_flow','pabrik3b_temp','press_lps','selisih_pabrik1','selisih_pabrik2','selisih_pabrik3a'],
        shift_generator_gi: ['gen_load','gen_ampere','gen_amp_react','gen_cos_phi','gen_tegangan','gen_frequensi','gi_sum_p','gi_sum_q','gi_cos_phi'],
        shift_power_dist: ['power_ubb','power_ubb_totalizer','power_pabrik2','power_pabrik2_totalizer','power_pabrik3a','power_pabrik3a_totalizer','power_revamping','power_revamping_totalizer','power_pie','power_pie_totalizer','power_pabrik3b','power_stg_ubb_totalizer','selisih_ubb','selisih_pabrik2','selisih_pabrik3a','selisih_revamping','selisih_pie','selisih_stg_ubb'],
        shift_esp_handling: ['esp_a1','esp_a2','esp_a3','esp_b1','esp_b2','esp_b3','silo_a','silo_b','unloading_a','unloading_b','loading','hopper','conveyor','pf1','pf2'],
        shift_tankyard: ['tk_rcw','tk_demin','tk_solar_ab'],
        shift_personnel: ['turbin_grup','turbin_karu','turbin_kasi','boiler_grup','boiler_karu','boiler_kasi'],
        shift_coal_bunker: ['feeder_a','feeder_b','feeder_c','feeder_d','feeder_e','feeder_f','bunker_a','bunker_b','bunker_c','bunker_d','bunker_e','bunker_f','status_bunker_a','status_bunker_b','status_bunker_c','status_bunker_d','status_bunker_e','status_bunker_f','status_feeder_a','status_feeder_b','status_feeder_c','status_feeder_d','status_feeder_e','status_feeder_f','selisih_feeder_a','selisih_feeder_b','selisih_feeder_c','selisih_feeder_d','selisih_feeder_e','selisih_feeder_f'],
        shift_water_quality: ['demin_1250_ph','demin_1250_conduct','demin_1250_th','demin_1250_sio2','demin_750_ph','demin_750_conduct','demin_750_th','demin_750_sio2','bfw_ph','bfw_conduct','bfw_th','bfw_sio2','bfw_nh4','bfw_chz','boiler_water_a_ph','boiler_water_a_conduct','boiler_water_a_sio2','boiler_water_a_po4','boiler_water_b_ph','boiler_water_b_conduct','boiler_water_b_sio2','boiler_water_b_po4','product_steam_ph','product_steam_conduct','product_steam_th','product_steam_sio2','product_steam_nh4','phosphate_level_tanki','phosphate_stroke_pompa','phosphate_penambahan_air','phosphate_penambahan_chemical','phosphate_b_level_tanki','phosphate_b_stroke_pompa','phosphate_b_penambahan_air','phosphate_b_penambahan_chemical','amine_level_tanki','amine_stroke_pompa','amine_penambahan_air','amine_penambahan_chemical','hydrazine_level_tanki','hydrazine_stroke_pompa','hydrazine_penambahan_air','hydrazine_penambahan_chemical','stock_phosphate','stock_amine','stock_hydrazine'],
    };

    // Filter object to only include valid DB columns
    function pickValidCols(table: string, data: Record<string, unknown>): Record<string, unknown> {
        const valid = new Set(VALID_COLS[table] || []);
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(data)) {
            if (valid.has(k) && v !== undefined) result[k] = v;
        }
        return result;
    }

    const submitReport = useCallback(async (reportData: {
        group_name: string;
        supervisor: string;
        created_by: string;
        catatan?: string | null;
        boilerA?: Record<string, number | string | null>;
        boilerB?: Record<string, number | string | null>;
        turbin?: Record<string, number | string | null>;
        steamDist?: Record<string, number | null>;
        generatorGi?: Record<string, number | null>;
        powerDist?: Record<string, number | null>;
        espHandling?: Record<string, number | string | null>;
        tankyard?: Record<string, number | null>;
        personnel?: Record<string, string | null>;
        coalBunker?: Record<string, number | string | null>;
        waterQuality?: Record<string, number | null>;
        /** Prev boiler totalizer steam untuk menghitung selisih di Google Sheets */
        prevBoilerA?: { totalizer_steam?: number | null };
        prevBoilerB?: { totalizer_steam?: number | null };
        /** Per-station filler — kalau diisi, di-merge ke station_fillers JSONB tanpa
         *  overwrite station lain. Dipakai saat operator submit dari station view. */
        station_filler?: { station: string; name: string };
        /** Per-station catatan operasional — di-merge ke station_catatan JSONB (race-proof
         *  via RPC) tanpa overwrite station lain. Saat publish digabung jadi satu catatan
         *  shift. Dipakai saat panel_boiler/panel_turbin submit dari station view. */
        station_catatan?: { station: string; catatan: string };
        /** Station scope. Kalau diisi:
         *  - parent shift_reports update tidak overwrite supervisor/catatan/group_name
         *  - hanya child tables yang owned station tsb yang ditulis
         *  - shared tables (shift_esp_handling) → partial column update
         *  Untuk submit non-station (foreman/supervisor/admin penuh), biarkan null. */
        station?: string | null;
    }) => {
        if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

        const supabase = createClient();
        const errors: string[] = [];

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validCreatedBy = reportData.created_by && UUID_REGEX.test(reportData.created_by) ? reportData.created_by : null;

        // ─── Station scope mapping ───
        // Tabel yang DI-OWNED penuh oleh tiap station (DELETE+INSERT seperti normal).
        // CATATAN: panel_boiler_a/b + bunker share shift_coal_bunker → di-handle via
        // STATION_PARTIAL_COLS (UPDATE per kolom, bukan DELETE+INSERT) supaya tidak
        // saling overwrite.
        const STATION_OWNS_TABLES: Record<string, string[]> = {
            // shift_personnel: station panel own subset kolom (grup/karu/kasi sisi
            // boiler ATAU turbin — lihat STATION_PARTIAL_COLS) supaya nama personnel
            // tetap tersimpan (DB + Sheets) saat submit dari station view.
            panel_boiler: ['shift_boiler', 'shift_coal_bunker', 'shift_personnel'],   // legacy: keduanya + full bunker
            panel_boiler_a: ['shift_boiler', 'shift_coal_bunker', 'shift_personnel'], // row A + partial cols A/B/C
            panel_boiler_b: ['shift_boiler', 'shift_coal_bunker', 'shift_personnel'], // row B + partial cols D/E/F
            panel_turbin: ['shift_turbin', 'shift_steam_dist', 'shift_generator_gi', 'shift_power_dist', 'shift_personnel'],
            // handling: kartu Loading (shift_esp_handling) + kartu Tankyard / Level Tank
            // (shift_tankyard). Tankyard di-edit di TabHandling, jadi station handling yang
            // owns shift_tankyard (sebelumnya keliru di lapangan_boiler → level tank tidak tersimpan).
            handling: ['shift_esp_handling', 'shift_tankyard'],
            esp: ['shift_esp_handling'],
            bunker: ['shift_coal_bunker'],                          // hanya bunker_* + status_bunker_*
            lapangan_boiler: ['shift_water_quality'],
            lapangan_turbin: [],
        };
        // Row-level filter untuk shift_boiler (multi-row by `boiler` column).
        const STATION_OWNS_BOILER_ROW: Record<string, ('A' | 'B')[]> = {
            panel_boiler: ['A', 'B'],
            panel_boiler_a: ['A'],
            panel_boiler_b: ['B'],
        };
        // Kolom yang dimiliki station di SHARED table (partial UPDATE — bukan DELETE+INSERT).
        // shift_coal_bunker dibagi 3 grup:
        //   - panel_boiler_a → feeder A/B/C (totalizer + status + selisih)
        //   - panel_boiler_b → feeder D/E/F
        //   - bunker         → bunker level A-F + status_bunker_*
        // panel_boiler (legacy full) tetap pakai DELETE+INSERT karena owns full table.
        const STATION_PARTIAL_COLS: Record<string, Record<string, string[]>> = {
            handling: { shift_esp_handling: ['hopper', 'conveyor', 'unloading_a', 'unloading_b', 'loading', 'pf1', 'pf2'] },
            esp:      { shift_esp_handling: ['esp_a1', 'esp_a2', 'esp_a3', 'esp_b1', 'esp_b2', 'esp_b3', 'silo_a', 'silo_b'] },
            panel_boiler: {
                shift_personnel: ['boiler_grup', 'boiler_karu', 'boiler_kasi'],
            },
            panel_boiler_a: {
                shift_coal_bunker: [
                    'feeder_a', 'feeder_b', 'feeder_c',
                    'status_feeder_a', 'status_feeder_b', 'status_feeder_c',
                    'selisih_feeder_a', 'selisih_feeder_b', 'selisih_feeder_c',
                ],
                shift_personnel: ['boiler_grup', 'boiler_karu', 'boiler_kasi'],
            },
            panel_boiler_b: {
                shift_coal_bunker: [
                    'feeder_d', 'feeder_e', 'feeder_f',
                    'status_feeder_d', 'status_feeder_e', 'status_feeder_f',
                    'selisih_feeder_d', 'selisih_feeder_e', 'selisih_feeder_f',
                ],
                shift_personnel: ['boiler_grup', 'boiler_karu', 'boiler_kasi'],
            },
            panel_turbin: {
                shift_personnel: ['turbin_grup', 'turbin_karu', 'turbin_kasi'],
            },
            bunker: {
                shift_coal_bunker: [
                    'bunker_a', 'bunker_b', 'bunker_c', 'bunker_d', 'bunker_e', 'bunker_f',
                    'status_bunker_a', 'status_bunker_b', 'status_bunker_c',
                    'status_bunker_d', 'status_bunker_e', 'status_bunker_f',
                ],
            },
        };

        // Station panel (boiler A/B + turbin) memiliki kolom `supervisor` → boleh menulisnya
        // walau station-scoped (operator panel wajib isi supervisor; dipakai notif siap-publish).
        const SUPERVISOR_OWNER_STATIONS = new Set(['panel_boiler', 'panel_boiler_a', 'panel_boiler_b', 'panel_turbin']);

        const stationKey = reportData.station ?? null;
        const isStationScoped = !!stationKey && stationKey in STATION_OWNS_TABLES;
        const ownedTables = isStationScoped ? (STATION_OWNS_TABLES[stationKey!] ?? []) : null;
        const partialColsMap = isStationScoped ? (STATION_PARTIAL_COLS[stationKey!] ?? {}) : {};

        const canWriteTable = (table: string): boolean => {
            if (!isStationScoped) return true;
            return ownedTables!.includes(table);
        };
        const getPartialCols = (table: string): string[] | null => {
            if (!isStationScoped) return null;
            return partialColsMap[table] ?? null;
        };

        // station_fillers TIDAK lagi di-merge client-side (race-prone). Setelah parent
        // row terjamin ada, kita panggil RPC `merge_shift_station_filler` yang melakukan
        // atomic JSONB merge di DB — race-proof walau N station submit bersamaan.

        // ─── Parent shift_reports: INSERT vs UPDATE eksplisit ───
        // Station-scope: pada UPDATE jangan overwrite supervisor/catatan/group_name.
        const { data: existingParent } = await supabase
            .from('shift_reports')
            .select('id')
            .eq('date', date)
            .eq('shift', shift)
            .maybeSingle();

        let sr: { id: string } | null = null;
        let srError: { message: string } | null = null;

        if (existingParent) {
            const updatePayload: Record<string, unknown> = {};
            if (!isStationScoped) {
                updatePayload.group_name = reportData.group_name;
                updatePayload.supervisor = reportData.supervisor;
                // ANTI-WIPE: catatan hanya di-overwrite kalau payload berisi. Form penuh yang
                // di-save saat state catatan masih kosong (report belum termuat / halaman baru)
                // JANGAN menimpa catatan lama jadi null — insiden 10 Jun 2026: catatan pagi
                // (2 baris fly ash) terhapus oleh re-save 14:16 setelah publish. Konsekuensi:
                // mengosongkan catatan total via save tidak bisa; edit isinya kalau perlu.
                if (reportData.catatan != null && reportData.catatan.trim() !== '') {
                    updatePayload.catatan = reportData.catatan;
                }
            } else if (stationKey && SUPERVISOR_OWNER_STATIONS.has(stationKey) && reportData.supervisor) {
                // Panel station: tulis supervisor tanpa overwrite kolom lain.
                updatePayload.supervisor = reportData.supervisor;
            }
            // station_fillers di-handle via RPC setelah parent confirmed (lihat di bawah).
            if (validCreatedBy && !isStationScoped) updatePayload.created_by = validCreatedBy;

            if (Object.keys(updatePayload).length > 0) {
                const r = await supabase
                    .from('shift_reports')
                    .update(updatePayload)
                    .eq('id', (existingParent as { id: string }).id)
                    .select('id')
                    .single();
                sr = r.data as { id: string } | null;
                srError = r.error;
            } else {
                sr = existingParent as { id: string };
            }
        } else {
            // Supervisor hanya boleh ditetapkan oleh form penuh / station panel — station
            // non-panel JANGAN set supervisor (hindari "kotor" dgn nama operator → jaga 1
            // supervisor konsisten per laporan).
            const canSetSupervisor = !isStationScoped || (stationKey != null && SUPERVISOR_OWNER_STATIONS.has(stationKey));
            const insertPayload: Record<string, unknown> = {
                date,
                shift,
                group_name: reportData.group_name,
                supervisor: canSetSupervisor ? reportData.supervisor : '',
                status: 'draft' as ReportStatus,
                catatan: isStationScoped ? null : (reportData.catatan || null),
                ...(validCreatedBy ? { created_by: validCreatedBy } : {}),
                // station_fillers di-handle via RPC setelah parent confirmed.
                // Default kolom '{}'::jsonb dari DDL — aman tanpa di-explicit-set.
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = await supabase.from('shift_reports').insert(insertPayload as any).select('id').single();
            sr = r.data as { id: string } | null;
            srError = r.error;
            // Race: station lain mungkin barusan insert untuk (date,shift) yang sama → unique violation.
            // Re-fetch + lakukan UPDATE path (tanpa overwrite supervisor/catatan kalau station-scoped).
            if (srError && (srError as { code?: string }).code === '23505') {
                const { data: nowExisting } = await supabase
                    .from('shift_reports')
                    .select('id')
                    .eq('date', date)
                    .eq('shift', shift)
                    .maybeSingle();
                if (nowExisting) {
                    const updatePayload: Record<string, unknown> = {};
                    if (!isStationScoped) {
                        updatePayload.group_name = reportData.group_name;
                        updatePayload.supervisor = reportData.supervisor;
                        updatePayload.catatan = reportData.catatan || null;
                    }
                    // station_fillers via RPC setelah parent confirmed.
                    if (Object.keys(updatePayload).length > 0) {
                        const r2 = await supabase
                            .from('shift_reports')
                            .update(updatePayload)
                            .eq('id', (nowExisting as { id: string }).id)
                            .select('id')
                            .single();
                        sr = r2.data as { id: string } | null;
                        srError = r2.error;
                    } else {
                        sr = nowExisting as { id: string };
                        srError = null;
                    }
                }
            }
        }

        if (srError || !sr) return { error: srError?.message || 'Failed to create report' };

        // ─── Atomic merge station_fillers via RPC (race-proof) ───
        // Sekarang reportId sudah pasti ada. Panggil RPC kalau ada station_filler diisi.
        if (reportData.station_filler && sr?.id) {
            const { error: rpcErr } = await supabase.rpc('merge_shift_station_filler', {
                p_report_id: sr.id,
                p_station: reportData.station_filler.station,
                p_name: reportData.station_filler.name,
            });
            if (rpcErr) {
                console.warn('[submitReport] merge_shift_station_filler RPC failed:', rpcErr.message);
                // Non-fatal: data operasional tetap tersimpan, hanya audit name yang miss.
            }
        }

        // ─── Atomic merge station_catatan via RPC (race-proof) ───
        // Catatan operasional per-station (panel_boiler/turbin) di-merge ke JSONB tanpa
        // overwrite station lain. Digabung jadi satu catatan shift saat publish.
        // ANTI-WIPE: teks kosong tidak di-merge — re-save station saat state catatan belum
        // termuat jangan menghapus catatan station yang sudah tersimpan (mirror guard parent).
        if (reportData.station_catatan && reportData.station_catatan.catatan.trim() !== '' && sr?.id) {
            const { error: rpcErr } = await supabase.rpc('merge_shift_station_catatan', {
                p_report_id: sr.id,
                p_station: reportData.station_catatan.station,
                p_catatan: reportData.station_catatan.catatan,
            });
            if (rpcErr) {
                console.warn('[submitReport] merge_shift_station_catatan RPC failed:', rpcErr.message);
                // Non-fatal: data operasional tetap tersimpan, hanya catatan station yang miss.
            }
        }

        const reportId = (sr as Record<string, unknown>).id as string;
        console.log('[submitReport] reportId:', reportId);

        // Helper: save child table (MERGE — update kolom yang dikirim saja).
        // PENTING: jangan DELETE+INSERT. Field yang tidak ada di payload (undefined →
        // tersaring di pickValidCols) TIDAK boleh menimpa nilai lama. Kasus nyata:
        // operator buka ulang link station turbin di akhir shift, langsung ketik
        // totalizer sebelum data lama termuat (userModifiedRef memblok populate) →
        // payload cuma berisi totalizer+status → DELETE+INSERT meng-wipe semua
        // parameter lain (insiden 05–07 Jun 2026, shift sore). Dengan UPDATE per
        // kolom, simpan sparse aman; clearing field yang disengaja tetap jalan
        // karena key-nya ada di payload dengan nilai null (bukan undefined).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async function saveChild(table: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) {
            const filtered = pickValidCols(table, data);
            if (Object.keys(filtered).length === 0) {
                console.log(`[submitReport] skip "${table}": no valid columns`);
                return;
            }

            // Cari row existing (tanpa maybeSingle — legacy DELETE+INSERT bisa
            // meninggalkan duplikat saat race; kalau ada, keep satu, hapus sisanya).
            const { data: existingRows, error: selErr } = await supabase
                .from(table)
                .select('id')
                .eq('shift_report_id', reportId);
            if (selErr) {
                console.error(`[submitReport] SELECT "${table}" error:`, selErr.message);
                errors.push(`${table}: select failed - ${selErr.message}`);
                return;
            }

            if (existingRows && existingRows.length > 0) {
                const keepId = (existingRows[0] as { id: string }).id;
                if (existingRows.length > 1) {
                    await supabase.from(table).delete()
                        .eq('shift_report_id', reportId).neq('id', keepId);
                }
                console.log(`[submitReport] UPDATE "${table}":`, Object.keys(filtered));
                const { error: updErr } = await supabase
                    .from(table)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .update({ ...extra, ...filtered } as any)
                    .eq('id', keepId);
                if (updErr) {
                    console.error(`[submitReport] UPDATE "${table}" error:`, updErr.message);
                    errors.push(`${table}: ${updErr.message}`);
                } else {
                    console.log(`[submitReport] "${table}" updated OK, id=${keepId}`);
                }
                return;
            }

            // Belum ada row → insert baru.
            const payload = { shift_report_id: reportId, ...extra, ...filtered };
            console.log(`[submitReport] INSERT "${table}":`, Object.keys(filtered));
            const { data: inserted, error: insErr } = await supabase
                .from(table)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .insert(payload as any)
                .select();
            if (insErr) {
                // Race: station/tab lain barusan insert → unique violation. Re-fetch + update.
                const { data: raced } = await supabase
                    .from(table).select('id').eq('shift_report_id', reportId);
                if (raced && raced.length > 0) {
                    const { error: updErr } = await supabase
                        .from(table)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .update({ ...extra, ...filtered } as any)
                        .eq('id', (raced[0] as { id: string }).id);
                    if (updErr) {
                        console.error(`[submitReport] race UPDATE "${table}" error:`, updErr.message);
                        errors.push(`${table}: ${updErr.message}`);
                    }
                    return;
                }
                console.error(`[submitReport] INSERT "${table}" error:`, insErr.message);
                errors.push(`${table}: ${insErr.message}`);
            } else {
                console.log(`[submitReport] "${table}" saved OK, id=${(inserted as Record<string, unknown>[])?.[0]?.id}`);
            }
        }

        // Partial column update untuk shared table (delete dilewati, hanya update kolom owned).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async function savePartialChild(table: string, data: Record<string, unknown>, allowedCols: string[]) {
            const filtered = pickValidCols(table, data);
            const subset: Record<string, unknown> = {};
            for (const k of allowedCols) {
                if (k in filtered) subset[k] = filtered[k];
            }
            if (Object.keys(subset).length === 0) {
                console.log(`[submitReport] skip "${table}" partial: no owned columns provided`);
                return;
            }
            const { data: existing } = await supabase
                .from(table)
                .select('id')
                .eq('shift_report_id', reportId)
                .maybeSingle();
            if (existing) {
                const { error: updErr } = await supabase
                    .from(table)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .update(subset as any)
                    .eq('id', (existing as { id: string }).id);
                if (updErr) {
                    console.error(`[submitReport] partial UPDATE "${table}" error:`, updErr.message);
                    errors.push(`${table}: ${updErr.message}`);
                } else {
                    console.log(`[submitReport] partial UPDATE "${table}" OK:`, Object.keys(subset));
                }
            } else {
                const payload = { shift_report_id: reportId, ...subset };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error: insErr } = await supabase.from(table).insert(payload as any);
                if (insErr) {
                    console.error(`[submitReport] partial INSERT "${table}" error:`, insErr.message);
                    errors.push(`${table}: ${insErr.message}`);
                } else {
                    console.log(`[submitReport] partial INSERT "${table}" OK:`, Object.keys(subset));
                }
            }
        }

        // Save boiler A & B (delete by boiler id, then insert)
        if (canWriteTable('shift_boiler')) {
            // Filter row level — panel_boiler_a hanya tulis row A, panel_boiler_b hanya row B.
            const allowedBoilers: ('A' | 'B')[] = isStationScoped
                ? (STATION_OWNS_BOILER_ROW[stationKey!] ?? ['A', 'B'])
                : ['A', 'B'];
            for (const [boilerId, boilerData] of [['A', reportData.boilerA], ['B', reportData.boilerB]] as [('A' | 'B'), Record<string, number | string | null> | undefined][]) {
                if (!allowedBoilers.includes(boilerId)) continue;
                if (boilerData && Object.keys(boilerData).length > 0) {
                    const filtered = pickValidCols('shift_boiler', boilerData as Record<string, unknown>);
                    if (Object.keys(filtered).length > 0) {
                        // MERGE seperti saveChild — jangan DELETE+INSERT supaya simpan
                        // sparse (form belum termuat penuh) tidak menghapus field lain.
                        const { data: exRows } = await supabase.from('shift_boiler').select('id')
                            .eq('shift_report_id', reportId).eq('boiler', boilerId);
                        if (exRows && exRows.length > 0) {
                            const keepId = (exRows[0] as { id: string }).id;
                            if (exRows.length > 1) {
                                await supabase.from('shift_boiler').delete()
                                    .eq('shift_report_id', reportId).eq('boiler', boilerId).neq('id', keepId);
                            }
                            const { error: bErr } = await supabase.from('shift_boiler')
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .update(filtered as any).eq('id', keepId);
                            if (bErr) {
                                console.error(`[submitReport] UPDATE shift_boiler ${boilerId} error:`, bErr.message);
                                errors.push(`shift_boiler_${boilerId}: ${bErr.message}`);
                            } else {
                                console.log(`[submitReport] shift_boiler ${boilerId} updated OK, id=${keepId}`);
                            }
                        } else {
                            const { data: ins, error: bErr } = await supabase.from('shift_boiler')
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .insert({ shift_report_id: reportId, boiler: boilerId, ...filtered } as any)
                                .select();
                            if (bErr) {
                                console.error(`[submitReport] INSERT shift_boiler ${boilerId} error:`, bErr.message);
                                errors.push(`shift_boiler_${boilerId}: ${bErr.message}`);
                            } else {
                                console.log(`[submitReport] shift_boiler ${boilerId} saved OK, id=${(ins as Record<string, unknown>[])?.[0]?.id}`);
                            }
                        }
                    }
                }
            }
        }

        // Save all other child tables (gated by station scope)
        if (canWriteTable('shift_turbin') && reportData.turbin && Object.keys(reportData.turbin).length > 0) {
            await saveChild('shift_turbin', reportData.turbin);
        }
        if (canWriteTable('shift_steam_dist') && reportData.steamDist && Object.keys(reportData.steamDist).length > 0) {
            await saveChild('shift_steam_dist', reportData.steamDist);
        }
        if (canWriteTable('shift_generator_gi') && reportData.generatorGi && Object.keys(reportData.generatorGi).length > 0) {
            await saveChild('shift_generator_gi', reportData.generatorGi);
        }
        if (canWriteTable('shift_power_dist') && reportData.powerDist && Object.keys(reportData.powerDist).length > 0) {
            await saveChild('shift_power_dist', reportData.powerDist);
        }
        if (canWriteTable('shift_esp_handling') && reportData.espHandling && Object.keys(reportData.espHandling).length > 0) {
            const partial = getPartialCols('shift_esp_handling');
            if (partial) {
                // handling/esp station → partial column update (jangan overwrite kolom milik station lain).
                await savePartialChild('shift_esp_handling', reportData.espHandling as Record<string, unknown>, partial);
            } else {
                await saveChild('shift_esp_handling', reportData.espHandling as Record<string, unknown>);
            }
        }
        if (canWriteTable('shift_tankyard') && reportData.tankyard && Object.keys(reportData.tankyard).length > 0) {
            await saveChild('shift_tankyard', reportData.tankyard);

            // Sync tankyard data to tank_levels for real-time monitoring
            const ty = reportData.tankyard;
            const tankMappings: { tank_id: string; value: number | null; capacity_m3: number }[] = [
                { tank_id: 'DEMIN', value: ty.tk_demin ?? null, capacity_m3: 1250 },
                { tank_id: 'RCW', value: ty.tk_rcw ?? null, capacity_m3: 5000 },
                { tank_id: 'SOLAR', value: ty.tk_solar_ab ?? null, capacity_m3: 200 },
            ];
            for (const { tank_id, value, capacity_m3 } of tankMappings) {
                if (value != null) {
                    const level_m3 = Number(value);
                    const level_pct = Math.min(100, Math.max(0, (level_m3 / capacity_m3) * 100));
                    await supabase.from('tank_levels').insert({
                        tank_id,
                        level_pct,
                        level_m3,
                        operator_name: 'Laporan Shift',
                        note: null,
                    } as Record<string, unknown>);
                }
            }
        }
        // shift_personnel = data grup/foreman/supervisor. Form penuh menulis semua kolom;
        // station panel menulis subset miliknya saja (turbin_* utk panel_turbin,
        // boiler_* utk panel_boiler*) via partial UPDATE — tidak saling overwrite.
        if (canWriteTable('shift_personnel') && reportData.personnel && Object.keys(reportData.personnel).length > 0) {
            const partial = getPartialCols('shift_personnel');
            if (partial) {
                await savePartialChild('shift_personnel', reportData.personnel as Record<string, unknown>, partial);
            } else {
                await saveChild('shift_personnel', reportData.personnel as Record<string, unknown>);
            }
        }
        if (canWriteTable('shift_coal_bunker') && reportData.coalBunker && Object.keys(reportData.coalBunker).length > 0) {
            const partial = getPartialCols('shift_coal_bunker');
            if (partial) {
                // panel_boiler_a/b + bunker share shift_coal_bunker → partial column update
                // (mereka tulis kolom berbeda: feeder A/B/C, feeder D/E/F, level + status).
                await savePartialChild('shift_coal_bunker', reportData.coalBunker as Record<string, unknown>, partial);
            } else {
                await saveChild('shift_coal_bunker', reportData.coalBunker as Record<string, unknown>);
            }
        }
        if (canWriteTable('shift_water_quality') && reportData.waterQuality && Object.keys(reportData.waterQuality).length > 0) {
            await saveChild('shift_water_quality', reportData.waterQuality);
        }

        // Verification: query back to confirm all child data was written
        const { data: verify } = await supabase
            .from('shift_reports')
            .select('id, shift_boiler(id), shift_turbin(id), shift_steam_dist(id), shift_generator_gi(id), shift_power_dist(id), shift_esp_handling(id), shift_tankyard(id), shift_coal_bunker(id)')
            .eq('id', reportId)
            .single();
        console.log('[submitReport] VERIFY after save:', JSON.stringify(verify));

        console.log('[submitReport] all saves done, errors:', errors);

        // Sync ke Google Sheets — DITUNGGU agar kita tahu pasti apakah benar tersimpan.
        // Supabase tetap source of truth: kalau Sheets gagal (setelah retry server-side),
        // kita kembalikan sheetsWarning supaya UI bisa kasih tahu user untuk simpan ulang.
        //
        // PENTING: payload Sheets HARUS di-scope sama seperti tulis DB. Tanpa scoping,
        // station yang tidak memiliki sebuah section tetap mengirim state form-nya
        // (kosong/derived) dan menimpa sel hasil station pemilik. Insiden nyata:
        // station non-boiler submit → batubara_ton dihitung 0−prev = −46191 dan bocor
        // ke kolom CE/CF (malam 10 Jun 2026). Sel null dilewati update Sheets, jadi
        // section yang di-undefined-kan di sini otomatis preserve nilai lama.
        const scopeSection = <T,>(table: string, value: T): T | undefined =>
            canWriteTable(table) ? value : undefined;
        // Tabel shared (partial cols): kirim hanya kolom yang owned station ini.
        const scopePartial = (table: string, value: Record<string, unknown> | undefined) => {
            if (!canWriteTable(table) || !value) return undefined;
            const partial = getPartialCols(table);
            if (!partial) return value;
            const subset: Record<string, unknown> = {};
            for (const k of partial) if (k in value) subset[k] = value[k];
            return Object.keys(subset).length > 0 ? subset : undefined;
        };
        const allowedBoilersSheets: ('A' | 'B')[] = isStationScoped
            ? (STATION_OWNS_BOILER_ROW[stationKey!] ?? ['A', 'B'])
            : ['A', 'B'];
        const sheetsBoilerA = canWriteTable('shift_boiler') && allowedBoilersSheets.includes('A') ? reportData.boilerA : undefined;
        const sheetsBoilerB = canWriteTable('shift_boiler') && allowedBoilersSheets.includes('B') ? reportData.boilerB : undefined;
        let sheetsWarning: string | undefined;
        try {
            const res = await fetch('/api/sheets/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'shift_report',
                    data: {
                        shift,
                        date,
                        group_name: reportData.group_name,
                        turbin: scopeSection('shift_turbin', reportData.turbin),
                        steamDist: scopeSection('shift_steam_dist', reportData.steamDist),
                        generatorGi: scopeSection('shift_generator_gi', reportData.generatorGi),
                        powerDist: scopeSection('shift_power_dist', reportData.powerDist),
                        espHandling: scopePartial('shift_esp_handling', reportData.espHandling as Record<string, unknown> | undefined),
                        tankyard: scopeSection('shift_tankyard', reportData.tankyard),
                        // Personnel (grup/foreman/kasi): station panel kirim subset kolom miliknya
                        // (turbin_* vs boiler_*) — sama dgn DB. Mapper menulis sel boiler dari
                        // boiler_* dgn fallback turbin_*, jadi grup+karu+kasi tetap masuk Sheets
                        // walau submit dari station view.
                        personnel: scopePartial('shift_personnel', reportData.personnel as Record<string, unknown> | undefined),
                        boilerA: sheetsBoilerA,
                        boilerB: sheetsBoilerB,
                        coalBunker: scopePartial('shift_coal_bunker', reportData.coalBunker as Record<string, unknown> | undefined),
                        waterQuality: scopeSection('shift_water_quality', reportData.waterQuality),
                        prevBoilerA: reportData.prevBoilerA,
                        prevBoilerB: reportData.prevBoilerB,
                    },
                }),
            });
            if (!res.ok) {
                sheetsWarning = `Google Sheets HTTP ${res.status}`;
                console.warn('[submitReport] Sheets sync HTTP error:', res.status);
            } else {
                const result = await res.json();
                if (result.warning) {
                    sheetsWarning = result.warning;
                    console.warn('[submitReport] Sheets warning:', result.warning);
                } else {
                    console.log('[submitReport] Sheets sync OK:', result);
                }
            }
        } catch (sheetsErr) {
            sheetsWarning = sheetsErr instanceof Error ? sheetsErr.message : String(sheetsErr);
            console.warn('[submitReport] Sheets sync failed:', sheetsErr);
        }

        // Sync Catatan Operasional ke spreadsheet catatan — fire-and-forget.
        // Server re-fetch dari DB (sudah termasuk merge station_catatan via RPC di
        // atas), hitung catatan kanonik, dan upsert kolom D dgn blok penanda
        // <Web Laporan UBB>. Dipanggil tiap submit (bukan hanya saat field catatan
        // terisi) karena auto-lines solar/ash/bunker bisa bikin catatan non-kosong;
        // server skip kalau kosong + anti-wipe. Gagal tidak memblok save.
        fetch('/api/sheets/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'catatan_operasional', data: { date, shift } }),
        }).catch(err => console.warn('[submitReport] catatan_operasional sync failed:', err));

        if (errors.length > 0) {
            console.error('Child table errors:', errors);
            return { error: errors.join('; '), reportId, sheetsWarning };
        }

        return { error: null, reportId, sheetsWarning };
    }, [date, shift]);

    /**
     * Ensure shift_report exists (create draft if missing) and assign maintenance_logs to it.
     * Idempotent: existing assignments are kept (UNIQUE constraint).
     */
    const assignMaintenanceToShift = useCallback(async (
        maintenanceIds: string[],
        actor?: string,
    ): Promise<{ error: string | null; reportId?: string }> => {
        if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };
        if (maintenanceIds.length === 0) return { error: null };

        const supabase = createClient();

        // Resolve or create shift_report row for (date, shift)
        let reportId: string | null = null;
        const { data: existing } = await supabase
            .from('shift_reports')
            .select('id')
            .eq('date', date)
            .eq('shift', shift)
            .maybeSingle();

        if (existing && (existing as Record<string, unknown>).id) {
            reportId = (existing as Record<string, unknown>).id as string;
        } else {
            const { data: created, error: cErr } = await supabase
                .from('shift_reports')
                .insert({
                    date,
                    shift,
                    group_name: '',
                    supervisor: '',
                    status: 'draft' as ReportStatus,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any)
                .select('id')
                .single();
            if (cErr || !created) return { error: cErr?.message || 'Failed to create shift report' };
            reportId = (created as Record<string, unknown>).id as string;
        }

        const rows = maintenanceIds.map(mid => ({
            maintenance_id: mid,
            shift_report_id: reportId!,
            assigned_by: actor || null,
        }));

        const { error: insErr } = await supabase
            .from('maintenance_shift_assignments')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .upsert(rows as any, { onConflict: 'maintenance_id,shift_report_id', ignoreDuplicates: true });

        if (insErr) return { error: insErr.message, reportId };
        refetch();
        return { error: null, reportId };
    }, [date, shift, refetch]);

    /** Remove a single maintenance from a shift report's assignment list. */
    const unassignMaintenanceFromShift = useCallback(async (
        maintenanceId: string,
        shiftReportId: string,
    ): Promise<{ error: string | null }> => {
        if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };
        const supabase = createClient();
        const { error: delErr } = await supabase
            .from('maintenance_shift_assignments')
            .delete()
            .eq('maintenance_id', maintenanceId)
            .eq('shift_report_id', shiftReportId);
        if (delErr) return { error: delErr.message };
        refetch();
        return { error: null };
    }, [refetch]);

    return { report, activeMaintenance, openCriticals, loading, error, submitReport, refetch, assignMaintenanceToShift, unassignMaintenanceFromShift };
}
