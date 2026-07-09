-- Migration: Add trend columns for RCW and Demin tanks in shift_tankyard
ALTER TABLE shift_tankyard ADD COLUMN tk_rcw_trend TEXT;
ALTER TABLE shift_tankyard ADD COLUMN tk_demin_trend TEXT;
