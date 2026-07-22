/**
 * GET /api/critical-maintenance/recent — feed aktivitas terbaru (critical + maintenance
 * gabung, terurut tanggal terbaru dulu). Tampilan awal viewer.
 *   ?kind=all|critical|maintenance
 *   ?page=1&pageSize=20
 * Tiap entri punya itemKey untuk navigasi ke halaman item saat diklik.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadCriticalSheet, buildRecentFeed } from '@/lib/critical-sheet';

const MAX_PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
    try {
        const params = req.nextUrl.searchParams;
        const kindParam = params.get('kind');
        const kind = kindParam === 'critical' || kindParam === 'maintenance' ? kindParam : 'all';
        const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(params.get('pageSize') ?? '20', 10) || 20));

        const data = await loadCriticalSheet();
        const feed = buildRecentFeed(data, kind);

        const total = feed.length;
        const start = (page - 1) * pageSize;

        return NextResponse.json({
            items: feed.slice(start, start + pageSize),
            total,
            page,
            pageSize,
            fetchedAt: data.fetchedAt,
        }, {
            headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=120' },
        });
    } catch (err) {
        console.error('[critical-maintenance/recent]', err);
        const message = err instanceof Error ? err.message : 'Gagal memuat aktivitas terbaru';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
