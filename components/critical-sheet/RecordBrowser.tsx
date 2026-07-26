'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { RecentEntry } from './types';
import { fetchRecent, fetchSheetPhotos } from './types';
import { SheetStatusBadge, SheetScopeBadge, SheetKindBadge, kindRailClass, kindActiveClass } from './SheetBadges';
import { SheetPagination } from './SheetFilterBar';
import PhotoButton from './PhotoButton';
import RecordPhotoModal, { type PhotoRecordTarget } from './RecordPhotoModal';

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
        fetchRecent({ kind, q: debouncedQ, page, pageSize: PAGE_SIZE })
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

    const openPhotoFor = useCallback((entry: RecentEntry) => {
        setOpenRecord({
            uid: entry.uid,
            kind: entry.kind,
            itemKey: entry.itemKey,
            itemName: entry.itemName,
            tanggalRaw: entry.tanggalRaw,
            uraian: entry.uraian,
        });
    }, []);

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
                    key={openRecord.uid}
                    record={openRecord}
                    onClose={() => setOpenRecord(null)}
                    onCountChange={handleCountChange}
                />
            )}
        </div>
    );
}

// ─── Kolom ───────────────────────────────────────────────────────────────────

interface RowActions {
    photoCount: number;
    onOpenPhoto: () => void;
    onSelect: () => void;
}

interface RecordColumn {
    key: string;
    label: string;
    /** Kelas tambahan; dipakai di <th> DAN <td> supaya lebar/alignment konsisten. */
    cellClass?: string;
    render: (e: RecentEntry, a: RowActions) => ReactNode;
}

const dash = <span className="text-neutral-300">—</span>;

/**
 * Deskriptor kolom (bukan tiga tabel tulis tangan). Kolom khas satu tab punya dua
 * varian: kolom sendiri di mode Critical/Maintenance, dan baris kecil menempel di
 * sel Tanggal/Status di mode Semua — supaya tidak ada kolom yang separuh kosong.
 */
