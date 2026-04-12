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

// Whitelist kolom valid per child table
const VALID_COLS: Record<string, string[]> = {
    daily_report_steam: [
        'prod_boiler_a_24', 'prod_boiler_b_24', 'prod_total_24',
        'inlet_turbine_24', 'mps_i_24', 'mps_3a_24', 'lps_ii_24', 'lps_3a_24',
        'fully_condens_24', 'internal_ubb_24',
        'prod_boiler_a_00', 'prod_boiler_b_00', 'prod_total_00',
        'inlet_turbine_00', 'co_gen_00', 'mps_i_00', 'mps_3a_00',
        'lps_ii_00', 'lps_3a_00', 'fully_condens_00', 'internal_ubb_00',
    ],
    daily_report_power: [
        'gen_24', 'dist_ib_24', 'dist_ii_24', 'dist_3a_24', 'dist_3b_24',
        'internal_bus1_24', 'internal_bus2_24', 'pja_24',
        'revamp_stg175_24', 'revamp_stg125_24', 'exsport_24', 'pie_pln_24', 'pie_import_24',
        'gen_00', 'dist_ib_00', 'dist_ii_00', 'dist_3a_00', 'dist_3b_00',
        'internal_bus1_00', 'internal_bus2_00', 'pja_00',
        'revamp_stg175_00', 'revamp_stg125_00', 'exsport_00', 'pie_pln_00', 'pie_import_00', 'pie_gi_00',
        'power_ubb_totalizer', 'power_ubb',
        'power_pabrik2_totalizer', 'power_pabrik2',
        'power_pabrik3a_totalizer', 'power_pabrik3a',
        'power_revamping_totalizer', 'power_revamping',
        'power_pie_totalizer', 'power_pie',
        'power_stg_ubb_totalizer',
    ],
    daily_report_coal: [
        'coal_a_24', 'coal_b_24', 'coal_c_24', 'total_boiler_a_24',
        'coal_d_24', 'coal_e_24', 'coal_f_24', 'total_boiler_b_24', 'grand_total_24',
        'coal_a_00', 'coal_b_00', 'coal_c_00', 'total_boiler_a_00',
        'coal_d_00', 'coal_e_00', 'coal_f_00', 'total_boiler_b_00', 'grand_total_00',
    ],
    daily_report_turbine_misc: [
        'temp_furnace_a', 'temp_furnace_b',
        'axial_displacement', 'thrust_bearing_temp', 'steam_inlet_press', 'steam_inlet_temp',
        'consumption_rate_a', 'consumption_rate_b', 'consumption_rate_avg',
        'totalizer_gi', 'totalizer_export', 'totalizer_import',
        'gen_ampere', 'gen_amp_react', 'gen_cos_phi', 'gen_tegangan', 'gen_frequensi',
        'gi_sum_p', 'gi_sum_q', 'gi_cos_phi',
    ],
    daily_report_stock_tank: [
        'stock_batubara', 'rcw_level_00', 'demin_level_00',
        'solar_tank_a', 'solar_tank_b', 'solar_tank_total', 'kedatangan_solar',
        'solar_boiler', 'solar_bengkel', 'solar_3b',
        'bfw_boiler_a', 'bfw_boiler_b', 'flow_bfw_a', 'flow_bfw_b', 'bfw_total',
        'chemical_phosphat', 'chemical_amin', 'chemical_hydrasin',
        'silo_a_pct', 'silo_b_pct', 'unloading_fly_ash_a', 'unloading_fly_ash_b',
        'total_pf1', 'total_pf2',
    ],
    daily_report_coal_transfer: [
        'pb2_pf1_rit', 'pb2_pf1_ton', 'pb2_pf2_rit', 'pb2_pf2_ton',
        'pb2_total_pf1_rit', 'pb2_total_pf1_ton', 'pb2_total_pf2_rit', 'pb2_total_pf2_ton',
        'pb3_calc_rit', 'pb3_calc_ton', 'pb3_total_calc_rit', 'pb3_total_calc_ton',
        'darat_24_ton', 'darat_total_ton', 'laut_24_ton', 'laut_total_ton',
    ],
    daily_report_totalizer: [
        'totalizer_1', 'totalizer_2', 'totalizer_3', 'totalizer_4', 'totalizer_5',
        'group_name', 'kasi_name',
        'stock_batubara_rendal', 'keterangan',
        'konsumsi_demin', 'konsumsi_rcw',
        'penerimaan_demin_3a', 'penerimaan_demin_1b', 'penerimaan_rcw_1a',
        'tot_rcw_1a', 'tot_demin', 'tot_demin_pb1', 'tot_demin_pb3',
        'tot_hydrant', 'tot_basin', 'tot_service',
    ],
};

