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
    boiler_params: {
        boiler: 'A' | 'B';
        main_steam_press: number | null;
        main_steam_temp: number | null;
        main_steam_flow: number | null;
        feed_water_flow: number | null;
        feed_water_temp: number | null;
        steam_drum_press: number | null;
    }[];
    turbin_params: {
        load_mw: number | null;
        main_steam_press: number | null;
        main_steam_temp: number | null;
        exhaust_press: number | null;
        bearing_temp_1: number | null;
        bearing_temp_2: number | null;
        bearing_temp_3: number | null;
        bearing_temp_4: number | null;
        vibration: number | null;
        lube_oil_temp: number | null;
    }[];
    power_distribution: {
        destination: string;
        load_mw: number | null;
    }[];
    steam_distribution: {
        destination: string;
        flow_ton_h: number | null;
    }[];
    lab_results: {
        category: string;
        parameter: string;
        value: number | null;
        unit: string | null;
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
                    boiler_params(*),
                    turbin_params(*),
                    power_distribution(*),
                    steam_distribution(*),
                    lab_results(*),
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
        powerDist?: { destination: string; load_mw: number | null }[];
        steamDist?: { destination: string; flow_ton_h: number | null }[];
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

        // Insert boiler params
        if (reportData.boilerA) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('boiler_params').upsert({
                shift_report_id: reportId,
                boiler: 'A',
                ...reportData.boilerA,
            } as any, { onConflict: 'shift_report_id,boiler' });
        }
        if (reportData.boilerB) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('boiler_params').upsert({
                shift_report_id: reportId,
                boiler: 'B',
                ...reportData.boilerB,
            } as any, { onConflict: 'shift_report_id,boiler' });
        }

        // Insert turbin params
        if (reportData.turbin) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('turbin_params').upsert({
                shift_report_id: reportId,
                ...reportData.turbin,
            } as any, { onConflict: 'shift_report_id' });
        }

        // Insert power distribution
        if (reportData.powerDist) {
            await supabase.from('power_distribution').delete().eq('shift_report_id', reportId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('power_distribution').insert(
                reportData.powerDist.map(p => ({ shift_report_id: reportId, ...p })) as any
            );
        }

        // Insert steam distribution
        if (reportData.steamDist) {
            await supabase.from('steam_distribution').delete().eq('shift_report_id', reportId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('steam_distribution').insert(
                reportData.steamDist.map(s => ({ shift_report_id: reportId, ...s })) as any
            );
        }

        return { error: null, reportId };
    }, [date, shift]);

    return { report, loading, error, submitReport };
}
