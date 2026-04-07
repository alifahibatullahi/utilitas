/**
 * Migrate last 7 days of shift report data from Google Sheets → Supabase.
 *
 * Reads from tabs: Pagi, Sore, Malam
 * Filters rows where tanggal is within the last 7 days from today.
 *
 * Usage:
 *   npx tsx scripts/migrate-from-sheets.ts
 *   npx tsx scripts/migrate-from-sheets.ts --days 30   # last 30 days
 *   npx tsx scripts/migrate-from-sheets.ts --dry-run   # preview only, no writes
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

// ─── Load .env.local ───
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            let val = trimmed.substring(eqIdx + 1).trim();
            // Strip surrounding double quotes if present (handles multiline private key)
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = val;
        }
    }
}

// ─── CLI Args ───
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const daysIdx = args.indexOf('--days');
const days = daysIdx !== -1 ? parseInt(args[daysIdx + 1] ?? '7', 10) : 7;

// ─── Config ───
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const SA_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
if (!SPREADSHEET_ID || !SA_EMAIL || !SA_KEY) {
    console.error('❌ Missing: GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Date helpers ───
function parseIndonesianDate(val: string): string | null {
    const months: Record<string, string> = {
        'Januari': '01', 'Februari': '02', 'Maret': '03', 'April': '04',
        'Mei': '05', 'Juni': '06', 'Juli': '07', 'Agustus': '08',
        'September': '09', 'Oktober': '10', 'November': '11', 'Desember': '12',
    };
    const cleaned = (val ?? '').replace(/"/g, '').trim();
    const parts = cleaned.split(' ');
    if (parts.length !== 3) return null;
    const [day, monthName, year] = parts;
    const month = months[monthName];
    if (!month) return null;
    return `${year}-${month}-${String(parseInt(day)).padStart(2, '0')}`;
}

function getDateRange(numDays: number): { from: string; to: string } {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (numDays - 1));
    const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { from: fmt(from), to: fmt(to) };
}

// ─── Parsers ───
function parseNum(val: string | undefined): number | null {
    if (!val || val.trim() === '' || val === '-') return null;
    const cleaned = val.replace(/"/g, '').replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

function parseStr(val: string | undefined): string | null {
    if (!val || val.trim() === '' || val === '-') return null;
    return val.replace(/"/g, '').trim();
}

// ─── Column index mapping (0-based, 137 cols) ───
const COL = {
    no: 0, tanggal: 1,
    turbin_flow_steam: 2, turbin_flow_cond: 3, turbin_press_steam: 4,
    turbin_temp_steam: 5, turbin_exh_steam: 6, turbin_vacuum: 7,
    turbin_hpo_durasi: 8, turbin_thrust_bearing: 9, turbin_metal_bearing: 10,
    turbin_vibrasi: 11, turbin_winding: 12, turbin_axial_displacement: 13,
    turbin_level_condenser: 14, turbin_temp_cw_in: 15, turbin_temp_cw_out: 16,
    turbin_press_deaerator: 17, turbin_temp_deaerator: 18, turbin_stream_days: 19,
    steam_pabrik1_flow: 20, steam_pabrik1_temp: 21,
    steam_pabrik2_flow: 22, steam_pabrik2_temp: 23,
    steam_pabrik3a_flow: 24, steam_pabrik3a_temp: 25,
    steam_pabrik3b_flow: 26, steam_pabrik3b_temp: 27,
    gen_load: 28, gen_ampere: 29, gen_amp_react: 30,
    gen_cos_phi: 31, gen_tegangan: 32, gen_frequensi: 33,
    gi_sum_p: 34, gi_sum_q: 35, gi_cos_phi: 36,
    power_ubb: 37, power_pabrik2: 38, power_pabrik3a: 39, power_pie: 40, power_pabrik3b: 41,
    esp_a1: 42, esp_a2: 43, esp_a3: 44, esp_b1: 45, esp_b2: 46, esp_b3: 47,
    silo_a: 48, silo_b: 49, unloading_a: 50, unloading_b: 51,
    loading: 52, hopper: 53, conveyor: 54, pf1: 55, pf2: 56,
    tk_rcw: 57, tk_demin: 58, tk_solar_ab: 59,
    turbin_grup: 60, turbin_karu: 61, turbin_kasi: 62,
    boiler_press_steam_a: 63, boiler_press_steam_b: 64,
    boiler_temp_steam_a: 65, boiler_temp_steam_b: 66,
    boiler_flow_steam_a: 67, boiler_flow_steam_b: 68,
    boiler_totalizer_steam_a: 69, boiler_totalizer_steam_b: 70,
    boiler_flow_bfw_a: 71, boiler_flow_bfw_b: 72,
    boiler_temp_bfw: 73,
    boiler_temp_furnace_a: 74, boiler_temp_furnace_b: 75,
    boiler_temp_flue_gas_a: 76, boiler_temp_flue_gas_b: 77,
    boiler_excess_air_a: 78, boiler_excess_air_b: 79,
    boiler_air_heater_a: 80, boiler_air_heater_b: 81,
    boiler_batubara_a: 82, boiler_batubara_b: 83,
    boiler_solar_a: 84, boiler_solar_b: 85,
    boiler_stream_days_a: 86, boiler_stream_days_b: 87,
    feeder_a: 88, feeder_b: 89, feeder_c: 90,
    feeder_d: 91, feeder_e: 92, feeder_f: 93,
    bunker_a: 94, bunker_b: 95, bunker_c: 96,
    bunker_d: 97, bunker_e: 98, bunker_f: 99,
    demin_1250_ph: 100, demin_1250_conduct: 101, demin_1250_th: 102, demin_1250_sio2: 103,
    demin_750_ph: 104, demin_750_conduct: 105, demin_750_th: 106, demin_750_sio2: 107,
    bfw_ph: 108, bfw_conduct: 109, bfw_th: 110, bfw_sio2: 111, bfw_nh4: 112, bfw_chz: 113,
    boiler_water_a_ph: 114, boiler_water_a_conduct: 115, boiler_water_a_sio2: 116, boiler_water_a_po4: 117,
    boiler_water_b_ph: 118, boiler_water_b_conduct: 119, boiler_water_b_sio2: 120, boiler_water_b_po4: 121,
    product_steam_ph: 122, product_steam_conduct: 123, product_steam_th: 124,
    product_steam_sio2: 125, product_steam_nh4: 126,
    boiler_grup: 127, boiler_karu: 128, boiler_kasi: 129,
    steam_drum_press_a: 130, steam_drum_press_b: 131,
    bfw_press_a: 132, bfw_press_b: 133,
    demin_xtra_ph: 134, demin_xtra_conduct: 135, demin_xtra_sio2: 136,
};

// ─── Google Sheets ───
async function getTabRows(tab: string): Promise<string[][]> {
    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: SA_EMAIL, private_key: SA_KEY },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A6:EZ`,
    });
    return (res.data.values ?? []) as string[][];
}

// ─── Save one row to Supabase ───
async function saveRow(f: string[], shift: 'pagi' | 'sore' | 'malam', date: string): Promise<boolean> {
    const groupTurbin = parseStr(f[COL.turbin_grup]);
    const groupBoiler = parseStr(f[COL.boiler_grup]);
    const groupName = groupTurbin || groupBoiler || 'Unknown';
    const supervisor = parseStr(f[COL.turbin_kasi]) || parseStr(f[COL.boiler_kasi]) || '';

    const { data: report, error: reportErr } = await supabase
        .from('shift_reports')
        .upsert({ date, shift, group_name: groupName, supervisor, status: 'submitted' },
            { onConflict: 'date,shift,group_name' })
        .select('id')
        .single();

    if (reportErr || !report) {
        console.error(`  ❌ shift_reports upsert failed:`, reportErr?.message);
        return false;
    }

    const rid = (report as Record<string, unknown>).id as string;

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

        supabase.from('shift_boiler').upsert({
            shift_report_id: rid, boiler: 'A',
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

        supabase.from('shift_boiler').upsert({
            shift_report_id: rid, boiler: 'B',
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
        }, { onConflict: 'shift_report_id' }),
    ];

    let hasError = false;
    for (const insert of inserts) {
        const result = await insert;
        if (result.error) {
            console.error(`    ⚠️  child table error:`, result.error.message);
            hasError = true;
        }
    }
    return !hasError;
}

// ─── Process one tab ───
async function processTab(tab: string, shift: 'pagi' | 'sore' | 'malam', from: string, to: string) {
    console.log(`\n📋 Tab "${tab}" (shift ${shift}) — fetching...`);
    const rows = await getTabRows(tab);
    console.log(`   ${rows.length} total data rows in tab`);

    const inRange = rows.filter(row => {
        const date = parseIndonesianDate(row[1] ?? '');
        if (!date) return false;
        return date >= from && date <= to;
    });

    console.log(`   ${inRange.length} rows in range ${from} → ${to}`);
    if (inRange.length === 0) return { saved: 0, skipped: 0, errors: 0 };

    let saved = 0, skipped = 0, errors = 0;

    for (const row of inRange) {
        const date = parseIndonesianDate(row[1] ?? '')!;
        const groupTurbin = parseStr(row[COL.turbin_grup]);
        const groupBoiler = parseStr(row[COL.boiler_grup]);
        const groupName = groupTurbin || groupBoiler || 'Unknown';

        console.log(`   → ${date} | ${shift} | group: ${groupName}`);
        if (dryRun) { saved++; continue; }

        try {
            const ok = await saveRow(row, shift, date);
            if (ok) saved++;
            else errors++;
        } catch (err) {
            console.error(`   ❌ unexpected error:`, err);
            errors++;
        }

        // Throttle to avoid Supabase rate limit
        await new Promise(r => setTimeout(r, 100));
    }

    return { saved, skipped, errors };
}

// ─── Main ───
async function main() {
    const { from, to } = getDateRange(days);
    console.log('════════════════════════════════════════');
    console.log(`  Migrate Google Sheets → Supabase`);
    console.log(`  Range : ${from} → ${to} (${days} hari)`);
    console.log(`  Mode  : ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
    console.log('════════════════════════════════════════');

    const tabs: { tab: string; shift: 'pagi' | 'sore' | 'malam' }[] = [
        { tab: 'Pagi', shift: 'pagi' },
        { tab: 'Sore', shift: 'sore' },
        { tab: 'Malam', shift: 'malam' },
    ];

    let totalSaved = 0, totalErrors = 0;

    for (const { tab, shift } of tabs) {
        const result = await processTab(tab, shift, from, to);
        totalSaved += result.saved;
        totalErrors += result.errors;
    }

    console.log('\n════════════════════════════════════════');
    console.log(`  Selesai!`);
    console.log(`  Saved : ${totalSaved} rows`);
    console.log(`  Errors: ${totalErrors} rows`);
    if (dryRun) console.log('  (dry-run — tidak ada yang ditulis ke Supabase)');
    console.log('════════════════════════════════════════');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
