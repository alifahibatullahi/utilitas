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

    const closeLightbox = useCallback(() => {
        const idx = lightboxIdx;
        if (idx != null && photos[idx]) {
            const original = (photos[idx].caption ?? '').trim();
            const next = draftCaption.trim();
            if (next !== original) {
                const choice = confirm('Ada perubahan keterangan foto yang belum disimpan. Tetap tutup tanpa menyimpan?');
                if (!choice) return;
            }
        }
        setLightboxIdx(null);
    }, [lightboxIdx, draftCaption, photos]);

    const goPrev = useCallback(() => {
        setLightboxIdx(idx => (idx == null ? idx : (idx - 1 + photos.length) % photos.length));
    }, [photos.length]);

    const goNext = useCallback(() => {
        setLightboxIdx(idx => (idx == null ? idx : (idx + 1) % photos.length));
    }, [photos.length]);

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

    async function saveCaption() {
        if (lightboxIdx == null) return;
        const photo = photos[lightboxIdx];
        if (!photo) return;
        const next = draftCaption.trim();
        if (next === (photo.caption ?? '').trim()) return;
        setSavingCaption(true);
        try {
            await onCaptionUpdate?.(photo.id, next);
        } finally {
            setSavingCaption(false);
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
            {lightboxIdx != null && photos[lightboxIdx] && (() => {
                const original = (photos[lightboxIdx].caption ?? '').trim();
                const next = draftCaption.trim();
                const dirty = next !== original;
                return (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
                    onClick={closeLightbox}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Counter top-left */}
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-white text-xs font-bold border border-white/20">
                        {lightboxIdx + 1} / {photos.length}
                    </div>

                    {/* Top-right toolbar: Save (kalau dirty) + Batal + X */}
                    <div className="absolute top-4 right-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {onCaptionUpdate && dirty && (
                            <>
                                <button
                                    onClick={() => setDraftCaption(original)}
                                    disabled={savingCaption}
                                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-sm cursor-pointer disabled:opacity-50 transition-colors"
                                    title="Batalkan perubahan"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={saveCaption}
                                    disabled={savingCaption}
                                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md"
                                    title="Simpan keterangan foto"
                                >
                                    {savingCaption ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                                            Menyimpan…
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
                                            Simpan
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                        <button
                            onClick={closeLightbox}
                            className="group w-10 h-10 rounded-full bg-white/10 hover:bg-rose-500 hover:scale-110 text-white flex items-center justify-center border border-white/20 hover:border-rose-300 backdrop-blur-sm cursor-pointer transition-all duration-150 shadow-md hover:shadow-rose-500/40"
                            aria-label="Tutup"
                            title={dirty ? 'Tutup (ada perubahan belum disimpan)' : 'Tutup'}
                        >
                            <span className="material-symbols-outlined transition-transform group-hover:rotate-90" style={{ fontSize: 18 }}>close</span>
                        </button>
                    </div>

                    {/* Prev arrow */}
                    {photos.length > 1 && (
                        <button
                            onClick={e => { e.stopPropagation(); goPrev(); }}
                            className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20 backdrop-blur-sm cursor-pointer transition-colors"
                            aria-label="Sebelumnya"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>chevron_left</span>
                        </button>
                    )}

                    {/* Next arrow */}
                    {photos.length > 1 && (
                        <button
                            onClick={e => { e.stopPropagation(); goNext(); }}
                            className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20 backdrop-blur-sm cursor-pointer transition-colors"
                            aria-label="Berikutnya"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>chevron_right</span>
                        </button>
                    )}

                    {/* Image + caption editor container */}
                    <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
                        <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                key={photos[lightboxIdx].id}
                                src={photos[lightboxIdx].url}
                                alt={photos[lightboxIdx].caption || photos[lightboxIdx].filename}
                                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
                            />
                        </div>

                        {/* Caption editor */}
                        <div className="w-full max-w-2xl bg-white/95 rounded-xl p-3 shadow-lg">
                            {onCaptionUpdate ? (
                                <>
                                    <div className="flex items-start gap-2">
                                        <span className="material-symbols-outlined text-gray-500 mt-1.5" style={{ fontSize: 16 }}>edit_note</span>
                                        <textarea
                                            value={draftCaption}
                                            onChange={e => setDraftCaption(e.target.value)}
                                            placeholder="Tambahkan keterangan foto…"
                                            rows={2}
                                            className="flex-1 resize-none text-sm font-medium text-gray-800 placeholder-gray-400 outline-none bg-transparent border-0 focus:ring-0"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mt-1 text-[10px] font-bold">
                                        <span>
                                            {dirty ? <span className="text-amber-600">● Belum disimpan — pakai tombol Simpan di pojok kanan atas</span> : <span className="text-emerald-600">● Tersimpan</span>}
                                        </span>
                                        <span className="text-gray-400 truncate ml-2 max-w-[200px]">{photos[lightboxIdx].filename}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-700 italic">{photos[lightboxIdx].caption || 'Tidak ada keterangan'}</p>
                                    <p className="mt-1 text-[10px] text-gray-400 truncate">{photos[lightboxIdx].filename}</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                );
            })()}
        </>
    );
}
