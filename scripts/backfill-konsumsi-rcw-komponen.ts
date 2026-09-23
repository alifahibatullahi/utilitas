/**
 * Sekali pakai: isi kolom DQ/DR/DS (Konsumsi Harian Hydrant/Basin/Service) di tab
 * LHUBB untuk baris yang terlanjur ada sebelum kolomnya disisipkan (Sep 2026).
 *
 * Nilai = selisih totalizer hari ini − H-1 dari daily_report_totalizer, dihitung
 * lewat hitungKonsumsiAir() — rumus yang sama dengan mapper saat menulis baris baru,
 * jadi hasil backfill identik dengan yang akan ditulis app. H-1 = tanggal kalender
 * persis sebelumnya, sama seperti route /api/sheets/write.
 *
 *   npx tsx scripts/backfill-konsumsi-rcw-komponen.ts                      → dry-run
 *   npx tsx scripts/backfill-konsumsi-rcw-komponen.ts --write              → terapkan
 *   npx tsx scripts/backfill-konsumsi-rcw-komponen.ts --sejak=2026-07-01   → batas awal (default)
 *   npx tsx scripts/backfill-konsumsi-rcw-komponen.ts --sampai=2026-09-22  → batas akhir (default: kemarin WIB)
 *   npx tsx scripts/backfill-konsumsi-rcw-komponen.ts --write --timpa      → timpa sel yang berisi angka berbeda
 *
 * Aman diulang: sel kosong diisi, sel yang sudah berisi angka sama dilewati, sel
 * berisi angka berbeda hanya dilaporkan kecuali --timpa (isi lama dicadangkan ke JSON).
 * Tanpa pembanding H-1 → sel dibiarkan, sama seperti mapper (bukan ditulis 0).
 */
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) {
        const k = t.slice(0, eq).trim();
        let v = t.slice(eq + 1).trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        if (!process.env[k]) process.env[k] = v;
    }
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const TAB = 'LHUBB';
const WRITE = process.argv.includes('--write');
const TIMPA = process.argv.includes('--timpa');
const arg = (nama: string) => process.argv.find(a => a.startsWith(`--${nama}=`))?.split('=')[1];

/** Geser tanggal ISO sejumlah hari (UTC murni, tak bergeser di mesin mana pun). */
const geserHari = (iso: string, n: number): string => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const hariIniWib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

const SEJAK = arg('sejak') ?? '2026-07-01';
// Default kemarin: baris hari ini masih sedang diisi LHUBB-nya malam nanti.
const SAMPAI = arg('sampai') ?? geserHari(hariIniWib, -1);

const KOLOM = [
    { huruf: 'DQ', kunci: 'konsumsi_hydrant' },
    { huruf: 'DR', kunci: 'konsumsi_basin' },
    { huruf: 'DS', kunci: 'konsumsi_service' },
] as const;

