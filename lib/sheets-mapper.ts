/**
 * Bidirectional mapper between Google Sheets rows and Supabase/form data.
 *
 * Column layout matches scripts/import-csv.ts COL object (0-indexed, 137 cols).
 * Row 0: No (row number)
 * Row 1: Tanggal (Indonesian date format)
 * Rows 2-136: operational parameters
 */

import { toIndonesianDate, fromIndonesianDate } from './google-sheets';

// ─── Column index constants (mirrors import-csv.ts COL) ───────────────────────

const COL = {
    no: 0, tanggal: 1,
    // Turbin 2-19
    turbin_flow_steam: 2, turbin_flow_cond: 3, turbin_press_steam: 4,
    turbin_temp_steam: 5, turbin_exh_steam: 6, turbin_vacuum: 7,
    turbin_hpo_durasi: 8, turbin_thrust_bearing: 9, turbin_metal_bearing: 10,
    turbin_vibrasi: 11, turbin_winding: 12, turbin_axial_displacement: 13,
    turbin_level_condenser: 14, turbin_temp_cw_in: 15, turbin_temp_cw_out: 16,
    turbin_press_deaerator: 17, turbin_temp_deaerator: 18, turbin_stream_days: 19,
    // Steam Distribution 20-27
    steam_pabrik1_flow: 20, steam_pabrik1_temp: 21,
    steam_pabrik2_flow: 22, steam_pabrik2_temp: 23,
    steam_pabrik3a_flow: 24, steam_pabrik3a_temp: 25,
    steam_pabrik3b_flow: 26, steam_pabrik3b_temp: 27,
    // Generator 28-33
    gen_load: 28, gen_ampere: 29, gen_amp_react: 30,
    gen_cos_phi: 31, gen_tegangan: 32, gen_frequensi: 33,
    // GI 34-36
    gi_sum_p: 34, gi_sum_q: 35, gi_cos_phi: 36,
    // Power Distribution 37-41
    power_ubb: 37, power_pabrik2: 38, power_pabrik3a: 39,
    power_pie: 40, power_pabrik3b: 41,
    // ESP 42-51
    esp_a1: 42, esp_a2: 43, esp_a3: 44,
    esp_b1: 45, esp_b2: 46, esp_b3: 47,
    silo_a: 48, silo_b: 49, unloading_a: 50, unloading_b: 51,
    // Handling 52-56
    loading: 52, hopper: 53, conveyor: 54, pf1: 55, pf2: 56,
    // Tankyard 57-59: BF=57(rcw), BG=58(demin), BH=59(solar)
    tk_rcw: 57, tk_demin: 58, tk_solar_ab: 59,
    // Personnel turbin: BI=60(grup), BJ=61(foreman/karu), BK=62(supervisor/kasi)
    turbin_grup: 60, turbin_karu: 61, turbin_kasi: 62,
    // Boiler A/B 63-87
    boiler_press_steam_a: 63, boiler_press_steam_b: 64,
    boiler_temp_steam_a: 65, boiler_temp_steam_b: 66,
    boiler_flow_steam_a: 67, boiler_flow_steam_b: 68,
    boiler_totalizer_steam_a: 69, boiler_totalizer_steam_b: 70,
    boiler_flow_bfw_a: 71, boiler_flow_bfw_b: 72,
    boiler_temp_bfw: 73,
    boiler_temp_furnace_a: 74, boiler_temp_furnace_b: 75,
    boiler_temp_flue_gas_a: 76, boiler_temp_flue_gas_b: 77,
    boiler_excess_air_a: 78, boiler_excess_air_b: 79,
    boiler_air_heater_a: 80, boiler_air_heater_b: 81,
    boiler_batubara_a: 82, boiler_batubara_b: 83,
    boiler_solar_a: 84, boiler_solar_b: 85,
    boiler_stream_days_a: 86, boiler_stream_days_b: 87,
    // Coal Feeders 88-93
    feeder_a: 88, feeder_b: 89, feeder_c: 90,
    feeder_d: 91, feeder_e: 92, feeder_f: 93,
    // Bunkers 94-99
    bunker_a: 94, bunker_b: 95, bunker_c: 96,
    bunker_d: 97, bunker_e: 98, bunker_f: 99,
    // Water Quality 100-126
    demin_1250_ph: 100, demin_1250_conduct: 101, demin_1250_th: 102, demin_1250_sio2: 103,
    demin_750_ph: 104, demin_750_conduct: 105, demin_750_th: 106, demin_750_sio2: 107,
    bfw_ph: 108, bfw_conduct: 109, bfw_th: 110, bfw_sio2: 111, bfw_nh4: 112, bfw_chz: 113,
    boiler_water_a_ph: 114, boiler_water_a_conduct: 115, boiler_water_a_sio2: 116, boiler_water_a_po4: 117,
    boiler_water_b_ph: 118, boiler_water_b_conduct: 119, boiler_water_b_sio2: 120, boiler_water_b_po4: 121,
    product_steam_ph: 122, product_steam_conduct: 123, product_steam_th: 124,
    product_steam_sio2: 125, product_steam_nh4: 126,
    // Personnel boiler 127-129
    // Cols 127-132 (DX-EC): Mesh-200/Out Coal Mill & Boiler personnel — kosongkan
    // Boiler personnel: ED=133(grup), EE=134(foreman/karu), EF=135(supervisor)
    boiler_grup: 133, boiler_karu: 134, boiler_kasi: 135,
    // Stock Chemical: EG=136, EH=137, EI=138
    stock_phosphate: 136, stock_amine: 137, stock_hydrazine: 138,
    // Pressure Steam Drum & BFW: EJ-EM (139-142)
    steam_drum_press_a: 139, steam_drum_press_b: 140,
    bfw_press_a: 141, bfw_press_b: 142,
};

