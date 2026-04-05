-- ================================================
-- Migration: Equipment Items (No Item List)
-- Description: Table for storing equipment no item and descriptions
-- All items split into individual units (A/B → A, B)
-- ================================================

-- Create equipment_items table
CREATE TABLE IF NOT EXISTS equipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_item TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for faster search
CREATE INDEX IF NOT EXISTS idx_equipment_items_no_item ON equipment_items (no_item);
CREATE INDEX IF NOT EXISTS idx_equipment_items_deskripsi ON equipment_items (deskripsi);

-- Enable RLS
ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (safe re-run)
DROP POLICY IF EXISTS "Allow all select on equipment_items" ON equipment_items;
DROP POLICY IF EXISTS "Allow all insert on equipment_items" ON equipment_items;
DROP POLICY IF EXISTS "Allow all update on equipment_items" ON equipment_items;
DROP POLICY IF EXISTS "Allow all delete on equipment_items" ON equipment_items;

-- Allow all operations
CREATE POLICY "Allow all select on equipment_items" ON equipment_items
    FOR SELECT USING (true);

CREATE POLICY "Allow all insert on equipment_items" ON equipment_items
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update on equipment_items" ON equipment_items
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow all delete on equipment_items" ON equipment_items
    FOR DELETE USING (true);

-- ================================================
-- Seed Data: Equipment Items from STITCH Template
-- All A/B, AB/CD, ABC/DEF etc. split into individual items
-- ================================================
-- Clear existing data first (safe re-run)
DELETE FROM equipment_items;

INSERT INTO equipment_items (no_item, deskripsi) VALUES

-- ═══════════════════════════════════════════
-- FAN & DRAFT SYSTEM
-- ═══════════════════════════════════════════
-- 20 K-08.01 A/B ID Fan
('20 K-08.01 A', 'ID Fan A'),
('20 K-08.01 B', 'ID Fan B'),
-- 20 K-08.02 AB/CD FD Fan
('20 K-08.02 A', 'FD Fan A'),
('20 K-08.02 B', 'FD Fan B'),
('20 K-08.02 C', 'FD Fan C'),
('20 K-08.02 D', 'FD Fan D'),
-- 20 K-08.11 AB/CD Seal Fan
('20 K-08.11 A', 'Seal Fan A'),
('20 K-08.11 B', 'Seal Fan B'),
('20 K-08.11 C', 'Seal Fan C'),
('20 K-08.11 D', 'Seal Fan D'),
-- 20 K-08.17 ABC/DEF PAF
('20 K-08.17 A', 'PAF A'),
('20 K-08.17 B', 'PAF B'),
('20 K-08.17 C', 'PAF C'),
('20 K-08.17 D', 'PAF D'),
('20 K-08.17 E', 'PAF E'),
('20 K-08.17 F', 'PAF F'),

-- ═══════════════════════════════════════════
-- OIL SYSTEM
-- ═══════════════════════════════════════════
-- 20 TK-08.03 A/B Oil Thin Tank
('20 TK-08.03 A', 'Oil Thin Tank A'),
('20 TK-08.03 B', 'Oil Thin Tank B'),
-- 20 P-08.03 AB/CD Oil Thin Pump
('20 P-08.03 A', 'Oil Thin Pump A'),
('20 P-08.03 B', 'Oil Thin Pump B'),
('20 P-08.03 C', 'Oil Thin Pump C'),
('20 P-08.03 D', 'Oil Thin Pump D'),

