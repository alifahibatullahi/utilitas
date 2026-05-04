-- ============================================
-- Migration: Tambah kolom selisih totalizer
-- Menyimpan selisih (current - prev shift) sebagai data historis
-- ============================================

-- ─── shift_boiler: selisih steam & BFW ───
ALTER TABLE shift_boiler ADD COLUMN IF NOT EXISTS selisih_steam NUMERIC;
ALTER TABLE shift_boiler ADD COLUMN IF NOT EXISTS selisih_bfw NUMERIC;

-- ─── shift_coal_bunker: selisih tiap feeder ───
ALTER TABLE shift_coal_bunker ADD COLUMN IF NOT EXISTS selisih_feeder_a NUMERIC;
ALTER TABLE shift_coal_bunker ADD COLUMN IF NOT EXISTS selisih_feeder_b NUMERIC;
ALTER TABLE shift_coal_bunker ADD COLUMN IF NOT EXISTS selisih_feeder_c NUMERIC;
ALTER TABLE shift_coal_bunker ADD COLUMN IF NOT EXISTS selisih_feeder_d NUMERIC;
ALTER TABLE shift_coal_bunker ADD COLUMN IF NOT EXISTS selisih_feeder_e NUMERIC;
ALTER TABLE shift_coal_bunker ADD COLUMN IF NOT EXISTS selisih_feeder_f NUMERIC;

-- ─── shift_turbin: selisih steam inlet & condensate ───
ALTER TABLE shift_turbin ADD COLUMN IF NOT EXISTS selisih_steam_inlet NUMERIC;
ALTER TABLE shift_turbin ADD COLUMN IF NOT EXISTS selisih_condensate NUMERIC;

-- ─── shift_steam_dist: selisih pabrik totalizer ───
ALTER TABLE shift_steam_dist ADD COLUMN IF NOT EXISTS selisih_pabrik1 NUMERIC;
ALTER TABLE shift_steam_dist ADD COLUMN IF NOT EXISTS selisih_pabrik2 NUMERIC;
ALTER TABLE shift_steam_dist ADD COLUMN IF NOT EXISTS selisih_pabrik3a NUMERIC;

-- ─── shift_power_dist: selisih power totalizer ───
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS selisih_ubb NUMERIC;
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS selisih_pabrik2 NUMERIC;
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS selisih_pabrik3a NUMERIC;
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS selisih_revamping NUMERIC;
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS selisih_pie NUMERIC;
ALTER TABLE shift_power_dist ADD COLUMN IF NOT EXISTS selisih_stg_ubb NUMERIC;
