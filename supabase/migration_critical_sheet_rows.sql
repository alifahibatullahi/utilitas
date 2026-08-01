-- Read model /critical-maintenance: isi spreadsheet dicerminkan sebagai BARIS di Postgres.
--
-- Kenapa ada. Sebelum ini tiap request memuat SELURUH spreadsheet ke memori lambda:
-- 4.559 baris critical + 22.954 baris maintenance = 8,75 MB JSON, 51 MB heap, 5,2 detik.
-- Semua itu untuk menyajikan satu halaman berisi 20 record — 6,9 KB. Pembesaran ±1.300×,
-- dan pada plan gratis Vercel (batas 10 detik per fungsi) cold start-nya rawan timeout.
--
-- Dengan tabel ini daftar & pencarian menjadi query SQL biasa: yang keluar dari database
-- hanya baris yang benar-benar ditampilkan. Tidak ada lagi parse 27rb baris di jalur
-- request; pembacaan berat pindah ke cron.
--
-- Spreadsheet TETAP sumber kebenaran. Tabel ini cermin yang boleh dibuang kapan saja dan
-- dibangun ulang penuh dari sheet (lib/critical-sheet-sync.ts → syncFull).

CREATE TABLE IF NOT EXISTS critical_sheet_rows (
  -- Identitas baris di sheet. row_index bergeser bila operator menyisipkan baris di
  -- atasnya, dan itu wajar: syncFull yang meluruskannya kembali.
  kind           text NOT NULL CHECK (kind IN ('critical', 'maintenance')),
  row_index      int  NOT NULL,
  PRIMARY KEY (kind, row_index),

  -- Identitas untuk relasi foto. uid dari URL di sel "Dokumentasi"; legacy_id dari kolom
  -- "ID" di AA yang sudah tidak ditulis lagi (arsip pemulihan).
  uid            text NOT NULL DEFAULT '',
  legacy_id      text NOT NULL DEFAULT '',

  -- Kolom bersama kedua tab.
  no             int,
  tanggal        date,                       -- NULL bila teks tanggalnya tidak terbaca
  tanggal_raw    text NOT NULL DEFAULT '',
  item           text NOT NULL DEFAULT '',
  varian         text NOT NULL DEFAULT '',
  uraian         text NOT NULL DEFAULT '',
  scope          text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT '',
  gabungan       text NOT NULL DEFAULT '',
  link_foto      text NOT NULL DEFAULT '',

  -- Khusus critical.
  pelapor        text NOT NULL DEFAULT '',
  notif          text NOT NULL DEFAULT '',
  tanggal_ok     date,
  tanggal_ok_raw text NOT NULL DEFAULT '',
  peng_ok        text NOT NULL DEFAULT '',

  -- Khusus maintenance.
  shift          text NOT NULL DEFAULT '',
  notifikasi     text NOT NULL DEFAULT '',
  foreman        text NOT NULL DEFAULT '',

  -- Turunan, dihitung saat sync memakai fungsi yang sama dengan app (recordItemKeys,
  -- extractCode, normSearch). Disimpan supaya query tidak perlu menghitungnya per baris:
  -- satu record multi-varian ("DEF") muncul di beberapa halaman item sekaligus.
  item_keys      text[] NOT NULL DEFAULT '{}',
  code           text NOT NULL DEFAULT '',
  search         text NOT NULL DEFAULT '',   -- item + kode + uraian + notifikasi, ternormalisasi

  -- Sidik jari isi baris (rowFingerprint): identitas cadangan untuk menemukan baris
  -- sebuah foto ketika sel Dokumentasi belum ada isinya — yaitu saat foto PERTAMA baris
  -- itu diunggah — atau ketika selnya kelak terhapus/tergeser.
  fingerprint    text NOT NULL DEFAULT '',

  -- Hash seluruh isi baris. Sync hanya menulis baris yang hash-nya berubah, sehingga
  -- pembaruan rutin menyentuh segelintir baris, bukan 27rb.
  content_hash   text NOT NULL,
  synced_at      timestamptz NOT NULL DEFAULT now()
);

-- Urutan feed: tanggal terbaru dulu, yang tak bertanggal paling akhir.
CREATE INDEX IF NOT EXISTS idx_csr_feed
  ON critical_sheet_rows (tanggal DESC NULLS LAST, kind, row_index DESC);

-- Halaman item: item_keys @> ARRAY['<key>'].
CREATE INDEX IF NOT EXISTS idx_csr_item_keys
  ON critical_sheet_rows USING GIN (item_keys);

-- Pencarian bebas dipecah jadi beberapa token yang SEMUANYA harus muncul (ILIKE %token%).
-- Tanpa trigram itu berarti seq scan 27rb baris tiap ketikan; dengan trigram tetap cepat
-- di instance kecil.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_csr_search
  ON critical_sheet_rows USING GIN (search gin_trgm_ops);

-- Foto: findRowByUid mencari baris pemilik sebuah uid.
CREATE INDEX IF NOT EXISTS idx_csr_uid
  ON critical_sheet_rows (uid) WHERE uid <> '';

ALTER TABLE critical_sheet_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Critical sheet rows readable by everyone"
  ON critical_sheet_rows FOR SELECT USING (true);
-- Tanpa policy tulis: hanya service role (yang melewati RLS) yang boleh mengisi cermin.


-- ─── Status sinkronisasi ────────────────────────────────────────────────────
-- Satu baris. Menjawab "cermin ini seberapa baru, dan apakah sync terakhir berhasil".
CREATE TABLE IF NOT EXISTS critical_sheet_sync (
  id               smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  full_synced_at   timestamptz,   -- terakhir kali seluruh A1:AE dibaca
  tail_synced_at   timestamptz,   -- terakhir kali ekor + kolom Dokumentasi dibaca
  rows_critical    int NOT NULL DEFAULT 0,
  rows_maintenance int NOT NULL DEFAULT 0,

  -- TabRef kedua tab + pemisah argumen formula sesuai locale. Disimpan supaya penulisan
  -- sel Dokumentasi (writePhotoCell) tidak perlu membaca ulang metadata spreadsheet.
  tabs             jsonb,

  last_error       text
);

ALTER TABLE critical_sheet_sync ENABLE ROW LEVEL SECURITY;

-- Catatan: JANGAN menambahkan kedua tabel ini ke publication `supabase_realtime`.
-- Halaman ini memakai fetch biasa; tabel nyasar di publication pernah membuat compute
-- Supabase jenuh sampai API balas 522.
