export type OperatorRole = 'group_a' | 'group_b' | 'group_c' | 'group_d' | 'supervisor' | 'foreman_boiler' | 'foreman_turbin' | 'handling' | 'admin';
export type ShiftType = 'pagi' | 'sore' | 'malam';
export type ReportStatus = 'draft' | 'submitted' | 'approved';
export type TankIdType = 'DEMIN' | 'RCW' | 'SOLAR';
export type FlowDirection = 'in' | 'out';

// Simplified Database type — we use untyped client to avoid Supabase generic issues
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Database {}

// Row types for manual typing
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

export interface BoilerParamRow {
    id: string;
    shift_report_id: string;
    boiler: 'A' | 'B';
    main_steam_press: number | null;
    main_steam_temp: number | null;
    main_steam_flow: number | null;
    feed_water_flow: number | null;
    feed_water_temp: number | null;
    steam_drum_press: number | null;
    coal_feeder_a: number | null;
    coal_feeder_b: number | null;
    coal_feeder_c: number | null;
    coal_feeder_d: number | null;
    coal_feeder_e: number | null;
    coal_feeder_f: number | null;
    furnace_temp: number | null;
    flue_gas_temp: number | null;
    o2_percent: number | null;
    solar_usage: number | null;
    created_at: string;
}

export interface TurbinParamRow {
    id: string;
    shift_report_id: string;
    load_mw: number | null;
    main_steam_press: number | null;
    main_steam_temp: number | null;
    exhaust_press: number | null;
    bearing_temp_1: number | null;
    bearing_temp_2: number | null;
    bearing_temp_3: number | null;
    bearing_temp_4: number | null;
    bearing_temp_5: number | null;
    bearing_temp_6: number | null;
    bearing_temp_7: number | null;
    bearing_temp_8: number | null;
    vibration: number | null;
    lube_oil_temp: number | null;
    created_at: string;
}

export interface PowerDistRow {
    id: string;
    shift_report_id: string;
    destination: string;
    load_mw: number | null;
    created_at: string;
}

export interface SteamDistRow {
    id: string;
    shift_report_id: string;
    destination: string;
    flow_ton_h: number | null;
    created_at: string;
}

export interface TankLevelRow {
    id: string;
    tank_id: TankIdType;
    level_percent: number;
    level_m3: number | null;
    operator_id: string;
    timestamp: string;
    note: string | null;
}

export interface FlowRateRow {
    id: string;
    tank_level_id: string;
    direction: FlowDirection;
    source_label: string;
    rate_ton_h: number;
    pump: string | null;
    created_at: string;
}

export interface LabResultRow {
    id: string;
    shift_report_id: string;
    category: string;
    parameter: string;
    value: number | null;
    unit: string | null;
    standard_min: number | null;
    standard_max: number | null;
    created_at: string;
}

export interface CriticalEquipmentRow {
    id: string;
    shift_report_id: string;
    date: string;
    item: string;
    scope: string;
    status: string | null;
    created_at: string;
}

export interface MaintenanceLogRow {
    id: string;
    shift_report_id: string;
    item: string;
    uraian: string;
    scope: string;
    keterangan: string | null;
    status: string;
    created_at: string;
}

export interface ShiftNoteRow {
    id: string;
    shift_report_id: string;
    content: string;
    author_id: string;
    timestamp: string;
}

export interface DailyReportRow {
    id: string;
    date: string;
    produksi_steam_a: number | null;
    produksi_steam_b: number | null;
    konsumsi_batubara: number | null;
    load_mw: number | null;
    status: ReportStatus;
    created_by: string | null;
    created_at: string;
}

export interface SolarUnloadingRow {
    id: string;
    date: string;
    liters: number;
    supplier: string;
    operator_id: string | null;
    created_at: string;
}