-- ═══════════════════════════════════════════
-- SOLAR SYSTEM
-- ═══════════════════════════════════════════
-- 20 TK-08.04 A/B Solar Tank
('20 TK-08.04 A', 'Solar Tank A'),
('20 TK-08.04 B', 'Solar Tank B'),
-- 20 P-08.04 A Solar Pump Unloading
('20 P-08.04 A', 'Solar Pump Unloading A'),
-- 20 P-08.04 B/C Solar Pump
('20 P-08.04 B', 'Solar Pump B'),
('20 P-08.04 C', 'Solar Pump C'),
-- 20 B-08.05 ABCD Gun Solar
('20 B-08.05 A', 'Gun Solar A'),
('20 B-08.05 B', 'Gun Solar B'),
('20 B-08.05 C', 'Gun Solar C'),
('20 B-08.05 D', 'Gun Solar D'),
-- 20 B-08.05 EFGH Gun Solar
('20 B-08.05 E', 'Gun Solar E'),
('20 B-08.05 F', 'Gun Solar F'),
('20 B-08.05 G', 'Gun Solar G'),
('20 B-08.05 H', 'Gun Solar H'),

-- ═══════════════════════════════════════════
-- COAL HANDLING (Mill/Bunker/Feeder)
-- ═══════════════════════════════════════════
-- 20 L-08.12 ABC/DEF Coal Mill
('20 L-08.12 A', 'Coal Mill A'),
('20 L-08.12 B', 'Coal Mill B'),
('20 L-08.12 C', 'Coal Mill C'),
('20 L-08.12 D', 'Coal Mill D'),
('20 L-08.12 E', 'Coal Mill E'),
('20 L-08.12 F', 'Coal Mill F'),
-- 20 GB-08.12 Gear Box Coal Mill
('20 GB-08.12', 'Gear Box Coal Mill'),
-- 20 G-08.14 ABC/DEF Coal Bunker
('20 G-08.14 A', 'Coal Bunker A'),
('20 G-08.14 B', 'Coal Bunker B'),
('20 G-08.14 C', 'Coal Bunker C'),
('20 G-08.14 D', 'Coal Bunker D'),
('20 G-08.14 E', 'Coal Bunker E'),
('20 G-08.14 F', 'Coal Bunker F'),
-- 20 M-08.15 ABC/DEF Coal Feeder
('20 M-08.15 A', 'Coal Feeder A'),
('20 M-08.15 B', 'Coal Feeder B'),
('20 M-08.15 C', 'Coal Feeder C'),
('20 M-08.15 D', 'Coal Feeder D'),
('20 M-08.15 E', 'Coal Feeder E'),
('20 M-08.15 F', 'Coal Feeder F'),
-- 20 VF-08.16 ABC/DEF Vibrating Coal Feeder
('20 VF-08.16 A', 'Vibrating Coal Feeder A'),
('20 VF-08.16 B', 'Vibrating Coal Feeder B'),
('20 VF-08.16 C', 'Vibrating Coal Feeder C'),
('20 VF-08.16 D', 'Vibrating Coal Feeder D'),
('20 VF-08.16 E', 'Vibrating Coal Feeder E'),
('20 VF-08.16 F', 'Vibrating Coal Feeder F'),

