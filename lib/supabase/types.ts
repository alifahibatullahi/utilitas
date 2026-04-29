export type OperatorRole = 'group_a' | 'group_b' | 'group_c' | 'group_d' | 'supervisor' | 'foreman_boiler' | 'foreman_turbin' | 'handling' | 'admin';
export type ShiftType = 'pagi' | 'sore' | 'malam';
export type ReportStatus = 'draft' | 'submitted' | 'approved';

// Simplified Database type — we use untyped client to avoid Supabase generic issues
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Database {}

// ─── Base / Anchor Tables ───

export interface OperatorRow {
    id: string;
    name: string;
    role: OperatorRole;
    group_name: string | null;
    created_at: string;
}

export interface ShiftReportRow {
    id: string;
    date: string;
    shift: ShiftType;
    group_name: string;
    supervisor: string;
    status: ReportStatus;
    catatan: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface DailyReportRow {
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
}

// ─── Shift Tables (10 tabel) ───

export interface ShiftTurbinRow {
    id: string;
    shift_report_id: string;
    flow_steam: number | null;
    flow_cond: number | null;
    press_steam: number | null;
    temp_steam: number | null;
    exh_steam: number | null;
    vacuum: number | null;
    hpo_durasi: number | null;
    thrust_bearing: number | null;
    metal_bearing: number | null;
    vibrasi: number | null;
    winding: number | null;
    axial_displacement: number | null;
    level_condenser: number | null;
    temp_cw_in: number | null;
    temp_cw_out: number | null;
    press_deaerator: number | null;
    temp_deaerator: number | null;
    stream_days: number | null;
    created_at: string;
}

export interface ShiftSteamDistRow {
    id: string;
    shift_report_id: string;
    pabrik1_flow: number | null;
    pabrik1_temp: number | null;
    pabrik2_flow: number | null;
    pabrik2_temp: number | null;
    pabrik3a_flow: number | null;
    pabrik3a_temp: number | null;
    pabrik3b_flow: number | null;
    pabrik3b_temp: number | null;
    created_at: string;
}

export interface ShiftGeneratorGiRow {
    id: string;
    shift_report_id: string;
    gen_load: number | null;
    gen_ampere: number | null;
    gen_amp_react: number | null;
    gen_cos_phi: number | null;
    gen_tegangan: number | null;
    gen_frequensi: number | null;
    gi_sum_p: number | null;
    gi_sum_q: number | null;
    gi_cos_phi: number | null;
    created_at: string;
}

export interface ShiftPowerDistRow {
    id: string;
    shift_report_id: string;
    power_ubb: number | null;
    power_pabrik2: number | null;
    power_pabrik3a: number | null;
    power_pie: number | null;
    power_pabrik3b: number | null;
    created_at: string;
}

export interface ShiftEspHandlingRow {
    id: string;
    shift_report_id: string;
    esp_a1: number | null;
    esp_a2: number | null;
    esp_a3: number | null;
    esp_b1: number | null;
    esp_b2: number | null;
    esp_b3: number | null;
    silo_a: number | null;
    silo_b: number | null;
    unloading_a: string | null;
    unloading_b: number | null;
    loading: string | null;
    hopper: string | null;
    conveyor: string | null;
    pf1: number | null;
    pf2: number | null;
    created_at: string;
}

export interface ShiftTankyardRow {
    id: string;
    shift_report_id: string;
    tk_rcw: number | null;
    tk_rcw_2: number | null;
    tk_rcw_3: number | null;
    tk_rcw_4: number | null;
    tk_demin: number | null;
    tk_solar_ab: number | null;
    created_at: string;
}

export interface ShiftPersonnelRow {
    id: string;
    shift_report_id: string;
    turbin_grup: string | null;
    turbin_karu: string | null;
    turbin_kasi: string | null;
    boiler_grup: string | null;
    boiler_karu: string | null;
    boiler_kasi: string | null;
    created_at: string;
}

export interface ShiftBoilerRow {
    id: string;
    shift_report_id: string;
    boiler: 'A' | 'B';
    press_steam: number | null;
    temp_steam: number | null;
    flow_steam: number | null;
    totalizer_steam: number | null;
    flow_bfw: number | null;
    temp_bfw: number | null;
    temp_furnace: number | null;
    temp_flue_gas: number | null;
    excess_air: number | null;
    air_heater_ti113: number | null;
    batubara_ton: number | null;
    solar_m3: number | null;
    stream_days: number | null;
    steam_drum_press: number | null;
    bfw_press: number | null;
    status_boiler: string | null;
    created_at: string;
}

export interface ShiftCoalBunkerRow {
    id: string;
    shift_report_id: string;
    feeder_a: number | null;
    feeder_b: number | null;
    feeder_c: number | null;
    feeder_d: number | null;
    feeder_e: number | null;
    feeder_f: number | null;
    bunker_a: number | null;
    bunker_b: number | null;
    bunker_c: number | null;
    bunker_d: number | null;
    bunker_e: number | null;
    bunker_f: number | null;
    status_bunker_a: string | null;
    status_bunker_b: string | null;
    status_bunker_c: string | null;
    status_bunker_d: string | null;
    status_bunker_e: string | null;
    status_bunker_f: string | null;
    status_feeder_a: string | null;
    status_feeder_b: string | null;
    status_feeder_c: string | null;
    status_feeder_d: string | null;
    status_feeder_e: string | null;
    status_feeder_f: string | null;
    created_at: string;
}

export interface ShiftWaterQualityRow {
    id: string;
    shift_report_id: string;
    demin_1250_ph: number | null;
    demin_1250_conduct: number | null;
    demin_1250_th: number | null;
    demin_1250_sio2: number | null;
    demin_750_ph: number | null;
    demin_750_conduct: number | null;
    demin_750_th: number | null;
    demin_750_sio2: number | null;
    bfw_ph: number | null;
    bfw_conduct: number | null;
    bfw_th: number | null;
    bfw_sio2: number | null;
    bfw_nh4: number | null;
    bfw_chz: number | null;
    boiler_water_a_ph: number | null;
    boiler_water_a_conduct: number | null;
    boiler_water_a_sio2: number | null;
    boiler_water_a_po4: number | null;
    boiler_water_b_ph: number | null;
    boiler_water_b_conduct: number | null;
    boiler_water_b_sio2: number | null;
    boiler_water_b_po4: number | null;
    product_steam_ph: number | null;
    product_steam_conduct: number | null;
    product_steam_th: number | null;
    product_steam_sio2: number | null;
    product_steam_nh4: number | null;
    created_at: string;
}

// ─── Daily Report Tables (7 tabel) ───

export interface DailyReportSteamRow {
    id: string;
    daily_report_id: string;
    prod_boiler_a_24: number | null;
    prod_boiler_b_24: number | null;
    prod_total_24: number | null;
    inlet_turbine_24: number | null;
    mps_i_24: number | null;
    mps_3a_24: number | null;
    lps_ii_24: number | null;
    lps_3a_24: number | null;
    fully_condens_24: number | null;
    internal_ubb_24: number | null;
    prod_boiler_a_00: number | null;
    prod_boiler_b_00: number | null;
    prod_total_00: number | null;
    inlet_turbine_00: number | null;
    co_gen_00: number | null;
    mps_i_00: number | null;
    mps_3a_00: number | null;
    lps_ii_00: number | null;
    lps_3a_00: number | null;
    fully_condens_00: number | null;
    internal_ubb_00: number | null;
    created_at: string;
}

export interface DailyReportPowerRow {
    id: string;
    daily_report_id: string;
    gen_24: number | null;
    dist_ib_24: number | null;
    dist_ii_24: number | null;
    dist_3a_24: number | null;
    dist_3b_24: number | null;
    internal_bus1_24: number | null;
    internal_bus2_24: number | null;
    pja_24: number | null;
    revamp_stg175_24: number | null;
    revamp_stg125_24: number | null;
    exsport_24: number | null;
    pie_pln_24: number | null;
    pie_import_24: number | null;
    gen_00: number | null;
    dist_ib_00: number | null;
    dist_ii_00: number | null;
    dist_3a_00: number | null;
    dist_3b_00: number | null;
    internal_bus1_00: number | null;
    internal_bus2_00: number | null;
    pja_00: number | null;
    revamp_stg175_00: number | null;
    revamp_stg125_00: number | null;
    exsport_00: number | null;
    pie_pln_00: number | null;
    pie_import_00: number | null;
    pie_gi_00: number | null;
    // Distribusi power per factory (tab Generator harian)
    power_ubb_totalizer: number | null;
    power_ubb: number | null;
    power_pabrik2_totalizer: number | null;
    power_pabrik2: number | null;
    power_pabrik3a_totalizer: number | null;
    power_pabrik3a: number | null;
    power_revamping_totalizer: number | null;
    power_revamping: number | null;
    power_pie_totalizer: number | null;
    power_pie: number | null;
    power_stg_ubb_totalizer: number | null;
    created_at: string;
}

export interface DailyReportCoalRow {
    id: string;
    daily_report_id: string;
    coal_a_24: number | null;
    coal_b_24: number | null;
    coal_c_24: number | null;
    total_boiler_a_24: number | null;
    coal_d_24: number | null;
    coal_e_24: number | null;
    coal_f_24: number | null;
    total_boiler_b_24: number | null;
    grand_total_24: number | null;
    coal_a_00: number | null;
    coal_b_00: number | null;
    coal_c_00: number | null;
    total_boiler_a_00: number | null;
    coal_d_00: number | null;
    coal_e_00: number | null;
    coal_f_00: number | null;
    total_boiler_b_00: number | null;
    grand_total_00: number | null;
    created_at: string;
}

export interface DailyReportTurbineMiscRow {
    id: string;
    daily_report_id: string;
    temp_furnace_a: number | null;
    temp_furnace_b: number | null;
    axial_displacement: number | null;
    thrust_bearing_temp: number | null;
    steam_inlet_press: number | null;
    steam_inlet_temp: number | null;
    consumption_rate_a: number | null;
    consumption_rate_b: number | null;
    consumption_rate_avg: number | null;
    totalizer_gi: number | null;
    totalizer_export: number | null;
    totalizer_import: number | null;
    // Generator electrical params (tab Generator harian)
    gen_ampere: number | null;
    gen_amp_react: number | null;
    gen_cos_phi: number | null;
    gen_tegangan: number | null;
    gen_frequensi: number | null;
    // Gardu Induk
    gi_sum_p: number | null;
    gi_sum_q: number | null;
    gi_cos_phi: number | null;
    created_at: string;
}

export interface DailyReportStockTankRow {
    id: string;
    daily_report_id: string;
    stock_batubara: number | null;
    rcw_level_00: number | null;
    demin_level_00: number | null;
    solar_tank_a: number | null;
    solar_tank_b: number | null;
    solar_tank_total: number | null;
    kedatangan_solar: number | null;
    solar_boiler: number | null;
    solar_bengkel: number | null;
    solar_3b: number | null;
    bfw_boiler_a: number | null;
    bfw_boiler_b: number | null;
    flow_bfw_a: number | null;
    flow_bfw_b: number | null;
    bfw_total: number | null;
    chemical_phosphat: number | null;
    chemical_amin: number | null;
    chemical_hydrasin: number | null;
    silo_a_pct: number | null;
    silo_b_pct: number | null;
    unloading_fly_ash_a: number | null;
    unloading_fly_ash_b: number | null;
    total_pf1: number | null;
    total_pf2: number | null;
    created_at: string;
}

export interface DailyReportCoalTransferRow {
    id: string;
    daily_report_id: string;
    pb2_pf1_rit: number | null;
    pb2_pf1_ton: number | null;
    pb2_pf2_rit: number | null;
    pb2_pf2_ton: number | null;
    pb2_total_pf1_rit: number | null;
    pb2_total_pf1_ton: number | null;
    pb2_total_pf2_rit: number | null;
    pb2_total_pf2_ton: number | null;
    pb3_calc_rit: number | null;
    pb3_calc_ton: number | null;
    pb3_total_calc_rit: number | null;
    pb3_total_calc_ton: number | null;
    darat_24_ton: number | null;
    darat_total_ton: number | null;
    laut_24_ton: number | null;
    laut_total_ton: number | null;
    created_at: string;
}

export interface DailyReportTotalizerRow {
    id: string;
    daily_report_id: string;
    totalizer_1: number | null;
    totalizer_2: number | null;
    totalizer_3: number | null;
    totalizer_4: number | null;
    totalizer_5: number | null;
    group_name: string | null;
    kasi_name: string | null;
    stock_batubara_rendal: number | null;
    keterangan: string | null;
    konsumsi_demin: number | null;
    konsumsi_rcw: number | null;
    penerimaan_demin_3a: number | null;
    penerimaan_demin_1b: number | null;
    penerimaan_rcw_1a: number | null;
    tot_rcw_1a: number | null;
    tot_demin: number | null;
    tot_demin_pb1: number | null;
    tot_demin_pb3: number | null;
    tot_hydrant: number | null;
    tot_basin: number | null;
    tot_service: number | null;
    created_at: string;
}

// ─── Critical & Maintenance Types ───

export type CriticalEquipmentStatus = 'OPEN' | 'CLOSED';
export type MaintenanceStatus = 'OPEN' | 'IP' | 'OK';
export type CriticalStatus = CriticalEquipmentStatus | MaintenanceStatus;
export type MaintenanceType = 'corrective' | 'preventif' | 'modifikasi';
export type WorkOrderType = 'preventif' | 'modifikasi';
export type WorkOrderStatus = 'OPEN' | 'IP' | 'OK';
export type HarScope = 'mekanik' | 'listrik' | 'instrumen' | 'sipil';
export type ForemanType = 'foreman_turbin' | 'foreman_boiler';
export type ActivityActionType = 'created' | 'status_changed' | 'note' | 'maintenance_added' | 'maintenance_updated' | 'maintenance_deleted';

// ─── Supporting Tables ───

export interface CriticalEquipmentRow {
    id: string;
    shift_report_id: string | null;
    date: string;
    item: string;
    deskripsi: string;
    scope: HarScope;
    foreman: ForemanType;
    status: CriticalEquipmentStatus;
    notif: string | null;
    reported_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface WorkOrderRow {
    id: string;
    date: string;
    item: string;
    deskripsi: string;
    tipe: WorkOrderType;
    scope: HarScope;
    foreman: ForemanType;
    status: WorkOrderStatus;
    notif: string | null;
    reported_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface WorkOrderWithPekerjaan extends WorkOrderRow {
    maintenance_logs: MaintenanceLogRow[];
}

export interface MaintenanceLogRow {
    id: string;
    shift_report_id: string | null;
    critical_id: string | null;
    work_order_id: string | null;
    date: string;
    item: string;
    uraian: string;
    scope: HarScope;
    foreman: ForemanType;
    tipe: MaintenanceType;
    status: MaintenanceStatus;
    keterangan: string | null;
    notif: string | null;
    reported_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CriticalActivityLogRow {
    id: string;
    critical_id: string;
    action_type: ActivityActionType;
    description: string;
    actor: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

// ─── Photos ───

export interface PhotoRow {
    id:             string;
    critical_id:    string | null;
    maintenance_id: string | null;
    url:            string;
    filename:       string;
    uploaded_via:   'app' | 'whatsapp';
    uploaded_by:    string | null;
    created_at:     string;
}

// ─── Joined types for UI ───

export interface CriticalWithMaintenance extends CriticalEquipmentRow {
    maintenance_logs: MaintenanceLogRow[];
    critical_activity_logs: CriticalActivityLogRow[];
    photos?: PhotoRow[];
}

export interface MaintenanceWithCritical extends MaintenanceLogRow {
    critical_equipment: CriticalEquipmentRow | null;
    photos?: PhotoRow[];
}

export interface ShiftNoteRow {
    id: string;
    shift_report_id: string;
    content: string;
    author_id: string;
    timestamp: string;
}

export interface SolarUnloadingRow {
    id: string;
    date: string;
    shift?: string;
    liters: number;
    supplier: string;
    operator_id: string | null;
    created_at: string;
}

export interface SolarUsageRow {
    id: string;
    date: string;
    shift: string;
    liters: number;
    tujuan: string;
    operator_id: string | null;
    created_at: string;
}

export interface AshUnloadingRow {
    id: string;
    date: string;
    shift: string;
    silo: string;
    perusahaan: string;
    tujuan: string;
    ritase: number;
    operator_id: string | null;
    created_at: string;
}

export interface TankLevelRow {
    id: string;
    tank_id: 'DEMIN' | 'RCW' | 'SOLAR';
    level_pct: number;
    level_m3: number;
    operator_name: string;
    note: string | null;
    created_at: string;
}

export interface TankFlowReadingRow {
    id: string;
    tank_id: 'DEMIN' | 'RCW' | 'SOLAR';
    direction: 'in' | 'out';
    label: string;        // nama source / destination
    rate: number;         // ton/h; 0 untuk pump-only
    pump: string | null;  // pompa aktif (khusus Demin Revamp)
    operator_name: string | null;
    created_at: string;
}
