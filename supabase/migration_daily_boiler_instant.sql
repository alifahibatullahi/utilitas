-- Migration: pembacaan sesaat boiler (jam 24.00) di laporan harian.
-- Melengkapi kolom 24.00 di e-Logbook yang sebelumnya kosong — field instantaneous
-- boiler (press/temp steam, BFW, flue gas, hot air, O2, steam drum, primary/secondary
-- air) hanya ada di laporan shift, belum di harian. Disimpan di daily_report_turbine_misc
-- (rumah yang sama dengan temp_furnace_a/b + status_boiler).
--
-- Catatan: TIDAK dipetakan ke Google Sheets — daily-sheets-mapper.ts menulis hanya
-- berdasarkan indeks kolom eksplisit, jadi kolom baru ini otomatis terabaikan.

ALTER TABLE daily_report_turbine_misc
    ADD COLUMN IF NOT EXISTS press_steam_a      NUMERIC,
    ADD COLUMN IF NOT EXISTS temp_steam_a       NUMERIC,
    ADD COLUMN IF NOT EXISTS bfw_press_a        NUMERIC,
    ADD COLUMN IF NOT EXISTS temp_bfw_a         NUMERIC,
    ADD COLUMN IF NOT EXISTS temp_flue_gas_a    NUMERIC,
    ADD COLUMN IF NOT EXISTS air_heater_ti113_a NUMERIC,
    ADD COLUMN IF NOT EXISTS o2_a               NUMERIC,
    ADD COLUMN IF NOT EXISTS steam_drum_press_a NUMERIC,
    ADD COLUMN IF NOT EXISTS primary_air_a      NUMERIC,
    ADD COLUMN IF NOT EXISTS secondary_air_a    NUMERIC,
    ADD COLUMN IF NOT EXISTS press_steam_b      NUMERIC,
    ADD COLUMN IF NOT EXISTS temp_steam_b       NUMERIC,
    ADD COLUMN IF NOT EXISTS bfw_press_b        NUMERIC,
    ADD COLUMN IF NOT EXISTS temp_bfw_b         NUMERIC,
    ADD COLUMN IF NOT EXISTS temp_flue_gas_b    NUMERIC,
    ADD COLUMN IF NOT EXISTS air_heater_ti113_b NUMERIC,
    ADD COLUMN IF NOT EXISTS o2_b               NUMERIC,
    ADD COLUMN IF NOT EXISTS steam_drum_press_b NUMERIC,
    ADD COLUMN IF NOT EXISTS primary_air_b      NUMERIC,
    ADD COLUMN IF NOT EXISTS secondary_air_b    NUMERIC;
