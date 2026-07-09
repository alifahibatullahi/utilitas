-- Migration: tank_logsheet untuk menyimpan level tank per jam ganjil WIB
-- Jika ada data baru untuk jam yang sama, data lama diganti (upsert)

CREATE TABLE IF NOT EXISTS tank_logsheet (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    tank_id     TEXT        NOT NULL,                -- 'RCW' | 'DEMIN' | 'SOLAR'
    date        DATE        NOT NULL,
    jam         INTEGER     NOT NULL,                -- jam ganjil WIB: 1, 3, 5, ..., 23
    level_m3    NUMERIC,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tank_id, date, jam)
);

-- Index untuk query cepat per tank + tanggal + jam
CREATE INDEX IF NOT EXISTS idx_tank_logsheet_lookup
    ON tank_logsheet (tank_id, date, jam);
