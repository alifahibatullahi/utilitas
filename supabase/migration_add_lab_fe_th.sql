-- Tambah kolom water-quality yang dibutuhkan LogSheet Boiler:
--   BFW Fe (besi), Boiler Water A TH, Boiler Water B TH.
-- Aditif & idempotent — aman dijalankan ulang.

ALTER TABLE shift_water_quality
    ADD COLUMN IF NOT EXISTS bfw_fe NUMERIC,
    ADD COLUMN IF NOT EXISTS boiler_water_a_th NUMERIC,
    ADD COLUMN IF NOT EXISTS boiler_water_b_th NUMERIC;
