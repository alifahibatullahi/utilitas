'use client';

import { useEffect, useState } from 'react';
import type { SheetItem } from './types';
import { fetchItems } from './types';
import { SheetPagination } from './SheetFilterBar';

const PAGE_SIZE = 20;

interface ItemListProps {
    reloadKey: number;
    onSelect: (item: SheetItem) => void;
    onMeta?: (fetchedAt: string) => void;
}

/** Daftar item equipment (registry) — cari + paginasi. Klik item → detail. */
export default function ItemList({ reloadKey, onSelect, onMeta }: ItemListProps) {
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [page, setPage] = useState(1);

    const [items, setItems] = useState<SheetItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => { setPage(1); }, [debouncedQ]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchItems({ q: debouncedQ, page, pageSize: PAGE_SIZE })
            .then(res => {
                if (cancelled) return;
                setItems(res.items);
                setTotal(res.total);
                onMeta?.(res.fetchedAt);
            })
            .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat daftar item'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQ, page, reloadKey]);

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

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 font-medium">{error}</div>
            )}

            {loading && items.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 font-medium">Memuat daftar item…</div>
            ) : items.length === 0 && !error ? (
                <div className="py-12 text-center text-sm text-slate-400 font-medium">Tidak ada item yang cocok.</div>
            ) : (
                <div className={`space-y-2 transition-opacity ${loading ? 'opacity-50' : ''}`}>
                    {items.map(it => (
                        <button
                            key={it.key}
                            onClick={() => onSelect(it)}
                            className="w-full text-left border border-slate-100 rounded-xl px-4 py-3 bg-white hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
                        >
                            <div className="flex items-center gap-2 flex-wrap">
                                {it.code && <span className="text-[11px] font-bold text-slate-400">{it.code}</span>}
                                {it.variant && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Varian {it.variant}</span>
                                )}
                                {it.lastDate && (
                                    <span className="text-[10px] text-slate-400 font-semibold">Terakhir: {it.lastDate}</span>
                                )}
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
            )}

            <SheetPagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
    );
}
