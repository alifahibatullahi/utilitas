/**
 * One-off: bersihkan sel batubara CE/CF yang korup (negatif raksasa) akibat
 * insiden selisih 0−prev (lihat scripts/scan-batubara-negatif.ts untuk deteksi).
 * Target:
 *   - Malam!CE2357:CF2357 (10 Juni 2026)    : -46191 / -44460 → kosongkan
 *   - Pagi!CE2817:CF2817  (13 September 2027): -42245 / -40090 → kosongkan
 * Verifikasi nilai dulu sebelum menulis (abort kalau isi sel tidak sesuai dugaan).
 *
 * Usage: npx tsx scripts/fix-batubara-negatif.ts
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

const TARGETS = [
    { tab: 'Malam', row: 2357, expectDate: '10 Juni 2026', expectCe: '-46191', expectCf: '-44460' },
    { tab: 'Pagi', row: 2817, expectDate: '13 September 2027', expectCe: '-42245', expectCf: '-40090' },
];

async function main() {
    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    const id = process.env.GOOGLE_SHEETS_ID!;

    for (const t of TARGETS) {
        const check = await sheets.spreadsheets.values.get({
            spreadsheetId: id, range: `${t.tab}!B${t.row}:CF${t.row}`,
        });
        const r = (check.data.values ?? [])[0] ?? [];
        const date = (r[0] ?? '').trim();          // B
        const ce = (r[81] ?? '').trim();           // CE relatif dari B (B=0 → CE=81)
        const cf = (r[82] ?? '').trim();           // CF
        if (date !== t.expectDate || ce !== t.expectCe || cf !== t.expectCf) {
            console.log(`✗ ${t.tab}!${t.row}: isi tidak sesuai dugaan (date="${date}" CE="${ce}" CF="${cf}") — SKIP`);
            continue;
        }
        await sheets.spreadsheets.values.update({
            spreadsheetId: id,
            range: `${t.tab}!CE${t.row}:CF${t.row}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['', '']] },
        });
        console.log(`✓ ${t.tab}!CE${t.row}:CF${t.row} (${t.expectDate}) dikosongkan (was ${ce}/${cf})`);
    }
}

main().catch(err => { console.error('❌', err.message ?? err); process.exit(1); });
