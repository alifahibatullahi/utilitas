-- ============================================
-- PowerOps: Migration — Penerima Pribadi Reminder (per grup)
-- Copy-paste seluruh isi file ini ke Supabase SQL Editor, lalu RUN.
-- Aman di-run ulang (IF NOT EXISTS).
-- ============================================
--
-- Tujuan: untuk grup yang punya penerima pribadi aktif (mis. A–C, 3 orang per grup),
-- reminder shift & harian (LHUBB) dikirim HANYA ke nomor-nomor pribadi tsb (via Wablas),
-- TIDAK ke grup WhatsApp. Grup tanpa penerima aktif (mis. D) tetap dikirim ke grup WA.
-- Daftar penerima dikelola lewat WhatsApp Hub → tab "Penerima Pribadi".

CREATE TABLE IF NOT EXISTS whatsapp_reminder_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_letter TEXT NOT NULL CHECK (group_letter IN ('A', 'B', 'C', 'D')),
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,            -- format Wablas/Fonnte: 628xxxxxxxxxx (tanpa '+')
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminder_recipients_group
    ON whatsapp_reminder_recipients (group_letter) WHERE active;
