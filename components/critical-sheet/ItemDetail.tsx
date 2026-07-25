'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemDetailResponse, SheetPhoto } from './types';
import { fetchItemDetail, fetchSheetPhotos } from './types';
import { SheetStatusBadge, SheetScopeBadge } from './SheetBadges';
import ItemSpecSection from './ItemSpecSection';
import ItemPhotoGallery, { type PhotoRecordSource } from './ItemPhotoGallery';
import RecordPhotoModal, { type PhotoRecordTarget } from './RecordPhotoModal';

interface ItemDetailProps {
    itemKey: string;
    reloadKey: number;
    onBack: () => void;
    /** row_uid dari deep-link `?foto=` (link di sel spreadsheet) — modalnya dibuka otomatis. */
    focusUid?: string | null;
    /** Dipanggil setelah focusUid dipakai, supaya param tidak menempel di URL. */
    onFocusHandled?: () => void;
}

/** Halaman detail satu item (layout 2-kolom): kolom utama = riwayat critical/maintenance
 *  (tab), kolom kanan = spesifikasi (Tech Specs) + galeri foto agregat. */
export default function ItemDetail({ itemKey, reloadKey, onBack, focusUid, onFocusHandled }: ItemDetailProps) {
    const [data, setData] = useState<ItemDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'critical' | 'maintenance'>('critical');
    const [photos, setPhotos] = useState<SheetPhoto[]>([]);
    const [openUid, setOpenUid] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchItemDetail(itemKey)
            .then(d => {
                if (cancelled) return;
                setData(d);
                setTab(d.criticals.length === 0 && d.maintenances.length > 0 ? 'maintenance' : 'critical');
            })
            .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [itemKey, reloadKey]);

    // Record item sebagai sumber label & target upload foto (terbaru dulu).
    const records = useMemo<PhotoRecordSource[]>(() => {
        if (!data) return [];
        return [
            ...data.criticals.map(c => ({ uid: c.uid, kind: 'critical' as const, tanggalRaw: c.tanggalRaw, uraian: c.uraian })),
            ...data.maintenances.map(m => ({ uid: m.uid, kind: 'maintenance' as const, tanggalRaw: m.tanggalRaw, uraian: m.uraian })),
        ].filter(r => r.uid);
    }, [data]);

    const allUids = useMemo(() => records.map(r => r.uid), [records]);

    useEffect(() => {
        if (allUids.length === 0) { setPhotos([]); return; }
        let cancelled = false;
        fetchSheetPhotos(allUids)
            .then(p => { if (!cancelled) setPhotos(p); })
            .catch(() => { if (!cancelled) setPhotos([]); });
        return () => { cancelled = true; };
    }, [allUids]);

    const [countOverride, setCountOverride] = useState<Record<string, number>>({});

    const photoCounts = useMemo(() => {
        const c: Record<string, number> = {};
        for (const p of photos) c[p.row_uid] = (c[p.row_uid] ?? 0) + 1;
        // Modal record adalah sumber terbaru untuk baris yang baru saja diubah.
        return { ...c, ...countOverride };
    }, [photos, countOverride]);

    // Deep-link dari sel spreadsheet: buka modal record begitu datanya siap.
    useEffect(() => {
        if (!focusUid || !data) return;
        const exists = records.some(r => r.uid === focusUid);
        if (exists) setOpenUid(focusUid);
        onFocusHandled?.();
    }, [focusUid, data, records, onFocusHandled]);

    // Record yang sedang dibuka modalnya, lengkap dengan konteks item untuk link & judul.
    const openRecord = useMemo<PhotoRecordTarget | null>(() => {
        if (!openUid || !data) return null;
        const src = records.find(r => r.uid === openUid);
        if (!src) return null;
        return {
            uid: src.uid,
            kind: src.kind,
            itemKey: data.key,
            itemName: data.itemName,
            tanggalRaw: src.tanggalRaw,
            uraian: src.uraian,
        };
    }, [openUid, data, records]);

    const handleCountChange = useCallback((uid: string, count: number) => {
        setCountOverride(prev => ({ ...prev, [uid]: count }));
        // Galeri agregat ikut disegarkan supaya foto baru langsung muncul di sidebar.
        fetchSheetPhotos(records.map(r => r.uid)).then(setPhotos).catch(() => { /* biarkan tampilan lama */ });
    }, [records]);

    return (
        <div className="space-y-4">
            <button
                onClick={onBack}
                className="flex items-center gap-1 text-xs font-bold text-neutral-500 hover:text-neutral-700 cursor-pointer transition-colors"
            >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                Kembali
            </button>

            {loading && !data ? (
                <div className="py-12 text-center text-sm text-neutral-400 font-medium">Memuat item…</div>
            ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">{error}</div>
            ) : data && (
                <>
                    {/* Header item */}
                    <div>
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-neutral-400 font-semibold">
                            <span>Item</span>
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>chevron_right</span>
                            {data.code && <span className="font-mono font-bold text-neutral-500">{data.code}</span>}
                            {data.variant && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600">Varian {data.variant}</span>
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-neutral-900 leading-tight mt-0.5">{data.itemName}</h2>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
                        {/* Kolom utama: riwayat / maintenance log */}
                        <div className="flex-1 min-w-0 w-full space-y-3">
                            <div className="flex rounded-xl bg-neutral-200/60 p-1">
                                {([
                                    { id: 'critical', label: `Critical (${data.criticals.length})`, icon: 'warning' },
                                    { id: 'maintenance', label: `Maintenance (${data.maintenances.length})`, icon: 'build' },
                                ] as const).map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTab(t.id)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            tab === t.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {tab === 'critical' ? (
                                <RecordList
                                    rows={data.criticals.map(c => ({
                                        uid: c.uid, tanggalRaw: c.tanggalRaw, status: c.status, scope: c.scope,
                                        uraian: c.uraian, meta: c.pelapor ? `Pelapor: ${c.pelapor}` : '',
                                        extra: c.status && c.tanggalOkRaw ? `OK: ${c.tanggalOkRaw}` : '',
                                    }))}
                                    photoCounts={photoCounts}
                                    onOpenPhoto={setOpenUid}
                                    emptyText="Belum ada riwayat critical untuk item ini."
                                />
                            ) : (
                                <RecordList
                                    rows={data.maintenances.map(m => ({
                                        uid: m.uid, tanggalRaw: m.tanggalRaw, status: m.status, scope: m.scope,
                                        uraian: m.uraian, meta: [m.shift, m.foreman ? `Foreman: ${m.foreman}` : ''].filter(Boolean).join(' · '),
                                        extra: '',
                                    }))}
                                    photoCounts={photoCounts}
                                    onOpenPhoto={setOpenUid}
                                    emptyText="Belum ada riwayat maintenance untuk item ini."
                                />
                            )}
                        </div>

                        {/* Sidebar kanan: spesifikasi + foto */}
                        <div className="w-full lg:w-80 xl:w-96 shrink-0 space-y-4">
                            <ItemSpecSection itemKey={data.key} itemName={data.itemName} variant={data.variant} code={data.code} />
                            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                                <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 flex items-center gap-1.5 mb-3">
                                    <span className="material-symbols-outlined text-neutral-400" style={{ fontSize: 16 }}>photo_library</span>
                                    Foto
                                </h3>
                                <ItemPhotoGallery photos={photos} records={records} onOpenRecord={setOpenUid} />
                            </div>
                        </div>
                    </div>

                    {openRecord && (
                        <RecordPhotoModal
                            key={openRecord.uid}
                            record={openRecord}
                            onClose={() => setOpenUid(null)}
                            onCountChange={handleCountChange}
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

/** Pintu masuk foto satu record — jalur upload satu-satunya. */
function PhotoButton({ count, onClick }: { count: number; onClick: () => void }) {
    const has = count > 0;
    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                has
                    ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
            }`}
            title={has ? `Lihat ${count} foto record ini` : 'Tambahkan foto untuk record ini'}
        >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                {has ? 'photo_camera' : 'add_a_photo'}
            </span>
            {has ? count : 'Foto'}
        </button>
    );
}

/** Riwayat record: tabel di layar lebar, kartu di HP. */
function RecordList({ rows, photoCounts, onOpenPhoto, emptyText }: {
    rows: RecordRow[];
    photoCounts: Record<string, number>;
    onOpenPhoto: (uid: string) => void;
    emptyText: string;
}) {
    if (rows.length === 0) {
        return <div className="py-8 text-center text-sm text-neutral-400 font-medium">{emptyText}</div>;
    }
    return (
        <>
            {/* Desktop tabel */}
            <div className="hidden md:block bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200">
                            <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500 w-32">Tanggal</th>
                            <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500 w-40">Status</th>
                            <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">Uraian &amp; Catatan</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {rows.map((r, idx) => (
                            <tr key={r.uid || idx} className="hover:bg-neutral-50 transition-colors align-top">
                                <td className="px-4 py-3 font-mono text-xs text-neutral-600 whitespace-nowrap">{r.tanggalRaw || '—'}</td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col items-start gap-1.5">
                                        <SheetStatusBadge status={r.status} />
                                        <SheetScopeBadge scope={r.scope} />
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-sm text-neutral-700">{r.uraian}</p>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        {r.meta && <span className="text-[10px] text-neutral-400 font-semibold">{r.meta}</span>}
                                        {r.extra && <span className="text-[10px] text-neutral-400 font-semibold">{r.extra}</span>}
                                        <PhotoButton count={photoCounts[r.uid] ?? 0} onClick={() => onOpenPhoto(r.uid)} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile kartu */}
            <div className="md:hidden space-y-2">
                {rows.map((r, idx) => (
                    <div key={r.uid || idx} className="border border-neutral-200 rounded-xl bg-white px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold text-neutral-500">{r.tanggalRaw || '—'}</span>
                            <SheetStatusBadge status={r.status} />
                            <SheetScopeBadge scope={r.scope} />
                            {r.meta && <span className="text-[10px] text-neutral-400 font-semibold">{r.meta}</span>}
                            {r.extra && <span className="text-[10px] text-neutral-400 font-semibold">{r.extra}</span>}
                            <PhotoButton count={photoCounts[r.uid] ?? 0} onClick={() => onOpenPhoto(r.uid)} />
                        </div>
                        <p className="text-sm text-neutral-700 mt-1">{r.uraian}</p>
                    </div>
                ))}
            </div>
        </>
    );
}
