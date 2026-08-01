/**
 * Pemeriksa spreadsheet Critical Maintenance — READ-ONLY.
 *
 * Menjawab satu pertanyaan: "kalau app membaca spreadsheet yang ditunjuk env sekarang,
 * apakah semua kolom yang dikelola app terdeteksi dengan benar?"
 *
 * Identitas baris kini hidup di dalam URL sel "Dokumentasi", bukan di kolom "ID".
 * Kolom ID (di AA) tinggal ARSIP — app tidak pernah menulisnya lagi, jadi baris tanpa
 * ID bukan lagi temuan. Yang penting sekarang: kolom Dokumentasi terdeteksi, dan uid di
 * dalamnya masih cocok dengan isi barisnya.
 *
 * Dipakai di dua momen:
 *   1. Sebelum/sesudah menyisipkan, memindah, atau MENGGANTI NAMA kolom — kolom foto
 *      pernah diganti nama ("Link Foto" → "Dokumentasi") dan fiturnya mati diam-diam
 *      berhari-hari karena tidak ada yang memeriksa.
 *   2. Saat migrasi ke spreadsheet produksi — memastikan tab, baris header, dan kolom
 *      terdeteksi sebelum app pertama kali menyentuhnya.
 *
 * Jalankan:  npx tsx scripts/check-critical-sheet.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import { parseCriticalTab, parseMaintenanceTab, isUidHeader, uidFromPhotoFormula, uidMatchesRow } from '../lib/critical-sheet';

// ─── Env (.env.local, format sama seperti scripts/fetch-headers.ts) ──────────
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

function requireEnv(name: string): string {
    const v = (process.env[name] ?? '').trim();
    if (!v) throw new Error(`Env ${name} belum di-set di .env.local`);
    return v;
}

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
        private_key: requireEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
            .replace(/^["']|["']$/g, '')
            .replace(/\\n/g, '\n'),
    },
    // READ-ONLY: script ini tidak boleh bisa menulis apa pun ke spreadsheet.
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function main() {
    const spreadsheetId = requireEnv('GOOGLE_SHEETS_CRITICAL_ID');
    const criticalGid = parseInt(requireEnv('GOOGLE_SHEETS_CRITICAL_GID'), 10);
    const maintenanceGid = parseInt(requireEnv('GOOGLE_SHEETS_MAINTENANCE_GID'), 10);

    console.log(`Spreadsheet : ${spreadsheetId}`);

    const meta = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties(sheetId,title,gridProperties(columnCount,rowCount))',
    });
    const props = (meta.data.sheets ?? []).map(s => s.properties!);
    console.log(`Tab tersedia: ${props.map(p => `${p.title} (gid ${p.sheetId})`).join(', ')}\n`);

    const findTab = (gid: number, label: string) => {
        const t = props.find(p => p.sheetId === gid);
        if (!t?.title) throw new Error(`Tab ${label} gid=${gid} TIDAK DITEMUKAN`);
        return t;
    };
    const criticalTab = findTab(criticalGid, 'critical');
    const maintenanceTab = findTab(maintenanceGid, 'maintenance');

    const quote = (t: string) => `'${t.replace(/'/g, "''")}'`;
    const res = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: [`${quote(criticalTab.title!)}!A1:AE`, `${quote(maintenanceTab.title!)}!A1:AE`],
        valueRenderOption: 'FORMATTED_VALUE',
    });
    const [criticalRows, maintenanceRows] = (res.data.valueRanges ?? []).map(v => (v.values ?? []) as string[][]);

    let problems = 0;

    /** Kolom ID ganda = jejak kolom "web_uid" lama yang belum dihapus. */
    const duplicateUidCols = (rows: string[][]): number[] => {
        const scan = Math.min(rows.length, 30);
        for (let i = 0; i < scan; i++) {
            const hit = (rows[i] ?? [])
                .map((c, idx) => ({ name: (c ?? '').toLowerCase().replace(/["'.:]/g, '').replace(/\s+/g, ' ').trim(), idx }))
                .filter(x => isUidHeader(x.name))
                .map(x => x.idx);
            if (hit.length) return hit;
        }
        return [];
    };

    const report = (
        label: string,
        tabTitle: string,
        gid: number,
        columnCount: number,
        allRows: string[][],
        parsed: {
            headerRowIndex: number;
            uidColIndex: number | null;
            photoColIndex: number | null;
            rows: { rowIndex: number; legacyId: string; item: string; varian: string; linkFoto: string }[];
        },
        /** uid per baris, dibaca dari FORMULA sel Dokumentasi (bukan dari kolom ID). */
        uidPerBaris: Map<number, string>,
    ) => {
        const berfoto = parsed.rows.filter(r => uidPerBaris.get(r.rowIndex));
        const berArsip = parsed.rows.filter(r => r.legacyId).length;

        console.log(`=== ${label} — "${tabTitle}" (gid ${gid}, ${columnCount} kolom) ===`);
        console.log(`  baris header     : ${parsed.headerRowIndex}`);
        console.log(`  baris data valid : ${parsed.rows.length}`);
        console.log(`  kolom Dokumentasi: ${parsed.photoColIndex === null ? '— BELUM ADA —' : `${colLetter(parsed.photoColIndex)} (index ${parsed.photoColIndex})`}`);
        console.log(`  baris berfoto    : ${berfoto.length}  (uid ada di sel Dokumentasi)`);
        console.log(`  kolom ID (arsip) : ${parsed.uidColIndex === null ? '— tidak ada —' : `${colLetter(parsed.uidColIndex)}, terisi ${berArsip}/${parsed.rows.length}`}`);

        const uidCols = duplicateUidCols(allRows);
        if (uidCols.length > 1) {
            problems++;
            console.log(`  ⛔ KOLOM ID GANDA: ${uidCols.map(colLetter).join(', ')}`);
            console.log('      Membingungkan saat pemulihan foto — hapus duplikatnya, sisakan satu.');
        }

        // Kolom Dokumentasi hilang = fitur foto mati TOTAL, dan pernah terjadi tanpa
        // ada yang menyadarinya. Ini temuan paling penting di sini.
        if (parsed.photoColIndex === null) {
            problems++;
            console.log('  ⛔ Kolom "Dokumentasi" TIDAK DITEMUKAN di baris header.');
            console.log('      Foto tetap tersimpan tapi tidak akan menempel ke baris mana pun.');
            console.log('      Nama yang diterima: "Dokumentasi" atau "Link Foto".');
        }

        // uid membawa kode item di dalamnya, jadi ketidakcocokan = isi baris tergeser
        // (mis. memblok sebagian kolom lalu menyortirnya) — foto akan tampil di baris salah.
        const geser = berfoto.filter(r => !uidMatchesRow(uidPerBaris.get(r.rowIndex)!, r.item, r.varian));
        if (geser.length) {
            problems++;
            console.log(`  ⛔ ${geser.length} sel Dokumentasi TIDAK COCOK dengan isi barisnya:`);
            for (const r of geser.slice(0, 5)) {
                console.log(`      baris ${r.rowIndex}: uid ${uidPerBaris.get(r.rowIndex)} vs "${r.item}"${r.varian ? ` varian ${r.varian}` : ''}`);
            }
            console.log('      Jalankan: npx tsx scripts/repair-photo-links.ts');
        }
        console.log('');
    };

    const criticalParsed = parseCriticalTab(criticalRows ?? []);
    const maintenanceParsed = parseMaintenanceTab(maintenanceRows ?? []);

    /**
     * uid TIDAK ada di nilai tampilan sel — hanya di dalam formula HYPERLINK-nya.
     * Karena itu kolom Dokumentasi dibaca sekali lagi dengan render FORMULA.
     */
    const bacaUid = async (tabTitle: string, photoColIndex: number | null): Promise<Map<number, string>> => {
        const peta = new Map<number, string>();
        if (photoColIndex === null) return peta;
        const col = colLetter(photoColIndex);
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${quote(tabTitle)}!${col}1:${col}`,
            valueRenderOption: 'FORMULA',
        });
        ((res.data.values ?? []) as string[][]).forEach((r, idx) => {
            const uid = uidFromPhotoFormula(String(r?.[0] ?? ''));
            if (uid) peta.set(idx + 1, uid);
        });
        return peta;
    };

    report('CRITICAL', criticalTab.title!, criticalGid,
        criticalTab.gridProperties?.columnCount ?? 0, criticalRows ?? [], criticalParsed,
        await bacaUid(criticalTab.title!, criticalParsed.photoColIndex));
    report('MAINTENANCE', maintenanceTab.title!, maintenanceGid,
        maintenanceTab.gridProperties?.columnCount ?? 0, maintenanceRows ?? [], maintenanceParsed,
        await bacaUid(maintenanceTab.title!, maintenanceParsed.photoColIndex));

    console.log(problems === 0
        ? '✅ Semua kolom yang dikelola app terdeteksi.'
        : '⚠️  Ada temuan di atas — baca sebelum melanjutkan.');
}

main().catch(err => {
    console.error('GAGAL:', err instanceof Error ? err.message : err);
    process.exit(1);
});
