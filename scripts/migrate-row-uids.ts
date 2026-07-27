/**
 * Tulis ulang SELURUH kolom "ID" dengan format terbaru `KODE-VARIAN-acak`
 * (mis. `L-08.12-A-a1`), lalu pindahkan foto yang menempel ke ID barunya.
 *
 * Dipakai tiap kali format ID berubah:
 *   - UUID acak      → format ber-item (Jul 2026)
 *   - sufiks 6 hex   → sufiks 2 karakter (ID diringkas, Jul 2026)
 *
 * Kenapa formatnya ber-item: UUID acak tidak menyimpan jejak barisnya milik apa, sehingga
 * isi baris yang tergeser (mis. operator menyortir kolom data TANPA ikut kolom ID)
 * memasangkan foto ke pekerjaan yang salah tanpa bisa dideteksi siapa pun. Dengan kode
 * item tertanam, pergeseran itu langsung terlihat — lihat uidMatchesRow() di lib/critical-sheet.ts.
 *
 * BAWAANNYA UJI-KERING: tanpa argumen, skrip ini TIDAK menulis apa pun, hanya melaporkan
 * apa yang akan berubah. Tambahkan --apply untuk benar-benar menulis.
 *
 *   npx tsx scripts/migrate-row-uids.ts            # laporan saja
 *   npx tsx scripts/migrate-row-uids.ts --apply    # tulis ke spreadsheet + Supabase
 *
 * Urutan saat --apply dipilih supaya tidak ada foto yatim di tengah jalan:
 *   1. tulis kolom uid di spreadsheet (per blok kontigu),
 *   2. baca ulang & verifikasi hasilnya,
 *   3. baru pindahkan sheet_photos.row_uid ke uid baru,
 *   4. tulis ulang sel "Link Foto" supaya tautannya menunjuk uid baru.
 * Kalau langkah 2 gagal, langkah 3–4 tidak dijalankan.
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

const APPLY = process.argv.includes('--apply');

function colLetter(index0: number): string {
    let n = index0 + 1;
    let s = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

const quoteTab = (t: string) => `'${t.replace(/'/g, "''")}'`;

interface Baris { uid: string; rowIndex: number; item: string; varian: string }

async function main() {
    const { google } = await import('googleapis');
    const { createClient } = await import('@supabase/supabase-js');
    const {
        parseCriticalTab, parseMaintenanceTab, buildRowUid, uidPrefixFor, rowItemLabel,
        photoCellFormula, photoPageUrl, argSeparatorForLocale, recordItemKeys,
    } = await import('../lib/critical-sheet');

    const spreadsheetId = process.env.GOOGLE_SHEETS_CRITICAL_ID!;
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
            private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!
                .replace(/^["']|["']$/g, '').replace(/\\n/g, '\n'),
        },
        scopes: [APPLY
            ? 'https://www.googleapis.com/auth/spreadsheets'
            : 'https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    console.log(APPLY ? '=== MODE TULIS (--apply) ===' : '=== UJI KERING (tidak menulis apa pun) ===');

    const meta = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'properties.locale,sheets.properties(sheetId,title)',
    });
    const sep = argSeparatorForLocale(meta.data.properties?.locale ?? '');
    const tabOf = (gid: number) => {
        const t = meta.data.sheets?.find(s => s.properties?.sheetId === gid);
        if (!t?.properties?.title) throw new Error(`Tab gid=${gid} tidak ditemukan`);
        return t.properties.title;
    };
    const criticalTitle = tabOf(parseInt(process.env.GOOGLE_SHEETS_CRITICAL_GID!, 10));
    const maintenanceTitle = tabOf(parseInt(process.env.GOOGLE_SHEETS_MAINTENANCE_GID!, 10));

    const values = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: [`${quoteTab(criticalTitle)}!A1:AE`, `${quoteTab(maintenanceTitle)}!A1:AE`],
        valueRenderOption: 'FORMATTED_VALUE',
    });
    const [criticalRows, maintenanceRows] = (values.data.valueRanges ?? []).map(v => (v.values ?? []) as string[][]);

    const tabs = [
        { title: criticalTitle, parsed: parseCriticalTab(criticalRows ?? []) },
        { title: maintenanceTitle, parsed: parseMaintenanceTab(maintenanceRows ?? []) },
    ];

    // ── Susun peta uid lama → baru ───────────────────────────────────────────
    const taken = new Set<string>();
    const petaan = new Map<string, string>();          // uid lama → uid baru
    const rencana: { title: string; uidCol: string; tulis: { rowIndex: number; value: string }[] }[] = [];

    for (const { title, parsed } of tabs) {
        if (parsed.uidColIndex === null) {
            throw new Error(`Tab "${title}": kolom "ID" tidak ada di baris header — migrasi dibatalkan.`);
        }
        const rows = parsed.rows as unknown as Baris[];
        const uidCol = colLetter(parsed.uidColIndex);
        const tulis: { rowIndex: number; value: string }[] = [];

        for (const r of rows) {
            const baru = buildRowUid(r.item, r.varian, taken);
            if (r.uid) petaan.set(r.uid, baru);
            tulis.push({ rowIndex: r.rowIndex, value: baru });
        }

        rencana.push({ title, uidCol, tulis });
        console.log(`\n${title} (kolom ${uidCol}): ${rows.length} baris`);
        console.log('  contoh perubahan:');
        for (const r of rows.slice(0, 3)) {
            console.log(`    baris ${r.rowIndex}  ${r.uid || '(kosong)'}`);
            console.log(`               → ${petaan.get(r.uid) ?? '(baru)'}   [${uidPrefixFor(r.item, r.varian)}]`);
        }
        const tanpaKode = rows.filter(r => !/^[A-Z]{1,5}-\d{2}\.\d{2}/.test(uidPrefixFor(r.item, r.varian))).length;
        console.log(`  memakai slug nama (tanpa kode equipment): ${tanpaKode} baris`);
    }

    // ── Foto yang terpengaruh ────────────────────────────────────────────────
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: fotoRows, error: fotoErr } = await supabase.from('sheet_photos').select('id, row_uid');
    if (fotoErr) throw fotoErr;

    const uidFoto = Array.from(new Set((fotoRows ?? []).map(f => f.row_uid as string).filter(Boolean)));
    const bisaDipetakan = uidFoto.filter(u => petaan.has(u));
    const yatim = uidFoto.filter(u => !petaan.has(u));

    console.log(`\nFoto: ${(fotoRows ?? []).length} berkas pada ${uidFoto.length} baris`);
    console.log(`  bisa dipetakan ke uid baru : ${bisaDipetakan.length}`);
    console.log(`  TIDAK ketemu barisnya      : ${yatim.length}${yatim.length ? ' → ' + yatim.join(', ') : ''}`);

    if (!APPLY) {
        const total = rencana.reduce((n, r) => n + r.tulis.length, 0);
        console.log(`\nUji kering selesai. Kalau dijalankan dengan --apply:`);
        console.log(`  ${total} sel uid ditulis ulang, ${bisaDipetakan.length} baris foto dipetakan ulang.`);
        console.log('  Tidak ada yang berubah sekarang.');
        return;
    }

    // ── 1. Tulis kolom uid ───────────────────────────────────────────────────
    for (const { title, uidCol, tulis } of rencana) {
        tulis.sort((a, b) => a.rowIndex - b.rowIndex);
        const data: { range: string; values: string[][] }[] = [];
        let block: { start: number; values: string[][] } | null = null;
        for (const w of tulis) {
            if (block && w.rowIndex === block.start + block.values.length) block.values.push([w.value]);
            else {
                if (block) data.push({ range: `${quoteTab(title)}!${uidCol}${block.start}:${uidCol}${block.start + block.values.length - 1}`, values: block.values });
                block = { start: w.rowIndex, values: [[w.value]] };
            }
        }
        if (block) data.push({ range: `${quoteTab(title)}!${uidCol}${block.start}:${uidCol}${block.start + block.values.length - 1}`, values: block.values });

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: { valueInputOption: 'RAW', data },
        });
        console.log(`\n✓ ${title}: ${tulis.length} sel uid ditulis (${data.length} blok)`);
    }

    // ── 2. Verifikasi ────────────────────────────────────────────────────────
    const cek = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: rencana.map(r => `${quoteTab(r.title)}!${r.uidCol}1:${r.uidCol}`),
    });
    let salah = 0;
    (cek.data.valueRanges ?? []).forEach((vr, i) => {
        const kol = (vr.values ?? []) as string[][];
        for (const w of rencana[i].tulis) {
            if ((kol[w.rowIndex - 1]?.[0] ?? '').trim() !== w.value) salah++;
        }
    });
    if (salah > 0) {
        console.error(`\n⛔ ${salah} sel TIDAK sesuai setelah ditulis. Pemetaan foto DIBATALKAN.`);
        console.error('   Periksa spreadsheet sebelum menjalankan ulang.');
        process.exit(1);
    }
    console.log('✓ Verifikasi: semua sel uid sesuai rencana');

    // ── 3. Pindahkan foto ke uid baru ────────────────────────────────────────
    for (const lama of bisaDipetakan) {
        const baru = petaan.get(lama)!;
        const { error } = await supabase.from('sheet_photos').update({ row_uid: baru }).eq('row_uid', lama);
        if (error) throw error;
        console.log(`✓ foto ${lama} → ${baru}`);
    }

    // ── 4. Tulis ulang sel Link Foto ─────────────────────────────────────────
    for (const { title, parsed } of tabs) {
        if (parsed.photoColIndex === null) continue;
        const col = colLetter(parsed.photoColIndex);
        const rows = parsed.rows as unknown as Baris[];
        for (const r of rows) {
            const baru = petaan.get(r.uid);
            if (!baru || !bisaDipetakan.includes(r.uid)) continue;
            const { count } = await supabase.from('sheet_photos').select('id', { count: 'exact', head: true }).eq('row_uid', baru);
            const itemKey = recordItemKeys(r.item, r.varian)[0];
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${quoteTab(title)}!${col}${r.rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[photoCellFormula(count ?? 0, photoPageUrl(itemKey, baru), sep, rowItemLabel(r.item, r.varian))]] },
            });
            console.log(`✓ Link Foto ${title}!${col}${r.rowIndex} disegarkan`);
        }
    }

    console.log('\nSelesai. Periksa dengan: npx tsx scripts/check-critical-sheet.ts');
}

main().catch(err => {
    console.error('GAGAL:', err instanceof Error ? err.message : err);
    process.exit(1);
});
