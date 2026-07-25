/**
 * Sinkronisasi kolom "Link Foto" di spreadsheet setelah jumlah foto satu baris berubah.
 *
 * Dipakai oleh API upload & hapus foto. SELALU best-effort: spreadsheet adalah cermin,
 * bukan sumber kebenaran, jadi gagal menulis sel tidak boleh menggagalkan upload/hapus
 * yang sudah tersimpan di R2 + Supabase.
 */

import { createClient } from '@supabase/supabase-js';
import { writePhotoCell } from './critical-sheet';

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
        const { count, error } = await supabase
            .from('sheet_photos')
            .select('id', { count: 'exact', head: true })
            .eq('row_uid', rowUid);
        if (error) throw error;

        const written = await writePhotoCell(rowUid, count ?? 0);
        if (!written) {
            console.warn(`[sheet-photo-sync] baris ${rowUid} atau kolom "Link Foto" tidak ditemukan — sel dilewati`);
        }
    } catch (err) {
        console.warn('[sheet-photo-sync] gagal memperbarui sel Link Foto:', err instanceof Error ? err.message : err);
    }
}
