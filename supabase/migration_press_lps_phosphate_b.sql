-- ============================================
-- Migration: Tambah press_lps di shift_turbin + chemical dosing di shift_water_quality
-- AMAN di-run di database yang sudah ada data
-- Copy-paste seluruh isi file ini ke Supabase SQL Editor, lalu RUN
-- ============================================

-- Pressure LPS di tabel shift_turbin
ALTER TABLE shift_turbin ADD COLUMN IF NOT EXISTS press_lps NUMERIC;

-- Chemical Dosing: Phosphate Boiler A (existing phosphate columns)
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS phosphate_level_tanki NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS phosphate_stroke_pompa NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS phosphate_penambahan_air NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS phosphate_penambahan_chemical NUMERIC;

-- Chemical Dosing: Phosphate Boiler B (new)
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS phosphate_b_level_tanki NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS phosphate_b_stroke_pompa NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS phosphate_b_penambahan_air NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS phosphate_b_penambahan_chemical NUMERIC;

-- Chemical Dosing: Amine
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS amine_level_tanki NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS amine_stroke_pompa NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS amine_penambahan_air NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS amine_penambahan_chemical NUMERIC;

-- Chemical Dosing: Hydrazine
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS hydrazine_level_tanki NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS hydrazine_stroke_pompa NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS hydrazine_penambahan_air NUMERIC;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS hydrazine_penambahan_chemical NUMERIC;
