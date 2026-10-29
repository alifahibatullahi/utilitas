-- Migration: cermin data E-Logsheet APM (DILOC) untuk /dashboard
-- Diisi lib/apm/sync.ts (cron notify-shift tiap ±1 jam + tombol Refresh dashboard).
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

-- Satu baris (id = 1). Berisi cookie sesi APM/Keycloak → TANPA policy apa pun,
-- hanya service role yang bisa membaca/menulis.
CREATE TABLE IF NOT EXISTS apm_sync_state (
    id             INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    cookies        TEXT,
    attempted_at   TIMESTAMPTZ,                 -- percobaan terakhir (berhasil atau gagal)
    synced_at      TIMESTAMPTZ,                 -- sync terakhir yang berhasil
    last_error     TEXT,
    failed_cred_fp TEXT                         -- sha256 kredensial yang ditolak Keycloak
);

ALTER TABLE apm_sync_state ENABLE ROW LEVEL SECURITY;
