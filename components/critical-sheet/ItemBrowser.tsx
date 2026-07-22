'use client';

import { useEffect, useState } from 'react';
import type { RecentEntry, SheetItem } from './types';
import { fetchItems, fetchRecent } from './types';
import { SheetStatusBadge, SheetScopeBadge } from './SheetBadges';
import { SheetPagination } from './SheetFilterBar';

const PAGE_SIZE = 20;

type View = 'items' | 'recent';

interface ItemBrowserProps {
    reloadKey: number;
    onSelect: (key: string) => void;
    onMeta?: (fetchedAt: string) => void;
}

/**
 * Tampilan awal viewer. Dua mode:
 *  - "Daftar Item" (default): tabel aset (kode/nama + hitungan critical/maintenance + tanggal
 *    terakhir), responsif — tabel di layar lebar, kartu di HP. Search memfilter tabel.
 *  - "Aktivitas Terbaru": feed record critical + maintenance terbaru (all/critical/maintenance).
 * Klik record/item → halaman item.
 */
export default function ItemBrowser({ reloadKey, onSelect, onMeta }: ItemBrowserProps) {
    const [view, setView] = useState<View>('items');
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [kind, setKind] = useState<'all' | 'critical' | 'maintenance'>('all');
    const [page, setPage] = useState(1);

    const [recent, setRecent] = useState<RecentEntry[]>([]);
    const [items, setItems] = useState<SheetItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => { setPage(1); }, [debouncedQ, kind, view]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        const req = view === 'items'
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
    }, [view, debouncedQ, kind, page, reloadKey]);

    return (
        <div className="space-y-3">
            {/* Pemilih mode */}
            <div className="flex rounded-xl bg-neutral-200/60 p-1">
                {([
                    { id: 'items', label: 'Daftar Item', icon: 'inventory_2' },
                    { id: 'recent', label: 'Aktivitas Terbaru', icon: 'history' },
                ] as const).map(v => (
                    <button
                        key={v.id}
                        onClick={() => setView(v.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            view === v.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                        }`}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{v.icon}</span>
                        {v.label}
                    </button>
                ))}
            </div>

            {view === 'items' ? (
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" style={{ fontSize: 18 }}>search</span>
                    <input
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="Cari item / kode equipment…"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-800 placeholder-neutral-400 outline-none focus:ring-2 focus:ring-neutral-400/40 focus:border-neutral-400 transition-all"
                    />
                </div>
            ) : (
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Aktivitas Terbaru</p>
                    <div className="flex rounded-xl border border-neutral-300 bg-white overflow-hidden">
                        {([
                            { id: 'all', label: 'Semua' },
                            { id: 'critical', label: 'Critical' },
                            { id: 'maintenance', label: 'Maintenance' },
                        ] as const).map(k => (
                            <button
                                key={k.id}
                                onClick={() => setKind(k.id)}
                                className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                                    kind === k.id ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:bg-neutral-50'
                                }`}
                            >
                                {k.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">{error}</div>
            )}

            {loading && recent.length === 0 && items.length === 0 ? (
                <div className="py-12 text-center text-sm text-neutral-400 font-medium">Memuat…</div>
            ) : view === 'items' ? (
                <ItemTable items={items} loading={loading} onSelect={onSelect} />
            ) : (
                <RecentResults entries={recent} loading={loading} onSelect={onSelect} />
            )}

            <SheetPagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
    );
}

/** Tabel aset (mockup): responsif — tabel di md+, kartu di HP. */
function ItemTable({ items, loading, onSelect }: {
    items: SheetItem[]; loading: boolean; onSelect: (key: string) => void;
}) {
    if (items.length === 0) {
        return <div className="py-12 text-center text-sm text-neutral-400 font-medium">Tidak ada item yang cocok.</div>;
    }
    return (
        <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
            {/* Desktop: tabel */}
            <div className="hidden md:block bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200">
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-neutral-500">Aset</th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-neutral-500">Aktivitas</th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-neutral-500">Terakhir</th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-neutral-500 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {items.map(it => (
                            <tr key={it.key} className="hover:bg-neutral-50 transition-colors group">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-9 rounded-full shrink-0 ${it.criticalCount > 0 ? 'bg-red-500' : 'bg-neutral-200'}`} />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                {it.code && <span className="font-mono text-[11px] font-bold text-neutral-400">{it.code}</span>}
                                                {it.variant && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600">Varian {it.variant}</span>
                                                )}
                                            </div>
                                            <div className="text-sm font-bold text-neutral-800 group-hover:text-neutral-900 truncate">{it.itemName}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <ActivityCounts critical={it.criticalCount} maintenance={it.maintenanceCount} />
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-neutral-600">{it.lastDate ?? '—'}</td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={() => onSelect(it.key)}
                                        className="px-3 py-1.5 rounded-lg bg-neutral-800 text-white text-[11px] font-bold hover:bg-neutral-900 active:scale-95 transition-all cursor-pointer"
                                    >
                                        Lihat Detail
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile: kartu */}
            <div className="md:hidden space-y-2">
                {items.map(it => (
                    <button
                        key={it.key}
                        onClick={() => onSelect(it.key)}
                        className="w-full text-left flex items-stretch gap-3 border border-neutral-200 rounded-xl px-3 py-3 bg-white hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer"
                    >
                        <div className={`w-1.5 rounded-full shrink-0 ${it.criticalCount > 0 ? 'bg-red-500' : 'bg-neutral-200'}`} />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                {it.code && <span className="font-mono text-[11px] font-bold text-neutral-400">{it.code}</span>}
                                {it.variant && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600">Varian {it.variant}</span>
                                )}
                                {it.lastDate && <span className="text-[10px] text-neutral-400 font-semibold">Terakhir: {it.lastDate}</span>}
                            </div>
                            <p className="text-sm font-bold text-neutral-800 mt-0.5">{it.itemName}</p>
                            <div className="mt-1.5"><ActivityCounts critical={it.criticalCount} maintenance={it.maintenanceCount} /></div>
                        </div>
                        <span className="material-symbols-outlined self-center text-neutral-300" style={{ fontSize: 20 }}>chevron_right</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function ActivityCounts({ critical, maintenance }: { critical: number; maintenance: number }) {
    return (
        <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${critical > 0 ? 'text-red-600' : 'text-neutral-400'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                {critical} critical
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>build</span>
                {maintenance} maintenance
            </span>
        </div>
    );
}

function RecentResults({ entries, loading, onSelect }: {
    entries: RecentEntry[]; loading: boolean; onSelect: (key: string) => void;
}) {
    if (entries.length === 0) {
        return <div className="py-12 text-center text-sm text-neutral-400 font-medium">Belum ada aktivitas.</div>;
    }
    return (
        <div className={`space-y-2 transition-opacity ${loading ? 'opacity-50' : ''}`}>
            {entries.map((e, idx) => (
                <button
                    key={e.uid || `${e.kind}-${idx}`}
                    onClick={() => onSelect(e.itemKey)}
                    className="w-full text-left border border-neutral-200 rounded-xl px-4 py-3 bg-white hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            e.kind === 'critical' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                        }`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{e.kind === 'critical' ? 'warning' : 'build'}</span>
                            {e.kind === 'critical' ? 'Critical' : 'Maintenance'}
                        </span>
                        <span className="text-[11px] font-semibold text-neutral-500">{e.tanggalRaw || '—'}</span>
                        <SheetStatusBadge status={e.status} />
                        <SheetScopeBadge scope={e.scope} />
                    </div>
                    <p className="text-sm font-bold text-neutral-800 mt-1">
                        {e.itemName}
                        {e.variant ? <span className="font-semibold text-neutral-500"> — {e.variant}</span> : null}
                    </p>
                    <p className="text-sm text-neutral-600">{e.uraian}</p>
                </button>
            ))}
        </div>
    );
}
