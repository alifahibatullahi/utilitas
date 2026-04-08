-- Migration: Tambah kolom shift ke solar_unloadings dan buat tabel solar_usages
-- Dijalankan di Supabase SQL Editor

-- 1. Tambah kolom shift ke solar_unloadings (jika belum ada)
ALTER TABLE solar_unloadings
    ADD COLUMN IF NOT EXISTS shift TEXT;

-- 2. Buat tabel solar_usages (pemakaian/keluar solar per shift)
CREATE TABLE IF NOT EXISTS solar_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    shift TEXT NOT NULL,
    liters NUMERIC NOT NULL,
    tujuan TEXT NOT NULL,
    operator_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solar_usages_date ON solar_usages(date);
CREATE INDEX IF NOT EXISTS idx_solar_usages_date_shift ON solar_usages(date, shift);

-- RLS
ALTER TABLE solar_usages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON solar_usages FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON solar_usages FOR ALL TO authenticated USING (true) WITH CHECK (true);
