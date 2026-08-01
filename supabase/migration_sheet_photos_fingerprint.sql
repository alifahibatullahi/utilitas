-- Sidik jari baris sheet, disimpan bersama fotonya.
--
-- Kenapa perlu: foto menempel ke baris lewat `row_uid` saja, dan uid itu hidup di dalam
-- spreadsheet — dulu di kolom "ID", sekarang di dalam URL sel "Dokumentasi". Keduanya
-- bisa hilang oleh satu tindakan operator yang wajar: memblok kolom data tanpa kolom
-- penanda lalu menyortirnya, atau menimpa selnya. Kalau itu terjadi, tidak ada satu pun
-- cara mengetahui foto ini SEHARUSNYA milik baris yang mana.
--
-- Kolom di bawah merekam isi baris pada saat upload, jadi barisnya selalu bisa dicari
-- ulang dari isinya (scripts/repair-photo-links.ts). Ini SALINAN, bukan sumber kebenaran:
-- sheet tetap yang benar, dan koreksi ejaan di sheet tidak perlu diikuti ke sini —
-- pencocokan pemulihan memang dirancang toleran terhadap perbedaan kecil.
--
-- Semua nullable: foto yang sudah ada diisi belakangan oleh scripts/migrate-photo-identity.ts.

ALTER TABLE sheet_photos
  ADD COLUMN IF NOT EXISTS row_item    text,
  ADD COLUMN IF NOT EXISTS row_varian  text,
  ADD COLUMN IF NOT EXISTS row_uraian  text,
  ADD COLUMN IF NOT EXISTS row_tanggal text,
  -- Nomor baris sheet saat upload. PETUNJUK saja, bukan kunci: baris bisa bergeser kapan
  -- saja karena penyisipan di atasnya. Dipakai untuk mencoba tebakan pertama sebelum
  -- pencocokan isi yang lebih mahal.
  ADD COLUMN IF NOT EXISTS row_index   int;

-- Tanpa index baru: kolom-kolom ini hanya dibaca oleh script pemulihan yang memang
-- memindai seluruh tabel sekali jalan. Kunci pencarian normal tetap row_uid, yang sudah
-- punya idx_sheet_photos_row_uid.
