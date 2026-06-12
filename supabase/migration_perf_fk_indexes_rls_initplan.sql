-- Pencegahan beban DB (follow-up outage 2026-06-12, ~23:12 WIB):
-- DB sempat restart ~1 menit setelah resource exhaustion (statement timeout massal).
-- Migration ini sudah diterapkan ke production via Supabase MCP (perf_fk_indexes_rls_initplan).

-- 1) Index untuk foreign key yang belum ter-cover (dipakai join laporan shift/harian)
CREATE INDEX IF NOT EXISTS idx_critical_equipment_shift_report_id ON public.critical_equipment (shift_report_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_created_by ON public.daily_reports (created_by);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_shift_report_id ON public.maintenance_logs (shift_report_id);
CREATE INDEX IF NOT EXISTS idx_shift_notes_author_id ON public.shift_notes (author_id);
CREATE INDEX IF NOT EXISTS idx_shift_notes_shift_report_id ON public.shift_notes (shift_report_id);
CREATE INDEX IF NOT EXISTS idx_shift_reports_created_by ON public.shift_reports (created_by);
CREATE INDEX IF NOT EXISTS idx_solar_unloadings_operator_id ON public.solar_unloadings (operator_id);

-- 2) tank_levels: query selalu filter tank_id + order created_at desc limit 1.
--    Ganti index single-column (tidak terpakai) dengan composite yang match pola query.
CREATE INDEX IF NOT EXISTS idx_tank_levels_tank_id_created_at ON public.tank_levels (tank_id, created_at DESC);
DROP INDEX IF EXISTS public.idx_tank_levels_tank_id;

-- 3) RLS initplan: auth.role() dibungkus SELECT supaya dievaluasi sekali per query,
--    bukan per baris (advisor: auth_rls_initplan di tabel photos).
DROP POLICY IF EXISTS "Photos writable by service role only" ON public.photos;
CREATE POLICY "Photos writable by service role only" ON public.photos
  FOR INSERT WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Photos deletable by service role only" ON public.photos;
CREATE POLICY "Photos deletable by service role only" ON public.photos
  FOR DELETE USING ((SELECT auth.role()) = 'service_role');

-- 4) solar_unloadings: hapus policy duplikat — "Allow all for anon" (ALL) sudah
--    mencakup UPDATE/DELETE untuk anon, policy tambahan hanya menambah biaya evaluasi.
DROP POLICY IF EXISTS "delete all" ON public.solar_unloadings;
DROP POLICY IF EXISTS "update all" ON public.solar_unloadings;
