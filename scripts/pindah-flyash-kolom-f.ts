// Sekali pakai: rapikan baris LAMA di sheet Catatan yang baris fly ash / solar-nya
// terlanjur nyangkut di kolom D (Operasional), padahal sheet punya kolom sendiri —
// F = Unloading Fly Ash, G = In-Out Solar. Sejak upsertCatatanOperasional menulis
// D/F/G terpisah, baris BARU sudah benar; skrip ini hanya membenahi yang terlanjur.
//
//   npx tsx scripts/pindah-flyash-kolom-f.ts                   → dry-run
//   npx tsx scripts/pindah-flyash-kolom-f.ts --write           → terapkan
//   npx tsx scripts/pindah-flyash-kolom-f.ts --sejak=2020-01-01 → ikutkan baris lama
//
// Default hanya baris sejak 2026-01-01 (era aplikasi menulis catatan). Baris yang
// lebih tua diketik tangan operator jauh sebelum fitur ini ada — sengaja dibiarkan
// sebagai arsip, keputusan user.
//
// Aman diulang: partisi memakai partisiCatatanPerKolom yang sama dengan runtime,
// dan penempatan ke F/G lewat mergeCatatanCell sehingga isian manusia di sana tidak
// tertimpa dan baris yang sudah ada tidak didobel.
import { readFileSync, writeFileSync } from 'fs';
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
const WRITE = process.argv.includes('--write');
const SEJAK = (process.argv.find(a => a.startsWith('--sejak='))?.split('=')[1] ?? '2026-01-01');

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
        private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    },
    scopes: [WRITE ? 'https://www.googleapis.com/auth/spreadsheets' : 'https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

/** Buang penanda supaya isi sel bisa dibandingkan sebagai teks biasa. */
const bersih = (s: string) => s.replace(/[⁠​‌]/g, '');

async function main() {
    const { klasifikasiBarisCatatan } = await import('../lib/shift-catatan');
    // parseCatatanSheetDate & stripCatatanMarkers dipakai bersama runtime —
    // satu penafsir tanggal dan satu definisi penanda saja.
    const { mergeCatatanCell, parseCatatanSheetDate, stripCatatanMarkers } = await import('../lib/google-sheets');

    const meta = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        fields: 'sheets.properties(sheetId,title)',
    });
    const tab = meta.data.sheets?.find(s => s.properties?.sheetId === GID)?.properties?.title;
    if (!tab) throw new Error(`Tab gid=${GID} tidak ditemukan`);
    const q = `'${tab.replace(/'/g, "''")}'`;

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${q}!B1:H`,
        valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values ?? []) as string[][];
    console.log(`tab "${tab}", ${rows.length} baris terbaca. Mode: ${WRITE ? 'TULIS' : 'DRY-RUN'}, sejak ${SEJAK}\n`);

    const data: { range: string; values: string[][] }[] = [];
    let terdampak = 0;
    let dilewatiTua = 0;

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const sheetRow = i + 1;
        const D = r[2] ?? '';
        if (!D.trim()) continue;
        // Baris tanpa tanggal yang bisa dibaca (mis. header) ikut dilewati.
        const iso = parseCatatanSheetDate((r[0] ?? '').trim());
        if (!iso || iso < SEJAK) { if (iso) dilewatiTua++; continue; }

        // Saring per baris DI TEMPAT. Sengaja tidak memakai partisiCatatanPerKolom
        // untuk menyusun ulang kolom D: fungsi itu mem-bullet tiap baris, sehingga
        // penanda teks lama ikut jadi "• <Web Laporan UBB>". Dengan menyaring di
        // tempat, sisa isi D — termasuk penandanya, baik zero-width maupun tag lama
        // — tetap utuh apa adanya.
        const simpan: string[] = [];
        const pindah: Record<'flyAsh' | 'solar', string[]> = { flyAsh: [], solar: [] };
        for (const baris of D.split('\n')) {
            const kelas = klasifikasiBarisCatatan(baris);
            if (kelas === 'operasional') simpan.push(baris);
            else pindah[kelas].push(bersih(baris).trim());
        }
        if (!pindah.flyAsh.length && !pindah.solar.length) continue;

        const tujuan: { huruf: string; offset: number; isi: string }[] = [
            { huruf: 'F', offset: 4, isi: pindah.flyAsh.join('\n') },
            { huruf: 'G', offset: 5, isi: pindah.solar.join('\n') },
        ];

        const jejak: string[] = [];
        for (const t of tujuan) {
            if (!t.isi) continue;
            const { next, changed } = mergeCatatanCell(r[t.offset] ?? '', t.isi);
            if (!changed) { jejak.push(`${t.huruf}: sudah ada`); continue; }
            data.push({ range: `${q}!${t.huruf}${sheetRow}`, values: [[next]] });
            jejak.push(`${t.huruf}: +${t.isi.split('\n').length} baris`);
        }

        // Tulis ulang D tanpa baris yang sudah pindah, DAN tanpa penanda blok.
        // Penanda dibuang karena batas blok sudah tidak sahih setelah baris di
        // dalamnya diangkat — penanda pembuka bahkan menempel di awal baris
        // pertama, jadi ikut terbawa saat baris itu dipindah dan menyisakan
        // penutup yatim. Sync berikutnya merakit blok baru sendiri lewat jalur
        // append + dedup per baris di mergeCatatanCell.
        const sisaD = stripCatatanMarkers(simpan.join('\n')).trim();
        data.push({ range: `${q}!D${sheetRow}`, values: [[sisaD]] });
        terdampak++;

        const tgl = (r[0] ?? '').trim();
        const shift = (r[1] ?? '').trim();
        console.log(`baris ${String(sheetRow).padStart(5)} | ${tgl.padEnd(18)} | ${shift.padEnd(6)} | ${jejak.join(', ')}`);
        for (const l of [...pindah.flyAsh, ...pindah.solar]) console.log(`               ${l}`);
        if (!sisaD) {
            console.log('               (kolom D jadi kosong — isinya memang hanya baris pindahan)');
        } else if (!WRITE) {
            // Baris campuran: perlihatkan sisa kolom D supaya bisa dipastikan
            // catatan operasional aslinya tidak ikut terbawa.
            const pratinjau = stripCatatanMarkers(sisaD).replace(/\n/g, ' ⏎ ');
            console.log(`               D tersisa: ${pratinjau.length > 120 ? pratinjau.slice(0, 120) + '…' : pratinjau}`);
        }
    }

    console.log(`\n${terdampak} baris terdampak, ${data.length} sel akan ditulis.`);
    console.log(`${dilewatiTua} baris lebih tua dari ${SEJAK} dilewati (pakai --sejak=YYYY-MM-DD untuk mengikutkannya).`);
    if (!WRITE) {
        console.log('DRY-RUN — tidak ada yang ditulis. Jalankan ulang dengan --write untuk menerapkan.');
        return;
    }
    // Cadangan isi lama sel-sel yang akan disentuh. Google Sheets punya riwayat
    // versi, tapi berkas ini bikin pengembalian jadi sepele kalau ada yang meleset.
    const cadangan = data.map(d => {
        const mm = d.range.match(/!([A-H])(\d+)$/);
        const huruf = mm?.[1] ?? '?';
        const baris = Number(mm?.[2] ?? 0);
        const offset = { B: 0, C: 1, D: 2, E: 3, F: 4, G: 5, H: 6 }[huruf] ?? 0;
        return { range: d.range, baris, kolom: huruf, sebelum: (rows[baris - 1] ?? [])[offset] ?? '', sesudah: d.values[0][0] };
    });
    const berkas = `catatan-cadangan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
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
