/** Cek sel supervisor (kasi) di tab shift utk range tanggal. Read-only.
 *  BK(62) = kasi turbin; DZ(129) = kasi boiler (malam/sore); EF(135) = kasi boiler (pagi).
 *  Usage: npx tsx scripts/check-kasi-sheets.ts [--from 2026-06-08] [--to 2026-06-10]
 */
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

const envPath = path.resolve(__dirname, '..', '.env.local');
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

const args = process.argv.slice(2);
const fromArg = args.indexOf('--from') !== -1 ? args[args.indexOf('--from') + 1] : '2026-06-08';
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
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    for (const tab of ['Pagi', 'Sore', 'Malam']) {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SHEETS_ID!,
            range: `${tab}!A6:EF`,
        });
        console.log(`\n=== ${tab}: Tanggal | BK kasi turbin | kasi boiler (${tab === 'Pagi' ? 'EF' : 'DZ'}) ===`);
        for (const r of res.data.values ?? []) {
            const iso = fromIndonesianDate(r[1] ?? '');
            if (!iso || iso < fromArg || iso > toArg) continue;
            const kasiBoiler = tab === 'Pagi' ? r[135] : r[129];
            console.log(`${iso} | ${r[62] || '(kosong)'} | ${kasiBoiler || '(kosong)'}`);
        }
    }
}

main().catch(err => { console.error('❌', err.message ?? err); process.exit(1); });
