/**
 * Import CSV data from Google Sheets (DATA OPERASIONAL - Malam/Pagi/Sore)
 * into Supabase shift_* tables.
 *
 * Usage:
 *   npx tsx scripts/import-csv.ts <path-to-csv> <shift: pagi|sore|malam>
 *
 * The CSV must have the same column layout as "Salinan dari DATA OPERASIONAL - Malam.csv"
 * (5 header rows, data starts at row 6).
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 * (service role key needed for direct inserts bypassing RLS).
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ─── Config ───
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ───

/** Parse Indonesian decimal format: "8,3" → 8.3, "" → null */
function parseNum(val: string): number | null {
    if (!val || val.trim() === '' || val === '-') return null;
    // Remove quotes and replace comma with dot
    const cleaned = val.replace(/"/g, '').replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

/** Parse string field, return null if empty */
function parseStr(val: string): string | null {
    if (!val || val.trim() === '' || val === '-') return null;
    return val.replace(/"/g, '').trim();
}

/** Parse Indonesian date "01 Januari 2020" → "2020-01-01" */
function parseDate(val: string): string | null {
    const months: Record<string, string> = {
        'Januari': '01', 'Februari': '02', 'Maret': '03', 'April': '04',
        'Mei': '05', 'Juni': '06', 'Juli': '07', 'Agustus': '08',
        'September': '09', 'Oktober': '10', 'November': '11', 'Desember': '12',
    };
    const cleaned = val.replace(/"/g, '').trim();
    const parts = cleaned.split(' ');
    if (parts.length !== 3) return null;
    const [day, monthName, year] = parts;
    const month = months[monthName];
    if (!month) return null;
    return `${year}-${month}-${day.padStart(2, '0')}`;
}

/**
 * Simple CSV line parser that handles quoted fields with commas.
 * E.g.: "8,3" stays as one field, not split at the comma.
 */
function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            fields.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current); // last field
    return fields;
}

// ─── Column index mapping (0-based, matching CSV) ───
// Row layout: No(0), Tanggal(1), [data columns 2+]

const COL = {
    // Turbin: cols 2-19
    turbin_flow_steam: 2,
    turbin_flow_cond: 3,
    turbin_press_steam: 4,
    turbin_temp_steam: 5,
    turbin_exh_steam: 6,
    turbin_vacuum: 7,
    turbin_hpo_durasi: 8,
    turbin_thrust_bearing: 9,
    turbin_metal_bearing: 10,
    turbin_vibrasi: 11,
    turbin_winding: 12,
    turbin_axial_displacement: 13,
    turbin_level_condenser: 14,
    turbin_temp_cw_in: 15,
    turbin_temp_cw_out: 16,
    turbin_press_deaerator: 17,
    turbin_temp_deaerator: 18,
    turbin_stream_days: 19,

    // Steam Distribution: cols 20-27
    steam_pabrik1_flow: 20,
    steam_pabrik1_temp: 21,
    steam_pabrik2_flow: 22,
    steam_pabrik2_temp: 23,
    steam_pabrik3a_flow: 24,
    steam_pabrik3a_temp: 25,
    steam_pabrik3b_flow: 26,
    steam_pabrik3b_temp: 27,

    // Generator: cols 28-33
    gen_load: 28,
    gen_ampere: 29,
    gen_amp_react: 30,
    gen_cos_phi: 31,
    gen_tegangan: 32,
    gen_frequensi: 33,

    // GI: cols 34-36
    gi_sum_p: 34,
    gi_sum_q: 35,
    gi_cos_phi: 36,

    // Power Distribution: cols 37-41
    power_ubb: 37,
    power_pabrik2: 38,
    power_pabrik3a: 39,
    power_pie: 40,
    power_pabrik3b: 41,

    // ESP: cols 42-51
    esp_a1: 42,
    esp_a2: 43,
    esp_a3: 44,
    esp_b1: 45,
    esp_b2: 46,
    esp_b3: 47,
    silo_a: 48,
    silo_b: 49,
    unloading_a: 50,    // text
    unloading_b: 51,

    // Handling: cols 52-56
    loading: 52,
    hopper: 53,
    conveyor: 54,
    pf1: 55,
    pf2: 56,

    // Tankyard: cols 57-59
    tk_rcw: 57,
    tk_demin: 58,
    tk_solar_ab: 59,

    // Personnel turbin: cols 60-62
    turbin_grup: 60,
    turbin_karu: 61,
    turbin_kasi: 62,

    // Boiler A/B interleaved: cols 63+
    // Press Steam: A=63, B=64
    boiler_press_steam_a: 63,
    boiler_press_steam_b: 64,
    // Temp Steam: A=65, B=66
    boiler_temp_steam_a: 65,
    boiler_temp_steam_b: 66,
    // Flow Steam: A=67, B=68
    boiler_flow_steam_a: 67,
    boiler_flow_steam_b: 68,
    // Totalizer Steam: A=69, B=70
    boiler_totalizer_steam_a: 69,
    boiler_totalizer_steam_b: 70,
    // Flow BFW: A=71, B=72
    boiler_flow_bfw_a: 71,
    boiler_flow_bfw_b: 72,
    // Temp BFW: 73 (shared line for both? single col)
    boiler_temp_bfw: 73,
    // Temp Furnace: A=74, B=75
    boiler_temp_furnace_a: 74,
    boiler_temp_furnace_b: 75,
    // Temp Flue Gas: A=76, B=77
    boiler_temp_flue_gas_a: 76,
    boiler_temp_flue_gas_b: 77,
    // Excess Air: A=78, B=79
    boiler_excess_air_a: 78,
    boiler_excess_air_b: 79,
    // Air Heater TI113: A=80, B=81
    boiler_air_heater_a: 80,
    boiler_air_heater_b: 81,
    // Batubara: A=82, B=83
    boiler_batubara_a: 82,
    boiler_batubara_b: 83,
    // Solar: A=84, B=85
    boiler_solar_a: 84,
    boiler_solar_b: 85,
    // Stream Days: A=86, B=87
    boiler_stream_days_a: 86,
    boiler_stream_days_b: 87,

    // Coal Feeders: cols 88-93
    feeder_a: 88,
    feeder_b: 89,
    feeder_c: 90,
    feeder_d: 91,
    feeder_e: 92,
    feeder_f: 93,

    // Bunkers: cols 94-99
    bunker_a: 94,
    bunker_b: 95,
    bunker_c: 96,
    bunker_d: 97,
    bunker_e: 98,
    bunker_f: 99,

    // Water Quality: cols 100-128
    demin_1250_ph: 100,
    demin_1250_conduct: 101,
    demin_1250_th: 102,
    demin_1250_sio2: 103,
    demin_750_ph: 104,
    demin_750_conduct: 105,
    demin_750_th: 106,
    demin_750_sio2: 107,
    bfw_ph: 108,
    bfw_conduct: 109,
    bfw_th: 110,
    bfw_sio2: 111,
    bfw_nh4: 112,
    bfw_chz: 113,
    boiler_water_a_ph: 114,
    boiler_water_a_conduct: 115,
    boiler_water_a_sio2: 116,
    boiler_water_a_po4: 117,
    boiler_water_b_ph: 118,
    boiler_water_b_conduct: 119,
    boiler_water_b_sio2: 120,
    boiler_water_b_po4: 121,
    product_steam_ph: 122,
    product_steam_conduct: 123,
    product_steam_th: 124,
    product_steam_sio2: 125,
    product_steam_nh4: 126,

    // Personnel boiler: cols 127-129
    boiler_grup: 127,
    boiler_karu: 128,
    boiler_kasi: 129,

    // Pressure Steam Drum: A=130, B=131
    steam_drum_press_a: 130,
    steam_drum_press_b: 131,
    // Pressure BFW: A=132, B=133
    bfw_press_a: 132,
    bfw_press_b: 133,

    // Demin Xtra Check: cols 134-136
    demin_xtra_ph: 134,
    demin_xtra_conduct: 135,
    demin_xtra_sio2: 136,
};

// ─── Main import function ───
async function importCsv(csvPath: string, shift: 'pagi' | 'sore' | 'malam') {
    console.log(`📂 Reading CSV: ${csvPath}`);
    console.log(`⏰ Shift: ${shift}`);

    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').map(l => l.replace(/\r$/, ''));

    // Skip first 5 header rows
    const dataLines = lines.slice(5).filter(l => l.trim() !== '');
    console.log(`📊 Found ${dataLines.length} data rows`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const line of dataLines) {
        const f = parseCsvLine(line);
        const date = parseDate(f[1]);

        if (!date) {
            skipped++;
            continue;
        }

        try {
            // 1. Create or find shift_report
            const groupTurbin = parseStr(f[COL.turbin_grup]);
            const groupBoiler = parseStr(f[COL.boiler_grup]);
            const groupName = groupTurbin || groupBoiler || 'Unknown';
            const supervisor = parseStr(f[COL.turbin_kasi]) || parseStr(f[COL.boiler_kasi]) || '';

            const { data: report, error: reportErr } = await supabase
                .from('shift_reports')
                .upsert({
                    date,
                    shift,
                    group_name: groupName,
                    supervisor,
                    status: 'submitted',
                }, { onConflict: 'date,shift,group_name' })
                .select('id')
                .single();

            if (reportErr || !report) {
                console.error(`❌ Row ${f[0]} (${date}): shift_report error:`, reportErr?.message);
                errors++;
                continue;
            }

            const rid = report.id;

            // 2. Insert into all child tables (upsert-style, ignore conflicts)
            const inserts = [
                supabase.from('shift_turbin').upsert({
                    shift_report_id: rid,
                    flow_steam: parseNum(f[COL.turbin_flow_steam]),
                    flow_cond: parseNum(f[COL.turbin_flow_cond]),
                    press_steam: parseNum(f[COL.turbin_press_steam]),
                    temp_steam: parseNum(f[COL.turbin_temp_steam]),
                    exh_steam: parseNum(f[COL.turbin_exh_steam]),
                    vacuum: parseNum(f[COL.turbin_vacuum]),
                    hpo_durasi: parseNum(f[COL.turbin_hpo_durasi]),
                    thrust_bearing: parseNum(f[COL.turbin_thrust_bearing]),
                    metal_bearing: parseNum(f[COL.turbin_metal_bearing]),
                    vibrasi: parseNum(f[COL.turbin_vibrasi]),
                    winding: parseNum(f[COL.turbin_winding]),
                    axial_displacement: parseNum(f[COL.turbin_axial_displacement]),
                    level_condenser: parseNum(f[COL.turbin_level_condenser]),
                    temp_cw_in: parseNum(f[COL.turbin_temp_cw_in]),
                    temp_cw_out: parseNum(f[COL.turbin_temp_cw_out]),
                    press_deaerator: parseNum(f[COL.turbin_press_deaerator]),
                    temp_deaerator: parseNum(f[COL.turbin_temp_deaerator]),
                    stream_days: parseNum(f[COL.turbin_stream_days]),
                }, { onConflict: 'shift_report_id' }),

                supabase.from('shift_steam_dist').upsert({
                    shift_report_id: rid,
                    pabrik1_flow: parseNum(f[COL.steam_pabrik1_flow]),
                    pabrik1_temp: parseNum(f[COL.steam_pabrik1_temp]),
                    pabrik2_flow: parseNum(f[COL.steam_pabrik2_flow]),
                    pabrik2_temp: parseNum(f[COL.steam_pabrik2_temp]),
                    pabrik3a_flow: parseNum(f[COL.steam_pabrik3a_flow]),
                    pabrik3a_temp: parseNum(f[COL.steam_pabrik3a_temp]),
                    pabrik3b_flow: parseNum(f[COL.steam_pabrik3b_flow]),
                    pabrik3b_temp: parseNum(f[COL.steam_pabrik3b_temp]),
                }, { onConflict: 'shift_report_id' }),

                supabase.from('shift_generator_gi').upsert({
                    shift_report_id: rid,
                    gen_load: parseNum(f[COL.gen_load]),
                    gen_ampere: parseNum(f[COL.gen_ampere]),
                    gen_amp_react: parseNum(f[COL.gen_amp_react]),
                    gen_cos_phi: parseNum(f[COL.gen_cos_phi]),
                    gen_tegangan: parseNum(f[COL.gen_tegangan]),
                    gen_frequensi: parseNum(f[COL.gen_frequensi]),
                    gi_sum_p: parseNum(f[COL.gi_sum_p]),
                    gi_sum_q: parseNum(f[COL.gi_sum_q]),
                    gi_cos_phi: parseNum(f[COL.gi_cos_phi]),
                }, { onConflict: 'shift_report_id' }),

                supabase.from('shift_power_dist').upsert({
                    shift_report_id: rid,
                    power_ubb: parseNum(f[COL.power_ubb]),
                    power_pabrik2: parseNum(f[COL.power_pabrik2]),
                    power_pabrik3a: parseNum(f[COL.power_pabrik3a]),
                    power_pie: parseNum(f[COL.power_pie]),
                    power_pabrik3b: parseNum(f[COL.power_pabrik3b]),
                }, { onConflict: 'shift_report_id' }),

                supabase.from('shift_esp_handling').upsert({
                    shift_report_id: rid,
                    esp_a1: parseNum(f[COL.esp_a1]),
                    esp_a2: parseNum(f[COL.esp_a2]),
                    esp_a3: parseNum(f[COL.esp_a3]),
                    esp_b1: parseNum(f[COL.esp_b1]),
                    esp_b2: parseNum(f[COL.esp_b2]),
                    esp_b3: parseNum(f[COL.esp_b3]),
                    silo_a: parseNum(f[COL.silo_a]),
                    silo_b: parseNum(f[COL.silo_b]),
                    unloading_a: parseStr(f[COL.unloading_a]),
                    unloading_b: parseNum(f[COL.unloading_b]),
                    loading: parseStr(f[COL.loading]),
                    hopper: parseStr(f[COL.hopper]),
                    conveyor: parseStr(f[COL.conveyor]),
                    pf1: parseNum(f[COL.pf1]),
                    pf2: parseNum(f[COL.pf2]),
                }, { onConflict: 'shift_report_id' }),

                supabase.from('shift_tankyard').upsert({
                    shift_report_id: rid,
                    tk_rcw: parseNum(f[COL.tk_rcw]),
                    tk_demin: parseNum(f[COL.tk_demin]),
                    tk_solar_ab: parseNum(f[COL.tk_solar_ab]),
                }, { onConflict: 'shift_report_id' }),

                supabase.from('shift_personnel').upsert({
                    shift_report_id: rid,
                    turbin_grup: parseStr(f[COL.turbin_grup]),
                    turbin_karu: parseStr(f[COL.turbin_karu]),
                    turbin_kasi: parseStr(f[COL.turbin_kasi]),
                    boiler_grup: parseStr(f[COL.boiler_grup]),
                    boiler_karu: parseStr(f[COL.boiler_karu]),
                    boiler_kasi: parseStr(f[COL.boiler_kasi]),
                }, { onConflict: 'shift_report_id' }),

                // Boiler A
                supabase.from('shift_boiler').upsert({
                    shift_report_id: rid,
                    boiler: 'A',
                    press_steam: parseNum(f[COL.boiler_press_steam_a]),
                    temp_steam: parseNum(f[COL.boiler_temp_steam_a]),
                    flow_steam: parseNum(f[COL.boiler_flow_steam_a]),
                    totalizer_steam: parseNum(f[COL.boiler_totalizer_steam_a]),
                    flow_bfw: parseNum(f[COL.boiler_flow_bfw_a]),
                    temp_bfw: parseNum(f[COL.boiler_temp_bfw]),
                    temp_furnace: parseNum(f[COL.boiler_temp_furnace_a]),
                    temp_flue_gas: parseNum(f[COL.boiler_temp_flue_gas_a]),
                    excess_air: parseNum(f[COL.boiler_excess_air_a]),
                    air_heater_ti113: parseNum(f[COL.boiler_air_heater_a]),
                    batubara_ton: parseNum(f[COL.boiler_batubara_a]),
                    solar_m3: parseNum(f[COL.boiler_solar_a]),
                    stream_days: parseNum(f[COL.boiler_stream_days_a]),
                    steam_drum_press: parseNum(f[COL.steam_drum_press_a]),
                    bfw_press: parseNum(f[COL.bfw_press_a]),
                }, { onConflict: 'shift_report_id,boiler' }),

                // Boiler B
                supabase.from('shift_boiler').upsert({
                    shift_report_id: rid,
                    boiler: 'B',
                    press_steam: parseNum(f[COL.boiler_press_steam_b]),
                    temp_steam: parseNum(f[COL.boiler_temp_steam_b]),
                    flow_steam: parseNum(f[COL.boiler_flow_steam_b]),
                    totalizer_steam: parseNum(f[COL.boiler_totalizer_steam_b]),
                    flow_bfw: parseNum(f[COL.boiler_flow_bfw_b]),
                    temp_bfw: parseNum(f[COL.boiler_temp_bfw]),
                    temp_furnace: parseNum(f[COL.boiler_temp_furnace_b]),
                    temp_flue_gas: parseNum(f[COL.boiler_temp_flue_gas_b]),
                    excess_air: parseNum(f[COL.boiler_excess_air_b]),
                    air_heater_ti113: parseNum(f[COL.boiler_air_heater_b]),
                    batubara_ton: parseNum(f[COL.boiler_batubara_b]),
                    solar_m3: parseNum(f[COL.boiler_solar_b]),
                    stream_days: parseNum(f[COL.boiler_stream_days_b]),
                    steam_drum_press: parseNum(f[COL.steam_drum_press_b]),
                    bfw_press: parseNum(f[COL.bfw_press_b]),
                }, { onConflict: 'shift_report_id,boiler' }),

                supabase.from('shift_coal_bunker').upsert({
                    shift_report_id: rid,
                    feeder_a: parseNum(f[COL.feeder_a]),
                    feeder_b: parseNum(f[COL.feeder_b]),
                    feeder_c: parseNum(f[COL.feeder_c]),
                    feeder_d: parseNum(f[COL.feeder_d]),
                    feeder_e: parseNum(f[COL.feeder_e]),
                    feeder_f: parseNum(f[COL.feeder_f]),
                    bunker_a: parseNum(f[COL.bunker_a]),
                    bunker_b: parseNum(f[COL.bunker_b]),
                    bunker_c: parseNum(f[COL.bunker_c]),
                    bunker_d: parseNum(f[COL.bunker_d]),
                    bunker_e: parseNum(f[COL.bunker_e]),
                    bunker_f: parseNum(f[COL.bunker_f]),
                }, { onConflict: 'shift_report_id' }),

                supabase.from('shift_water_quality').upsert({
                    shift_report_id: rid,
                    demin_1250_ph: parseNum(f[COL.demin_1250_ph]),
                    demin_1250_conduct: parseNum(f[COL.demin_1250_conduct]),
                    demin_1250_th: parseNum(f[COL.demin_1250_th]),
                    demin_1250_sio2: parseNum(f[COL.demin_1250_sio2]),
                    demin_750_ph: parseNum(f[COL.demin_750_ph]),
                    demin_750_conduct: parseNum(f[COL.demin_750_conduct]),
                    demin_750_th: parseNum(f[COL.demin_750_th]),
                    demin_750_sio2: parseNum(f[COL.demin_750_sio2]),
                    bfw_ph: parseNum(f[COL.bfw_ph]),
                    bfw_conduct: parseNum(f[COL.bfw_conduct]),
                    bfw_th: parseNum(f[COL.bfw_th]),
                    bfw_sio2: parseNum(f[COL.bfw_sio2]),
                    bfw_nh4: parseNum(f[COL.bfw_nh4]),
                    bfw_chz: parseNum(f[COL.bfw_chz]),
                    boiler_water_a_ph: parseNum(f[COL.boiler_water_a_ph]),
                    boiler_water_a_conduct: parseNum(f[COL.boiler_water_a_conduct]),
                    boiler_water_a_sio2: parseNum(f[COL.boiler_water_a_sio2]),
                    boiler_water_a_po4: parseNum(f[COL.boiler_water_a_po4]),
                    boiler_water_b_ph: parseNum(f[COL.boiler_water_b_ph]),
                    boiler_water_b_conduct: parseNum(f[COL.boiler_water_b_conduct]),
                    boiler_water_b_sio2: parseNum(f[COL.boiler_water_b_sio2]),
                    boiler_water_b_po4: parseNum(f[COL.boiler_water_b_po4]),
                    product_steam_ph: parseNum(f[COL.product_steam_ph]),
                    product_steam_conduct: parseNum(f[COL.product_steam_conduct]),
                    product_steam_th: parseNum(f[COL.product_steam_th]),
                    product_steam_sio2: parseNum(f[COL.product_steam_sio2]),
                    product_steam_nh4: parseNum(f[COL.product_steam_nh4]),
                    demin_xtra_ph: parseNum(f[COL.demin_xtra_ph]),
                    demin_xtra_conduct: parseNum(f[COL.demin_xtra_conduct]),
                    demin_xtra_sio2: parseNum(f[COL.demin_xtra_sio2]),
                }, { onConflict: 'shift_report_id' }),
            ];

            // Run all inserts in parallel
            const results = await Promise.all(inserts);
            const childErrors = results.filter(r => r.error);
            if (childErrors.length > 0) {
                console.error(`⚠️  Row ${f[0]} (${date}): ${childErrors.length} child insert errors`);
                childErrors.forEach(e => console.error('  -', e.error?.message));
                errors++;
            } else {
                imported++;
            }

            // Progress log every 100 rows
            if (imported % 100 === 0 && imported > 0) {
                console.log(`  ✅ ${imported} rows imported...`);
            }
        } catch (err) {
            console.error(`❌ Row ${f[0]} (${date}): unexpected error:`, err);
            errors++;
        }
    }

    console.log('\n════════════════════════════════');
    console.log(`✅ Imported: ${imported}`);
    console.log(`⏭️  Skipped:  ${skipped}`);
    console.log(`❌ Errors:   ${errors}`);
    console.log('════════════════════════════════');
}

// ─── CLI Entry ───
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: npx tsx scripts/import-csv.ts <csv-path> <pagi|sore|malam>');
    process.exit(1);
}

const csvFile = path.resolve(args[0]);
const shift = args[1] as 'pagi' | 'sore' | 'malam';

if (!['pagi', 'sore', 'malam'].includes(shift)) {
    console.error('❌ Shift must be one of: pagi, sore, malam');
    process.exit(1);
}

if (!fs.existsSync(csvFile)) {
    console.error(`❌ File not found: ${csvFile}`);
    process.exit(1);
}

importCsv(csvFile, shift).then(() => {
    console.log('\n🎉 Import complete!');
}).catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
