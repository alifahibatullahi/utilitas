-- WhatsApp reminder schedule (admin-editable)
-- Replaces hardcoded times in app/api/cron/notify-shift/route.ts

CREATE TABLE IF NOT EXISTS notification_schedule (
    id TEXT PRIMARY KEY,                -- 'shift_pagi'|'shift_sore'|'shift_malam'|'daily_lhubb'
    label TEXT NOT NULL,
    kind TEXT NOT NULL,                 -- 'shift_reminder' | 'daily_reminder'
    shift TEXT,                         -- 'pagi'|'sore'|'malam'|null
    start_hour INT NOT NULL,            -- WIB 0-23
    start_minute INT NOT NULL,          -- 0-59
    -- For end times that wrap past midnight encode as 24+H (e.g. 02:00 next-day = end_hour=26).
    end_hour INT NOT NULL,
    end_minute INT NOT NULL,
    throttle_minutes INT NOT NULL DEFAULT 15,
    enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO notification_schedule (id, label, kind, shift, start_hour, start_minute, end_hour, end_minute, throttle_minutes) VALUES
('shift_pagi',  'Reminder Shift Pagi (07:00-15:00)',  'shift_reminder', 'pagi',  12, 30, 15, 0,  15),
('shift_sore',  'Reminder Shift Sore (15:00-23:00)',  'shift_reminder', 'sore',  20, 30, 23, 0,  15),
('shift_malam', 'Reminder Shift Malam (23:00-07:00)', 'shift_reminder', 'malam', 4,  30, 7,  0,  15),
('daily_lhubb', 'Reminder Laporan Harian (LHUBB)',    'daily_reminder', NULL,    23, 0,  26, 0,  15)
ON CONFLICT (id) DO NOTHING;
