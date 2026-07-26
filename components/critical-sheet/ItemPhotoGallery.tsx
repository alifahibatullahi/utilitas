'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PhotoImg } from './RecordPhotoModal';
import type { RecentEntry, SheetPhoto } from './types';
import { statusLabel } from './SheetBadges';

interface ItemPhotoGalleryProps {
    /** Semua foto item (gabungan seluruh record) — sudah di-batch fetch oleh parent. */
    photos: SheetPhoto[];
    /** Record item untuk melabeli sumber tiap foto. */
    records: RecentEntry[];
}

const KIND_CHIP: Record<'critical' | 'maintenance', { label: string; cls: string; icon: string }> = {
    critical: { label: 'Critical', cls: 'bg-red-600/90 text-white', icon: 'warning' },
    maintenance: { label: 'Maintenance', cls: 'bg-emerald-600/90 text-white', icon: 'build' },
};

const PREVIEW_COUNT = 6;

/**
 * Galeri LENGKAP satu item: seluruh foto dari semua record critical + maintenance item
 * itu dalam satu grid, tiap foto berlabel sumbernya.
 *
 * View-only — upload & hapus dilakukan di RecordPhotoModal, yang dibuka lewat tombol Foto
 * di tabel riwayat. Sengaja tidak ada jalan pintas dari sini supaya jelas foto itu milik
 * baris yang mana. Awalnya hanya PREVIEW_COUNT thumbnail yang dimuat; sisanya menyusul
 * saat "Lihat semua" ditekan.
 */
export default function ItemPhotoGallery({ photos, records }: ItemPhotoGalleryProps) {
    const [expanded, setExpanded] = useState(false);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const touchStartX = useRef<number | null>(null);

    const sourceOf = useMemo(() => {
        const m = new Map<string, RecentEntry>();
        for (const r of records) if (r.uid) m.set(r.uid, r);
        return m;
    }, [records]);

    const visible = expanded ? photos : photos.slice(0, PREVIEW_COUNT);
    const hidden = photos.length - visible.length;

    const close = useCallback(() => setLightboxIdx(null), []);
    const goPrev = useCallback(() => setLightboxIdx(i => (i == null ? i : (i - 1 + photos.length) % photos.length)), [photos.length]);
    const goNext = useCallback(() => setLightboxIdx(i => (i == null ? i : (i + 1) % photos.length)), [photos.length]);

    useEffect(() => {
        if (lightboxIdx == null) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === 'ArrowRight') goNext();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxIdx, close, goPrev, goNext]);

    if (photos.length === 0) {
        return (
            <p className="text-[11px] text-neutral-400 italic">
                Belum ada foto. Buka salah satu record di riwayat untuk menambahkan.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
                {visible.map((photo, idx) => {
                    const src = sourceOf.get(photo.row_uid);
                    const chip = KIND_CHIP[src?.kind ?? photo.parent_kind];
                    return (
                        <button
                            key={photo.id}
                            onClick={() => setLightboxIdx(idx)}
                            className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200 hover:border-neutral-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-neutral-100 cursor-pointer"
                            title={photo.caption || photo.filename}
                        >
                            <PhotoImg photo={photo} className="w-full h-full object-cover" />
                            <span className={`absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold backdrop-blur-sm ${chip.cls}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{chip.icon}</span>
                                {chip.label}
                                {src?.tanggalRaw && <span className="opacity-80">· {src.tanggalRaw}</span>}
                            </span>
                        </button>
                    );
                })}
            </div>

            {hidden > 0 && (
                <button
                    onClick={() => setExpanded(true)}
                    className="w-full py-2 rounded-xl border border-neutral-300 bg-neutral-50 text-xs font-bold text-neutral-600 hover:bg-neutral-100 cursor-pointer transition-colors"
                >
                    Lihat semua ({photos.length})
                </button>
            )}
            {expanded && photos.length > PREVIEW_COUNT && (
                <button
                    onClick={() => setExpanded(false)}
                    className="w-full py-2 rounded-xl border border-neutral-300 bg-neutral-50 text-xs font-bold text-neutral-600 hover:bg-neutral-100 cursor-pointer transition-colors"
                >
                    Tampilkan lebih sedikit
                </button>
            )}

            {lightboxIdx != null && photos[lightboxIdx] && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
                    onClick={close}
                    onTouchStart={e => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
                    onTouchEnd={e => {
                        if (touchStartX.current == null) return;
                        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
                        touchStartX.current = null;
                        if (Math.abs(dx) < 40) return;
                        if (dx > 0) goPrev(); else goNext();
                    }}
                >
                    <div className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-full bg-black/40 text-white/90 text-xs font-semibold">
                        {lightboxIdx + 1} / {photos.length}
                    </div>
                    <button
                        onClick={e => { e.stopPropagation(); close(); }}
                        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-red-500 text-white/90 flex items-center justify-center cursor-pointer transition-all"
                        aria-label="Tutup"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                    {photos.length > 1 && (
                        <>
                            <button
                                onClick={e => { e.stopPropagation(); goPrev(); }}
                                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white/90 flex items-center justify-center cursor-pointer transition-all"
                                aria-label="Sebelumnya"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 26 }}>chevron_left</span>
                            </button>
                            <button
                                onClick={e => { e.stopPropagation(); goNext(); }}
                                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white/90 flex items-center justify-center cursor-pointer transition-all"
                                aria-label="Berikutnya"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 26 }}>chevron_right</span>
                            </button>
                        </>
                    )}
                    <div className="relative flex flex-col items-center gap-3 w-full max-w-4xl max-h-[92vh]" onClick={e => e.stopPropagation()}>
                        <div className="relative overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 bg-black/40 flex items-center justify-center w-full" style={{ height: 'min(70vh, calc(92vh - 160px))' }}>
                            <PhotoImg photo={photos[lightboxIdx]} className="max-w-full max-h-full object-contain" />
                        </div>
                        <LightboxFooter
                            photo={photos[lightboxIdx]}
                            source={sourceOf.get(photos[lightboxIdx].row_uid)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

/** Keterangan record pemilik foto. Tanpa tombol aksi: mengelola foto hanya lewat tombol
 *  Foto di tabel riwayat, supaya cuma ada satu jalan masuk. */
function LightboxFooter({ photo, source }: {
    photo: SheetPhoto;
    source?: RecentEntry;
}) {
    const chip = KIND_CHIP[source?.kind ?? photo.parent_kind];
    // Chip terang di atas latar gelap lightbox — badge biasa terlalu redup di sini.
    const info = [
        source?.pelapor && `Pelapor: ${source.pelapor}`,
        source?.scope?.trim() && `Scope: ${source.scope.trim()}`,
        // Status selalu ditampilkan: sel kosong pun punya arti (OPEN), sama seperti badge di tabel.
        source && `Status: ${statusLabel(source.status)}`,
    ].filter(Boolean) as string[];
    return (
        <div className="w-full max-w-3xl space-y-2">
            <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${chip.cls}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{chip.icon}</span>
                    {chip.label}
                    {source?.tanggalRaw && <span className="opacity-80">· {source.tanggalRaw}</span>}
                </span>
                {info.map(t => (
                    <span key={t} className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold bg-white/10 text-white/90">
                        {t}
                    </span>
                ))}
            </div>
            {source?.uraian && <p className="text-center text-xs text-white/70 line-clamp-2">{source.uraian}</p>}
            {photo.caption && <p className="text-center text-sm text-white/90 font-medium">{photo.caption}</p>}
        </div>
    );
}