const C: Record<string, RecordColumn> = {
    jenis: {
        key: 'jenis', label: 'Jenis', cellClass: 'w-32',
        render: e => (
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-8 rounded-full shrink-0 ${kindRailClass(e.kind)}`} />
                <SheetKindBadge kind={e.kind} />
            </div>
        ),
    },
    tanggal: {
        key: 'tanggal', label: 'Tanggal', cellClass: 'w-28 whitespace-nowrap font-mono text-xs text-neutral-600',
        render: e => e.tanggalRaw || dash,
    },
    tanggalPlusShift: {
        key: 'tanggal', label: 'Tanggal', cellClass: 'w-28 whitespace-nowrap font-mono text-xs text-neutral-600',
        render: e => (
            <>
                {e.tanggalRaw || dash}
                {e.shift && <div className="font-sans text-[10px] font-semibold text-neutral-400">Shift {e.shift}</div>}
            </>
        ),
    },
    shift: {
        key: 'shift', label: 'Shift', cellClass: 'w-20 whitespace-nowrap text-xs font-semibold text-neutral-600',
        render: e => e.shift || dash,
    },
    item: {
        key: 'item', label: 'Nama & Nomor Item', cellClass: 'min-w-[200px]',
        render: e => (
            <>
                <div className="flex items-center gap-2">
                    {e.code && <span className="font-mono text-[11px] font-bold text-neutral-400">{e.code}</span>}
                    {e.variant && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600">Varian {e.variant}</span>
                    )}
                </div>
                <div className="text-sm font-bold text-neutral-800">{e.itemName || dash}</div>
            </>
        ),
    },
    uraian: {
        key: 'uraian', label: 'Uraian', cellClass: 'min-w-[240px]',
        render: e => <p className="text-sm text-neutral-700 line-clamp-3" title={e.uraian}>{e.uraian || dash}</p>,
    },
    notifikasi: {
        key: 'notifikasi', label: 'Notifikasi', cellClass: 'w-32 whitespace-nowrap font-mono text-xs text-neutral-600',
        render: e => e.notifikasi || dash,
    },
    scope: {
        key: 'scope', label: 'Scope', cellClass: 'w-28',
        render: e => e.scope.trim() ? <SheetScopeBadge scope={e.scope} /> : dash,
    },
    status: {
        key: 'status', label: 'Status', cellClass: 'w-32',
        render: e => <SheetStatusBadge status={e.status} />,
    },
    statusPlusOk: {
        key: 'status', label: 'Status', cellClass: 'w-32',
        render: e => (
            <>
                <SheetStatusBadge status={e.status} />
                {e.tanggalOkRaw && <div className="text-[10px] font-semibold text-neutral-400 mt-0.5">OK {e.tanggalOkRaw}</div>}
            </>
        ),
    },
    tanggalOk: {
        key: 'tanggalOk', label: 'Tanggal di OK', cellClass: 'w-28 whitespace-nowrap font-mono text-xs text-neutral-600',
        render: e => e.tanggalOkRaw || dash,
    },
    aksi: {
        key: 'aksi', label: 'Aksi', cellClass: 'w-32 text-right',
        render: (e, a) => (
            <div className="flex items-center justify-end gap-1.5">
                <PhotoButton count={a.photoCount} onClick={a.onOpenPhoto} disabled={!e.uid} compact />
                <button
                    onClick={a.onSelect}
                    className="px-2.5 py-1 rounded-lg bg-neutral-800 text-white text-[11px] font-bold hover:bg-neutral-900 active:scale-95 transition-all cursor-pointer"
                    title="Buka halaman item (riwayat, spesifikasi, semua foto)"
                >
                    Detail
                </button>
            </div>
        ),
    },
};

/** Kolom "Jenis" ikut tampil di mode terfilter juga: nilainya memang seragam, tapi
 *  warnanya yang menandai daftar ini isinya apa saat filter tidak terlihat di layar. */
function columnsFor(kind: RecordKind): RecordColumn[] {
    if (kind === 'critical') return [C.jenis, C.tanggal, C.item, C.uraian, C.notifikasi, C.scope, C.status, C.tanggalOk, C.aksi];
    if (kind === 'maintenance') return [C.jenis, C.tanggal, C.shift, C.item, C.uraian, C.notifikasi, C.scope, C.status, C.aksi];
    return [C.jenis, C.tanggalPlusShift, C.item, C.uraian, C.notifikasi, C.scope, C.statusPlusOk, C.aksi];
}

// ─── Penyaji ─────────────────────────────────────────────────────────────────

/** Tabel record (md+). Shell rounded + overflow-hidden supaya sudut tetap terpotong
 *  saat isinya digeser horizontal di layar sempit. */
function RecordTable({ entries, cols, rowActionsFor }: {
    entries: RecentEntry[];
    cols: RecordColumn[];
    rowActionsFor: (e: RecentEntry) => RowActions;
}) {
    return (
        <div className="hidden md:block bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1060px] text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200">
                            {cols.map(c => (
                                <th key={c.key} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-neutral-500 ${c.cellClass ?? ''}`}>
                                    {c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {entries.map((e, idx) => {
                            const actions = rowActionsFor(e);
                            return (
                                <tr key={e.uid || `${e.kind}-${idx}`} className="hover:bg-neutral-50 transition-colors align-top">
                                    {cols.map(c => (
                                        <td key={c.key} className={`px-4 py-3 ${c.cellClass ?? ''}`}>{c.render(e, actions)}</td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/** Kartu record (HP). Rail warna di kiri = penanda jenis yang sama dengan tabel. */
function RecordCards({ entries, rowActionsFor }: {
    entries: RecentEntry[];
    rowActionsFor: (e: RecentEntry) => RowActions;
}) {
    return (
        <div className="md:hidden space-y-2">
            {entries.map((e, idx) => {
                const actions = rowActionsFor(e);
                const meta = [
                    e.notifikasi && `Notif ${e.notifikasi}`,
                    e.shift && `Shift ${e.shift}`,
                    e.tanggalOkRaw && `OK ${e.tanggalOkRaw}`,
                ].filter(Boolean).join(' · ');
                return (
                    <div
                        key={e.uid || `${e.kind}-${idx}`}
                        className="flex items-stretch gap-3 border border-neutral-200 rounded-xl pl-2 pr-3 py-3 bg-white"
                    >
                        <div className={`w-1.5 rounded-full shrink-0 ${kindRailClass(e.kind)}`} />
                        <div className="min-w-0 flex-1">
                            <button onClick={actions.onSelect} className="w-full text-left cursor-pointer">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <SheetKindBadge kind={e.kind} />
                                    <span className="text-[11px] font-semibold text-neutral-500">{e.tanggalRaw || '—'}</span>
                                    <SheetStatusBadge status={e.status} />
                                    <SheetScopeBadge scope={e.scope} />
                                </div>
                                <p className="text-sm font-bold text-neutral-800 mt-1">
                                    {e.itemName}
                                    {e.variant ? <span className="font-semibold text-neutral-500"> — {e.variant}</span> : null}
                                </p>
                                <p className="text-sm text-neutral-600">{e.uraian}</p>
                                {meta && <p className="text-[10px] font-semibold text-neutral-400 mt-0.5">{meta}</p>}
                            </button>

                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-100">
                                <PhotoButton count={actions.photoCount} onClick={actions.onOpenPhoto} disabled={!e.uid} />
                                <button
                                    onClick={actions.onSelect}
                                    className="ml-auto px-2.5 py-1 rounded-lg bg-neutral-800 text-white text-[11px] font-bold hover:bg-neutral-900 active:scale-95 transition-all cursor-pointer"
                                >
                                    Detail
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
