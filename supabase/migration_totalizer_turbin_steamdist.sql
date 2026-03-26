-- ============================================
-- Migration: Tambah kolom totalizer di shift_turbin dan shift_steam_dist
-- AMAN di-run di database yang sudah ada data
-- Copy-paste seluruh isi file ini ke Supabase SQL Editor, lalu RUN
-- ============================================

-- Totalizer Steam Inlet & Condensate di tabel shift_turbin
ALTER TABLE shift_turbin ADD COLUMN IF NOT EXISTS totalizer_steam_inlet NUMERIC;
ALTER TABLE shift_turbin ADD COLUMN IF NOT EXISTS totalizer_condensate NUMERIC;

-- Totalizer Pabrik 1, 2, 3 di tabel shift_steam_dist
ALTER TABLE shift_steam_dist ADD COLUMN IF NOT EXISTS pabrik1_totalizer NUMERIC;
ALTER TABLE shift_steam_dist ADD COLUMN IF NOT EXISTS pabrik2_totalizer NUMERIC;
ALTER TABLE shift_steam_dist ADD COLUMN IF NOT EXISTS pabrik3a_totalizer NUMERIC;
