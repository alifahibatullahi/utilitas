-- ============================================
-- PowerOps Complete Database Schema
-- Copy-paste ke Supabase SQL Editor, run 1x
-- Aman di-run ulang (DROP IF EXISTS)
-- ============================================

-- ════════════════════════════════════════════
-- SECTION 0: CLEANUP (drop semua jika sudah ada)
-- ════════════════════════════════════════════

-- Hapus realtime dulu
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['shift_reports','shift_turbin','shift_boiler','daily_report_steam','daily_report_power']
    LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %I', t);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END $$;

-- Drop tables (child tables dulu, lalu anchor, lalu base)
DROP TABLE IF EXISTS shift_notes CASCADE;
DROP TABLE IF EXISTS maintenance_logs CASCADE;
DROP TABLE IF EXISTS critical_equipment CASCADE;
DROP TABLE IF EXISTS ash_unloadings CASCADE;
DROP TABLE IF EXISTS solar_unloadings CASCADE;
DROP TABLE IF EXISTS shift_turbin CASCADE;
DROP TABLE IF EXISTS shift_steam_dist CASCADE;
DROP TABLE IF EXISTS shift_generator_gi CASCADE;
DROP TABLE IF EXISTS shift_power_dist CASCADE;
DROP TABLE IF EXISTS shift_esp_handling CASCADE;
DROP TABLE IF EXISTS shift_tankyard CASCADE;
DROP TABLE IF EXISTS shift_personnel CASCADE;
DROP TABLE IF EXISTS shift_boiler CASCADE;
DROP TABLE IF EXISTS shift_coal_bunker CASCADE;
DROP TABLE IF EXISTS shift_water_quality CASCADE;
DROP TABLE IF EXISTS daily_report_steam CASCADE;
DROP TABLE IF EXISTS daily_report_power CASCADE;
DROP TABLE IF EXISTS daily_report_coal CASCADE;
DROP TABLE IF EXISTS daily_report_turbine_misc CASCADE;
DROP TABLE IF EXISTS daily_report_stock_tank CASCADE;
DROP TABLE IF EXISTS daily_report_coal_transfer CASCADE;
DROP TABLE IF EXISTS daily_report_totalizer CASCADE;
DROP TABLE IF EXISTS tank_levels CASCADE;
DROP TABLE IF EXISTS shift_reports CASCADE;
DROP TABLE IF EXISTS daily_reports CASCADE;
DROP TABLE IF EXISTS operators CASCADE;

-- Drop types
DROP TYPE IF EXISTS operator_role CASCADE;
DROP TYPE IF EXISTS shift_type CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- ════════════════════════════════════════════
-- SECTION 1: ENUM TYPES
-- ════════════════════════════════════════════

CREATE TYPE operator_role AS ENUM (
    'group_a', 'group_b', 'group_c', 'group_d',
    'supervisor', 'foreman_boiler', 'foreman_turbin',
    'handling', 'admin'
);

CREATE TYPE shift_type AS ENUM ('pagi', 'sore', 'malam');
CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'approved');

-- ════════════════════════════════════════════
-- SECTION 2: BASE / ANCHOR TABLES
-- ════════════════════════════════════════════

-- ─── Operators ───
CREATE TABLE operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role operator_role NOT NULL,
    group_name TEXT,
    nik TEXT,
    jabatan TEXT,
    company TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Shift Reports (anchor for all shift_* tables) ───
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

