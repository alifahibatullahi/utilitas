'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOperator } from '@/hooks/useOperator';
import { compressImage } from '@/lib/image-compression';
import type { SheetPhoto } from './types';

/** Satu record (critical/maintenance) sebagai sumber/target foto. */
export interface PhotoRecordSource {
    uid: string;
    kind: 'critical' | 'maintenance';
    tanggalRaw: string;
    uraian: string;
}

interface ItemPhotoGalleryProps {
    /** Semua foto item (gabungan seluruh record) — sudah di-batch fetch oleh parent. */
    initialPhotos: SheetPhoto[];
    /** Record item untuk label sumber tiap foto & picker target upload. Urut terbaru dulu. */
    records: PhotoRecordSource[];
    onPhotosChange?: (photos: SheetPhoto[]) => void;
}

const KIND_CHIP: Record<'critical' | 'maintenance', { label: string; cls: string; icon: string }> = {
    critical: { label: 'Critical', cls: 'bg-red-600/90 text-white', icon: 'warning' },
    maintenance: { label: 'Maintenance', cls: 'bg-neutral-800/90 text-white', icon: 'build' },
};

function photoSrc(id: string): string {
    return `/api/sheet-photos/${id}/file`;
}

/**
 * Galeri foto agregat satu item: menampilkan SEMUA foto (critical + maintenance) dalam satu
 * grid, tiap foto diberi label sumbernya (record critical/maintenance mana + tanggalnya).
 * Upload memerlukan record target (foto secara data menempel ke satu row_uid) → picker.
 * Lightbox mandiri (tidak memakai PhotoGallery lama agar fitur /critical tak terpengaruh).
 */
