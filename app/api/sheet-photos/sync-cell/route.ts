/**
 * POST /api/sheet-photos/sync-cell — tulis ulang sel "Dokumentasi" satu baris.
 *
 * Penutup satu batch upload. Klien mengunggah berkasnya paralel dengan `sync_cell=0`, lalu
 * memanggil ini SEKALI: selnya ditulis satu kali dengan jumlah akhir, bukan sekali per
 * berkas — dan tidak ada dua penulisan paralel yang bisa saling menimpa dengan hitungan basi.
 *
 * Balas seketika; pekerjaan Sheets-nya jalan setelah respons (after). Gagalnya tidak perlu
 * dilaporkan ke operator: fotonya sudah tersimpan, dan cron menyusul lewat
 * repairMissingPhotoCells.
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { syncPhotoCell } from '@/lib/sheet-photo-sync';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => null);
        const rowUid = String((body as { row_uid?: unknown } | null)?.row_uid ?? '').trim();
        if (!rowUid) {
            return NextResponse.json({ error: 'row_uid wajib diisi' }, { status: 400 });
        }

        after(() => syncPhotoCell(rowUid));
        return NextResponse.json({ ok: true }, { status: 202 });
    } catch (err) {
        console.error('[sheet-photos/sync-cell]', err);
        const message = err instanceof Error ? err.message : 'Gagal menjadwalkan sinkronisasi sel';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
