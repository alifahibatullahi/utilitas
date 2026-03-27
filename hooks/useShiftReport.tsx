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
    const [prevBoilerA, setPrevBoilerA] = useState<Record<string, number | null>>({});
    const [prevBoilerB, setPrevBoilerB] = useState<Record<string, number | null>>({});
    const [prevCoalBunker, setPrevCoalBunker] = useState<Record<string, number | null>>({});
    const [prevTurbin, setPrevTurbin] = useState<Record<string, number | null>>({});
    const [prevSteamDist, setPrevSteamDist] = useState<Record<string, number | null>>({});

    const { prevDate, prevShift } = useMemo(() => getPreviousShift(date, shift), [date, shift]);

    useEffect(() => {
        if (!isSupabaseConfigured() || !date) {
            setPrevBoilerA({});
            setPrevBoilerB({});
            setPrevCoalBunker({});
            setPrevTurbin({});
            setPrevSteamDist({});
            return;
        }

        const supabase = createClient();
        let stale = false;

        async function fetchPrev() {
            const { data } = await supabase
                .from('shift_reports')
                .select('shift_boiler(boiler, totalizer_steam, totalizer_bfw), shift_coal_bunker(feeder_a, feeder_b, feeder_c, feeder_d, feeder_e, feeder_f), shift_turbin(totalizer_steam_inlet, totalizer_condensate), shift_steam_dist(pabrik1_totalizer, pabrik2_totalizer, pabrik3a_totalizer)')
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
                    setPrevBoilerA(a ? { totalizer_steam: a.totalizer_steam, totalizer_bfw: a.totalizer_bfw } : {});
                    setPrevBoilerB(b ? { totalizer_steam: b.totalizer_steam, totalizer_bfw: b.totalizer_bfw } : {});
                } else {
                    setPrevBoilerA({});
                    setPrevBoilerB({});
                }

                const cb = Array.isArray(coal) ? coal[0] : coal;
                if (cb) {
                    setPrevCoalBunker({
                        feeder_a: cb.feeder_a, feeder_b: cb.feeder_b, feeder_c: cb.feeder_c,
                        feeder_d: cb.feeder_d, feeder_e: cb.feeder_e, feeder_f: cb.feeder_f,
                    });
                } else {
                    setPrevCoalBunker({});
                }

                const tb = Array.isArray(turbin) ? turbin[0] : turbin;
                if (tb) {
                    setPrevTurbin({
                        totalizer_steam_inlet: tb.totalizer_steam_inlet,
                        totalizer_condensate: tb.totalizer_condensate,
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
            } else {
                setPrevBoilerA({});
                setPrevBoilerB({});
                setPrevCoalBunker({});
                setPrevTurbin({});
                setPrevSteamDist({});
            }
        }

        fetchPrev();
        return () => { stale = true; };
    }, [prevDate, prevShift, date]);

    return { prevBoilerA, prevBoilerB, prevCoalBunker, prevTurbin, prevSteamDist };
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

export interface ShiftReportData {
    id: string;
    date: string;
    shift: ShiftType;
    group_name: string;
    supervisor: string;
    status: ReportStatus;
    catatan: string | null;
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
        power_pabrik2: number | null;
        power_pabrik3a: number | null;
        power_pie: number | null;
        power_pabrik3b: number | null;
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
    }[];
    critical_equipment: {
        date: string;
        item: string;
        scope: string;
        status: string | null;
    }[];
    maintenance_logs: {
        item: string;
        uraian: string;
        scope: string;
        keterangan: string | null;
        status: string;
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchKey, setFetchKey] = useState(0);

    const refetch = useCallback(() => setFetchKey(k => k + 1), []);

    useEffect(() => {
        if (!isSupabaseConfigured()) {
            setLoading(false);
            return;
        }

        let stale = false;
        const supabase = createClient();

        async function fetchReport() {
            console.log(`[useShiftReport] fetch starting: date=${date}, shift=${shift}`);
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
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
                .maybeSingle();

            if (stale) {
                console.log(`[useShiftReport] STALE fetch discarded: date=${date}, shift=${shift}`);
                return;
            }

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
        shift_boiler: ['press_steam','temp_steam','flow_steam','totalizer_steam','flow_bfw','temp_bfw','totalizer_bfw','bfw_press','temp_furnace','temp_flue_gas','excess_air','air_heater_ti113','batubara_ton','solar_m3','stream_days','steam_drum_press','primary_air','secondary_air','o2','feeder_a_flow','feeder_b_flow','feeder_c_flow','feeder_d_flow','feeder_e_flow','feeder_f_flow'],
        shift_turbin: ['flow_steam','flow_cond','press_steam','temp_steam','exh_steam','vacuum','hpo_durasi','thrust_bearing','metal_bearing','vibrasi','winding','axial_displacement','level_condenser','temp_cw_in','temp_cw_out','press_deaerator','temp_deaerator','press_lps','stream_days','totalizer_steam_inlet','totalizer_condensate'],
        shift_steam_dist: ['pabrik1_flow','pabrik1_temp','pabrik1_totalizer','pabrik2_flow','pabrik2_temp','pabrik2_totalizer','pabrik3a_flow','pabrik3a_temp','pabrik3a_totalizer','pabrik3b_flow','pabrik3b_temp'],
        shift_generator_gi: ['gen_load','gen_ampere','gen_amp_react','gen_cos_phi','gen_tegangan','gen_frequensi','gi_sum_p','gi_sum_q','gi_cos_phi'],
        shift_power_dist: ['power_ubb','power_pabrik2','power_pabrik3a','power_pie','power_pabrik3b'],
        shift_esp_handling: ['esp_a1','esp_a2','esp_a3','esp_b1','esp_b2','esp_b3','silo_a','silo_b','unloading_a','unloading_b','loading','hopper','conveyor','pf1','pf2'],
        shift_tankyard: ['tk_rcw','tk_demin','tk_solar_ab'],
        shift_personnel: ['turbin_grup','turbin_karu','turbin_kasi','boiler_grup','boiler_karu','boiler_kasi'],
        shift_coal_bunker: ['feeder_a','feeder_b','feeder_c','feeder_d','feeder_e','feeder_f','bunker_a','bunker_b','bunker_c','bunker_d','bunker_e','bunker_f','status_bunker_a','status_bunker_b','status_bunker_c','status_bunker_d','status_bunker_e','status_bunker_f'],
        shift_water_quality: ['demin_1250_ph','demin_1250_conduct','demin_1250_th','demin_1250_sio2','demin_750_ph','demin_750_conduct','demin_750_th','demin_750_sio2','bfw_ph','bfw_conduct','bfw_th','bfw_sio2','bfw_nh4','bfw_chz','boiler_water_a_ph','boiler_water_a_conduct','boiler_water_a_sio2','boiler_water_a_po4','boiler_water_b_ph','boiler_water_b_conduct','boiler_water_b_sio2','boiler_water_b_po4','product_steam_ph','product_steam_conduct','product_steam_th','product_steam_sio2','product_steam_nh4','phosphate_level_tanki','phosphate_stroke_pompa','phosphate_penambahan_air','phosphate_penambahan_chemical','phosphate_b_level_tanki','phosphate_b_stroke_pompa','phosphate_b_penambahan_air','phosphate_b_penambahan_chemical','amine_level_tanki','amine_stroke_pompa','amine_penambahan_air','amine_penambahan_chemical','hydrazine_level_tanki','hydrazine_stroke_pompa','hydrazine_penambahan_air','hydrazine_penambahan_chemical'],
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
        catatan?: string;
        boilerA?: Record<string, number | null>;
        boilerB?: Record<string, number | null>;
        turbin?: Record<string, number | null>;
        steamDist?: Record<string, number | null>;
        generatorGi?: Record<string, number | null>;
        powerDist?: Record<string, number | null>;
        espHandling?: Record<string, number | string | null>;
        tankyard?: Record<string, number | null>;
        personnel?: Record<string, string | null>;
        coalBunker?: Record<string, number | string | null>;
        waterQuality?: Record<string, number | null>;
    }) => {
        if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

        const supabase = createClient();
        const errors: string[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sr, error: srError } = await supabase
            .from('shift_reports')
            .upsert({
                date,
                shift,
                group_name: reportData.group_name,
                supervisor: reportData.supervisor,
                status: 'draft' as ReportStatus,
                catatan: reportData.catatan || null,
                ...(reportData.created_by ? { created_by: reportData.created_by } : {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any, { onConflict: 'date,shift,group_name' })
            .select()
            .single();

        if (srError || !sr) return { error: srError?.message || 'Failed to create report' };

        const reportId = (sr as Record<string, unknown>).id as string;
        console.log('[submitReport] reportId:', reportId);

        // Helper: save child table (DELETE existing + INSERT new)
        // More reliable than upsert which can silently fail on some PostgREST configs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async function saveChild(table: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) {
            const filtered = pickValidCols(table, data);
            if (Object.keys(filtered).length === 0) {
                console.log(`[submitReport] skip "${table}": no valid columns`);
                return;
            }

            // Step 1: Delete existing rows for this report
            const { error: delErr } = await supabase
                .from(table)
                .delete()
                .eq('shift_report_id', reportId);
            if (delErr) {
                console.error(`[submitReport] DELETE "${table}" error:`, delErr.message);
                errors.push(`${table}: delete failed - ${delErr.message}`);
                return;
            }

            // Step 2: Insert new row
            const payload = { shift_report_id: reportId, ...extra, ...filtered };
            console.log(`[submitReport] INSERT "${table}":`, Object.keys(filtered));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: inserted, error: insErr } = await supabase
                .from(table)
                .insert(payload as any)
                .select();
            if (insErr) {
                console.error(`[submitReport] INSERT "${table}" error:`, insErr.message);
                errors.push(`${table}: ${insErr.message}`);
            } else {
                console.log(`[submitReport] "${table}" saved OK, id=${(inserted as Record<string, unknown>[])?.[0]?.id}`);
            }
        }

        // Save boiler A & B (delete by boiler id, then insert)
        for (const [boilerId, boilerData] of [['A', reportData.boilerA], ['B', reportData.boilerB]] as [string, Record<string, number | null> | undefined][]) {
            if (boilerData && Object.keys(boilerData).length > 0) {
                const filtered = pickValidCols('shift_boiler', boilerData as Record<string, unknown>);
                if (Object.keys(filtered).length > 0) {
                    await supabase.from('shift_boiler').delete()
                        .eq('shift_report_id', reportId).eq('boiler', boilerId);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: ins, error: bErr } = await supabase.from('shift_boiler')
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

        // Save all other child tables
        if (reportData.turbin && Object.keys(reportData.turbin).length > 0) {
            await saveChild('shift_turbin', reportData.turbin);
        }
        if (reportData.steamDist && Object.keys(reportData.steamDist).length > 0) {
            await saveChild('shift_steam_dist', reportData.steamDist);
        }
        if (reportData.generatorGi && Object.keys(reportData.generatorGi).length > 0) {
            await saveChild('shift_generator_gi', reportData.generatorGi);
        }
        if (reportData.powerDist && Object.keys(reportData.powerDist).length > 0) {
            await saveChild('shift_power_dist', reportData.powerDist);
        }
        if (reportData.espHandling && Object.keys(reportData.espHandling).length > 0) {
            await saveChild('shift_esp_handling', reportData.espHandling as Record<string, unknown>);
        }
        if (reportData.tankyard && Object.keys(reportData.tankyard).length > 0) {
            await saveChild('shift_tankyard', reportData.tankyard);

            // Sync tankyard data to tank_levels for real-time monitoring
            const ty = reportData.tankyard;
            const tankMappings: { tank_id: string; value: number | null; capacity_m3: number }[] = [
                { tank_id: 'DEMIN', value: ty.tk_demin ?? null, capacity_m3: 1200 },
                { tank_id: 'RCW', value: ty.tk_rcw ?? null, capacity_m3: 4600 },
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
        if (reportData.personnel && Object.keys(reportData.personnel).length > 0) {
            await saveChild('shift_personnel', reportData.personnel as Record<string, unknown>);
        }
        if (reportData.coalBunker && Object.keys(reportData.coalBunker).length > 0) {
            await saveChild('shift_coal_bunker', reportData.coalBunker as Record<string, unknown>);
        }
        if (reportData.waterQuality && Object.keys(reportData.waterQuality).length > 0) {
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

        if (errors.length > 0) {
            console.error('Child table errors:', errors);
            return { error: errors.join('; '), reportId };
        }

        return { error: null, reportId };
    }, [date, shift]);

    return { report, loading, error, submitReport, refetch };
}
