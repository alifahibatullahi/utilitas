// Tulis satu (tanggal, shift) ke sheet Catatan — SERVER-ONLY (memakai googleapis lewat
// lib/google-sheets). Dipakai /api/sheets/write (type catatan_operasional) dan menu
// Kedatangan Batubara di spreadsheet (/api/sheets/kedatangan-batubara).
//
// Shift yang laporannya BELUM ADA tetap ditulis kolom H-nya (kedatangan dari coal_arrivals):
// kedatangan dari menu spreadsheet bisa dicatat sebelum station mana pun menyimpan laporan.
// Barisnya dibuat (B/C + H); D/F/G menyusul saat laporan shift disimpan, karena upsert
// mencocokkan baris lewat tanggal + shift.

import type { SupabaseClient } from '@supabase/supabase-js';
import { upsertCatatanOperasional, type CatatanUpsertResult } from './google-sheets';
import { blokKedatanganShift, getShiftCatatanPerKolom, partisiCatatanPerKolom } from './shift-catatan';
import type { ShiftKey } from './constants';

export async function tulisCatatanShift(
    supabase: SupabaseClient,
    date: string,
    shift: ShiftKey,
): Promise<CatatanUpsertResult> {
    const { data: row, error } = await supabase
        .from('shift_reports')
        .select('date, shift, catatan, station_catatan, shift_coal_bunker(*)')
        .eq('date', date)
        .eq('shift', shift)
        .maybeSingle();
    if (error) throw new Error(`shift_reports ${date}/${shift} gagal dibaca: ${error.message}`);

    // Catatan kanonik dari DB (catatan utama + semua station + auto-lines), sudah
    // dipartisi ke kolom sheet-nya: Operasional (D), Unloading Fly Ash (F), In-Out Solar
    // (G), In-Out Batubara (H, dari coal_arrivals — tidak ikut WA). Tanpa laporan: hanya H.
    // Skip-kosong & anti-wipe per kolom ditangani di upsertCatatanOperasional.
    const perKolom = row
        ? await getShiftCatatanPerKolom(supabase, row)
        : partisiCatatanPerKolom('', await blokKedatanganShift(supabase, date, shift));
    if (!row && !perKolom.batubara.trim()) {
        return { action: 'skipped', tab: '', reason: `shift report ${date}/${shift} tidak ditemukan` };
    }
    return upsertCatatanOperasional(date, shift, perKolom);
}
