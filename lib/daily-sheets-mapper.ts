/**
 * Maps DailyReport data (from Supabase) → LHUBB Google Sheets row.
 *
 * Column indices are 0-based. Col 0 = No (auto-set by upsertDailyRow).
 * Col 1 = Tanggal. Data starts at col 2.
 *
 * Sheet structure verified from LHUBB tab (gid=977001238):
 *   Cols  2–12  : Produksi & Distribusi Steam 24h
 *   Cols 13–23  : Produksi & Distribusi Steam jam 00.00
 *   Cols 24–36  : Power 24h
 *   Cols 37–49  : Power jam 00.00
 *   Cols 50–58  : Konsumsi Batubara 24h
 *   Cols 59–67  : Konsumsi Batubara jam 00.00
 *   Cols 68–73  : Furnace & Turbine (suhu, axial, steam inlet)
 *   Cols 74–76  : Consumption Rate
 *   Cols 77–78  : Formula cols (Ton BB/MW, Ton Steam/MW) — leave null
 *   Cols 79–81  : Totalizer Power
 *   Cols 82–101 : Stock & Tanks (batubara, solar, BFW, kimia, silo, fly ash)
 *   Cols 102–117: Pemindahan Batubara PB II & III, kedatangan batubara
 *   Cols 118–123: Keterangan & Totalizer Air
 *   Cols 124–125: Group & Kasi
 *   Col  126    : Stock Batubara Rendal
 */

import { toIndonesianDate } from './google-sheets';
import type {
    DailyReportSteamRow,
    DailyReportPowerRow,
    DailyReportCoalRow,
    DailyReportTurbineMiscRow,
    DailyReportStockTankRow,
    DailyReportCoalTransferRow,
    DailyReportTotalizerRow,
} from './supabase/types';

// ─── Column index constants (0-based) ─────────────────────────────────────────

