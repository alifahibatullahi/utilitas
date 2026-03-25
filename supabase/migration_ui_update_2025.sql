-- ============================================
-- Migration: UI Update 2025
-- Fitur baru: status bunker, ash unloadings, flow BFW
-- AMAN di-run di database yang sudah ada data
-- ============================================

-- ═══ 1. Tambah kolom status bunker di shift_coal_bunker ═══
ALTER TABLE shift_coal_bunker
    ADD COLUMN IF NOT EXISTS status_bunker_a TEXT DEFAULT 'Normal',
    ADD COLUMN IF NOT EXISTS status_bunker_b TEXT DEFAULT 'Normal',
    ADD COLUMN IF NOT EXISTS status_bunker_c TEXT DEFAULT 'Normal',
    ADD COLUMN IF NOT EXISTS status_bunker_d TEXT DEFAULT 'Normal',
    ADD COLUMN IF NOT EXISTS status_bunker_e TEXT DEFAULT 'Normal',
    ADD COLUMN IF NOT EXISTS status_bunker_f TEXT DEFAULT 'Normal';

-- ═══ 2. Tabel baru: ash_unloadings (Unloading Fly Ash per Shift) ═══
CREATE TABLE IF NOT EXISTS ash_unloadings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    shift TEXT NOT NULL,
    silo TEXT NOT NULL,
    perusahaan TEXT NOT NULL,
    tujuan TEXT NOT NULL,
    ritase NUMERIC NOT NULL DEFAULT 0,
    operator_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ash_unloadings_date ON ash_unloadings(date);

-- RLS & Policy untuk ash_unloadings
ALTER TABLE ash_unloadings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ash_unloadings' AND policyname = 'Allow all for anon'
    ) THEN
        CREATE POLICY "Allow all for anon" ON ash_unloadings FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ═══ 3. Tambah kolom flow BFW di daily_report_stock_tank ═══
ALTER TABLE daily_report_stock_tank
    ADD COLUMN IF NOT EXISTS flow_bfw_a NUMERIC,
    ADD COLUMN IF NOT EXISTS flow_bfw_b NUMERIC;

-- ═══ SELESAI ═══
-- Perubahan:
-- 1. shift_coal_bunker: +6 kolom (status_bunker_a..f) untuk status Normal/Berasap
-- 2. ash_unloadings: tabel baru untuk list aktivitas unloading fly ash
-- 3. daily_report_stock_tank: +2 kolom (flow_bfw_a, flow_bfw_b)
