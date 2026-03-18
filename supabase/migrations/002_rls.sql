-- ============================================
-- Row Level Security Policies
-- Tanpa auth: semua akses via anon key
-- RLS disabled karena tidak pakai Supabase Auth
-- ============================================

-- Disable RLS on all tables (no auth, public access via anon key)
-- Nanti bisa diaktifkan kalau tambah auth

ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE boiler_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE turbin_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE steam_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE tank_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE solar_unloadings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon (public) role
-- Since we don't use Supabase Auth, all requests come as 'anon'

CREATE POLICY "Allow all for anon" ON operators FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_reports FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON boiler_params FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON turbin_params FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON power_distribution FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON steam_distribution FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON tank_levels FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON flow_rates FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON lab_results FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON critical_equipment FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON maintenance_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shift_notes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_reports FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON solar_unloadings FOR ALL TO anon USING (true) WITH CHECK (true);
