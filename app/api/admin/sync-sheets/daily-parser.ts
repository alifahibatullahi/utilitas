/**
 * Parse a raw LHUBB sheet row to extract SELISIH values.
 * Column indices are 0-based, mirroring lib/daily-sheets-mapper.ts COL constants.
 *
 * Returns selisih values per field key, matching the daily_report_* DB columns
 * the sync logic uses to compute new raw totalizers.
 */

const COL = {
    // Steam selisih (raw totalizer diff today − yesterday)
    prod_boiler_a_24: 2,  // C
    prod_boiler_b_24: 3,  // D
    inlet_turbine_24: 5,  // F
    mps_i_24: 7,          // H
    mps_3a_24: 8,         // I
    fully_condens_24: 11, // L

    // Coal feeders selisih
    coal_a_24: 50, // AY
    coal_b_24: 51, // AZ
    coal_c_24: 52, // BA
    coal_d_24: 54, // BC
    coal_e_24: 55, // BD
    coal_f_24: 56, // BE

    // Power MWh selisih
    power_stg_ubb_totalizer: 24,  // Y  → STG UBB MWh
    power_pabrik2_totalizer: 26,  // AA → Pabrik 2 MWh
    power_pabrik3a_totalizer: 27, // AB → Pabrik 3A MWh
    // UBB total = BB1 + BB2 (cols 29, 30)
    power_bb1_mwh: 29, // AD
    power_bb2_mwh: 30, // AE

    // BFW selisih (per-boiler)
    bfw_boiler_a: 92, // CO
    bfw_boiler_b: 93, // CP
};

function parseNum(cell: string | undefined): number | null {
    if (!cell || cell.trim() === '' || cell === '-') return null;
    const cleaned = cell.replace(/"/g, '').replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

export function parseDailyRowSelisih(row: string[]): Record<string, number | null> {
    const c = (idx: number) => row[idx] ?? '';

    // UBB MWh = BB1 + BB2
    const bb1 = parseNum(c(COL.power_bb1_mwh));
    const bb2 = parseNum(c(COL.power_bb2_mwh));
    const ubbMwh = bb1 != null && bb2 != null ? bb1 + bb2 : (bb1 ?? bb2);

    return {
        prod_boiler_a_24: parseNum(c(COL.prod_boiler_a_24)),
        prod_boiler_b_24: parseNum(c(COL.prod_boiler_b_24)),
        inlet_turbine_24: parseNum(c(COL.inlet_turbine_24)),
        mps_i_24: parseNum(c(COL.mps_i_24)),
        mps_3a_24: parseNum(c(COL.mps_3a_24)),
        fully_condens_24: parseNum(c(COL.fully_condens_24)),

        coal_a_24: parseNum(c(COL.coal_a_24)),
        coal_b_24: parseNum(c(COL.coal_b_24)),
        coal_c_24: parseNum(c(COL.coal_c_24)),
        coal_d_24: parseNum(c(COL.coal_d_24)),
        coal_e_24: parseNum(c(COL.coal_e_24)),
        coal_f_24: parseNum(c(COL.coal_f_24)),

        power_ubb_totalizer: ubbMwh,
        power_pabrik2_totalizer: parseNum(c(COL.power_pabrik2_totalizer)),
        power_pabrik3a_totalizer: parseNum(c(COL.power_pabrik3a_totalizer)),
        power_stg_ubb_totalizer: parseNum(c(COL.power_stg_ubb_totalizer)),

        bfw_boiler_a: parseNum(c(COL.bfw_boiler_a)),
        bfw_boiler_b: parseNum(c(COL.bfw_boiler_b)),
    };
}
