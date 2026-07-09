-- ============================================================
-- Migration: Tambah logsheet_time ke shift_reports & daily_reports
--
-- Aturan jam logsheet:
--   Shift malam  → 06:00
--   Shift pagi   → 14:00
--   Shift sore   → 22:00
--   Laporan harian → 00:00 (mewakili 24:00 / akhir hari)
--
-- Behavior upsert: data lama diganti data baru,
--   created_at tidak berubah, updated_at diperbarui.
-- ============================================================

-- ─── 1. Tambah kolom logsheet_time ke shift_reports ──────────────────────────

ALTER TABLE shift_reports
    ADD COLUMN IF NOT EXISTS logsheet_time TIME NOT NULL DEFAULT '06:00';

-- Backfill berdasarkan shift yang sudah ada
UPDATE shift_reports SET logsheet_time = '06:00' WHERE shift = 'malam';
UPDATE shift_reports SET logsheet_time = '14:00' WHERE shift = 'pagi';
UPDATE shift_reports SET logsheet_time = '22:00' WHERE shift = 'sore';

-- Hapus default setelah backfill (wajib diisi eksplisit ke depannya)
ALTER TABLE shift_reports ALTER COLUMN logsheet_time DROP DEFAULT;

-- ─── 2. Tambah kolom logsheet_time & updated_at ke daily_reports ─────────────

ALTER TABLE daily_reports
    ADD COLUMN IF NOT EXISTS logsheet_time TIME NOT NULL DEFAULT '00:00';

ALTER TABLE daily_reports
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill: semua laporan harian jam 00:00 (= 24:00 akhir hari)
UPDATE daily_reports SET logsheet_time = '00:00';

-- ─── 3. Trigger: auto-set logsheet_time dari shift pada shift_reports ─────────

CREATE OR REPLACE FUNCTION set_shift_logsheet_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.logsheet_time := CASE NEW.shift
        WHEN 'malam' THEN '06:00'::TIME
        WHEN 'pagi'  THEN '14:00'::TIME
        WHEN 'sore'  THEN '22:00'::TIME
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_shift_logsheet_time ON shift_reports;
CREATE TRIGGER trg_set_shift_logsheet_time
    BEFORE INSERT OR UPDATE OF shift ON shift_reports
    FOR EACH ROW EXECUTE FUNCTION set_shift_logsheet_time();

-- ─── 4. Trigger: auto-update updated_at pada daily_reports ───────────────────

CREATE OR REPLACE FUNCTION update_daily_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_daily_reports_updated_at ON daily_reports;
CREATE TRIGGER trg_daily_reports_updated_at
    BEFORE UPDATE ON daily_reports
    FOR EACH ROW EXECUTE FUNCTION update_daily_reports_updated_at();

-- ─── 5. Trigger: auto-update updated_at child tables daily_report_* ──────────
--
-- Karena child tables di-upsert via ON CONFLICT DO UPDATE,
-- kita tambah updated_at ke setiap child table.

ALTER TABLE daily_report_steam          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE daily_report_power          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE daily_report_coal           ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE daily_report_turbine_misc   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE daily_report_stock_tank     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE daily_report_coal_transfer  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE daily_report_totalizer      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Trigger function generik untuk semua child tables
CREATE OR REPLACE FUNCTION update_child_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'daily_report_steam',
        'daily_report_power',
        'daily_report_coal',
        'daily_report_turbine_misc',
        'daily_report_stock_tank',
        'daily_report_coal_transfer',
        'daily_report_totalizer'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION update_child_updated_at()',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ─── 6. Shift child tables: tambah updated_at ────────────────────────────────

ALTER TABLE shift_turbin        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE shift_steam_dist    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE shift_generator_gi  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE shift_power_dist    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE shift_esp_handling  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE shift_tankyard      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE shift_personnel     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE shift_boiler        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE shift_coal_bunker   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE shift_water_quality ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'shift_turbin',
        'shift_steam_dist',
        'shift_generator_gi',
        'shift_power_dist',
        'shift_esp_handling',
        'shift_tankyard',
        'shift_personnel',
        'shift_boiler',
        'shift_coal_bunker',
        'shift_water_quality'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION update_child_updated_at()',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ─── 7. View: shift_reports_with_logsheet ────────────────────────────────────
-- View praktis untuk laporan shift: tampilkan logsheet_datetime sebagai TIMESTAMPTZ

CREATE OR REPLACE VIEW shift_reports_with_logsheet AS
SELECT
    sr.*,
    -- logsheet_datetime: gabung date + logsheet_time sebagai TIMESTAMPTZ lokal (+07)
    (sr.date::TEXT || ' ' || sr.logsheet_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Jakarta'
        AS logsheet_datetime
FROM shift_reports sr;

-- ─── 8. View: daily_reports_with_logsheet ────────────────────────────────────

CREATE OR REPLACE VIEW daily_reports_with_logsheet AS
SELECT
    dr.*,
    -- jam 24:00 = jam 00:00 hari berikutnya
    ((dr.date + INTERVAL '1 day')::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'Asia/Jakarta'
        AS logsheet_datetime
FROM daily_reports dr;

-- ─── Selesai ──────────────────────────────────────────────────────────────────
-- Ringkasan:
--   shift_reports.logsheet_time  → TIME, auto-set via trigger dari shift type
--   daily_reports.logsheet_time  → TIME, selalu '00:00' (= jam 24:00 akhir hari)
--   daily_reports.updated_at     → TIMESTAMPTZ, auto-update via trigger
--   Semua child tables           → kolom updated_at + trigger
--   Upsert existing              → ON CONFLICT DO UPDATE sudah dihandle di app layer
--                                  created_at tidak berubah, updated_at diperbarui