export default function ItemPhotoGallery({ initialPhotos, records, onPhotosChange }: ItemPhotoGalleryProps) {
    const { operator } = useOperator();
    const [photos, setPhotos] = useState<SheetPhoto[]>(initialPhotos);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [targetUid, setTargetUid] = useState<string>(records[0]?.uid ?? '');
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const touchStartX = useRef<number | null>(null);

    useEffect(() => { setPhotos(initialPhotos); }, [initialPhotos]);
    useEffect(() => { if (!targetUid && records[0]) setTargetUid(records[0].uid); }, [records, targetUid]);

    const sourceOf = useMemo(() => {
        const m = new Map<string, PhotoRecordSource>();
        for (const r of records) if (r.uid) m.set(r.uid, r);
        return m;
    }, [records]);

    const update = useCallback((next: SheetPhoto[]) => { setPhotos(next); onPhotosChange?.(next); }, [onPhotosChange]);

    const targetRecord = records.find(r => r.uid === targetUid) ?? records[0];

    async function handleFiles(files: FileList | null) {
        if (!files || files.length === 0 || !targetRecord) return;
        setError(null);
        setUploading(true);
        let next = photos;
        for (const file of Array.from(files)) {
            const compressed = await compressImage(file).catch(() => file);
            const form = new FormData();
            form.append('file', compressed);
            form.append('parent_kind', targetRecord.kind);
            form.append('row_uid', targetRecord.uid);
            if (operator?.name) form.append('uploaded_by', operator.name);
            try {
                const res = await fetch('/api/sheet-photos', { method: 'POST', body: form });
                const json = await res.json();
                if (!res.ok) { setError(json.error ?? 'Upload gagal'); break; }
                next = [...next, json.photo as SheetPhoto];
                update(next);
            } catch {
                setError('Gagal terhubung ke server');
                break;
            }
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    const handleDelete = useCallback(async (id: string) => {
        const res = await fetch(`/api/sheet-photos/${id}`, { method: 'DELETE' });
        if (res.ok) {
            setPhotos(prev => { const next = prev.filter(p => p.id !== id); onPhotosChange?.(next); return next; });
        }
    }, [onPhotosChange]);

    const handleCaption = useCallback(async (id: string, caption: string) => {
        const res = await fetch(`/api/sheet-photos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caption }),
        });
        if (res.ok) {
            setPhotos(prev => { const next = prev.map(p => (p.id === id ? { ...p, caption: caption || null } : p)); onPhotosChange?.(next); return next; });
        }
    }, [onPhotosChange]);

    // Navigasi lightbox
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

    const canUpload = records.length > 0;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={e => handleFiles(e.target.files)}
                />
                <button
                    onClick={() => setPickerOpen(o => !o)}
                    disabled={uploading || !canUpload}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-100 border border-neutral-300 text-neutral-700 hover:bg-neutral-200 transition-all disabled:opacity-50 cursor-pointer"
                    title={canUpload ? 'Upload foto ke record' : 'Belum ada record'}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{uploading ? 'more_horiz' : 'upload'}</span>
                    {uploading ? 'Mengupload…' : 'Upload'}
                </button>
                {photos.length > 0 && <span className="text-[10px] font-semibold text-neutral-400">{photos.length} foto</span>}
                {error && <span className="text-[10px] text-red-600 font-medium">{error}</span>}
            </div>

            {/* Picker record target upload */}
            {pickerOpen && canUpload && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Foto untuk record</label>
                    <select
                        value={targetUid}
                        onChange={e => setTargetUid(e.target.value)}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-700 outline-none focus:ring-2 focus:ring-neutral-400/40 cursor-pointer"
                    >
                        {records.map(r => (
                            <option key={r.uid} value={r.uid}>
                                {KIND_CHIP[r.kind].label} · {r.tanggalRaw || '—'} · {r.uraian.slice(0, 40)}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-800 text-white hover:bg-neutral-900 transition-all disabled:opacity-50 cursor-pointer"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_a_photo</span>
                        Pilih foto
                    </button>
                </div>
            )}

            {photos.length === 0 ? (
                <p className="text-[11px] text-neutral-400 italic">Belum ada foto.</p>
            ) : (
                <div className="grid grid-cols-2 gap-2.5">
                    {photos.map((photo, idx) => {
                        const src = sourceOf.get(photo.row_uid);
                        const kind = src?.kind ?? photo.parent_kind;
                        const chip = KIND_CHIP[kind];
                        return (
                            <div key={photo.id} className="relative group aspect-square">
                                <button
                                    onClick={() => setLightboxIdx(idx)}
                                    className="block w-full h-full rounded-xl overflow-hidden border border-neutral-200 hover:border-neutral-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-neutral-100"
                                    title={photo.caption || photo.filename}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={photoSrc(photo.id)}
                                        alt={photo.caption || photo.filename}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                    />
                                </button>
                                {/* Label sumber */}
                                <div className={`absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold backdrop-blur-sm ${chip.cls}`}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{chip.icon}</span>
                                    {chip.label}
                                    {src?.tanggalRaw && <span className="opacity-80">· {src.tanggalRaw}</span>}
                                </div>
                                <button
                                    onClick={() => handleDelete(photo.id)}
                                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all hover:bg-red-600"
                                    title="Hapus foto"
                                >
                                    <span className="material-symbols-outlined font-bold" style={{ fontSize: 14 }}>close</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Lightbox */}
            {lightboxIdx != null && photos[lightboxIdx] && (
                <Lightbox
                    photo={photos[lightboxIdx]}
                    source={sourceOf.get(photos[lightboxIdx].row_uid)}
                    index={lightboxIdx}
                    count={photos.length}
                    onClose={close}
                    onPrev={goPrev}
                    onNext={goNext}
                    onCaption={handleCaption}
                    onTouchStart={e => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
                    onTouchEnd={e => {
                        if (touchStartX.current == null) return;
                        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
                        touchStartX.current = null;
                        if (Math.abs(dx) < 40) return;
                        if (dx > 0) goPrev(); else goNext();
                    }}
                />
            )}
        </div>
    );
}

function Lightbox({ photo, source, index, count, onClose, onPrev, onNext, onCaption, onTouchStart, onTouchEnd }: {
    photo: SheetPhoto;
    source?: PhotoRecordSource;
    index: number;
    count: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    onCaption: (id: string, caption: string) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
}) {
    const [draft, setDraft] = useState(photo.caption ?? '');
    useEffect(() => { setDraft(photo.caption ?? ''); }, [photo.id, photo.caption]);
    const chip = source ? KIND_CHIP[source.kind] : KIND_CHIP[photo.parent_kind];

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            onClick={onClose}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            <div className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white/90 text-xs font-semibold">
                {index + 1} / {count}
            </div>
            <button
                onClick={e => { e.stopPropagation(); onClose(); }}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-red-500 text-white/90 hover:text-white flex items-center justify-center backdrop-blur-sm cursor-pointer transition-all"
                aria-label="Tutup"
            >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
            {count > 1 && (
                <>
                    <button
                        onClick={e => { e.stopPropagation(); onPrev(); }}
                        className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white/90 flex items-center justify-center backdrop-blur-sm cursor-pointer transition-all"
                        aria-label="Sebelumnya"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 26 }}>chevron_left</span>
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); onNext(); }}
                        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white/90 flex items-center justify-center backdrop-blur-sm cursor-pointer transition-all"
                        aria-label="Berikutnya"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 26 }}>chevron_right</span>
                    </button>
                </>
            )}
            <div className="relative flex flex-col items-center gap-3 w-full max-w-4xl max-h-[92vh]" onClick={e => e.stopPropagation()}>
                <div className="relative overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 bg-black/40 flex items-center justify-center w-full" style={{ height: 'min(70vh, calc(92vh - 160px))' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={photoSrc(photo.id)}
                        alt={photo.caption || photo.filename}
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-full object-contain"
                    />
                    {/* Label sumber di lightbox */}
                    <div className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${chip.cls}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{chip.icon}</span>
                        {chip.label}
                        {source?.tanggalRaw && <span className="opacity-80">· {source.tanggalRaw}</span>}
                    </div>
                </div>
                {source?.uraian && (
                    <p className="w-full max-w-3xl text-center text-xs text-white/70 line-clamp-2">{source.uraian}</p>
                )}
                <div className="w-full max-w-3xl bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/80 rounded-xl shadow-xl px-4 py-3">
                    <textarea
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={() => { const v = draft.trim(); if (v !== (photo.caption ?? '').trim()) onCaption(photo.id, v); }}
                        placeholder="Tambahkan keterangan foto…"
                        rows={2}
                        className="w-full resize-none text-sm font-medium text-white placeholder-neutral-400 outline-none bg-transparent border-0 focus:ring-0"
                        aria-label="Keterangan foto"
                    />
                </div>
            </div>
        </div>
    );
}
