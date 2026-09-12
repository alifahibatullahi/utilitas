-- Migration: buang kolom jam dari coal_arrivals
-- Dijalankan di Supabase SQL Editor.
--
-- Yang dicatat operator adalah TANGGAL batubara mulai masuk storage, bukan jamnya.
-- Untuk pengiriman yang berlanjut antar shift, tanggal itu diwarisi dari kedatangan
-- pertama (batch_id yang sama) supaya umur tumpukan di /coal-storage dihitung sejak
-- batubara pertama kali menyentuh lapangan — jam per potongan tidak menambah apa pun.
--
-- Aman: tabel masih kosong saat migrasi ini dibuat (fitur belum dibuka untuk operator).

ALTER TABLE coal_arrivals DROP COLUMN IF EXISTS jam;
