-- Nama Operator Boiler A/B lapangan (dipilih di form Lab), utk kolom EL/EM LogSheet Boiler.
-- Aditif & idempotent.

ALTER TABLE shift_water_quality
    ADD COLUMN IF NOT EXISTS operator_boiler_a TEXT,
    ADD COLUMN IF NOT EXISTS operator_boiler_b TEXT;
