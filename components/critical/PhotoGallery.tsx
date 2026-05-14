'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import type { PhotoRow } from '@/lib/supabase/types';

interface PhotoGalleryProps {
    photos: PhotoRow[];
    onDelete?: (id: string) => Promise<void>;
    onCaptionUpdate?: (id: string, caption: string) => Promise<void> | void;
    compact?: boolean;
}

export default function PhotoGallery({ photos, onDelete, onCaptionUpdate, compact = false }: PhotoGalleryProps) {
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [draftCaption, setDraftCaption] = useState('');
    const [savingCaption, setSavingCaption] = useState(false);
    const touchStartX = useRef<number | null>(null);

    // Auto-save current draft caption (silent, no UI feedback). Returns when done.
    const flushCaption = useCallback(async () => {
        if (lightboxIdx == null) return;
        const photo = photos[lightboxIdx];
        if (!photo) return;
        const next = draftCaption.trim();
        if (next === (photo.caption ?? '').trim()) return;
        setSavingCaption(true);
        try { await onCaptionUpdate?.(photo.id, next); }
        finally { setSavingCaption(false); }
    }, [lightboxIdx, photos, draftCaption, onCaptionUpdate]);

    const closeLightbox = useCallback(async () => {
        // Auto-save draft caption sebelum tutup (silent)
        await flushCaption();
        setLightboxIdx(null);
    }, [flushCaption]);

    const goPrev = useCallback(async () => {
        await flushCaption();
        setLightboxIdx(idx => (idx == null ? idx : (idx - 1 + photos.length) % photos.length));
    }, [photos.length, flushCaption]);

    const goNext = useCallback(async () => {
        await flushCaption();
        setLightboxIdx(idx => (idx == null ? idx : (idx + 1) % photos.length));
    }, [photos.length, flushCaption]);

    // Sync draft caption ke foto aktif tiap kali index berubah
    useEffect(() => {
        if (lightboxIdx == null) return;
        setDraftCaption(photos[lightboxIdx]?.caption ?? '');
    }, [lightboxIdx, photos]);

    // Keyboard navigation
    useEffect(() => {
        if (lightboxIdx == null) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') closeLightbox();
            else if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === 'ArrowRight') goNext();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxIdx, closeLightbox, goPrev, goNext]);

    if (photos.length === 0) return null;

    async function handleDelete(id: string) {
        setDeletingId(id);
        try {
            await onDelete?.(id);
            // Kalau foto yang dihapus sedang di-lightbox, sesuaikan index
            if (lightboxIdx != null) {
                if (photos.length <= 1) closeLightbox();
                else setLightboxIdx(Math.min(lightboxIdx, photos.length - 2));
            }
        } finally {
            setDeletingId(null);
        }
    }

    function handleTouchStart(e: React.TouchEvent) {
        touchStartX.current = e.touches[0]?.clientX ?? null;
    }
    function handleTouchEnd(e: React.TouchEvent) {
        if (touchStartX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) < 40) return;
        if (dx > 0) goPrev();
        else goNext();
    }

    return (
        <>
            {/* Thumb grid */}
            <div className={compact ? 'flex gap-2 overflow-x-auto light-scrollbar pb-1' : 'grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'}>
                {photos.map((photo, idx) => (
                    <div key={photo.id} className={`relative group ${compact ? 'shrink-0 w-16 h-16' : 'w-full aspect-square'}`}>
                        <button
                            onClick={() => setLightboxIdx(idx)}
                            className="block w-full h-full rounded-xl overflow-hidden border-2 border-slate-100 hover:border-blue-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-400"
                            title={photo.caption || photo.filename}
                        >
                            <Image src={photo.url} alt={photo.caption || photo.filename} fill className="object-cover" />
                        </button>
                        {photo.caption && !compact && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] font-semibold px-2 py-1 line-clamp-2 rounded-b-xl">
                                {photo.caption}
                            </div>
                        )}
                        {photo.uploaded_via === 'whatsapp' && (
                            <span className="absolute bottom-0.5 left-0.5 w-3 h-3 bg-green-500 rounded-full border border-white" title="Dikirim via WhatsApp" />
                        )}
                        {onDelete && (
                            <button
                                onClick={() => handleDelete(photo.id)}
                                disabled={deletingId === photo.id}
                                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-rose-500 text-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all disabled:opacity-50 hover:bg-rose-600"
                                title="Hapus foto"
                            >
                                <span className="material-symbols-outlined font-bold" style={{ fontSize: 16 }}>{deletingId === photo.id ? 'more_horiz' : 'close'}</span>
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Lightbox carousel */}
            {lightboxIdx != null && photos[lightboxIdx] && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
                    onClick={closeLightbox}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Counter top-left — minimal */}
                    <div className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white/90 text-xs font-semibold">
                        {lightboxIdx + 1} / {photos.length}
                    </div>

                    {/* Close button top-right — minimal */}
                    <button
                        onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
                        className="group absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-rose-500 hover:scale-110 text-white/90 hover:text-white flex items-center justify-center backdrop-blur-sm cursor-pointer transition-all duration-150 shadow-lg"
                        aria-label="Tutup"
                    >
                        <span className="material-symbols-outlined transition-transform group-hover:rotate-90" style={{ fontSize: 20 }}>close</span>
                    </button>

                    {/* Prev arrow — outside photo area */}
                    {photos.length > 1 && (
                        <button
                            onClick={e => { e.stopPropagation(); goPrev(); }}
                            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white/90 flex items-center justify-center backdrop-blur-sm cursor-pointer transition-all hover:scale-110"
                            aria-label="Sebelumnya"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>chevron_left</span>
                        </button>
                    )}

                    {/* Next arrow — outside photo area */}
                    {photos.length > 1 && (
                        <button
                            onClick={e => { e.stopPropagation(); goNext(); }}
                            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white/90 flex items-center justify-center backdrop-blur-sm cursor-pointer transition-all hover:scale-110"
                            aria-label="Berikutnya"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>chevron_right</span>
                        </button>
                    )}

                    {/* Photo + caption overlay — clean composition */}
                    <div
                        className="relative inline-flex flex-col items-center max-w-[92vw] max-h-[92vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            key={photos[lightboxIdx].id}
                            src={photos[lightboxIdx].url}
                            alt={photos[lightboxIdx].caption || photos[lightboxIdx].filename}
                            className="max-w-[92vw] max-h-[92vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
                        />

                        {/* Caption box — overlay di pojok bawah foto, satu-satunya elemen di atas foto */}
                        <div className="absolute left-3 right-3 bottom-3 bg-black/60 backdrop-blur-md rounded-lg shadow-xl border border-white/10 px-3 py-2">
                            {onCaptionUpdate ? (
                                <textarea
                                    value={draftCaption}
                                    onChange={e => setDraftCaption(e.target.value)}
                                    onBlur={flushCaption}
                                    placeholder="Tambahkan keterangan foto…"
                                    rows={2}
                                    className="w-full resize-none text-sm font-medium text-white placeholder-white/50 outline-none bg-transparent border-0 focus:ring-0"
                                    aria-label="Keterangan foto"
                                />
                            ) : (
                                <p className="text-sm text-white/90 italic">{photos[lightboxIdx].caption || 'Tidak ada keterangan'}</p>
                            )}
                            {savingCaption && (
                                <div className="absolute top-1 right-2 text-[9px] text-white/70 flex items-center gap-1">
                                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: 11 }}>progress_activity</span>
                                    Menyimpan…
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
