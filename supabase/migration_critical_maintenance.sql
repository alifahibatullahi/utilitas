-- ═══════════════════════════════════════════════════════════════
-- Migration: Redesign Critical Equipment & Maintenance Logs
-- Menambah relasi 1:N (critical → maintenance), status lifecycle,
-- scope HAR, foreman, notif SAP
-- ═══════════════════════════════════════════════════════════════

-- Drop existing tables
DROP TABLE IF EXISTS maintenance_logs CASCADE;
DROP TABLE IF EXISTS critical_equipment CASCADE;

-- ─── Critical Equipment (redesigned) ───
CREATE TABLE critical_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID REFERENCES shift_reports(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    item TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    scope TEXT NOT NULL,                          -- 'mekanik' | 'listrik' | 'instrumen' | 'sipil'
    foreman TEXT NOT NULL,                        -- 'foreman_turbin' | 'foreman_boiler'
    status TEXT NOT NULL DEFAULT 'OPEN',          -- 'OPEN' | 'CLOSED'
    notif TEXT,                                   -- nomor notifikasi SAP
    reported_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Maintenance Logs (redesigned) ───
CREATE TABLE maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_report_id UUID REFERENCES shift_reports(id) ON DELETE SET NULL,
    critical_id UUID REFERENCES critical_equipment(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    item TEXT NOT NULL,
    uraian TEXT NOT NULL,
    scope TEXT NOT NULL,                          -- 'mekanik' | 'listrik' | 'instrumen' | 'sipil'
    foreman TEXT NOT NULL,                        -- 'foreman_turbin' | 'foreman_boiler'
    tipe TEXT NOT NULL DEFAULT 'corrective',      -- 'corrective' | 'preventif'
    status TEXT NOT NULL DEFAULT 'OPEN',          -- 'OPEN' | 'IP' | 'OK'
    keterangan TEXT,
    notif TEXT,                                   -- nomor permintaan kerja SAP
    reported_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ───
CREATE INDEX idx_critical_status ON critical_equipment(status);
CREATE INDEX idx_critical_date ON critical_equipment(date DESC);
CREATE INDEX idx_critical_item ON critical_equipment(item);
CREATE INDEX idx_maintenance_status ON maintenance_logs(status);
CREATE INDEX idx_maintenance_critical ON maintenance_logs(critical_id);
CREATE INDEX idx_maintenance_date ON maintenance_logs(date DESC);

-- ─── Critical Activity Logs ───
CREATE TABLE critical_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    critical_id UUID NOT NULL REFERENCES critical_equipment(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,    -- 'created' | 'status_changed' | 'note' | 'maintenance_added' | 'maintenance_updated' | 'maintenance_deleted'
    description TEXT NOT NULL,
    actor TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_critical ON critical_activity_logs(critical_id);
CREATE INDEX idx_activity_created ON critical_activity_logs(created_at DESC);

-- ─── RLS ───
ALTER TABLE critical_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON critical_equipment FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON maintenance_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON critical_activity_logs FOR ALL TO anon USING (true) WITH CHECK (true);
