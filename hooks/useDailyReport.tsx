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
        // Selisih (today_raw − yesterday_raw), di-precompute saat submit.
        'selisih_prod_boiler_a', 'selisih_prod_boiler_b',
        'selisih_inlet_turbine', 'selisih_mps_i', 'selisih_mps_3a',
        'selisih_lps_ii', 'selisih_lps_3a', 'selisih_fully_condens',
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
        // Selisih totalizer MWh, di-precompute saat submit.
        'selisih_ubb', 'selisih_pabrik2', 'selisih_pabrik3a',
        'selisih_revamping', 'selisih_pie', 'selisih_stg_ubb',
    ],
    daily_report_coal: [
        'coal_a_24', 'coal_b_24', 'coal_c_24', 'total_boiler_a_24',
        'coal_d_24', 'coal_e_24', 'coal_f_24', 'total_boiler_b_24', 'grand_total_24',
        'coal_a_00', 'coal_b_00', 'coal_c_00', 'total_boiler_a_00',
        'coal_d_00', 'coal_e_00', 'coal_f_00', 'total_boiler_b_00', 'grand_total_00',
        // Selisih totalizer feeder, di-precompute saat submit.
        'selisih_coal_a', 'selisih_coal_b', 'selisih_coal_c',
        'selisih_coal_d', 'selisih_coal_e', 'selisih_coal_f',
    ],
    daily_report_turbine_misc: [
        'temp_furnace_a', 'temp_furnace_b',
        'axial_displacement', 'thrust_bearing_temp', 'steam_inlet_press', 'steam_inlet_temp',
        'consumption_rate_a', 'consumption_rate_b', 'consumption_rate_avg',
        'totalizer_gi', 'totalizer_export', 'totalizer_import', 'pie_dr',
        'gen_ampere', 'gen_amp_react', 'gen_cos_phi', 'gen_tegangan', 'gen_frequensi',
        'gi_sum_p', 'gi_sum_q', 'gi_cos_phi',
        'status_boiler_a', 'status_boiler_b', 'status_turbin',
        // Status feeder coal (tab Boiler harian) — running/standby/emergency standby/not standby.
        'status_feeder_a', 'status_feeder_b', 'status_feeder_c',
        'status_feeder_d', 'status_feeder_e', 'status_feeder_f',
        // Pembacaan sesaat boiler jam 24.00 (untuk e-Logbook) — per boiler A/B.
        'press_steam_a', 'temp_steam_a', 'bfw_press_a', 'temp_bfw_a', 'temp_flue_gas_a',
        'air_heater_ti113_a', 'o2_a', 'steam_drum_press_a', 'primary_air_a', 'secondary_air_a',
        'press_steam_b', 'temp_steam_b', 'bfw_press_b', 'temp_bfw_b', 'temp_flue_gas_b',
        'air_heater_ti113_b', 'o2_b', 'steam_drum_press_b', 'primary_air_b', 'secondary_air_b',
    ],
    daily_report_stock_tank: [
        'stock_batubara', 'rcw_level_00', 'demin_level_00',
        'solar_tank_a', 'solar_tank_b', 'solar_tank_total', 'kedatangan_solar',
        'solar_boiler', 'solar_bengkel', 'solar_3b',
        'bfw_boiler_a', 'bfw_boiler_b', 'flow_bfw_a', 'flow_bfw_b', 'bfw_total',
        'chemical_phosphat', 'chemical_amin', 'chemical_hydrasin',
        'silo_a_pct', 'silo_b_pct', 'unloading_fly_ash_a', 'unloading_fly_ash_b',
        'total_pf1', 'total_pf2',
        // Level Bunker & Trafo ESP (Jam 24.00) — untuk logbook
        'bunker_a', 'bunker_b', 'bunker_c', 'bunker_d', 'bunker_e', 'bunker_f',
        'trafo_a1', 'trafo_a2', 'trafo_a3', 'trafo_b1', 'trafo_b2', 'trafo_b3',
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

// ─── Kepemilikan kolom per station (laporan harian) ───
// Saat submit datang dari station view (?station=<id> → station_filler diisi), HANYA
// kolom milik station tsb yang ditulis (partial UPDATE). Kolom milik station lain di
// row child yang sama TIDAK disentuh — jadi tidak saling overwrite walau beberapa station
// menulis tabel yang sama. Contoh tabel berbagi:
//   - daily_report_steam        : Boiler (prod_boiler_*) + Turbin (inlet/mps/condens)
//   - daily_report_turbine_misc : Boiler (furnace/status_boiler/CR) + Turbin (gen/gi/status_turbin)
//                                 + PIU (totalizer_export/import/gi, pie_dr)
//   - daily_report_stock_tank   : Boiler (bfw_*) + Handling (rcw/demin/solar) + ESP (silo/fly_ash)
//   - daily_report_totalizer    : Handling (tot_* konsumsi) + foreman (group/kasi/totalizer_1..5)
// Tabel yang TIDAK ada di map sebuah station → di-skip total untuk station itu.
// Submit non-station (foreman/admin) → ownsMap null → tulis penuh (upsert) seperti biasa.
const BOILER_OWNS_COLS: Record<string, string[]> = {
    daily_report_steam: [
        'prod_boiler_a_24', 'prod_boiler_a_00', 'prod_boiler_b_24', 'prod_boiler_b_00',
        'prod_total_24', 'prod_total_00',
        'selisih_prod_boiler_a', 'selisih_prod_boiler_b',
    ],
    daily_report_coal: [
        'coal_a_24', 'coal_b_24', 'coal_c_24', 'total_boiler_a_24',
        'coal_d_24', 'coal_e_24', 'coal_f_24', 'total_boiler_b_24', 'grand_total_24',
        'coal_a_00', 'coal_b_00', 'coal_c_00', 'total_boiler_a_00',
        'coal_d_00', 'coal_e_00', 'coal_f_00', 'total_boiler_b_00', 'grand_total_00',
        'selisih_coal_a', 'selisih_coal_b', 'selisih_coal_c',
        'selisih_coal_d', 'selisih_coal_e', 'selisih_coal_f',
    ],
    daily_report_stock_tank: ['bfw_boiler_a', 'bfw_boiler_b', 'flow_bfw_a', 'flow_bfw_b', 'bfw_total'],
    // consumption_rate murni turunan data boiler (coal ÷ steam prod), jadi di-own Boiler.
    daily_report_turbine_misc: [
        'temp_furnace_a', 'temp_furnace_b', 'status_boiler_a', 'status_boiler_b',
        'consumption_rate_a', 'consumption_rate_b', 'consumption_rate_avg',
        'status_feeder_a', 'status_feeder_b', 'status_feeder_c',
        'status_feeder_d', 'status_feeder_e', 'status_feeder_f',
        // Pembacaan sesaat boiler jam 24.00 (untuk e-Logbook) — di-own Boiler supaya
        // ikut tersimpan saat operator isi harian dari station view (panel_boiler*).
        'press_steam_a', 'temp_steam_a', 'bfw_press_a', 'temp_bfw_a', 'temp_flue_gas_a',
        'air_heater_ti113_a', 'o2_a', 'steam_drum_press_a', 'primary_air_a', 'secondary_air_a',
        'press_steam_b', 'temp_steam_b', 'bfw_press_b', 'temp_bfw_b', 'temp_flue_gas_b',
        'air_heater_ti113_b', 'o2_b', 'steam_drum_press_b', 'primary_air_b', 'secondary_air_b',
    ],
    // Panel boiler wajib isi supervisor (KASI) → boleh tulis kasi_name (dipakai notif siap-publish).
    daily_report_totalizer: ['kasi_name', 'group_name'],
};
// Pisah kepemilikan per boiler supaya panel_boiler_a & panel_boiler_b tidak saling
// menimpa (samakan dgn isolasi A/B di laporan shift). Kolom agregat (prod_total,
// grand_total, bfw_total, consumption_rate_avg) sengaja dimiliki KEDUANYA: keduanya
// turunan A+B yang di-recompute dari state penuh saat submit, jadi tidak ada kolom
// eksklusif yang hilang. Kolom eksklusif A vs B saling lepas (disjoint).
const BOILER_A_OWNS_COLS: Record<string, string[]> = {
    daily_report_steam: ['prod_boiler_a_24', 'prod_boiler_a_00', 'selisih_prod_boiler_a', 'prod_total_24', 'prod_total_00'],
    daily_report_coal: [
        'coal_a_24', 'coal_b_24', 'coal_c_24', 'total_boiler_a_24',
        'coal_a_00', 'coal_b_00', 'coal_c_00', 'total_boiler_a_00',
        'selisih_coal_a', 'selisih_coal_b', 'selisih_coal_c',
        'grand_total_24', 'grand_total_00',
    ],
    daily_report_stock_tank: ['bfw_boiler_a', 'flow_bfw_a', 'bfw_total'],
    daily_report_turbine_misc: [
        'temp_furnace_a', 'status_boiler_a', 'consumption_rate_a', 'consumption_rate_avg',
        'status_feeder_a', 'status_feeder_b', 'status_feeder_c',
        'press_steam_a', 'temp_steam_a', 'bfw_press_a', 'temp_bfw_a', 'temp_flue_gas_a',
        'air_heater_ti113_a', 'o2_a', 'steam_drum_press_a', 'primary_air_a', 'secondary_air_a',
    ],
    daily_report_totalizer: ['kasi_name', 'group_name'],
};
const BOILER_B_OWNS_COLS: Record<string, string[]> = {
    daily_report_steam: ['prod_boiler_b_24', 'prod_boiler_b_00', 'selisih_prod_boiler_b', 'prod_total_24', 'prod_total_00'],
    daily_report_coal: [
        'coal_d_24', 'coal_e_24', 'coal_f_24', 'total_boiler_b_24',
        'coal_d_00', 'coal_e_00', 'coal_f_00', 'total_boiler_b_00',
        'selisih_coal_d', 'selisih_coal_e', 'selisih_coal_f',
        'grand_total_24', 'grand_total_00',
    ],
    daily_report_stock_tank: ['bfw_boiler_b', 'flow_bfw_b', 'bfw_total'],
    daily_report_turbine_misc: [
        'temp_furnace_b', 'status_boiler_b', 'consumption_rate_b', 'consumption_rate_avg',
        'status_feeder_d', 'status_feeder_e', 'status_feeder_f',
        'press_steam_b', 'temp_steam_b', 'bfw_press_b', 'temp_bfw_b', 'temp_flue_gas_b',
        'air_heater_ti113_b', 'o2_b', 'steam_drum_press_b', 'primary_air_b', 'secondary_air_b',
    ],
    daily_report_totalizer: ['kasi_name', 'group_name'],
};
const STATION_OWNS_COLS: Record<string, Record<string, string[]>> = {
    panel_boiler: BOILER_OWNS_COLS,          // legacy/full panel — own A + B
    panel_boiler_a: BOILER_A_OWNS_COLS,
    panel_boiler_b: BOILER_B_OWNS_COLS,
    panel_turbin: {
        daily_report_steam: [
            'inlet_turbine_24', 'inlet_turbine_00', 'mps_i_24', 'mps_i_00',
            'mps_3a_24', 'mps_3a_00', 'lps_ii_24', 'lps_3a_24', 'lps_ii_00', 'lps_3a_00',
            'fully_condens_24', 'fully_condens_00', 'co_gen_00',
            'internal_ubb_24', 'internal_ubb_00',
            'selisih_inlet_turbine', 'selisih_mps_i', 'selisih_mps_3a',
            'selisih_lps_ii', 'selisih_lps_3a', 'selisih_fully_condens',
        ],
        // Power: panel_turbin owns seluruh tabel.
        daily_report_power: VALID_COLS.daily_report_power,
        daily_report_turbine_misc: [
            'steam_inlet_press', 'steam_inlet_temp', 'thrust_bearing_temp', 'axial_displacement',
            'gen_ampere', 'gen_amp_react', 'gen_cos_phi', 'gen_tegangan', 'gen_frequensi',
            'gi_sum_p', 'gi_sum_q', 'gi_cos_phi', 'status_turbin',
        ],
        // Panel turbin wajib isi supervisor (KASI).
        daily_report_totalizer: ['kasi_name', 'group_name'],
    },
    handling: {
        daily_report_stock_tank: [
            'rcw_level_00', 'demin_level_00',
            'solar_tank_a', 'solar_tank_b', 'solar_tank_total',
            'solar_boiler', 'solar_bengkel', 'solar_3b', 'kedatangan_solar',
        ],
        daily_report_totalizer: [
            'tot_rcw_1a', 'tot_demin', 'tot_demin_pb1', 'tot_demin_pb3',
            'tot_hydrant', 'tot_basin', 'tot_service',
            'konsumsi_demin', 'konsumsi_rcw',
            'penerimaan_demin_3a', 'penerimaan_demin_1b', 'penerimaan_rcw_1a',
        ],
    },
    esp: {
        // Silo + Trafo ESP (jam 24.00). Trafo sebelumnya tidak ter-own → tidak tersimpan
        // saat ESP submit; kini diperbaiki agar ikut tersimpan.
        daily_report_stock_tank: [
            'silo_a_pct', 'silo_b_pct', 'unloading_fly_ash_a', 'unloading_fly_ash_b',
            'trafo_a1', 'trafo_a2', 'trafo_a3', 'trafo_b1', 'trafo_b2', 'trafo_b3',
        ],
    },
    lapangan_turbin: {
        daily_report_turbine_misc: ['totalizer_export', 'totalizer_import', 'totalizer_gi', 'pie_dr'],
    },
    // Bunker punya tab Coal Bunker sendiri di harian (level bunker jam 24.00, dipakai logbook).
    bunker: {
        daily_report_stock_tank: ['bunker_a', 'bunker_b', 'bunker_c', 'bunker_d', 'bunker_e', 'bunker_f'],
    },
    lapangan_boiler: {},
};

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
        turbineMisc?: Record<string, number | string | null>;
        stockTank?: Record<string, number | null>;
        coalTransfer?: Record<string, number | null>;
        totalizer?: Record<string, number | string | null>;
        /** Per-station filler — kalau diisi, di-merge ke station_fillers JSONB tanpa
         *  overwrite station lain. Dipakai saat operator submit dari station view. */
        station_filler?: { station: string; name: string };
    }) => {
        if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

        const supabase = createClient();

        // Upsert daily_reports anchor
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validCreatedBy = reportData.created_by && UUID_REGEX.test(reportData.created_by) ? reportData.created_by : null;

        // station_fillers TIDAK lagi di-merge client-side (race-prone). Setelah parent
        // row terjamin ada, panggil RPC `merge_daily_station_filler` yang melakukan
        // atomic JSONB merge di DB — race-proof walau N station submit bersamaan.

        // Station-scoped: kalau submit datang dari operator station (bukan foreman full),
        // JANGAN overwrite field-field foreman di parent daily_reports — biar operator
        // station hanya tulis child table mereka tanpa ganggu data foreman.
        const isStationScoped = !!reportData.station_filler;
        // Kepemilikan kolom per station (lihat STATION_OWNS_COLS). Saat station-scoped,
        // tiap child table hanya di-update pada kolom owned (partial), tabel non-owned di-skip.
        const stationKey = reportData.station_filler?.station ?? null;
        const ownsMap: Record<string, string[]> | null =
            isStationScoped && stationKey ? (STATION_OWNS_COLS[stationKey] ?? {}) : null;

        const parentPayload: Record<string, unknown> = {
            date,
            status: 'draft' as ReportStatus,
            ...(validCreatedBy ? { created_by: validCreatedBy } : {}),
        };
        if (!isStationScoped) {
            // Hanya foreman/admin (no station) yang boleh tulis ringkasan + catatan.
            parentPayload.produksi_steam_a = reportData.produksi_steam_a ?? null;
            parentPayload.produksi_steam_b = reportData.produksi_steam_b ?? null;
            parentPayload.konsumsi_batubara = reportData.konsumsi_batubara ?? null;
            parentPayload.load_mw = reportData.load_mw ?? null;
            parentPayload.notes = reportData.notes || null;
        }

        const { data: dr, error: drError } = await supabase
            .from('daily_reports')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .upsert(parentPayload as any, { onConflict: 'date' })
            .select()
            .single();

        if (drError || !dr) return { error: drError?.message || 'Failed to create daily report' };

        const reportId = (dr as Record<string, unknown>).id as string;

        // ─── Atomic merge station_fillers via RPC (race-proof) ───
        if (reportData.station_filler && reportId) {
            const { error: rpcErr } = await supabase.rpc('merge_daily_station_filler', {
                p_report_id: reportId,
                p_station: reportData.station_filler.station,
                p_name: reportData.station_filler.name,
            });
            if (rpcErr) {
                console.warn('[submitDailyReport] merge_daily_station_filler RPC failed:', rpcErr.message);
                // Non-fatal.
            }
        }

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
        // Subset daily_report_stock_tank yang benar-benar ditulis — dipakai untuk sync ke
        // tank_levels (hanya kalau level tank ikut tersimpan).
        let writtenStockTank: Record<string, unknown> = {};

        // Partial UPDATE untuk station-scoped: select row existing → update hanya kolom owned,
        // atau insert kalau belum ada (race insert → 23505 → re-select + update).
        // Dynamic table name → typed client tidak bisa infer. Builder fresh tiap call
        // (PostgrestQueryBuilder me-mutate url-nya, jadi jangan di-reuse antar operasi).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tbl = (t: string): any => supabase.from(t);
        async function savePartialDaily(table: string, subset: Record<string, unknown>) {
            const { data: existing } = await tbl(table).select('id').eq('daily_report_id', reportId).maybeSingle();
            if (existing) {
                const { error } = await tbl(table).update(subset).eq('id', (existing as { id: string }).id);
                if (error) childErrors.push(`${table}: ${error.message}`);
                return;
            }
            const { error: insErr } = await tbl(table).insert({ daily_report_id: reportId, ...subset });
            if (insErr) {
                if ((insErr as { code?: string }).code === '23505') {
                    // Race: row dibuat station lain barusan → re-select + update kolom owned.
                    const { data: now } = await tbl(table).select('id').eq('daily_report_id', reportId).maybeSingle();
                    if (now) {
                        const { error: updErr } = await tbl(table).update(subset).eq('id', (now as { id: string }).id);
                        if (updErr) childErrors.push(`${table}: ${updErr.message}`);
                        return;
                    }
                }
                childErrors.push(`${table}: ${insErr.message}`);
            }
        }

        // Simpan child tables PARALEL — 7 tabel berbeda, independen satu sama lain;
        // logika partial/upsert per tabel TIDAK berubah, hanya eksekusinya bersamaan
        // (memangkas roundtrip berurutan saat banyak operator submit di jam yang sama).
        const childOps: Promise<void>[] = [];
        for (const { key, table } of childTables) {
            const childData = reportData[key];
            if (!childData) continue;
            const filtered = pickValidCols(table, childData as Record<string, unknown>);

            if (ownsMap) {
                // Station-scoped → hanya tulis kolom owned (partial). Tabel non-owned di-skip.
                const owned = ownsMap[table];
                if (!owned || owned.length === 0) continue;
                const subset: Record<string, unknown> = {};
                for (const c of owned) {
                    if (c in filtered) subset[c] = filtered[c];
                }
                if (Object.keys(subset).length === 0) continue;
                if (table === 'daily_report_stock_tank') writtenStockTank = subset;
                childOps.push(savePartialDaily(table, subset));
            } else {
                // Foreman/admin full submit → tulis penuh (upsert) seperti semula.
                if (table === 'daily_report_stock_tank') writtenStockTank = filtered;
                childOps.push((async () => {
                    const { error: childErr } = await tbl(table).upsert(
                        { daily_report_id: reportId, ...filtered },
                        { onConflict: 'daily_report_id' },
                    );
                    if (childErr) childErrors.push(`${table}: ${childErr.message}`);
                })());
            }
        }
        await Promise.all(childOps);

        // ─── Sync level tank ke tank_levels (real-time monitoring di /tank-level) ───
        // Hanya jalan kalau level tank benar-benar ikut tersimpan (station Handling atau
        // submit penuh). Mirror perilaku laporan shift (shift_tankyard → tank_levels).
        const tankMappings: { tank_id: string; value: unknown; capacity_m3: number }[] = [
            { tank_id: 'DEMIN', value: writtenStockTank.demin_level_00, capacity_m3: 1250 },
            { tank_id: 'RCW',   value: writtenStockTank.rcw_level_00,   capacity_m3: 5000 },
            // SOLAR: operator input level 0-200 m³ (solar_tank_a) — skala sama dengan
            // tk_solar_ab di laporan shift, jadi kapasitas 200 supaya % konsisten di /tank-level.
            { tank_id: 'SOLAR', value: writtenStockTank.solar_tank_a, capacity_m3: 200 },
        ];
        for (const { tank_id, value, capacity_m3 } of tankMappings) {
            if (value == null) continue;
            const level_m3 = Number(value);
            if (isNaN(level_m3)) continue;
            const level_pct = Math.min(100, Math.max(0, (level_m3 / capacity_m3) * 100));
            await supabase.from('tank_levels').insert({
                tank_id,
                level_pct,
                level_m3,
                operator_name: 'Laporan Harian',
                note: null,
            } as Record<string, unknown>);
        }

        if (childErrors.length > 0) return { error: childErrors.join('; '), reportId };

        // Sync ke Google Sheets — retry (hingga 3x): PASTIKAN data benar-benar terkirim
        // saat user simpan. Server juga retry transient (withRetry). Sukses → stop.
        let sheetsSyncResult: { ok: boolean; warning?: string } = { ok: false, warning: 'belum tersinkron' };
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const res = await fetch('/api/sheets/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'daily_report', data: { date } }),
                });
                if (!res.ok) {
                    sheetsSyncResult = { ok: false, warning: `Google Sheets HTTP ${res.status}` };
                } else {
                    const result = await res.json();
                    if (result.warning) sheetsSyncResult = { ok: false, warning: result.warning };
                    else { sheetsSyncResult = { ok: true }; break; }
                }
            } catch (sheetsErr) {
                sheetsSyncResult = { ok: false, warning: String(sheetsErr) };
            }
            if (attempt < 3) await new Promise(r => setTimeout(r, 600 * attempt));
        }
        if (!sheetsSyncResult.ok) console.warn('[submitDailyReport] Sheets sync gagal setelah 3x:', sheetsSyncResult.warning);

        return { error: null, reportId, sheetsWarning: sheetsSyncResult.ok ? undefined : sheetsSyncResult.warning };
    }, [date]);

    const refetch = useCallback(() => setFetchKey(k => k + 1), []);

    return { report, prevReport, loading, error, submitReport, refetch };
}
