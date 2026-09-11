-- Migration: buang kolom asal dari coal_arrivals
-- Dijalankan di Supabase SQL Editor.
--
-- Operator handling tidak lagi mencatat darat/laut saat kedatangan batubara. Kolomnya
-- WAJIB ikut dibuang, bukan sekadar dilepas dari form: `asal` NOT NULL, jadi kalau
-- dibiarkan setiap insert kedatangan akan gagal.
--
-- Kalau nanti darat/laut kembali dibutuhkan, cukup satu migrasi menambah kolom lagi;
-- di laporan harian angkanya sudah ada di daily_report_coal_transfer.darat_24_ton /
-- laut_24_ton.
--
-- Aman: tabel masih kosong (fitur belum dibuka untuk operator).

ALTER TABLE coal_arrivals DROP COLUMN IF EXISTS asal;
