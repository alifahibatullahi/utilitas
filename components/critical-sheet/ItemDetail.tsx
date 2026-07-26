'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemDetailResponse, RecentEntry, SheetPhoto } from './types';
import { fetchItemDetail, fetchSheetPhotos, itemLabel } from './types';
import ItemSpecSection from './ItemSpecSection';
import ItemPhotoGallery from './ItemPhotoGallery';
import RecordPhotoModal, { type PhotoRecordTarget } from './RecordPhotoModal';
import { C, RecordCards, RecordTable, type RowActions } from './RecordColumns';

/**
 * Kolom riwayat item = kolom daftar awal dikurangi "Nama & Nomor Item" (sudah jadi judul
 * halaman) dan tombol "Detail" (sudah di halaman itemnya). Notifikasi/Scope/Status berdiri
 * sendiri persis seperti di daftar awal; pelapor/foreman/tanggal OK menempel di uraian.
 */
const ITEM_COLS = [C.jenis, C.tanggalPlusShift, C.uraianPlusMeta, C.notifikasi, C.scope, C.status, C.foto];

interface ItemDetailProps {
    itemKey: string;
    reloadKey: number;
    onBack: () => void;
    /** row_uid dari deep-link `?foto=` (link di sel spreadsheet) — modalnya dibuka otomatis. */
    focusUid?: string | null;
    /** Dipanggil setelah focusUid dipakai, supaya param tidak menempel di URL. */
    onFocusHandled?: () => void;
}

/** Halaman detail satu item (layout 2-kolom): kolom utama = SATU tabel riwayat gabungan
 *  critical + maintenance, kolom kanan = spesifikasi (Tech Specs) + galeri foto agregat. */
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
    const records = useMemo<RecentEntry[]>(() => {
        if (!data) return [];
        // Bentuknya sengaja RecentEntry — sama persis dengan daftar awal, supaya kedua
        // halaman bisa memakai satu peta kolom (RecordColumns) dan tidak melenceng.
        const shared = { itemName: data.itemName, code: data.code, itemKey: data.key };
        const merged: RecentEntry[] = [
            ...data.criticals.map(c => ({
                ...shared,
                uid: c.uid, kind: 'critical' as const, tanggal: c.tanggal, tanggalRaw: c.tanggalRaw,
                shift: '', variant: c.varian, uraian: c.uraian, notifikasi: c.notif,
                scope: c.scope, status: c.status, pelapor: c.pelapor, foreman: '',
                tanggalOkRaw: c.tanggalOkRaw,
            })),
            ...data.maintenances.map(m => ({
                ...shared,
                uid: m.uid, kind: 'maintenance' as const, tanggal: m.tanggal, tanggalRaw: m.tanggalRaw,
                shift: m.shift, variant: m.varian, uraian: m.uraian, notifikasi: m.notifikasi,
                scope: m.scope, status: m.status, pelapor: '', foreman: m.foreman,
                tanggalOkRaw: '',
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

    // Tanpa onSelect: tombol "Detail" tidak ada gunanya, halaman itemnya sudah di sini.
    const rowActionsFor = useCallback((e: RecentEntry): RowActions => ({
        photoCount: photoCounts[e.uid] ?? 0,
        onOpenPhoto: () => setOpenUid(e.uid),
    }), [photoCounts]);

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
                        </div>
                        {/* Varian menempel di nama, sama seperti kolom item di daftar awal. */}
                        <h2 className="text-xl font-bold text-neutral-900 leading-tight mt-0.5">{itemLabel(data.itemName, data.variant)}</h2>
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

                            {records.length === 0 ? (
                                <div className="py-8 text-center text-sm text-neutral-400 font-medium">
                                    Belum ada riwayat critical maupun maintenance untuk item ini.
                                </div>
                            ) : (
                                <>
                                    <RecordTable
                                        entries={records}
                                        cols={ITEM_COLS}
                                        rowActionsFor={rowActionsFor}
                                        minWidthClass="min-w-[720px]"
                                    />
                                    <RecordCards entries={records} rowActionsFor={rowActionsFor} showItem={false} />
                                </>
                            )}
                        </div>

                        {/* Sidebar kanan: spesifikasi + foto. Sengaja lebih ramping dari
                            sebelumnya  tabel riwayat di kirinya butuh ruang 7 kolom. */}
                        <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-4">
                            <ItemSpecSection itemKey={data.key} itemName={data.itemName} variant={data.variant} code={data.code} />
                            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                                <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 flex items-center gap-1.5 mb-3">
                                    <span className="material-symbols-outlined text-neutral-400" style={{ fontSize: 16 }}>photo_library</span>
                                    Foto
                                </h3>
                                <ItemPhotoGallery photos={photos} records={records} />
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

