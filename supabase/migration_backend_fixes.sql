-- ============================================
-- Migration: Backend Fixes & New Features
-- 1. Tambah kolom shift_boiler (primary_air, secondary_air, o2, feeder flows)
-- 2. Fix unloading_a ke NUMERIC di shift_esp_handling
-- 3. Tabel app_settings untuk RKAP & konfigurasi lainnya
-- AMAN di-run di database yang sudah ada data
-- Copy-paste seluruh isi file ini ke Supabase SQL Editor, lalu RUN
-- ============================================

-- ═══ 1. Tambah kolom baru di shift_boiler ═══
ALTER TABLE shift_boiler
    ADD COLUMN IF NOT EXISTS primary_air NUMERIC,
    ADD COLUMN IF NOT EXISTS secondary_air NUMERIC,
    ADD COLUMN IF NOT EXISTS o2 NUMERIC,
    ADD COLUMN IF NOT EXISTS feeder_a_flow NUMERIC,
    ADD COLUMN IF NOT EXISTS feeder_b_flow NUMERIC,
    ADD COLUMN IF NOT EXISTS feeder_c_flow NUMERIC,
    ADD COLUMN IF NOT EXISTS feeder_d_flow NUMERIC,
    ADD COLUMN IF NOT EXISTS feeder_e_flow NUMERIC,
    ADD COLUMN IF NOT EXISTS feeder_f_flow NUMERIC;

-- ═══ 2. Fix unloading_a dari TEXT ke NUMERIC di shift_esp_handling ═══
-- Konversi data TEXT yang ada ke NUMERIC (NULL kalau tidak bisa dikonversi)
ALTER TABLE shift_esp_handling
    ALTER COLUMN unloading_a TYPE NUMERIC USING (
        CASE WHEN unloading_a ~ '^\d+\.?\d*$' THEN unloading_a::NUMERIC ELSE NULL END
    );

-- ═══ 3. Tabel app_settings untuk RKAP dan konfigurasi lainnya ═══
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by TEXT
);

-- Insert default RKAP setting
INSERT INTO app_settings (key, value, description)
VALUES (
    'rkap',
    '{"rkap_steam": 569400, "cr_target": 0.210, "tahun": 2025}'::jsonb,
    'Target RKAP Steam dan CR per tahun'
)
ON CONFLICT (key) DO NOTHING;

-- RLS & Policy untuk app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow all for anon'
    ) THEN
        CREATE POLICY "Allow all for anon" ON app_settings FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ═══ SELESAI ═══
-- Perubahan:
-- 1. shift_boiler: +9 kolom (primary_air, secondary_air, o2, feeder_a-f_flow)
-- 2. shift_esp_handling: unloading_a diubah dari TEXT ke NUMERIC
-- 3. app_settings: tabel baru untuk RKAP dan konfigurasi aplikasi
