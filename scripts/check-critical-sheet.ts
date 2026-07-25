/**
 * Pemeriksa spreadsheet Critical Maintenance — READ-ONLY.
 *
 * Menjawab satu pertanyaan: "kalau app membaca spreadsheet yang ditunjuk env sekarang,
 * apakah semua kolom yang dikelola app terdeteksi dengan benar?"
 *
 * Dipakai di dua momen:
 *   1. Sebelum/sesudah menyisipkan kolom "Link Foto" — memastikan kolom web_uid masih
 *      terbaca di posisi barunya, sehingga backfill TIDAK menulis ulang UID massal.
 *   2. Saat migrasi ke spreadsheet produksi — memastikan tab, baris header, dan kolom
 *      terdeteksi sebelum app pertama kali menyentuhnya.
 *
 * Jalankan:  npx tsx scripts/check-critical-sheet.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import { parseCriticalTab, parseMaintenanceTab } from '../lib/critical-sheet';

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

    /** Kolom web_uid ganda = jejak deployment lama yang menulis uid di kolom lain. */
    const duplicateUidCols = (rows: string[][]): number[] => {
        const scan = Math.min(rows.length, 30);
        for (let i = 0; i < scan; i++) {
            const hit = (rows[i] ?? [])
                .map((c, idx) => ({ name: (c ?? '').toLowerCase().replace(/["'.:]/g, '').replace(/\s+/g, ' ').trim(), idx }))
                .filter(x => x.name.startsWith('web_uid'))
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
            uidColIndex: number;
            photoColIndex: number | null;
            rows: { uid: string; linkFoto: string }[];
        },
    ) => {
        const missingUid = parsed.rows.filter(r => !r.uid).length;
        const withPhoto = parsed.rows.filter(r => r.linkFoto).length;

        console.log(`=== ${label} — "${tabTitle}" (gid ${gid}, ${columnCount} kolom) ===`);
        console.log(`  baris header    : ${parsed.headerRowIndex}`);
        console.log(`  baris data valid: ${parsed.rows.length}`);
        console.log(`  kolom web_uid   : ${colLetter(parsed.uidColIndex)} (index ${parsed.uidColIndex})`);
        console.log(`  kolom Link Foto : ${parsed.photoColIndex === null ? '— BELUM ADA —' : `${colLetter(parsed.photoColIndex)} (index ${parsed.photoColIndex})`}`);
        console.log(`  baris tanpa uid : ${missingUid}`);
        console.log(`  sel Link Foto terisi: ${withPhoto}`);

        const uidCols = duplicateUidCols(allRows);
        if (uidCols.length > 1) {
            problems++;
            console.log(`  ⛔ KOLOM web_uid GANDA: ${uidCols.map(colLetter).join(', ')}`);
            console.log('      App memakai yang paling kiri, jadi sebagian data akan menunjuk uid yang salah.');
            console.log('      Biasanya jejak deployment lama yang masih meng-hardcode posisi kolom.');
            console.log('      Hapus kolom duplikatnya, sisakan satu.');
        }

        if (missingUid > 0) {
            problems++;
            console.log(`  ⚠️  ${missingUid} baris akan DIISI UID BARU saat web dimuat.`);
            console.log('      Wajar hanya untuk baris yang memang baru. Kalau angkanya mendekati');
            console.log('      jumlah baris data, berarti kolom web_uid TIDAK terdeteksi — hentikan');
            console.log('      dan periksa nama header sebelum membuka web.');
        }
        if (parsed.photoColIndex === null) {
            console.log('  ℹ️  Kolom "Link Foto" belum dibuat — fitur link foto nonaktif (web tetap jalan).');
        }
        console.log('');
    };

    report('CRITICAL', criticalTab.title!, criticalGid,
        criticalTab.gridProperties?.columnCount ?? 0, criticalRows ?? [], parseCriticalTab(criticalRows ?? []));
    report('MAINTENANCE', maintenanceTab.title!, maintenanceGid,
        maintenanceTab.gridProperties?.columnCount ?? 0, maintenanceRows ?? [], parseMaintenanceTab(maintenanceRows ?? []));

    console.log(problems === 0
        ? '✅ Semua kolom yang dikelola app terdeteksi.'
        : '⚠️  Ada temuan di atas — baca sebelum melanjutkan.');
}

main().catch(err => {
    console.error('GAGAL:', err instanceof Error ? err.message : err);
    process.exit(1);
});
