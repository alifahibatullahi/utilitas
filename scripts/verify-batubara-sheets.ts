/**
 * Verifikasi read-only: kolom batubara di Google Sheets vs data PowerOps.
 * - Shift (Pagi/Sore/Malam): CE/CF = total batubara Boiler A/B
 * - LHUBB: C/D = produksi steam; konsumsi batubara di AY..BG
 *
 * Usage: npx tsx scripts/verify-batubara-sheets.ts [--from 2026-06-01] [--to 2026-06-10]
 */
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

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

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const SA_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

const args = process.argv.slice(2);
const fromArg = args.indexOf('--from') !== -1 ? args[args.indexOf('--from') + 1] : '2026-06-01';
const toArg = args.indexOf('--to') !== -1 ? args[args.indexOf('--to') + 1] : '2026-06-10';

const MONTHS: Record<string, number> = {
    januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
    juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};
function fromIndonesianDate(s: string): string | null {
    const parts = s.trim().replace(/,/g, '').split(/\s+/);
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0], 10);
    const m = MONTHS[parts[1].toLowerCase()];
    const y = parseInt(parts[2], 10);
    if (!d || !m || !y) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function main() {
    const auth = new google.auth.JWT({
        email: SA_EMAIL, key: SA_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Shift tabs: CE(82)/CF(83) per tanggal dalam range
    for (const tab of ['Pagi', 'Sore', 'Malam']) {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: `${tab}!A6:CF`,
        });
        console.log(`\n=== ${tab} ${fromArg}..${toArg}: Tanggal | CE batubara A | CF batubara B ===`);
        for (const r of res.data.values ?? []) {
            const iso = fromIndonesianDate(r[1] ?? '');
            if (!iso || iso < fromArg || iso > toArg) continue;
            console.log(`${iso} | ${r[82] ?? '(kosong)'} | ${r[83] ?? '(kosong)'}`);
        }
    }

    // LHUBB: C/D (produksi) + AY..BE (coal feeder) + BB/BF (total formula)
    const lhubb = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: 'LHUBB!A6:BG',
    });
    console.log(`\n=== LHUBB ${fromArg}..${toArg} ===`);
    console.log('Tanggal | C prodA | D prodB | AY,AZ,BA (coal A) | BB totA | BC,BD,BE (coal B) | BF totB');
    for (const r of lhubb.data.values ?? []) {
        const iso = fromIndonesianDate(r[1] ?? '');
        if (!iso || iso < fromArg || iso > toArg) continue;
        console.log(`${iso} | ${r[2] ?? '-'} | ${r[3] ?? '-'} | ${r[50] ?? '-'},${r[51] ?? '-'},${r[52] ?? '-'} | ${r[53] ?? '-'} | ${r[54] ?? '-'},${r[55] ?? '-'},${r[56] ?? '-'} | ${r[57] ?? '-'}`);
    }
}

main().catch(err => { console.error('❌', err.message ?? err); process.exit(1); });
