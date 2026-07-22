'use client';

import { useEffect, useState } from 'react';
import type { RecentEntry, SheetItem } from './types';
import { fetchItems, fetchRecent } from './types';
import { SheetStatusBadge, SheetScopeBadge } from './SheetBadges';
import { SheetPagination } from './SheetFilterBar';

const PAGE_SIZE = 20;

interface ItemBrowserProps {
    reloadKey: number;
    onSelect: (key: string) => void;
    onMeta?: (fetchedAt: string) => void;
}

/**
 * Tampilan awal viewer: feed aktivitas terbaru (critical + maintenance) saat kotak
 * cari kosong; berubah jadi daftar item saat mencari. Klik record/item → halaman item.
 */
export default function ItemBrowser({ reloadKey, onSelect, onMeta }: ItemBrowserProps) {
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [kind, setKind] = useState<'all' | 'critical' | 'maintenance'>('all');
    const [page, setPage] = useState(1);

    const [recent, setRecent] = useState<RecentEntry[]>([]);
    const [items, setItems] = useState<SheetItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const searching = debouncedQ.length > 0;

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => { setPage(1); }, [debouncedQ, kind]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        const req = searching
            ? fetchItems({ q: debouncedQ, page, pageSize: PAGE_SIZE }).then(res => {
                if (cancelled) return;
                setItems(res.items); setTotal(res.total); onMeta?.(res.fetchedAt);
            })
            : fetchRecent({ kind, page, pageSize: PAGE_SIZE }).then(res => {
                if (cancelled) return;
                setRecent(res.items); setTotal(res.total); onMeta?.(res.fetchedAt);
            });
        req.catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searching, debouncedQ, kind, page, reloadKey]);

    return (
        <div className="space-y-3">
            <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }}>search</span>
                <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Cari item / kode equipment…"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-all"
                />
            </div>

            {/* Filter jenis — hanya di mode feed terbaru */}
            {!searching && (
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Aktivitas Terbaru</p>
                    <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden">
                        {([
                            { id: 'all', label: 'Semua' },
                            { id: 'critical', label: 'Critical' },
                            { id: 'maintenance', label: 'Maintenance' },
                        ] as const).map(k => (
                            <button
                                key={k.id}
                                onClick={() => setKind(k.id)}
                                className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                                    kind === k.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                {k.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 font-medium">{error}</div>
            )}

            {loading && recent.length === 0 && items.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 font-medium">Memuat…</div>
            ) : searching ? (
                <ItemResults items={items} loading={loading} onSelect={onSelect} />
            ) : (
                <RecentResults entries={recent} loading={loading} onSelect={onSelect} />
            )}

            <SheetPagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
    );
}

function RecentResults({ entries, loading, onSelect }: {
    entries: RecentEntry[]; loading: boolean; onSelect: (key: string) => void;
}) {
    if (entries.length === 0) {
        return <div className="py-12 text-center text-sm text-slate-400 font-medium">Belum ada aktivitas.</div>;
    }
    return (
        <div className={`space-y-2 transition-opacity ${loading ? 'opacity-50' : ''}`}>
            {entries.map((e, idx) => (
                <button
                    key={e.uid || `${e.kind}-${idx}`}
                    onClick={() => onSelect(e.itemKey)}
                    className="w-full text-left border border-slate-100 rounded-xl px-4 py-3 bg-white hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            e.kind === 'critical' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-blue-50 text-blue-600 border border-blue-200'
                        }`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{e.kind === 'critical' ? 'warning' : 'build'}</span>
                            {e.kind === 'critical' ? 'Critical' : 'Maintenance'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">{e.tanggalRaw || '—'}</span>
                        <SheetStatusBadge status={e.status} />
                        <SheetScopeBadge scope={e.scope} />
                    </div>
                    <p className="text-sm font-bold text-slate-800 mt-1">
                        {e.itemName}
                        {e.variant ? <span className="font-semibold text-slate-500"> — {e.variant}</span> : null}
                    </p>
                    <p className="text-sm text-slate-600">{e.uraian}</p>
                </button>
            ))}
        </div>
    );
}

function ItemResults({ items, loading, onSelect }: {
    items: SheetItem[]; loading: boolean; onSelect: (key: string) => void;
}) {
    if (items.length === 0) {
        return <div className="py-12 text-center text-sm text-slate-400 font-medium">Tidak ada item yang cocok.</div>;
    }
    return (
        <div className={`space-y-2 transition-opacity ${loading ? 'opacity-50' : ''}`}>
            {items.map(it => (
                <button
                    key={it.key}
                    onClick={() => onSelect(it.key)}
                    className="w-full text-left border border-slate-100 rounded-xl px-4 py-3 bg-white hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-2 flex-wrap">
                        {it.code && <span className="text-[11px] font-bold text-slate-400">{it.code}</span>}
                        {it.variant && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Varian {it.variant}</span>
                        )}
                        {it.lastDate && <span className="text-[10px] text-slate-400 font-semibold">Terakhir: {it.lastDate}</span>}
                    </div>
                    <p className="text-sm font-bold text-slate-800 mt-1">{it.itemName}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                            {it.criticalCount} critical
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>build</span>
                            {it.maintenanceCount} maintenance
                        </span>
                    </div>
                </button>
            ))}
        </div>
    );
}
