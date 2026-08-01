'use client';

import type { ReactNode } from 'react';
import type { RecentEntry } from './types';
import { itemLabel } from './types';
import { SheetStatusBadge, SheetScopeBadge, SheetKindBadge, kindRailClass } from './SheetBadges';
import PhotoButton from './PhotoButton';

/**
 * Definisi kolom + penyaji tabel/kartu yang DIPAKAI BERSAMA oleh daftar record
 * (RecordBrowser) dan riwayat di halaman item (ItemDetail).
 *
 * Keduanya harus terlihat sama — dulu masing-masing menulis tabelnya sendiri dan
 * pelan-pelan melenceng (kolom Scope menumpuk di satu sisi saja, dst). Sekarang satu
 * peta kolom, tiap halaman cuma memilih daftar kolomnya.
 *
 * Kolom khas satu tab punya dua varian: kolom sendiri (mode terfilter) dan baris kecil
 * yang menempel di sel lain (mode gabungan), supaya tidak ada kolom separuh kosong.
 */

/**
 * Bisakah baris ini dilampiri foto? Punya uid berarti sudah pernah difoto; kalau belum,
 * cukup nomor baris + sidik jari isinya — uid-nya baru lahir saat foto pertama tersimpan.
 * Nyaris selalu true; false hanya ketika cermin sheet belum tersinkron.
 */
export function canPhoto(e: RecentEntry): boolean {
    return Boolean(e.uid) || (e.rowIndex !== undefined && Boolean(e.sig));
}

/**
 * Kunci baris yang stabil untuk React key dan untuk menandai modal mana yang terbuka.
 * Bukan uid: baris yang belum berfoto belum punya uid, dan uid kosong akan membuat
 * seluruh baris semacam itu terlihat sebagai satu record yang sama.
 */
export function rowKey(e: RecentEntry): string {
    return `${e.kind}:${e.rowIndex}`;
}

export interface RowActions {
    photoCount: number;
    onOpenPhoto: () => void;
    /** Buka halaman item. Tidak diisi di halaman item itu sendiri. */
    onSelect?: () => void;
}

export interface RecordColumn {
    key: string;
    label: string;
    /** Kelas tambahan; dipakai di <th> DAN <td> supaya lebar/alignment konsisten. */
    cellClass?: string;
    render: (e: RecentEntry, a: RowActions) => ReactNode;
}

const dash = <span className="text-neutral-300">—</span>;

/** Catatan kecil di bawah uraian: kolomnya tidak ada sendiri, tapi sayang dibuang. */
function metaOf(e: RecentEntry): string {
    return [
        e.pelapor && `Pelapor: ${e.pelapor}`,
        e.foreman && `Foreman: ${e.foreman}`,
        e.tanggalOkRaw && `OK ${e.tanggalOkRaw}`,
    ].filter(Boolean).join(' · ');
}

export const C: Record<string, RecordColumn> = {
    jenis: {
        // Tanpa rail: badge-nya sudah berwarna sendiri, dan 20px yang dihemat di sini
        // dipakai kolom lain supaya tabel tetap muat tanpa scroll horizontal.
        key: 'jenis', label: 'Jenis', cellClass: 'w-20',
        render: e => <SheetKindBadge kind={e.kind} />,
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
        key: 'item', label: 'Nama & Nomor Item', cellClass: 'min-w-[180px]',
        // Satu baris saja: kode equipment sudah terkandung di nama itemnya, dan varian
        // menempel di belakang nama — chip terpisah dulu memakan lebar tabel.
        render: e => <div className="text-sm font-bold text-neutral-800">{itemLabel(e.itemName, e.variant) || dash}</div>,
    },
    uraian: {
        key: 'uraian', label: 'Uraian', cellClass: 'min-w-[180px]',
        render: e => <p className="text-sm text-neutral-700 line-clamp-3" title={e.uraian}>{e.uraian || dash}</p>,
    },
    uraianPlusMeta: {
        key: 'uraian', label: 'Uraian', cellClass: 'min-w-[180px]',
        render: e => {
            const meta = metaOf(e);
            return (
                <>
                    <p className="text-sm text-neutral-700 line-clamp-3" title={e.uraian}>{e.uraian || dash}</p>
                    {meta && <p className="text-[10px] text-neutral-400 font-semibold mt-0.5">{meta}</p>}
                </>
            );
        },
    },
    notifikasi: {
        key: 'notifikasi', label: 'Notif', cellClass: 'w-28 whitespace-nowrap font-mono text-xs text-neutral-600',
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
        key: 'tanggalOk', label: 'Tgl di OK', cellClass: 'w-24 whitespace-nowrap font-mono text-xs text-neutral-600',
        render: e => e.tanggalOkRaw || dash,
    },
    /** Halaman item: cuma foto — tombol "Detail" tidak ada gunanya di halaman itu sendiri. */
    foto: {
        key: 'foto', label: 'Foto', cellClass: 'w-20 text-right',
        render: (e, a) => (
            <div className="flex justify-end">
                <PhotoButton count={a.photoCount} onClick={a.onOpenPhoto} disabled={!canPhoto(e)} compact />
            </div>
        ),
    },
    aksi: {
        key: 'aksi', label: 'Aksi', cellClass: 'w-28 text-right',
        render: (e, a) => (
            <div className="flex items-center justify-end gap-1.5">
                <PhotoButton count={a.photoCount} onClick={a.onOpenPhoto} disabled={!canPhoto(e)} compact />
                {a.onSelect && (
                    <button
                        onClick={a.onSelect}
                        className="px-2.5 py-1 rounded-lg bg-neutral-800 text-white text-[11px] font-bold hover:bg-neutral-900 active:scale-95 transition-all cursor-pointer"
                        title="Buka halaman item (riwayat, spesifikasi, semua foto)"
                    >
                        Detail
                    </button>
                )}
            </div>
        ),
    },
};

