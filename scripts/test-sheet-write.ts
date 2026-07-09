// Test write to LHUBB salinan
import { readFileSync } from 'fs';
import { google } from 'googleapis';

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

async function main() {
    // Write sentinel value to col N (prod_boiler_a_00, col index 13)
    const res = await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `LHUBB!N2316`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[ 99999 ]] },
    });
    console.log('updatedCells:', res.data.updatedCells);
    console.log('updatedRange:', res.data.updatedRange);

    // Read back
    const read = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `LHUBB!N2316`,
    });
    console.log('read back:', read.data.values);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
