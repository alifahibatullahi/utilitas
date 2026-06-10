// ─── Kelengkapan tab laporan HARIAN — SATU sumber kebenaran ───
// Dipakai bersama oleh:
//   - components/input-harian/InputHarianForm.tsx (centang tab + tombol Publish)
//   - app/api/whatsapp/notify-ready-daily/route.ts (notif "siap publish")
// Tujuan: centang tab & syarat notif SELALU sinkron (tidak melenceng).
//
// Konvensi: sebuah tab dianggap "lengkap" kalau SEMUA field input wajibnya terisi
// (mirror laporan shift). Field instantaneous/operasional yang di-nol-kan & dikunci
// saat boiler/turbin SHUTDOWN tidak diwajibkan (cukup totalizer 24h), karena form
// meng-auto-zero/auto-fill field tsb — sama persis dgn perilaku laporan shift.
//
// Tab yang field-nya OPSIONAL/event-based (Coal Bunker level, Chemical, Stock BB
// in/out) TIDAK dicek di sini — di form tetap pakai "visited" karena tidak selalu
// ada data. Notif "siap publish" hanya bergantung pada Boiler A/B, Turbin, Power.

type Obj = Record<string, unknown>;

export interface DailyState {
    steam: Obj;
    power: Obj;
    coal: Obj;
    turbineMisc: Obj;
    stockTank: Obj;
    totalizer: Obj;
}

const filled = (v: unknown) => v !== null && v !== undefined && v !== '';
const has = (obj: Obj | undefined | null, keys: string[]) => !!obj && keys.every((k) => filled(obj[k]));

/** Boiler A/B lengkap. Saat shutdown → cukup totalizer (produksi/BFW/feeder 24h). */
export function isBoilerComplete(s: DailyState, boiler: 'a' | 'b'): boolean {
    const b = boiler;
    const feeders = b === 'a' ? ['a', 'b', 'c'] : ['d', 'e', 'f'];
    const tot24 = feeders.map((f) => `coal_${f}_24`);
    const isShutdown = s.turbineMisc?.[`status_boiler_${b}`] === 'shutdown';

    if (isShutdown) {
        return has(s.steam, [`prod_boiler_${b}_24`])
            && has(s.stockTank, [`bfw_boiler_${b}`])
            && has(s.coal, tot24);
    }
    // Flow per-feeder (coal_*_00) HANYA wajib untuk feeder yang running. Feeder
    // standby/emergency/not-standby → field flow dikunci & kosong di form, jadi
    // tidak boleh diwajibkan (kalau dipaksa, centang tak pernah muncul saat ada
    // feeder standby). Totalizer 24h tetap wajib untuk semua feeder.
    const runningFlow = feeders
        .filter((f) => s.turbineMisc?.[`status_feeder_${f}`] === 'running')
        .map((f) => `coal_${f}_00`);
    return has(s.turbineMisc, [
        `press_steam_${b}`, `temp_steam_${b}`, `bfw_press_${b}`, `temp_bfw_${b}`,
        `temp_furnace_${b}`, `air_heater_ti113_${b}`, `temp_flue_gas_${b}`, `o2_${b}`,
        `primary_air_${b}`, `secondary_air_${b}`, `steam_drum_press_${b}`,
    ])
        && has(s.steam, [`prod_boiler_${b}_00`, `prod_boiler_${b}_24`])
        && has(s.stockTank, [`flow_bfw_${b}`, `bfw_boiler_${b}`])
        && has(s.coal, [...tot24, ...runningFlow]);
}

/** Turbin & Distribusi Steam lengkap (totalizer + flow tiap distribusi + parameter turbin). */
export function isTurbinComplete(s: DailyState): boolean {
    return has(s.steam, [
        'inlet_turbine_24', 'inlet_turbine_00',
        'mps_i_24', 'mps_i_00',
        'mps_3a_24', 'mps_3a_00',
        'fully_condens_24', 'fully_condens_00',
    ])
        && has(s.turbineMisc, ['steam_inlet_press', 'steam_inlet_temp', 'thrust_bearing_temp', 'axial_displacement']);
}

/** Power/Generator lengkap. Pabrik 3B (revamping) & PIU (pie) tidak diwajibkan
 *  karena default kosong (plant bisa off). Field generator output di-auto-zero
 *  saat turbin shutdown → tetap terhitung terisi. */
export function isPowerComplete(s: DailyState): boolean {
    return has(s.power, [
        'gen_00', 'power_ubb', 'power_ubb_totalizer',
        'power_pabrik2', 'power_pabrik2_totalizer',
        'power_pabrik3a', 'power_pabrik3a_totalizer',
        'power_stg_ubb_totalizer',
    ])
        && has(s.turbineMisc, [
            'gen_ampere', 'gen_tegangan', 'gen_amp_react', 'gen_frequensi', 'gen_cos_phi',
            'gi_sum_p', 'gi_sum_q', 'gi_cos_phi',
        ]);
}

/** PIU lengkap (totalizer export/import + D-R). */
export function isPiuComplete(s: DailyState): boolean {
    return has(s.turbineMisc, ['totalizer_export', 'totalizer_import', 'pie_dr']);
}

/** Handling lengkap (level tankyard + totalizer konsumsi/penerimaan).
 *  `solar_boiler` TIDAK diwajibkan: di TabHandling itu CalculatedField (turunan
 *  aktivitas Permintaan Solar tujuan "Boiler A+B"), bukan input — tidak pernah
 *  masuk state stockTank, jadi kalau diwajibkan tab tak pernah bisa lengkap. */
export function isHandlingComplete(s: DailyState): boolean {
    return has(s.stockTank, ['rcw_level_00', 'demin_level_00', 'solar_tank_a'])
        && has(s.totalizer, ['tot_rcw_1a', 'tot_demin', 'tot_demin_pb1', 'tot_demin_pb3', 'tot_hydrant', 'tot_basin', 'tot_service']);
}

/** Silo & Fly Ash lengkap (level silo + trafo ESP jam 24.00). */
export function isSiloComplete(s: DailyState): boolean {
    return has(s.stockTank, ['silo_a_pct', 'silo_b_pct', 'trafo_a1', 'trafo_a2', 'trafo_a3', 'trafo_b1', 'trafo_b2', 'trafo_b3']);
}

/** Coal Bunker lengkap — level bunker A–F (jam 24.00) wajib terisi. */
export function isCoalBunkerComplete(s: DailyState): boolean {
    return has(s.stockTank, ['bunker_a', 'bunker_b', 'bunker_c', 'bunker_d', 'bunker_e', 'bunker_f']);
}