-- ═══════════════════════════════════════════
-- TURBINE & GENERATOR
-- ═══════════════════════════════════════════
('20 TG-01.01', 'Steam Turbine'),
('20 EG-01.02', 'Electric Generator'),
('20 TX-01.03', 'Eksitasi Device'),
('20 E-01.04', 'Condenser'),
-- 20 P-01.04 A/B Pompa Condenser
('20 P-01.04 A', 'Pompa Condenser A'),
('20 P-01.04 B', 'Pompa Condenser B'),
-- 20 P-01.05 A/B Turbin Driven Oil Pump / HPO
('20 P-01.05 A', 'Turbin Driven Oil Pump / HPO A'),
('20 P-01.05 B', 'Turbin Driven Oil Pump / HPO B'),
('20 TK-01.05', 'TK HPO Governor'),
-- 20 E-01.06/07 1#/2# LP Heater
('20 E-01.06', '1# LP Heater'),
('20 E-01.07', '2# LP Heater'),
('20 EJ-01.08', 'Oil Injector'),
('20 K-01.08', 'Exhaust Fan'),
('20 TK-01.08', 'Oil Tank'),
('20 E-01.08', 'Oil Cooler'),
-- 20 P-01.08 A (AC) Aux Oil Pump
('20 P-01.08 A', 'Aux Oil Pump (AC)'),
-- 20 P-01.03 B (DC) Aux. Oil Pump
('20 P-01.03 B', 'Aux. Oil Pump (DC)'),
('20 P-01.08 C', 'High Press. Oil Pump'),
('20 P-01.09', 'LPH-1 Drain Pump'),
-- 20 E-01.10/11 1#/2# HP Heater
('20 E-01.10', '1# HP Heater'),
('20 E-01.11', '2# HP Heater'),
('20 E-01.12', 'Gland Seal HE'),
-- 20 TK-01.03 A/B Drain Expansion Tank
('20 TK-01.03 A', 'Drain Expansion Tank A'),
('20 TK-01.03 B', 'Drain Expansion Tank B'),
-- 20 TK-01.14 A/B Water Jet Tank
('20 TK-01.14 A', 'Water Jet Tank A'),
('20 TK-01.14 B', 'Water Jet Tank B'),
-- 20 P-01.14 A/B Water Jet Pump
('20 P-01.14 A', 'Water Jet Pump A'),
('20 P-01.14 B', 'Water Jet Pump B'),
-- 20 WJE-01.14 A/B Water Jet Air Ejector
('20 WJE-01.14 A', 'Water Jet Air Ejector A'),
('20 WJE-01.14 B', 'Water Jet Air Ejector B'),
('20 EB-01.15', 'Equalisation Box'),
('20 DHP-01.16', '1# Desuperheater Depresser'),
('20 DHP-01.17', '2# Desuperheater Depresser'),
('20 DA-01.18', 'HP Deaerator'),
('20 TK-01.18', 'Deaerator Tank'),
('20 H-01.19', 'Double Hook Bridge Crane'),
-- 20 E-01.20 A/B Air Cooler
('20 E-01.20 A', 'Air Cooler A'),
('20 E-01.20 B', 'Air Cooler B'),

