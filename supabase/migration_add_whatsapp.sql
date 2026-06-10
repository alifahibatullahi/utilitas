-- WhatsApp Notifications Migration
-- Adds phone_number to operators, plus tables for groups, templates, and send log.

-- 1. Phone number per operator (Fonnte format: 628xxxxxxxxxx — no '+')
ALTER TABLE operators ADD COLUMN IF NOT EXISTS phone_number TEXT;
DO $$ BEGIN
    ALTER TABLE operators ADD CONSTRAINT operators_phone_unique UNIQUE (phone_number);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. WhatsApp target groups (group JID for Fonnte, e.g. "12036xxxxx@g.us")
CREATE TABLE IF NOT EXISTS whatsapp_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    fonnte_target TEXT NOT NULL,
    is_group BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Notification log (audit + 5-min throttle source-of-truth)
CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL,
    target_date DATE NOT NULL,
    target_shift TEXT,
    target_group TEXT,
    sent_to TEXT NOT NULL,
    payload TEXT,
    sent_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_log_lookup
    ON notification_log (kind, target_date, target_shift, sent_at DESC);

-- 4. Editable message templates with placeholders
CREATE TABLE IF NOT EXISTS notification_templates (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    body TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO notification_templates (key, label, body) VALUES
('shift_reminder', 'Reminder Laporan Shift',
'🔔 *Reminder Laporan Shift {{shift}}*
Grup {{group}} — {{date}}

Mohon mengisi laporan shift sesuai station masing-masing:

{{links}}'),
('daily_reminder', 'Reminder Laporan Harian (LHUBB)',
'🔔 *Reminder Laporan Harian (LHUBB)*
Tanggal: {{date}}

Mohon mengisi laporan harian sesuai station masing-masing:

{{links}}'),
('shift_share', 'Share Hasil Laporan Shift',
'📋 *Laporan Shift {{shift}} — {{date}}*
Grup {{group}}

{{summary}}'),
('daily_share', 'Share Hasil Laporan Harian',
'📋 *Laporan Harian (LHUBB) — {{date}}*

{{summary}}'),
('maintenance_broadcast', 'Broadcast Permintaan Maintenance',
'🛠️ *Permintaan Maintenance OPEN*
Per: {{date}}

{{summary}}')
ON CONFLICT (key) DO NOTHING;
