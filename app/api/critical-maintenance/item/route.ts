/**
 * GET /api/critical-maintenance/item?key=<itemKey>&page=&pageSize= — SATU HALAMAN riwayat
 * satu item (critical & maintenance, dua list terpisah dan tidak dihubungkan), ditambah
 * hitungan total dan baris berfotonya untuk galeri sidebar.
 *
 * Berhalaman sejak Agt 2026: memulangkan seluruh riwayat sekaligus berarti 679 KB untuk
 * item tersibuk, dan halaman ini dimuat di belakang pop up upload foto.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryItemDetail } from '@/lib/critical-sheet-db';

export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams;
        const key = (sp.get('key') ?? '').trim();
        if (!key) {
            return NextResponse.json({ error: 'Parameter key wajib' }, { status: 400 });
        }

        const page = Number(sp.get('page'));
        const pageSize = Number(sp.get('pageSize'));
        const detail = await queryItemDetail(key, {
            page: Number.isFinite(page) ? page : undefined,
            pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
        });
        if (!detail) {
            return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ ...detail, fetchedAt: new Date().toISOString() }, {
            headers: {
                'Cache-Control': req.nextUrl.searchParams.get('t')
                    ? 'no-store'
                    : 's-maxage=30, stale-while-revalidate=120',
            },
        });
    } catch (err) {
        console.error('[critical-maintenance/item]', err);
        const message = err instanceof Error ? err.message : 'Gagal memuat detail item';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
