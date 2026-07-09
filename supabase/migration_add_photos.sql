-- ═══════════════════════════════════════════════════════════════
-- Migration: Add photos table for critical & maintenance records
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE photos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  critical_id    UUID        REFERENCES critical_equipment(id) ON DELETE CASCADE,
  maintenance_id UUID        REFERENCES maintenance_logs(id)   ON DELETE CASCADE,
  url            TEXT        NOT NULL,
  filename       TEXT        NOT NULL,
  uploaded_via   TEXT        NOT NULL DEFAULT 'app',   -- 'app' | 'whatsapp'
  uploaded_by    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT photos_one_parent CHECK (
    (critical_id IS NOT NULL)::int +
    (maintenance_id IS NOT NULL)::int = 1
  )
);

-- Indexes for fast lookups per parent record
CREATE INDEX idx_photos_critical_id    ON photos(critical_id);
CREATE INDEX idx_photos_maintenance_id ON photos(maintenance_id);
CREATE INDEX idx_photos_created_at     ON photos(created_at DESC);

-- RLS: anon can read (photos are public links via R2),
-- but writes are locked to service role only (done via API routes).
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photos readable by everyone"
  ON photos FOR SELECT USING (true);

CREATE POLICY "Photos writable by service role only"
  ON photos FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Photos deletable by service role only"
  ON photos FOR DELETE USING (auth.role() = 'service_role');
