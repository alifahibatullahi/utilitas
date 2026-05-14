'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
    // Zoom + pan state untuk lightbox — toggle sederhana 100% ↔ 200%
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
    const ZOOM_IN_LEVEL = 2;
    const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
    const toggleZoom = () => {
        setZoom(z => (z === 1 ? ZOOM_IN_LEVEL : 1));
        setPan({ x: 0, y: 0 });
    };

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
        resetZoom();
    }, [flushCaption]);

    const goPrev = useCallback(async () => {
        await flushCaption();
        resetZoom();
        setLightboxIdx(idx => (idx == null ? idx : (idx - 1 + photos.length) % photos.length));
    }, [photos.length, flushCaption]);

    const goNext = useCallback(async () => {
        await flushCaption();
        resetZoom();
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
                            className="block w-full h-full rounded-xl overflow-hidden border-2 border-slate-100 hover:border-blue-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 relative"
                            title={photo.caption || photo.filename}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={photo.url}
                                alt={photo.caption || photo.filename}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                    const img = e.currentTarget;
                                    img.style.display = 'none';
                                    const parent = img.parentElement;
                                    if (parent && !parent.querySelector('.img-fallback')) {
                                        const fallback = document.createElement('div');
                                        fallback.className = 'img-fallback absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-1';
                                        fallback.innerHTML = `<span class="material-symbols-outlined" style="font-size: ${compact ? 16 : 28}px">broken_image</span><span class="text-[8px] mt-0.5 font-bold">Gagal load</span>`;
                                        parent.appendChild(fallback);
                                    }
                                }}
                            />
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

                    {/* Content stack: foto (zoomable) + caption box terpisah */}
                    <div
                        className="relative flex flex-col items-center gap-3 w-full max-w-5xl max-h-[92vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Photo container — overflow hidden untuk clip pan */}
                        <div
                            className="relative overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 bg-black/40 flex items-center justify-center w-full select-none"
                            style={{
                                height: 'min(70vh, calc(92vh - 180px))',
                                cursor: zoom > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'zoom-in',
                                touchAction: zoom > 1 ? 'none' : 'auto',
                            }}
                            onPointerDown={(e) => {
                                if (zoom <= 1) return;
                                e.currentTarget.setPointerCapture(e.pointerId);
                                dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pan.x, baseY: pan.y };
                            }}
                            onPointerMove={(e) => {
                                if (!dragRef.current) return;
                                setPan({
                                    x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
                                    y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
                                });
                            }}
                            onPointerUp={(e) => {
                                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                                    e.currentTarget.releasePointerCapture(e.pointerId);
                                }
                                dragRef.current = null;
                            }}
                            onPointerCancel={() => { dragRef.current = null; }}
                            onDoubleClick={toggleZoom}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                key={photos[lightboxIdx].id}
                                src={photos[lightboxIdx].url}
                                alt={photos[lightboxIdx].caption || photos[lightboxIdx].filename}
                                draggable={false}
                                referrerPolicy="no-referrer"
                                className="max-w-full max-h-full object-contain select-none pointer-events-none transition-transform duration-100"
                                style={{
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                }}
                                onError={(e) => {
                                    const img = e.currentTarget;
                                    img.style.display = 'none';
                                    const parent = img.parentElement;
                                    if (parent && !parent.querySelector('.img-fallback-lightbox')) {
                                        const fallback = document.createElement('div');
                                        fallback.className = 'img-fallback-lightbox absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2 p-4';
                                        fallback.innerHTML = `
                                            <span class="material-symbols-outlined" style="font-size: 64px">broken_image</span>
                                            <p class="text-sm font-bold">Foto gagal dimuat</p>
                                            <p class="text-[10px] text-white/50 break-all max-w-md text-center">${photos[lightboxIdx]?.url ?? ''}</p>
                                            <p class="text-[10px] text-white/50 max-w-md text-center mt-2">Cek koneksi atau buka URL di tab baru untuk verifikasi</p>
                                        `;
                                        parent.appendChild(fallback);
                                    }
                                }}
                            />

                            {/* Zoom indicator + reset (hanya muncul saat zoomed) */}
                            {zoom !== 1 && (
                                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/55 backdrop-blur-sm rounded-lg px-2 py-1 shadow-lg">
                                    <span className="text-[10px] font-bold text-white tabular-nums">{Math.round(zoom * 100)}%</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); resetZoom(); }}
                                        className="ml-1 w-6 h-6 rounded text-white/90 hover:bg-white/20 cursor-pointer flex items-center justify-center transition-colors"
                                        title="Reset zoom"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
                                    </button>
                                </div>
                            )}

                            {/* Hint kecil di bottom — fade saat hover supaya tidak ganggu */}
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-sm text-[10px] text-white/80 font-semibold pointer-events-none opacity-70">
                                {zoom === 1 ? 'Klik 2× untuk zoom in' : 'Geser untuk pan · Klik 2× untuk normal'}
                            </div>
                        </div>

                        {/* Caption box — kotak polos saja */}
                        <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl px-4 py-3">
                            {onCaptionUpdate ? (
                                <textarea
                                    value={draftCaption}
                                    onChange={e => setDraftCaption(e.target.value)}
                                    onBlur={flushCaption}
                                    placeholder="Tambahkan keterangan foto…"
                                    rows={2}
                                    className="w-full resize-none text-sm font-medium text-gray-900 placeholder-gray-400 outline-none bg-transparent border-0 focus:ring-0"
                                    aria-label="Keterangan foto"
                                />
                            ) : (
                                <p className="text-sm text-gray-800">{photos[lightboxIdx].caption || <span className="italic text-gray-400">Tidak ada keterangan</span>}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
