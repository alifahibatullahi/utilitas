-- Satu record boleh berisi FOTO dan VIDEO sekaligus.
--
-- Tabelnya tetap bernama `sheet_photos` — mengganti nama tabel berarti menyentuh setiap
-- query, RLS policy, dan index yang sudah ada demi kosmetik saja. Yang berubah hanya
-- isinya: sejak sekarang satu baris bisa berupa foto atau video, dibedakan `media_kind`.
--
-- `mime_type` disimpan apa adanya (sumber kebenaran, menentukan cara memutarnya di
-- browser), `media_kind` adalah turunannya yang sudah diringkas supaya penyaringan dan
-- penghitungan "3 foto, 1 video" tidak perlu mengurai MIME tiap kali.

ALTER TABLE sheet_photos
  ADD COLUMN IF NOT EXISTS media_kind text NOT NULL DEFAULT 'photo'
    CHECK (media_kind IN ('photo', 'video')),
  ADD COLUMN IF NOT EXISTS mime_type  text;

-- Baris yang sudah ada semuanya foto (fitur video belum pernah ada), jadi DEFAULT 'photo'
-- sudah benar untuk mereka dan tidak perlu backfill.

-- Galeri satu record mengambil semua medianya sekaligus lalu memisahkan foto/video di
-- sisi app, jadi tidak ada index baru: idx_sheet_photos_row_uid tetap yang dipakai.
