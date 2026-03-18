-- ============================================
-- PowerOps Database Schema
-- ============================================

-- Custom types
CREATE TYPE operator_role AS ENUM (
    'group_a', 'group_b', 'group_c', 'group_d',
    'supervisor', 'foreman_boiler', 'foreman_turbin',
    'handling', 'admin'
);

CREATE TYPE shift_type AS ENUM ('pagi', 'sore', 'malam');
CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'approved');
CREATE TYPE tank_id AS ENUM ('DEMIN', 'RCW', 'SOLAR');
CREATE TYPE flow_direction AS ENUM ('in', 'out');
CREATE TYPE boiler_type AS ENUM ('A', 'B');

-- ─── 1. Operators ───
CREATE TABLE operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role operator_role NOT NULL,
    group_name TEXT, -- A, B, C, D
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. Shift Reports ───
CREATE TABLE shift_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    shift shift_type NOT NULL,
    group_name TEXT NOT NULL,
    supervisor TEXT NOT NULL,
    status report_status DEFAULT 'draft',
    catatan TEXT,
    created_by UUID REFERENCES operators(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date, shift, group_name)
);

-- ─── 3. Boiler Parameters ───
CREATE TABLE boiler_params (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    boiler boiler_type NOT NULL,
    main_steam_press NUMERIC,
    main_steam_temp NUMERIC,
    main_steam_flow NUMERIC,
    feed_water_flow NUMERIC,
    feed_water_temp NUMERIC,
    steam_drum_press NUMERIC,
    coal_feeder_a NUMERIC,
    coal_feeder_b NUMERIC,
    coal_feeder_c NUMERIC,
    coal_feeder_d NUMERIC,
    coal_feeder_e NUMERIC,
    coal_feeder_f NUMERIC,
    furnace_temp NUMERIC,
    flue_gas_temp NUMERIC,
    o2_percent NUMERIC,
    solar_usage NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id, boiler)
);

-- ─── 4. Turbin Parameters ───
CREATE TABLE turbin_params (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    load_mw NUMERIC,
    main_steam_press NUMERIC,
    main_steam_temp NUMERIC,
    exhaust_press NUMERIC,
    bearing_temp_1 NUMERIC,
    bearing_temp_2 NUMERIC,
    bearing_temp_3 NUMERIC,
    bearing_temp_4 NUMERIC,
    bearing_temp_5 NUMERIC,
    bearing_temp_6 NUMERIC,
    bearing_temp_7 NUMERIC,
    bearing_temp_8 NUMERIC,
    vibration NUMERIC,
    lube_oil_temp NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 5. Power Distribution ───
CREATE TABLE power_distribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    destination TEXT NOT NULL,
    load_mw NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 6. Steam Distribution ───
CREATE TABLE steam_distribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    destination TEXT NOT NULL,
    flow_ton_h NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 7. Tank Levels ───
CREATE TABLE tank_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id tank_id NOT NULL,
    level_percent NUMERIC NOT NULL,
    level_m3 NUMERIC,
    operator_id UUID REFERENCES operators(id),
    timestamp TIMESTAMPTZ DEFAULT now(),
    note TEXT
);

CREATE INDEX idx_tank_levels_tank_id ON tank_levels(tank_id);
CREATE INDEX idx_tank_levels_timestamp ON tank_levels(timestamp DESC);

-- ─── 8. Flow Rates ───
CREATE TABLE flow_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_level_id UUID NOT NULL REFERENCES tank_levels(id) ON DELETE CASCADE,
    direction flow_direction NOT NULL,
    source_label TEXT NOT NULL,
    rate_ton_h NUMERIC NOT NULL,
    pump TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 9. Lab Results ───
CREATE TABLE lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- BFW, TK1250, ProductSteam, BoilerWaterA, BoilerWaterB
    parameter TEXT NOT NULL,
    value NUMERIC,
    unit TEXT,
    standard_min NUMERIC,
    standard_max NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 10. Critical Equipment ───
CREATE TABLE critical_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    item TEXT NOT NULL,
    scope TEXT NOT NULL,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 11. Maintenance Logs ───
CREATE TABLE maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    uraian TEXT NOT NULL,
    scope TEXT NOT NULL,
    keterangan TEXT,
    status TEXT DEFAULT 'OK',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 12. Shift Notes ───
CREATE TABLE shift_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID REFERENCES operators(id),
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- ─── 13. Daily Reports ───
CREATE TABLE daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    produksi_steam_a NUMERIC,
    produksi_steam_b NUMERIC,
    konsumsi_batubara NUMERIC,
    load_mw NUMERIC,
    status report_status DEFAULT 'draft',
    created_by UUID REFERENCES operators(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 14. Solar Unloadings ───
CREATE TABLE solar_unloadings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    liters NUMERIC NOT NULL,
    supplier TEXT NOT NULL,
    operator_id UUID REFERENCES operators(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Updated_at trigger ───
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON shift_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ─── Enable Realtime ───
ALTER PUBLICATION supabase_realtime ADD TABLE tank_levels;
ALTER PUBLICATION supabase_realtime ADD TABLE shift_reports;
