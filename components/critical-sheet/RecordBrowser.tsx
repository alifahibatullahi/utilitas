'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RecentEntry } from './types';
import { fetchRecent, fetchSheetPhotos } from './types';
import { kindActiveClass } from './SheetBadges';
import { SheetPagination } from './SheetFilterBar';
import { C, RecordCards, RecordTable, type RecordColumn, type RowActions } from './RecordColumns';
import RecordPhotoModal, { photoTargetOf, type PhotoRecordTarget } from './RecordPhotoModal';

const PAGE_SIZE = 20;

type RecordKind = 'all' | 'critical' | 'maintenance';

interface RecordBrowserProps {
    reloadKey: number;
    onSelect: (key: string) => void;
    onMeta?: (fetchedAt: string) => void;
}

/**
 * Tampilan awal viewer: satu daftar record critical + maintenance (terbaru dulu),
 * berbentuk tabel berkolom mengikuti kolom spreadsheet — tabel di layar lebar,
 * kartu di HP. Tiap baris punya tombol Foto (upload/lihat foto record itu) dan
 * Detail (buka halaman item). Filter jenis + pencarian bebas di atas daftar.
 */
export default function RecordBrowser({ reloadKey, onSelect, onMeta }: RecordBrowserProps) {
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [kind, setKind] = useState<RecordKind>('all');
    const [page, setPage] = useState(1);

    const [recent, setRecent] = useState<RecentEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
    const [openRecord, setOpenRecord] = useState<PhotoRecordTarget | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => { setPage(1); }, [debouncedQ, kind]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        // `bust` hanya terisi setelah "Perbarui data" (reloadKey > 0) — saat itu jawaban
        // CDN yang lama justru yang tidak boleh dipakai. Pemuatan biasa tetap boleh
        // dilayani CDN.
        fetchRecent({ kind, q: debouncedQ, page, pageSize: PAGE_SIZE, bust: reloadKey || undefined })
            .then(res => {
                if (cancelled) return;
                setRecent(res.items); setTotal(res.total); onMeta?.(res.fetchedAt);
            })
            .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQ, kind, page, reloadKey]);

    // Hitungan foto hanya untuk baris yang sedang tampil (≤ PAGE_SIZE uid),
    // bukan seluruh sheet — satu query per halaman.
    useEffect(() => {
        const uids = recent.map(e => e.uid).filter(Boolean);
        if (uids.length === 0) { setPhotoCounts({}); return; }
        let cancelled = false;
        fetchSheetPhotos(uids)
            .then(photos => {
                if (cancelled) return;
                const counts: Record<string, number> = {};
                for (const p of photos) counts[p.row_uid] = (counts[p.row_uid] ?? 0) + 1;
                setPhotoCounts(counts);
            })
            .catch(() => { /* tombol foto tetap tampil dengan hitungan 0 */ });
        return () => { cancelled = true; };
    }, [recent]);

    const handleCountChange = useCallback((uid: string, count: number) => {
        setPhotoCounts(prev => ({ ...prev, [uid]: count }));
    }, []);

    const openPhotoFor = useCallback((entry: RecentEntry) => setOpenRecord(photoTargetOf(entry)), []);

    const rowActionsFor = useCallback((e: RecentEntry): RowActions => ({
        photoCount: photoCounts[e.uid] ?? 0,
        onOpenPhoto: () => openPhotoFor(e),
        onSelect: () => onSelect(e.itemKey),
    }), [photoCounts, openPhotoFor, onSelect]);

    const cols = columnsFor(kind);

    return (
        <div className="space-y-3">
            {/* Pencarian + filter jenis */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" style={{ fontSize: 18 }}>search</span>
                    <input
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="Cari item / kode / uraian / notifikasi…"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-800 placeholder-neutral-400 outline-none focus:ring-2 focus:ring-neutral-400/40 focus:border-neutral-400 transition-all"
                    />
                </div>
                <div className="flex rounded-xl border border-neutral-300 bg-white overflow-hidden shrink-0">
                    {([
                        { id: 'all', label: 'Semua' },
                        { id: 'critical', label: 'Critical' },
                        { id: 'maintenance', label: 'Maintenance' },
                    ] as const).map(k => (
                        <button
                            key={k.id}
                            onClick={() => setKind(k.id)}
                            className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                                kind !== k.id
                                    ? 'text-neutral-500 hover:bg-neutral-50'
                                    : k.id === 'all' ? 'bg-neutral-800 text-white' : kindActiveClass(k.id)
                            }`}
                        >
                            {k.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">{error}</div>
            )}

            {loading && recent.length === 0 ? (
                <div className="py-12 text-center text-sm text-neutral-400 font-medium">Memuat…</div>
            ) : recent.length === 0 ? (
                <div className="py-12 text-center text-sm text-neutral-400 font-medium">
                    {debouncedQ ? 'Tidak ada record yang cocok dengan pencarian.' : 'Belum ada aktivitas.'}
                </div>
            ) : (
                <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
                    <RecordTable entries={recent} cols={cols} rowActionsFor={rowActionsFor} />
                    <RecordCards entries={recent} rowActionsFor={rowActionsFor} />
                </div>
            )}

            <SheetPagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />

            {openRecord && (
                <RecordPhotoModal
                    key={openRecord.uid || `${openRecord.kind}:${openRecord.rowIndex}`}
                    record={openRecord}
                    onClose={() => setOpenRecord(null)}
                    onCountChange={handleCountChange}
                />
            )}
        </div>
    );
}

/** Kolom "Jenis" ikut tampil di mode terfilter juga: nilainya memang seragam, tapi
 *  warnanya yang menandai daftar ini isinya apa saat filter tidak terlihat di layar. */
function columnsFor(kind: RecordKind): RecordColumn[] {
    if (kind === 'critical') return [C.jenis, C.tanggal, C.item, C.uraian, C.notifikasi, C.scope, C.status, C.tanggalOk, C.aksi];
    if (kind === 'maintenance') return [C.jenis, C.tanggal, C.shift, C.item, C.uraian, C.notifikasi, C.scope, C.status, C.aksi];
    return [C.jenis, C.tanggalPlusShift, C.item, C.uraian, C.notifikasi, C.scope, C.statusPlusOk, C.aksi];
}
