/**
 * Sekali pakai: isi kolom CW/CX (Unloading Fly Ash A/B) di tab LHUBB yang masih
 * KOSONG dengan angka — 0 kalau memang tidak ada unloading hari itu.
 *
 * Latar: sampai sekarang app melewatkan nilai nol (form menyimpan null, mapper
 * melewati null) sehingga sel dibiarkan kosong — dan kosong ambigu: "tidak ada
 * unloading" vs "belum diisi". Sejak perubahan di lib/daily-sheets-mapper.ts
 * baris baru selalu berisi angka; skrip ini membereskan baris yang terlanjur.
 *
 *   npx tsx scripts/backfill-flyash-nol.ts                      → dry-run
 *   npx tsx scripts/backfill-flyash-nol.ts --write              → terapkan
 *   npx tsx scripts/backfill-flyash-nol.ts --sejak=2026-08-01   → batas awal (default)
 *   npx tsx scripts/backfill-flyash-nol.ts --sampai=2026-09-19  → batas akhir (default: hari ini WIB)
 *
 * Aman diulang: sel yang SUDAH berisi angka tidak pernah disentuh, dan nilai yang
 * ditulis diambil dari DB (daily_report_stock_tank → agregat ash_unloadings → 0),
 * jadi bukan sekadar menaburkan nol.
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
const arg = (nama: string) => process.argv.find(a => a.startsWith(`--${nama}=`))?.split('=')[1];
const SEJAK = arg('sejak') ?? '2026-08-01';
// Baris bertanggal di masa depan (kalau ada) tidak boleh diisi 0 — datanya memang
// belum terjadi.
const SAMPAI = arg('sampai') ?? new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

async function main() {
    const { fromIndonesianDate } = await import('../lib/google-sheets');
    const { sumAshRitasePerSilo } = await import('../lib/ash-silo-query');

    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
        scopes: [WRITE
            ? 'https://www.googleapis.com/auth/spreadsheets'
            : 'https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Hanya kolom tanggal + CW/CX — jauh lebih kecil dari membaca seluruh baris.
    const res = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_ID,
        ranges: [`${TAB}!B6:B`, `${TAB}!CW6:CX`],
        valueRenderOption: 'FORMATTED_VALUE',
    });
    const tanggalCol = (res.data.valueRanges?.[0].values ?? []) as string[][];
    const ashCol = (res.data.valueRanges?.[1].values ?? []) as string[][];

    // ── Nilai pembanding dari Supabase ──
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const [drRes, ashRes] = await Promise.all([
        supabase
            .from('daily_reports')
            .select('date, daily_report_stock_tank(unloading_fly_ash_a, unloading_fly_ash_b)')
            .gte('date', SEJAK).lte('date', SAMPAI),
        supabase
            .from('ash_unloadings')
            .select('date, silo, ritase')
            .gte('date', SEJAK).lte('date', SAMPAI),
    ]);
    if (drRes.error) throw drRes.error;
    if (ashRes.error) throw ashRes.error;

    const dbStock = new Map<string, { a: number | null; b: number | null }>();
    for (const r of (drRes.data ?? []) as unknown as {
        date: string;
        daily_report_stock_tank: { unloading_fly_ash_a: number | null; unloading_fly_ash_b: number | null }[] | null;
    }[]) {
        const s = (r.daily_report_stock_tank ?? [])[0];
        dbStock.set(r.date, { a: s?.unloading_fly_ash_a ?? null, b: s?.unloading_fly_ash_b ?? null });
    }

    const perTanggal = new Map<string, { silo: string; ritase: number | null }[]>();
    for (const r of (ashRes.data ?? []) as { date: string; silo: string; ritase: number | null }[]) {
        const arr = perTanggal.get(r.date) ?? [];
        arr.push({ silo: r.silo, ritase: r.ritase });
        perTanggal.set(r.date, arr);
    }

    console.log(`tab "${TAB}", ${tanggalCol.length} baris terbaca. Mode: ${WRITE ? 'TULIS' : 'DRY-RUN'}, rentang ${SEJAK} s/d ${SAMPAI}\n`);

    const data: { range: string; values: (string | number)[][] }[] = [];
    const cadangan: { range: string; tanggal: string; kolom: string; sebelum: string; sesudah: number; sumber: string }[] = [];
    const jumlah = { nol: 0, dariDb: 0, dariEntri: 0 };
    let dilewatiTerisi = 0;
    let dilewatiRentang = 0;

    for (let i = 0; i < tanggalCol.length; i++) {
        const sheetRow = i + 6;
        const iso = fromIndonesianDate((tanggalCol[i]?.[0] ?? '').trim());
        if (!iso) continue;
        if (iso < SEJAK || iso > SAMPAI) { dilewatiRentang++; continue; }

        const sel = ashCol[i] ?? [];
        const kosong = (v: string | undefined) => (v ?? '').trim() === '';
        if (!kosong(sel[0]) && !kosong(sel[1])) { dilewatiTerisi++; continue; }

        const stock = dbStock.get(iso);
        const entri = perTanggal.get(iso);
        const agregat = entri ? sumAshRitasePerSilo(entri) : null;

        const nilaiUntuk = (sisi: 'a' | 'b'): { val: number; sumber: string } => {
            const db = sisi === 'a' ? stock?.a : stock?.b;
            if (db != null) return { val: Number(db), sumber: 'db' };
            const agg = sisi === 'a' ? agregat?.A : agregat?.B;
            if (agg) return { val: agg, sumber: 'entri' };
            return { val: 0, sumber: 'nol' };
        };

        const jejak: string[] = [];
        for (const [idx, huruf, sisi] of [[0, 'CW', 'a'], [1, 'CX', 'b']] as const) {
            if (!kosong(sel[idx])) { jejak.push(`${huruf}: sudah ${sel[idx]}`); continue; }
            const { val, sumber } = nilaiUntuk(sisi);
            const range = `${TAB}!${huruf}${sheetRow}`;
            data.push({ range, values: [[val]] });
            cadangan.push({ range, tanggal: iso, kolom: huruf, sebelum: sel[idx] ?? '', sesudah: val, sumber });
            jejak.push(`${huruf}: ${val} (${sumber})`);
            if (sumber === 'db') jumlah.dariDb++;
            else if (sumber === 'entri') jumlah.dariEntri++;
            else jumlah.nol++;
        }

        console.log(`baris ${String(sheetRow).padStart(5)} | ${iso} | ${jejak.join(', ')}`);
    }

    console.log(`\n${data.length} sel akan ditulis — ${jumlah.nol} nol, ${jumlah.dariDb} dari DB, ${jumlah.dariEntri} dari agregat entri shift.`);
    console.log(`${dilewatiTerisi} baris dilewati (CW & CX sudah berisi), ${dilewatiRentang} baris di luar rentang.`);
    if (!WRITE) {
        console.log('DRY-RUN — tidak ada yang ditulis. Jalankan ulang dengan --write untuk menerapkan.');
        return;
    }
    if (data.length === 0) return;

    const berkas = `flyash-nol-cadangan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(berkas, JSON.stringify(cadangan, null, 2), 'utf-8');
    console.log(`cadangan isi lama ditulis ke ${berkas}`);

    // Sheets membatasi ukuran request; potong per 200 sel.
    for (let i = 0; i < data.length; i += 200) {
        const batch = data.slice(i, i + 200);
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { valueInputOption: 'RAW', data: batch },
        });
        console.log(`  ditulis ${i + batch.length}/${data.length} sel`);
    }
    console.log('selesai.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
