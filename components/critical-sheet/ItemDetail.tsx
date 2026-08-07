'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemDetailResponse, RecentEntry, SheetPhoto } from './types';
import { fetchItemDetail, fetchSheetPhotos, itemLabel } from './types';
import ItemSpecSection from './ItemSpecSection';
import ItemPhotoGallery from './ItemPhotoGallery';
import { SheetPagination } from './SheetFilterBar';
import RecordPhotoModal, { photoTargetOf, type PhotoRecordTarget } from './RecordPhotoModal';
import { C, RecordCards, RecordTable, rowKey, type RowActions } from './RecordColumns';

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
}

/**
 * Berapa record riwayat per halaman. Item tersibuk ("B-02.01 Boiler A/B" varian A) punya
 * 2.395 record = 679 KB kalau dimuat sekaligus, dan halaman ini terbuka di belakang pop up
 * upload foto — persis saat operator sedang mengunggah. Satu halaman ±14 KB.
 */
const PAGE_SIZE = 50;

/**
 * Halaman detail satu item (layout 2-kolom): kolom utama = SATU tabel riwayat gabungan
 * critical + maintenance, kolom kanan = spesifikasi (Tech Specs) + galeri foto.
 *
 * Pemanggil memberi `key={itemKey}` supaya ganti item = remount. Itu yang mengembalikan
 * nomor halaman ke 1; tanpa itu item baru terbuka di nomor halaman milik item sebelumnya,
 * yang bisa saja di luar jangkauannya.
 */
