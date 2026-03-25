-- ============================================
-- PowerOps: Migration — Update Operators
-- Copy-paste seluruh isi file ini ke Supabase SQL Editor, lalu RUN
-- ============================================

-- 1. Tambah kolom baru
ALTER TABLE operators
  ADD COLUMN IF NOT EXISTS nik TEXT,
  ADD COLUMN IF NOT EXISTS jabatan TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT;

-- 2. Hapus data lama
DELETE FROM operators;

-- 3. Insert 51 personil baru
INSERT INTO operators (name, role, group_name, nik, jabatan, company) VALUES
-- ─── Group A — Organik (UBB) ───
('Ardhian Wisnu Perdana', 'group_a', 'A', '2074878', 'Supervisor', 'UBB'),
('Jaka Riyantaka', 'group_a', 'A', '2146101', 'Foreman Turbin', 'UBB'),
('Aldilla Indra R', 'group_a', 'A', '2180323', NULL, 'UBB'),
('Ilham Mirza Nur R', 'group_a', 'A', '2146074', 'Foreman Boiler', 'UBB'),
('Bagus Indra Prasetya', 'group_a', 'A', '2190502', NULL, 'UBB'),
('Rizky Dharmaji', 'group_a', 'A', '2156352', NULL, 'UBB'),
('Lutfi Abdul Aziz', 'group_a', 'A', '2180237', NULL, 'UBB'),
-- Group A — Tenaga Alih Daya
('Andreansyah', 'handling', 'A', '25-09677', NULL, 'PT FJM'),
('Bambang Agus', 'group_a', 'A', '25-10301', NULL, 'PT FJM'),
('M. Syaiful Amri', 'group_a', 'A', '25-09676', NULL, 'PT FJM'),
('Aditya Dwi', 'group_a', 'A', '24-05632', NULL, 'PT Shohib Jaya Putra'),
('Miftahul Ihsan', 'group_a', 'A', '24-05636', NULL, 'PT Shohib Jaya Putra'),

-- ─── Group B — Organik (UBB) ───
('Putra Aris Hidayat', 'group_b', 'B', '2125518', 'Supervisor', 'UBB'),
('Bili Pratama Kurnia', 'group_b', 'B', '2146080', 'Foreman Turbin', 'UBB'),
('Yusuf Efendi Saputra', 'group_b', 'B', '2156361', NULL, 'UBB'),
('Ferdian Maulana Fah', 'group_b', 'B', '2125676', 'Foreman Boiler', 'UBB'),
('Rachmat Nordiyansyah', 'group_b', 'B', '2146117', NULL, 'UBB'),
('Nastainul Firdaus Z', 'group_b', 'B', '2146089', NULL, 'UBB'),
('Mohamad Rizky Arsyi', 'group_b', 'B', '2180310', NULL, 'UBB'),
-- Group B — Tenaga Alih Daya
('Muhammad Syahri', 'handling', 'B', '25-09683', NULL, 'PT FJM'),
('Mulyono', 'group_b', 'B', '25-10302', NULL, 'PT FJM'),
('Sun''an Kusaini', 'group_b', 'B', '25-08504', NULL, 'PT FJM'),
('Hadi Santoso', 'group_b', 'B', '24-05614', NULL, 'PT Shohib Jaya Putra'),
('Radyth Ferdynanto', 'group_b', 'B', '24-25639', NULL, 'PT Shohib Jaya Putra'),

-- ─── Group C — Organik (UBB) ───
('Zulkarnain Bayu', 'group_c', 'C', '2125519', 'Supervisor', 'UBB'),
('Ryo Risky Faizal', 'group_c', 'C', '2125716', 'Foreman Turbin', 'UBB'),
('Rofindra Alif Iskandar', 'group_c', 'C', '2180327', NULL, 'UBB'),
('Akhmad Agung Prabowo', 'group_c', 'C', '2156285', 'Foreman Boiler', 'UBB'),
('Dimas Cahyo Nugroho', 'group_c', 'C', '2180302', NULL, 'UBB'),
('Muhammad Indra Ali', 'group_c', 'C', '2156337', NULL, 'UBB'),
('Rizqy Aulia Rahman', 'group_c', 'C', '2156353', NULL, 'UBB'),
-- Group C — Tenaga Alih Daya
('Achmad Mirza Yusuf', 'handling', 'C', '25-10304', NULL, 'PT FJM'),
('Moh. Muchlis', 'group_c', 'C', '25-09675', NULL, 'PT FJM'),
('Yusuf Adnan', 'group_c', 'C', '25-08539', NULL, 'PT FJM'),
('Alif Amirul', 'group_c', 'C', '24-25633', NULL, 'PT Shohib Jaya Putra'),
('Naufal Nasrulloh', 'group_c', 'C', '24-05636', NULL, 'PT Shohib Jaya Putra'),

-- ─── Group D — Organik (UBB) ───
('Ade Rahmad Abrianto', 'group_d', 'D', '2125719', 'Supervisor', 'UBB'),
('Yudistira Alnur', 'group_d', 'D', '2125525', 'Foreman Turbin', 'UBB'),
('Moh. Taufiqurrohman', 'group_d', 'D', '2146088', NULL, 'UBB'),
('Julio Purnanugraha', 'group_d', 'D', '2146090', 'Foreman Boiler', 'UBB'),
('Alifahi Batullahi', 'group_d', 'D', '2180331', NULL, 'UBB'),
('Ahmad Shofi Hamim', 'group_d', 'D', '2156283', NULL, 'UBB'),
('Achmad Ali Chorudin', 'group_d', 'D', '2125718', NULL, 'UBB'),
-- Group D — Tenaga Alih Daya
('Mohammad Agil', 'handling', 'D', '25-09679', NULL, 'PT FJM'),
('Mohammad Zubairi', 'group_d', 'D', '25-08496', NULL, 'PT FJM'),
('Andik Purwanto', 'group_d', 'D', '25-10300', NULL, 'PT FJM'),
('M. Diso', 'group_d', 'D', '24-05637', NULL, 'PT Shohib Jaya Putra'),
('Firman Fathollah', 'group_d', 'D', '24-05634', NULL, 'PT Shohib Jaya Putra'),

-- ─── Normal Day (Management) ───
('Dimas Randyta Iswara', 'admin', NULL, '2145605', 'AVP', 'UBB'),
('Mashasan Imanuddin', 'admin', NULL, '2085010', 'Junior AVP', 'UBB'),
('Admin Sistem', 'admin', NULL, NULL, NULL, NULL);

-- ============================================
-- 4. Tambah tabel tank_levels (real-time monitoring)
-- Aman di-run ulang (IF NOT EXISTS)
-- ============================================

CREATE TABLE IF NOT EXISTS tank_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id TEXT NOT NULL CHECK (tank_id IN ('DEMIN', 'RCW', 'SOLAR')),
    level_pct NUMERIC NOT NULL,
    level_m3 NUMERIC NOT NULL,
    operator_name TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tank_levels_tank_id ON tank_levels(tank_id);
CREATE INDEX IF NOT EXISTS idx_tank_levels_created_at ON tank_levels(created_at DESC);

ALTER TABLE tank_levels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Allow all for anon" ON tank_levels FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE tank_levels;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
