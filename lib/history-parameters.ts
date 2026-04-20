export interface ParameterDef {
    id: string;
    label: string;
    group: string;
    unit: string;
    /** Which data source this param comes from: 'shift', 'daily', or 'both' */
    source: 'shift' | 'daily' | 'both';
    extract: (row: any) => number | string | null;
}

export const PARAMETERS: ParameterDef[] = [
    // ═══════════════════════════════════════════
    // SHIFT PARAMETERS
    // ═══════════════════════════════════════════

    // ─── BOILER A ───
    {
        id: 'boiler_a_flow_steam',
        label: 'Flow Steam Boiler A',
        group: 'Boiler A',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_steam?.[0]?.prod_boiler_a_00 ?? null
            : r.shift_boiler?.find((b: any) => b.boiler === 'A')?.flow_steam ?? null
    },
    {
        id: 'boiler_a_press_steam',
        label: 'Pressure Steam Boiler A',
        group: 'Boiler A',
        unit: 'Kg/cm²',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.press_steam ?? null
    },
    {
        id: 'boiler_a_temp_steam',
        label: 'Temperature Steam Boiler A',
        group: 'Boiler A',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.temp_steam ?? null
    },
    {
        id: 'boiler_a_steam_drum_press',
        label: 'Steam Drum Press Boiler A',
        group: 'Boiler A',
        unit: 'Kg/cm²',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.steam_drum_press ?? null
    },
    {
        id: 'boiler_a_flow_bfw',
        label: 'Flow BFW Boiler A',
        group: 'Boiler A',
        unit: 'Ton/h',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.flow_bfw ?? null
    },
    {
        id: 'boiler_a_press_bfw',
        label: 'Pressure BFW Boiler A',
        group: 'Boiler A',
        unit: 'Kg/cm²',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.bfw_press ?? null
    },
    {
        id: 'boiler_a_temp_furnace',
        label: 'Temp Furnace Boiler A',
        group: 'Boiler A',
        unit: '°C',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_turbine_misc?.[0]?.temp_furnace_a ?? null
            : r.shift_boiler?.find((b: any) => b.boiler === 'A')?.temp_furnace ?? null
    },
    {
        id: 'boiler_a_temp_flue_gas',
        label: 'Temp Flue Gas Boiler A',
        group: 'Boiler A',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.temp_flue_gas ?? null
    },
    {
        id: 'boiler_a_excess_air',
        label: 'Excess Air Boiler A',
        group: 'Boiler A',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.excess_air ?? null
    },
    {
        id: 'boiler_a_batubara_ton',
        label: 'Batubara Boiler A',
        group: 'Boiler A',
        unit: 'Ton',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.batubara_ton ?? null
    },
    {
        id: 'boiler_a_stream_days',
        label: 'Stream Days Boiler A',
        group: 'Boiler A',
        unit: 'Hari',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.stream_days ?? null
    },
    {
        id: 'boiler_a_o2',
        label: 'O₂ Boiler A',
        group: 'Boiler A',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.o2 ?? null
    },
    {
        id: 'boiler_a_primary_air',
        label: 'Primary Air Boiler A',
        group: 'Boiler A',
        unit: 'mmAq',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.primary_air ?? null
    },
    {
        id: 'boiler_a_secondary_air',
        label: 'Secondary Air Boiler A',
        group: 'Boiler A',
        unit: 'mmAq',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'A')?.secondary_air ?? null
    },

    // ─── BOILER B ───
    {
        id: 'boiler_b_flow_steam',
        label: 'Flow Steam Boiler B',
        group: 'Boiler B',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_steam?.[0]?.prod_boiler_b_00 ?? null
            : r.shift_boiler?.find((b: any) => b.boiler === 'B')?.flow_steam ?? null
    },
    {
        id: 'boiler_b_press_steam',
        label: 'Pressure Steam Boiler B',
        group: 'Boiler B',
        unit: 'Kg/cm²',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.press_steam ?? null
    },
    {
        id: 'boiler_b_temp_steam',
        label: 'Temperature Steam Boiler B',
        group: 'Boiler B',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.temp_steam ?? null
    },
    {
        id: 'boiler_b_steam_drum_press',
        label: 'Steam Drum Press Boiler B',
        group: 'Boiler B',
        unit: 'Kg/cm²',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.steam_drum_press ?? null
    },
    {
        id: 'boiler_b_flow_bfw',
        label: 'Flow BFW Boiler B',
        group: 'Boiler B',
        unit: 'Ton/h',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.flow_bfw ?? null
    },
    {
        id: 'boiler_b_press_bfw',
        label: 'Pressure BFW Boiler B',
        group: 'Boiler B',
        unit: 'Kg/cm²',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.bfw_press ?? null
    },
    {
        id: 'boiler_b_temp_furnace',
        label: 'Temp Furnace Boiler B',
        group: 'Boiler B',
        unit: '°C',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_turbine_misc?.[0]?.temp_furnace_b ?? null
            : r.shift_boiler?.find((b: any) => b.boiler === 'B')?.temp_furnace ?? null
    },
    {
        id: 'boiler_b_temp_flue_gas',
        label: 'Temp Flue Gas Boiler B',
        group: 'Boiler B',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.temp_flue_gas ?? null
    },
    {
        id: 'boiler_b_excess_air',
        label: 'Excess Air Boiler B',
        group: 'Boiler B',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.excess_air ?? null
    },
    {
        id: 'boiler_b_batubara_ton',
        label: 'Batubara Boiler B',
        group: 'Boiler B',
        unit: 'Ton',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.batubara_ton ?? null
    },
    {
        id: 'boiler_b_stream_days',
        label: 'Stream Days Boiler B',
        group: 'Boiler B',
        unit: 'Hari',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.stream_days ?? null
    },
    {
        id: 'boiler_b_o2',
        label: 'O₂ Boiler B',
        group: 'Boiler B',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.o2 ?? null
    },
    {
        id: 'boiler_b_primary_air',
        label: 'Primary Air Boiler B',
        group: 'Boiler B',
        unit: 'mmAq',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.primary_air ?? null
    },
    {
        id: 'boiler_b_secondary_air',
        label: 'Secondary Air Boiler B',
        group: 'Boiler B',
        unit: 'mmAq',
        source: 'shift',
        extract: (r) => r.shift_boiler?.find((b: any) => b.boiler === 'B')?.secondary_air ?? null
    },

    // ─── TURBIN ───
    {
        id: 'turbin_steam_inlet',
        label: 'Flow Steam Inlet Turbin',
        group: 'Turbin',
        unit: 'Ton/h',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.flow_steam ?? null
    },
    {
        id: 'turbin_press_steam',
        label: 'Pressure Steam Inlet Turbin',
        group: 'Turbin',
        unit: 'Kg/cm²',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_turbine_misc?.[0]?.steam_inlet_press ?? null
            : r.shift_turbin?.[0]?.press_steam ?? null
    },
    {
        id: 'turbin_temp_steam',
        label: 'Temp Steam Inlet Turbin',
        group: 'Turbin',
        unit: '°C',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_turbine_misc?.[0]?.steam_inlet_temp ?? null
            : r.shift_turbin?.[0]?.temp_steam ?? null
    },
    {
        id: 'turbin_vacuum',
        label: 'Vacuum Turbin',
        group: 'Turbin',
        unit: 'Kg/cm²',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.vacuum ?? null
    },
    {
        id: 'turbin_exh_steam',
        label: 'Exhaust Steam Turbin',
        group: 'Turbin',
        unit: 'Kg/cm²',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.exh_steam ?? null
    },
    {
        id: 'turbin_level_condenser',
        label: 'Level Condenser',
        group: 'Turbin',
        unit: 'mm',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.level_condenser ?? null
    },
    {
        id: 'turbin_flow_cond',
        label: 'Flow Condensate',
        group: 'Turbin',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_steam?.[0]?.fully_condens_00 ?? null
            : r.shift_turbin?.[0]?.flow_cond ?? null
    },
    {
        id: 'turbin_vibrasi',
        label: 'Vibrasi Turbin',
        group: 'Turbin',
        unit: 'mm/s',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.vibrasi ?? null
    },
    {
        id: 'turbin_thrust_bearing',
        label: 'Thrust Bearing',
        group: 'Turbin',
        unit: '°C',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_turbine_misc?.[0]?.thrust_bearing_temp ?? null
            : r.shift_turbin?.[0]?.thrust_bearing ?? null
    },
    {
        id: 'turbin_metal_bearing',
        label: 'Metal Bearing',
        group: 'Turbin',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.metal_bearing ?? null
    },
    {
        id: 'turbin_winding',
        label: 'Winding',
        group: 'Turbin',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.winding ?? null
    },
    {
        id: 'turbin_axial_displacement',
        label: 'Axial Displacement',
        group: 'Turbin',
        unit: 'mm',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_turbine_misc?.[0]?.axial_displacement ?? null
            : r.shift_turbin?.[0]?.axial_displacement ?? null
    },
    {
        id: 'turbin_press_deaerator',
        label: 'Pressure Deaerator',
        group: 'Turbin',
        unit: 'Kg/cm²',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.press_deaerator ?? null
    },
    {
        id: 'turbin_temp_deaerator',
        label: 'Temp Deaerator',
        group: 'Turbin',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.temp_deaerator ?? null
    },
    {
        id: 'turbin_press_lps',
        label: 'Pressure LPS',
        group: 'Turbin',
        unit: 'Kg/cm²',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.press_lps ?? null
    },
    {
        id: 'turbin_temp_cw_in',
        label: 'Temp CW In',
        group: 'Turbin',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.temp_cw_in ?? null
    },
    {
        id: 'turbin_temp_cw_out',
        label: 'Temp CW Out',
        group: 'Turbin',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.temp_cw_out ?? null
    },
    {
        id: 'turbin_stream_days',
        label: 'Stream Days Turbin',
        group: 'Turbin',
        unit: 'Hari',
        source: 'shift',
        extract: (r) => r.shift_turbin?.[0]?.stream_days ?? null
    },

    // ─── GENERATOR ───
    {
        id: 'gen_load',
        label: 'STG UBB Load',
        group: 'Generator',
        unit: 'MW',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_power?.[0]?.gen_00 ?? null
            : r.shift_generator_gi?.[0]?.gen_load ?? null
    },
    {
        id: 'gen_ampere',
        label: 'Gen Ampere',
        group: 'Generator',
        unit: 'A',
        source: 'shift',
        extract: (r) => r.shift_generator_gi?.[0]?.gen_ampere ?? null
    },
    {
        id: 'gen_amp_react',
        label: 'Gen Amp Reaktif',
        group: 'Generator',
        unit: 'A',
        source: 'shift',
        extract: (r) => r.shift_generator_gi?.[0]?.gen_amp_react ?? null
    },
    {
        id: 'gen_tegangan',
        label: 'Gen Tegangan',
        group: 'Generator',
        unit: 'kV',
        source: 'shift',
        extract: (r) => r.shift_generator_gi?.[0]?.gen_tegangan ?? null
    },
    {
        id: 'gen_cos_phi',
        label: 'Gen Cos Phi',
        group: 'Generator',
        unit: '-',
        source: 'shift',
        extract: (r) => r.shift_generator_gi?.[0]?.gen_cos_phi ?? null
    },
    {
        id: 'gen_frequensi',
        label: 'Gen Frekuensi',
        group: 'Generator',
        unit: 'Hz',
        source: 'shift',
        extract: (r) => r.shift_generator_gi?.[0]?.gen_frequensi ?? null
    },
    {
        id: 'gi_sum_p',
        label: 'GI Sum P',
        group: 'Generator',
        unit: 'MW',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_turbine_misc?.[0]?.gi_sum_p ?? null
            : r.shift_generator_gi?.[0]?.gi_sum_p ?? null
    },
    {
        id: 'gi_sum_q',
        label: 'GI Sum Q',
        group: 'Generator',
        unit: 'MVAR',
        source: 'shift',
        extract: (r) => r.shift_generator_gi?.[0]?.gi_sum_q ?? null
    },
    {
        id: 'gi_cos_phi',
        label: 'GI Cos Phi',
        group: 'Generator',
        unit: '-',
        source: 'shift',
        extract: (r) => r.shift_generator_gi?.[0]?.gi_cos_phi ?? null
    },

    // ─── DISTRIBUSI STEAM ───
    {
        id: 'dist_pabrik1_flow',
        label: 'Flow Steam Pabrik 1B',
        group: 'Distribusi Steam',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_steam?.[0]?.mps_i_00 ?? null
            : r.shift_steam_dist?.[0]?.pabrik1_flow ?? null
    },
    {
        id: 'dist_pabrik1_temp',
        label: 'Temp Steam Pabrik 1B',
        group: 'Distribusi Steam',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_steam_dist?.[0]?.pabrik1_temp ?? null
    },
    {
        id: 'dist_pabrik2_flow',
        label: 'Flow Steam Pabrik 2',
        group: 'Distribusi Steam',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_steam?.[0]?.lps_ii_00 ?? null
            : r.shift_steam_dist?.[0]?.pabrik2_flow ?? null
    },
    {
        id: 'dist_pabrik2_temp',
        label: 'Temp Steam Pabrik 2',
        group: 'Distribusi Steam',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_steam_dist?.[0]?.pabrik2_temp ?? null
    },
    {
        id: 'dist_pabrik3a_flow',
        label: 'Flow Steam Pabrik 3A',
        group: 'Distribusi Steam',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_steam?.[0]?.mps_3a_00 ?? null
            : r.shift_steam_dist?.[0]?.pabrik3a_flow ?? null
    },
    {
        id: 'dist_pabrik3a_temp',
        label: 'Temp Steam Pabrik 3A',
        group: 'Distribusi Steam',
        unit: '°C',
        source: 'shift',
        extract: (r) => r.shift_steam_dist?.[0]?.pabrik3a_temp ?? null
    },
    {
        id: 'dist_pabrik3b_flow',
        label: 'Flow Steam Pabrik 3B',
        group: 'Distribusi Steam',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_steam?.[0]?.lps_3a_00 ?? null
            : r.shift_steam_dist?.[0]?.pabrik3b_flow ?? null
    },

    // ─── DISTRIBUSI POWER ───
    {
        id: 'power_ubb',
        label: 'Power Internal UBB',
        group: 'Distribusi Power',
        unit: 'MW',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_power?.[0]?.power_ubb ?? null
            : r.shift_power_dist?.[0]?.power_ubb ?? null
    },
    {
        id: 'power_pabrik2',
        label: 'Power Pabrik 2',
        group: 'Distribusi Power',
        unit: 'MW',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_power?.[0]?.power_pabrik2 ?? null
            : r.shift_power_dist?.[0]?.power_pabrik2 ?? null
    },
    {
        id: 'power_pabrik3a',
        label: 'Power Pabrik 3A',
        group: 'Distribusi Power',
        unit: 'MW',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_power?.[0]?.power_pabrik3a ?? null
            : r.shift_power_dist?.[0]?.power_pabrik3a ?? null
    },
    {
        id: 'power_revamping',
        label: 'Power Pabrik 3B',
        group: 'Distribusi Power',
        unit: 'MW',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_power?.[0]?.power_revamping ?? null
            : r.shift_power_dist?.[0]?.power_revamping ?? null
    },
    {
        id: 'power_pie',
        label: 'Power PIU',
        group: 'Distribusi Power',
        unit: 'MW',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_power?.[0]?.power_pie ?? null
            : r.shift_power_dist?.[0]?.power_pie ?? null
    },
    {
        id: 'power_pabrik3b',
        label: 'Power Pabrik 3B (Shift)',
        group: 'Distribusi Power',
        unit: 'MW',
        source: 'shift',
        extract: (r) => r.shift_power_dist?.[0]?.power_pabrik3b ?? null
    },

    // ─── ESP & HANDLING (SHIFT) ───
    {
        id: 'esp_a1',
        label: 'ESP A1',
        group: 'ESP & Handling',
        unit: 'mA',
        source: 'shift',
        extract: (r) => r.shift_esp_handling?.[0]?.esp_a1 ?? null
    },
    {
        id: 'esp_a2',
        label: 'ESP A2',
        group: 'ESP & Handling',
        unit: 'mA',
        source: 'shift',
        extract: (r) => r.shift_esp_handling?.[0]?.esp_a2 ?? null
    },
    {
        id: 'esp_a3',
        label: 'ESP A3',
        group: 'ESP & Handling',
        unit: 'mA',
        source: 'shift',
        extract: (r) => r.shift_esp_handling?.[0]?.esp_a3 ?? null
    },
    {
        id: 'esp_b1',
        label: 'ESP B1',
        group: 'ESP & Handling',
        unit: 'mA',
        source: 'shift',
        extract: (r) => r.shift_esp_handling?.[0]?.esp_b1 ?? null
    },
    {
        id: 'esp_b2',
        label: 'ESP B2',
        group: 'ESP & Handling',
        unit: 'mA',
        source: 'shift',
        extract: (r) => r.shift_esp_handling?.[0]?.esp_b2 ?? null
    },
    {
        id: 'esp_b3',
        label: 'ESP B3',
        group: 'ESP & Handling',
        unit: 'mA',
        source: 'shift',
        extract: (r) => r.shift_esp_handling?.[0]?.esp_b3 ?? null
    },
    {
        id: 'silo_a',
        label: 'Silo A',
        group: 'ESP & Handling',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_esp_handling?.[0]?.silo_a ?? null
    },
    {
        id: 'silo_b',
        label: 'Silo B',
        group: 'ESP & Handling',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_esp_handling?.[0]?.silo_b ?? null
    },

    // ─── COAL BUNKER (SHIFT) ───
    {
        id: 'bunker_a',
        label: 'Bunker A',
        group: 'Coal Bunker',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_coal_bunker?.[0]?.bunker_a ?? null
    },
    {
        id: 'bunker_b',
        label: 'Bunker B',
        group: 'Coal Bunker',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_coal_bunker?.[0]?.bunker_b ?? null
    },
    {
        id: 'bunker_c',
        label: 'Bunker C',
        group: 'Coal Bunker',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_coal_bunker?.[0]?.bunker_c ?? null
    },
    {
        id: 'bunker_d',
        label: 'Bunker D',
        group: 'Coal Bunker',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_coal_bunker?.[0]?.bunker_d ?? null
    },
    {
        id: 'bunker_e',
        label: 'Bunker E',
        group: 'Coal Bunker',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_coal_bunker?.[0]?.bunker_e ?? null
    },
    {
        id: 'bunker_f',
        label: 'Bunker F',
        group: 'Coal Bunker',
        unit: '%',
        source: 'shift',
        extract: (r) => r.shift_coal_bunker?.[0]?.bunker_f ?? null
    },
    {
        id: 'feeder_a',
        label: 'Flow Coal Feeder A',
        group: 'Coal Bunker',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_coal?.[0]?.coal_a_00 ?? null
            : r.shift_coal_bunker?.[0]?.feeder_a ?? null
    },
    {
        id: 'feeder_b',
        label: 'Flow Coal Feeder B',
        group: 'Coal Bunker',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_coal?.[0]?.coal_b_00 ?? null
            : r.shift_coal_bunker?.[0]?.feeder_b ?? null
    },
    {
        id: 'feeder_c',
        label: 'Flow Coal Feeder C',
        group: 'Coal Bunker',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_coal?.[0]?.coal_c_00 ?? null
            : r.shift_coal_bunker?.[0]?.feeder_c ?? null
    },
    {
        id: 'feeder_d',
        label: 'Flow Coal Feeder D',
        group: 'Coal Bunker',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_coal?.[0]?.coal_d_00 ?? null
            : r.shift_coal_bunker?.[0]?.feeder_d ?? null
    },
    {
        id: 'feeder_e',
        label: 'Flow Coal Feeder E',
        group: 'Coal Bunker',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_coal?.[0]?.coal_e_00 ?? null
            : r.shift_coal_bunker?.[0]?.feeder_e ?? null
    },
    {
        id: 'feeder_f',
        label: 'Flow Coal Feeder F',
        group: 'Coal Bunker',
        unit: 'Ton/h',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_coal?.[0]?.coal_f_00 ?? null
            : r.shift_coal_bunker?.[0]?.feeder_f ?? null
    },

    // ─── WATER QUALITY ───
    {
        id: 'wq_demin_1250_ph',
        label: 'pH Demin 1250',
        group: 'Water Quality',
        unit: '-',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.demin_1250_ph ?? null
    },
    {
        id: 'wq_demin_1250_conduct',
        label: 'Conductivity Demin 1250',
        group: 'Water Quality',
        unit: 'µS/cm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.demin_1250_conduct ?? null
    },
    {
        id: 'wq_demin_1250_th',
        label: 'TH Demin 1250',
        group: 'Water Quality',
        unit: 'ppm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.demin_1250_th ?? null
    },
    {
        id: 'wq_demin_1250_sio2',
        label: 'SiO₂ Demin 1250',
        group: 'Water Quality',
        unit: 'ppm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.demin_1250_sio2 ?? null
    },
    {
        id: 'wq_demin_750_ph',
        label: 'pH Demin 750',
        group: 'Water Quality',
        unit: '-',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.demin_750_ph ?? null
    },
    {
        id: 'wq_demin_750_conduct',
        label: 'Conductivity Demin 750',
        group: 'Water Quality',
        unit: 'µS/cm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.demin_750_conduct ?? null
    },
    {
        id: 'wq_bfw_ph',
        label: 'pH BFW',
        group: 'Water Quality',
        unit: '-',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.bfw_ph ?? null
    },
    {
        id: 'wq_bfw_conduct',
        label: 'Conductivity BFW',
        group: 'Water Quality',
        unit: 'µS/cm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.bfw_conduct ?? null
    },
    {
        id: 'wq_bfw_nh4',
        label: 'NH₄ BFW',
        group: 'Water Quality',
        unit: 'ppm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.bfw_nh4 ?? null
    },
    {
        id: 'wq_bfw_chz',
        label: 'CHZ BFW',
        group: 'Water Quality',
        unit: 'ppm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.bfw_chz ?? null
    },
    {
        id: 'wq_boiler_a_ph',
        label: 'pH Boiler Water A',
        group: 'Water Quality',
        unit: '-',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.boiler_water_a_ph ?? null
    },
    {
        id: 'wq_boiler_a_conduct',
        label: 'Conductivity Boiler Water A',
        group: 'Water Quality',
        unit: 'µS/cm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.boiler_water_a_conduct ?? null
    },
    {
        id: 'wq_boiler_a_sio2',
        label: 'SiO₂ Boiler Water A',
        group: 'Water Quality',
        unit: 'ppm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.boiler_water_a_sio2 ?? null
    },
    {
        id: 'wq_boiler_a_po4',
        label: 'PO₄ Boiler Water A',
        group: 'Water Quality',
        unit: 'ppm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.boiler_water_a_po4 ?? null
    },
    {
        id: 'wq_boiler_b_ph',
        label: 'pH Boiler Water B',
        group: 'Water Quality',
        unit: '-',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.boiler_water_b_ph ?? null
    },
    {
        id: 'wq_boiler_b_conduct',
        label: 'Conductivity Boiler Water B',
        group: 'Water Quality',
        unit: 'µS/cm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.boiler_water_b_conduct ?? null
    },
    {
        id: 'wq_boiler_b_sio2',
        label: 'SiO₂ Boiler Water B',
        group: 'Water Quality',
        unit: 'ppm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.boiler_water_b_sio2 ?? null
    },
    {
        id: 'wq_boiler_b_po4',
        label: 'PO₄ Boiler Water B',
        group: 'Water Quality',
        unit: 'ppm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.boiler_water_b_po4 ?? null
    },
    {
        id: 'wq_product_steam_ph',
        label: 'pH Product Steam',
        group: 'Water Quality',
        unit: '-',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.product_steam_ph ?? null
    },
    {
        id: 'wq_product_steam_conduct',
        label: 'Conductivity Product Steam',
        group: 'Water Quality',
        unit: 'µS/cm',
        source: 'shift',
        extract: (r) => r.shift_water_quality?.[0]?.product_steam_conduct ?? null
    },

    // ─── TANK LEVEL ───
    {
        id: 'tk_demin_level',
        label: 'Tank Demin Level',
        group: 'Tank Level',
        unit: 'm³',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_stock_tank?.[0]?.demin_level_00 ?? null
            : r.shift_tankyard?.[0]?.tk_demin ?? null
    },
    {
        id: 'tk_rcw_level',
        label: 'Tank RCW Level',
        group: 'Tank Level',
        unit: 'm³',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? r.daily_report_stock_tank?.[0]?.rcw_level_00 ?? null
            : r.shift_tankyard?.[0]?.tk_rcw ?? null
    },
    {
        id: 'tk_solar_level',
        label: 'Tank Solar Level',
        group: 'Tank Level',
        unit: 'm³',
        source: 'both',
        extract: (r) => r._source === 'daily'
            ? (r.daily_report_stock_tank?.[0]?.solar_tank_a ?? null)
            : r.shift_tankyard?.[0]?.tk_solar_ab ?? null
    },

    // ═══════════════════════════════════════════
    // DAILY (HARIAN) PARAMETERS — jam 24:00
    // ═══════════════════════════════════════════

    // ─── HARIAN: STEAM ───
    {
        id: 'daily_steam_prod_a_24',
        label: 'Prod Boiler A (24 Jam)',
        group: 'Harian: Steam',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_steam?.[0]?.prod_boiler_a_24 ?? null
    },
    {
        id: 'daily_steam_prod_b_24',
        label: 'Prod Boiler B (24 Jam)',
        group: 'Harian: Steam',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_steam?.[0]?.prod_boiler_b_24 ?? null
    },
    {
        id: 'daily_steam_prod_total_24',
        label: 'Prod Total Steam (24 Jam)',
        group: 'Harian: Steam',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_steam?.[0]?.prod_total_24 ?? null
    },
    {
        id: 'daily_steam_inlet_turbin_24',
        label: 'Inlet Turbine (24 Jam)',
        group: 'Harian: Steam',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_steam?.[0]?.inlet_turbine_24 ?? null
    },
    {
        id: 'daily_steam_prod_a_00',
        label: 'Prod Boiler A (00:00)',
        group: 'Harian: Steam',
        unit: 'T/H',
        source: 'daily',
        extract: (r) => r.daily_report_steam?.[0]?.prod_boiler_a_00 ?? null
    },
    {
        id: 'daily_steam_prod_b_00',
        label: 'Prod Boiler B (00:00)',
        group: 'Harian: Steam',
        unit: 'T/H',
        source: 'daily',
        extract: (r) => r.daily_report_steam?.[0]?.prod_boiler_b_00 ?? null
    },
    {
        id: 'daily_steam_prod_total_00',
        label: 'Prod Total Steam (00:00)',
        group: 'Harian: Steam',
        unit: 'T/H',
        source: 'daily',
        extract: (r) => r.daily_report_steam?.[0]?.prod_total_00 ?? null
    },
    {
        id: 'daily_steam_mps_i_24',
        label: 'MPS I (24 Jam)',
        group: 'Harian: Steam',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_steam?.[0]?.mps_i_24 ?? null
    },
    {
        id: 'daily_steam_mps_3a_24',
        label: 'MPS 3A (24 Jam)',
        group: 'Harian: Steam',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_steam?.[0]?.mps_3a_24 ?? null
    },
    {
        id: 'daily_steam_lps_ii_24',
        label: 'LPS II (24 Jam)',
        group: 'Harian: Steam',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_steam?.[0]?.lps_ii_24 ?? null
    },
    {
        id: 'daily_steam_lps_3a_24',
        label: 'LPS 3A (24 Jam)',
        group: 'Harian: Steam',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_steam?.[0]?.lps_3a_24 ?? null
    },

    // ─── HARIAN: POWER ───
    {
        id: 'daily_power_gen_24',
        label: 'Gen Power (24 Jam)',
        group: 'Harian: Power',
        unit: 'MWh',
        source: 'daily',
        extract: (r) => r.daily_report_power?.[0]?.gen_24 ?? null
    },
    {
        id: 'daily_power_gen_00',
        label: 'Gen Power (00:00)',
        group: 'Harian: Power',
        unit: 'MW',
        source: 'daily',
        extract: (r) => r.daily_report_power?.[0]?.gen_00 ?? null
    },
    {
        id: 'daily_power_dist_ib_24',
        label: 'Dist IB (24 Jam)',
        group: 'Harian: Power',
        unit: 'MWh',
        source: 'daily',
        extract: (r) => r.daily_report_power?.[0]?.dist_ib_24 ?? null
    },
    {
        id: 'daily_power_dist_ii_24',
        label: 'Dist II (24 Jam)',
        group: 'Harian: Power',
        unit: 'MWh',
        source: 'daily',
        extract: (r) => r.daily_report_power?.[0]?.dist_ii_24 ?? null
    },
    {
        id: 'daily_power_dist_3a_24',
        label: 'Dist 3A (24 Jam)',
        group: 'Harian: Power',
        unit: 'MWh',
        source: 'daily',
        extract: (r) => r.daily_report_power?.[0]?.dist_3a_24 ?? null
    },
    {
        id: 'daily_power_dist_3b_24',
        label: 'Dist 3B (24 Jam)',
        group: 'Harian: Power',
        unit: 'MWh',
        source: 'daily',
        extract: (r) => r.daily_report_power?.[0]?.dist_3b_24 ?? null
    },
    {
        id: 'daily_power_exsport_24',
        label: 'Eksport PLN (24 Jam)',
        group: 'Harian: Power',
        unit: 'MWh',
        source: 'daily',
        extract: (r) => r.daily_report_power?.[0]?.exsport_24 ?? null
    },
    {
        id: 'daily_power_pie_pln_24',
        label: 'PIE PLN (24 Jam)',
        group: 'Harian: Power',
        unit: 'MWh',
        source: 'daily',
        extract: (r) => r.daily_report_power?.[0]?.pie_pln_24 ?? null
    },

    // ─── HARIAN: COAL ───
    {
        id: 'daily_coal_total_a_24',
        label: 'Coal Total Boiler A (24 Jam)',
        group: 'Harian: Coal',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_coal?.[0]?.total_boiler_a_24 ?? null
    },
    {
        id: 'daily_coal_total_b_24',
        label: 'Coal Total Boiler B (24 Jam)',
        group: 'Harian: Coal',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_coal?.[0]?.total_boiler_b_24 ?? null
    },
    {
        id: 'daily_coal_grand_total_24',
        label: 'Coal Grand Total (24 Jam)',
        group: 'Harian: Coal',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_coal?.[0]?.grand_total_24 ?? null
    },
    {
        id: 'daily_coal_grand_total_00',
        label: 'Coal Grand Total (00:00)',
        group: 'Harian: Coal',
        unit: 'Ton/Jam',
        source: 'daily',
        extract: (r) => r.daily_report_coal?.[0]?.grand_total_00 ?? null
    },

    // ─── HARIAN: TURBINE MISC ───
    {
        id: 'daily_consumption_rate_a',
        label: 'Consumption Rate A',
        group: 'Harian: Turbine & Misc',
        unit: 'Ton/Ton',
        source: 'daily',
        extract: (r) => r.daily_report_turbine_misc?.[0]?.consumption_rate_a ?? null
    },
    {
        id: 'daily_consumption_rate_b',
        label: 'Consumption Rate B',
        group: 'Harian: Turbine & Misc',
        unit: 'Ton/Ton',
        source: 'daily',
        extract: (r) => r.daily_report_turbine_misc?.[0]?.consumption_rate_b ?? null
    },
    {
        id: 'daily_consumption_rate_avg',
        label: 'Consumption Rate Rata-rata',
        group: 'Harian: Turbine & Misc',
        unit: 'Ton/Ton',
        source: 'daily',
        extract: (r) => r.daily_report_turbine_misc?.[0]?.consumption_rate_avg ?? null
    },

    // ─── HARIAN: STOCK & TANK ───
    {
        id: 'daily_stock_batubara',
        label: 'Stock Batubara',
        group: 'Harian: Stock & Tank',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_stock_tank?.[0]?.stock_batubara ?? null
    },
    {
        id: 'daily_solar_tank_total',
        label: 'Solar Tank Total',
        group: 'Harian: Stock & Tank',
        unit: 'Liter',
        source: 'daily',
        extract: (r) => r.daily_report_stock_tank?.[0]?.solar_tank_total ?? null
    },
    {
        id: 'daily_bfw_total',
        label: 'BFW Total',
        group: 'Harian: Stock & Tank',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_stock_tank?.[0]?.bfw_total ?? null
    },
    {
        id: 'daily_chemical_phosphat',
        label: 'Chemical Phosphat',
        group: 'Harian: Stock & Tank',
        unit: 'Kg',
        source: 'daily',
        extract: (r) => r.daily_report_stock_tank?.[0]?.chemical_phosphat ?? null
    },
    {
        id: 'daily_chemical_amin',
        label: 'Chemical Amin',
        group: 'Harian: Stock & Tank',
        unit: 'Kg',
        source: 'daily',
        extract: (r) => r.daily_report_stock_tank?.[0]?.chemical_amin ?? null
    },
    {
        id: 'daily_chemical_hydrasin',
        label: 'Chemical Hydrasin',
        group: 'Harian: Stock & Tank',
        unit: 'Kg',
        source: 'daily',
        extract: (r) => r.daily_report_stock_tank?.[0]?.chemical_hydrasin ?? null
    },

    // ─── HARIAN: COAL TRANSFER ───
    {
        id: 'daily_darat_24_ton',
        label: 'Kedatangan Darat (24 Jam)',
        group: 'Harian: Coal Transfer',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_coal_transfer?.[0]?.darat_24_ton ?? null
    },
    {
        id: 'daily_darat_total_ton',
        label: 'Kedatangan Darat (Total)',
        group: 'Harian: Coal Transfer',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_coal_transfer?.[0]?.darat_total_ton ?? null
    },
    {
        id: 'daily_laut_24_ton',
        label: 'Kedatangan Laut (24 Jam)',
        group: 'Harian: Coal Transfer',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_coal_transfer?.[0]?.laut_24_ton ?? null
    },
    {
        id: 'daily_laut_total_ton',
        label: 'Kedatangan Laut (Total)',
        group: 'Harian: Coal Transfer',
        unit: 'Ton',
        source: 'daily',
        extract: (r) => r.daily_report_coal_transfer?.[0]?.laut_total_ton ?? null
    },
];

export const groupedParameters = PARAMETERS.reduce((acc, param) => {
    if (!acc[param.group]) acc[param.group] = [];
    acc[param.group].push(param);
    return acc;
}, {} as Record<string, ParameterDef[]>);
