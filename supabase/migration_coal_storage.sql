-- Migration: coal_loadings + coal_arrivals
-- Dijalankan di Supabase SQL Editor (pola berkas datar migration_*.sql).
--
-- Dua tabel penampung untuk halaman /coal-storage. Keduanya BERDIRI SENDIRI dengan
-- kunci (date, shift) — persis pola solar_unloadings / ash_unloadings — jadi tidak
-- ada kolom baru di shift_esp_handling dan peta ownership station di
-- hooks/useShiftReport.tsx tidak perlu disentuh sama sekali.
--
-- PENTING: JANGAN daftarkan tabel ini ke publication supabase_realtime. Tabel nyasar
-- di sana pernah membuat compute Supabase jenuh sampai API balas 522 (insiden
-- 3 Jun 2026). Halaman /coal-storage cukup fetch saat dibuka.

-- Loading batubara per pilar. Satu shift boleh punya beberapa baris karena payloader
-- bisa mengeruk lebih dari satu pilar dalam satu shift.
CREATE TABLE IF NOT EXISTS coal_loadings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,                      -- tanggal laporan shift (malam = tanggal submit)
    shift TEXT NOT NULL,                     -- 'pagi' | 'sore' | 'malam'
    zona TEXT NOT NULL,                      -- 'O1' .. 'C12', lihat lib/coal-storage.ts
    shovel NUMERIC NOT NULL DEFAULT 0,       -- jumlah shovel payloader (1 shovel ~ 10 ton)
    hopper TEXT,                             -- 'A' = darat | 'B' = laut | 'AB'
    operator_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coal_loadings_date ON coal_loadings(date);
CREATE INDEX IF NOT EXISTS idx_coal_loadings_zona_date ON coal_loadings(zona, date);

-- Kedatangan batubara. Satu baris = tonase yang masuk DI SHIFT ITU; satu pengiriman
-- yang berlanjut ke shift/hari berikutnya memakai batch_id yang sama supaya di denah
-- tetap terbaca sebagai SATU tumpukan dengan tanggal masuk paling awal.
CREATE TABLE IF NOT EXISTS coal_arrivals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,                  -- baris lanjutan mewarisi batch_id induknya
    date DATE NOT NULL,
    shift TEXT NOT NULL,
    supplier TEXT NOT NULL,                  -- nama PT
    zona TEXT NOT NULL,
    asal TEXT NOT NULL,                      -- 'darat' | 'laut'
    ton NUMERIC NOT NULL DEFAULT 0,
    tanggal_masuk DATE NOT NULL,
    jam TEXT,                                -- 'HH:MM', opsional
    status TEXT NOT NULL DEFAULT 'progres',  -- 'progres' = masih berlanjut | 'selesai'
    keterangan TEXT,
    operator_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coal_arrivals_date ON coal_arrivals(date);
CREATE INDEX IF NOT EXISTS idx_coal_arrivals_zona_date ON coal_arrivals(zona, date);
CREATE INDEX IF NOT EXISTS idx_coal_arrivals_batch ON coal_arrivals(batch_id);
-- Daftar "pengiriman yang masih berjalan" dibaca tiap kali form Handling dibuka.
CREATE INDEX IF NOT EXISTS idx_coal_arrivals_status ON coal_arrivals(status);

-- RLS — samakan dengan solar_usages / ash_unloadings / coal_activities
ALTER TABLE coal_loadings ENABLE ROW LEVEL SECURITY;
ALTER TABLE coal_arrivals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON coal_loadings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON coal_loadings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON coal_arrivals FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON coal_arrivals FOR ALL TO authenticated USING (true) WITH CHECK (true);
