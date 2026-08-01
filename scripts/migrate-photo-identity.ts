/**
 * Pindahkan identitas foto dari kolom "ID" ke sel "Dokumentasi" + sidik jari isi baris.
 *
 * Kenapa perlu: kolom foto baru saja diganti nama ("Link Foto" → "Dokumentasi") dan
 * dipindah (N/L → K/I), dan isi lamanya tidak ikut — semua sel Dokumentasi sekarang
 * KOSONG, jadi tidak ada satu pun baris yang menunjukkan bahwa ia punya foto. Sementara
 * itu kolom ID (sekarang di AA) masih utuh, dan itulah kesempatan terakhir memakainya:
 * setelah ini app berhenti menulis kolom ID dan identitas pindah ke sel Dokumentasi.
 *
 * Yang dikerjakan, per baris yang punya foto:
 *   1. cari barisnya lewat kolom ID di AA;
 *   2. rekam sidik jari isi barisnya ke `sheet_photos` (row_item/varian/uraian/tanggal/index)
 *      — jaring pengaman kalau kelak sel Dokumentasi ikut hilang atau tergeser;
 *   3. tulis sel Dokumentasi baris itu.
 *
 * Aman diulang (idempoten): isi sel dihitung ulang dari `sheet_photos`, bukan ditambal,
 * dan baris yang selnya sudah benar dilewati.
 *
 * MENULIS HANYA sel Dokumentasi. Kolom isian operator dan kolom ID tidak disentuh.
 *
 * Jalankan:  npx tsx scripts/migrate-photo-identity.ts            (uji coba, tidak menulis)
 *            npx tsx scripts/migrate-photo-identity.ts --apply    (benar-benar menulis)
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

// Uji coba adalah DEFAULT: script ini menulis ke dua tempat sekaligus (spreadsheet +
// Supabase), jadi menulis harus disengaja, bukan kelupaan memberi flag.
const APPLY = process.argv.includes('--apply');

interface Target {
    uid: string;
    kind: 'critical' | 'maintenance';
    rowIndex: number;
    item: string;
    varian: string;
    uraian: string;
    tanggalRaw: string;
    /** Isi sel Dokumentasi baris itu SEKARANG ('' = kosong). */
    selSekarang: string;
    jumlahFoto: number;
}

