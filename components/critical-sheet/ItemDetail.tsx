'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ItemDetailResponse, SheetPhoto } from './types';
import { fetchItemDetail, fetchSheetPhotos } from './types';
import { SheetStatusBadge, SheetScopeBadge } from './SheetBadges';
import SheetPhotoSection from './SheetPhotoSection';
import ItemSpecSection from './ItemSpecSection';

interface ItemDetailProps {
    itemKey: string;
    reloadKey: number;
    onBack: () => void;
}

/** Halaman detail satu item: spesifikasi + riwayat critical + riwayat maintenance
 *  (dua list terpisah), tiap record bisa di-expand untuk foto per record. */
export default function ItemDetail({ itemKey, reloadKey, onBack }: ItemDetailProps) {
    const [data, setData] = useState<ItemDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'critical' | 'maintenance'>('critical');
    const [expandedUid, setExpandedUid] = useState<string | null>(null);
    const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setExpandedUid(null);
        fetchItemDetail(itemKey)
            .then(d => {
                if (cancelled) return;
                setData(d);
                // Default ke tab yang ada isinya.
                setTab(d.criticals.length === 0 && d.maintenances.length > 0 ? 'maintenance' : 'critical');
            })
            .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [itemKey, reloadKey]);

    // Batch-fetch jumlah foto semua record item ini sekali (badge per record).
    const allUids = useMemo(
        () => [...(data?.criticals ?? []), ...(data?.maintenances ?? [])].map(r => r.uid).filter(Boolean),
        [data],
    );
    useEffect(() => {
        if (allUids.length === 0) { setPhotoCounts({}); return; }
        let cancelled = false;
        fetchSheetPhotos(allUids)
            .then((photos: SheetPhoto[]) => {
                if (cancelled) return;
                const counts: Record<string, number> = {};
                for (const p of photos) counts[p.row_uid] = (counts[p.row_uid] ?? 0) + 1;
                setPhotoCounts(counts);
            })
            .catch(() => { /* badge saja yang hilang */ });
        return () => { cancelled = true; };
    }, [allUids]);

    const toggle = (uid: string) => setExpandedUid(prev => (prev === uid ? null : uid));

    return (
        <div className="space-y-4">
            <button
                onClick={onBack}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
            >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                Kembali
            </button>

            {loading && !data ? (
                <div className="py-12 text-center text-sm text-slate-400 font-medium">Memuat item…</div>
            ) : error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 font-medium">{error}</div>
            ) : data && (
                <>
                    {/* Header item */}
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {data.code && <span className="text-[11px] font-bold text-slate-400">{data.code}</span>}
                            {data.variant && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Varian {data.variant}</span>
                            )}
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 leading-tight mt-0.5">{data.itemName}</h2>
                    </div>

                    {/* Spesifikasi */}
                    <ItemSpecSection itemKey={data.key} itemName={data.itemName} variant={data.variant} code={data.code} />

                    {/* Tab riwayat */}
                    <div className="flex rounded-xl bg-slate-200/60 p-1">
                        {([
                            { id: 'critical', label: `Critical (${data.criticals.length})`, icon: 'warning' },
                            { id: 'maintenance', label: `Maintenance (${data.maintenances.length})`, icon: 'build' },
                        ] as const).map(t => (
                            <button
                                key={t.id}
                                onClick={() => { setTab(t.id); setExpandedUid(null); }}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* List record */}
                    {tab === 'critical' ? (
                        <RecordList
                            rows={data.criticals.map(c => ({
                                uid: c.uid, tanggalRaw: c.tanggalRaw, status: c.status, scope: c.scope,
                                uraian: c.uraian, meta: c.pelapor ? `Pelapor: ${c.pelapor}` : '',
                                extra: c.status && c.tanggalOkRaw ? `OK: ${c.tanggalOkRaw}` : '',
                            }))}
                            parentKind="critical"
                            expandedUid={expandedUid}
                            onToggle={toggle}
                            photoCounts={photoCounts}
                            emptyText="Belum ada riwayat critical untuk item ini."
                        />
                    ) : (
                        <RecordList
                            rows={data.maintenances.map(m => ({
                                uid: m.uid, tanggalRaw: m.tanggalRaw, status: m.status, scope: m.scope,
                                uraian: m.uraian, meta: [m.shift, m.foreman ? `Foreman: ${m.foreman}` : ''].filter(Boolean).join(' · '),
                                extra: '',
                            }))}
                            parentKind="maintenance"
                            expandedUid={expandedUid}
                            onToggle={toggle}
                            photoCounts={photoCounts}
                            emptyText="Belum ada riwayat maintenance untuk item ini."
                        />
                    )}
                </>
            )}
        </div>
    );
}

interface RecordRow {
    uid: string;
    tanggalRaw: string;
    status: string;
    scope: string;
    uraian: string;
    meta: string;
    extra: string;
}

function RecordList({ rows, parentKind, expandedUid, onToggle, photoCounts, emptyText }: {
    rows: RecordRow[];
    parentKind: 'critical' | 'maintenance';
    expandedUid: string | null;
    onToggle: (uid: string) => void;
    photoCounts: Record<string, number>;
    emptyText: string;
}) {
    if (rows.length === 0) {
        return <div className="py-8 text-center text-sm text-slate-400 font-medium">{emptyText}</div>;
    }
    return (
        <div className="space-y-2">
            {rows.map((r, idx) => {
                const key = r.uid || `${parentKind}-${idx}`;
                const expanded = expandedUid === r.uid && !!r.uid;
                return (
                    <div key={key} className="border border-slate-100 rounded-xl bg-white overflow-hidden">
                        <button
                            onClick={() => r.uid && onToggle(r.uid)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50/60 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-semibold text-slate-500">{r.tanggalRaw || '—'}</span>
                                <SheetStatusBadge status={r.status} />
                                <SheetScopeBadge scope={r.scope} />
                                {r.meta && <span className="text-[10px] text-slate-400 font-semibold">{r.meta}</span>}
                                {r.extra && <span className="text-[10px] text-slate-400 font-semibold">{r.extra}</span>}
                                {photoCounts[r.uid] > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-500">
                                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>photo_camera</span>
                                        {photoCounts[r.uid]}
                                    </span>
                                )}
                                {r.uid && (
                                    <span className="material-symbols-outlined ml-auto text-slate-300" style={{ fontSize: 18 }}>
                                        {expanded ? 'expand_less' : 'expand_more'}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-700 mt-1">{r.uraian}</p>
                        </button>
                        {expanded && (
                            <div className="px-4 pb-3 pt-1 border-t border-slate-50">
                                <SheetPhotoSection parentKind={parentKind} rowUid={r.uid} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
