'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SheetCritical } from './types';
import { fetchSheetData, fetchSheetPhotos } from './types';
import { SheetStatusBadge, SheetScopeBadge } from './SheetBadges';
import SheetFilterBar, { SheetPagination } from './SheetFilterBar';
import CriticalSheetDetail from './CriticalSheetDetail';

const PAGE_SIZE = 15;

interface CriticalSheetListProps {
    reloadKey: number;
    onMeta?: (fetchedAt: string) => void;
}

/** Daftar critical dari sheet — read-only, filter & paginasi di server. */
export default function CriticalSheetList({ reloadKey, onMeta }: CriticalSheetListProps) {
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [status, setStatus] = useState<'aktif' | 'semua'>('aktif');
    const [scope, setScope] = useState('');
    const [page, setPage] = useState(1);

    const [items, setItems] = useState<SheetCritical[]>([]);
    const [total, setTotal] = useState(0);
    const [scopes, setScopes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
    const [detail, setDetail] = useState<SheetCritical | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => { setPage(1); }, [debouncedQ, status, scope]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchSheetData<SheetCritical>({ view: 'critical', status, scope, q: debouncedQ, page, pageSize: PAGE_SIZE })
            .then(res => {
                if (cancelled) return;
                setItems(res.items);
                setTotal(res.total);
                setScopes(res.scopes);
                onMeta?.(res.fetchedAt);
            })
            .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat data'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQ, status, scope, page, reloadKey]);

    // Jumlah foto — hanya untuk baris di halaman aktif (hemat query Supabase).
    const pageUids = useMemo(() => items.map(i => i.uid).filter(Boolean), [items]);
    useEffect(() => {
        if (pageUids.length === 0) { setPhotoCounts({}); return; }
        let cancelled = false;
        fetchSheetPhotos(pageUids)
            .then(photos => {
                if (cancelled) return;
                const counts: Record<string, number> = {};
                for (const p of photos) {
                    if (p.parent_kind !== 'critical') continue;
                    counts[p.row_uid] = (counts[p.row_uid] ?? 0) + 1;
                }
                setPhotoCounts(counts);
            })
            .catch(() => { /* badge foto saja yang hilang */ });
        return () => { cancelled = true; };
    }, [pageUids]);

    return (
        <div className="space-y-3">
            <SheetFilterBar
                q={q} onQChange={setQ}
                status={status} onStatusChange={setStatus}
                scope={scope} onScopeChange={setScope}
                scopes={scopes}
            />

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 font-medium">{error}</div>
            )}

            {loading && items.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 font-medium">Memuat data dari spreadsheet…</div>
            ) : items.length === 0 && !error ? (
                <div className="py-12 text-center text-sm text-slate-400 font-medium">
                    {status === 'aktif' ? 'Tidak ada critical berstatus aktif. Coba filter "Semua".' : 'Tidak ada data yang cocok.'}
                </div>
            ) : (
                <div className={`space-y-2 transition-opacity ${loading ? 'opacity-50' : ''}`}>
                    {items.map(c => (
                        <button
                            key={c.uid || c.rowIndex}
                            onClick={() => setDetail(c)}
                            className="w-full text-left border border-slate-100 rounded-xl px-4 py-3 bg-white hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
                        >
                            <div className="flex items-center gap-2 flex-wrap">
                                {c.no !== null && <span className="text-[11px] font-bold text-slate-400">#{c.no}</span>}
                                <span className="text-[11px] font-semibold text-slate-500">{c.tanggalRaw}</span>
                                <SheetStatusBadge status={c.status} />
                                <SheetScopeBadge scope={c.scope} />
                                {photoCounts[c.uid] > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-500">
                                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>photo_camera</span>
                                        {photoCounts[c.uid]}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-bold text-slate-800 mt-1">
                                {c.item}{c.varian ? <span className="font-semibold text-slate-500"> — {c.varian}</span> : null}
                            </p>
                            <p className="text-sm text-slate-600">{c.uraian}</p>
                        </button>
                    ))}
                </div>
            )}

            <SheetPagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />

            {detail && <CriticalSheetDetail critical={detail} onClose={() => setDetail(null)} />}
        </div>
    );
}
