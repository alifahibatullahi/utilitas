// Sinkron ulang kolom H sheet Catatan setelah tabel coal_arrivals berubah — dipanggil dari
// browser (laporan shift tab Handling & review harian supervisor).
//
// Blok kedatangan di kolom H dirakit SERVER dari tabel (lib/shift-catatan.ts), jadi harus
// dipicu setelah tabelnya benar-benar berubah. Tonase di blok itu KUMULATIF per pengiriman,
// sehingga mengubah satu baris juga menggeser angka di shift-shift SESUDAHNYA yang
// melanjutkan pengiriman yang sama — semuanya ikut ditulis ulang.

import type { SupabaseClient } from '@supabase/supabase-js';
import { rankShift } from './coal-storage';
import type { ShiftKey } from './constants';

/** Picu sync Catatan satu (tanggal, shift) — fire-and-forget, pola sama dgn useShiftReport. */
export function syncCatatanSheet(date: string, shift: string) {
    fetch('/api/sheets/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'catatan_operasional', data: { date, shift } }),
    }).catch(err => console.warn('[coal-arrival-sync] catatan_operasional sync failed:', err));
}

/**
 * Sync kolom H untuk shift `titik` DAN setiap shift yang lebih baru yang punya baris dari
 * salah satu `batchIds`. Gagal membaca daftar shift → cukup shift `titik` saja.
 */
export async function syncCatatanKedatangan(
    supabase: SupabaseClient,
    titik: { date: string; shift: string },
    batchIds: string[],
): Promise<void> {
    const target = new Map<string, { date: string; shift: string }>();
    target.set(`${titik.date}|${titik.shift}`, titik);

    const ids = [...new Set(batchIds.filter(Boolean))];
    if (ids.length > 0) {
        const { data, error } = await supabase.from('coal_arrivals').select('date, shift').in('batch_id', ids);
        if (error) console.warn('[coal-arrival-sync] daftar shift batch gagal dimuat:', error.message);
        const rankTitik = rankShift(titik.date, titik.shift as ShiftKey);
        for (const r of (data ?? []) as { date: string; shift: string }[]) {
            if (rankShift(r.date, r.shift as ShiftKey) > rankTitik) target.set(`${r.date}|${r.shift}`, r);
        }
    }

    for (const t of target.values()) syncCatatanSheet(t.date, t.shift);
}
