/**
 * Migrate shift report + daily report data from Google Sheets → Supabase.
 *
 * Shift tabs : Pagi, Sore, Malam  → shift_reports + child tables
 * Daily tab  : LHUBB              → daily_reports + child tables
 *
 * Usage:
 *   npx tsx scripts/migrate-from-sheets.ts --from 2026-04-01 --to 2026-04-06
 *   npx tsx scripts/migrate-from-sheets.ts --from 2026-04-01 --to 2026-04-06 --dry-run
 *   npx tsx scripts/migrate-from-sheets.ts --days 7   (last 7 days from today)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

// ─── Load .env.local ──────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq > 0) {
            const k = t.slice(0, eq).trim();
            let v = t.slice(eq + 1).trim();
            if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
            if (!process.env[k]) process.env[k] = v;
        }
    }
}

// ─── CLI Args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const fromArg = args[args.indexOf('--from') + 1];
const toArg   = args[args.indexOf('--to')   + 1];
const daysIdx = args.indexOf('--days');
const days    = daysIdx !== -1 ? parseInt(args[daysIdx + 1] ?? '7', 10) : 7;

function getDateRange(): { from: string; to: string } {
    if (fromArg && toArg) return { from: fromArg, to: toArg };
    const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return { from: fmt(from), to: fmt(to) };
}

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SPREADSHEET_ID  = process.env.GOOGLE_SHEETS_ID!;
const SA_EMAIL        = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const SA_KEY          = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing Supabase env vars'); process.exit(1); }
if (!SPREADSHEET_ID || !SA_EMAIL || !SA_KEY) { console.error('❌ Missing Google Sheets env vars'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseNum(v: string | undefined): number | null {
    if (!v || v.trim() === '' || v === '-') return null;
    const n = parseFloat(v.replace(/"/g, '').replace(',', '.').trim());
    return isNaN(n) ? null : n;
}
function parseStr(v: string | undefined): string | null {
    if (!v || v.trim() === '' || v === '-') return null;
    return v.replace(/"/g, '').trim();
}
function parseIndonesianDate(val: string): string | null {
    const M: Record<string, string> = {
        Januari:'01',Februari:'02',Maret:'03',April:'04',Mei:'05',Juni:'06',
        Juli:'07',Agustus:'08',September:'09',Oktober:'10',November:'11',Desember:'12',
    };
    const parts = (val ?? '').replace(/"/g,'').trim().split(' ');
    if (parts.length !== 3) return null;
    const m = M[parts[1]];
    if (!m) return null;
    return `${parts[2]}-${m}-${String(parseInt(parts[0])).padStart(2,'0')}`;
}

// ─── Google Sheets ────────────────────────────────────────────────────────────
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

// ─── SHIFT COL mapping (0-based, 143 cols) ───────────────────────────────────
const SC = {
    tanggal: 1,
    // Turbin
    turbin_flow_steam:2, turbin_flow_cond:3, turbin_press_steam:4,
    turbin_temp_steam:5, turbin_exh_steam:6, turbin_vacuum:7,
    turbin_hpo_durasi:8, turbin_thrust_bearing:9, turbin_metal_bearing:10,
    turbin_vibrasi:11, turbin_winding:12, turbin_axial_displacement:13,
    turbin_level_condenser:14, turbin_temp_cw_in:15, turbin_temp_cw_out:16,
    turbin_press_deaerator:17, turbin_temp_deaerator:18, turbin_stream_days:19,
    // Distribusi Steam
    steam_pabrik1_flow:20, steam_pabrik1_temp:21,
    steam_pabrik2_flow:22, steam_pabrik2_temp:23,
    steam_pabrik3a_flow:24, steam_pabrik3a_temp:25,
    steam_pabrik3b_flow:26, steam_pabrik3b_temp:27,
    // Generator + GI
    gen_load:28, gen_ampere:29, gen_amp_react:30,
    gen_cos_phi:31, gen_tegangan:32, gen_frequensi:33,
    gi_sum_p:34, gi_sum_q:35, gi_cos_phi:36,
    // Power Dist
    power_ubb:37, power_pabrik2:38, power_pabrik3a:39, power_pie:40, power_pabrik3b:41,
    // ESP
    esp_a1:42, esp_a2:43, esp_a3:44,
    esp_b1:45, esp_b2:46, esp_b3:47,
    silo_a:48, silo_b:49, unloading_a:50, unloading_b:51,
    // Handling
    loading:52, hopper:53, conveyor:54, pf1:55, pf2:56,
    // Tank Yard
    tk_rcw:57, tk_demin:58, tk_solar_ab:59,
    // Personnel Turbin
    turbin_grup:60, turbin_karu:61, turbin_kasi:62,
    // Boiler A / B (user-corrected: BL=63 A, BM=64 B, dll)
    boiler_press_steam_a:63,  boiler_press_steam_b:64,
    boiler_temp_steam_a:65,   boiler_temp_steam_b:66,
    boiler_flow_steam_a:67,   boiler_flow_steam_b:68,
    boiler_totalizer_steam_a:69, boiler_totalizer_steam_b:70,  // BR/BS — selisih, simpan Supabase
    boiler_flow_bfw_a:71,     boiler_flow_bfw_b:72,
    boiler_temp_bfw:73,       // BV — shared A & B
    boiler_temp_furnace_a:74, boiler_temp_furnace_b:75,        // BW/BX
    boiler_temp_flue_gas_a:76,boiler_temp_flue_gas_b:77,       // BY/BZ
    boiler_excess_air_a:78,   boiler_excess_air_b:79,          // CA/CB
    boiler_air_heater_a:80,   boiler_air_heater_b:81,          // CC/CD
    boiler_batubara_a:82,     boiler_batubara_b:83,            // CE/CF — simpan Supabase
    boiler_solar_a:84,        boiler_solar_b:85,               // CG/CH
    boiler_stream_days_a:86,  boiler_stream_days_b:87,         // CI/CJ
    // Coal Feeder flow
    feeder_a:88, feeder_b:89, feeder_c:90,
    feeder_d:91, feeder_e:92, feeder_f:93,
    // Coal Bunker
    bunker_a:94, bunker_b:95, bunker_c:96,
    bunker_d:97, bunker_e:98, bunker_f:99,
    // Water Quality
    demin_1250_ph:100, demin_1250_conduct:101, demin_1250_th:102, demin_1250_sio2:103,
    demin_750_ph:104,  demin_750_conduct:105,  demin_750_th:106,  demin_750_sio2:107,
    bfw_ph:108, bfw_conduct:109, bfw_th:110, bfw_sio2:111, bfw_nh4:112, bfw_chz:113,
    boiler_water_a_ph:114, boiler_water_a_conduct:115, boiler_water_a_sio2:116, boiler_water_a_po4:117,
    boiler_water_b_ph:118, boiler_water_b_conduct:119, boiler_water_b_sio2:120, boiler_water_b_po4:121,
    product_steam_ph:122, product_steam_conduct:123, product_steam_th:124,
    product_steam_sio2:125, product_steam_nh4:126,
    // Personnel Boiler Malam/Sore: DX=127, DY=128, DZ=129
    boiler_grup_ms:127, boiler_karu_ms:128, boiler_kasi_ms:129,
    // Pressure Drum & BFW Malam/Sore: EA=130, EB=131, EC=132, ED=133
    steam_drum_press_a_ms:130, steam_drum_press_b_ms:131,
    bfw_press_a_ms:132, bfw_press_b_ms:133,
    // Personnel Boiler Pagi: EF=133*, EG=134, EH=135  (*overlap ED, ambil 134/135/136 bila perlu)
    boiler_grup_pagi:133, boiler_karu_pagi:134, boiler_kasi_pagi:135,
    // Stock Chemical Pagi: EI=136, EJ=137, EK=138
    stock_phosphate:136, stock_amine:137, stock_hydrazine:138,
    // Pressure Drum & BFW Pagi: EL=139, EM=140, EN=141, EO=142
    steam_drum_press_a_pagi:139, steam_drum_press_b_pagi:140,
    bfw_press_a_pagi:141, bfw_press_b_pagi:142,
};

// ─── DAILY (LHUBB) COL mapping (0-based, 127 cols) ───────────────────────────
const DC = {
    tanggal: 1,
    // Produksi Steam 24h (totalizer harian = selisih)
    prod_boiler_a_24:2, prod_boiler_b_24:3,
    // E(4) = formula prod_total_24 — baca dari sheet, simpan ke Supabase
    prod_total_24:4,
    // Distribusi Steam 24h (totalizer harian)
    inlet_turbine_24:5,
    // G(6) = co_gen_24 kosong
    mps_i_24:7, mps_3a_24:8, lps_ii_24:9, lps_3a_24:10, fully_condens_24:11,
    // M(12) = formula internal_ubb_24 — baca dari sheet, simpan ke Supabase
    internal_ubb_24:12,
    // Steam 00.00 (flow 24)
    prod_boiler_a_00:13, prod_boiler_b_00:14,
    // P(15) = formula prod_total_00
    inlet_turbine_00:16, co_gen_00:17,
    mps_i_00:18, mps_3a_00:19, lps_ii_00:20, lps_3a_00:21, fully_condens_00:22,
    // X(23) = formula internal_ubb_00
    internal_ubb_00:23,
    // Power MWh (totalizer harian)
    power_stg_ubb_mwh:24,   // Y  → gen_24
    // Z(25) kosong
    power_pabrik2_mwh:26,   // AA → dist_ii_24
    power_pabrik3a_mwh:27,  // AB → dist_3a_24
    // AC(28) kosong
    power_bb1_mwh:29,       // AD → internal_bus1_24
    power_bb2_mwh:30,       // AE → internal_bus2_24
    // AF-AK(31-36) kosong
    // Power MW aktual (power 24)
    gen_00:37,              // AL → gen_00
    // AM(38) kosong
    power_pabrik2_mw:39,    // AN → power_pabrik2 / dist_ii_00
    power_pabrik3a_mw:40,   // AO → power_pabrik3a / dist_3a_00
    // AP(41) kosong
    power_bb1_mw:42,        // AQ → internal_bus1_00
    power_bb2_mw:43,        // AR → internal_bus2_00
    // AS(44) kosong
    power_pabrik3b_mw:45,   // AT → power_revamping
    // AU(46) kosong
    power_piu_mw:47,        // AV → power_pie / exsport_00
    // AW(48) kosong
    gi_sum_p:49,            // AX
    // Batubara 24h (totalizer harian = selisih)
    coal_a_24:50, coal_b_24:51, coal_c_24:52,
    // BB(53) = formula total_boiler_a_24 — baca dari sheet
    total_boiler_a_24:53,
    coal_d_24:54, coal_e_24:55, coal_f_24:56,
    // BF(57)=formula total_boiler_b_24, BG(58)=formula grand_total_24 — baca dari sheet
    total_boiler_b_24:57, grand_total_24:58,
    // Batubara 00.00 (flow 24)
    coal_a_00:59, coal_b_00:60, coal_c_00:61,
    // BK(62) = formula total_boiler_a_00
    coal_d_00:63, coal_e_00:64, coal_f_00:65,
    // BO(66)=formula, BP(67)=formula
    // Parameter Operasional 24
    temp_furnace_a:68,      // BQ
    temp_furnace_b:69,      // BR
    axial_displacement:70,  // BS
    thrust_bearing_temp:71, // BT
    steam_inlet_press:72,   // BU
    steam_inlet_temp:73,    // BV
    // BW-BY(74-76) = formula CR
    // BZ-CA(77-78) kosong
    // Export-Import PIU Harian
    totalizer_gi:79,        // CB
    totalizer_export:80,    // CC
    totalizer_import:81,    // CD
    // Stock & Tank
    // CE(82) = formula stock_batubara — baca dari sheet
    stock_batubara:82,
    rcw_level_00:83,        // CF
    demin_level_00:84,      // CG
    solar_tank_a:85,        // CH
    solar_tank_b:86,        // CI
    // CJ(87) = formula solar_tank_total — baca dari sheet
    solar_tank_total:87,
    kedatangan_solar:88,    // CK
    solar_boiler:89,        // CL
    solar_bengkel:90,       // CM
    solar_3b:91,            // CN
    // BFW
    bfw_boiler_a:92,        // CO
    bfw_boiler_b:93,        // CP
    // CQ(94) = formula bfw_total
    bfw_total:94,
    // Chemical
    chemical_phosphat:95,   // CR
    chemical_amin:96,       // CS
    chemical_hydrasin:97,   // CT
    // Silo & Fly Ash
    silo_a_pct:98,          // CU
    silo_b_pct:99,          // CV
    unloading_fly_ash_a:100,// CW
    unloading_fly_ash_b:101,// CX
    // Pemindahan Batubara PB II
    pb2_pf1_rit:102, pb2_pf1_ton:103, pb2_pf2_rit:104, pb2_pf2_ton:105,
    pb2_total_pf1_rit:106, pb2_total_pf1_ton:107, pb2_total_pf2_rit:108, pb2_total_pf2_ton:109,
    // PB III
    pb3_calc_rit:110, pb3_calc_ton:111, pb3_total_calc_rit:112, pb3_total_calc_ton:113,
    // Kedatangan Batubara
    darat_24_ton:114, darat_total_ton:115, laut_24_ton:116,
    // DN(117) = formula laut_total_ton
    laut_total_ton:117,
    // Keterangan & Air
    keterangan:118,
    konsumsi_demin:119,      // DP — selisih totalizer
    konsumsi_rcw:120,        // DQ
    penerimaan_demin_3a:121, // DR
    penerimaan_demin_1b:122, // DS
    penerimaan_rcw_1a:123,   // DT
    // Group & Kasi
    group_name:124,          // DU
    kasi_name:125,           // DV
    stock_batubara_rendal:126,// DW
};

// ─── Save SHIFT row ───────────────────────────────────────────────────────────
async function saveShiftRow(f: string[], shift: 'pagi' | 'sore' | 'malam', date: string): Promise<boolean> {
    const isPagi = shift === 'pagi';
    const groupTurbin  = parseStr(f[SC.turbin_grup]);
    const groupBoiler  = isPagi ? parseStr(f[SC.boiler_grup_pagi]) : parseStr(f[SC.boiler_grup_ms]);
    const groupName    = groupTurbin || groupBoiler || 'Unknown';
    const supervisor   = parseStr(f[SC.turbin_kasi])
        || (isPagi ? parseStr(f[SC.boiler_kasi_pagi]) : parseStr(f[SC.boiler_kasi_ms]))
        || '';

    const logsheetTime = shift === 'pagi' ? '14:00' : shift === 'sore' ? '22:00' : '06:00';
    const { data: report, error: reportErr } = await supabase
        .from('shift_reports')
        .upsert({ date, shift, group_name: groupName, supervisor, status: 'submitted', logsheet_time: logsheetTime },
            { onConflict: 'date,shift' })
        .select('id').single();

    if (reportErr || !report) {
        console.error(`  ❌ shift_reports:`, reportErr?.message); return false;
    }
    const rid = (report as { id: string }).id;

    // Pressure Drum & BFW — kolom berbeda per shift
    const drumA = isPagi ? parseNum(f[SC.steam_drum_press_a_pagi]) : parseNum(f[SC.steam_drum_press_a_ms]);
    const drumB = isPagi ? parseNum(f[SC.steam_drum_press_b_pagi]) : parseNum(f[SC.steam_drum_press_b_ms]);
    const bfwPA = isPagi ? parseNum(f[SC.bfw_press_a_pagi]) : parseNum(f[SC.bfw_press_a_ms]);
    const bfwPB = isPagi ? parseNum(f[SC.bfw_press_b_pagi]) : parseNum(f[SC.bfw_press_b_ms]);

    const ops = [
        supabase.from('shift_turbin').upsert({
            shift_report_id: rid,
            flow_steam:          parseNum(f[SC.turbin_flow_steam]),
            flow_cond:           parseNum(f[SC.turbin_flow_cond]),
            press_steam:         parseNum(f[SC.turbin_press_steam]),
            temp_steam:          parseNum(f[SC.turbin_temp_steam]),
            exh_steam:           parseNum(f[SC.turbin_exh_steam]),
            vacuum:              parseNum(f[SC.turbin_vacuum]),
            hpo_durasi:          parseNum(f[SC.turbin_hpo_durasi]),
            thrust_bearing:      parseNum(f[SC.turbin_thrust_bearing]),
            metal_bearing:       parseNum(f[SC.turbin_metal_bearing]),
            vibrasi:             parseNum(f[SC.turbin_vibrasi]),
            winding:             parseNum(f[SC.turbin_winding]),
            axial_displacement:  parseNum(f[SC.turbin_axial_displacement]),
            level_condenser:     parseNum(f[SC.turbin_level_condenser]),
            temp_cw_in:          parseNum(f[SC.turbin_temp_cw_in]),
            temp_cw_out:         parseNum(f[SC.turbin_temp_cw_out]),
            press_deaerator:     parseNum(f[SC.turbin_press_deaerator]),
            temp_deaerator:      parseNum(f[SC.turbin_temp_deaerator]),
            stream_days:         parseNum(f[SC.turbin_stream_days]),
        }, { onConflict: 'shift_report_id' }),

        supabase.from('shift_steam_dist').upsert({
            shift_report_id: rid,
            pabrik1_flow: parseNum(f[SC.steam_pabrik1_flow]),
            pabrik1_temp: parseNum(f[SC.steam_pabrik1_temp]),
            pabrik2_flow: parseNum(f[SC.steam_pabrik2_flow]),
            pabrik2_temp: parseNum(f[SC.steam_pabrik2_temp]),
            pabrik3a_flow:parseNum(f[SC.steam_pabrik3a_flow]),
            pabrik3a_temp:parseNum(f[SC.steam_pabrik3a_temp]),
            pabrik3b_flow:parseNum(f[SC.steam_pabrik3b_flow]),
            pabrik3b_temp:parseNum(f[SC.steam_pabrik3b_temp]),
        }, { onConflict: 'shift_report_id' }),

        supabase.from('shift_generator_gi').upsert({
            shift_report_id: rid,
            gen_load:    parseNum(f[SC.gen_load]),
            gen_ampere:  parseNum(f[SC.gen_ampere]),
            gen_amp_react:parseNum(f[SC.gen_amp_react]),
            gen_cos_phi: parseNum(f[SC.gen_cos_phi]),
            gen_tegangan:parseNum(f[SC.gen_tegangan]),
            gen_frequensi:parseNum(f[SC.gen_frequensi]),
            gi_sum_p:    parseNum(f[SC.gi_sum_p]),
            gi_sum_q:    parseNum(f[SC.gi_sum_q]),
            gi_cos_phi:  parseNum(f[SC.gi_cos_phi]),
        }, { onConflict: 'shift_report_id' }),

        supabase.from('shift_power_dist').upsert({
            shift_report_id: rid,
            power_ubb:     parseNum(f[SC.power_ubb]),
            power_pabrik2: parseNum(f[SC.power_pabrik2]),
            power_pabrik3a:parseNum(f[SC.power_pabrik3a]),
            power_pie:     parseNum(f[SC.power_pie]),
            power_pabrik3b:parseNum(f[SC.power_pabrik3b]),
        }, { onConflict: 'shift_report_id' }),

        supabase.from('shift_esp_handling').upsert({
            shift_report_id: rid,
            esp_a1:      parseNum(f[SC.esp_a1]),
            esp_a2:      parseNum(f[SC.esp_a2]),
            esp_a3:      parseNum(f[SC.esp_a3]),
            esp_b1:      parseNum(f[SC.esp_b1]),
            esp_b2:      parseNum(f[SC.esp_b2]),
            esp_b3:      parseNum(f[SC.esp_b3]),
            silo_a:      parseNum(f[SC.silo_a]),
            silo_b:      parseNum(f[SC.silo_b]),
            unloading_a: parseStr(f[SC.unloading_a]),
            unloading_b: parseNum(f[SC.unloading_b]),
            loading:     parseStr(f[SC.loading]),
            hopper:      parseStr(f[SC.hopper]),
            conveyor:    parseStr(f[SC.conveyor]),
            pf1:         parseNum(f[SC.pf1]),
            pf2:         parseNum(f[SC.pf2]),
        }, { onConflict: 'shift_report_id' }),

        supabase.from('shift_tankyard').upsert({
            shift_report_id: rid,
            tk_rcw:     parseNum(f[SC.tk_rcw]),
            tk_demin:   parseNum(f[SC.tk_demin]),
            tk_solar_ab:parseNum(f[SC.tk_solar_ab]),
        }, { onConflict: 'shift_report_id' }),

        supabase.from('shift_personnel').upsert({
            shift_report_id: rid,
            turbin_grup: parseStr(f[SC.turbin_grup]),
            turbin_karu: parseStr(f[SC.turbin_karu]),
            turbin_kasi: parseStr(f[SC.turbin_kasi]),
            boiler_grup: isPagi ? parseStr(f[SC.boiler_grup_pagi]) : parseStr(f[SC.boiler_grup_ms]),
            boiler_karu: isPagi ? parseStr(f[SC.boiler_karu_pagi]) : parseStr(f[SC.boiler_karu_ms]),
            boiler_kasi: isPagi ? parseStr(f[SC.boiler_kasi_pagi]) : parseStr(f[SC.boiler_kasi_ms]),
        }, { onConflict: 'shift_report_id' }),

        // Boiler A — BR/BS (totalizer_steam) adalah selisih, bukan raw meter → skip
        supabase.from('shift_boiler').upsert({
            shift_report_id: rid, boiler: 'A',
            press_steam:     parseNum(f[SC.boiler_press_steam_a]),
            temp_steam:      parseNum(f[SC.boiler_temp_steam_a]),
            flow_steam:      parseNum(f[SC.boiler_flow_steam_a]),
            flow_bfw:        parseNum(f[SC.boiler_flow_bfw_a]),
            temp_bfw:        parseNum(f[SC.boiler_temp_bfw]),            // BV shared
            temp_furnace:    parseNum(f[SC.boiler_temp_furnace_a]),
            temp_flue_gas:   parseNum(f[SC.boiler_temp_flue_gas_a]),
            excess_air:      parseNum(f[SC.boiler_excess_air_a]),
            air_heater_ti113:parseNum(f[SC.boiler_air_heater_a]),
            batubara_ton:    parseNum(f[SC.boiler_batubara_a]),          // CE — total batubara
            solar_m3:        parseNum(f[SC.boiler_solar_a]),
            stream_days:     parseNum(f[SC.boiler_stream_days_a]),
            steam_drum_press:drumA,
            bfw_press:       bfwPA,
            feeder_a_flow:   parseNum(f[SC.feeder_a]),                  // CK — flow feeder A
            feeder_b_flow:   parseNum(f[SC.feeder_b]),                  // CL — flow feeder B
            feeder_c_flow:   parseNum(f[SC.feeder_c]),                  // CM — flow feeder C
        }, { onConflict: 'shift_report_id,boiler' }),

        // Boiler B — BR/BS (totalizer_steam) adalah selisih, bukan raw meter → skip
        supabase.from('shift_boiler').upsert({
            shift_report_id: rid, boiler: 'B',
            press_steam:     parseNum(f[SC.boiler_press_steam_b]),
            temp_steam:      parseNum(f[SC.boiler_temp_steam_b]),
            flow_steam:      parseNum(f[SC.boiler_flow_steam_b]),
            flow_bfw:        parseNum(f[SC.boiler_flow_bfw_b]),
            temp_bfw:        parseNum(f[SC.boiler_temp_bfw]),            // BV shared
            temp_furnace:    parseNum(f[SC.boiler_temp_furnace_b]),
            temp_flue_gas:   parseNum(f[SC.boiler_temp_flue_gas_b]),
            excess_air:      parseNum(f[SC.boiler_excess_air_b]),
            air_heater_ti113:parseNum(f[SC.boiler_air_heater_b]),
            batubara_ton:    parseNum(f[SC.boiler_batubara_b]),          // CF — total batubara
            solar_m3:        parseNum(f[SC.boiler_solar_b]),
            stream_days:     parseNum(f[SC.boiler_stream_days_b]),
            steam_drum_press:drumB,
            bfw_press:       bfwPB,
            feeder_d_flow:   parseNum(f[SC.feeder_d]),                  // CN — flow feeder D
            feeder_e_flow:   parseNum(f[SC.feeder_e]),                  // CO — flow feeder E
            feeder_f_flow:   parseNum(f[SC.feeder_f]),                  // CP — flow feeder F
        }, { onConflict: 'shift_report_id,boiler' }),

        supabase.from('shift_coal_bunker').upsert({
            shift_report_id: rid,
            // feeder_a..f = totalizer feeder (bukan CK-CP yg adalah flow)
            bunker_a: parseNum(f[SC.bunker_a]), bunker_b: parseNum(f[SC.bunker_b]),
            bunker_c: parseNum(f[SC.bunker_c]), bunker_d: parseNum(f[SC.bunker_d]),
            bunker_e: parseNum(f[SC.bunker_e]), bunker_f: parseNum(f[SC.bunker_f]),
        }, { onConflict: 'shift_report_id' }),

        supabase.from('shift_water_quality').upsert({
            shift_report_id: rid,
            demin_1250_ph:      parseNum(f[SC.demin_1250_ph]),
            demin_1250_conduct: parseNum(f[SC.demin_1250_conduct]),
            demin_1250_th:      parseNum(f[SC.demin_1250_th]),
            demin_1250_sio2:    parseNum(f[SC.demin_1250_sio2]),
            demin_750_ph:       parseNum(f[SC.demin_750_ph]),
            demin_750_conduct:  parseNum(f[SC.demin_750_conduct]),
            demin_750_th:       parseNum(f[SC.demin_750_th]),
            demin_750_sio2:     parseNum(f[SC.demin_750_sio2]),
            bfw_ph:             parseNum(f[SC.bfw_ph]),
            bfw_conduct:        parseNum(f[SC.bfw_conduct]),
            bfw_th:             parseNum(f[SC.bfw_th]),
            bfw_sio2:           parseNum(f[SC.bfw_sio2]),
            bfw_nh4:            parseNum(f[SC.bfw_nh4]),
            bfw_chz:            parseNum(f[SC.bfw_chz]),
            boiler_water_a_ph:      parseNum(f[SC.boiler_water_a_ph]),
            boiler_water_a_conduct: parseNum(f[SC.boiler_water_a_conduct]),
            boiler_water_a_sio2:    parseNum(f[SC.boiler_water_a_sio2]),
            boiler_water_a_po4:     parseNum(f[SC.boiler_water_a_po4]),
            boiler_water_b_ph:      parseNum(f[SC.boiler_water_b_ph]),
            boiler_water_b_conduct: parseNum(f[SC.boiler_water_b_conduct]),
            boiler_water_b_sio2:    parseNum(f[SC.boiler_water_b_sio2]),
            boiler_water_b_po4:     parseNum(f[SC.boiler_water_b_po4]),
            product_steam_ph:       parseNum(f[SC.product_steam_ph]),
            product_steam_conduct:  parseNum(f[SC.product_steam_conduct]),
            product_steam_th:       parseNum(f[SC.product_steam_th]),
            product_steam_sio2:     parseNum(f[SC.product_steam_sio2]),
            product_steam_nh4:      parseNum(f[SC.product_steam_nh4]),
            // Stock Chemical — hanya shift pagi
            ...(isPagi ? {
                stock_phosphate: parseNum(f[SC.stock_phosphate]),
                stock_amine:     parseNum(f[SC.stock_amine]),
                stock_hydrazine: parseNum(f[SC.stock_hydrazine]),
            } : {}),
        }, { onConflict: 'shift_report_id' }),
    ];

    let ok = true;
    for (const op of ops) {
        const { error } = await op;
        if (error) { console.error(`    ⚠️`, error.message); ok = false; }
    }
    return ok;
}

// ─── Save DAILY row ───────────────────────────────────────────────────────────
async function saveDailyRow(f: string[], date: string): Promise<boolean> {
    // Upsert daily_reports anchor
    const { data: report, error: rErr } = await supabase
        .from('daily_reports')
        .upsert({ date, status: 'submitted' }, { onConflict: 'date' })
        .select('id').single();

    if (rErr || !report) {
        console.error(`  ❌ daily_reports:`, rErr?.message); return false;
    }
    const did = (report as { id: string }).id;

    const ops = [
        // Steam
        supabase.from('daily_report_steam').upsert({
            daily_report_id: did,
            prod_boiler_a_24:  parseNum(f[DC.prod_boiler_a_24]),
            prod_boiler_b_24:  parseNum(f[DC.prod_boiler_b_24]),
            prod_total_24:     parseNum(f[DC.prod_total_24]),      // formula, simpan ke Supabase
            inlet_turbine_24:  parseNum(f[DC.inlet_turbine_24]),
            mps_i_24:          parseNum(f[DC.mps_i_24]),
            mps_3a_24:         parseNum(f[DC.mps_3a_24]),
            lps_ii_24:         parseNum(f[DC.lps_ii_24]),
            lps_3a_24:         parseNum(f[DC.lps_3a_24]),
            fully_condens_24:  parseNum(f[DC.fully_condens_24]),
            internal_ubb_24:   parseNum(f[DC.internal_ubb_24]),    // formula, simpan ke Supabase
            prod_boiler_a_00:  parseNum(f[DC.prod_boiler_a_00]),
            prod_boiler_b_00:  parseNum(f[DC.prod_boiler_b_00]),
            inlet_turbine_00:  parseNum(f[DC.inlet_turbine_00]),
            co_gen_00:         parseNum(f[DC.co_gen_00]),
            mps_i_00:          parseNum(f[DC.mps_i_00]),
            mps_3a_00:         parseNum(f[DC.mps_3a_00]),
            lps_ii_00:         parseNum(f[DC.lps_ii_00]),
            lps_3a_00:         parseNum(f[DC.lps_3a_00]),
            fully_condens_00:  parseNum(f[DC.fully_condens_00]),
            internal_ubb_00:   parseNum(f[DC.internal_ubb_00]),
        }, { onConflict: 'daily_report_id' }),

        // Power
        supabase.from('daily_report_power').upsert({
            daily_report_id: did,
            gen_24:              parseNum(f[DC.power_stg_ubb_mwh]),  // Y → total STG UBB MWh
            internal_bus1_24:    parseNum(f[DC.power_bb1_mwh]),      // AD
            internal_bus2_24:    parseNum(f[DC.power_bb2_mwh]),      // AE
            dist_ii_24:          parseNum(f[DC.power_pabrik2_mwh]),  // AA → pabrik 2 MWh
            dist_3a_24:          parseNum(f[DC.power_pabrik3a_mwh]), // AB → pabrik 3A MWh
            gen_00:              parseNum(f[DC.gen_00]),              // AL
            power_pabrik2:       parseNum(f[DC.power_pabrik2_mw]),   // AN → MW aktual
            power_pabrik3a:      parseNum(f[DC.power_pabrik3a_mw]),  // AO
            internal_bus1_00:    parseNum(f[DC.power_bb1_mw]),       // AQ
            internal_bus2_00:    parseNum(f[DC.power_bb2_mw]),       // AR
            power_revamping:     parseNum(f[DC.power_pabrik3b_mw]),  // AT
            power_pie:           parseNum(f[DC.power_piu_mw]),       // AV
        }, { onConflict: 'daily_report_id' }),

        // Coal
        supabase.from('daily_report_coal').upsert({
            daily_report_id: did,
            coal_a_24:         parseNum(f[DC.coal_a_24]),
            coal_b_24:         parseNum(f[DC.coal_b_24]),
            coal_c_24:         parseNum(f[DC.coal_c_24]),
            total_boiler_a_24: parseNum(f[DC.total_boiler_a_24]),
            coal_d_24:         parseNum(f[DC.coal_d_24]),
            coal_e_24:         parseNum(f[DC.coal_e_24]),
            coal_f_24:         parseNum(f[DC.coal_f_24]),
            total_boiler_b_24: parseNum(f[DC.total_boiler_b_24]),
            grand_total_24:    parseNum(f[DC.grand_total_24]),
            coal_a_00:         parseNum(f[DC.coal_a_00]),
            coal_b_00:         parseNum(f[DC.coal_b_00]),
            coal_c_00:         parseNum(f[DC.coal_c_00]),
            coal_d_00:         parseNum(f[DC.coal_d_00]),
            coal_e_00:         parseNum(f[DC.coal_e_00]),
            coal_f_00:         parseNum(f[DC.coal_f_00]),
        }, { onConflict: 'daily_report_id' }),

        // Turbine Misc — Parameter Operasional + Export-Import PIU
        supabase.from('daily_report_turbine_misc').upsert({
            daily_report_id: did,
            temp_furnace_a:      parseNum(f[DC.temp_furnace_a]),
            temp_furnace_b:      parseNum(f[DC.temp_furnace_b]),
            axial_displacement:  parseNum(f[DC.axial_displacement]),
            thrust_bearing_temp: parseNum(f[DC.thrust_bearing_temp]),
            steam_inlet_press:   parseNum(f[DC.steam_inlet_press]),
            steam_inlet_temp:    parseNum(f[DC.steam_inlet_temp]),
            totalizer_gi:        parseNum(f[DC.totalizer_gi]),
            totalizer_export:    parseNum(f[DC.totalizer_export]),
            totalizer_import:    parseNum(f[DC.totalizer_import]),
        }, { onConflict: 'daily_report_id' }),

        // Stock & Tank
        supabase.from('daily_report_stock_tank').upsert({
            daily_report_id: did,
            stock_batubara:      parseNum(f[DC.stock_batubara]),
            rcw_level_00:        parseNum(f[DC.rcw_level_00]),
            demin_level_00:      parseNum(f[DC.demin_level_00]),
            solar_tank_a:        parseNum(f[DC.solar_tank_a]),
            solar_tank_b:        parseNum(f[DC.solar_tank_b]),
            solar_tank_total:    parseNum(f[DC.solar_tank_total]),
            kedatangan_solar:    parseNum(f[DC.kedatangan_solar]),
            solar_boiler:        parseNum(f[DC.solar_boiler]),
            solar_bengkel:       parseNum(f[DC.solar_bengkel]),
            solar_3b:            parseNum(f[DC.solar_3b]),
            bfw_boiler_a:        parseNum(f[DC.bfw_boiler_a]),
            bfw_boiler_b:        parseNum(f[DC.bfw_boiler_b]),
            bfw_total:           parseNum(f[DC.bfw_total]),
            chemical_phosphat:   parseNum(f[DC.chemical_phosphat]),
            chemical_amin:       parseNum(f[DC.chemical_amin]),
            chemical_hydrasin:   parseNum(f[DC.chemical_hydrasin]),
            silo_a_pct:          parseNum(f[DC.silo_a_pct]),
            silo_b_pct:          parseNum(f[DC.silo_b_pct]),
            unloading_fly_ash_a: parseNum(f[DC.unloading_fly_ash_a]),
            unloading_fly_ash_b: parseNum(f[DC.unloading_fly_ash_b]),
        }, { onConflict: 'daily_report_id' }),

        // Coal Transfer
        supabase.from('daily_report_coal_transfer').upsert({
            daily_report_id: did,
            pb2_pf1_rit:       parseNum(f[DC.pb2_pf1_rit]),
            pb2_pf1_ton:       parseNum(f[DC.pb2_pf1_ton]),
            pb2_pf2_rit:       parseNum(f[DC.pb2_pf2_rit]),
            pb2_pf2_ton:       parseNum(f[DC.pb2_pf2_ton]),
            pb2_total_pf1_rit: parseNum(f[DC.pb2_total_pf1_rit]),
            pb2_total_pf1_ton: parseNum(f[DC.pb2_total_pf1_ton]),
            pb2_total_pf2_rit: parseNum(f[DC.pb2_total_pf2_rit]),
            pb2_total_pf2_ton: parseNum(f[DC.pb2_total_pf2_ton]),
            pb3_calc_rit:       parseNum(f[DC.pb3_calc_rit]),
            pb3_calc_ton:       parseNum(f[DC.pb3_calc_ton]),
            pb3_total_calc_rit: parseNum(f[DC.pb3_total_calc_rit]),
            pb3_total_calc_ton: parseNum(f[DC.pb3_total_calc_ton]),
            darat_24_ton:       parseNum(f[DC.darat_24_ton]),
            darat_total_ton:    parseNum(f[DC.darat_total_ton]),
            laut_24_ton:        parseNum(f[DC.laut_24_ton]),
            laut_total_ton:     parseNum(f[DC.laut_total_ton]),
        }, { onConflict: 'daily_report_id' }),

        // Totalizer
        supabase.from('daily_report_totalizer').upsert({
            daily_report_id: did,
            keterangan:           parseStr(f[DC.keterangan]),
            konsumsi_demin:       parseNum(f[DC.konsumsi_demin]),
            konsumsi_rcw:         parseNum(f[DC.konsumsi_rcw]),
            penerimaan_demin_3a:  parseNum(f[DC.penerimaan_demin_3a]),
            penerimaan_demin_1b:  parseNum(f[DC.penerimaan_demin_1b]),
            penerimaan_rcw_1a:    parseNum(f[DC.penerimaan_rcw_1a]),
            group_name:           parseStr(f[DC.group_name]),
            kasi_name:            parseStr(f[DC.kasi_name]),
            stock_batubara_rendal:parseNum(f[DC.stock_batubara_rendal]),
        }, { onConflict: 'daily_report_id' }),
    ];

    let ok = true;
    for (const op of ops) {
        const { error } = await op;
        if (error) { console.error(`    ⚠️`, error.message); ok = false; }
    }
    return ok;
}

// ─── Process one tab ──────────────────────────────────────────────────────────
async function processShiftTab(
    tab: string,
    shift: 'pagi' | 'sore' | 'malam',
    from: string, to: string,
): Promise<{ saved: number; errors: number }> {
    console.log(`\n📋 Tab "${tab}" (shift ${shift}) — fetching...`);
    const rows = await getTabRows(tab);
    const inRange = rows.filter(r => {
        const d = parseIndonesianDate(r[1] ?? '');
        return d && d >= from && d <= to;
    });
    console.log(`   ${inRange.length} baris dalam range ${from} → ${to}`);

    let saved = 0, errors = 0;
    for (const row of inRange) {
        const date = parseIndonesianDate(row[1] ?? '')!;
        const group = parseStr(row[SC.turbin_grup]) || parseStr(row[SC.boiler_grup_ms]) || '-';
        console.log(`   → ${date} | ${shift} | grup: ${group}`);
        if (dryRun) { saved++; continue; }
        try {
            if (await saveShiftRow(row, shift, date)) saved++;
            else errors++;
        } catch (e) { console.error(`   ❌`, e); errors++; }
        await new Promise(r => setTimeout(r, 100));
    }
    return { saved, errors };
}

async function processDailyTab(from: string, to: string): Promise<{ saved: number; errors: number }> {
    console.log(`\n📋 Tab "LHUBB" (laporan harian) — fetching...`);
    const rows = await getTabRows('LHUBB');
    const inRange = rows.filter(r => {
        const d = parseIndonesianDate(r[1] ?? '');
        return d && d >= from && d <= to;
    });
    console.log(`   ${inRange.length} baris dalam range ${from} → ${to}`);

    let saved = 0, errors = 0;
    for (const row of inRange) {
        const date = parseIndonesianDate(row[1] ?? '')!;
        const group = parseStr(row[DC.group_name]) || '-';
        console.log(`   → ${date} | harian | grup: ${group}`);
        if (dryRun) { saved++; continue; }
        try {
            if (await saveDailyRow(row, date)) saved++;
            else errors++;
        } catch (e) { console.error(`   ❌`, e); errors++; }
        await new Promise(r => setTimeout(r, 100));
    }
    return { saved, errors };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    const { from, to } = getDateRange();
    console.log('════════════════════════════════════════════════');
    console.log('  Migrate Google Sheets → Supabase');
    console.log(`  Range : ${from} → ${to}`);
    console.log(`  Mode  : ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
    console.log('════════════════════════════════════════════════');

    let totalSaved = 0, totalErrors = 0;

    for (const { tab, shift } of [
        { tab: 'Pagi',  shift: 'pagi'  as const },
        { tab: 'Sore',  shift: 'sore'  as const },
        { tab: 'Malam', shift: 'malam' as const },
    ]) {
        const r = await processShiftTab(tab, shift, from, to);
        totalSaved  += r.saved;
        totalErrors += r.errors;
    }

    const rd = await processDailyTab(from, to);
    totalSaved  += rd.saved;
    totalErrors += rd.errors;

    console.log('\n════════════════════════════════════════════════');
    console.log('  Selesai!');
    console.log(`  Saved : ${totalSaved}`);
    console.log(`  Errors: ${totalErrors}`);
    if (dryRun) console.log('  (dry-run — tidak ada yang ditulis ke Supabase)');
    console.log('════════════════════════════════════════════════');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
