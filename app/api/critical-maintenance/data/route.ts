/**
 * GET /api/critical-maintenance/data — data viewer critical maintenance.
 * Sumber: Google Sheets (via loader ter-cache 60 detik). Respons di-slice per
 * halaman di server supaya payload ke client kecil (free tier friendly):
 *   ?view=critical|maintenance
 *   ?status=aktif|semua        (aktif = status ≠ OK; default aktif)
 *   ?scope=Mekanik&q=boiler    (filter opsional)
 *   ?refNo=123                 (view=maintenance: hanya yang ter-link ke critical No 123)
 *   ?page=1&pageSize=15
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadCriticalSheet, isStatusDone, type CriticalRow, type MaintenanceRow } from '@/lib/critical-sheet';

const MAX_PAGE_SIZE = 50;

function matchText(q: string, ...fields: string[]): boolean {
    if (!q) return true;
    const needle = q.toLowerCase();
    return fields.some(f => f.toLowerCase().includes(needle));
}

export async function GET(req: NextRequest) {
    try {
        const params = req.nextUrl.searchParams;
        const view = params.get('view') === 'maintenance' ? 'maintenance' : 'critical';
        const status = params.get('status') === 'semua' ? 'semua' : 'aktif';
        const scope = (params.get('scope') ?? '').trim();
        const q = (params.get('q') ?? '').trim();
        const refNoParam = params.get('refNo');
        const refNo = refNoParam && /^\d+$/.test(refNoParam) ? parseInt(refNoParam, 10) : null;
        const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(params.get('pageSize') ?? '15', 10) || 15));

        const data = await loadCriticalSheet();

        let items: (CriticalRow | MaintenanceRow)[];
        if (view === 'critical') {
            items = data.criticals.filter(c =>
                (status === 'semua' || !isStatusDone(c.status)) &&
                (!scope || c.scope === scope) &&
                matchText(q, c.item, c.uraian, c.gabungan, c.varian, c.scope, c.status),
            );
        } else {
            items = data.maintenances.filter(m =>
                (refNo === null || m.refNo === refNo) &&
                (status === 'semua' || !isStatusDone(m.status)) &&
                (!scope || m.scope === scope) &&
                matchText(q, m.item, m.uraian, m.gabungan, m.varian, m.scope, m.status, m.foreman, m.shift),
            );
        }

        // Daftar scope untuk dropdown filter. Data historis berisi ratusan varian
        // teks bebas — kirim hanya 25 tersering supaya dropdown waras & payload kecil.
        const scopeFreq = new Map<string, number>();
        for (const r of (view === 'critical' ? data.criticals : data.maintenances)) {
            if (r.scope) scopeFreq.set(r.scope, (scopeFreq.get(r.scope) ?? 0) + 1);
        }
        const scopes = Array.from(scopeFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 25)
            .map(([s]) => s)
            .sort((a, b) => a.localeCompare(b));

        const total = items.length;
        const start = (page - 1) * pageSize;

        return NextResponse.json({
            view,
            items: items.slice(start, start + pageSize),
            total,
            page,
            pageSize,
            scopes,
            fetchedAt: data.fetchedAt,
        }, {
            headers: {
                // Layer CDN kedua di atas Data Cache 60s — banyak viewer, tetap ringan.
                'Cache-Control': 's-maxage=30, stale-while-revalidate=120',
            },
        });
    } catch (err) {
        console.error('[critical-maintenance/data]', err);
        const message = err instanceof Error ? err.message : 'Gagal memuat data sheet';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