-- ─── Daily Reports (anchor for all daily_report_* tables) ───
CREATE TABLE daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    produksi_steam_a NUMERIC,
    produksi_steam_b NUMERIC,
    konsumsi_batubara NUMERIC,
    load_mw NUMERIC,
    notes TEXT,
    status report_status DEFAULT 'draft',
    created_by UUID REFERENCES operators(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════
-- SECTION 3: SHIFT TABLES (10 tabel)
-- ════════════════════════════════════════════

-- ─── 1. Shift Turbin (18 field) ───
CREATE TABLE shift_turbin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    flow_steam NUMERIC,
    flow_cond NUMERIC,
    press_steam NUMERIC,
    temp_steam NUMERIC,
    exh_steam NUMERIC,
    vacuum NUMERIC,
    hpo_durasi NUMERIC,
    thrust_bearing NUMERIC,
    metal_bearing NUMERIC,
    vibrasi NUMERIC,
    winding NUMERIC,
    axial_displacement NUMERIC,
    level_condenser NUMERIC,
    temp_cw_in NUMERIC,
    temp_cw_out NUMERIC,
    press_deaerator NUMERIC,
    temp_deaerator NUMERIC,
    stream_days NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 2. Shift Steam Distribution (8 field) ───
CREATE TABLE shift_steam_dist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    pabrik1_flow NUMERIC, pabrik1_temp NUMERIC,
    pabrik2_flow NUMERIC, pabrik2_temp NUMERIC,
    pabrik3a_flow NUMERIC, pabrik3a_temp NUMERIC,
    pabrik3b_flow NUMERIC, pabrik3b_temp NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 3. Shift Generator & GI (9 field) ───
CREATE TABLE shift_generator_gi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    gen_load NUMERIC, gen_ampere NUMERIC, gen_amp_react NUMERIC,
    gen_cos_phi NUMERIC, gen_tegangan NUMERIC, gen_frequensi NUMERIC,
    gi_sum_p NUMERIC, gi_sum_q NUMERIC, gi_cos_phi NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 4. Shift Power Distribution (5 field) ───
CREATE TABLE shift_power_dist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    power_ubb NUMERIC, power_pabrik2 NUMERIC,
    power_pabrik3a NUMERIC, power_pie NUMERIC, power_pabrik3b NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 5. Shift ESP & Handling (15 field) ───
CREATE TABLE shift_esp_handling (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    esp_a1 NUMERIC, esp_a2 NUMERIC, esp_a3 NUMERIC,
    esp_b1 NUMERIC, esp_b2 NUMERIC, esp_b3 NUMERIC,
    silo_a NUMERIC, silo_b NUMERIC,
    unloading_a TEXT, unloading_b NUMERIC,
    loading TEXT, hopper TEXT, conveyor TEXT,
    pf1 NUMERIC, pf2 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 6. Shift Tankyard (3 field) ───
CREATE TABLE shift_tankyard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    tk_rcw NUMERIC, tk_demin NUMERIC, tk_solar_ab NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 7. Shift Personnel (6 field) ───
CREATE TABLE shift_personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    turbin_grup TEXT, turbin_karu TEXT, turbin_kasi TEXT,
    boiler_grup TEXT, boiler_karu TEXT, boiler_kasi TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 8. Shift Boiler (15 field per boiler A/B) ───
CREATE TABLE shift_boiler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    boiler VARCHAR(1) NOT NULL CHECK (boiler IN ('A', 'B')),
    press_steam NUMERIC, temp_steam NUMERIC, flow_steam NUMERIC,
    totalizer_steam NUMERIC, flow_bfw NUMERIC, temp_bfw NUMERIC,
    temp_furnace NUMERIC, temp_flue_gas NUMERIC, excess_air NUMERIC,
    air_heater_ti113 NUMERIC, batubara_ton NUMERIC, solar_m3 NUMERIC,
    stream_days NUMERIC, steam_drum_press NUMERIC, bfw_press NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id, boiler)
);

