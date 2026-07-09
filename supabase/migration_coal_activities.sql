-- Migration: tabel coal_activities (In/Out batubara model "tambah aktivitas")
-- Dijalankan di Supabase SQL Editor.
--
-- Mengganti input angka tunggal di laporan harian (Kedatangan & Pemindahan batubara)
-- menjadi daftar aktivitas. Agregasi per category dipakai saat menulis ke Google Sheets
-- (lihat app/api/sheets/write/route.ts + lib/daily-sheets-mapper.ts). Default 0 bila kosong.
--
-- kind:     'in'  = kedatangan, 'out' = pemindahan
-- category: 'darat','laut'                  (kind=in)  → kolom Sheets DK, DM
--           'pb2_pf1','pb2_pf2','pb3_calc'  (kind=out) → CY/CZ, DA/DB, DG/DH

CREATE TABLE IF NOT EXISTS coal_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    shift TEXT,
    kind TEXT NOT NULL,                      -- 'in' | 'out'
    category TEXT NOT NULL,                  -- darat|laut|pb2_pf1|pb2_pf2|pb3_calc
    rit NUMERIC NOT NULL DEFAULT 0,
    ton NUMERIC NOT NULL DEFAULT 0,
    keterangan TEXT,
    operator_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coal_activities_date ON coal_activities(date);
CREATE INDEX IF NOT EXISTS idx_coal_activities_date_kind ON coal_activities(date, kind);

-- RLS — samakan dengan solar_usages / ash_unloadings
ALTER TABLE coal_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON coal_activities FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON coal_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