export default function ItemDetail({ itemKey, reloadKey, onBack }: ItemDetailProps) {
    const [data, setData] = useState<ItemDetailResponse | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [photos, setPhotos] = useState<SheetPhoto[]>([]);
    /** Kunci baris yang modalnya terbuka: `kind:rowIndex`, atau uid bila datang dari deep-link. */
    const [openUid, setOpenUid] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchItemDetail(itemKey, { page, pageSize: PAGE_SIZE, bust: reloadKey || undefined })
            .then(d => { if (!cancelled) setData(d); })
            .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [itemKey, page, reloadKey]);

    /**
     * Riwayat item = SATU daftar gabungan critical + maintenance, terbaru dulu.
     * Dipakai sekaligus sebagai sumber label galeri foto dan target upload, supaya
     * tabel dan galeri tidak pernah berbeda isi.
     */
    const records = useMemo<RecentEntry[]>(() => {
        if (!data) return [];
        // Bentuknya sengaja RecentEntry — sama persis dengan daftar awal, supaya kedua
        // halaman bisa memakai satu peta kolom (RecordColumns) dan tidak melenceng.
        const shared = { itemName: data.itemName, code: data.code, itemKey: data.key };
        const merged: RecentEntry[] = [
            ...data.criticals.map(c => ({
                ...shared,
                uid: c.uid, rowIndex: c.rowIndex, sig: c.sig ?? '',
                kind: 'critical' as const, tanggal: c.tanggal, tanggalRaw: c.tanggalRaw,
                shift: '', variant: c.varian, uraian: c.uraian, notifikasi: c.notif,
                scope: c.scope, status: c.status, pelapor: c.pelapor, foreman: '',
                tanggalOkRaw: c.tanggalOkRaw,
            })),
            ...data.maintenances.map(m => ({
                ...shared,
                uid: m.uid, rowIndex: m.rowIndex, sig: m.sig ?? '',
                kind: 'maintenance' as const, tanggal: m.tanggal, tanggalRaw: m.tanggalRaw,
                shift: m.shift, variant: m.varian, uraian: m.uraian, notifikasi: m.notifikasi,
                scope: m.scope, status: m.status, pelapor: '', foreman: m.foreman,
                tanggalOkRaw: '',
            })),
        ];
        // Dulu di sini ada `.filter(r => r.uid)`. Tidak berdampak selama SEMUA baris punya
        // ID, tapi sekarang uid hanya dimiliki baris yang sudah berfoto — filter itu akan
        // menyembunyikan hampir seluruh riwayat item. Riwayat ditampilkan apa adanya.
        // Terbaru dulu; baris tanpa tanggal yang bisa dibaca ditaruh paling akhir.
        merged.sort((a, b) => {
            if (a.tanggal && b.tanggal) return b.tanggal.localeCompare(a.tanggal);
            if (a.tanggal) return -1;
            if (b.tanggal) return 1;
            return 0;
        });
        return merged;
    }, [data]);

    /**
     * Foto hanya ditanyakan untuk baris yang BENAR-BENAR tampil di halaman ini — bukan
     * seluruh riwayat item. Pola yang sama dengan daftar record (RecordBrowser): satu query
     * per halaman, dan yang tidak dilihat tidak diunduh. Baris tanpa uid dipastikan belum
     * berfoto, jadi tak perlu ditanyakan sama sekali.
     */
    const uidsHalaman = useMemo(() => records.map(r => r.uid).filter(Boolean).join(','), [records]);

    useEffect(() => {
        if (!uidsHalaman) { setPhotos([]); return; }
        let cancelled = false;
        fetchSheetPhotos(uidsHalaman.split(','))
            .then(p => { if (!cancelled) setPhotos(p); })
            .catch(() => { if (!cancelled) setPhotos([]); });
        return () => { cancelled = true; };
    }, [uidsHalaman]);

    const [countOverride, setCountOverride] = useState<Record<string, number>>({});

    const photoCounts = useMemo(() => {
        const c: Record<string, number> = {};
        for (const p of photos) c[p.row_uid] = (c[p.row_uid] ?? 0) + 1;
        // Modal record adalah sumber terbaru untuk baris yang baru saja diubah.
        return { ...c, ...countOverride };
    }, [photos, countOverride]);

    // Record yang sedang dibuka modalnya, lengkap dengan konteks item untuk link & judul.
    // Dicari lewat kunci baris (`kind:rowIndex`), bukan uid: baris yang belum berfoto
    // belum punya uid, dan justru baris itulah yang paling sering perlu ditambahi foto.
    const openRecord = useMemo<PhotoRecordTarget | null>(() => {
        if (!openUid || !data) return null;
        const src = records.find(r => rowKey(r) === openUid || (r.uid && r.uid === openUid));
        if (!src) return null;
        // Nama & key item diambil dari halaman ini, bukan dari barisnya: satu record bisa
        // menyangkut beberapa varian, dan yang berlaku di sini adalah varian halaman ini.
        return { ...photoTargetOf(src), itemKey: data.key, itemName: data.itemName };
    }, [openUid, data, records]);

    const handleCountChange = useCallback((uid: string, count: number) => {
        setCountOverride(prev => ({ ...prev, [uid]: count }));
        // Galeri agregat ikut disegarkan supaya foto baru langsung muncul di sidebar.
        fetchSheetPhotos(records.map(r => r.uid)).then(setPhotos).catch(() => { /* biarkan tampilan lama */ });
    }, [records]);

    // Tanpa onSelect: tombol "Detail" tidak ada gunanya, halaman itemnya sudah di sini.
    const rowActionsFor = useCallback((e: RecentEntry): RowActions => ({
        photoCount: photoCounts[e.uid] ?? 0,
        onOpenPhoto: () => setOpenUid(rowKey(e)),
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
                            {/* Hitungannya SELURUH riwayat item, bukan isi halaman ini —
                                itulah angka yang dicari operator saat membuka sebuah item. */}
                            <div className="flex items-center gap-3 flex-wrap px-0.5">
                                <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                                    Riwayat ({data.total})
                                </h3>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    {data.totalCritical} critical
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    {data.totalMaintenance} maintenance
                                </span>
                            </div>

                            {records.length === 0 ? (
                                <div className="py-8 text-center text-sm text-neutral-400 font-medium">
                                    Belum ada riwayat critical maupun maintenance untuk item ini.
                                </div>
                            ) : (
                                // Diredupkan selagi halaman berikutnya datang, bukan diganti
                                // kerangka: isi lama tetap terbaca dan tata letaknya tidak melompat.
                                <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
                                    <RecordTable
                                        entries={records}
                                        cols={ITEM_COLS}
                                        rowActionsFor={rowActionsFor}
                                        minWidthClass="min-w-[720px]"
                                    />
                                    <RecordCards entries={records} rowActionsFor={rowActionsFor} showItem={false} />
                                </div>
                            )}

                            <SheetPagination page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
                        </div>

                        {/* Sidebar kanan: spesifikasi + foto. Sengaja lebih ramping dari
                            sebelumnya — tabel riwayat di kirinya butuh ruang 7 kolom. */}
                        <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-4">
                            <ItemSpecSection itemKey={data.key} itemName={data.itemName} variant={data.variant} code={data.code} />
                            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                                {/* Cakupannya disebut terang-terangan: isinya foto record di
                                    halaman ini saja, bukan seluruh item. Tanpa keterangan itu
                                    galeri yang "menyusut" saat berpindah halaman terbaca
                                    seperti foto yang hilang. */}
                                <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 flex items-center gap-1.5 mb-3">
                                    <span className="material-symbols-outlined text-neutral-400" style={{ fontSize: 16 }}>photo_library</span>
                                    Foto
                                    {data.total > PAGE_SIZE && (
                                        <span className="font-semibold normal-case tracking-normal text-neutral-400">
                                            · halaman ini
                                        </span>
                                    )}
                                </h3>
                                <ItemPhotoGallery photos={photos} records={records} />
                            </div>
                        </div>
                    </div>

                    {openRecord && (
                        <RecordPhotoModal
                            key={openRecord.uid || `${openRecord.kind}:${openRecord.rowIndex}`}
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

