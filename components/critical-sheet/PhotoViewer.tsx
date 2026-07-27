'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { photoDirectSrc, photoSrc, type SheetPhoto } from './types';
import { SheetScopeBadge, SheetStatusBadge } from './SheetBadges';

/**
 * Penampil foto yang DIPAKAI BERSAMA oleh galeri item dan pop-up foto record.
 *
 * Dulu keduanya punya lightbox sendiri-sendiri: yang di galeri item memuat label
 * jenis/status/scope/pelapor, sedangkan yang di record cuma gambar + kotak keterangan.
 * Sekarang satu komponen, jadi foto terlihat sama dari mana pun dibukanya.
 */

/** Konteks record pemilik foto. RecentEntry maupun PhotoRecordTarget memenuhi bentuk ini. */
export interface PhotoRecordInfo {
    kind: 'critical' | 'maintenance';
    tanggalRaw: string;
    uraian: string;
    pelapor: string;
    scope: string;
    status: string;
}

/** Aksen jenis untuk foto: chip solid + bingkai thumbnail. */
export const PHOTO_KIND = {
    critical: { label: 'Critical', icon: 'warning', chip: 'bg-red-600/90 text-white', frame: 'border-red-300 hover:border-red-500' },
    maintenance: { label: 'Maintenance', icon: 'build', chip: 'bg-emerald-600/90 text-white', frame: 'border-emerald-300 hover:border-emerald-500' },
} as const;

/**
 * <img> foto record: memuat lewat proxy backend (satu origin dengan aplikasi), dan
 * pindah ke URL R2 langsung HANYA bila proxy benar-benar gagal.
 *
 * Sengaja tanpa batas waktu "kalau lambat pindah": cadangannya justru `pub-*.r2.dev`
 * yang di jaringan kantor diblokir. Proxy yang lambat berarti jaringannya lambat —
 * berpindah ke domain yang lebih mungkin diblokir cuma memperburuk.
 *
 * Tiga keadaan, TIGA tampilan berbeda. Dulu hanya ada dua (belum-selesai vs selesai),
 * sehingga foto yang GAGAL dimuat berdenyut selamanya dan terlihat seperti "loading
 * yang tidak pernah kelar" — operator tidak punya cara tahu bedanya, apalagi mencoba lagi.
 *
 * @param eager muat langsung tanpa menunggu masuk viewport. Dipakai di pop-up record yang
 *        fotonya sedikit dan langsung terlihat; galeri item tetap lazy karena bisa puluhan.
 */
