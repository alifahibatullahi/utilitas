-- ============================================
-- PowerOps: Extended Shift Data Tables (Hybrid)
-- Replaces old turbin_params, boiler_params, etc.
-- All linked via shift_report_id → shift_reports
-- ============================================

-- ─── 1. Shift Turbin ───
-- Columns C-T from Google Sheets (18 fields)
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

-- ─── 2. Shift Steam Distribution ───
-- Columns U-AB (flow + temp per pabrik, 8 fields)
CREATE TABLE shift_steam_dist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    pabrik1_flow NUMERIC,
    pabrik1_temp NUMERIC,
    pabrik2_flow NUMERIC,
    pabrik2_temp NUMERIC,
    pabrik3a_flow NUMERIC,
    pabrik3a_temp NUMERIC,
    pabrik3b_flow NUMERIC,
    pabrik3b_temp NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 3. Shift Generator & GI ───
-- Columns AC-AK (9 fields)
CREATE TABLE shift_generator_gi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    gen_load NUMERIC,
    gen_ampere NUMERIC,
    gen_amp_react NUMERIC,
    gen_cos_phi NUMERIC,
    gen_tegangan NUMERIC,
    gen_frequensi NUMERIC,
    gi_sum_p NUMERIC,
    gi_sum_q NUMERIC,
    gi_cos_phi NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 4. Shift Power Distribution ───
-- Columns AL-AP (5 fields)
CREATE TABLE shift_power_dist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    power_ubb NUMERIC,
    power_pabrik2 NUMERIC,
    power_pabrik3a NUMERIC,
    power_pie NUMERIC,
    power_pabrik3b NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 5. Shift ESP & Handling ───
-- Columns AQ-BE (15 fields)
CREATE TABLE shift_esp_handling (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    esp_a1 NUMERIC,
    esp_a2 NUMERIC,
    esp_a3 NUMERIC,
    esp_b1 NUMERIC,
    esp_b2 NUMERIC,
    esp_b3 NUMERIC,
    silo_a NUMERIC,
    silo_b NUMERIC,
    unloading_a TEXT,       -- can be text (e.g. "1A1B")
    unloading_b NUMERIC,
    loading TEXT,
    hopper TEXT,
    conveyor TEXT,
    pf1 NUMERIC,
    pf2 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 6. Shift Tankyard ───
-- Columns BF-BH (3 fields) — point-in-time levels per shift
CREATE TABLE shift_tankyard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    tk_rcw NUMERIC,
    tk_demin NUMERIC,
    tk_solar_ab NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 7. Shift Personnel ───
-- Columns BI-BK (turbin side) + later columns (boiler side)
CREATE TABLE shift_personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    turbin_grup TEXT,
    turbin_karu TEXT,
    turbin_kasi TEXT,
    boiler_grup TEXT,
    boiler_karu TEXT,
    boiler_kasi TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 8. Shift Boiler ───
-- Per boiler A/B (15 fields each), replaces old boiler_params
CREATE TABLE shift_boiler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    boiler VARCHAR(1) NOT NULL CHECK (boiler IN ('A', 'B')),
    press_steam NUMERIC,
    temp_steam NUMERIC,
    flow_steam NUMERIC,
    totalizer_steam NUMERIC,
    flow_bfw NUMERIC,
    temp_bfw NUMERIC,
    temp_furnace NUMERIC,
    temp_flue_gas NUMERIC,
    excess_air NUMERIC,
    air_heater_ti113 NUMERIC,
    batubara_ton NUMERIC,
    solar_m3 NUMERIC,
    stream_days NUMERIC,
    steam_drum_press NUMERIC,
    bfw_press NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id, boiler)
);

-- ─── 9. Shift Coal Feeder & Bunker ───
-- 12 fields
CREATE TABLE shift_coal_bunker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    feeder_a NUMERIC,
    feeder_b NUMERIC,
    feeder_c NUMERIC,
    feeder_d NUMERIC,
    feeder_e NUMERIC,
    feeder_f NUMERIC,
    bunker_a NUMERIC,
    bunker_b NUMERIC,
    bunker_c NUMERIC,
    bunker_d NUMERIC,
    bunker_e NUMERIC,
    bunker_f NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── 10. Shift Water Quality ───
-- 32 fields (flat, replaces EAV lab_results)
CREATE TABLE shift_water_quality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID NOT NULL REFERENCES shift_reports(id) ON DELETE CASCADE,
    -- Demin TK 1250
    demin_1250_ph NUMERIC,
    demin_1250_conduct NUMERIC,
    demin_1250_th NUMERIC,
    demin_1250_sio2 NUMERIC,
    -- Demin TK 750
    demin_750_ph NUMERIC,
    demin_750_conduct NUMERIC,
    demin_750_th NUMERIC,
    demin_750_sio2 NUMERIC,
    -- BFW
    bfw_ph NUMERIC,
    bfw_conduct NUMERIC,
    bfw_th NUMERIC,
    bfw_sio2 NUMERIC,
    bfw_nh4 NUMERIC,
    bfw_chz NUMERIC,
    -- Boiler Water A
    boiler_water_a_ph NUMERIC,
    boiler_water_a_conduct NUMERIC,
    boiler_water_a_sio2 NUMERIC,
    boiler_water_a_po4 NUMERIC,
    -- Boiler Water B
    boiler_water_b_ph NUMERIC,
    boiler_water_b_conduct NUMERIC,
    boiler_water_b_sio2 NUMERIC,
    boiler_water_b_po4 NUMERIC,
    -- Product Steam
    product_steam_ph NUMERIC,
    product_steam_conduct NUMERIC,
    product_steam_th NUMERIC,
    product_steam_sio2 NUMERIC,
    product_steam_nh4 NUMERIC,
    -- Demin Xtra Check (00.00)
    demin_xtra_ph NUMERIC,
    demin_xtra_conduct NUMERIC,
    demin_xtra_sio2 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shift_report_id)
);

-- ─── Indexes for common queries ───
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