-- ─── 9. Shift Coal Feeder & Bunker (12 field + 6 status) ───
CREATE TABLE shift_coal_bunker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    feeder_a NUMERIC, feeder_b NUMERIC, feeder_c NUMERIC,
    feeder_d NUMERIC, feeder_e NUMERIC, feeder_f NUMERIC,
    bunker_a NUMERIC, bunker_b NUMERIC, bunker_c NUMERIC,
    bunker_d NUMERIC, bunker_e NUMERIC, bunker_f NUMERIC,
    -- Status bunker (Normal / Berasap)
    status_bunker_a TEXT DEFAULT 'Normal',
    status_bunker_b TEXT DEFAULT 'Normal',
    status_bunker_c TEXT DEFAULT 'Normal',
    status_bunker_d TEXT DEFAULT 'Normal',
    status_bunker_e TEXT DEFAULT 'Normal',
    status_bunker_f TEXT DEFAULT 'Normal',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 10. Shift Water Quality (27 field) ───
CREATE TABLE shift_water_quality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    -- Demin TK 1250
    demin_1250_ph NUMERIC, demin_1250_conduct NUMERIC,
    demin_1250_th NUMERIC, demin_1250_sio2 NUMERIC,
    -- Demin TK 750
    demin_750_ph NUMERIC, demin_750_conduct NUMERIC,
    demin_750_th NUMERIC, demin_750_sio2 NUMERIC,
    -- BFW
    bfw_ph NUMERIC, bfw_conduct NUMERIC, bfw_th NUMERIC,
    bfw_sio2 NUMERIC, bfw_nh4 NUMERIC, bfw_chz NUMERIC,
    -- Boiler Water A
    boiler_water_a_ph NUMERIC, boiler_water_a_conduct NUMERIC,
    boiler_water_a_sio2 NUMERIC, boiler_water_a_po4 NUMERIC,
    -- Boiler Water B
    boiler_water_b_ph NUMERIC, boiler_water_b_conduct NUMERIC,
    boiler_water_b_sio2 NUMERIC, boiler_water_b_po4 NUMERIC,
    -- Product Steam
    product_steam_ph NUMERIC, product_steam_conduct NUMERIC,
    product_steam_th NUMERIC, product_steam_sio2 NUMERIC,
    product_steam_nh4 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ════════════════════════════════════════════
-- SECTION 4: DAILY REPORT TABLES (7 tabel)
-- ════════════════════════════════════════════

