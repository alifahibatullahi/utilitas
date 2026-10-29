/**
 * Registri tunggal: field dashboard → tag E-Logsheet APM.
 *
 * Hanya tag yang terdaftar di sini yang disalin ke `apm_readings` (bukan ±480 parameter
 * seluruh unit). Parameter dicocokkan lewat TAG, bukan id parameter APM — id berbeda per
 * unit, dan tag adalah yang tertulis di DCS. Beberapa tag APM dipakai ganda dalam satu
 * unit (mis. 1TI123 untuk fan bearing A/B/C); tag di bawah sudah dicek unik per unit
 * (28 Okt 2026). Kalau suatu saat ganda, sync melewatinya dan mencatat peringatan.
 *
 * Totaliser coal feeder tidak ada di APM (unit Coal Mill hanya punya flow & temp feeder).
 */

export const APM_UNIT = {
    PANEL_BOILER_A: 2048,
    PANEL_BOILER_B: 2113,
    PANEL_TURBIN: 2114,
} as const;

export interface ApmField {
    unitId: number;
    /** Lebih dari satu tag = nilai dirata-rata (mis. dua termokopel furnace). */
    tags: readonly string[];
}

function boilerFields(prefix: 'A' | 'B', unitId: number, n: '1' | '2', feeders: readonly [string, string, string]): Record<string, ApmField> {
    return {
        [`${prefix}.steamFlow`]: { unitId, tags: [`${n}FI102`] },
        [`${prefix}.steamTotal`]: { unitId, tags: [`${n}FQ102`] },
        [`${prefix}.feedWaterFlow`]: { unitId, tags: [`${n}FI101`] },
        [`${prefix}.feedWaterTotal`]: { unitId, tags: [`${n}FQ101`] },
        [`${prefix}.feedWaterTemp`]: { unitId, tags: [`${n}TI101`] },
        [`${prefix}.furnaceTemp`]: { unitId, tags: [`${n}TI08A`, `${n}TI108B`] },
        [`${prefix}.furnacePressure`]: { unitId, tags: [`${n}PI104A`, `${n}PI104B`] },
        [`${prefix}.hotAir`]: { unitId, tags: [`${n}TI113A`, `${n}TI113B`] },
        [`${prefix}.o2`]: { unitId, tags: [`${n}AI101`] },
        [`${prefix}.feeder1`]: { unitId, tags: [feeders[0]] },
        [`${prefix}.feeder2`]: { unitId, tags: [feeders[1]] },
        [`${prefix}.feeder3`]: { unitId, tags: [feeders[2]] },
    };
}

export const APM_FIELDS: Record<string, ApmField> = {
    ...boilerFields('A', APM_UNIT.PANEL_BOILER_A, '1', ['PVA', 'PVB', 'PVC']),
    ...boilerFields('B', APM_UNIT.PANEL_BOILER_B, '2', ['PVD', 'PVE', 'PVF']),

    'stg.loadMW': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['MW_505'] },
    'stg.frequency': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['HZ_UBB'] },
    'stg.internalMW': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['Internal_UBB_MW'] },
    'stg.steamInletFlow': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['FI201'] },
    'stg.steamInletTotal': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['Tot_Steam_Inlet'] },
    'stg.condensateFlow': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['FI202'] },
    'stg.condensateTotal': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['Tot_Condensate'] },
    'stg.vacuum': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['PI207'] },
    'stg.thrustBearing': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['TI208'] },
    'stg.pabrik1Flow': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['FI1122'] },
    'stg.pabrik1Total': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['Tot_Steam_PB1'] },
    'stg.pabrik2Flow': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['FI403'] },
    'stg.pabrik2Total': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['Tot_Steam_PB2'] },
    'stg.pabrik3Flow': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['FI402'] },
    'stg.pabrik3Total': { unitId: APM_UNIT.PANEL_TURBIN, tags: ['Tot_Steam_PB3'] },
};

/** Unit APM yang diambil sync, beserta tag yang disalin dari masing-masing. */
export function apmTagsByUnit(): Map<number, Set<string>> {
    const out = new Map<number, Set<string>>();
    for (const f of Object.values(APM_FIELDS)) {
        const set = out.get(f.unitId) ?? new Set<string>();
        for (const t of f.tags) set.add(t);
        out.set(f.unitId, set);
    }
    return out;
}
