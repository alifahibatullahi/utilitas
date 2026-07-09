-- Migration: status feeder (running/standby/...) di tab Boiler laporan harian.
-- Menyamakan tab Boiler harian dengan laporan shift yang sudah punya status feeder per
-- feeder (A–F). Disimpan di daily_report_turbine_misc (rumah yang sama dengan
-- status_boiler_a/b + pembacaan sesaat boiler).
--
-- Catatan: TIDAK dipetakan ke Google Sheets — daily-sheets-mapper.ts menulis hanya
-- berdasarkan indeks kolom eksplisit, jadi kolom baru ini otomatis terabaikan.

ALTER TABLE daily_report_turbine_misc
    ADD COLUMN IF NOT EXISTS status_feeder_a TEXT,
    ADD COLUMN IF NOT EXISTS status_feeder_b TEXT,
    ADD COLUMN IF NOT EXISTS status_feeder_c TEXT,
    ADD COLUMN IF NOT EXISTS status_feeder_d TEXT,
    ADD COLUMN IF NOT EXISTS status_feeder_e TEXT,
    ADD COLUMN IF NOT EXISTS status_feeder_f TEXT;
