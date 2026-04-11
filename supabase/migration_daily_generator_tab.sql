-- Migration: Add generator electrical params + GI to daily_report_turbine_misc
-- Add power distribution per factory to daily_report_power
-- Required for daily report Generator tab (same layout as shift TabGenerator)

-- ─── daily_report_turbine_misc: tambah field generator & GI ───────────────────
ALTER TABLE daily_report_turbine_misc
    ADD COLUMN IF NOT EXISTS gen_ampere    NUMERIC,
    ADD COLUMN IF NOT EXISTS gen_amp_react NUMERIC,
    ADD COLUMN IF NOT EXISTS gen_cos_phi   NUMERIC,
    ADD COLUMN IF NOT EXISTS gen_tegangan  NUMERIC,
    ADD COLUMN IF NOT EXISTS gen_frequensi NUMERIC,
    ADD COLUMN IF NOT EXISTS gi_sum_p      NUMERIC,
    ADD COLUMN IF NOT EXISTS gi_sum_q      NUMERIC,
    ADD COLUMN IF NOT EXISTS gi_cos_phi    NUMERIC;

-- ─── daily_report_power: tambah field distribusi power per factory ────────────
-- Setiap factory: totalizer (MWh, sama seperti di shift) + MW (aktual)
ALTER TABLE daily_report_power
    ADD COLUMN IF NOT EXISTS power_ubb_totalizer      NUMERIC,
    ADD COLUMN IF NOT EXISTS power_ubb                NUMERIC,
    ADD COLUMN IF NOT EXISTS power_pabrik2_totalizer  NUMERIC,
    ADD COLUMN IF NOT EXISTS power_pabrik2            NUMERIC,
    ADD COLUMN IF NOT EXISTS power_pabrik3a_totalizer NUMERIC,
    ADD COLUMN IF NOT EXISTS power_pabrik3a           NUMERIC,
    ADD COLUMN IF NOT EXISTS power_revamping_totalizer NUMERIC,
    ADD COLUMN IF NOT EXISTS power_revamping          NUMERIC,
    ADD COLUMN IF NOT EXISTS power_pie_totalizer      NUMERIC,
    ADD COLUMN IF NOT EXISTS power_pie                NUMERIC,
    ADD COLUMN IF NOT EXISTS power_stg_ubb_totalizer  NUMERIC;

-- ─── daily_report_stock_tank: tambah field flow BFW ──────────────────────────
ALTER TABLE daily_report_stock_tank
    ADD COLUMN IF NOT EXISTS flow_bfw_a NUMERIC,
    ADD COLUMN IF NOT EXISTS flow_bfw_b NUMERIC;
