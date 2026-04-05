-- Migration: Tambah tank_flow_readings dan solar_unloadings ke Supabase Realtime
-- Jalankan di Supabase SQL Editor
-- Agar halaman Tank Level auto-update saat ada perubahan dari form input

-- Tambah ke realtime publication (aman kalau sudah ada, akan skip)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE tank_flow_readings;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE solar_unloadings;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- Pastikan RLS policy untuk update/delete juga ada di solar_unloadings
-- (insert & select sudah ada dari schema awal, tapi update/delete belum)
DO $$
BEGIN
    BEGIN
        CREATE POLICY "update all" ON solar_unloadings FOR UPDATE USING (true) WITH CHECK (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        CREATE POLICY "delete all" ON solar_unloadings FOR DELETE USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- Pastikan RLS policy lengkap untuk tank_flow_readings
DO $$
BEGIN
    BEGIN
        CREATE POLICY "update all" ON tank_flow_readings FOR UPDATE USING (true) WITH CHECK (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        CREATE POLICY "delete all" ON tank_flow_readings FOR DELETE USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;
