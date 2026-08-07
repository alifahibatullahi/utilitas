/**
 * Sinkronisasi kolom "Dokumentasi" di spreadsheet setelah jumlah foto satu baris berubah.
 *
 * Dipakai oleh API upload & hapus foto. SELALU best-effort: spreadsheet adalah cermin,
 * bukan sumber kebenaran, jadi gagal menulis sel tidak boleh menggagalkan upload/hapus
 * yang sudah tersimpan di R2 + Supabase.
 */

import { createClient } from '@supabase/supabase-js';
import { writePhotoCell } from './critical-sheet-db';
import type { RowHint } from './critical-sheet';

/**
 * Hitung ulang foto milik `rowUid`, lalu tulis/kosongkan selnya di sheet.
 * Menelan semua error (hanya di-log) — pemanggil tidak perlu try/catch.
 */
export async function syncPhotoCell(rowUid: string): Promise<void> {
    if (!rowUid) return;
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        // Dihitung per JENIS, bukan satu angka: sel Dokumentasi menyebut "3 foto, 1 video",
        // dan record yang isinya video saja tidak boleh berikon kamera foto.
        const { data: media, error } = await supabase
            .from('sheet_photos')
            .select('media_kind')
            .eq('row_uid', rowUid);
        if (error) throw error;
        const video = (media ?? []).filter(m => m.media_kind === 'video').length;
        const count = { foto: (media?.length ?? 0) - video, video };

        // Sidik jari baris ikut diambil: untuk foto PERTAMA sebuah baris, sel Dokumentasi
        // masih kosong, jadi uid-nya belum bisa dipakai mencari barisnya. Sidik jari
        // inilah yang menunjukkan baris mana yang dimaksud (lihat findRowByUid).
        const { data: contoh } = await supabase
            .from('sheet_photos')
            .select('parent_kind, row_index, row_item, row_varian, row_uraian, row_tanggal')
            .eq('row_uid', rowUid)
            .limit(1)
            .maybeSingle();

        const hint: RowHint | null = contoh && contoh.row_item
            ? {
                kind:       contoh.parent_kind as 'critical' | 'maintenance',
                rowIndex:   (contoh.row_index as number | null) ?? null,
                item:       (contoh.row_item as string) ?? '',
                varian:     (contoh.row_varian as string) ?? '',
                uraian:     (contoh.row_uraian as string) ?? '',
                tanggalRaw: (contoh.row_tanggal as string) ?? '',
            }
            : null;

        const written = await writePhotoCell(rowUid, count, hint);
        if (!written) {
            console.warn(`[sheet-photo-sync] baris ${rowUid} atau kolom "Dokumentasi" tidak ditemukan — sel dilewati`);
        }
    } catch (err) {
        console.warn('[sheet-photo-sync] gagal memperbarui sel Dokumentasi:', err instanceof Error ? err.message : err);
    }
}

/**
 * Susulkan sel "Dokumentasi" yang belum sempat ditulis.
 *
 * Penulisan sel sekarang berjalan SETELAH respons upload dikirim (`after`), jadi ada celah
 * kecil: fungsi serverless yang keburu dimatikan meninggalkan foto yang tersimpan tapi
 * selnya masih kosong. Cermin `uid` diisi oleh writePhotoCell di penulisan yang sama, jadi
 * "punya foto tapi uid-nya tidak ada di baris mana pun" tepat menandai celah itu.
 *
 * `max` menjaga baris yang memang sudah DIHAPUS operator dari sheet — yang selamanya tidak
 * akan ketemu — tidak menghabiskan satu tick cron dengan percobaan yang pasti gagal.
 */
export async function repairMissingPhotoCells(max = 5): Promise<{ diperiksa: number; disusulkan: number }> {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: foto, error } = await supabase
        .from('sheet_photos')
        .select('row_uid')
        .order('created_at', { ascending: false })
        .limit(500);
    if (error) throw error;

    const { data: baris, error: barisErr } = await supabase
        .from('critical_sheet_rows')
        .select('uid')
        .neq('uid', '');
    if (barisErr) throw barisErr;

    const tercermin = new Set((baris ?? []).map(r => r.uid as string));
    const tertinggal: string[] = [];
    for (const f of foto ?? []) {
        const uid = f.row_uid as string;
        if (!uid || tercermin.has(uid) || tertinggal.includes(uid)) continue;
        tertinggal.push(uid);
        if (tertinggal.length >= max) break;
    }

    for (const uid of tertinggal) await syncPhotoCell(uid);
    return { diperiksa: (foto ?? []).length, disusulkan: tertinggal.length };
}
