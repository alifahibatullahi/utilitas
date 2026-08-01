/**
 * GET /api/critical-maintenance/item?key=<itemKey> — detail satu item:
 * seluruh riwayat critical & maintenance untuk item+varian itu (dua list terpisah,
 * tidak dihubungkan). Kecil karena difilter per item — di database, bukan di memori.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryItemDetail } from '@/lib/critical-sheet-db';

export async function GET(req: NextRequest) {
    try {
        const key = (req.nextUrl.searchParams.get('key') ?? '').trim();
        if (!key) {
            return NextResponse.json({ error: 'Parameter key wajib' }, { status: 400 });
        }

        const detail = await queryItemDetail(key);
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
