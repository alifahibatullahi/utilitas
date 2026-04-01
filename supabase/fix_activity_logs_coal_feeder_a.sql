-- ═══════════════════════════════════════════════════════════════
-- Fix: Hapus duplikat milestone log untuk critical Coal Feeder A
-- Sisakan hanya 1 entri terbaru per milestone (new_status) per critical
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Hapus duplikat status_changed (critical itu sendiri)
-- Sisakan yang paling baru per (critical_id, new_status)
DELETE FROM critical_activity_logs
WHERE id IN (
    SELECT id FROM (
        SELECT
            cal.id,
            ROW_NUMBER() OVER (
                PARTITION BY cal.critical_id, cal.metadata->>'new_status'
                ORDER BY cal.created_at DESC
            ) AS rn
        FROM critical_activity_logs cal
        JOIN critical_equipment ce ON ce.id = cal.critical_id
        WHERE LOWER(ce.item) LIKE '%coal feeder a%'
          AND cal.action_type IN ('status_changed', 'maintenance_updated')
          AND cal.metadata IS NOT NULL
          AND cal.metadata->>'new_status' IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Verifikasi hasil: lihat sisa log untuk coal feeder A
SELECT
    ce.item,
    cal.action_type,
    cal.metadata->>'old_status' AS dari,
    cal.metadata->>'new_status' AS ke,
    cal.actor,
    cal.created_at
FROM critical_activity_logs cal
JOIN critical_equipment ce ON ce.id = cal.critical_id
WHERE LOWER(ce.item) LIKE '%coal feeder a%'
ORDER BY ce.item, cal.created_at;
