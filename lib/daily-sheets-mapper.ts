/**
 * Maps DailyReport data (from Supabase) → LHUBB Google Sheets row.
 *
 * Column indices are 0-based. Col A=0 (No), Col B=1 (Tanggal). Data starts col C (2).
 *
 * Formula columns (do NOT write — sheet computes them automatically):
 *   E(4)  = prod_total_24        M(12) = internal_ubb_24
 *   P(15) = prod_total_00        X(23) = internal_ubb_00
 *   BB(53)= total_boiler_a_24    BF(57)= total_boiler_b_24    BG(58)= grand_total_24
 *   BK(62)= total_boiler_a_00    BO(66)= total_boiler_b_00    BP(67)= grand_total_00
 *   BW(74)= consumption_rate_a   BX(75)= consumption_rate_b   BY(76)= consumption_rate_avg
 *   CE(82)= stock_batubara       CJ(87)= solar_tank_total      DN(117)= laut_total_ton
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

// ─── Column index constants (0-based, A=0) ────────────────────────────────────

const COL = {
    no: 0,
    tanggal: 1,

    // PRODUKSI STEAM (24 JAM) — C(2) D(3) [E(4)=formula]
    prod_boiler_a_24: 2,
    prod_boiler_b_24: 3,
    // E(4) = formula

    // DISTRIBUSI STEAM 24h — F(5) [G(6)=null] H(7) I(8) J(9) K(10) L(11) [M(12)=formula]
    inlet_turbine_24: 5,
    // G(6) = Co Gen 24h — not in DB
    mps_i_24:         7,
    mps_3a_24:        8,
    lps_ii_24:        9,
    lps_3a_24:        10,
    fully_condens_24: 11,
    // M(12) = formula

    // PRODUKSI STEAM 00.00 — N(13) O(14) [P(15)=formula]
    prod_boiler_a_00: 13,
    prod_boiler_b_00: 14,
    // P(15) = formula

    // DISTRIBUSI STEAM 00.00 — Q(16) R(17) S(18) T(19) U(20) V(21) W(22) [X(23)=formula]
    inlet_turbine_00: 16,
    co_gen_00:        17,
    mps_i_00:         18,
    mps_3a_00:        19,
    lps_ii_00:        20,
    lps_3a_00:        21,
    fully_condens_00: 22,
    // X(23) = formula

    // POWER DISTRIBUSI MWh (selisih totalizer) — Y(24) [Z=null] AA(26) AB(27) [AC=null] AD(29) AE(30)
    power_stg_ubb_mwh:   24, // Y  = total STG UBB MWh
    // Z(25) = not specified
    power_pabrik2_mwh:   26, // AA = total pabrik 2 MWh
    power_pabrik3a_mwh:  27, // AB = total pabrik 3A MWh
    // AC(28) = not specified
    power_bb1_mwh:       29, // AD = Bus bar 1 MWh
    power_bb2_mwh:       30, // AE = Bus bar 2 MWh
    // AF–AK (31–36) = not specified

    // POWER DISTRIBUSI MW — [AL–AM=null] AN(39) AO(40) [AP=null] AQ(42) AR(43) [AS=null] AT(45) [AU=null] AV(47) [AW=null] AX(49)
    power_pabrik2_mw:    39, // AN = pabrik 2 MW
    power_pabrik3a_mw:   40, // AO = pabrik 3A MW
    // AP(41) = not specified
    power_bb1_mw:        42, // AQ = bus bar 1 MW
    power_bb2_mw:        43, // AR = bus bar 2 MW
    // AS(44) = not specified
    power_pabrik3b_mw:   45, // AT = pabrik 3B MW
    // AU(46) = not specified
    power_piu_mw:        47, // AV = PIU MW
    // AW(48) = not specified
    gi_sum_p:            49, // AX = Σ P gardu induk

    // KONSUMSI BATUBARA 24 JAM — BA(52) BC(50) BD(51) [BB(53)=formula] BE(54) BH(55) BI(56) [BF(57)=formula] [BG(58)=formula]
    // Wait — re-index: BA=52, BB=53, BC=54... let me use the correct positions
    // coal_a_24 was at 50 (BC? no... let me recalculate)
    // A=0..Z=25, AA=26..AZ=51, BA=52..
    // BC = 54? No: BA=52, BB=53, BC=54, BD=55, BE=56, BF=57, BG=58, BH=59...
    // Original: coal_a_24:50=AY?, coal_b_24:51=AZ, coal_c_24:52=BA, total_boiler_a_24:53=BB(formula)
    // coal_d_24:54=BC, coal_e_24:55=BD, coal_f_24:56=BE, total_boiler_b_24:57=BF(formula), grand_total_24:58=BG(formula)
    coal_a_24:        50, // AY
    coal_b_24:        51, // AZ
    coal_c_24:        52, // BA
    // BB(53) = formula
    coal_d_24:        54, // BC
    coal_e_24:        55, // BD
    coal_f_24:        56, // BE
    // BF(57) = formula, BG(58) = formula

    // KONSUMSI BATUBARA 00.00 — BH(59) BI(60) BJ(61) [BK(62)=formula] BL(63) BM(64) BN(65) [BO(66)=formula] [BP(67)=formula]
    coal_a_00:        59, // BH
    coal_b_00:        60, // BI
    coal_c_00:        61, // BJ
    // BK(62) = formula
    coal_d_00:        63, // BL
    coal_e_00:        64, // BM
    coal_f_00:        65, // BN
    // BO(66)=formula, BP(67)=formula

    // FURNACE & TURBINE — BQ(68) BR(69) BS(70) BT(71) BU(72) BV(73) [BW–BY(74–76)=formula]
    temp_furnace_a:      68, // BQ
    temp_furnace_b:      69, // BR
    axial_displacement:  70, // BS
    thrust_bearing_temp: 71, // BT
    steam_inlet_press:   72, // BU
    steam_inlet_temp:    73, // BV
    // BW(74)=formula, BX(75)=formula, BY(76)=formula

    // cols 77–78 = formula

    // TOTALIZER POWER — BZ(77)? wait: BW=74,BX=75,BY=76,BZ=77,CA=78,CB=79...
    // Original: totalizer_gi:79=CB, totalizer_export:80=CC, totalizer_import:81=CD
    totalizer_gi:     79, // CB
    totalizer_export: 80, // CC
    totalizer_import: 81, // CD

    // STOCK — [CE(82)=formula] CF(83) CG(84) CH(85) CI(86) [CJ(87)=formula] CK(88) CL(89) CM(90) CN(91)
    // CE(82) = formula (stock_batubara)
    rcw_level_00:     83, // CF
    demin_level_00:   84, // CG
    solar_tank_a:     85, // CH
    solar_tank_b:     86, // CI
    // CJ(87) = formula (solar_tank_total)
    kedatangan_solar: 88, // CK
    solar_boiler:     89, // CL
    solar_bengkel:    90, // CM
    solar_3b:         91, // CN

    // BFW — CO(92) CP(93) CQ(94)
    bfw_boiler_a:     92, // CO
    bfw_boiler_b:     93, // CP
    bfw_total:        94, // CQ

    // CHEMICAL — CR(95) CS(96) CT(97)
    chemical_phosphat:  95,
    chemical_amin:      96,
    chemical_hydrasin:  97,

    // SILO & FLY ASH — CU(98) CV(99) CW(100) CX(101)
    silo_a_pct:          98,
    silo_b_pct:          99,
    unloading_fly_ash_a: 100,
    unloading_fly_ash_b: 101,

    // PEMINDAHAN BATUBARA PB II — CY(102)..DF(109)
    pb2_pf1_rit:       102,
    pb2_pf1_ton:       103,
    pb2_pf2_rit:       104,
    pb2_pf2_ton:       105,
    pb2_total_pf1_rit: 106,
    pb2_total_pf1_ton: 107,
    pb2_total_pf2_rit: 108,
    pb2_total_pf2_ton: 109,

    // PEMINDAHAN BATUBARA PB III — DG(110)..DJ(113)
    pb3_calc_rit:       110,
    pb3_calc_ton:       111,
    pb3_total_calc_rit: 112,
    pb3_total_calc_ton: 113,

    // KEDATANGAN BATUBARA — DK(114) DL(115) DM(116) [DN(117)=formula]
    darat_24_ton:    114,
    darat_total_ton: 115,
    laut_24_ton:     116,
    // DN(117) = formula (laut_total_ton)

    // KETERANGAN & AIR — DO(118)..DT(123)
    keterangan:           118,
    konsumsi_demin:       119,
    konsumsi_rcw:         120,
    penerimaan_demin_3a:  121,
    penerimaan_demin_1b:  122,
    penerimaan_rcw_1a:    123,

    // GROUP & KASI — DU(124) DV(125)
    group_name: 124,
    kasi_name:  125,

    // STOCK RENDAL — DW(126)
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

/** Selisih: today − yesterday. Returns null if no valid yesterday data. */
function sel(
    today:     number | null | undefined,
    yesterday: number | null | undefined,
): number | null {
    const t = today != null ? Number(today) : null;
    const y = yesterday != null ? Number(yesterday) : null;
    if (t === null || y === null || y === 0) return null;
    return t - y;
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
    steam:     Partial<DailyReportSteamRow>        | null,
    power:     Partial<DailyReportPowerRow>         | null,
    coal:      Partial<DailyReportCoalRow>          | null,
    turbine:   Partial<DailyReportTurbineMiscRow>   | null,
    stock:     Partial<DailyReportStockTankRow>     | null,
    transfer:  Partial<DailyReportCoalTransferRow>  | null,
    totalizer: Partial<DailyReportTotalizerRow>     | null,
    prev: PrevDailyData = null,
): (string | number | null)[] {
    const row: (string | number | null)[] = new Array(TOTAL_COLS).fill(null);

    row[COL.no]      = null; // auto-set by upsertDailyRow
    row[COL.tanggal] = toIndonesianDate(isoDate);

    // ── Steam 24h (raw totalizer → selisih today−yesterday) ──────────────────
    if (steam) {
        const ps = prev?.steam;
        set(row, COL.prod_boiler_a_24, sel(steam.prod_boiler_a_24, ps?.prod_boiler_a_24));
        set(row, COL.prod_boiler_b_24, sel(steam.prod_boiler_b_24, ps?.prod_boiler_b_24));
        // E(4) = formula: prod_total_24 — skip

        set(row, COL.inlet_turbine_24, sel(steam.inlet_turbine_24, ps?.inlet_turbine_24));
        set(row, COL.mps_i_24,         sel(steam.mps_i_24,         ps?.mps_i_24));
        set(row, COL.mps_3a_24,        sel(steam.mps_3a_24,        ps?.mps_3a_24));
        set(row, COL.lps_ii_24,        steam.lps_ii_24);  // always 0
        set(row, COL.lps_3a_24,        steam.lps_3a_24);  // always 0
        set(row, COL.fully_condens_24, sel(steam.fully_condens_24, ps?.fully_condens_24));
        // M(12) = formula: internal_ubb_24 — skip

        // 00.00 = direct readings
        set(row, COL.prod_boiler_a_00, steam.prod_boiler_a_00);
        set(row, COL.prod_boiler_b_00, steam.prod_boiler_b_00);
        // P(15) = formula: prod_total_00 — skip
        set(row, COL.inlet_turbine_00, steam.inlet_turbine_00);
        set(row, COL.co_gen_00,        steam.co_gen_00);
        set(row, COL.mps_i_00,         steam.mps_i_00);
        set(row, COL.mps_3a_00,        steam.mps_3a_00);
        set(row, COL.lps_ii_00,        steam.lps_ii_00);
        set(row, COL.lps_3a_00,        steam.lps_3a_00);
        set(row, COL.fully_condens_00, steam.fully_condens_00);
        // X(23) = formula: internal_ubb_00 — skip
    }

    // ── Power distribusi (MWh selisih + MW aktual) ────────────────────────────
    if (power) {
        const pp = prev?.power;

        // MWh totals (selisih totalizer)
        const ubbMwh = sel(power.power_stg_ubb_totalizer, pp?.power_stg_ubb_totalizer) ?? 0;
        const ubbInt = Math.round(ubbMwh);
        const bb1Mwh = Math.floor(ubbInt / 2);
        const bb2Mwh = ubbInt - bb1Mwh;

        set(row, COL.power_stg_ubb_mwh,  ubbMwh || null);                                          // Y
        set(row, COL.power_pabrik2_mwh,  sel(power.power_pabrik2_totalizer,  pp?.power_pabrik2_totalizer));  // AA
        set(row, COL.power_pabrik3a_mwh, sel(power.power_pabrik3a_totalizer, pp?.power_pabrik3a_totalizer)); // AB
        if (ubbInt > 0) {
            row[COL.power_bb1_mwh] = bb1Mwh; // AD
            row[COL.power_bb2_mwh] = bb2Mwh; // AE
        }

        // MW aktual
        set(row, COL.power_pabrik2_mw,  power.power_pabrik2);    // AN
        set(row, COL.power_pabrik3a_mw, power.power_pabrik3a);   // AO
        const ubbMw = Number(power.power_ubb) || 0;
        if (ubbMw) {
            row[COL.power_bb1_mw] = ubbMw / 2; // AQ
            row[COL.power_bb2_mw] = ubbMw / 2; // AR
        }
        set(row, COL.power_pabrik3b_mw, power.power_revamping);  // AT
        set(row, COL.power_piu_mw,      power.power_pie);         // AV
    }

    // ── Gardu Induk Σ P ───────────────────────────────────────────────────────
    if (turbine) {
        set(row, COL.gi_sum_p, turbine.gi_sum_p); // AX
    }

    // ── Batubara 24h (raw totalizer → selisih) & 00.00 ───────────────────────
    if (coal) {
        const pc = prev?.coal;
        set(row, COL.coal_a_24, sel(coal.coal_a_24, pc?.coal_a_24)); // AY
        set(row, COL.coal_b_24, sel(coal.coal_b_24, pc?.coal_b_24)); // AZ
        set(row, COL.coal_c_24, sel(coal.coal_c_24, pc?.coal_c_24)); // BA
        // BB(53) = formula: total_boiler_a_24 — skip
        set(row, COL.coal_d_24, sel(coal.coal_d_24, pc?.coal_d_24)); // BC
        set(row, COL.coal_e_24, sel(coal.coal_e_24, pc?.coal_e_24)); // BD
        set(row, COL.coal_f_24, sel(coal.coal_f_24, pc?.coal_f_24)); // BE
        // BF(57)=formula, BG(58)=formula — skip

        set(row, COL.coal_a_00, coal.coal_a_00); // BH
        set(row, COL.coal_b_00, coal.coal_b_00); // BI
        set(row, COL.coal_c_00, coal.coal_c_00); // BJ
        // BK(62) = formula — skip
        set(row, COL.coal_d_00, coal.coal_d_00); // BL
        set(row, COL.coal_e_00, coal.coal_e_00); // BM
        set(row, COL.coal_f_00, coal.coal_f_00); // BN
        // BO(66)=formula, BP(67)=formula — skip
    }

    // ── Furnace & Turbine ────────────────────────────────────────────────────
    if (turbine) {
        set(row, COL.temp_furnace_a,      turbine.temp_furnace_a);      // BQ
        set(row, COL.temp_furnace_b,      turbine.temp_furnace_b);      // BR
        set(row, COL.axial_displacement,  turbine.axial_displacement);  // BS
        set(row, COL.thrust_bearing_temp, turbine.thrust_bearing_temp); // BT
        set(row, COL.steam_inlet_press,   turbine.steam_inlet_press);   // BU
        set(row, COL.steam_inlet_temp,    turbine.steam_inlet_temp);    // BV
        // BW(74)=formula, BX(75)=formula, BY(76)=formula — skip

        set(row, COL.totalizer_gi,     turbine.totalizer_gi);     // CB
        set(row, COL.totalizer_export, turbine.totalizer_export); // CC
        set(row, COL.totalizer_import, turbine.totalizer_import); // CD
    }

    // ── Stock & Tanks ─────────────────────────────────────────────────────────
    if (stock) {
        // CE(82) = formula: stock_batubara — skip
        set(row, COL.rcw_level_00,    stock.rcw_level_00);    // CF
        set(row, COL.demin_level_00,  stock.demin_level_00);  // CG
        set(row, COL.solar_tank_a,    stock.solar_tank_a);    // CH
        set(row, COL.solar_tank_b,    stock.solar_tank_b);    // CI
        // CJ(87) = formula: solar_tank_total — skip
        set(row, COL.kedatangan_solar, stock.kedatangan_solar); // CK
        set(row, COL.solar_boiler,     stock.solar_boiler);     // CL
        set(row, COL.solar_bengkel,    stock.solar_bengkel);    // CM
        set(row, COL.solar_3b,         stock.solar_3b);         // CN
        set(row, COL.bfw_boiler_a,     stock.bfw_boiler_a);    // CO
        set(row, COL.bfw_boiler_b,     stock.bfw_boiler_b);    // CP
        set(row, COL.bfw_total,        stock.bfw_total);        // CQ
        set(row, COL.chemical_phosphat,   stock.chemical_phosphat);   // CR
        set(row, COL.chemical_amin,       stock.chemical_amin);       // CS
        set(row, COL.chemical_hydrasin,   stock.chemical_hydrasin);   // CT
        set(row, COL.silo_a_pct,          stock.silo_a_pct);          // CU
        set(row, COL.silo_b_pct,          stock.silo_b_pct);          // CV
        set(row, COL.unloading_fly_ash_a, stock.unloading_fly_ash_a); // CW
        set(row, COL.unloading_fly_ash_b, stock.unloading_fly_ash_b); // CX
    }

    // ── Coal Transfer ─────────────────────────────────────────────────────────
    if (transfer) {
        set(row, COL.pb2_pf1_rit,       transfer.pb2_pf1_rit);       // CY
        set(row, COL.pb2_pf1_ton,       transfer.pb2_pf1_ton);       // CZ
        set(row, COL.pb2_pf2_rit,       transfer.pb2_pf2_rit);       // DA
        set(row, COL.pb2_pf2_ton,       transfer.pb2_pf2_ton);       // DB
        set(row, COL.pb2_total_pf1_rit, transfer.pb2_total_pf1_rit); // DC
        set(row, COL.pb2_total_pf1_ton, transfer.pb2_total_pf1_ton); // DD
        set(row, COL.pb2_total_pf2_rit, transfer.pb2_total_pf2_rit); // DE
        set(row, COL.pb2_total_pf2_ton, transfer.pb2_total_pf2_ton); // DF
        set(row, COL.pb3_calc_rit,       transfer.pb3_calc_rit);       // DG
        set(row, COL.pb3_calc_ton,       transfer.pb3_calc_ton);       // DH
        set(row, COL.pb3_total_calc_rit, transfer.pb3_total_calc_rit); // DI
        set(row, COL.pb3_total_calc_ton, transfer.pb3_total_calc_ton); // DJ
        set(row, COL.darat_24_ton,    transfer.darat_24_ton);    // DK
        set(row, COL.darat_total_ton, transfer.darat_total_ton); // DL
        set(row, COL.laut_24_ton,     transfer.laut_24_ton);     // DM
        // DN(117) = formula: laut_total_ton — skip
    }

    // ── Totalizer & Keterangan ───────────────────────────────────────────────
    if (totalizer) {
        set(row, COL.keterangan,           totalizer.keterangan);           // DO
        set(row, COL.konsumsi_demin,       totalizer.konsumsi_demin);       // DP
        set(row, COL.konsumsi_rcw,         totalizer.konsumsi_rcw);         // DQ
        set(row, COL.penerimaan_demin_3a,  totalizer.penerimaan_demin_3a);  // DR
        set(row, COL.penerimaan_demin_1b,  totalizer.penerimaan_demin_1b);  // DS
        set(row, COL.penerimaan_rcw_1a,    totalizer.penerimaan_rcw_1a);    // DT
        set(row, COL.group_name,           totalizer.group_name);           // DU
        set(row, COL.kasi_name,            totalizer.kasi_name);            // DV
        set(row, COL.stock_batubara_rendal, totalizer.stock_batubara_rendal); // DW
    }

    return row;
}
