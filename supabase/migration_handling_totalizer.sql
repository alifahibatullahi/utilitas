-- ============================================
-- Migration: Handling Totalizer Columns
-- Adds 7 named totalizer columns to daily_report_totalizer
-- for konsumsi calculation (selisih = today - yesterday)
-- Parameters: RCW 1A, Demin, Demin PB1, Demin PB3, Hydrant, Basin, Service
-- ============================================

-- Add new totalizer columns (safe to re-run)
ALTER TABLE daily_report_totalizer ADD COLUMN IF NOT EXISTS tot_rcw_1a NUMERIC;
ALTER TABLE daily_report_totalizer ADD COLUMN IF NOT EXISTS tot_demin NUMERIC;
ALTER TABLE daily_report_totalizer ADD COLUMN IF NOT EXISTS tot_demin_pb1 NUMERIC;
ALTER TABLE daily_report_totalizer ADD COLUMN IF NOT EXISTS tot_demin_pb3 NUMERIC;
ALTER TABLE daily_report_totalizer ADD COLUMN IF NOT EXISTS tot_hydrant NUMERIC;
ALTER TABLE daily_report_totalizer ADD COLUMN IF NOT EXISTS tot_basin NUMERIC;
ALTER TABLE daily_report_totalizer ADD COLUMN IF NOT EXISTS tot_service NUMERIC;
