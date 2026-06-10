/**
 * Restore wiped shift_turbin rows from Google Sheets.
 *
 * Latar belakang (insiden Mei–Jun 2026): saveChild dulu DELETE+INSERT, sehingga
 * simpan sparse dari station panel_turbin (operator keburu mengetik totalizer
 * sebelum data lama termuat) meng-wipe semua parameter operasional turbin di
 * Supabase. Google Sheets AMAN karena updateSheetRow melewati sel null —
 * data lengkap masih ada di tab Pagi/Sore/Malam.
 *
 * Skrip ini mencari shift_turbin yang ke-wipe (semua parameter operasional null),
 * membaca baris sheet tanggal+shift yang sama, lalu meng-UPDATE HANYA kolom yang
 * masih null di DB (nilai non-null yang ada — totalizer/status — tidak disentuh).
 *
 * Usage:
 *   npx tsx scripts/restore-turbin-from-sheets.ts --from 2026-05-15 --dry-run
 *   npx tsx scripts/restore-turbin-from-sheets.ts --from 2026-05-15
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
const dryRun = args.includes('--dry-run');
const fromArg = args.indexOf('--from') !== -1 ? args[args.indexOf('--from') + 1] : '2026-05-15';

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const SA_EMAIL       = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const SA_KEY         = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing Supabase env vars'); process.exit(1); }
if (!SPREADSHEET_ID || !SA_EMAIL || !SA_KEY) { console.error('❌ Missing Google Sheets env vars'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SHEET_TABS: Record<string, string> = { pagi: 'Pagi', sore: 'Sore', malam: 'Malam' };

// Kolom turbin di sheet (0-indexed, sama dengan lib/sheets-mapper COL) → kolom DB.
const TURBIN_COLS: { idx: number; db: string }[] = [
    { idx: 2,  db: 'flow_steam' },
    { idx: 3,  db: 'flow_cond' },
    { idx: 4,  db: 'press_steam' },
    { idx: 5,  db: 'temp_steam' },
    { idx: 6,  db: 'exh_steam' },
    { idx: 7,  db: 'vacuum' },
    { idx: 8,  db: 'hpo_durasi' },
    { idx: 9,  db: 'thrust_bearing' },
    { idx: 10, db: 'metal_bearing' },
    { idx: 11, db: 'vibrasi' },
    { idx: 12, db: 'winding' },
    { idx: 13, db: 'axial_displacement' },
    { idx: 14, db: 'level_condenser' },
    { idx: 15, db: 'temp_cw_in' },
    { idx: 16, db: 'temp_cw_out' },
    { idx: 17, db: 'press_deaerator' },
    { idx: 18, db: 'temp_deaerator' },
    { idx: 19, db: 'stream_days' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS: Record<string, number> = {
    januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
    juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

/** "07 Juni 2026" / "7 Juni 2026" → "2026-06-07" (null kalau bukan format itu) */
function fromIndonesianDate(s: string): string | null {
    const parts = s.trim().replace(/,/g, '').split(/\s+/);
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0], 10);
    const m = MONTHS[parts[1].toLowerCase()];
    const y = parseInt(parts[2], 10);
    if (!d || !m || !y) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseNum(cell: string | undefined): number | null {
    if (!cell || cell.trim() === '' || cell === '-') return null;
    const cleaned = cell.replace(/"/g, '').replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

async function getSheetsClient() {
    const auth = new google.auth.JWT({
        email: SA_EMAIL,
        key: SA_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    await auth.authorize();
    return google.sheets({ version: 'v4', auth });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`Restore shift_turbin dari Sheets — from=${fromArg} dryRun=${dryRun}`);

    // 1. Cari row shift_turbin yang ke-wipe (semua parameter operasional null).
    const { data: reports, error } = await supabase
        .from('shift_reports')
        .select('id, date, shift, shift_turbin(id, flow_steam, flow_cond, press_steam, temp_steam, exh_steam, vacuum, hpo_durasi, thrust_bearing, metal_bearing, vibrasi, winding, axial_displacement, level_condenser, temp_cw_in, temp_cw_out, press_deaerator, temp_deaerator, stream_days, status_turbin)')
        .gte('date', fromArg)
        .order('date');
    if (error) { console.error('❌ Query error:', error.message); process.exit(1); }

    type TurbinRow = Record<string, unknown> & { id: string };
    const wiped: { date: string; shift: string; turbin: TurbinRow }[] = [];
    for (const r of (reports ?? []) as { date: string; shift: string; shift_turbin: TurbinRow[] | TurbinRow | null }[]) {
        const t = Array.isArray(r.shift_turbin) ? r.shift_turbin[0] : r.shift_turbin;
        if (!t) continue;
        const allOpsNull = TURBIN_COLS.every(c => t[c.db] == null);
        if (allOpsNull) wiped.push({ date: r.date, shift: r.shift, turbin: t });
    }
    console.log(`Ditemukan ${wiped.length} row turbin ke-wipe.`);
    if (wiped.length === 0) return;

    // 2. Baca sheet per tab (1 fetch per tab), index by tanggal ISO.
    const sheets = await getSheetsClient();
    const tabRows: Record<string, Map<string, string[]>> = {};
    for (const shift of new Set(wiped.map(w => w.shift))) {
        const tab = SHEET_TABS[shift];
        if (!tab) continue;
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${tab}!A6:EM`,
        });
        const byDate = new Map<string, string[]>();
        for (const row of (res.data.values ?? []) as string[][]) {
            const iso = fromIndonesianDate(row[1] ?? '');
            if (iso) byDate.set(iso, row);
        }
        tabRows[shift] = byDate;
        console.log(`Tab ${tab}: ${byDate.size} baris tanggal terbaca.`);
    }

    // 3. Update kolom yang null saja.
    let restored = 0, noSheet = 0, noData = 0;
    for (const w of wiped) {
        const row = tabRows[w.shift]?.get(w.date);
        if (!row) {
            console.log(`  - ${w.date} ${w.shift}: baris sheet tidak ditemukan, skip`);
            noSheet++;
            continue;
        }
        const patch: Record<string, number> = {};
        for (const c of TURBIN_COLS) {
            if (w.turbin[c.db] != null) continue; // jangan timpa nilai yang masih ada
            const v = parseNum(row[c.idx]);
            if (v != null) patch[c.db] = v;
        }
        if (Object.keys(patch).length === 0) {
            console.log(`  - ${w.date} ${w.shift}: sheet juga kosong (status=${w.turbin.status_turbin}), skip`);
            noData++;
            continue;
        }
        if (dryRun) {
            console.log(`  ~ [dry-run] ${w.date} ${w.shift}: akan restore ${Object.keys(patch).length} kolom →`, patch);
            restored++;
            continue;
        }
        const { error: updErr } = await supabase
            .from('shift_turbin')
            .update(patch)
            .eq('id', w.turbin.id);
        if (updErr) {
            console.error(`  ✗ ${w.date} ${w.shift}: update gagal — ${updErr.message}`);
        } else {
            console.log(`  ✓ ${w.date} ${w.shift}: restored ${Object.keys(patch).length} kolom`);
            restored++;
        }
    }
    console.log(`\nSelesai. restored=${restored} sheet_missing=${noSheet} sheet_empty=${noData}${dryRun ? ' (dry-run, tidak ada yang ditulis)' : ''}`);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
