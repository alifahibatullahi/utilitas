/**
 * Sample data extracted from TEMPLATE DARI STITCH/Malam.html
 * Row 5: 01 Januari 2026 - Shift Malam
 */

export const SAMPLE_MALAM_01JAN = {
  date: '2026-01-01',
  shift: 3 as const, // malam

  turbin: {
    flow_steam: 29,
    flow_cond: 28,
    press_steam: 8.3,
    temp_steam: 505,
    exh_steam: 53,
    vacuum: -0.084,
    hpo_durasi: 34,
    thrust_bearing: 57,
    metal_bearing: 82,
    vibrasi: 69,
    winding: 67,
    axial_displacement: -0.433,
    level_condenser: 718,
    temp_cw_in: 30,
    temp_cw_out: 37,
    press_deaerator: 0.28,
    temp_deaerator: 140,
    stream_days: 0,
  },

  steamDist: {
    pabrik1_flow: 48,
    pabrik1_temp: 380,
    pabrik2_flow: 0,
    pabrik2_temp: 333,
    pabrik3a_flow: 45,
    pabrik3a_temp: 404,
    pabrik3b_flow: 0,
    pabrik3b_temp: 0,
  },

  generatorGi: {
    gen_load: 8,
    gen_ampere: 987,
    gen_amp_react: 6,
    gen_cos_phi: 0.8,
    gen_tegangan: 6.1,
    gen_frequensi: 50,
    gi_sum_p: 9.5,
    gi_sum_q: 3.5,
    gi_cos_phi: 0.93,
  },

  powerDist: {
    power_ubb: 4.9,
    power_pabrik2: 8.8,
    power_pabrik3a: -1.8,
    power_pie: 11.6,
    power_pabrik3b: -0.2,
  },

  espHandling: {
    esp_a1: 43,
    esp_a2: 40,
    esp_a3: 0,
    esp_b1: 42,
    esp_b2: 40,
    esp_b3: 43,
    silo_a: 80,
    silo_b: 90,
    unloading_a: '0',
    unloading_b: 0,
    loading: '80',
    hopper: 'A',
    conveyor: 'AB',
    pf1: 0,
    pf2: 0,
  },

  tankyard: {
    tk_rcw: 4600,
    tk_demin: 1050,
    tk_solar_ab: 130,
  },

  boilerA: {
    press_steam: 8.3,
    temp_steam: 522,
    flow_steam: 62,
    totalizer_steam: 499,
    flow_bfw: 63,
    temp_bfw: 144,
    temp_furnace: 675,
    temp_flue_gas: 65,
    excess_air: 12.4,
    air_heater_ti113: 287,
    solar_m3: 0,
    stream_days: 0,
    steam_drum_press: 8.5,
    bfw_press: 12.8,
  },

  boilerB: {
    press_steam: 8.3,
    temp_steam: 520,
    flow_steam: 63,
    totalizer_steam: 505,
    flow_bfw: 63,
    temp_bfw: 144,
    temp_furnace: 680,
    temp_flue_gas: 100,
    excess_air: 9.3,
    air_heater_ti113: 290,
    solar_m3: 0,
    stream_days: 0,
    steam_drum_press: 8.5,
    bfw_press: 12.8,
  },

  coalBunker: {
    feeder_a: 0,
    feeder_b: 6.2,
    feeder_c: 7,
    feeder_d: 6.9,
    feeder_e: 6.9,
    feeder_f: 0,
    bunker_a: 0,
    bunker_b: 80,
    bunker_c: 80,
    bunker_d: 80,
    bunker_e: 80,
    bunker_f: 70,
  },
};