-- ═══════════════════════════════════════════
-- BOILER
-- ═══════════════════════════════════════════
-- 20 B-02.01 A/B Steam Drum / Boiler
('20 B-02.01 A', 'Steam Drum / Boiler A'),
('20 B-02.01 B', 'Steam Drum / Boiler B'),
-- 20 SV-02.01 A/B Safety Valve Boiler A
('20 SV-02.01 A', 'Safety Valve Boiler A'),
('20 SV-02.01 B', 'Safety Valve Boiler A'),
-- 20 SV-02.01 A/B Safety Valve Boiler B
('20 SV-02.01 A', 'Safety Valve Boiler B'),
('20 SV-02.01 B', 'Safety Valve Boiler B'),
-- 20 E-02.01 A/B Air Preheater
('20 E-02.01 A', 'Air Preheater A'),
('20 E-02.01 B', 'Air Preheater B'),
-- 20 E-02.02 A/B Lower Economizer
('20 E-02.02 A', 'Lower Economizer A'),
('20 E-02.02 B', 'Lower Economizer B'),
-- 20 E-02.03 A/B Upper Economizer
('20 E-02.03 A', 'Upper Economizer A'),
('20 E-02.03 B', 'Upper Economizer B'),
-- 20 E-02.04 A/B LT. Superheater
('20 E-02.04 A', 'LT. Superheater A'),
('20 E-02.04 B', 'LT. Superheater B'),
-- 20 E-02.05 A/B 1st DSH
('20 E-02.05 A', '1st DSH A'),
('20 E-02.05 B', '1st DSH B'),
-- 20 E-02.06 A/B 1st HT. Superheater
('20 E-02.06 A', '1st HT. Superheater A'),
('20 E-02.06 B', '1st HT. Superheater B'),
-- 20 E-02.07 A/B 2nd DSH
('20 E-02.07 A', '2nd DSH A'),
('20 E-02.07 B', '2nd DSH B'),
-- 20 E-02.08 A/B 2nd HT. Superheater
('20 E-02.08 A', '2nd HT. Superheater A'),
('20 E-02.08 B', '2nd HT. Superheater B'),
('20 TK-02.09', 'Amine Tank'),
-- 20 P-02.09 AB/CD Amine Pump
('20 P-02.09 A', 'Amine Pump A'),
('20 P-02.09 B', 'Amine Pump B'),
('20 P-02.09 C', 'Amine Pump C'),
('20 P-02.09 D', 'Amine Pump D'),
-- 20 P-02.09 E/F Amine Base Stirrier
('20 P-02.09 E', 'Amine Base Stirrier E'),
('20 P-02.09 F', 'Amine Base Stirrier F'),
('20 TK-02.10', 'Phosphate Tank'),
-- 20 P-02.10 AB/CD Phosphate Pump
('20 P-02.10 A', 'Phosphate Pump A'),
('20 P-02.10 B', 'Phosphate Pump B'),
('20 P-02.10 C', 'Phosphate Pump C'),
('20 P-02.10 D', 'Phosphate Pump D'),
-- 20 P-02.10 E/F Phosphate Stirrier
('20 P-02.10 E', 'Phosphate Stirrier E'),
('20 P-02.10 F', 'Phosphate Stirrier F'),
('20 TK-02.11', 'Hydrazine Tank'),
-- 20 P-02.11 AB/CD Hydrazine Pump
('20 P-02.11 A', 'Hydrazine Pump A'),
('20 P-02.11 B', 'Hydrazine Pump B'),
('20 P-02.11 C', 'Hydrazine Pump C'),
('20 P-02.11 D', 'Hydrazine Pump D'),
-- 20 MP-02.11 E/F Hydrazine Stirrier
('20 MP-02.11 E', 'Hydrazine Stirrier E'),
('20 MP-02.11 F', 'Hydrazine Stirrier F'),
('20 TK-02.12', 'Continues BD Tank'),
('20 TK-02.13', 'Periodic BD Tank'),
('20 TK-02.14', 'Drain Flash Tank'),
-- 20 TK-02.15 A/B Drainage Tank
('20 TK-02.15 A', 'Drainage Tank A'),
('20 TK-02.15 B', 'Drainage Tank B'),
-- 20 MP.02.15 A/B Drainage Pump
('20 MP.02.15 A', 'Drainage Pump A'),
('20 MP.02.15 B', 'Drainage Pump B'),
('20 MG-02.16', 'Silo Wall Vibrator'),
-- 20 MP-02.18 A/B/C BFW Pump
('20 MP-02.18 A', 'BFW Pump A'),
('20 MP-02.18 B', 'BFW Pump B'),
('20 MP-02.18 C', 'BFW Pump C'),

-- ═══════════════════════════════════════════
-- ESP
-- ═══════════════════════════════════════════
-- 20 EP-03.03 A/B ESP
('20 EP-03.03 A', 'ESP A'),
('20 EP-03.03 B', 'ESP B'),
('20 EP-03.04', 'Chimney'),

-- ═══════════════════════════════════════════
-- BOTTOM ASH
-- ═══════════════════════════════════════════
-- 20 M-04.02 A/B Bottom Slug Conveyor
('20 M-04.02 A', 'Bottom Slug Conveyor A'),
('20 M-04.02 B', 'Bottom Slug Conveyor B'),

