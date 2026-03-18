-- ============================================
-- PowerOps: Extended Daily Report Tables (Hybrid)
-- Replaces old daily_reports table
-- All linked via daily_report_id → daily_reports
-- ============================================

-- First, extend the existing daily_reports table to serve as anchor
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS notes TEXT;

-- ─── 1. Daily Report: Steam (Produksi & Distribusi) ───
CREATE TABLE daily_report_steam (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- 24-hour totals (Ton)
    prod_boiler_a_24 NUMERIC,
    prod_boiler_b_24 NUMERIC,
    prod_total_24 NUMERIC,
    inlet_turbine_24 NUMERIC,
    mps_i_24 NUMERIC,
    mps_3a_24 NUMERIC,
    lps_ii_24 NUMERIC,
    lps_3a_24 NUMERIC,
    fully_condens_24 NUMERIC,
    internal_ubb_24 NUMERIC,
    -- Jam 00.00 readings (T/H)
    prod_boiler_a_00 NUMERIC,
    prod_boiler_b_00 NUMERIC,
    prod_total_00 NUMERIC,
    inlet_turbine_00 NUMERIC,
    co_gen_00 NUMERIC,
    mps_i_00 NUMERIC,
    mps_3a_00 NUMERIC,
    lps_ii_00 NUMERIC,
    lps_3a_00 NUMERIC,
    fully_condens_00 NUMERIC,
    internal_ubb_00 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 2. Daily Report: Power (Produksi & Distribusi) ───
CREATE TABLE daily_report_power (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- 24-hour totals (MWh)
    gen_24 NUMERIC,
    dist_ib_24 NUMERIC,
    dist_ii_24 NUMERIC,
    dist_3a_24 NUMERIC,
    dist_3b_24 NUMERIC,
    internal_bus1_24 NUMERIC,
    internal_bus2_24 NUMERIC,
    pja_24 NUMERIC,
    revamp_stg175_24 NUMERIC,
    revamp_stg125_24 NUMERIC,
    exsport_24 NUMERIC,
    pie_pln_24 NUMERIC,
    pie_import_24 NUMERIC,
    -- Jam 00.00 readings (MW)
    gen_00 NUMERIC,
    dist_ib_00 NUMERIC,
    dist_ii_00 NUMERIC,
    dist_3a_00 NUMERIC,
    dist_3b_00 NUMERIC,
    internal_bus1_00 NUMERIC,
    internal_bus2_00 NUMERIC,
    pja_00 NUMERIC,
    revamp_stg175_00 NUMERIC,
    revamp_stg125_00 NUMERIC,
    exsport_00 NUMERIC,
    pie_pln_00 NUMERIC,
    pie_import_00 NUMERIC,
    pie_gi_00 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 3. Daily Report: Coal Consumption ───
CREATE TABLE daily_report_coal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- 24-hour totals (Ton)
    coal_a_24 NUMERIC,
    coal_b_24 NUMERIC,
    coal_c_24 NUMERIC,
    total_boiler_a_24 NUMERIC,
    coal_d_24 NUMERIC,
    coal_e_24 NUMERIC,
    coal_f_24 NUMERIC,
    total_boiler_b_24 NUMERIC,
    grand_total_24 NUMERIC,
    -- Jam 00.00 readings (Ton/Jam)
    coal_a_00 NUMERIC,
    coal_b_00 NUMERIC,
    coal_c_00 NUMERIC,
    total_boiler_a_00 NUMERIC,
    coal_d_00 NUMERIC,
    coal_e_00 NUMERIC,
    coal_f_00 NUMERIC,
    total_boiler_b_00 NUMERIC,
    grand_total_00 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 4. Daily Report: Turbine Misc (Furnace, Generator, Consumption Rate) ───
CREATE TABLE daily_report_turbine_misc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- Temperatur Furnace (jam 00.00)
    temp_furnace_a NUMERIC,
    temp_furnace_b NUMERIC,
    -- Turbine Generator (jam 00.00)
    axial_displacement NUMERIC,
    thrust_bearing_temp NUMERIC,
    steam_inlet_press NUMERIC,
    steam_inlet_temp NUMERIC,
    -- Consumption Rate Harian
    consumption_rate_a NUMERIC,
    consumption_rate_b NUMERIC,
    consumption_rate_avg NUMERIC,
    -- Totalizer Power
    totalizer_gi NUMERIC,
    totalizer_export NUMERIC,
    totalizer_import NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 5. Daily Report: Stock, Tank Levels, Solar, BFW, Chemical ───
CREATE TABLE daily_report_stock_tank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- Stock & Levels
    stock_batubara NUMERIC,
    rcw_level_00 NUMERIC,
    demin_level_00 NUMERIC,
    -- Solar
    solar_tank_a NUMERIC,
    solar_tank_b NUMERIC,
    solar_tank_total NUMERIC,
    kedatangan_solar NUMERIC,
    solar_boiler NUMERIC,
    solar_bengkel NUMERIC,
    solar_3b NUMERIC,
    -- BFW
    bfw_boiler_a NUMERIC,
    bfw_boiler_b NUMERIC,
    bfw_total NUMERIC,
    -- Chemical
    chemical_phosphat NUMERIC,
    chemical_amin NUMERIC,
    chemical_hydrasin NUMERIC,
    -- Silo Levels
    silo_a_pct NUMERIC,
    silo_b_pct NUMERIC,
    -- Unloading Fly Ash
    unloading_fly_ash_a NUMERIC,
    unloading_fly_ash_b NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 6. Daily Report: Coal Transfer & Arrival ───
CREATE TABLE daily_report_coal_transfer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- Pemindahan ke PB II
    pb2_pf1_rit NUMERIC,
    pb2_pf1_ton NUMERIC,
    pb2_pf2_rit NUMERIC,
    pb2_pf2_ton NUMERIC,
    pb2_total_pf1_rit NUMERIC,
    pb2_total_pf1_ton NUMERIC,
    pb2_total_pf2_rit NUMERIC,
    pb2_total_pf2_ton NUMERIC,
    -- Pemindahan ke PB III (Calcinasi)
    pb3_calc_rit NUMERIC,
    pb3_calc_ton NUMERIC,
    pb3_total_calc_rit NUMERIC,
    pb3_total_calc_ton NUMERIC,
    -- Kedatangan via Darat
    darat_24_ton NUMERIC,
    darat_total_ton NUMERIC,
    -- Kedatangan via Laut
    laut_24_ton NUMERIC,
    laut_total_ton NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── 7. Daily Report: Totalizer & Personnel ───
CREATE TABLE daily_report_totalizer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    -- Totalizer readings
    totalizer_1 NUMERIC,
    totalizer_2 NUMERIC,
    totalizer_3 NUMERIC,
    totalizer_4 NUMERIC,
    totalizer_5 NUMERIC,
    -- Personnel
    group_name TEXT,
    kasi_name TEXT,
    -- Stock & consumption extras
    stock_batubara_rendal NUMERIC,
    keterangan TEXT,
    konsumsi_demin NUMERIC,
    konsumsi_rcw NUMERIC,
    penerimaan_demin_3a NUMERIC,
    penerimaan_demin_1b NUMERIC,
    penerimaan_rcw_1a NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(daily_report_id)
);

-- ─── Indexes ───
CREATE INDEX idx_dr_steam_report ON daily_report_steam(daily_report_id);
CREATE INDEX idx_dr_power_report ON daily_report_power(daily_report_id);
CREATE INDEX idx_dr_coal_report ON daily_report_coal(daily_report_id);
CREATE INDEX idx_dr_turbine_misc_report ON daily_report_turbine_misc(daily_report_id);
CREATE INDEX idx_dr_stock_tank_report ON daily_report_stock_tank(daily_report_id);
CREATE INDEX idx_dr_coal_transfer_report ON daily_report_coal_transfer(daily_report_id);
CREATE INDEX idx_dr_totalizer_report ON daily_report_totalizer(daily_report_id);

-- ─── Enable Realtime for key tables ───
ALTER PUBLICATION supabase_realtime ADD TABLE shift_turbin;
ALTER PUBLICATION supabase_realtime ADD TABLE shift_boiler;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_report_steam;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_report_power;
