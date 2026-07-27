/**
 * Sapu-bersih kolom "Link Foto" — cocokkan ulang seluruh selnya dengan posisi ID saat ini.
 *
 * Kenapa perlu: sel "Link Foto" adalah NILAI STATIS (formula HYPERLINK berisi ID di dalam
 * URL-nya), bukan rumus yang mencari ID. App hanya menulis ulang sel itu saat jumlah foto
 * satu baris berubah (upload/hapus). Jadi kalau ID berpindah baris — operator menyortir
 * atau menggeser sebagian kolom TANPA ikut kolom B — selnya tertinggal di baris lama dan
 * menunjuk record yang bukan miliknya, dan tidak ada yang membersihkannya.
 *
 * Skrip ini menghitung ulang isi yang SEHARUSNYA untuk tiap baris (dari ID di kolom B +
 * jumlah foto di Supabase), lalu menulis hanya sel yang berbeda:
 *   - baris ber-ID yang punya foto  → formula HYPERLINK ke halaman record itu
 *   - baris ber-ID tanpa foto       → dikosongkan
 *   - sel nyasar di baris yang bukan baris data → dikosongkan, TAPI hanya kalau isinya
 *     memang buatan app (tautan ke /critical-maintenance). Sel milik operator tidak disentuh.
 *
 * BAWAANNYA UJI-KERING: tanpa argumen tidak menulis apa pun, hanya melaporkan.
 *
 *   npx tsx scripts/sync-photo-cells.ts            # laporan saja
 *   npx tsx scripts/sync-photo-cells.ts --apply    # tulis ke spreadsheet
 *
 * Yang sengaja TIDAK diperbaiki: ID yang tidak cocok dengan isi barisnya. Skrip ini tidak
 * tahu mana yang benar (bisa jadi barisnya tergeser, bisa jadi nama itemnya dikoreksi),
 * dan mengganti ID berarti memutus foto yang menempel padanya. Kasus itu hanya dilaporkan.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    photoCellFormula, photoPageUrl, recordItemKeys, rowItemLabel, uidMatchesRow, recordKindLabel,
    type ArgSeparator,
} from '../lib/critical-sheet';

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

/** Perbandingan formula tahan beda spasi (Sheets kadang merapikan sendiri). */
const norm = (v: string) => (v ?? '').replace(/\s+/g, ' ').trim();

/** Apakah isi sel ini buatan app? Hanya sel seperti ini yang boleh dikosongkan. */
function isAppPhotoCell(value: string): boolean {
    const v = norm(value);
    return v.startsWith('=HYPERLINK(') && v.includes('/critical-maintenance?item=');
}

export interface Baris { uid: string; rowIndex: number; item: string; varian: string }

export interface RencanaSel {
    tulis: { rowIndex: number; value: string }[];
    dipasang: number;      // sel foto dipasang/diperbarui
    dikosongkan: number;   // baris datanya sudah tidak punya foto
    nyasar: number;        // sel buatan app di baris yang bukan baris data lagi
    dilewatiKembar: number;
    tidakCocok: number;    // ID vs isi baris (hanya dilaporkan)
}

/**
 * Bandingkan isi kolom "Link Foto" sekarang dengan yang seharusnya. Murni (tanpa I/O)
 * supaya bisa diuji: lihat scripts/__tests__ pemakaiannya di uji skenario ID berpindah.
 */