-- ─── 1. Daily Report: Steam (21 field) ───
CREATE TABLE daily_report_steam (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- 24 Jam (Ton)
    prod_boiler_a_24 NUMERIC, prod_boiler_b_24 NUMERIC, prod_total_24 NUMERIC,
    inlet_turbine_24 NUMERIC, mps_i_24 NUMERIC, mps_3a_24 NUMERIC,
    lps_ii_24 NUMERIC, lps_3a_24 NUMERIC,
    fully_condens_24 NUMERIC, internal_ubb_24 NUMERIC,
    -- Jam 00.00 (T/H)
    prod_boiler_a_00 NUMERIC, prod_boiler_b_00 NUMERIC, prod_total_00 NUMERIC,
    inlet_turbine_00 NUMERIC, co_gen_00 NUMERIC,
    mps_i_00 NUMERIC, mps_3a_00 NUMERIC,
    lps_ii_00 NUMERIC, lps_3a_00 NUMERIC,
    fully_condens_00 NUMERIC, internal_ubb_00 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 2. Daily Report: Power (27 field) ───
CREATE TABLE daily_report_power (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- 24 Jam (MWh)
    gen_24 NUMERIC, dist_ib_24 NUMERIC, dist_ii_24 NUMERIC,
    dist_3a_24 NUMERIC, dist_3b_24 NUMERIC,
    internal_bus1_24 NUMERIC, internal_bus2_24 NUMERIC,
    pja_24 NUMERIC, revamp_stg175_24 NUMERIC, revamp_stg125_24 NUMERIC,
    exsport_24 NUMERIC, pie_pln_24 NUMERIC, pie_import_24 NUMERIC,
    -- Jam 00.00 (MW)
    gen_00 NUMERIC, dist_ib_00 NUMERIC, dist_ii_00 NUMERIC,
    dist_3a_00 NUMERIC, dist_3b_00 NUMERIC,
    internal_bus1_00 NUMERIC, internal_bus2_00 NUMERIC,
    pja_00 NUMERIC, revamp_stg175_00 NUMERIC, revamp_stg125_00 NUMERIC,
    exsport_00 NUMERIC, pie_pln_00 NUMERIC, pie_import_00 NUMERIC,
    pie_gi_00 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 3. Daily Report: Coal (18 field) ───
CREATE TABLE daily_report_coal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- 24 Jam (Ton)
    coal_a_24 NUMERIC, coal_b_24 NUMERIC, coal_c_24 NUMERIC,
    total_boiler_a_24 NUMERIC,
    coal_d_24 NUMERIC, coal_e_24 NUMERIC, coal_f_24 NUMERIC,
    total_boiler_b_24 NUMERIC, grand_total_24 NUMERIC,
    -- Jam 00.00 (Ton/Jam)
    coal_a_00 NUMERIC, coal_b_00 NUMERIC, coal_c_00 NUMERIC,
    total_boiler_a_00 NUMERIC,
    coal_d_00 NUMERIC, coal_e_00 NUMERIC, coal_f_00 NUMERIC,
    total_boiler_b_00 NUMERIC, grand_total_00 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 4. Daily Report: Turbine Misc (12 field) ───
CREATE TABLE daily_report_turbine_misc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- Temperatur Furnace (jam 00.00)
    temp_furnace_a NUMERIC, temp_furnace_b NUMERIC,
    -- Turbine Generator (jam 00.00)
    axial_displacement NUMERIC, thrust_bearing_temp NUMERIC,
    steam_inlet_press NUMERIC, steam_inlet_temp NUMERIC,
    -- Consumption Rate Harian
    consumption_rate_a NUMERIC, consumption_rate_b NUMERIC,
    consumption_rate_avg NUMERIC,
    -- Totalizer Power
    totalizer_gi NUMERIC, totalizer_export NUMERIC, totalizer_import NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 5. Daily Report: Stock & Tank (24 field) ───
CREATE TABLE daily_report_stock_tank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- Stock & Levels
    stock_batubara NUMERIC, rcw_level_00 NUMERIC, demin_level_00 NUMERIC,
    -- Solar
    solar_tank_a NUMERIC, solar_tank_b NUMERIC, solar_tank_total NUMERIC,
    kedatangan_solar NUMERIC,
    solar_boiler NUMERIC, solar_bengkel NUMERIC, solar_3b NUMERIC,
    -- BFW (totalizer + flow)
    bfw_boiler_a NUMERIC, bfw_boiler_b NUMERIC, bfw_total NUMERIC,
    flow_bfw_a NUMERIC, flow_bfw_b NUMERIC,
    -- Chemical
    chemical_phosphat NUMERIC, chemical_amin NUMERIC, chemical_hydrasin NUMERIC,
    -- Silo & Fly Ash
    silo_a_pct NUMERIC, silo_b_pct NUMERIC,
    unloading_fly_ash_a NUMERIC, unloading_fly_ash_b NUMERIC,
    total_pf1 NUMERIC, total_pf2 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 6. Daily Report: Coal Transfer (16 field) ───
CREATE TABLE daily_report_coal_transfer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- Pemindahan ke PB II
    pb2_pf1_rit NUMERIC, pb2_pf1_ton NUMERIC,
    pb2_pf2_rit NUMERIC, pb2_pf2_ton NUMERIC,
    pb2_total_pf1_rit NUMERIC, pb2_total_pf1_ton NUMERIC,
    pb2_total_pf2_rit NUMERIC, pb2_total_pf2_ton NUMERIC,
    -- Pemindahan ke PB III (Calcinasi)
    pb3_calc_rit NUMERIC, pb3_calc_ton NUMERIC,
    pb3_total_calc_rit NUMERIC, pb3_total_calc_ton NUMERIC,
    -- Kedatangan
    darat_24_ton NUMERIC, darat_total_ton NUMERIC,
    laut_24_ton NUMERIC, laut_total_ton NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 7. Daily Report: Totalizer & Personnel (14 field) ───
CREATE TABLE daily_report_totalizer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- Totalizer readings
    totalizer_1 NUMERIC, totalizer_2 NUMERIC, totalizer_3 NUMERIC,
    totalizer_4 NUMERIC, totalizer_5 NUMERIC,
    -- Personnel
    group_name TEXT, kasi_name TEXT,
    -- Stock & Consumption
    stock_batubara_rendal NUMERIC, keterangan TEXT,
    konsumsi_demin NUMERIC, konsumsi_rcw NUMERIC,
    penerimaan_demin_3a NUMERIC, penerimaan_demin_1b NUMERIC,
    penerimaan_rcw_1a NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ════════════════════════════════════════════
-- SECTION 5: SUPPORTING TABLES
-- ════════════════════════════════════════════

-- ─── Critical Equipment ───
CREATE TABLE critical_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    item TEXT NOT NULL,
    scope TEXT NOT NULL,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Maintenance Logs ───
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

-- ─── Shift Notes ───
CREATE TABLE shift_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID REFERENCES operators(id),
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- ─── Solar Unloadings ───
CREATE TABLE solar_unloadings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    liters NUMERIC NOT NULL,
    supplier TEXT NOT NULL,
    operator_id UUID REFERENCES operators(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Ash Unloadings (Unloading Fly Ash per Shift) ───
CREATE TABLE ash_unloadings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    shift TEXT NOT NULL,
    silo TEXT NOT NULL,
    perusahaan TEXT NOT NULL,
    tujuan TEXT NOT NULL,
    ritase NUMERIC NOT NULL DEFAULT 0,
    operator_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ash_unloadings_date ON ash_unloadings(date);

-- ─── Tank Levels (real-time update oleh operator handling) ───
CREATE TABLE tank_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id TEXT NOT NULL CHECK (tank_id IN ('DEMIN', 'RCW', 'SOLAR')),
    level_pct NUMERIC NOT NULL,
    level_m3 NUMERIC NOT NULL,
    operator_name TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tank_levels_tank_id ON tank_levels(tank_id);
CREATE INDEX idx_tank_levels_created_at ON tank_levels(created_at DESC);

-- ════════════════════════════════════════════
-- SECTION 6: INDEXES
-- ════════════════════════════════════════════

-- Shift tables
CREATE INDEX idx_shift_turbin_report ON shift_turbin(shift_report_id);
CREATE INDEX idx_shift_steam_dist_report ON shift_steam_dist(shift_report_id);
CREATE INDEX idx_shift_generator_gi_report ON shift_generator_gi(shift_report_id);
CREATE INDEX idx_shift_power_dist_report ON shift_power_dist(shift_report_id);
CREATE INDEX idx_shift_esp_handling_report ON shift_esp_handling(shift_report_id);
CREATE INDEX idx_shift_tankyard_report ON shift_tankyard(shift_report_id);
CREATE INDEX idx_shift_personnel_report ON shift_personnel(shift_report_id);
CREATE INDEX idx_shift_boiler_report ON shift_boiler(shift_report_id);
CREATE INDEX idx_shift_coal_bunker_report ON shift_coal_bunker(shift_report_id);
CREATE INDEX idx_shift_water_quality_report ON shift_water_quality(shift_report_id);

-- Daily report tables
CREATE INDEX idx_dr_steam_report ON daily_report_steam(daily_report_id);
CREATE INDEX idx_dr_power_report ON daily_report_power(daily_report_id);
CREATE INDEX idx_dr_coal_report ON daily_report_coal(daily_report_id);
CREATE INDEX idx_dr_turbine_misc_report ON daily_report_turbine_misc(daily_report_id);
CREATE INDEX idx_dr_stock_tank_report ON daily_report_stock_tank(daily_report_id);
CREATE INDEX idx_dr_coal_transfer_report ON daily_report_coal_transfer(daily_report_id);
CREATE INDEX idx_dr_totalizer_report ON daily_report_totalizer(daily_report_id);

-- ════════════════════════════════════════════
-- SECTION 7: TRIGGER
-- ════════════════════════════════════════════

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

-- ════════════════════════════════════════════
-- SECTION 8: ROW LEVEL SECURITY
-- ════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_turbin ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_steam_dist ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_generator_gi ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_power_dist ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_esp_handling ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_tankyard ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_boiler ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_coal_bunker ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_water_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_steam ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_power ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_coal ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_turbine_misc ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_stock_tank ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_coal_transfer ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_totalizer ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE solar_unloadings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ash_unloadings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tank_levels ENABLE ROW LEVEL SECURITY;

-- Allow all for anon (no auth, public access via anon key)
CREATE POLICY "Allow all for anon" ON operators FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_reports FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_reports FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_turbin FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_steam_dist FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_generator_gi FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_power_dist FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_esp_handling FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_tankyard FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_personnel FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_boiler FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_coal_bunker FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_water_quality FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_report_steam FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_report_power FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_report_coal FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_report_turbine_misc FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_report_stock_tank FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_report_coal_transfer FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_report_totalizer FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON critical_equipment FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON maintenance_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_notes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON solar_unloadings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON ash_unloadings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON tank_levels FOR ALL TO anon USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════
-- SECTION 9: REALTIME
-- ════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE shift_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE shift_turbin;
ALTER PUBLICATION supabase_realtime ADD TABLE shift_boiler;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_report_steam;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_report_power;
ALTER PUBLICATION supabase_realtime ADD TABLE tank_levels;

-- ════════════════════════════════════════════
-- SEED DATA: Operators (51 personil)
-- ════════════════════════════════════════════

INSERT INTO operators (name, role, group_name, nik, jabatan, company) VALUES
-- ─── Group A — Organik (UBB) ───
('Ardhian Wisnu Perdana', 'group_a', 'A', '2074878', 'Supervisor', 'UBB'),
('Jaka Riyantaka', 'group_a', 'A', '2146101', 'Foreman Turbin', 'UBB'),
('Aldilla Indra R', 'group_a', 'A', '2180323', NULL, 'UBB'),
('Ilham Mirza Nur R', 'group_a', 'A', '2146074', 'Foreman Boiler', 'UBB'),
('Bagus Indra Prasetya', 'group_a', 'A', '2190502', NULL, 'UBB'),
('Rizky Dharmaji', 'group_a', 'A', '2156352', NULL, 'UBB'),
('Lutfi Abdul Aziz', 'group_a', 'A', '2180237', NULL, 'UBB'),
-- Group A — Tenaga Alih Daya
('Andreansyah', 'handling', 'A', '25-09677', NULL, 'PT FJM'),
('Bambang Agus', 'group_a', 'A', '25-10301', NULL, 'PT FJM'),
('M. Syaiful Amri', 'group_a', 'A', '25-09676', NULL, 'PT FJM'),
('Aditya Dwi', 'group_a', 'A', '24-05632', NULL, 'PT Shohib Jaya Putra'),
('Miftahul Ihsan', 'group_a', 'A', '24-05636', NULL, 'PT Shohib Jaya Putra'),

-- ─── Group B — Organik (UBB) ───
('Putra Aris Hidayat', 'group_b', 'B', '2125518', 'Supervisor', 'UBB'),
('Bili Pratama Kurnia', 'group_b', 'B', '2146080', 'Foreman Turbin', 'UBB'),
('Yusuf Efendi Saputra', 'group_b', 'B', '2156361', NULL, 'UBB'),
('Ferdian Maulana Fah', 'group_b', 'B', '2125676', 'Foreman Boiler', 'UBB'),
('Rachmat Nordiyansyah', 'group_b', 'B', '2146117', NULL, 'UBB'),
('Nastainul Firdaus Z', 'group_b', 'B', '2146089', NULL, 'UBB'),
('Mohamad Rizky Arsyi', 'group_b', 'B', '2180310', NULL, 'UBB'),
-- Group B — Tenaga Alih Daya
('Muhammad Syahri', 'handling', 'B', '25-09683', NULL, 'PT FJM'),
('Mulyono', 'group_b', 'B', '25-10302', NULL, 'PT FJM'),
('Sun''an Kusaini', 'group_b', 'B', '25-08504', NULL, 'PT FJM'),
('Hadi Santoso', 'group_b', 'B', '24-05614', NULL, 'PT Shohib Jaya Putra'),
('Radyth Ferdynanto', 'group_b', 'B', '24-25639', NULL, 'PT Shohib Jaya Putra'),

-- ─── Group C — Organik (UBB) ───
('Zulkarnain Bayu', 'group_c', 'C', '2125519', 'Supervisor', 'UBB'),
('Ryo Risky Faizal', 'group_c', 'C', '2125716', 'Foreman Turbin', 'UBB'),
('Rofindra Alif Iskandar', 'group_c', 'C', '2180327', NULL, 'UBB'),
('Akhmad Agung Prabowo', 'group_c', 'C', '2156285', 'Foreman Boiler', 'UBB'),
('Dimas Cahyo Nugroho', 'group_c', 'C', '2180302', NULL, 'UBB'),
('Muhammad Indra Ali', 'group_c', 'C', '2156337', NULL, 'UBB'),
('Rizqy Aulia Rahman', 'group_c', 'C', '2156353', NULL, 'UBB'),
-- Group C — Tenaga Alih Daya
('Achmad Mirza Yusuf', 'handling', 'C', '25-10304', NULL, 'PT FJM'),
('Moh. Muchlis', 'group_c', 'C', '25-09675', NULL, 'PT FJM'),
('Yusuf Adnan', 'group_c', 'C', '25-08539', NULL, 'PT FJM'),
('Alif Amirul', 'group_c', 'C', '24-25633', NULL, 'PT Shohib Jaya Putra'),
('Naufal Nasrulloh', 'group_c', 'C', '24-05636', NULL, 'PT Shohib Jaya Putra'),

-- ─── Group D — Organik (UBB) ───
('Ade Rahmad Abrianto', 'group_d', 'D', '2125719', 'Supervisor', 'UBB'),
('Yudistira Alnur', 'group_d', 'D', '2125525', 'Foreman Turbin', 'UBB'),
('Moh. Taufiqurrohman', 'group_d', 'D', '2146088', NULL, 'UBB'),
('Julio Purnanugraha', 'group_d', 'D', '2146090', 'Foreman Boiler', 'UBB'),
('Alifahi Batullahi', 'group_d', 'D', '2180331', NULL, 'UBB'),
('Ahmad Shofi Hamim', 'group_d', 'D', '2156283', NULL, 'UBB'),
('Achmad Ali Chorudin', 'group_d', 'D', '2125718', NULL, 'UBB'),
-- Group D — Tenaga Alih Daya
('Mohammad Agil', 'handling', 'D', '25-09679', NULL, 'PT FJM'),
('Mohammad Zubairi', 'group_d', 'D', '25-08496', NULL, 'PT FJM'),
('Andik Purwanto', 'group_d', 'D', '25-10300', NULL, 'PT FJM'),
('M. Diso', 'group_d', 'D', '24-05637', NULL, 'PT Shohib Jaya Putra'),
('Firman Fathollah', 'group_d', 'D', '24-05634', NULL, 'PT Shohib Jaya Putra'),

-- ─── Normal Day (Management) ───
('Dimas Randyta Iswara', 'admin', NULL, '2145605', 'AVP', 'UBB'),
('Mashasan Imanuddin', 'admin', NULL, '2085010', 'Junior AVP', 'UBB'),
('Admin Sistem', 'admin', NULL, NULL, NULL, NULL);
