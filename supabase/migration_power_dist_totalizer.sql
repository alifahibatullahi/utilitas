-- ============================================
-- Migration: Tambah totalizer & revamping di shift_power_dist
-- AMAN di-run di database yang sudah ada data
-- Copy-paste seluruh isi file ini ke Supabase SQL Editor, lalu RUN
-- ============================================

-- Totalizer columns for each distribution point
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS power_ubb_totalizer NUMERIC;
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS power_pabrik2_totalizer NUMERIC;
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS power_pabrik3a_totalizer NUMERIC;
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS power_revamping NUMERIC;
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS power_revamping_totalizer NUMERIC;
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS power_pie_totalizer NUMERIC;
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS power_stg_ubb_totalizer NUMERIC;
