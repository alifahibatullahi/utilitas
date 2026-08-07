/**
 * POST /api/critical-maintenance/refresh — segarkan cermin dari Google Sheets
 * (tombol "Perbarui data" dan link `?refresh=1` dari menu spreadsheet).
 *
 * Yang dijalankan adalah syncTail dengan jendela ekor sempit — itu sudah mencakup yang
 * biasanya dicari operator setelah menekan tombol: baris yang baru saja diketik.
 * `?full=1` memaksa pembacaan penuh, untuk saat baris LAMA yang diubah (mis. Status
 * diisi "OK") perlu segera terlihat.
 *
 * Pop up record dari menu spreadsheet TIDAK lagi menunggu ini: barisnya diperbaiki satu per
 * satu lewat /api/critical-maintenance/row (resolveRowOrRepair).
 *
 * Hasilnya tersimpan di Postgres, jadi berbeda dengan cache in-memory yang dulu:
 * SEMUA instance lambda ikut segar, bukan hanya yang kebetulan menerima request ini.
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncFull, syncTail, TAIL_ROWS_INTERAKTIF } from '@/lib/critical-sheet-sync';

/** Pembacaan penuh butuh ±5 detik; beri ruang di atas batas default. */
export const maxDuration = 60;

/**
 * Rem untuk klik beruntun dari banyak operator sekaligus. Dijaga per instance saja —
 * cukup, karena ongkos sebenarnya sudah kecil dan syncTail memang aman diulang.
 */
const MIN_INTERVAL_MS = 15_000;
let terakhir = 0;

export async function POST(req: NextRequest) {
    try {
        const full = req.nextUrl.searchParams.get('full') === '1';
        if (!full && Date.now() - terakhir < MIN_INTERVAL_MS) {
            return NextResponse.json({ ok: true, dilewati: 'baru saja disegarkan' });
        }
        terakhir = Date.now();

        // Jendela ekor sempit: dari sini yang dicari operator hanyalah baris yang baru saja
        // ia ketik. Cron tetap memakai jendela lebarnya sendiri.
        const hasil = full ? await syncFull() : await syncTail(TAIL_ROWS_INTERAKTIF);
        return NextResponse.json({ ok: true, ...hasil, fetchedAt: new Date().toISOString() });
    } catch (err) {
        console.error('[critical-maintenance/refresh]', err);
        const message = err instanceof Error ? err.message : 'Gagal memuat ulang data sheet';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
