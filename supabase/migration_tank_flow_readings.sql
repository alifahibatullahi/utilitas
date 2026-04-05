-- Migration: tambah tabel tank_flow_readings
-- Menyimpan flow rate input/output tank (DEMIN, RCW, SOLAR) beserta status pompa
-- Jalankan di Supabase SQL Editor

CREATE TABLE IF NOT EXISTS tank_flow_readings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id       TEXT NOT NULL CHECK (tank_id IN ('DEMIN', 'RCW', 'SOLAR')),
    direction     TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    label         TEXT NOT NULL,        -- nama source / destination
    rate          NUMERIC NOT NULL DEFAULT 0,  -- ton/h (0 untuk pump-only)
    pump          TEXT DEFAULT NULL,    -- nama pompa aktif (khusus Demin Revamp)
    operator_name TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tank_flow_readings_lookup
    ON tank_flow_readings(tank_id, direction, label, created_at DESC);

ALTER TABLE tank_flow_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read all"   ON tank_flow_readings FOR SELECT USING (true);
CREATE POLICY "insert all" ON tank_flow_readings FOR INSERT WITH CHECK (true);
