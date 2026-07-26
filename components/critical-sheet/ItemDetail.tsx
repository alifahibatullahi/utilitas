'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemDetailResponse, SheetPhoto } from './types';
import { fetchItemDetail, fetchSheetPhotos } from './types';
import { SheetStatusBadge, SheetScopeBadge, SheetKindBadge, kindRailClass } from './SheetBadges';
import ItemSpecSection from './ItemSpecSection';
import ItemPhotoGallery, { type PhotoRecordSource } from './ItemPhotoGallery';
import RecordPhotoModal, { type PhotoRecordTarget } from './RecordPhotoModal';
import PhotoButton from './PhotoButton';

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
    const [photos, setPhotos] = useState<SheetPhoto[]>([]);
    const [openUid, setOpenUid] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchItemDetail(itemKey)
            .then(d => { if (!cancelled) setData(d); })
            .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [itemKey, reloadKey]);

    /**
     * Riwayat item = SATU daftar gabungan critical + maintenance, terbaru dulu.
     * Dipakai sekaligus sebagai sumber label galeri foto dan target upload, supaya
     * tabel dan galeri tidak pernah berbeda isi.
     */
    const records = useMemo<ItemRecord[]>(() => {
        if (!data) return [];
        const merged: ItemRecord[] = [
            ...data.criticals.map(c => ({
                uid: c.uid, kind: 'critical' as const, tanggal: c.tanggal, tanggalRaw: c.tanggalRaw,
                uraian: c.uraian, variant: c.varian, pelapor: c.pelapor, scope: c.scope, status: c.status,
                meta: [c.pelapor ? `Pelapor: ${c.pelapor}` : '', c.notif ? `Notif ${c.notif}` : ''].filter(Boolean).join(' · '),
                extra: c.tanggalOkRaw ? `OK: ${c.tanggalOkRaw}` : '',
            })),
            ...data.maintenances.map(m => ({
                uid: m.uid, kind: 'maintenance' as const, tanggal: m.tanggal, tanggalRaw: m.tanggalRaw,
                uraian: m.uraian, variant: m.varian, pelapor: '', scope: m.scope, status: m.status,
                meta: [m.shift ? `Shift ${m.shift}` : '', m.foreman ? `Foreman: ${m.foreman}` : '',
                    m.notifikasi ? `Notif ${m.notifikasi}` : ''].filter(Boolean).join(' · '),
                extra: '',
            })),
        ].filter(r => r.uid);
        // Terbaru dulu; baris tanpa tanggal yang bisa dibaca ditaruh paling akhir.
        merged.sort((a, b) => {
            if (a.tanggal && b.tanggal) return b.tanggal.localeCompare(a.tanggal);
            if (a.tanggal) return -1;
            if (b.tanggal) return 1;
            return 0;
        });
        return merged;
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
            variant: src.variant,
            tanggalRaw: src.tanggalRaw,
            uraian: src.uraian,
            pelapor: src.pelapor,
            scope: src.scope,
            status: src.status,
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
                        {/* Kolom utama: riwayat gabungan critical + maintenance */}
                        <div className="flex-1 min-w-0 w-full space-y-3">
                            <div className="flex items-center gap-3 flex-wrap px-0.5">
                                <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                                    Riwayat ({records.length})
                                </h3>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    {data.criticals.length} critical
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    {data.maintenances.length} maintenance
                                </span>
                            </div>

                            <RecordList
                                rows={records}
                                photoCounts={photoCounts}
                                onOpenPhoto={setOpenUid}
                                emptyText="Belum ada riwayat critical maupun maintenance untuk item ini."
                            />
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

/** Satu baris riwayat item — critical dan maintenance memakai bentuk yang sama supaya
 *  bisa tampil dalam satu tabel; kolom khas tiap tab dilebur ke `meta`/`extra`. */
interface ItemRecord extends PhotoRecordSource {
    tanggal: string | null;
    meta: string;
    extra: string;
}

/** Riwayat gabungan: tabel di layar lebar, kartu di HP. Kolom Foto berdiri sendiri
 *  supaya tombolnya sejajar dan mudah dituju, tidak lagi menyelip di bawah uraian. */
function RecordList({ rows, photoCounts, onOpenPhoto, emptyText }: {
    rows: ItemRecord[];
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
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-neutral-50 border-b border-neutral-200">
                                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500 w-32">Jenis</th>
                                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500 w-28">Tanggal</th>
                                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500 w-36">Status</th>
                                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">Uraian &amp; Catatan</th>
                                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500 w-24 text-right">Foto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {rows.map((r, idx) => (
                                <tr key={r.uid || idx} className="hover:bg-neutral-50 transition-colors align-top">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-8 rounded-full shrink-0 ${kindRailClass(r.kind)}`} />
                                            <SheetKindBadge kind={r.kind} />
                                        </div>
                                    </td>
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
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end">
                                            <PhotoButton count={photoCounts[r.uid] ?? 0} onClick={() => onOpenPhoto(r.uid)} compact />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile kartu */}
            <div className="md:hidden space-y-2">
                {rows.map((r, idx) => (
                    <div key={r.uid || idx} className="flex items-stretch gap-3 border border-neutral-200 rounded-xl bg-white pl-2 pr-3 py-3">
                        <div className={`w-1.5 rounded-full shrink-0 ${kindRailClass(r.kind)}`} />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <SheetKindBadge kind={r.kind} />
                                <span className="text-[11px] font-semibold text-neutral-500">{r.tanggalRaw || '—'}</span>
                                <SheetStatusBadge status={r.status} />
                                <SheetScopeBadge scope={r.scope} />
                            </div>
                            <p className="text-sm text-neutral-700 mt-1">{r.uraian}</p>
                            {(r.meta || r.extra) && (
                                <p className="text-[10px] text-neutral-400 font-semibold mt-0.5">
                                    {[r.meta, r.extra].filter(Boolean).join(' · ')}
                                </p>
                            )}
                            <div className="flex items-center mt-2 pt-2 border-t border-neutral-100">
                                <PhotoButton count={photoCounts[r.uid] ?? 0} onClick={() => onOpenPhoto(r.uid)} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