const COL = {
    no: 0,
    tanggal: 1,

    // PRODUKSI & DISTRIBUSI STEAM (24 JAM) — cols 2–12
    prod_boiler_a_24: 2, prod_boiler_b_24: 3, prod_total_24: 4,
    inlet_turbine_24: 5,
    // col 6 = Co Gen 24h (tidak ada di DB) — biarkan null
    mps_i_24: 7, mps_3a_24: 8, lps_ii_24: 9, lps_3a_24: 10,
    fully_condens_24: 11, internal_ubb_24: 12,

    // PRODUKSI & DISTRIBUSI STEAM (jam 00.00) — cols 13–23
    prod_boiler_a_00: 13, prod_boiler_b_00: 14, prod_total_00: 15,
    inlet_turbine_00: 16, co_gen_00: 17,
    mps_i_00: 18, mps_3a_00: 19, lps_ii_00: 20, lps_3a_00: 21,
    fully_condens_00: 22, internal_ubb_00: 23,

    // POWER (24 jam) — cols 24–36
    gen_24: 24, dist_ib_24: 25, dist_ii_24: 26, dist_3a_24: 27, dist_3b_24: 28,
    internal_bus1_24: 29, internal_bus2_24: 30, pja_24: 31,
    revamp_stg175_24: 32, revamp_stg125_24: 33,
    exsport_24: 34, pie_import_24: 35, pie_pln_24: 36,

    // POWER (jam 00.00) — cols 37–49
    gen_00: 37, dist_ib_00: 38, dist_ii_00: 39, dist_3a_00: 40, dist_3b_00: 41,
    internal_bus1_00: 42, internal_bus2_00: 43, pja_00: 44,
    revamp_stg175_00: 45, revamp_stg125_00: 46,
    exsport_00: 47, pie_import_00: 48, pie_gi_00: 49,

    // KONSUMSI BATUBARA 24 JAM — cols 50–58
    coal_a_24: 50, coal_b_24: 51, coal_c_24: 52, total_boiler_a_24: 53,
    coal_d_24: 54, coal_e_24: 55, coal_f_24: 56, total_boiler_b_24: 57, grand_total_24: 58,

    // KONSUMSI BATUBARA (jam 00.00) — cols 59–67
    coal_a_00: 59, coal_b_00: 60, coal_c_00: 61, total_boiler_a_00: 62,
    coal_d_00: 63, coal_e_00: 64, coal_f_00: 65, total_boiler_b_00: 66, grand_total_00: 67,

    // TEMPERATUR FURNACE & TURBINE GENERATOR — cols 68–73
    temp_furnace_a: 68, temp_furnace_b: 69,
    axial_displacement: 70, thrust_bearing_temp: 71,
    steam_inlet_press: 72, steam_inlet_temp: 73,

    // CONSUMPTION RATE HARIAN — cols 74–76
    consumption_rate_a: 74, consumption_rate_b: 75, consumption_rate_avg: 76,
    // cols 77–78 = formula (Ton BB/MW, Ton Steam/MW) — biarkan null

    // TOTALIZER POWER — cols 79–81
    totalizer_gi: 79, totalizer_export: 80, totalizer_import: 81,

    // STOCK BATUBARA, LEVEL TANGKI — cols 82–91
    stock_batubara: 82, rcw_level_00: 83, demin_level_00: 84,
    solar_tank_a: 85, solar_tank_b: 86, solar_tank_total: 87,
    kedatangan_solar: 88, solar_boiler: 89, solar_bengkel: 90, solar_3b: 91,

    // KONSUMSI BFW — cols 92–94
    bfw_boiler_a: 92, bfw_boiler_b: 93, bfw_total: 94,

    // KONSUMSI CHEMICAL — cols 95–97
    chemical_phosphat: 95, chemical_amin: 96, chemical_hydrasin: 97,

    // SILO & FLY ASH — cols 98–101
    silo_a_pct: 98, silo_b_pct: 99,
    unloading_fly_ash_a: 100, unloading_fly_ash_b: 101,

    // PEMINDAHAN BATUBARA KE PB II — cols 102–109
    pb2_pf1_rit: 102, pb2_pf1_ton: 103, pb2_pf2_rit: 104, pb2_pf2_ton: 105,
    pb2_total_pf1_rit: 106, pb2_total_pf1_ton: 107, pb2_total_pf2_rit: 108, pb2_total_pf2_ton: 109,

    // PEMINDAHAN BATUBARA KE PB III — cols 110–113
    pb3_calc_rit: 110, pb3_calc_ton: 111, pb3_total_calc_rit: 112, pb3_total_calc_ton: 113,

    // KEDATANGAN BATUBARA — cols 114–117
    darat_24_ton: 114, darat_total_ton: 115, laut_24_ton: 116, laut_total_ton: 117,

    // KETERANGAN & TOTALIZER AIR — cols 118–123
    keterangan: 118,
    konsumsi_demin: 119, konsumsi_rcw: 120,
    penerimaan_demin_3a: 121, penerimaan_demin_1b: 122, penerimaan_rcw_1a: 123,

    // KASI & GROUP — cols 124–125
    group_name: 124, kasi_name: 125,

    // STOCK RENDAL — col 126
    stock_batubara_rendal: 126,
} as const;

const TOTAL_COLS = 127;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function set(
    row: (string | number | null)[],
    idx: number,
    val: string | number | null | undefined,
): void {
    if (val !== undefined && val !== null) row[idx] = val;
}

/** Selisih: today − yesterday. Falls back to today's value if no valid yesterday. */
function sel(
    today:     number | null | undefined,
    yesterday: number | null | undefined,
): number | null {
    const t = today != null ? Number(today) : null;
    const y = yesterday != null ? Number(yesterday) : null;
    if (t === null) return null;
    return y != null && y > 0 ? t - y : t;
}

type PrevDailyData = {
    steam:     Partial<DailyReportSteamRow>       | null;
    power:     Partial<DailyReportPowerRow>        | null;
    coal:      Partial<DailyReportCoalRow>         | null;
    turbine:   Partial<DailyReportTurbineMiscRow>  | null;
    stock:     Partial<DailyReportStockTankRow>    | null;
    transfer:  Partial<DailyReportCoalTransferRow> | null;
    totalizer: Partial<DailyReportTotalizerRow>    | null;
} | null;

// ─── Main mapper ──────────────────────────────────────────────────────────────