const TOTAL_COLS = 143;

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CellValue = string | number | null;

function n(v: number | null | undefined): CellValue {
    return v ?? null;
}

function s(v: string | null | undefined): CellValue {
    return v ?? null;
}

/** Parse a Sheets cell to number, return null if empty/invalid */
function parseNum(cell: string | undefined): number | null {
    if (!cell || cell.trim() === '' || cell === '-') return null;
    const cleaned = cell.replace(/"/g, '').replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

/** Parse a Sheets cell to string, return null if empty */
function parseStr(cell: string | undefined): string | null {
    if (!cell || cell.trim() === '' || cell === '-') return null;
    return cell.replace(/"/g, '').trim();
}

// ─── Shift Report → Row ───────────────────────────────────────────────────────

export interface ShiftReportForSheets {
    date: string; // ISO "2025-04-07"
    turbin?: Record<string, number | null>;
    steamDist?: Record<string, number | null>;
    generatorGi?: Record<string, number | null>;
    powerDist?: Record<string, number | null>;
    espHandling?: Record<string, number | string | null>;
    tankyard?: Record<string, number | null>;
    personnel?: Record<string, string | null>;
    boilerA?: Record<string, number | null>;
    boilerB?: Record<string, number | null>;
    coalBunker?: Record<string, number | string | null>;
    waterQuality?: Record<string, number | null>;
}

export interface PrevBoilerTotalizer {
    totalizer_steam?: number | null;
}

/** Hitung selisih totalizer. Jika prev null/0, kembalikan null (tidak ditulis ke sheet). */
function diffTotalizer(current: number | null | undefined, prev: number | null | undefined): number | null {
    if (current == null) return null;
    if (prev == null || prev === 0) return null;
    const d = current - prev;
    return d >= 0 ? d : null;
}

/** Convert Supabase shift report data → Sheets row array */
export function shiftReportToRow(
    data: ShiftReportForSheets,
    prev?: { boilerA?: PrevBoilerTotalizer; boilerB?: PrevBoilerTotalizer },
): CellValue[] {
    const row: CellValue[] = new Array(TOTAL_COLS).fill(null);

    // Col 0: No — set by upsertShiftRow if appending
    row[COL.tanggal] = toIndonesianDate(data.date);

    // Turbin
    const t = data.turbin ?? {};
    row[COL.turbin_flow_steam] = n(t.flow_steam);
    row[COL.turbin_flow_cond] = n(t.flow_cond);
    row[COL.turbin_press_steam] = n(t.press_steam);
    row[COL.turbin_temp_steam] = n(t.temp_steam);
    row[COL.turbin_exh_steam] = n(t.exh_steam);
    row[COL.turbin_vacuum] = n(t.vacuum);
    row[COL.turbin_hpo_durasi] = n(t.hpo_durasi);
    row[COL.turbin_thrust_bearing] = n(t.thrust_bearing);
    row[COL.turbin_metal_bearing] = n(t.metal_bearing);
    row[COL.turbin_vibrasi] = n(t.vibrasi);
    row[COL.turbin_winding] = n(t.winding);
    row[COL.turbin_axial_displacement] = n(t.axial_displacement);
    row[COL.turbin_level_condenser] = n(t.level_condenser);
    row[COL.turbin_temp_cw_in] = n(t.temp_cw_in);
    row[COL.turbin_temp_cw_out] = n(t.temp_cw_out);
    row[COL.turbin_press_deaerator] = n(t.press_deaerator);
    row[COL.turbin_temp_deaerator] = n(t.temp_deaerator);
    row[COL.turbin_stream_days] = n(t.stream_days);

    // Steam Distribution
    const sd = data.steamDist ?? {};
    row[COL.steam_pabrik1_flow] = n(sd.pabrik1_flow);
    row[COL.steam_pabrik1_temp] = n(sd.pabrik1_temp);
    row[COL.steam_pabrik2_flow] = n(sd.pabrik2_flow);
    row[COL.steam_pabrik2_temp] = n(sd.pabrik2_temp);
    row[COL.steam_pabrik3a_flow] = n(sd.pabrik3a_flow);
    row[COL.steam_pabrik3a_temp] = n(sd.pabrik3a_temp);
    row[COL.steam_pabrik3b_flow] = n(sd.pabrik3b_flow);
    row[COL.steam_pabrik3b_temp] = n(sd.pabrik3b_temp);

    // Generator + GI
    const g = data.generatorGi ?? {};
    row[COL.gen_load] = n(g.gen_load);
    row[COL.gen_ampere] = n(g.gen_ampere);
    row[COL.gen_amp_react] = n(g.gen_amp_react);
    row[COL.gen_cos_phi] = n(g.gen_cos_phi);
    row[COL.gen_tegangan] = n(g.gen_tegangan);
    row[COL.gen_frequensi] = n(g.gen_frequensi);
    row[COL.gi_sum_p] = n(g.gi_sum_p);
    row[COL.gi_sum_q] = n(g.gi_sum_q);
    row[COL.gi_cos_phi] = n(g.gi_cos_phi);

    // Power Distribution
    const pd = data.powerDist ?? {};
    row[COL.power_ubb] = n(pd.power_ubb);
    row[COL.power_pabrik2] = n(pd.power_pabrik2);
    row[COL.power_pabrik3a] = n(pd.power_pabrik3a);
    row[COL.power_pie] = n(pd.power_pie);
    row[COL.power_pabrik3b] = n(pd.power_revamping);

    // ESP + Handling
    const eh = data.espHandling ?? {};
    row[COL.esp_a1] = n(eh.esp_a1 as number | null);
    row[COL.esp_a2] = n(eh.esp_a2 as number | null);
    row[COL.esp_a3] = n(eh.esp_a3 as number | null);
    row[COL.esp_b1] = n(eh.esp_b1 as number | null);
    row[COL.esp_b2] = n(eh.esp_b2 as number | null);
    row[COL.esp_b3] = n(eh.esp_b3 as number | null);
    row[COL.silo_a] = n(eh.silo_a as number | null);
    row[COL.silo_b] = n(eh.silo_b as number | null);
    row[COL.unloading_a] = n(eh.unloading_a as number | null);
    row[COL.unloading_b] = n(eh.unloading_b as number | null);
    row[COL.loading] = s(eh.loading as string | null);
    row[COL.hopper] = s(eh.hopper as string | null);
    row[COL.conveyor] = s(eh.conveyor as string | null);
    row[COL.pf1] = 0;
    row[COL.pf2] = 0;

    // Tankyard
    const ty = data.tankyard ?? {};
    row[COL.tk_rcw] = n(ty.tk_rcw);
    row[COL.tk_demin] = n(ty.tk_demin);
    row[COL.tk_solar_ab] = n(ty.tk_solar_ab);

    // Personnel turbin
    const p = data.personnel ?? {};
    row[COL.turbin_grup] = s(p.turbin_grup);
    row[COL.turbin_karu] = s(p.turbin_karu);
    row[COL.turbin_kasi] = s(p.turbin_kasi);

    // Personnel boiler: ED=133(grup), EE=134(foreman boiler), EF=135(supervisor)
    row[COL.boiler_grup] = s(p.turbin_grup); // same group as turbin
    row[COL.boiler_karu] = s(p.boiler_karu);
    row[COL.boiler_kasi] = s(p.turbin_kasi); // supervisor sama dengan turbin

    // Boiler A
    const bA = data.boilerA ?? {};
    row[COL.boiler_press_steam_a] = n(bA.press_steam);
    row[COL.boiler_temp_steam_a] = n(bA.temp_steam);
    row[COL.boiler_flow_steam_a] = n(bA.flow_steam);
    row[COL.boiler_totalizer_steam_a] = n(diffTotalizer(bA.totalizer_steam, prev?.boilerA?.totalizer_steam));
    row[COL.boiler_flow_bfw_a] = n(bA.flow_bfw);
    row[COL.boiler_temp_furnace_a] = n(bA.temp_furnace);
    row[COL.boiler_temp_flue_gas_a] = n(bA.temp_flue_gas);
    row[COL.boiler_excess_air_a] = n(bA.o2);
    row[COL.boiler_air_heater_a] = n(bA.air_heater_ti113);
    row[COL.boiler_batubara_a] = n(bA.batubara_ton);
    row[COL.boiler_solar_a] = n(bA.solar_m3);
    row[COL.boiler_stream_days_a] = n(bA.stream_days);
    row[COL.steam_drum_press_a] = n(bA.steam_drum_press);
    row[COL.bfw_press_a] = n(bA.bfw_press);

    // Boiler B
    const bB = data.boilerB ?? {};
    row[COL.boiler_press_steam_b] = n(bB.press_steam);
    row[COL.boiler_temp_steam_b] = n(bB.temp_steam);
    row[COL.boiler_flow_steam_b] = n(bB.flow_steam);
    row[COL.boiler_totalizer_steam_b] = n(diffTotalizer(bB.totalizer_steam, prev?.boilerB?.totalizer_steam));
    row[COL.boiler_flow_bfw_b] = n(bB.flow_bfw);
    row[COL.boiler_temp_bfw] = n(bB.temp_bfw ?? bA.temp_bfw); // shared col
    row[COL.boiler_temp_furnace_b] = n(bB.temp_furnace);
    row[COL.boiler_temp_flue_gas_b] = n(bB.temp_flue_gas);
    row[COL.boiler_excess_air_b] = n(bB.excess_air);
    row[COL.boiler_air_heater_b] = n(bB.air_heater_ti113);
    row[COL.boiler_batubara_b] = n(bB.batubara_ton);
    row[COL.boiler_solar_b] = n(bB.solar_m3);
    row[COL.boiler_stream_days_b] = n(bB.stream_days);
    row[COL.steam_drum_press_b] = n(bB.steam_drum_press);
    row[COL.bfw_press_b] = n(bB.bfw_press);

    // Coal Feeders — flow dari boiler tab (CK-CP)
    const cb = data.coalBunker ?? {};
    row[COL.feeder_a] = n(bA.feeder_a_flow);
    row[COL.feeder_b] = n(bA.feeder_b_flow);
    row[COL.feeder_c] = n(bA.feeder_c_flow);
    row[COL.feeder_d] = n(bB.feeder_d_flow);
    row[COL.feeder_e] = n(bB.feeder_e_flow);
    row[COL.feeder_f] = n(bB.feeder_f_flow);
    // Bunkers
    row[COL.bunker_a] = n(cb.bunker_a as number | null);
    row[COL.bunker_b] = n(cb.bunker_b as number | null);
    row[COL.bunker_c] = n(cb.bunker_c as number | null);
    row[COL.bunker_d] = n(cb.bunker_d as number | null);
    row[COL.bunker_e] = n(cb.bunker_e as number | null);
    row[COL.bunker_f] = n(cb.bunker_f as number | null);

    // Water Quality
    const wq = data.waterQuality ?? {};
    row[COL.demin_1250_ph] = n(wq.demin_1250_ph);
    row[COL.demin_1250_conduct] = n(wq.demin_1250_conduct);
    row[COL.demin_1250_th] = n(wq.demin_1250_th);
    row[COL.demin_1250_sio2] = n(wq.demin_1250_sio2);
    row[COL.demin_750_ph] = n(wq.demin_750_ph);
    row[COL.demin_750_conduct] = n(wq.demin_750_conduct);
    row[COL.demin_750_th] = n(wq.demin_750_th);
    row[COL.demin_750_sio2] = n(wq.demin_750_sio2);
    row[COL.bfw_ph] = n(wq.bfw_ph);
    row[COL.bfw_conduct] = n(wq.bfw_conduct);
    row[COL.bfw_th] = n(wq.bfw_th);
    row[COL.bfw_sio2] = n(wq.bfw_sio2);
    row[COL.bfw_nh4] = n(wq.bfw_nh4);
    row[COL.bfw_chz] = n(wq.bfw_chz);
    row[COL.boiler_water_a_ph] = n(wq.boiler_water_a_ph);
    row[COL.boiler_water_a_conduct] = n(wq.boiler_water_a_conduct);
    row[COL.boiler_water_a_sio2] = n(wq.boiler_water_a_sio2);
    row[COL.boiler_water_a_po4] = n(wq.boiler_water_a_po4);
    row[COL.boiler_water_b_ph] = n(wq.boiler_water_b_ph);
    row[COL.boiler_water_b_conduct] = n(wq.boiler_water_b_conduct);
    row[COL.boiler_water_b_sio2] = n(wq.boiler_water_b_sio2);
    row[COL.boiler_water_b_po4] = n(wq.boiler_water_b_po4);
    row[COL.product_steam_ph] = n(wq.product_steam_ph);
    row[COL.product_steam_conduct] = n(wq.product_steam_conduct);
    row[COL.product_steam_th] = n(wq.product_steam_th);
    row[COL.product_steam_sio2] = n(wq.product_steam_sio2);
    row[COL.product_steam_nh4] = n(wq.product_steam_nh4);
    // Stock Chemical EG-EI (136-138)
    row[COL.stock_phosphate] = n(wq.stock_phosphate as number | null);
    row[COL.stock_amine] = n(wq.stock_amine as number | null);
    row[COL.stock_hydrazine] = n(wq.stock_hydrazine as number | null);

    // Pressure Steam Drum & BFW — EJ-EM (139-142)
    row[COL.steam_drum_press_a] = n(bA.steam_drum_press);
    row[COL.steam_drum_press_b] = n(bB.steam_drum_press);
    row[COL.bfw_press_a] = n(bA.bfw_press);
    row[COL.bfw_press_b] = n(bB.bfw_press);

    return row;
}

// ─── Row → Shift Report ───────────────────────────────────────────────────────

export interface ShiftRowParsed {
    date: string | null; // ISO
    turbin: Record<string, number | null>;
    steamDist: Record<string, number | null>;
    generatorGi: Record<string, number | null>;
    powerDist: Record<string, number | null>;
    espHandling: Record<string, number | string | null>;
    tankyard: Record<string, number | null>;
    personnel: Record<string, string | null>;
    boilerA: Record<string, number | null>;
    boilerB: Record<string, number | null>;
    coalBunker: Record<string, number | null>;
    waterQuality: Record<string, number | null>;
}

/** Parse a raw Sheets row array → structured form data */
export function rowToShiftReport(row: string[]): ShiftRowParsed {
    const c = (idx: number) => row[idx] ?? '';

    return {
        date: fromIndonesianDate(c(COL.tanggal)),

        turbin: {
            flow_steam: parseNum(c(COL.turbin_flow_steam)),
            flow_cond: parseNum(c(COL.turbin_flow_cond)),
            press_steam: parseNum(c(COL.turbin_press_steam)),
            temp_steam: parseNum(c(COL.turbin_temp_steam)),
            exh_steam: parseNum(c(COL.turbin_exh_steam)),
            vacuum: parseNum(c(COL.turbin_vacuum)),
            hpo_durasi: parseNum(c(COL.turbin_hpo_durasi)),
            thrust_bearing: parseNum(c(COL.turbin_thrust_bearing)),
            metal_bearing: parseNum(c(COL.turbin_metal_bearing)),
            vibrasi: parseNum(c(COL.turbin_vibrasi)),
            winding: parseNum(c(COL.turbin_winding)),
            axial_displacement: parseNum(c(COL.turbin_axial_displacement)),
            level_condenser: parseNum(c(COL.turbin_level_condenser)),
            temp_cw_in: parseNum(c(COL.turbin_temp_cw_in)),
            temp_cw_out: parseNum(c(COL.turbin_temp_cw_out)),
            press_deaerator: parseNum(c(COL.turbin_press_deaerator)),
            temp_deaerator: parseNum(c(COL.turbin_temp_deaerator)),
            stream_days: parseNum(c(COL.turbin_stream_days)),
        },

        steamDist: {
            pabrik1_flow: parseNum(c(COL.steam_pabrik1_flow)),
            pabrik1_temp: parseNum(c(COL.steam_pabrik1_temp)),
            pabrik2_flow: parseNum(c(COL.steam_pabrik2_flow)),
            pabrik2_temp: parseNum(c(COL.steam_pabrik2_temp)),
            pabrik3a_flow: parseNum(c(COL.steam_pabrik3a_flow)),
            pabrik3a_temp: parseNum(c(COL.steam_pabrik3a_temp)),
            pabrik3b_flow: parseNum(c(COL.steam_pabrik3b_flow)),
            pabrik3b_temp: parseNum(c(COL.steam_pabrik3b_temp)),
        },

        generatorGi: {
            gen_load: parseNum(c(COL.gen_load)),
            gen_ampere: parseNum(c(COL.gen_ampere)),
            gen_amp_react: parseNum(c(COL.gen_amp_react)),
            gen_cos_phi: parseNum(c(COL.gen_cos_phi)),
            gen_tegangan: parseNum(c(COL.gen_tegangan)),
            gen_frequensi: parseNum(c(COL.gen_frequensi)),
            gi_sum_p: parseNum(c(COL.gi_sum_p)),
            gi_sum_q: parseNum(c(COL.gi_sum_q)),
            gi_cos_phi: parseNum(c(COL.gi_cos_phi)),
        },

        powerDist: {
            power_ubb: parseNum(c(COL.power_ubb)),
            power_pabrik2: parseNum(c(COL.power_pabrik2)),
            power_pabrik3a: parseNum(c(COL.power_pabrik3a)),
            power_pie: parseNum(c(COL.power_pie)),
            power_pabrik3b: parseNum(c(COL.power_pabrik3b)),
        },

        espHandling: {
            esp_a1: parseNum(c(COL.esp_a1)),
            esp_a2: parseNum(c(COL.esp_a2)),
            esp_a3: parseNum(c(COL.esp_a3)),
            esp_b1: parseNum(c(COL.esp_b1)),
            esp_b2: parseNum(c(COL.esp_b2)),
            esp_b3: parseNum(c(COL.esp_b3)),
            silo_a: parseNum(c(COL.silo_a)),
            silo_b: parseNum(c(COL.silo_b)),
            unloading_a: parseStr(c(COL.unloading_a)),
            unloading_b: parseNum(c(COL.unloading_b)),
            loading: parseStr(c(COL.loading)),
            hopper: parseStr(c(COL.hopper)),
            conveyor: parseStr(c(COL.conveyor)),
            pf1: parseNum(c(COL.pf1)),
            pf2: parseNum(c(COL.pf2)),
        },

        tankyard: {
            tk_rcw: parseNum(c(COL.tk_rcw)),
            tk_demin: parseNum(c(COL.tk_demin)),
            tk_solar_ab: parseNum(c(COL.tk_solar_ab)),
        },

        personnel: {
            turbin_grup: parseStr(c(COL.turbin_grup)),
            turbin_karu: parseStr(c(COL.turbin_karu)),
            turbin_kasi: parseStr(c(COL.turbin_kasi)),
        },

        boilerA: {
            press_steam: parseNum(c(COL.boiler_press_steam_a)),
            temp_steam: parseNum(c(COL.boiler_temp_steam_a)),
            flow_steam: parseNum(c(COL.boiler_flow_steam_a)),
            totalizer_steam: parseNum(c(COL.boiler_totalizer_steam_a)),
            flow_bfw: parseNum(c(COL.boiler_flow_bfw_a)),
            temp_bfw: parseNum(c(COL.boiler_temp_bfw)),
            temp_furnace: parseNum(c(COL.boiler_temp_furnace_a)),
            temp_flue_gas: parseNum(c(COL.boiler_temp_flue_gas_a)),
            excess_air: parseNum(c(COL.boiler_excess_air_a)),
            air_heater_ti113: parseNum(c(COL.boiler_air_heater_a)),
            batubara_ton: parseNum(c(COL.boiler_batubara_a)),
            solar_m3: parseNum(c(COL.boiler_solar_a)),
            stream_days: parseNum(c(COL.boiler_stream_days_a)),
            steam_drum_press: parseNum(c(COL.steam_drum_press_a)),
            bfw_press: parseNum(c(COL.bfw_press_a)),
        },

        boilerB: {
            press_steam: parseNum(c(COL.boiler_press_steam_b)),
            temp_steam: parseNum(c(COL.boiler_temp_steam_b)),
            flow_steam: parseNum(c(COL.boiler_flow_steam_b)),
            totalizer_steam: parseNum(c(COL.boiler_totalizer_steam_b)),
            flow_bfw: parseNum(c(COL.boiler_flow_bfw_b)),
            temp_bfw: parseNum(c(COL.boiler_temp_bfw)),
            temp_furnace: parseNum(c(COL.boiler_temp_furnace_b)),
            temp_flue_gas: parseNum(c(COL.boiler_temp_flue_gas_b)),
            excess_air: parseNum(c(COL.boiler_excess_air_b)),
            air_heater_ti113: parseNum(c(COL.boiler_air_heater_b)),
            batubara_ton: parseNum(c(COL.boiler_batubara_b)),
            solar_m3: parseNum(c(COL.boiler_solar_b)),
            stream_days: parseNum(c(COL.boiler_stream_days_b)),
            steam_drum_press: parseNum(c(COL.steam_drum_press_b)),
            bfw_press: parseNum(c(COL.bfw_press_b)),
        },

        coalBunker: {
            feeder_a: parseNum(c(COL.feeder_a)),
            feeder_b: parseNum(c(COL.feeder_b)),
            feeder_c: parseNum(c(COL.feeder_c)),
            feeder_d: parseNum(c(COL.feeder_d)),
            feeder_e: parseNum(c(COL.feeder_e)),
            feeder_f: parseNum(c(COL.feeder_f)),
            bunker_a: parseNum(c(COL.bunker_a)),
            bunker_b: parseNum(c(COL.bunker_b)),
            bunker_c: parseNum(c(COL.bunker_c)),
            bunker_d: parseNum(c(COL.bunker_d)),
            bunker_e: parseNum(c(COL.bunker_e)),
            bunker_f: parseNum(c(COL.bunker_f)),
        },

        waterQuality: {
            demin_1250_ph: parseNum(c(COL.demin_1250_ph)),
            demin_1250_conduct: parseNum(c(COL.demin_1250_conduct)),
            demin_1250_th: parseNum(c(COL.demin_1250_th)),
            demin_1250_sio2: parseNum(c(COL.demin_1250_sio2)),
            demin_750_ph: parseNum(c(COL.demin_750_ph)),
            demin_750_conduct: parseNum(c(COL.demin_750_conduct)),
            demin_750_th: parseNum(c(COL.demin_750_th)),
            demin_750_sio2: parseNum(c(COL.demin_750_sio2)),
            bfw_ph: parseNum(c(COL.bfw_ph)),
            bfw_conduct: parseNum(c(COL.bfw_conduct)),
            bfw_th: parseNum(c(COL.bfw_th)),
            bfw_sio2: parseNum(c(COL.bfw_sio2)),
            bfw_nh4: parseNum(c(COL.bfw_nh4)),
            bfw_chz: parseNum(c(COL.bfw_chz)),
            boiler_water_a_ph: parseNum(c(COL.boiler_water_a_ph)),
            boiler_water_a_conduct: parseNum(c(COL.boiler_water_a_conduct)),
            boiler_water_a_sio2: parseNum(c(COL.boiler_water_a_sio2)),
            boiler_water_a_po4: parseNum(c(COL.boiler_water_a_po4)),
            boiler_water_b_ph: parseNum(c(COL.boiler_water_b_ph)),
            boiler_water_b_conduct: parseNum(c(COL.boiler_water_b_conduct)),
            boiler_water_b_sio2: parseNum(c(COL.boiler_water_b_sio2)),
            boiler_water_b_po4: parseNum(c(COL.boiler_water_b_po4)),
            product_steam_ph: parseNum(c(COL.product_steam_ph)),
            product_steam_conduct: parseNum(c(COL.product_steam_conduct)),
            product_steam_th: parseNum(c(COL.product_steam_th)),
            product_steam_sio2: parseNum(c(COL.product_steam_sio2)),
            product_steam_nh4: parseNum(c(COL.product_steam_nh4)),
        },
    };
}
