'use client';

import { useCallback, useMemo, useState } from 'react';
import type { RecentEntry, SheetPhoto } from './types';
import { MediaThumb, PhotoLightbox, PHOTO_KIND } from './PhotoViewer';

interface ItemPhotoGalleryProps {
    /** Semua foto item (gabungan seluruh record) — sudah di-batch fetch oleh parent. */
    photos: SheetPhoto[];
    /** Record item untuk melabeli sumber tiap foto. */
    records: RecentEntry[];
}

const PREVIEW_COUNT = 6;

/**
 * Galeri LENGKAP satu item: seluruh foto dari semua record critical + maintenance item
 * itu dalam satu grid, tiap foto berlabel sumbernya.
 *
 * View-only — upload & hapus dilakukan di RecordPhotoModal, yang dibuka lewat tombol Foto
 * di tabel riwayat. Sengaja tidak ada jalan pintas dari sini supaya jelas foto itu milik
 * baris yang mana. Awalnya hanya PREVIEW_COUNT thumbnail yang dimuat; sisanya menyusul
 * saat "Lihat semua" ditekan. Lightbox-nya dipakai bersama dengan pop-up foto record
 * (PhotoViewer), jadi tampilan fotonya sama dari mana pun dibuka.
 */
export default function ItemPhotoGallery({ photos, records }: ItemPhotoGalleryProps) {
    const [expanded, setExpanded] = useState(false);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

    const sourceOf = useMemo(() => {
        const m = new Map<string, RecentEntry>();
        for (const r of records) if (r.uid) m.set(r.uid, r);
        return m;
    }, [records]);

    const infoFor = useCallback((photo: SheetPhoto) => sourceOf.get(photo.row_uid), [sourceOf]);

    const visible = expanded ? photos : photos.slice(0, PREVIEW_COUNT);
    const hidden = photos.length - visible.length;

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
                    const kind = PHOTO_KIND[src?.kind ?? photo.parent_kind];
                    return (
                        <button
                            key={photo.id}
                            onClick={() => setLightboxIdx(idx)}
                            // Bingkai ikut warna jenis record: asal foto terbaca tanpa membaca chip.
                            className={`relative aspect-square rounded-xl overflow-hidden border-2 ${kind.frame} hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 bg-neutral-100 cursor-pointer`}
                            title={photo.caption || photo.filename}
                        >
                            <MediaThumb photo={photo} className="w-full h-full object-cover" />
                            <span className={`absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold backdrop-blur-sm ${kind.chip}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{kind.icon}</span>
                                {kind.label}
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
                <PhotoLightbox
                    photos={photos}
                    index={lightboxIdx}
                    onIndexChange={setLightboxIdx}
                    onClose={() => setLightboxIdx(null)}
                    infoFor={infoFor}
                />
            )}
        </div>
    );
}
