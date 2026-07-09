-- Migration: tambah kolom pembacaan RCW tiap 2 jam per shift
-- tk_rcw sudah ada (slot pertama), tambah slot 2, 3, 4

ALTER TABLE shift_tankyard
    ADD COLUMN IF NOT EXISTS tk_rcw_2 NUMERIC,
    ADD COLUMN IF NOT EXISTS tk_rcw_3 NUMERIC,
    ADD COLUMN IF NOT EXISTS tk_rcw_4 NUMERIC;

COMMENT ON COLUMN shift_tankyard.tk_rcw   IS 'Level RCW slot 1 per shift (jam: malam=23, pagi=07, sore=15 WIB)';
COMMENT ON COLUMN shift_tankyard.tk_rcw_2 IS 'Level RCW slot 2 per shift (jam: malam=01, pagi=09, sore=17 WIB)';
COMMENT ON COLUMN shift_tankyard.tk_rcw_3 IS 'Level RCW slot 3 per shift (jam: malam=03, pagi=11, sore=19 WIB)';
COMMENT ON COLUMN shift_tankyard.tk_rcw_4 IS 'Level RCW slot 4 per shift (jam: malam=05, pagi=13, sore=21 WIB)';