async function main() {
    // Import setelah env terpasang — lib membaca process.env saat dipanggil.
    const { createClient } = await import('@supabase/supabase-js');
    const { loadCriticalSheetFull } = await import('../lib/critical-sheet');
    const { syncPhotoCell } = await import('../lib/sheet-photo-sync');

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    console.log(APPLY ? 'MODE: --apply (menulis)' : 'MODE: uji coba (tidak menulis apa pun)\n');

    const { data: photos, error } = await supabase
        .from('sheet_photos')
        .select('id, parent_kind, row_uid');
    if (error) throw error;

    const perUid = new Map<string, number>();
    for (const p of photos ?? []) {
        const uid = (p.row_uid as string) ?? '';
        if (uid) perUid.set(uid, (perUid.get(uid) ?? 0) + 1);
    }
    console.log(`Foto di Supabase : ${photos?.length ?? 0}`);
    console.log(`Baris ber-foto   : ${perUid.size}\n`);
    if (perUid.size === 0) {
        console.log('Tidak ada yang perlu dipindahkan.');
        return;
    }

    const data = await loadCriticalSheetFull();
    console.log(`Sheet terbaca    : ${data.criticals.length} critical + ${data.maintenances.length} maintenance`);
    console.log(`Kolom Dokumentasi: critical ${fmtCol(data.tabs.critical.photoColIndex)}, `
        + `maintenance ${fmtCol(data.tabs.maintenance.photoColIndex)}`);
    console.log(`Kolom ID (arsip) : critical ${fmtCol(data.tabs.critical.uidColIndex)}, `
        + `maintenance ${fmtCol(data.tabs.maintenance.uidColIndex)}\n`);

    // Peta uid → baris, dari kolom ID. Inilah pemakaian TERAKHIR kolom itu sebagai kunci.
    const byUid = new Map<string, Target>();
    for (const r of data.criticals) {
        if (r.uid) byUid.set(r.uid, { ...pick(r), uid: r.uid, kind: 'critical', jumlahFoto: 0 });
    }
    for (const r of data.maintenances) {
        if (r.uid) byUid.set(r.uid, { ...pick(r), uid: r.uid, kind: 'maintenance', jumlahFoto: 0 });
    }

    const ketemu: Target[] = [];
    const yatim: string[] = [];
    for (const [uid, jumlah] of perUid) {
        const t = byUid.get(uid);
        if (!t) { yatim.push(uid); continue; }
        ketemu.push({ ...t, jumlahFoto: jumlah });
    }

    for (const t of ketemu) {
        const status = t.selSekarang ? 'sel sudah terisi' : 'sel KOSONG → akan ditulis';
        console.log(`• ${t.uid}  (${t.kind}, baris ${t.rowIndex}, ${t.jumlahFoto} foto) — ${status}`);
        console.log(`    item   : ${t.item}${t.varian ? ` [varian ${t.varian}]` : ''}`);
        console.log(`    uraian : ${potong(t.uraian, 90)}`);
        console.log(`    tanggal: ${t.tanggalRaw || '—'}`);
    }

    if (yatim.length) {
        console.log(`\n⛔ ${yatim.length} uid TIDAK ditemukan di kolom ID mana pun: ${yatim.join(', ')}`);
        console.log('    Fotonya tetap tersimpan, tapi tidak ada baris sheet yang bisa dikaitkan.');
        console.log('    Jangan hapus kolom ID sebelum ini beres — periksa manual dulu.');
    }

    if (!APPLY) {
        console.log(`\nUji coba selesai. ${ketemu.length} baris siap dipindahkan.`);
        console.log('Jalankan ulang dengan --apply untuk benar-benar menulis.');
        return;
    }

    console.log('\n─── Menulis ───');
    let ok = 0;
    // Berurutan, bukan paralel: tiap sel = satu values.update, dan kuota tulis Sheets
    // (60 write/menit per user) lebih mudah dijaga begini.
    for (const t of ketemu) {
        const { error: upErr } = await supabase
            .from('sheet_photos')
            .update({
                row_item:    t.item,
                row_varian:  t.varian,
                row_uraian:  t.uraian,
                row_tanggal: t.tanggalRaw,
                row_index:   t.rowIndex,
            })
            .eq('row_uid', t.uid);
        if (upErr) {
            console.log(`  ⛔ ${t.uid}: sidik jari gagal disimpan — ${upErr.message}`);
            continue;
        }
        await syncPhotoCell(t.uid);
        console.log(`  ✓ ${t.uid} — sidik jari tersimpan, sel Dokumentasi disegarkan`);
        ok++;
    }

    console.log(`\nSelesai: ${ok}/${ketemu.length} baris.`);
    console.log('Periksa hasilnya: npx tsx scripts/check-critical-sheet.ts');
}

function pick(r: { rowIndex: number; item: string; varian: string; uraian: string; tanggalRaw: string; linkFoto: string }) {
    return {
        rowIndex: r.rowIndex,
        item: r.item,
        varian: r.varian,
        uraian: r.uraian,
        tanggalRaw: r.tanggalRaw,
        selSekarang: r.linkFoto,
    };
}

function fmtCol(index0: number | null): string {
    if (index0 === null) return '— tidak ada —';
    let n = index0 + 1;
    let s = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

function potong(v: string, max: number): string {
    const s = (v ?? '').replace(/\s+/g, ' ').trim();
    return s.length > max ? `${s.slice(0, max)}…` : s;
}

main().catch(err => {
    console.error('GAGAL:', err instanceof Error ? err.message : err);
    process.exit(1);
});
