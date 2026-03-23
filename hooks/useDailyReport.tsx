'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
    ReportStatus,
    DailyReportSteamRow,
    DailyReportPowerRow,
    DailyReportCoalRow,
    DailyReportTurbineMiscRow,
    DailyReportStockTankRow,
    DailyReportCoalTransferRow,
    DailyReportTotalizerRow,
} from '@/lib/supabase/types';

export interface DailyReportData {
    id: string;
    date: string;
    produksi_steam_a: number | null;
    produksi_steam_b: number | null;
    konsumsi_batubara: number | null;
    load_mw: number | null;
    notes: string | null;
    status: ReportStatus;
    created_by: string | null;
    created_at: string;
    daily_report_steam: DailyReportSteamRow[];
    daily_report_power: DailyReportPowerRow[];
    daily_report_coal: DailyReportCoalRow[];
    daily_report_turbine_misc: DailyReportTurbineMiscRow[];
    daily_report_stock_tank: DailyReportStockTankRow[];
    daily_report_coal_transfer: DailyReportCoalTransferRow[];
    daily_report_totalizer: DailyReportTotalizerRow[];
}

function isSupabaseConfigured(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return !!url && !url.includes('YOUR_PROJECT_ID');
}

export function useDailyReport(date: string) {
    const [report, setReport] = useState<DailyReportData | null>(null);
    const [prevReport, setPrevReport] = useState<DailyReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isSupabaseConfigured()) {
            setLoading(false);
            return;
        }

        let stale = false;
        const supabase = createClient();

        const selectQuery = `
            *,
            daily_report_steam(*),
            daily_report_power(*),
            daily_report_coal(*),
            daily_report_turbine_misc(*),
            daily_report_stock_tank(*),
            daily_report_coal_transfer(*),
            daily_report_totalizer(*)
        `;

        async function fetchReport() {
            setLoading(true);
            setError(null);

            // Fetch current date report
            const { data, error: fetchError } = await supabase
                .from('daily_reports')
                .select(selectQuery)
                .eq('date', date)
                .single();

            if (stale) return;

            if (fetchError) {
                if (fetchError.code === 'PGRST116') {
                    setReport(null);
                } else {
                    setError(fetchError.message);
                }
            } else if (data) {
                setReport(data as unknown as DailyReportData);
            }

            // Fetch previous date report for delta calculations
            const prevDate = new Date(date);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;

            const { data: prevData } = await supabase
                .from('daily_reports')
                .select(selectQuery)
                .eq('date', prevDateStr)
                .single();

            if (stale) return;

            if (prevData) {
                setPrevReport(prevData as unknown as DailyReportData);
            } else {
                setPrevReport(null);
            }

            setLoading(false);
        }

        fetchReport();

        return () => { stale = true; };
    }, [date]);

    const submitReport = useCallback(async (reportData: {
        created_by?: string;
        notes?: string;
        produksi_steam_a?: number | null;
        produksi_steam_b?: number | null;
        konsumsi_batubara?: number | null;
        load_mw?: number | null;
        steam?: Record<string, number | null>;
        power?: Record<string, number | null>;
        coal?: Record<string, number | null>;
        turbineMisc?: Record<string, number | null>;
        stockTank?: Record<string, number | null>;
        coalTransfer?: Record<string, number | null>;
        totalizer?: Record<string, number | string | null>;
    }) => {
        if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

        const supabase = createClient();

        // Upsert daily_reports anchor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: dr, error: drError } = await supabase
            .from('daily_reports')
            .upsert({
                date,
                produksi_steam_a: reportData.produksi_steam_a ?? null,
                produksi_steam_b: reportData.produksi_steam_b ?? null,
                konsumsi_batubara: reportData.konsumsi_batubara ?? null,
                load_mw: reportData.load_mw ?? null,
                notes: reportData.notes || null,
                status: 'draft' as ReportStatus,
                ...(reportData.created_by ? { created_by: reportData.created_by } : {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any, { onConflict: 'date' })
            .select()
            .single();

        if (drError || !dr) return { error: drError?.message || 'Failed to create daily report' };

        const reportId = (dr as Record<string, unknown>).id as string;

        // Upsert child tables
        const childTables = [
            { key: 'steam', table: 'daily_report_steam' },
            { key: 'power', table: 'daily_report_power' },
            { key: 'coal', table: 'daily_report_coal' },
            { key: 'turbineMisc', table: 'daily_report_turbine_misc' },
            { key: 'stockTank', table: 'daily_report_stock_tank' },
            { key: 'coalTransfer', table: 'daily_report_coal_transfer' },
            { key: 'totalizer', table: 'daily_report_totalizer' },
        ] as const;

        for (const { key, table } of childTables) {
            const childData = reportData[key];
            if (childData) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await supabase.from(table).upsert({
                    daily_report_id: reportId,
                    ...childData,
                } as any, { onConflict: 'daily_report_id' });
            }
        }

        return { error: null, reportId };
    }, [date]);

    return { report, prevReport, loading, error, submitReport };
}
