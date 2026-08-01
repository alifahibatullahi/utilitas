/**
 * POST /api/critical-maintenance/refresh — segarkan cermin dari Google Sheets
 * (tombol "Perbarui data" dan link `?refresh=1` dari menu spreadsheet).
 *
 * Yang dijalankan adalah syncTail: ujung sheet + seluruh kolom Dokumentasi. Itu sudah
 * mencakup semua yang biasanya dicari operator setelah menekan tombol — baris yang baru
 * saja diketik dan foto yang baru ditempel — dengan ongkos sepersekian pembacaan penuh.
 * `?full=1` memaksa pembacaan penuh, untuk saat baris LAMA yang diubah (mis. Status
 * diisi "OK") perlu segera terlihat.
 *
 * Hasilnya tersimpan di Postgres, jadi berbeda dengan cache in-memory yang dulu:
 * SEMUA instance lambda ikut segar, bukan hanya yang kebetulan menerima request ini.
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncFull, syncTail } from '@/lib/critical-sheet-sync';

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

        const hasil = full ? await syncFull() : await syncTail();
        return NextResponse.json({ ok: true, ...hasil, fetchedAt: new Date().toISOString() });
    } catch (err) {
        console.error('[critical-maintenance/refresh]', err);
        const message = err instanceof Error ? err.message : 'Gagal memuat ulang data sheet';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
