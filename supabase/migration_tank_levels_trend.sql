-- Add trend column to tank_levels table
ALTER TABLE tank_levels ADD COLUMN trend TEXT CHECK (trend IN ('naik', 'turun', 'tetap'));
