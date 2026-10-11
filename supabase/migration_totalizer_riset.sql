-- Migration: totalizer_riset
-- Dijalankan di Supabase SQL Editor (pola berkas datar migration_*.sql).
--
-- Penanda RISET raw totalizer per laporan: meter kembali ke 0 lalu menghitung ulang.
-- Selisih laporan yang jendelanya mencakup riset = (nilai akhir sebelum riset - prev) + cur.
-- Satu kunci per meter (lihat TOTALIZER_METERS di lib/totalizer-riset.ts):
--   { "steam_a": { "nilai_akhir": 10000, "station": "panel_boiler_a",
--                  "oleh": "Nama", "dicatat_pada": "2026-10-11T07:10:00Z" } }
--
-- Disimpan di laporan INDUK (bukan child table) supaya semua pembaca yang sudah memuat
-- laporan (form, route Sheets, logbook, review publish) ikut membawanya tanpa join baru.
--
-- Penulisan HANYA lewat RPC merge di bawah — per kunci, atomik, seperti station_fillers:
-- station tidak saling timpa, dan kunci bernilai JSON null = penanda dihapus.
--
-- PENTING: JANGAN daftarkan tabel mana pun ke publication supabase_realtime (insiden
-- 3 Jun 2026, API 522).

ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS totalizer_riset JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS totalizer_riset JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.merge_shift_totalizer_riset(p_report_id uuid, p_patch jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE shift_reports
    SET totalizer_riset = (
        SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
        FROM jsonb_each(COALESCE(totalizer_riset, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb)) AS e(key, value)
        WHERE jsonb_typeof(e.value) <> 'null'
    )
    WHERE id = p_report_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.merge_daily_totalizer_riset(p_report_id uuid, p_patch jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE daily_reports
    SET totalizer_riset = (
        SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
        FROM jsonb_each(COALESCE(totalizer_riset, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb)) AS e(key, value)
        WHERE jsonb_typeof(e.value) <> 'null'
    )
    WHERE id = p_report_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.merge_shift_totalizer_riset(uuid, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_daily_totalizer_riset(uuid, jsonb) TO anon, authenticated, service_role;