-- ═══════════════════════════════════════════
-- ASH SILO & FLY ASH HANDLING
-- ═══════════════════════════════════════════
-- 20 G-05.01 A/B Ash Silo
('20 G-05.01 A', 'Ash Silo A'),
('20 G-05.01 B', 'Ash Silo B'),
-- 20 DC-05.03 A/B/C Dust Collector
('20 DC-05.03 A', 'Dust Collector A'),
('20 DC-05.03 B', 'Dust Collector B'),
('20 DC-05.03 C', 'Dust Collector C'),
('20 EFP-05.04', 'Electroda Fluidized Plate'),
-- 20 K-05.04 A/B Bag Filter Silo
('20 K-05.04 A', 'Bag Filter Silo A'),
('20 K-05.04 B', 'Bag Filter Silo B'),
('20 E-05.10', 'Heater Ash Silo'),
-- 20 E-05.10 A/B/C Air Dryer
('20 E-05.10 A', 'Air Dryer A'),
('20 E-05.10 B', 'Air Dryer B'),
('20 E-05.10 C', 'Air Dryer C'),
-- 20 K-05.10 A/B/C Compressor
('20 K-05.10 A', 'Compressor A'),
('20 K-05.10 B', 'Compressor B'),
('20 K-05.10 C', 'Compressor C'),
-- 20 TK-05.10 A/B Compressor Tank
('20 TK-05.10 A', 'Compressor Tank A'),
('20 TK-05.10 B', 'Compressor Tank B'),
-- 20 M-05.11 A/B/C/D Vessel
('20 M-05.11 A', 'Vessel A'),
('20 M-05.11 B', 'Vessel B'),
('20 M-05.11 C', 'Vessel C'),
('20 M-05.11 D', 'Vessel D'),
-- 20 M-05.12 A/B/C/D Vessel
('20 M-05.12 A', 'Vessel A'),
('20 M-05.12 B', 'Vessel B'),
('20 M-05.12 C', 'Vessel C'),
('20 M-05.12 D', 'Vessel D'),
-- 20 M-05.13 A/B/C/D Vessel
('20 M-05.13 A', 'Vessel A'),
('20 M-05.13 B', 'Vessel B'),
('20 M-05.13 C', 'Vessel C'),
('20 M-05.13 D', 'Vessel D'),
-- 20 V-05.14 A/B/C/D Crossover Valve
('20 V-05.14 A', 'Crossover Valve A'),
('20 V-05.14 B', 'Crossover Valve B'),
('20 V-05.14 C', 'Crossover Valve C'),
('20 V-05.14 D', 'Crossover Valve D'),
-- 20 V-05.16 A/B Rotary Valve
('20 V-05.16 A', 'Rotary Valve A'),
('20 V-05.16 B', 'Rotary Valve B'),
-- 20 M-05.08 A/B Two Shaft Mixer
('20 M-05.08 A', 'Two Shaft Mixer A'),
('20 M-05.08 B', 'Two Shaft Mixer B'),

-- ═══════════════════════════════════════════
-- COAL CONVEYOR
-- ═══════════════════════════════════════════
-- 20 G-07.03 A/B Hopper
('20 G-07.03 A', 'Hopper A'),
('20 G-07.03 B', 'Hopper B'),
-- 20 P-07.03 A/B Bajul Pump
('20 P-07.03 A', 'Bajul Pump A'),
('20 P-07.03 B', 'Bajul Pump B'),
-- 20 M-07.03 A/B Conveyor Point 3
('20 M-07.03 A', 'Conveyor Point 3 A'),
('20 M-07.03 B', 'Conveyor Point 3 B'),
-- 20 M-07.04 A/B Conveyor Point 4
('20 M-07.04 A', 'Conveyor Point 4 A'),
('20 M-07.04 B', 'Conveyor Point 4 B'),
-- 20 SM-07.04 A/B Magnet Separator
('20 SM-07.04 A', 'Magnet Separator A'),
('20 SM-07.04 B', 'Magnet Separator B'),
('20 T-07.04', 'TH 4'),
-- 20 M-07.05 A/B Conveyor Point 5
('20 M-07.05 A', 'Conveyor Point 5 A'),
('20 M-07.05 B', 'Conveyor Point 5 B'),
-- 20 VS-07.05 AB/CD Vibrating Screen
('20 VS-07.05 A', 'Vibrating Screen A'),
('20 VS-07.05 B', 'Vibrating Screen B'),
('20 VS-07.05 C', 'Vibrating Screen C'),
('20 VS-07.05 D', 'Vibrating Screen D'),
-- 20 Q-07.05 A/B Crusher
('20 Q-07.05 A', 'Crusher A'),
('20 Q-07.05 B', 'Crusher B'),
-- 20 DM-07.05 A/B Metal Detector
('20 DM-07.05 A', 'Metal Detector A'),
('20 DM-07.05 B', 'Metal Detector B'),
('20 T-07.05', 'TH 5'),
-- 20 M-07.06 A/B Conveyor Point 6
('20 M-07.06 A', 'Conveyor Point 6 A'),
('20 M-07.06 B', 'Conveyor Point 6 B'),
('20 SR-07.06', 'Stacker Reclaimer'),
-- 20 CS-07.06 A/B Coal Sampling
('20 CS-07.06 A', 'Coal Sampling A'),
('20 CS-07.06 B', 'Coal Sampling B'),
('20 T-07.06', 'TH 6'),
-- 20 M-07.07 A/B Conveyor Point 7
('20 M-07.07 A', 'Conveyor Point 7 A'),
('20 M-07.07 B', 'Conveyor Point 7 B'),
-- 20 PD-07.07 AB/CD/EF Plowbelt
('20 PD-07.07 A', 'Plowbelt A'),
('20 PD-07.07 B', 'Plowbelt B'),
('20 PD-07.07 C', 'Plowbelt C'),
('20 PD-07.07 D', 'Plowbelt D'),
('20 PD-07.07 E', 'Plowbelt E'),
('20 PD-07.07 F', 'Plowbelt F'),

