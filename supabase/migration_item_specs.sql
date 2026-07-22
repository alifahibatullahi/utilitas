-- Spesifikasi item equipment untuk viewer /critical-maintenance (item-centric).
-- Data teks critical/maintenance tetap di Google Sheets; spesifikasi diedit via web
-- (admin) dan disimpan di sini. Keyed by item_key = normalisasi(item)|normalisasi(varian)
-- (lihat itemKeyOf di lib/critical-sheet.ts).

CREATE TABLE item_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key TEXT NOT NULL UNIQUE,          -- normalisasi(item)|normalisasi(varian)
  item_name TEXT NOT NULL,                -- tampilan (kolom D asli)
  variant TEXT,                           -- kolom E asli
  code TEXT,                              -- kode item mis. K-08.17 (opsional)
  description TEXT,                       -- ringkasan bebas
  specs JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{label, value}] fleksibel per jenis equipment
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_item_specs_key ON item_specs(item_key);

ALTER TABLE item_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Item specs readable by everyone"
  ON item_specs FOR SELECT USING (true);

-- Semua mutasi lewat API route dgn service-role client (identitas app berbasis
-- localStorage, bukan JWT — UI membatasi edit ke admin).
CREATE POLICY "Item specs writable by service role only"
  ON item_specs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
