/**
 * Tulis ulang kolom "Link Foto" untuk SETIAP baris sheet yang punya foto.
 *
 * Dipakai untuk memperbaiki sel yang terlanjur salah — mis. sel `#ERROR!` yang ditulis
 * deployment lama dengan pemisah argumen formula keliru (koma di spreadsheet berlokal
 * in_ID; lihat argSeparatorForLocale di lib/critical-sheet.ts). Aman diulang: isinya
 * dihitung ulang dari tabel `sheet_photos`, bukan ditambal.
 *
 * Menulis HANYA kolom "Link Foto"; kolom isian operator tidak disentuh.
 *
 * Jalankan:  npx tsx scripts/resync-photo-cells.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Env (.env.local, format sama seperti scripts/check-critical-sheet.ts)
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
    // Import setelah env terpasang — lib membaca process.env saat dipanggil.
    const { createClient } = await import('@supabase/supabase-js');
    const { syncPhotoCell } = await import('../lib/sheet-photo-sync');

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await supabase.from('sheet_photos').select('row_uid');
    if (error) throw error;

    const uids = Array.from(new Set((data ?? []).map(r => r.row_uid as string).filter(Boolean)));
    console.log(`Baris sheet yang punya foto: ${uids.length}`);

    // Berurutan, bukan paralel: tiap sel = satu values.update, dan kuota tulis Sheets
    // (60 write/menit per user) lebih mudah dijaga begini.
    for (const uid of uids) {
        await syncPhotoCell(uid);
        console.log(`  ✓ ${uid}`);
    }
    console.log('Selesai. Periksa hasilnya dengan: npx tsx scripts/check-critical-sheet.ts');
}

main().catch(err => {
    console.error('GAGAL:', err instanceof Error ? err.message : err);
    process.exit(1);
});