/** Tabel record (md+). Shell rounded + overflow-hidden supaya sudut tetap terpotong
 *  saat isinya digeser horizontal di layar sempit. */
export function RecordTable({ entries, cols, rowActionsFor, minWidthClass = 'min-w-[1020px]' }: {
    entries: RecentEntry[];
    cols: RecordColumn[];
    rowActionsFor: (e: RecentEntry) => RowActions;
    /** Lantai lebar tabel; halaman item punya kolom lebih sedikit jadi boleh lebih sempit. */
    minWidthClass?: string;
}) {
    return (
        <div className="hidden md:block bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className={`w-full ${minWidthClass} text-left border-collapse`}>
                    <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200">
                            {cols.map(c => (
                                <th key={c.key} className={`px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-neutral-500 ${c.cellClass ?? ''}`}>
                                    {c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {entries.map(e => {
                            const actions = rowActionsFor(e);
                            return (
                                <tr key={rowKey(e)} className="hover:bg-neutral-50 transition-colors align-top">
                                    {cols.map(c => (
                                        <td key={c.key} className={`px-3 py-3 ${c.cellClass ?? ''}`}>{c.render(e, actions)}</td>
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
export function RecordCards({ entries, rowActionsFor, showItem = true }: {
    entries: RecentEntry[];
    rowActionsFor: (e: RecentEntry) => RowActions;
    /** Di halaman item nama itemnya sudah jadi judul halaman. */
    showItem?: boolean;
}) {
    return (
        <div className="md:hidden space-y-2">
            {entries.map(e => {
                const actions = rowActionsFor(e);
                const meta = [
                    e.notifikasi && `Notif ${e.notifikasi}`,
                    e.shift && `Shift ${e.shift}`,
                    metaOf(e),
                ].filter(Boolean).join(' · ');
                const body = (
                    <>
                        <div className="flex items-center gap-2 flex-wrap">
                            <SheetKindBadge kind={e.kind} />
                            <span className="text-[11px] font-semibold text-neutral-500">{e.tanggalRaw || '—'}</span>
                            <SheetStatusBadge status={e.status} />
                            <SheetScopeBadge scope={e.scope} />
                        </div>
                        {showItem && (
                            <p className="text-sm font-bold text-neutral-800 mt-1">{itemLabel(e.itemName, e.variant)}</p>
                        )}
                        <p className="text-sm text-neutral-600">{e.uraian}</p>
                        {meta && <p className="text-[10px] font-semibold text-neutral-400 mt-0.5">{meta}</p>}
                    </>
                );
                return (
                    <div
                        key={rowKey(e)}
                        className="flex items-stretch gap-3 border border-neutral-200 rounded-xl pl-2 pr-3 py-3 bg-white"
                    >
                        <div className={`w-1.5 rounded-full shrink-0 ${kindRailClass(e.kind)}`} />
                        <div className="min-w-0 flex-1">
                            {actions.onSelect
                                ? <button onClick={actions.onSelect} className="w-full text-left cursor-pointer">{body}</button>
                                : body}

                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-100">
                                <PhotoButton count={actions.photoCount} onClick={actions.onOpenPhoto} disabled={!canPhoto(e)} />
                                {actions.onSelect && (
                                    <button
                                        onClick={actions.onSelect}
                                        className="ml-auto px-2.5 py-1 rounded-lg bg-neutral-800 text-white text-[11px] font-bold hover:bg-neutral-900 active:scale-95 transition-all cursor-pointer"
                                    >
                                        Detail
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
