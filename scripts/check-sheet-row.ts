// Quick check: read row 2316 from LHUBB tab and print first 30 cells
import { readFileSync } from 'fs';
import { google } from 'googleapis';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) {
        let val = m[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[m[1]] = val;
    }
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const SA_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

console.log('SPREADSHEET_ID =', SPREADSHEET_ID);

const auth = new google.auth.GoogleAuth({
    credentials: { client_email: SA_EMAIL, private_key: SA_KEY },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const row = process.argv[2] ? parseInt(process.argv[2]) : 2316;
const tab = process.argv[3] ?? 'LHUBB';

async function main() {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A${row}:DZ${row}`,
    });
    const data = res.data.values?.[0] ?? [];
    console.log(`Row ${row} of ${tab}: ${data.length} cells`);
    data.forEach((v, i) => {
        if (v !== '' && v != null) console.log(`  col ${i}: ${v}`);
    });
}

main().catch(e => { console.error(e); process.exit(1); });
