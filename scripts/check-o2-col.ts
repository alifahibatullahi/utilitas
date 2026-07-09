import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
    const e = line.indexOf('=');
    if (e > 0) {
        const k = line.slice(0, e).trim();
        let v = line.slice(e + 1).trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        if (!process.env[k]) process.env[k] = v;
    }
}

function colLetter(n: number): string {
    let s = ''; n++;
    while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
    return s;
}

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const s = google.sheets({ version: 'v4', auth });

async function main() {
    // Ambil 6 baris pertama (header) dan beberapa baris data
    const r = await s.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Pagi!A1:EZ10',
    });
    const rows = r.data.values ?? [];

    // Fokus kolom BY-CK (76-88)
    const cols = [76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88];
    console.log('\n=== HEADER & DATA ROWS — Kolom BY sampai CM ===');
    for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri];
        const vals = cols
            .map(c => `${colLetter(c)}(${c})="${row[c] ?? ''}"`)
            .filter(x => !x.endsWith('""'));
        if (vals.length > 0) {
            console.log(`ROW ${ri + 1}: ${vals.join(' | ')}`);
        }
    }
}

main().catch(console.error);