export function dailyReportToRow(
    isoDate: string,
    steam:    Partial<DailyReportSteamRow>        | null,
    power:    Partial<DailyReportPowerRow>         | null,
    coal:     Partial<DailyReportCoalRow>          | null,
    turbine:  Partial<DailyReportTurbineMiscRow>   | null,
    stock:    Partial<DailyReportStockTankRow>     | null,
    transfer: Partial<DailyReportCoalTransferRow>  | null,
    totalizer: Partial<DailyReportTotalizerRow>    | null,
    prev: PrevDailyData = null,
): (string | number | null)[] {
    const row: (string | number | null)[] = new Array(TOTAL_COLS).fill(null);

    row[COL.no]      = null; // auto-set by upsertDailyRow
    row[COL.tanggal] = toIndonesianDate(isoDate);

    // ── Steam 24h (totalizer fields → selisih today−yesterday) ───────────────
    if (steam) {
        const ps = prev?.steam;
        set(row, COL.prod_boiler_a_24,  sel(steam.prod_boiler_a_24,  ps?.prod_boiler_a_24));
        set(row, COL.prod_boiler_b_24,  sel(steam.prod_boiler_b_24,  ps?.prod_boiler_b_24));
        const selA = sel(steam.prod_boiler_a_24, ps?.prod_boiler_a_24) ?? 0;
        const selB = sel(steam.prod_boiler_b_24, ps?.prod_boiler_b_24) ?? 0;
        set(row, COL.prod_total_24,     selA + selB || null);

        const selInlet24   = sel(steam.inlet_turbine_24,  ps?.inlet_turbine_24);
        const selMpsI24    = sel(steam.mps_i_24,          ps?.mps_i_24);
        const selMps3a24   = sel(steam.mps_3a_24,         ps?.mps_3a_24);
        const selCondens24 = sel(steam.fully_condens_24,  ps?.fully_condens_24);
        set(row, COL.inlet_turbine_24,  selInlet24);
        set(row, COL.mps_i_24,          selMpsI24);
        set(row, COL.mps_3a_24,         selMps3a24);
        set(row, COL.lps_ii_24,         steam.lps_ii_24);   // always 0
        set(row, COL.lps_3a_24,         steam.lps_3a_24);   // always 0
        set(row, COL.fully_condens_24,  selCondens24);
        // internal_ubb = selisih inlet − selisih condensate
        if (selInlet24 !== null || selCondens24 !== null) {
            set(row, COL.internal_ubb_24, (selInlet24 ?? 0) - (selCondens24 ?? 0));
        }

        // 00.00 fields are direct readings (not totalizer)
        set(row, COL.prod_boiler_a_00,  steam.prod_boiler_a_00);
        set(row, COL.prod_boiler_b_00,  steam.prod_boiler_b_00);
        set(row, COL.prod_total_00,     steam.prod_total_00);
        set(row, COL.inlet_turbine_00,  steam.inlet_turbine_00);
        set(row, COL.co_gen_00,         steam.co_gen_00);
        set(row, COL.mps_i_00,          steam.mps_i_00);
        set(row, COL.mps_3a_00,         steam.mps_3a_00);
        set(row, COL.lps_ii_00,         steam.lps_ii_00);
        set(row, COL.lps_3a_00,         steam.lps_3a_00);
        set(row, COL.fully_condens_00,  steam.fully_condens_00);
        set(row, COL.internal_ubb_00,   steam.internal_ubb_00);
    }

    // ── Power 24h & 00.00 ─────────────────────────────────────────────────────
    if (power) {
        set(row, COL.gen_24,             power.gen_24);
        set(row, COL.dist_ib_24,         power.dist_ib_24);
        set(row, COL.dist_ii_24,         power.dist_ii_24);
        set(row, COL.dist_3a_24,         power.dist_3a_24);
        set(row, COL.dist_3b_24,         power.dist_3b_24);
        set(row, COL.internal_bus1_24,   power.internal_bus1_24);
        set(row, COL.internal_bus2_24,   power.internal_bus2_24);
        set(row, COL.pja_24,             power.pja_24);
        set(row, COL.revamp_stg175_24,   power.revamp_stg175_24);
        set(row, COL.revamp_stg125_24,   power.revamp_stg125_24);
        set(row, COL.exsport_24,         power.exsport_24);
        set(row, COL.pie_import_24,      power.pie_import_24);
        set(row, COL.pie_pln_24,         power.pie_pln_24);

        set(row, COL.gen_00,             power.gen_00);
        set(row, COL.dist_ib_00,         power.dist_ib_00);
        set(row, COL.dist_ii_00,         power.dist_ii_00);
        set(row, COL.dist_3a_00,         power.dist_3a_00);
        set(row, COL.dist_3b_00,         power.dist_3b_00);
        set(row, COL.internal_bus1_00,   power.internal_bus1_00);
        set(row, COL.internal_bus2_00,   power.internal_bus2_00);
        set(row, COL.pja_00,             power.pja_00);
        set(row, COL.revamp_stg175_00,   power.revamp_stg175_00);
        set(row, COL.revamp_stg125_00,   power.revamp_stg125_00);
        set(row, COL.exsport_00,         power.exsport_00);
        set(row, COL.pie_import_00,      power.pie_import_00);
        set(row, COL.pie_gi_00,          power.pie_gi_00);
    }

    // ── Batubara 24h (totalizer → selisih) & 00.00 ───────────────────────────
    if (coal) {
        const pc = prev?.coal;
        const cA24 = sel(coal.coal_a_24, pc?.coal_a_24);
        const cB24 = sel(coal.coal_b_24, pc?.coal_b_24);
        const cC24 = sel(coal.coal_c_24, pc?.coal_c_24);
        const cD24 = sel(coal.coal_d_24, pc?.coal_d_24);
        const cE24 = sel(coal.coal_e_24, pc?.coal_e_24);
        const cF24 = sel(coal.coal_f_24, pc?.coal_f_24);
        const totA24 = (cA24 ?? 0) + (cB24 ?? 0) + (cC24 ?? 0);
        const totB24 = (cD24 ?? 0) + (cE24 ?? 0) + (cF24 ?? 0);
        set(row, COL.coal_a_24,          cA24);
        set(row, COL.coal_b_24,          cB24);
        set(row, COL.coal_c_24,          cC24);
        set(row, COL.total_boiler_a_24,  totA24 || null);
        set(row, COL.coal_d_24,          cD24);
        set(row, COL.coal_e_24,          cE24);
        set(row, COL.coal_f_24,          cF24);
        set(row, COL.total_boiler_b_24,  totB24 || null);
        set(row, COL.grand_total_24,     (totA24 + totB24) || null);

        set(row, COL.coal_a_00,          coal.coal_a_00);
        set(row, COL.coal_b_00,          coal.coal_b_00);
        set(row, COL.coal_c_00,          coal.coal_c_00);
        set(row, COL.total_boiler_a_00,  coal.total_boiler_a_00);
        set(row, COL.coal_d_00,          coal.coal_d_00);
        set(row, COL.coal_e_00,          coal.coal_e_00);
        set(row, COL.coal_f_00,          coal.coal_f_00);
        set(row, COL.total_boiler_b_00,  coal.total_boiler_b_00);
        set(row, COL.grand_total_00,     coal.grand_total_00);
    }

    // ── Furnace & Turbine ────────────────────────────────────────────────────
    if (turbine) {
        set(row, COL.temp_furnace_a,      turbine.temp_furnace_a);
        set(row, COL.temp_furnace_b,      turbine.temp_furnace_b);
        set(row, COL.axial_displacement,  turbine.axial_displacement);
        set(row, COL.thrust_bearing_temp, turbine.thrust_bearing_temp);
        set(row, COL.steam_inlet_press,   turbine.steam_inlet_press);
        set(row, COL.steam_inlet_temp,    turbine.steam_inlet_temp);
        set(row, COL.consumption_rate_a,  turbine.consumption_rate_a);
        set(row, COL.consumption_rate_b,  turbine.consumption_rate_b);
        set(row, COL.consumption_rate_avg, turbine.consumption_rate_avg);
        set(row, COL.totalizer_gi,        turbine.totalizer_gi);
        set(row, COL.totalizer_export,    turbine.totalizer_export);
        set(row, COL.totalizer_import,    turbine.totalizer_import);
    }

    // ── Stock & Tanks ─────────────────────────────────────────────────────────
    if (stock) {
        set(row, COL.stock_batubara,       stock.stock_batubara);
        set(row, COL.rcw_level_00,         stock.rcw_level_00);
        set(row, COL.demin_level_00,       stock.demin_level_00);
        set(row, COL.solar_tank_a,         stock.solar_tank_a);
        set(row, COL.solar_tank_b,         stock.solar_tank_b);
        set(row, COL.solar_tank_total,     stock.solar_tank_total);
        set(row, COL.kedatangan_solar,     stock.kedatangan_solar);
        set(row, COL.solar_boiler,         stock.solar_boiler);
        set(row, COL.solar_bengkel,        stock.solar_bengkel);
        set(row, COL.solar_3b,             stock.solar_3b);
        set(row, COL.bfw_boiler_a,         stock.bfw_boiler_a);
        set(row, COL.bfw_boiler_b,         stock.bfw_boiler_b);
        set(row, COL.bfw_total,            stock.bfw_total);
        set(row, COL.chemical_phosphat,    stock.chemical_phosphat);
        set(row, COL.chemical_amin,        stock.chemical_amin);
        set(row, COL.chemical_hydrasin,    stock.chemical_hydrasin);
        set(row, COL.silo_a_pct,           stock.silo_a_pct);
        set(row, COL.silo_b_pct,           stock.silo_b_pct);
        set(row, COL.unloading_fly_ash_a,  stock.unloading_fly_ash_a);
        set(row, COL.unloading_fly_ash_b,  stock.unloading_fly_ash_b);
    }

    // ── Coal Transfer ─────────────────────────────────────────────────────────
    if (transfer) {
        set(row, COL.pb2_pf1_rit,          transfer.pb2_pf1_rit);
        set(row, COL.pb2_pf1_ton,          transfer.pb2_pf1_ton);
        set(row, COL.pb2_pf2_rit,          transfer.pb2_pf2_rit);
        set(row, COL.pb2_pf2_ton,          transfer.pb2_pf2_ton);
        set(row, COL.pb2_total_pf1_rit,    transfer.pb2_total_pf1_rit);
        set(row, COL.pb2_total_pf1_ton,    transfer.pb2_total_pf1_ton);
        set(row, COL.pb2_total_pf2_rit,    transfer.pb2_total_pf2_rit);
        set(row, COL.pb2_total_pf2_ton,    transfer.pb2_total_pf2_ton);
        set(row, COL.pb3_calc_rit,         transfer.pb3_calc_rit);
        set(row, COL.pb3_calc_ton,         transfer.pb3_calc_ton);
        set(row, COL.pb3_total_calc_rit,   transfer.pb3_total_calc_rit);
        set(row, COL.pb3_total_calc_ton,   transfer.pb3_total_calc_ton);
        set(row, COL.darat_24_ton,         transfer.darat_24_ton);
        set(row, COL.darat_total_ton,      transfer.darat_total_ton);
        set(row, COL.laut_24_ton,          transfer.laut_24_ton);
        set(row, COL.laut_total_ton,       transfer.laut_total_ton);
    }

    // ── Totalizer & Keterangan ───────────────────────────────────────────────
    if (totalizer) {
        set(row, COL.keterangan,           totalizer.keterangan);
        set(row, COL.konsumsi_demin,       totalizer.konsumsi_demin);
        set(row, COL.konsumsi_rcw,         totalizer.konsumsi_rcw);
        set(row, COL.penerimaan_demin_3a,  totalizer.penerimaan_demin_3a);
        set(row, COL.penerimaan_demin_1b,  totalizer.penerimaan_demin_1b);
        set(row, COL.penerimaan_rcw_1a,    totalizer.penerimaan_rcw_1a);
        set(row, COL.group_name,           totalizer.group_name);
        set(row, COL.kasi_name,            totalizer.kasi_name);
        set(row, COL.stock_batubara_rendal, totalizer.stock_batubara_rendal);
    }

    return row;
}
