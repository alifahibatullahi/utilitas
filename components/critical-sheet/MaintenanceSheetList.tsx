'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SheetMaintenance } from './types';
import { fetchSheetData, fetchSheetPhotos } from './types';
import { SheetStatusBadge, SheetScopeBadge } from './SheetBadges';
import SheetFilterBar, { SheetPagination } from './SheetFilterBar';
import SheetPhotoSection from './SheetPhotoSection';

const PAGE_SIZE = 15;

interface MaintenanceSheetListProps {
    reloadKey: number;
    onMeta?: (fetchedAt: string) => void;
}

/** Riwayat maintenance lengkap dari sheet (termasuk data lama tanpa relasi).
 *  Baris bisa di-expand untuk lihat/upload foto pekerjaan. */
export default function MaintenanceSheetList({ reloadKey, onMeta }: MaintenanceSheetListProps) {
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [status, setStatus] = useState<'aktif' | 'semua'>('semua');
    const [scope, setScope] = useState('');
    const [page, setPage] = useState(1);

    const [items, setItems] = useState<SheetMaintenance[]>([]);
    const [total, setTotal] = useState(0);
    const [scopes, setScopes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
    const [expandedUid, setExpandedUid] = useState<string | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => { setPage(1); }, [debouncedQ, status, scope]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchSheetData<SheetMaintenance>({ view: 'maintenance', status, scope, q: debouncedQ, page, pageSize: PAGE_SIZE })
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

    const pageUids = useMemo(() => items.map(i => i.uid).filter(Boolean), [items]);
    useEffect(() => {
        if (pageUids.length === 0) { setPhotoCounts({}); return; }
        let cancelled = false;
        fetchSheetPhotos(pageUids)
            .then(photos => {
                if (cancelled) return;
                const counts: Record<string, number> = {};
                for (const p of photos) {
                    if (p.parent_kind !== 'maintenance') continue;
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
                placeholder="Cari pekerjaan / item…"
            />

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 font-medium">{error}</div>
            )}

            {loading && items.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 font-medium">Memuat data dari spreadsheet…</div>
            ) : items.length === 0 && !error ? (
                <div className="py-12 text-center text-sm text-slate-400 font-medium">Tidak ada data yang cocok.</div>
            ) : (
                <div className={`space-y-2 transition-opacity ${loading ? 'opacity-50' : ''}`}>
                    {items.map(m => {
                        const key = m.uid || String(m.rowIndex);
                        const expanded = expandedUid === key;
                        return (
                            <div key={key} className="border border-slate-100 rounded-xl bg-white overflow-hidden">
                                <button
                                    onClick={() => setExpandedUid(expanded ? null : key)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50/60 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] font-semibold text-slate-500">{m.tanggalRaw}</span>
                                        {m.shift && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{m.shift}</span>}
                                        <SheetStatusBadge status={m.status} />
                                        <SheetScopeBadge scope={m.scope} />
                                        {m.foreman && <span className="text-[10px] text-slate-400 font-semibold">Foreman: {m.foreman}</span>}
                                        {m.refNo !== null && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-500" title={m.refRaw}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>link</span>
                                                Critical #{m.refNo}
                                            </span>
                                        )}
                                        {photoCounts[m.uid] > 0 && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-500">
                                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>photo_camera</span>
                                                {photoCounts[m.uid]}
                                            </span>
                                        )}
                                        <span className="material-symbols-outlined ml-auto text-slate-300" style={{ fontSize: 18 }}>
                                            {expanded ? 'expand_less' : 'expand_more'}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 mt-1">
                                        {m.item}{m.varian ? <span className="font-semibold text-slate-500"> — {m.varian}</span> : null}
                                    </p>
                                    <p className="text-sm text-slate-600">{m.uraian}</p>
                                </button>
                                {expanded && (
                                    <div className="px-4 pb-3 pt-1 border-t border-slate-50">
                                        <SheetPhotoSection parentKind="maintenance" rowUid={m.uid} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <SheetPagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
    );
}
