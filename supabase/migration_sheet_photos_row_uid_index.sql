-- Index tambahan untuk sheet_photos.
--
-- migration_sheet_photos.sql membuat idx_sheet_photos_parent(parent_kind, row_uid),
-- tapi semua query galeri memfilter row_uid SAJA (GET /api/sheet-photos?uids=…, dan
-- hitungan foto per baris di lib/sheet-photo-sync.ts). Karena parent_kind adalah kolom
-- pemimpin, index itu tidak terpakai untuk pola tersebut → seq scan yang makin mahal
-- seiring tabel bertambah. Index berikut yang dipakai.

CREATE INDEX IF NOT EXISTS idx_sheet_photos_row_uid ON sheet_photos(row_uid);

-- Catatan: JANGAN menambahkan sheet_photos ke publication `supabase_realtime`.
-- Galeri memakai fetch biasa; tabel nyasar di publication pernah membuat compute
-- Supabase jenuh sampai API balas 522.
