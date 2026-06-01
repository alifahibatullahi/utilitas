-- Tambah kolom PIE "D - R" pada laporan harian (daily_report_turbine_misc).
-- Delivered = totalizer_import, Received = totalizer_export (sudah ada).
-- D - R diisi manual lewat form Input Harian > tab PIU, lalu ditampilkan di Logbook.
ALTER TABLE daily_report_turbine_misc
    ADD COLUMN IF NOT EXISTS pie_dr NUMERIC;
