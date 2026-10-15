-- Migration: asal + metode unloading di coal_arrivals
-- Dijalankan di Supabase SQL Editor.
--
-- Kedatangan batubara punya dua asal: 'tongkang' (= Via Laut di laporan harian) dan
-- 'darat' (= Via Darat). Khusus tongkang, unloading-nya lewat 'conveyor' atau
-- 'dump_truck'; untuk darat metode_unloading NULL.
--
-- Laporan harian (review supervisor & LHUBB DK/DM) kini MENJUMLAH tabel ini per asal,
-- jadi kedatangan di laporan shift dan di laporan harian adalah satu data.
--
-- Sengaja NULLABLE (kewajiban ditegakkan di form): kolom asal lama pernah di-drop
-- justru karena NOT NULL membuat setiap insert yang tidak menyertakannya gagal.
--
-- Aman: tabel masih kosong saat migrasi ini dibuat.
--
-- JANGAN daftarkan tabel ini ke publication supabase_realtime (insiden 3 Jun 2026).

ALTER TABLE coal_arrivals
    ADD COLUMN IF NOT EXISTS asal TEXT
        CHECK (asal IN ('tongkang', 'darat'));

ALTER TABLE coal_arrivals
    ADD COLUMN IF NOT EXISTS metode_unloading TEXT
        CHECK (metode_unloading IN ('conveyor', 'dump_truck'));
