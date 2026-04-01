-- ═══════════════════════════════════════════════════════════════
-- Migration: Tambah kolom notif ke critical_equipment
-- Jalankan di Supabase SQL Editor jika tabel sudah ada
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE critical_equipment
    ADD COLUMN IF NOT EXISTS notif TEXT;

-- Verifikasi
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'critical_equipment'
ORDER BY ordinal_position;
