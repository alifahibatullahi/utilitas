/**
 * GET /api/critical-maintenance/item?key=<itemKey> — detail satu item:
 * seluruh riwayat critical & maintenance untuk item+varian itu (dua list terpisah,
 * tidak dihubungkan). Kecil karena difilter per item.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadCriticalSheet, getItemDetail } from '@/lib/critical-sheet';

export async function GET(req: NextRequest) {
    try {
        const key = (req.nextUrl.searchParams.get('key') ?? '').trim();
        if (!key) {
            return NextResponse.json({ error: 'Parameter key wajib' }, { status: 400 });
        }

        const data = await loadCriticalSheet();
        const detail = getItemDetail(data, key);
        if (!detail) {
            return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ ...detail, fetchedAt: data.fetchedAt }, {
            headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=120' },
        });
    } catch (err) {
        console.error('[critical-maintenance/item]', err);
        const message = err instanceof Error ? err.message : 'Gagal memuat detail item';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
