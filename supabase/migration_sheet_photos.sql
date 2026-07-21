-- Foto untuk fitur Critical Maintenance berbasis Google Sheets (/critical-maintenance).
-- Data teks tinggal di spreadsheet; foto di-upload via web (R2) dan menempel ke baris
-- sheet lewat row_uid = kolom web_uid yang ditulis app di sheet (lib/critical-sheet.ts).
-- Terpisah dari tabel `photos` (fitur critical lama, Supabase-based, nonaktif) supaya
-- skema lama tidak disentuh.

CREATE TABLE sheet_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_kind TEXT NOT NULL CHECK (parent_kind IN ('critical', 'maintenance')),
  row_uid TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  caption TEXT,
  uploaded_via TEXT NOT NULL DEFAULT 'app',
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sheet_photos_parent ON sheet_photos(parent_kind, row_uid);

-- RLS identik dengan `photos`: publik boleh baca, tulis/ubah/hapus hanya service role
-- (semua mutasi lewat API route dengan service-role client).
ALTER TABLE sheet_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sheet photos readable by everyone"
  ON sheet_photos FOR SELECT USING (true);

CREATE POLICY "Sheet photos insertable by service role only"
  ON sheet_photos FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Sheet photos updatable by service role only"
  ON sheet_photos FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Sheet photos deletable by service role only"
  ON sheet_photos FOR DELETE USING (auth.role() = 'service_role');