function pickValidCols(table: string, data: Record<string, unknown>): Record<string, unknown> {
    const valid = new Set(VALID_COLS[table] || []);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
        if (valid.has(k)) result[k] = v;
    }
    return result;
}

export function useDailyReport(date: string) {
    const [report, setReport] = useState<DailyReportData | null>(null);
    const [prevReport, setPrevReport] = useState<DailyReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchKey, setFetchKey] = useState(0);

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
                // PostgREST returns single objects for one-to-one relations (UNIQUE on FK)
                // but consumers expect arrays. Normalize here.
                const oneToOneKeys = [
                    'daily_report_steam', 'daily_report_power', 'daily_report_coal',
                    'daily_report_turbine_misc', 'daily_report_stock_tank',
                    'daily_report_coal_transfer', 'daily_report_totalizer',
                ] as const;
                for (const key of oneToOneKeys) {
                    const val = (data as Record<string, unknown>)[key];
                    if (val && !Array.isArray(val)) {
                        (data as Record<string, unknown>)[key] = [val];
                    }
                }
                setReport(data as unknown as DailyReportData);
            }

            // Fetch previous date report for delta calculations (parse as WIB to avoid UTC day shift)
            const prevDate = new Date(date + 'T00:00:00+07:00');
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;

            const { data: prevData } = await supabase
                .from('daily_reports')
                .select(selectQuery)
                .eq('date', prevDateStr)
                .single();

            if (stale) return;

            if (prevData) {
                const oneToOneKeys = [
                    'daily_report_steam', 'daily_report_power', 'daily_report_coal',
                    'daily_report_turbine_misc', 'daily_report_stock_tank',
                    'daily_report_coal_transfer', 'daily_report_totalizer',
                ] as const;
                for (const key of oneToOneKeys) {
                    const val = (prevData as Record<string, unknown>)[key];
                    if (val && !Array.isArray(val)) {
                        (prevData as Record<string, unknown>)[key] = [val];
                    }
                }
                setPrevReport(prevData as unknown as DailyReportData);
            } else {
                setPrevReport(null);
            }

            setLoading(false);
        }

        fetchReport();

        return () => { stale = true; };
    }, [date, fetchKey]);

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
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validCreatedBy = reportData.created_by && UUID_REGEX.test(reportData.created_by) ? reportData.created_by : null;

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
                ...(validCreatedBy ? { created_by: validCreatedBy } : {}),
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

        const childErrors: string[] = [];

        for (const { key, table } of childTables) {
            const childData = reportData[key];
            if (childData) {
                const filtered = pickValidCols(table, childData as Record<string, unknown>);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error: childErr } = await supabase.from(table).upsert({
                    daily_report_id: reportId,
                    ...filtered,
                } as any, { onConflict: 'daily_report_id' });
                if (childErr) childErrors.push(`${table}: ${childErr.message}`);
            }
        }

        if (childErrors.length > 0) return { error: childErrors.join('; '), reportId };

        // Fire-and-forget: sync to Google Sheets
        let sheetsSyncResult: { ok: boolean; warning?: string } = { ok: true };
        try {
            const res = await fetch('/api/sheets/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'daily_report', data: { date } }),
            });
            const result = await res.json();
            if (result.warning) {
                console.warn('[submitDailyReport] Sheets warning:', result.warning);
                sheetsSyncResult = { ok: false, warning: result.warning };
            } else {
                console.log('[submitDailyReport] Sheets sync OK:', result);
            }
        } catch (sheetsErr) {
            console.warn('[submitDailyReport] Sheets sync failed (non-fatal):', sheetsErr);
            sheetsSyncResult = { ok: false, warning: String(sheetsErr) };
        }

        return { error: null, reportId, sheetsWarning: sheetsSyncResult.ok ? undefined : sheetsSyncResult.warning };
    }, [date]);

    const refetch = useCallback(() => setFetchKey(k => k + 1), []);

    return { report, prevReport, loading, error, submitReport, refetch };
}
