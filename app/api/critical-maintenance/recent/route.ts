/**
 * GET /api/critical-maintenance/recent — daftar record critical + maintenance (gabung,
 * terurut tanggal terbaru dulu). Satu-satunya daftar di viewer.
 *   ?kind=all|critical|maintenance
 *   ?q=<kata kunci>   cocok di nama item / kode / uraian / notifikasi
 *   ?page=1&pageSize=20
 * Tiap entri punya itemKey untuk navigasi ke halaman item saat diklik.
 *
 * Dilayani dari cermin Postgres (lib/critical-sheet-db.ts), bukan dari spreadsheet:
 * satu halaman ±7 KB, bukan 8,75 MB yang dulu dimuat ke memori lambda tiap request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryRecentFeed } from '@/lib/critical-sheet-db';

const MAX_PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
    try {
        const params = req.nextUrl.searchParams;
        const kindParam = params.get('kind');
        const kind = kindParam === 'critical' || kindParam === 'maintenance' ? kindParam : 'all';
        const q = (params.get('q') ?? '').trim();
        const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(params.get('pageSize') ?? '20', 10) || 20));

        const hasil = await queryRecentFeed({ kind, q, page, pageSize });

        return NextResponse.json(hasil, {
            // `t` (cache-buster) hanya dikirim setelah "Perbarui data": saat itu jawaban
            // lama justru yang tidak boleh dipakai, jadi CDN dilewati sepenuhnya.
            headers: {
                'Cache-Control': params.get('t')
                    ? 'no-store'
                    : 's-maxage=30, stale-while-revalidate=120',
            },
        });
    } catch (err) {
        console.error('[critical-maintenance/recent]', err);
        const message = err instanceof Error ? err.message : 'Gagal memuat aktivitas terbaru';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
