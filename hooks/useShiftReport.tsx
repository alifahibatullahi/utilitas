'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ShiftType, ReportStatus } from '@/lib/supabase/types';

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
        stream_days: number | null;
    }[];
    shift_steam_dist: {
        pabrik1_flow: number | null;
        pabrik1_temp: number | null;
        pabrik2_flow: number | null;
        pabrik2_temp: number | null;
        pabrik3a_flow: number | null;
        pabrik3a_temp: number | null;
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

    useEffect(() => {
        if (!isSupabaseConfigured()) {
            setLoading(false);
            return;
        }

        const supabase = createClient();

        async function fetchReport() {
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
                .single();

            if (fetchError) {
                if (fetchError.code === 'PGRST116') {
                    setReport(null);
                } else {
                    setError(fetchError.message);
                }
            } else if (data) {
                setReport(data as unknown as ShiftReportData);
            }

            setLoading(false);
        }

        fetchReport();
    }, [date, shift]);

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
        coalBunker?: Record<string, number | null>;
        waterQuality?: Record<string, number | null>;
    }) => {
        if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

        const supabase = createClient();

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
                created_by: reportData.created_by,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any, { onConflict: 'date,shift,group_name' })
            .select()
            .single();

        if (srError || !sr) return { error: srError?.message || 'Failed to create report' };

        const reportId = (sr as Record<string, unknown>).id as string;

        // Insert boiler data
        if (reportData.boilerA) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('shift_boiler').upsert({
                shift_report_id: reportId,
                boiler: 'A',
                ...reportData.boilerA,
            } as any, { onConflict: 'shift_report_id,boiler' });
        }
        if (reportData.boilerB) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('shift_boiler').upsert({
                shift_report_id: reportId,
                boiler: 'B',
                ...reportData.boilerB,
            } as any, { onConflict: 'shift_report_id,boiler' });
        }

        // Insert turbin data
        if (reportData.turbin) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('shift_turbin').upsert({
                shift_report_id: reportId,
                ...reportData.turbin,
            } as any, { onConflict: 'shift_report_id' });
        }

        // Insert steam distribution
        if (reportData.steamDist) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('shift_steam_dist').upsert({
                shift_report_id: reportId,
                ...reportData.steamDist,
            } as any, { onConflict: 'shift_report_id' });
        }

        // Insert generator & GI
        if (reportData.generatorGi) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('shift_generator_gi').upsert({
                shift_report_id: reportId,
                ...reportData.generatorGi,
            } as any, { onConflict: 'shift_report_id' });
        }

        // Insert power distribution
        if (reportData.powerDist) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('shift_power_dist').upsert({
                shift_report_id: reportId,
                ...reportData.powerDist,
            } as any, { onConflict: 'shift_report_id' });
        }

        // Insert ESP & handling
        if (reportData.espHandling) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('shift_esp_handling').upsert({
                shift_report_id: reportId,
                ...reportData.espHandling,
            } as any, { onConflict: 'shift_report_id' });
        }

        // Insert tankyard
        if (reportData.tankyard) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('shift_tankyard').upsert({
                shift_report_id: reportId,
                ...reportData.tankyard,
            } as any, { onConflict: 'shift_report_id' });
        }

        // Insert personnel
        if (reportData.personnel) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('shift_personnel').upsert({
                shift_report_id: reportId,
                ...reportData.personnel,
            } as any, { onConflict: 'shift_report_id' });
        }

        // Insert coal bunker
        if (reportData.coalBunker) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('shift_coal_bunker').upsert({
                shift_report_id: reportId,
                ...reportData.coalBunker,
            } as any, { onConflict: 'shift_report_id' });
        }

        // Insert water quality
        if (reportData.waterQuality) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('shift_water_quality').upsert({
                shift_report_id: reportId,
                ...reportData.waterQuality,
            } as any, { onConflict: 'shift_report_id' });
        }

        return { error: null, reportId };
    }, [date, shift]);

    return { report, loading, error, submitReport };
}