-- ═══════════════════════════════════════════
-- CW SYSTEM
-- ═══════════════════════════════════════════
-- 20 P-09.01 A/B/C CWP
('20 P-09.01 A', 'CWP A'),
('20 P-09.01 B', 'CWP B'),
('20 P-09.01 C', 'CWP C'),
-- 20 P-09.02 A/B/C Industrial Pump
('20 P-09.02 A', 'Industrial Pump A'),
('20 P-09.02 B', 'Industrial Pump B'),
('20 P-09.02 C', 'Industrial Pump C'),
-- 20 P-09.03 A/B Movable Sewage (WWT)
('20 P-09.03 A', 'Movable Sewage (WWT) A'),
('20 P-09.03 B', 'Movable Sewage (WWT) B'),
-- 20 K-09.05 ABCD Cooling Fan
('20 K-09.05 A', 'Cooling Fan A'),
('20 K-09.05 B', 'Cooling Fan B'),
('20 K-09.05 C', 'Cooling Fan C'),
('20 K-09.05 D', 'Cooling Fan D'),
-- 20 TK-09.05 ABC Metering Dosing Device
('20 TK-09.05 A', 'Metering Dosing Device A'),
('20 TK-09.05 B', 'Metering Dosing Device B'),
('20 TK-09.05 C', 'Metering Dosing Device C'),
-- 20 P-09.05 ABC Dosing Pump
('20 P-09.05 A', 'Dosing Pump A'),
('20 P-09.05 B', 'Dosing Pump B'),
('20 P-09.05 C', 'Dosing Pump C'),
('20 T-09.05', 'Basin'),

-- ═══════════════════════════════════════════
-- SERVICE WATER & HYDRANT
-- ═══════════════════════════════════════════
-- 20 P-10.05 A/B Service Water Pump
('20 P-10.05 A', 'Service Water Pump A'),
('20 P-10.05 B', 'Service Water Pump B'),
('20 TK-10.07', 'RCW'),
-- 20 P-10.01 A/B Make Up Pump
('20 P-10.01 A', 'Make Up Pump A'),
('20 P-10.01 B', 'Make Up Pump B'),
-- 20 P-10.02 A/B Jockey Pump
('20 P-10.02 A', 'Jockey Pump A'),
('20 P-10.02 B', 'Jockey Pump B'),
('20 P-10.03', 'Hydrant (Motor)'),
('20 P-10.04', 'Hydrant (Diesel)');