export function rencanakanSel(opts: {
    headerRowIndex: number;
    tinggiKolom: number;                        // baris terakhir yang punya isi di kolom itu
    rows: Baris[];
    isiAt: (rowIndex1: number) => string;       // isi sel sekarang (FORMULA)
    jumlahFoto: Map<string, number>;            // ID → jumlah foto di database
    hitunganUid: Map<string, number>;           // ID → berapa baris memakainya di sheet
    sep: ArgSeparator;
    kind: 'critical' | 'maintenance';           // jenis tab — ikut jadi label sel
}): RencanaSel {
    const { headerRowIndex, rows, isiAt, jumlahFoto, hitunganUid, sep, kind } = opts;
    const barisData = new Map<number, Baris>();
    for (const r of rows) barisData.set(r.rowIndex, r);

    const out: RencanaSel = { tulis: [], dipasang: 0, dikosongkan: 0, nyasar: 0, dilewatiKembar: 0, tidakCocok: 0 };
    // Sapu seluruh tinggi kolom, bukan cuma baris data — sel nyasar justru ada di
    // baris yang sudah bukan baris data lagi.
    const tinggi = Math.max(opts.tinggiKolom, ...rows.map(r => r.rowIndex));

    for (let rowIndex = headerRowIndex + 1; rowIndex <= tinggi; rowIndex++) {
        const sekarang = isiAt(rowIndex);
        const baris = barisData.get(rowIndex);

        if (!baris) {
            // Bukan baris data. Hanya bersihkan kalau selnya memang buatan app.
            if (isAppPhotoCell(sekarang)) {
                out.tulis.push({ rowIndex, value: '' });
                out.nyasar++;
            }
            continue;
        }

        if (baris.uid && (hitunganUid.get(baris.uid) ?? 0) > 1) { out.dilewatiKembar++; continue; }
        if (baris.uid && !uidMatchesRow(baris.uid, baris.item, baris.varian)) out.tidakCocok++;

        const count = baris.uid ? (jumlahFoto.get(baris.uid) ?? 0) : 0;
        const seharusnya = baris.uid
            ? photoCellFormula(
                count,
                photoPageUrl(recordItemKeys(baris.item, baris.varian)[0], baris.uid),
                sep,
                rowItemLabel(baris.item, baris.varian),
                recordKindLabel(kind),
            )
            : '';

        // Sel milik operator (bukan buatan app) tidak pernah ditimpa dengan kosong.
        if (!seharusnya && !isAppPhotoCell(sekarang)) continue;
        if (norm(sekarang) === norm(seharusnya)) continue;

        out.tulis.push({ rowIndex, value: seharusnya });
        if (seharusnya) out.dipasang++; else out.dikosongkan++;
    }
    return out;
}

