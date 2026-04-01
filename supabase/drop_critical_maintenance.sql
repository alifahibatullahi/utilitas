-- ═══════════════════════════════════════════════════════════════
-- Drop: Hapus semua data & tabel Critical dan Maintenance
-- ⚠️  HATI-HATI: Operasi ini tidak bisa dibatalkan!
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS critical_activity_logs CASCADE;
DROP TABLE IF EXISTS maintenance_logs CASCADE;
DROP TABLE IF EXISTS critical_equipment CASCADE;
