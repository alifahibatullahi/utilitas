export interface ParameterDef {
    id: string;
    label: string;
    group: string;
    extract: (row: any) => number | string | null;
}

export const PARAMETERS: ParameterDef[] = [
    // ─── BOILER A ───
    {
        id: 'boiler_a_flow_steam',
        label: 'Flow Steam Boiler A',
        group: 'Boiler A',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.flow_steam ?? null
    },
    {
        id: 'boiler_a_press_steam',
        label: 'Pressure Steam Boiler A',
        group: 'Boiler A',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.press_steam ?? null
    },
    {
        id: 'boiler_a_temp_steam',
        label: 'Temperature Steam Boiler A',
        group: 'Boiler A',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.temp_steam ?? null
    },
    {
        id: 'boiler_a_steam_drum_press',
        label: 'Steam Drum Press Boiler A',
        group: 'Boiler A',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.steam_drum_press ?? null
    },
    {
        id: 'boiler_a_flow_bfw',
        label: 'Flow BFW Boiler A',
        group: 'Boiler A',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.flow_bfw ?? null
    },
    {
        id: 'boiler_a_press_bfw',
        label: 'Pressure BFW Boiler A',
        group: 'Boiler A',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.bfw_press ?? null
    },
    {
        id: 'boiler_a_temp_furnace',
        label: 'Temp Furnace Boiler A',
        group: 'Boiler A',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.temp_furnace ?? null
    },
    
    // ─── BOILER B ───
    {
        id: 'boiler_b_flow_steam',
        label: 'Flow Steam Boiler B',
        group: 'Boiler B',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.flow_steam ?? null
    },
    {
        id: 'boiler_b_press_steam',
        label: 'Pressure Steam Boiler B',
        group: 'Boiler B',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.press_steam ?? null
    },
    {
        id: 'boiler_b_temp_steam',
        label: 'Temperature Steam Boiler B',
        group: 'Boiler B',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.temp_steam ?? null
    },
    {
        id: 'boiler_b_steam_drum_press',
        label: 'Steam Drum Press Boiler B',
        group: 'Boiler B',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.steam_drum_press ?? null
    },
    {
        id: 'boiler_b_flow_bfw',
        label: 'Flow BFW Boiler B',
        group: 'Boiler B',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.flow_bfw ?? null
    },
    {
        id: 'boiler_b_press_bfw',
        label: 'Pressure BFW Boiler B',
        group: 'Boiler B',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.bfw_press ?? null
    },
    {
        id: 'boiler_b_temp_furnace',
        label: 'Temp Furnace Boiler B',
        group: 'Boiler B',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.temp_furnace ?? null
    },

    // ─── TURBIN ───
    {
        id: 'turbin_steam_inlet',
        label: 'Flow Steam Inlet Turbin',
        group: 'Turbin',
        extract: (r) => r.shift_turbin?.[0]?.flow_steam ?? null
    },
    {
        id: 'turbin_press_steam',
        label: 'Pressure Steam Inlet Turbin',
        group: 'Turbin',
        extract: (r) => r.shift_turbin?.[0]?.press_steam ?? null
    },
    {
        id: 'turbin_temp_steam',
        label: 'Temp Steam Inlet Turbin',
        group: 'Turbin',
        extract: (r) => r.shift_turbin?.[0]?.temp_steam ?? null
    },
    {
        id: 'turbin_vacuum',
        label: 'Vacuum Turbin',
        group: 'Turbin',
        extract: (r) => r.shift_turbin?.[0]?.vacuum ?? null
    },
    {
        id: 'turbin_level_condenser',
        label: 'Level Condenser',
        group: 'Turbin',
        extract: (r) => r.shift_turbin?.[0]?.level_condenser ?? null
    },
    {
        id: 'turbin_flow_cond',
        label: 'Flow Condensate',
        group: 'Turbin',
        extract: (r) => r.shift_turbin?.[0]?.flow_cond ?? null
    },
    {
        id: 'turbin_vibrasi',
        label: 'Vibrasi Turbin',
        group: 'Turbin',
        extract: (r) => r.shift_turbin?.[0]?.vibrasi ?? null
    },

    // ─── GENERATOR ───
    {
        id: 'gen_load',
        label: 'Gen Load (MW)',
        group: 'Generator',
        extract: (r) => r.shift_generator_gi?.[0]?.gen_load ?? null
    },
    {
        id: 'gen_ampere',
        label: 'Gen Ampere (A)',
        group: 'Generator',
        extract: (r) => r.shift_generator_gi?.[0]?.gen_ampere ?? null
    },
    {
        id: 'gen_tegangan',
        label: 'Gen Tegangan (kV)',
        group: 'Generator',
        extract: (r) => r.shift_generator_gi?.[0]?.gen_tegangan ?? null
    },
    {
        id: 'gen_cos_phi',
        label: 'Gen Cos Phi',
        group: 'Generator',
        extract: (r) => r.shift_generator_gi?.[0]?.gen_cos_phi ?? null
    },
    {
        id: 'gen_frequensi',
        label: 'Gen Frekuensi (Hz)',
        group: 'Generator',
        extract: (r) => r.shift_generator_gi?.[0]?.gen_frequensi ?? null
    },

    // ─── DISTRIBUSI STEAM ───
    {
        id: 'dist_pabrik1_flow',
        label: 'Flow Steam Pabrik 1B',
        group: 'Distribusi Steam',
        extract: (r) => r.shift_steam_dist?.[0]?.pabrik1_flow ?? null
    },
    {
        id: 'dist_pabrik2_flow',
        label: 'Flow Steam Pabrik 2',
        group: 'Distribusi Steam',
        extract: (r) => r.shift_steam_dist?.[0]?.pabrik2_flow ?? null
    },
    {
        id: 'dist_pabrik3a_flow',
        label: 'Flow Steam Pabrik 3A',
        group: 'Distribusi Steam',
        extract: (r) => r.shift_steam_dist?.[0]?.pabrik3a_flow ?? null
    },

    // ─── WATER QUALITY ───
    {
        id: 'wq_demin_1250_ph',
        label: 'pH Demin 1250',
        group: 'Water Quality',
        extract: (r) => r.shift_water_quality?.[0]?.demin_1250_ph ?? null
    },
    {
        id: 'wq_demin_1250_conduct',
        label: 'Conductivity Demin 1250',
        group: 'Water Quality',
        extract: (r) => r.shift_water_quality?.[0]?.demin_1250_conduct ?? null
    },
    {
        id: 'wq_bfw_ph',
        label: 'pH BFW',
        group: 'Water Quality',
        extract: (r) => r.shift_water_quality?.[0]?.bfw_ph ?? null
    },
    {
        id: 'wq_boiler_a_ph',
        label: 'pH Boiler Water A',
        group: 'Water Quality',
        extract: (r) => r.shift_water_quality?.[0]?.boiler_water_a_ph ?? null
    },
    {
        id: 'wq_boiler_b_ph',
        label: 'pH Boiler Water B',
        group: 'Water Quality',
        extract: (r) => r.shift_water_quality?.[0]?.boiler_water_b_ph ?? null
    },

    // ─── TANK LEVEL ───
    {
        id: 'tk_demin_level',
        label: 'Tank Demin Level',
        group: 'Tank Level',
        extract: (r) => r.shift_tankyard?.[0]?.tk_demin ?? null
    },
    {
        id: 'tk_rcw_level',
        label: 'Tank RCW Level',
        group: 'Tank Level',
        extract: (r) => r.shift_tankyard?.[0]?.tk_rcw ?? null
    },
    {
        id: 'tk_solar_level',
        label: 'Tank Solar Level',
        group: 'Tank Level',
        extract: (r) => r.shift_tankyard?.[0]?.tk_solar_ab ?? null
    },
];

export const groupedParameters = PARAMETERS.reduce((acc, param) => {
    if (!acc[param.group]) acc[param.group] = [];
    acc[param.group].push(param);
    return acc;
}, {} as Record<string, ParameterDef[]>);
