// Verifikasi spreadsheet Catatan Operasional (lib/google-sheets.ts → upsertCatatanOperasional).
// Jalankan dengan kredensial di .env.local:
//   npx tsx scripts/test-catatan-write.ts            → read-only: tab, dropdown, 5 baris terakhir, dry-run merge
//   npx tsx scripts/test-catatan-write.ts --write    → plus upsert nyata utk tanggal tes (idempotency check)
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

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_CATATAN_ID || '1qbN1nrpJmVJ_WY2YPGB4TCJixLrf5cwAyycqqHZC1mw';
const GID = 457458234;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const SA_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
    credentials: { client_email: SA_EMAIL, private_key: SA_KEY },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function main() {
    // Import setelah env termuat (modul baca process.env saat init).
    const { mergeCatatanCell, upsertCatatanOperasional } = await import('../lib/google-sheets');

    // 1. Resolve tab dari gid
    const meta = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        fields: 'sheets.properties(sheetId,title)',
    });
    const tab = meta.data.sheets?.find(s => s.properties?.sheetId === GID)?.properties?.title;
    console.log(`tab gid=${GID} →`, tab);
    if (!tab) throw new Error('tab tidak ditemukan');
    const q = `'${tab.replace(/'/g, "''")}'`;

    // 2. Baca B1:D, print 5 baris terakhir + lastNonEmptyB
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${q}!B1:D`,
        valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values ?? []) as string[][];
    let lastNonEmptyB = 0;
    for (let i = 0; i < rows.length; i++) if ((rows[i][0] ?? '').trim() !== '') lastNonEmptyB = i + 1;
    console.log(`total rows: ${rows.length}, lastNonEmptyB (sheet row): ${lastNonEmptyB}`);
    for (const [i, r] of rows.slice(-5).entries()) {
        console.log(`row ${rows.length - 5 + i + 1}: B=${JSON.stringify(r[0] ?? '')} C=${JSON.stringify(r[1] ?? '')} D=${JSON.stringify((r[2] ?? '').slice(0, 60))}`);
    }

    // 3. Cek opsi dropdown kolom C (baris data pertama setelah header yang ber-tanggal)
    const dvRow = Math.max(lastNonEmptyB, 2);
    const dv = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        ranges: [`${q}!C${dvRow}`],
        fields: 'sheets.data.rowData.values.dataValidation',
    });
    const rule = dv.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.dataValidation;
    console.log('dropdown C:', JSON.stringify(rule?.condition ?? null));

    // 4. Dry-run mergeCatatanCell
    const sampleManual = 'Cek level tangki solar jam 10, normal.';
    const canonical1 = '• Sootblower boiler A jam 14:00\n• Kedatangan solar dari PT X sebanyak 5.000 L';
    const m1 = mergeCatatanCell(sampleManual, canonical1);
    console.log('\n[dry-run] manual + blok baru:\n' + m1.next);
    const m2 = mergeCatatanCell(m1.next, canonical1 + '\n• Vibrasi turbin naik 0,2 mm/s');
    console.log('\n[dry-run] blok di-update:\n' + m2.next);
    const m3 = mergeCatatanCell(m1.next, canonical1);
    console.log('\n[dry-run] re-save identik → changed =', m3.changed, '(harus false)');

    // 5. Upsert nyata (opsional, --write): tanggal tes kemarin supaya tidak tabrakan
    if (process.argv.includes('--write')) {
        const isoDate = '2000-01-01'; // tanggal sentinel — hapus barisnya manual setelah tes
        const r1 = await upsertCatatanOperasional(isoDate, 'pagi', '• baris tes 1');
        console.log('\nupsert #1:', r1);
        const r2 = await upsertCatatanOperasional(isoDate, 'pagi', '• baris tes 1');
        console.log('upsert #2 (identik, harus skipped):', r2);
        const r3 = await upsertCatatanOperasional(isoDate, 'pagi', '• baris tes 1\n• baris tes 2');
        console.log('upsert #3 (berubah, harus updated):', r3);
    }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