async function main() {
    const { google } = await import('googleapis');
    const { createClient } = await import('@supabase/supabase-js');
    const { parseCriticalTab, parseMaintenanceTab, argSeparatorForLocale } = await import('../lib/critical-sheet');

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
        { title: criticalTitle, kind: 'critical' as const, parsed: parseCriticalTab(criticalRows ?? []) },
        { title: maintenanceTitle, kind: 'maintenance' as const, parsed: parseMaintenanceTab(maintenanceRows ?? []) },
    ];

    // ── Jumlah foto per ID ───────────────────────────────────────────────────
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: fotoRows, error: fotoErr } = await supabase.from('sheet_photos').select('row_uid');
    if (fotoErr) throw fotoErr;
    const jumlahFoto = new Map<string, number>();
    for (const f of fotoRows ?? []) {
        const uid = (f.row_uid as string) ?? '';
        if (uid) jumlahFoto.set(uid, (jumlahFoto.get(uid) ?? 0) + 1);
    }
    console.log(`\nFoto di database: ${(fotoRows ?? []).length} berkas pada ${jumlahFoto.size} ID`);

    // ID kembar = tidak jelas sel mana yang harus dipakai → dilewati, bukan ditebak.
    const hitunganUid = new Map<string, number>();
    for (const { parsed } of tabs) {
        for (const r of parsed.rows as unknown as Baris[]) {
            if (r.uid) hitunganUid.set(r.uid, (hitunganUid.get(r.uid) ?? 0) + 1);
        }
    }
    const uidDiSheet = new Set(hitunganUid.keys());
    const yatim = [...jumlahFoto.keys()].filter(u => !uidDiSheet.has(u));
    if (yatim.length) {
        console.log(`⚠️  ${yatim.length} ID punya foto tapi TIDAK ADA di sheet: ${yatim.slice(0, 10).join(', ')}`);
        console.log('    Fotonya tetap aman di database, hanya tidak punya baris untuk ditautkan.');
    }

    // ── Bandingkan sel per tab ───────────────────────────────────────────────
    let totalUbah = 0;
    const rencana: { title: string; col: string; tulis: { rowIndex: number; value: string }[] }[] = [];

    for (const { title, kind, parsed } of tabs) {
        console.log(`\n=== ${title} ===`);
        if (parsed.photoColIndex === null) {
            console.log('  kolom "Link Foto" belum ada — dilewati');
            continue;
        }
        const col = colLetter(parsed.photoColIndex);

        // Isi kolom Link Foto apa adanya (FORMULA, bukan hasil tampilannya) supaya
        // perbandingannya setara dengan yang akan ditulis.
        const kolom = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${quoteTab(title)}!${col}1:${col}`,
            valueRenderOption: 'FORMULA',
        });
        const isiKolom = (kolom.data.values ?? []) as string[][];
        const isiAt = (rowIndex1: number) => String(isiKolom[rowIndex1 - 1]?.[0] ?? '');

        const rows = parsed.rows as unknown as Baris[];
        const { tulis, dipasang, dikosongkan, nyasar, dilewatiKembar, tidakCocok } = rencanakanSel({
            headerRowIndex: parsed.headerRowIndex,
            tinggiKolom: isiKolom.length,
            rows,
            isiAt,
            jumlahFoto,
            hitunganUid,
            sep,
            kind,
        });

        console.log(`  kolom Link Foto : ${col}`);
        console.log(`  baris data      : ${rows.length}`);
        console.log(`  sel dipasang/diperbarui : ${dipasang}`);
        console.log(`  sel dikosongkan (foto habis) : ${dikosongkan}`);
        console.log(`  sel nyasar di baris non-data : ${nyasar}`);
        if (dilewatiKembar) console.log(`  ⚠️  dilewati karena ID kembar : ${dilewatiKembar}`);
        if (tidakCocok) console.log(`  ⚠️  ID tidak cocok dgn itemnya (dilaporkan saja) : ${tidakCocok}`);
        if (tulis.length) {
            console.log('  contoh:');
            for (const w of tulis.slice(0, 5)) {
                console.log(`    ${col}${w.rowIndex}: ${w.value ? w.value.slice(0, 90) + '…' : '(dikosongkan)'}`);
            }
        }

        totalUbah += tulis.length;
        if (tulis.length) rencana.push({ title, col, tulis });
    }

    if (!APPLY) {
        console.log(`\nUji kering selesai. Kalau dijalankan dengan --apply: ${totalUbah} sel ditulis.`);
        return;
    }
    if (totalUbah === 0) {
        console.log('\nSemua sel sudah sesuai — tidak ada yang perlu ditulis.');
        return;
    }

    // ── Tulis per blok kontigu ───────────────────────────────────────────────
    for (const { title, col, tulis } of rencana) {
        tulis.sort((a, b) => a.rowIndex - b.rowIndex);
        const data: { range: string; values: string[][] }[] = [];
        let block: { start: number; values: string[][] } | null = null;
        for (const w of tulis) {
            if (block && w.rowIndex === block.start + block.values.length) block.values.push([w.value]);
            else {
                if (block) data.push({ range: `${quoteTab(title)}!${col}${block.start}:${col}${block.start + block.values.length - 1}`, values: block.values });
                block = { start: w.rowIndex, values: [[w.value]] };
            }
        }
        if (block) data.push({ range: `${quoteTab(title)}!${col}${block.start}:${col}${block.start + block.values.length - 1}`, values: block.values });

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: { valueInputOption: 'USER_ENTERED', data },
        });
        console.log(`\n✓ ${title}: ${tulis.length} sel Link Foto ditulis (${data.length} blok)`);
    }

    console.log('\nSelesai. Jalankan lagi tanpa --apply untuk memastikan tidak ada sisa.');
}

// Hanya jalan saat dieksekusi langsung — file ini juga di-import oleh uji rencanakanSel().
if (require.main === module) main().catch(err => {
    console.error('GAGAL:', err instanceof Error ? err.message : err);
    process.exit(1);
});