async function main() {
    const { fromIndonesianDate } = await import('../lib/google-sheets');
    const { hitungKonsumsiAir } = await import('../lib/konsumsi-baseline');

    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
        scopes: [WRITE
            ? 'https://www.googleapis.com/auth/spreadsheets'
            : 'https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Tanggal dibaca terformat ("01 Juli 2026"), angka DQ–DT mentah (tanpa pemisah ribuan).
    const [tglRes, airRes] = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${TAB}!B6:B`, valueRenderOption: 'FORMATTED_VALUE' }),
        sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${TAB}!DQ6:DT`, valueRenderOption: 'UNFORMATTED_VALUE' }),
    ]);
    const tanggalCol = (tglRes.data.values ?? []) as string[][];
    const airCol = (airRes.data.values ?? []) as (string | number)[][];

    // ── Totalizer dari Supabase (mulai H-1 dari batas awal) ──
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data, error } = await supabase
        .from('daily_reports')
        .select('date, daily_report_totalizer(tot_hydrant, tot_basin, tot_service)')
        .gte('date', geserHari(SEJAK, -1)).lte('date', SAMPAI);
    if (error) throw error;

    type Tot = { tot_hydrant: number | null; tot_basin: number | null; tot_service: number | null };
    const totPerTanggal = new Map<string, Tot>();
    for (const r of (data ?? []) as unknown as { date: string; daily_report_totalizer: Tot | Tot[] | null }[]) {
        // Relasi one-to-one: PostgREST bisa mengembalikan objek atau array.
        const rel = r.daily_report_totalizer;
        const tot = Array.isArray(rel) ? rel[0] : rel;
        if (tot) totPerTanggal.set(r.date, tot);
    }

    console.log(`tab "${TAB}", ${tanggalCol.length} baris terbaca. Mode: ${WRITE ? 'TULIS' : 'DRY-RUN'}${TIMPA ? ' +TIMPA' : ''}, rentang ${SEJAK} s/d ${SAMPAI}\n`);

    const tulis: { range: string; values: number[][] }[] = [];
    const cadangan: { range: string; tanggal: string; kolom: string; sebelum: string | number; sesudah: number }[] = [];
    const hitung = { kosongDiisi: 0, sudahSama: 0, beda: 0, ditimpa: 0, tanpaData: 0, rcwTakCocok: 0 };

    for (let i = 0; i < tanggalCol.length; i++) {
        const sheetRow = i + 6;
        const iso = fromIndonesianDate((tanggalCol[i]?.[0] ?? '').trim());
        if (!iso || iso < SEJAK || iso > SAMPAI) continue;

        const kons = hitungKonsumsiAir(totPerTanggal.get(iso), totPerTanggal.get(geserHari(iso, -1)));
        const sel = airCol[i] ?? [];
        const jejak: string[] = [];

        for (const [j, { huruf, kunci }] of KOLOM.entries()) {
            const nilai = kons[kunci];
            const lama = sel[j] ?? '';
            const kosong = String(lama).trim() === '';
            if (nilai === null) { hitung.tanpaData++; jejak.push(`${huruf}: tanpa H-1`); continue; }
            if (kosong) {
                tulis.push({ range: `${TAB}!${huruf}${sheetRow}`, values: [[nilai]] });
                hitung.kosongDiisi++;
                jejak.push(`${huruf}: ${nilai}`);
            } else if (Number(lama) === nilai) {
                hitung.sudahSama++;
                jejak.push(`${huruf}: sudah ${lama}`);
            } else {
                hitung.beda++;
                if (TIMPA) {
                    const range = `${TAB}!${huruf}${sheetRow}`;
                    tulis.push({ range, values: [[nilai]] });
                    cadangan.push({ range, tanggal: iso, kolom: huruf, sebelum: lama, sesudah: nilai });
                    hitung.ditimpa++;
                    jejak.push(`${huruf}: ${lama} → ${nilai} (TIMPA)`);
                } else {
                    jejak.push(`${huruf}: BEDA sheet=${lama} db=${nilai}`);
                }
            }
        }

        // Cek silang: komponen harus menjumlah ke Konsumsi RCW (DT) yang sudah ada.
        const dt = sel[3];
        if (kons.konsumsi_rcw !== null && dt !== undefined && String(dt).trim() !== '' && Number(dt) !== kons.konsumsi_rcw) {
            hitung.rcwTakCocok++;
            jejak.push(`⚠ DT sheet=${dt} ≠ jumlah komponen ${kons.konsumsi_rcw}`);
        }

        console.log(`baris ${String(sheetRow).padStart(5)} | ${iso} | ${jejak.join(', ')}`);
    }

    console.log(`\n${tulis.length} sel akan ditulis — ${hitung.kosongDiisi} sel kosong diisi, ${hitung.ditimpa} ditimpa.`);
    console.log(`${hitung.sudahSama} sel sudah benar, ${hitung.beda} sel berisi angka berbeda${TIMPA ? '' : ' (dilewati; pakai --timpa)'}, ${hitung.tanpaData} sel tanpa pembanding H-1.`);
    console.log(`${hitung.rcwTakCocok} baris dengan DT ≠ hydrant + basin + service.`);
    if (!WRITE) {
        console.log('DRY-RUN — tidak ada yang ditulis. Jalankan ulang dengan --write untuk menerapkan.');
        return;
    }
    if (tulis.length === 0) return;

    if (cadangan.length > 0) {
        const berkas = `konsumsi-rcw-komponen-cadangan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        writeFileSync(berkas, JSON.stringify(cadangan, null, 2), 'utf-8');
        console.log(`cadangan isi lama ditulis ke ${berkas}`);
    }

    // Sheets membatasi ukuran request; potong per 200 sel.
    for (let i = 0; i < tulis.length; i += 200) {
        const batch = tulis.slice(i, i + 200);
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { valueInputOption: 'RAW', data: batch },
        });
        console.log(`  ditulis ${i + batch.length}/${tulis.length} sel`);
    }
    console.log('selesai.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
