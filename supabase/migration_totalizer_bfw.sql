-- ============================================
-- Migration: Tambah kolom totalizer_bfw di shift_boiler
-- AMAN di-run di database yang sudah ada data
-- Copy-paste seluruh isi file ini ke Supabase SQL Editor, lalu RUN
-- ============================================

ALTER TABLE shift_boiler ADD COLUMN IF NOT EXISTS totalizer_bfw NUMERIC;
