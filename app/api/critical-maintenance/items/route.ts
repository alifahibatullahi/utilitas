/**
 * GET /api/critical-maintenance/items — daftar item equipment (registry item-centric).
 * Item = kombinasi unik (Nama dan Nomor Item + Varian) dari kedua tab sheet.
 *   ?q=primary   filter cocok di nama/kode/varian
 *   ?page=1&pageSize=20
 * Respons ramping: hanya halaman yang diminta + total.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadCriticalSheet, buildItemIndex } from '@/lib/critical-sheet';

const MAX_PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
    try {
        const params = req.nextUrl.searchParams;
        const q = (params.get('q') ?? '').trim().toLowerCase();
        const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(params.get('pageSize') ?? '20', 10) || 20));

        const data = await loadCriticalSheet();
        let items = buildItemIndex(data);

        if (q) {
            items = items.filter(it =>
                it.itemName.toLowerCase().includes(q) ||
                it.code.toLowerCase().includes(q) ||
                it.variant.toLowerCase().includes(q),
            );
        }

        const total = items.length;
        const start = (page - 1) * pageSize;

        return NextResponse.json({
            items: items.slice(start, start + pageSize),
            total,
            page,
            pageSize,
            fetchedAt: data.fetchedAt,
        }, {
            headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=120' },
        });
    } catch (err) {
        console.error('[critical-maintenance/items]', err);
        const message = err instanceof Error ? err.message : 'Gagal memuat daftar item';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
