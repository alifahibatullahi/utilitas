-- Add Stock Chemical parameters to the Laboratory shift report
ALTER TABLE shift_water_quality 
ADD COLUMN IF NOT EXISTS stock_phosphate NUMERIC,
ADD COLUMN IF NOT EXISTS stock_amine NUMERIC,
ADD COLUMN IF NOT EXISTS stock_hydrazine NUMERIC;
