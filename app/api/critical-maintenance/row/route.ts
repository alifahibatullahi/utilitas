/**
 * GET /api/critical-maintenance/row?uid=<uid>
 * GET /api/critical-maintenance/row?kind=<critical|maintenance>&row=<n>&sig=<sidik jari>
 *
 * Satu baris saja — dipakai deep-link dari spreadsheet untuk membuka pop up foto record
 * itu SEKETIKA, tanpa menunggu riwayat itemnya termuat. Baris yang belum pernah difoto
 * belum punya uid, jadi jalur nomor baris + sidik jari wajib ada di sini.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryFocusRow } from '@/lib/critical-sheet-db';
import { resolveRowOrRepair } from '@/lib/critical-sheet-sync';

export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams;

        // Pemanasan dari dialog spreadsheet: dipanggil saat dialognya terbuka, supaya fungsi
        // ini sudah bangun ketika operator benar-benar menekan tombolnya sedetik kemudian.
        // Tidak menyentuh database — yang dibayar cuma cold start-nya.
        if (sp.get('warm') === '1') {
            return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
        }

        const uid = (sp.get('uid') ?? '').trim();
        const kindRaw = (sp.get('kind') ?? '').trim();
        const kind = kindRaw === 'critical' || kindRaw === 'maintenance' ? kindRaw : undefined;
        const rowRaw = Number(sp.get('row'));
        const rowIndex = Number.isInteger(rowRaw) && rowRaw > 0 ? rowRaw : undefined;
        const sig = (sp.get('sig') ?? '').trim();

        if (!uid && (!kind || rowIndex === undefined || !sig)) {
            return NextResponse.json(
                { error: 'Butuh uid, atau kind + row + sig' },
                { status: 400 },
            );
        }

        let hasil = await queryFocusRow({ uid: uid || undefined, kind, rowIndex, sig: sig || undefined });

        // Tidak ada di cermin = biasanya baris yang BARU diketik operator, dan itu justru
        // kasus terbanyak. Baca satu baris itu langsung dari sheet (satu panggilan, menuju
        // nomor barisnya) alih-alih menunggu sinkronisasi ekor selesai.
        if (!hasil && kind && rowIndex !== undefined && sig) {
            const diperbaiki = await resolveRowOrRepair(kind, rowIndex, sig, uid || undefined);
            if (diperbaiki) {
                hasil = await queryFocusRow({ uid: uid || undefined, kind, rowIndex, sig });
            }
        }

        if (!hasil) {
            return NextResponse.json(
                { error: 'Baris tidak ditemukan di data web — tekan "Perbarui data" lalu buka lagi dari spreadsheet.' },
                { status: 404, headers: { 'Cache-Control': 'no-store' } },
            );
        }
        if ('ambigu' in hasil) {
            // Isi barisnya kembar persis (mis. dua entri identik di hari yang sama). Menebak
            // di sini berarti menempelkan foto ke baris yang mungkin salah.
            return NextResponse.json(
                {
                    error: `Ada ${hasil.ambigu.length} baris dengan isi persis sama (baris ${hasil.ambigu.map(r => r.rowIndex).join(', ')}) — buka lewat tombol Foto di daftar record.`,
                    kandidat: hasil.ambigu,
                },
                { status: 409, headers: { 'Cache-Control': 'no-store' } },
            );
        }

        // Sengaja tidak di-cache CDN: ini pencarian identitas baris yang baru saja diketik
        // operator, jawaban basi justru yang berbahaya.
        return NextResponse.json({ record: hasil.record }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (err) {
        console.error('[critical-maintenance/row]', err);
        const message = err instanceof Error ? err.message : 'Gagal memuat baris';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
