-- Status operasi boiler & coal feeder
-- Boiler: running / shutdown
-- Coal feeder: running / standby / emergency standby / not standby
-- Mengikuti pola status_bunker_a..f (TEXT free-form, tanpa CHECK).

ALTER TABLE shift_boiler
  ADD COLUMN IF NOT EXISTS status_boiler TEXT DEFAULT 'running';

ALTER TABLE shift_coal_bunker
  ADD COLUMN IF NOT EXISTS status_feeder_a TEXT DEFAULT 'running',
  ADD COLUMN IF NOT EXISTS status_feeder_b TEXT DEFAULT 'running',
  ADD COLUMN IF NOT EXISTS status_feeder_c TEXT DEFAULT 'running',
  ADD COLUMN IF NOT EXISTS status_feeder_d TEXT DEFAULT 'running',
  ADD COLUMN IF NOT EXISTS status_feeder_e TEXT DEFAULT 'running',
  ADD COLUMN IF NOT EXISTS status_feeder_f TEXT DEFAULT 'running';