export function PhotoImg({ photo, className, eager = false }: {
    photo: SheetPhoto;
    className?: string;
    eager?: boolean;
}) {
    const [src, setSrc] = useState(() => photoSrc(photo));
    const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
    const swapped = useRef(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Sengaja bergantung pada ISI foto (id + url), bukan identitas objeknya: daftar foto
    // sering dibangun ulang saat induknya render, dan kalau objek baru dianggap foto baru,
    // state kembali ke 'loading' padahal <img>-nya tidak memuat ulang → berdenyut selamanya.
    useEffect(() => {
        swapped.current = false;
        setState('loading');
        setSrc(photoSrc(photo));
        clearFallbackTimer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photo.id, photo.url]);

    // Gambar yang sudah ada di cache browser bisa selesai SEBELUM React sempat memasang
    // onLoad — tanpa pemeriksaan ini, <img> yang sebenarnya sudah lengkap tetap berdenyut.
    useEffect(() => {
        const el = imgRef.current;
        if (el?.complete && el.naturalWidth > 0) setState('loaded');
    });

    // Cadangan `pub-*.r2.dev` boleh dicoba, tapi TIDAK boleh ditunggu selamanya: di
    // jaringan kantor domain itu diblokir dengan cara menggantung — tanpa batas waktu,
    // permintaannya tidak pernah selesai maupun gagal, dan ubinnya berdenyut terus.
    const FALLBACK_TIMEOUT_MS = 8000;
    const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearFallbackTimer = useCallback(() => {
        if (fallbackTimer.current) { clearTimeout(fallbackTimer.current); fallbackTimer.current = null; }
    }, []);
    useEffect(() => clearFallbackTimer, [clearFallbackTimer]);

    const onError = useCallback(() => {
        const direct = photoDirectSrc(photo);
        if (!swapped.current && direct && direct !== src) {
            swapped.current = true;
            setSrc(direct);
            clearFallbackTimer();
            fallbackTimer.current = setTimeout(() => setState('error'), FALLBACK_TIMEOUT_MS);
            return;
        }
        clearFallbackTimer();
        setState('error');
    }, [photo, src, clearFallbackTimer]);

    const retry = useCallback(() => {
        swapped.current = false;
        clearFallbackTimer();
        setState('loading');
        // Query penanda waktu memaksa browser mencoba lagi, bukan memakai kegagalan
        // yang sudah terlanjur di-cache.
        setSrc(`${photoSrc(photo)}${photoSrc(photo).includes('?') ? '&' : '?'}coba=${Date.now()}`);
    }, [photo]);

    if (state === 'error') {
        return (
            <div
                className={`${className ?? ''} flex flex-col items-center justify-center gap-0.5 bg-neutral-100 text-neutral-400 cursor-pointer`}
                onClick={e => { e.preventDefault(); e.stopPropagation(); retry(); }}
                title="Foto gagal dimuat — klik untuk mencoba lagi"
            >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>broken_image</span>
                <span className="text-[10px] font-bold leading-tight">Gagal dimuat</span>
                <span className="text-[10px] font-bold text-blue-600 leading-tight">Coba lagi</span>
            </div>
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            ref={imgRef}
            src={src}
            alt={photo.caption || photo.filename}
            // Sebelum gambarnya sampai: kotak abu berdenyut, lalu muncul perlahan.
            // Di jaringan lapangan yang lambat ini penanda paling murah bahwa foto
            // memang sedang dimuat, bukan gagal.
            className={`${className ?? ''} transition-opacity duration-300 ${
                state === 'loaded' ? 'opacity-100' : 'opacity-0 bg-neutral-200 animate-pulse'
            }`}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            // Drag bawaan browser mengganggu geser-saat-zoom di lightbox.
            draggable={false}
            onLoad={() => { swapped.current = true; clearFallbackTimer(); setState('loaded'); }}
            onError={onError}
        />
    );
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 1.4;
/** Perbesaran sekali ketuk/klik-ganda — cukup untuk membaca nameplate atau retakan. */
const ZOOM_QUICK = 2.5;

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/**
 * Lightbox layar penuh: gambar besar + label konteks record di bawahnya.
 * Menangani sendiri Esc, panah kiri/kanan, geser (swipe) di HP, dan ZOOM —
 * klik ganda / ketuk dua kali, roda mouse, cubit dua jari, atau tombol +/−.
 * Saat diperbesar, gambar bisa digeser (pan) dan swipe ganti foto dimatikan.
 */
export function PhotoLightbox({ photos, index, onIndexChange, onClose, infoFor }: {
    photos: SheetPhoto[];
    index: number;
    onIndexChange: (next: number) => void;
    onClose: () => void;
    /** Konteks record pemilik foto; undefined kalau recordnya tidak ketemu. */
    infoFor: (photo: SheetPhoto) => PhotoRecordInfo | undefined;
}) {
    const touchStartX = useRef<number | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const dragFrom = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
    const pinchFrom = useRef<{ dist: number; zoom: number } | null>(null);
    const photo = photos[index];

    const resetZoom = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

    // Ganti foto selalu mulai dari perbesaran normal.
    useEffect(() => { resetZoom(); }, [index, resetZoom]);

    const zoomBy = useCallback((factor: number) => {
        setZoom(prev => {
            const next = clampZoom(prev * factor);
            if (next === 1) setPan({ x: 0, y: 0 });
            return next;
        });
    }, []);

    const toggleZoom = useCallback(() => {
        setZoom(prev => {
            if (prev > 1) { setPan({ x: 0, y: 0 }); return 1; }
            return ZOOM_QUICK;
        });
    }, []);

    const goPrev = useCallback(() => onIndexChange((index - 1 + photos.length) % photos.length), [index, photos.length, onIndexChange]);
    const goNext = useCallback(() => onIndexChange((index + 1) % photos.length), [index, photos.length, onIndexChange]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') { if (zoom > 1) resetZoom(); else onClose(); }
            else if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === 'ArrowRight') goNext();
            else if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP);
            else if (e.key === '-') zoomBy(1 / ZOOM_STEP);
            else if (e.key === '0') resetZoom();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, goPrev, goNext, zoom, zoomBy, resetZoom]);

    if (!photo) return null;
    const info = infoFor(photo);
    const kind = PHOTO_KIND[info?.kind ?? photo.parent_kind];

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            onClick={onClose}
            onTouchStart={e => {
                // Cubit dua jari = zoom; satu jari saat normal = geser ganti foto.
                if (e.touches.length === 2) {
                    const [a, b] = [e.touches[0], e.touches[1]];
                    pinchFrom.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom };
                    touchStartX.current = null;
                } else {
                    touchStartX.current = zoom === 1 ? (e.touches[0]?.clientX ?? null) : null;
                }
            }}
            onTouchMove={e => {
                if (e.touches.length === 2 && pinchFrom.current) {
                    const [a, b] = [e.touches[0], e.touches[1]];
                    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
                    setZoom(clampZoom(pinchFrom.current.zoom * (dist / pinchFrom.current.dist)));
                }
            }}
            onTouchEnd={e => {
                pinchFrom.current = null;
                if (touchStartX.current == null) return;
                const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
                touchStartX.current = null;
                if (Math.abs(dx) < 40) return;
                if (dx > 0) goPrev(); else goNext();
            }}
        >
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-black/40 text-white/90 text-xs font-semibold">
                    {index + 1} / {photos.length}
                </span>
                {/* Kontrol zoom: tetap terlihat supaya operator tahu fiturnya ada. */}
                <div className="flex items-center rounded-full bg-black/40 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => zoomBy(1 / ZOOM_STEP)}
                        disabled={zoom <= ZOOM_MIN}
                        className="w-8 h-8 flex items-center justify-center text-white/90 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        aria-label="Perkecil"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>zoom_out</span>
                    </button>
                    <button
                        onClick={resetZoom}
                        className="px-1.5 text-[11px] font-bold text-white/90 hover:bg-white/15 h-8 cursor-pointer transition-colors tabular-nums"
                        title="Kembalikan ke ukuran normal"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    <button
                        onClick={() => zoomBy(ZOOM_STEP)}
                        disabled={zoom >= ZOOM_MAX}
                        className="w-8 h-8 flex items-center justify-center text-white/90 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        aria-label="Perbesar"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>zoom_in</span>
                    </button>
                </div>
            </div>
            <button
                onClick={e => { e.stopPropagation(); onClose(); }}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-red-500 text-white/90 flex items-center justify-center cursor-pointer transition-all"
                aria-label="Tutup"
            >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
            {photos.length > 1 && zoom === 1 && (
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
                <div
                    className="relative overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 bg-black/40 flex items-center justify-center w-full touch-none"
                    style={{ height: 'min(70vh, calc(92vh - 160px))', cursor: zoom > 1 ? (dragFrom.current ? 'grabbing' : 'grab') : 'zoom-in' }}
                    onDoubleClick={toggleZoom}
                    onWheel={e => zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)}
                    onPointerDown={e => {
                        if (zoom <= 1) return;
                        dragFrom.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={e => {
                        const from = dragFrom.current;
                        if (!from) return;
                        setPan({ x: from.panX + (e.clientX - from.x), y: from.panY + (e.clientY - from.y) });
                    }}
                    onPointerUp={e => {
                        dragFrom.current = null;
                        e.currentTarget.releasePointerCapture?.(e.pointerId);
                    }}
                    onPointerCancel={() => { dragFrom.current = null; }}
                >
                    {/* Pembungkus yang di-transform, bukan <img>-nya, supaya PhotoImg tetap
                        komponen yang sama persis dengan thumbnail. */}
                    <div
                        className="flex items-center justify-center max-w-full max-h-full"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transition: dragFrom.current ? 'none' : 'transform 120ms ease-out',
                        }}
                    >
                        <PhotoImg photo={photo} className="max-w-full max-h-full object-contain select-none" eager />
                    </div>
                </div>

                {/* Label konteks: jenis + tanggal, lalu status/scope/pelapor, lalu uraian. */}
                <div className="w-full max-w-3xl space-y-2">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${kind.chip}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{kind.icon}</span>
                            {kind.label}
                            {info?.tanggalRaw && <span className="opacity-80">· {info.tanggalRaw}</span>}
                        </span>
                        {info && <SheetStatusBadge status={info.status} />}
                        {info?.scope?.trim() && <SheetScopeBadge scope={info.scope} />}
                        {info?.pelapor && (
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold bg-white/10 text-white/90">
                                Pelapor: {info.pelapor}
                            </span>
                        )}
                    </div>
                    {/* Uraian = alasan foto ini ada, jadi diperlakukan sebagai teks utama.
                        Berlabel sama seperti di pop-up record supaya bacaannya konsisten. */}
                    {info?.uraian && (
                        <p className="text-center text-sm sm:text-base font-semibold text-white bg-white/10 rounded-xl px-4 py-2.5 line-clamp-3">
                            <span className="text-white/60">Uraian : </span>
                            {info.uraian}
                        </p>
                    )}
                    {photo.caption && <p className="text-center text-sm text-white/80">{photo.caption}</p>}
                </div>
            </div>
        </div>
    );
}
