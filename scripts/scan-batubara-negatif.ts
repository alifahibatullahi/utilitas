/** Scan semua tab shift untuk sel batubara CE/CF negatif. Read-only. */
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
            range: `${tab}!A6:CF`,
        });
        const rows = res.data.values ?? [];
        console.log(`=== ${tab}: baris dengan CE/CF negatif ===`);
        rows.forEach((r, i) => {
            const ce = parseFloat(r[82] ?? '');
            const cf = parseFloat(r[83] ?? '');
            if ((!isNaN(ce) && ce < 0) || (!isNaN(cf) && cf < 0)) {
                console.log(`row ${i + 6} | ${r[1]} | CE=${r[82] ?? ''} | CF=${r[83] ?? ''}`);
            }
        });
    }
}

main().catch(err => { console.error('❌', err.message ?? err); process.exit(1); });
