-- Migration: cermin data E-Logsheet APM (DILOC) untuk /dashboard
-- Diisi agen di PC kantor (scripts/apm-agent) lewat /api/apm/ingest, tiap ±1 jam.
-- APM menolak IP luar Indonesia, jadi server Vercel tidak mengambil sendiri.
-- Hanya tag yang terdaftar di lib/apm/tags.ts yang disalin.
-- JANGAN tambahkan tabel ini ke publication supabase_realtime (insiden 522, 3 Jun 2026).

CREATE TABLE IF NOT EXISTS apm_readings (
    unit_id     INTEGER     NOT NULL,           -- id unit APM (2048 = Panel Boiler A, …)
    tag         TEXT        NOT NULL,           -- tag DCS, mis. 1FI102
    reading_at  TIMESTAMPTZ NOT NULL,           -- tanggal + slot logsheet (WIB)
    value       NUMERIC,                        -- NULL kalau isian bukan angka
    value_text  TEXT,                           -- isian mentah bila bukan angka
    recorded_at TIMESTAMPTZ,                    -- kapan operator mengetik nilainya di APM
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (unit_id, tag, reading_at)
);

CREATE INDEX IF NOT EXISTS idx_apm_readings_reading_at ON apm_readings (reading_at DESC);

ALTER TABLE apm_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all" ON apm_readings FOR SELECT USING (true);

-- Satu baris (id = 1): status kiriman terakhir agen. TANPA policy apa pun, hanya service
-- role (API PowerOps) yang membaca/menulis.
CREATE TABLE IF NOT EXISTS apm_sync_state (
    id           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    attempted_at TIMESTAMPTZ,                   -- kiriman terakhir (berhasil atau gagal)
    synced_at    TIMESTAMPTZ,                   -- kiriman terakhir yang berhasil
    last_error   TEXT
);

ALTER TABLE apm_sync_state ENABLE ROW LEVEL SECURITY;

-- 30 Okt 2026: pengambilan pindah dari Vercel ke agen PC kantor. Cookie sesi APM dan sidik
-- jari kredensial yang ditolak kini disimpan agen sendiri (apm-agent-state.json).
ALTER TABLE apm_sync_state DROP COLUMN IF EXISTS cookies, DROP COLUMN IF EXISTS failed_cred_fp;
