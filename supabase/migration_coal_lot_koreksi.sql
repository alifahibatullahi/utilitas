-- Migration: coal_lot_koreksi
-- Dijalankan di Supabase SQL Editor (pola berkas datar migration_*.sql).
--
-- Lapisan KOREKSI MANUAL untuk denah /coal-storage. Sebelum ini denah hanya bisa
-- menurunkan stok dari kejadian (coal_arrivals dikurangi coal_loadings, FIFO per zona);
-- padahal yang dilihat operator di lapangan adalah KEADAAN, dan keadaan itu sering
-- meleset dari hitungan kejadian (1 shovel dianggap 10 ton, gundukan longsor, dsb).
--
-- Tabel ini APPEND-ONLY. Satu baris = satu pernyataan operator tentang SATU tumpukan.
-- Yang berlaku adalah baris TERBARU per lot_id; baris lama tidak pernah di-UPDATE atau
-- di-DELETE - jadi tabel ini sekaligus jejak audit "siapa mengubah apa, kapan".
--
-- coal_arrivals & coal_loadings TIDAK disentuh sama sekali: keduanya tetap catatan
-- kejadian milik laporan shift (dan sumber kartu Kedatangan Batubara di laporan
-- harian). Denah membaca keduanya lalu MENIMPANYA dengan baris di sini.
--
-- Rumus yang dipakai lib/coal-storage-query.ts:
--   ton(tumpukan) = ton_dasar
--                 + jumlah kedatangan yang LEBIH BARU dari basis
--                 - jumlah loading    yang LEBIH BARU dari basis   (FIFO per zona)
-- Tumpukan tanpa baris di tabel ini: ton_dasar 0 dan basis = kedatangan pertamanya,
-- yaitu persis perilaku murni-kejadian seperti sebelum migrasi ini.
--
-- PENTING: JANGAN daftarkan tabel ini ke publication supabase_realtime. Tabel nyasar
-- di sana pernah membuat compute Supabase jenuh sampai API balas 522 (insiden
-- 3 Jun 2026). Halaman /coal-storage cukup fetch saat dibuka.

CREATE TABLE IF NOT EXISTS coal_lot_koreksi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identitas TUMPUKAN, bukan identitas baris koreksi. Untuk tumpukan yang lahir dari
    -- laporan shift ini sama dengan coal_arrivals.batch_id; untuk tumpukan yang dicatat
    -- langsung dari denah ini UUID baru yang tidak punya baris kedatangan sama sekali.
    lot_id UUID NOT NULL,

    zona TEXT NOT NULL,                      -- 'O1' .. 'C12', lihat lib/coal-storage.ts
    supplier TEXT NOT NULL,
    tanggal_masuk DATE NOT NULL,             -- hari batubara MULAI masuk storage

    -- Tonase yang DINYATAKAN operator saat opname; jadi titik nol perhitungan.
    ton_dasar NUMERIC NOT NULL DEFAULT 0,

    -- Basis waktu. Hanya kedatangan & loading yang LEBIH BARU dari (tanggal, shift) ini
    -- yang masih menambah/mengurangi ton_dasar; yang lebih lama dianggap sudah tercermin
    -- pada angka yang dilihat operator di lapangan, jadi tidak dihitung dua kali.
    -- Urutan dalam satu tanggal: malam < pagi < sore (konvensi ENDING, shift malam
    -- bertanggal hari SUBMIT - lihat URUT_SHIFT di lib/coal-storage.ts).
    sejak_tanggal DATE NOT NULL,
    sejak_shift TEXT NOT NULL,               -- 'pagi' | 'sore' | 'malam'

    dihapus BOOLEAN NOT NULL DEFAULT false,  -- true = tumpukan sudah tidak ada di lapangan
    keterangan TEXT,

    -- operator_name WAJIB: Operator.supabaseId opsional (lib/constants.ts) dan memang
    -- kosong kalau daftar operator jatuh ke konstanta, jadi id saja tidak cukup untuk
    -- menjejak "terakhir diubah <nama>". Pola sama dengan migration_tank_flow_readings.
    operator_id TEXT,
    operator_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Baris terbaru per tumpukan = satu-satunya yang berlaku; itu pola baca terpanas.
CREATE INDEX IF NOT EXISTS idx_coal_lot_koreksi_lot ON coal_lot_koreksi(lot_id, created_at DESC);
-- "Terakhir diubah" di header halaman.
CREATE INDEX IF NOT EXISTS idx_coal_lot_koreksi_created ON coal_lot_koreksi(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coal_lot_koreksi_zona ON coal_lot_koreksi(zona);

-- RLS - samakan dengan coal_loadings / coal_arrivals / solar_usages.
ALTER TABLE coal_lot_koreksi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON coal_lot_koreksi FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON coal_lot_koreksi FOR ALL TO authenticated USING (true) WITH CHECK (true);
