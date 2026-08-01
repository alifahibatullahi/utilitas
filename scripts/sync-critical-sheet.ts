/**
 * Isi/segarkan cermin `critical_sheet_rows` dari spreadsheet.
 *
 * Dipakai untuk pengisian pertama dan saat cermin perlu diluruskan manual. Dalam
 * pemakaian normal ini berjalan sendiri lewat cron (app/api/cron/notify-shift).
 *
 * Jalankan:  npx tsx scripts/sync-critical-sheet.ts          (ekor saja — murah)
 *            npx tsx scripts/sync-critical-sheet.ts --full   (seluruh sheet)
 */

import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
}

async function main() {
    const { syncFull, syncTail } = await import('../lib/critical-sheet-sync');
    const full = process.argv.includes('--full');

    console.log(full ? 'Sync PENUH (seluruh A1:AE)…' : 'Sync EKOR (ujung sheet + kolom Dokumentasi)…');
    const hasil = full ? await syncFull() : await syncTail();

    console.log(`\nmode      : ${hasil.mode}`);
    console.log(`baris baca: ${hasil.dibaca}`);
    console.log(`ditulis   : ${hasil.ditulis}`);
    console.log(`dihapus   : ${hasil.dihapus}`);
    if (hasil.tersisa) console.log(`tersisa   : ${hasil.tersisa} (jalankan lagi)`);
    console.log(`waktu     : ${(hasil.ms / 1000).toFixed(1)} detik`);

    // Klien Supabase menyisakan handle yang membuat proses menggantung setelah selesai.
    process.exit(0);
}

main().catch(err => {
    console.error('GAGAL:', err instanceof Error ? err.message : err);
    process.exit(1);
});
