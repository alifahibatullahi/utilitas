'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOperator } from '@/hooks/useOperator';
import { compressImage } from '@/lib/image-compression';
import { fetchSheetPhotos, photoProxySrc, photoSrc, type SheetPhoto } from './types';

/** Record (satu baris sheet) yang jadi pemilik foto. */
export interface PhotoRecordTarget {
    uid: string;
    kind: 'critical' | 'maintenance';
    itemKey: string;
    itemName: string;
    tanggalRaw: string;
    uraian: string;
}

interface RecordPhotoModalProps {
    record: PhotoRecordTarget;
    onClose: () => void;
    /** Dipanggil tiap jumlah foto berubah, supaya daftar di belakang ikut ter-update. */
    onCountChange?: (uid: string, count: number) => void;
}

const KIND_CHIP: Record<'critical' | 'maintenance', { label: string; cls: string; icon: string }> = {
    critical: { label: 'Critical', cls: 'bg-red-600 text-white', icon: 'warning' },
    maintenance: { label: 'Maintenance', cls: 'bg-neutral-800 text-white', icon: 'build' },
};

/**
 * Galeri + upload foto untuk SATU record critical/maintenance.
 *
 * Ini jalur upload satu-satunya: operator sampai ke sini dari menu di spreadsheet
 * (lewat feed "Aktivitas Terbaru" atau deep-link `?foto=<uid>`). Setelah upload, API
 * menulis balik kolom "Link Foto" baris tersebut di spreadsheet.
 */
export default function RecordPhotoModal({ record, onClose, onCountChange }: RecordPhotoModalProps) {
    const { operator } = useOperator();
    const [photos, setPhotos] = useState<SheetPhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const chip = KIND_CHIP[record.kind];

    // Foto baru diambil saat modal dibuka — bukan saat daftar dirender — supaya
    // membuka halaman daftar tidak menarik seluruh foto sekaligus.
    // Pemanggil memberi key={record.uid} sehingga ganti record = remount; `loading`
    // sudah true dari state awal dan tidak perlu di-set ulang di dalam effect.
    useEffect(() => {
        let cancelled = false;
        fetchSheetPhotos([record.uid])
            .then(p => { if (!cancelled) setPhotos(p); })
            .catch(() => { if (!cancelled) setError('Gagal memuat foto'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [record.uid]);

    const update = useCallback((next: SheetPhoto[]) => {
        setPhotos(next);
        onCountChange?.(record.uid, next.length);
    }, [onCountChange, record.uid]);

    async function handleFiles(files: FileList | null) {
        if (!files || files.length === 0) return;
        setError(null);
        setUploading(true);
        let next = photos;
        for (const file of Array.from(files)) {
            const compressed = await compressImage(file).catch(() => file);
            const form = new FormData();
            form.append('file', compressed);
            form.append('parent_kind', record.kind);
            form.append('row_uid', record.uid);
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
        if (!res.ok) { setError('Gagal menghapus foto'); return; }
        setPhotos(prev => {
            const next = prev.filter(p => p.id !== id);
            onCountChange?.(record.uid, next.length);
            return next;
        });
        setLightboxIdx(null);
    }, [onCountChange, record.uid]);

    const handleCaption = useCallback(async (id: string, caption: string) => {
        const res = await fetch(`/api/sheet-photos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caption }),
        });
        if (res.ok) {
            setPhotos(prev => prev.map(p => (p.id === id ? { ...p, caption: caption || null } : p)));
        }
    }, []);

    async function copyLink() {
        const url = `${window.location.origin}/critical-maintenance?item=${encodeURIComponent(record.itemKey)}&foto=${encodeURIComponent(record.uid)}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            setError('Browser menolak akses clipboard — salin manual dari address bar.');
        }
    }

    // Esc menutup lightbox dulu, baru modal.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                if (lightboxIdx != null) setLightboxIdx(null);
                else onClose();
            } else if (lightboxIdx != null && e.key === 'ArrowLeft') {
                setLightboxIdx(i => (i == null ? i : (i - 1 + photos.length) % photos.length));
            } else if (lightboxIdx != null && e.key === 'ArrowRight') {
                setLightboxIdx(i => (i == null ? i : (i + 1) % photos.length));
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxIdx, photos.length, onClose]);

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <div
                className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header record */}
                <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 sm:px-5 py-3">
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${chip.cls}`}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{chip.icon}</span>
                                    {chip.label}
                                </span>
                                <span className="text-[11px] font-semibold text-neutral-500">{record.tanggalRaw || '—'}</span>
                            </div>
                            <p className="text-sm font-bold text-neutral-900 mt-1 leading-snug">{record.uraian || '(tanpa uraian)'}</p>
                            {record.itemName && (
                                <p className="text-[11px] text-neutral-400 font-medium mt-0.5 truncate">{record.itemName}</p>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 shrink-0 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 flex items-center justify-center cursor-pointer transition-colors"
                            aria-label="Tutup"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mt-3">
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
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 cursor-pointer transition-colors"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{uploading ? 'more_horiz' : 'add_a_photo'}</span>
                            {uploading ? 'Mengupload…' : 'Upload foto'}
                        </button>
                        {photos.length > 0 && (
                            <button
                                onClick={copyLink}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-neutral-100 border border-neutral-300 text-neutral-600 hover:bg-neutral-200 cursor-pointer transition-colors"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{copied ? 'check' : 'link'}</span>
                                {copied ? 'Tersalin' : 'Salin link'}
                            </button>
                        )}
                        <span className="text-[10px] font-semibold text-neutral-400">
                            {loading ? 'Memuat…' : `${photos.length} foto`}
                        </span>
                        {error && <span className="text-[10px] text-red-600 font-medium">{error}</span>}
                    </div>
                </div>

                {/* Grid foto */}
                <div className="px-4 sm:px-5 py-4">
                    {loading ? (
                        <p className="py-8 text-center text-sm text-neutral-400 font-medium">Memuat foto…</p>
                    ) : photos.length === 0 ? (
                        <div className="py-8 text-center">
                            <span className="material-symbols-outlined text-neutral-300" style={{ fontSize: 40 }}>photo_camera</span>
                            <p className="text-sm text-neutral-400 font-medium mt-1">Belum ada foto untuk record ini.</p>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                                Setelah upload, kolom <span className="font-semibold">Link Foto</span> di spreadsheet terisi otomatis.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {photos.map((photo, idx) => (
                                <div key={photo.id} className="relative group aspect-square">
                                    <button
                                        onClick={() => setLightboxIdx(idx)}
                                        className="block w-full h-full rounded-xl overflow-hidden border border-neutral-200 hover:border-neutral-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-neutral-100 cursor-pointer"
                                        title={photo.caption || photo.filename}
                                    >
                                        <PhotoImg photo={photo} className="w-full h-full object-cover" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(photo.id)}
                                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 scale-90 group-hover:scale-100 transition-all hover:bg-red-600 cursor-pointer"
                                        title="Hapus foto"
                                    >
                                        <span className="material-symbols-outlined font-bold" style={{ fontSize: 14 }}>close</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {lightboxIdx != null && photos[lightboxIdx] && (
                <Lightbox
                    key={photos[lightboxIdx].id}
                    photo={photos[lightboxIdx]}
                    index={lightboxIdx}
                    count={photos.length}
                    onClose={() => setLightboxIdx(null)}
                    onPrev={() => setLightboxIdx(i => (i == null ? i : (i - 1 + photos.length) % photos.length))}
                    onNext={() => setLightboxIdx(i => (i == null ? i : (i + 1) % photos.length))}
                    onCaption={handleCaption}
                />
            )}
        </div>
    );
}

/** <img> yang memuat langsung dari R2 dan jatuh ke proxy backend kalau domain R2 diblokir. */
export function PhotoImg({ photo, className }: { photo: SheetPhoto; className?: string }) {
    const [src, setSrc] = useState(() => photoSrc(photo));
    useEffect(() => { setSrc(photoSrc(photo)); }, [photo]);
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={photo.caption || photo.filename}
            className={className}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setSrc(prev => (prev === photoProxySrc(photo.id) ? prev : photoProxySrc(photo.id)))}
        />
    );
}

function Lightbox({ photo, index, count, onClose, onPrev, onNext, onCaption }: {
    photo: SheetPhoto;
    index: number;
    count: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    onCaption: (id: string, caption: string) => void;
}) {
    // Di-remount lewat key={photo.id} saat foto berganti, jadi draft cukup dari state awal.
    const [draft, setDraft] = useState(photo.caption ?? '');
    const touchStartX = useRef<number | null>(null);

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            onClick={onClose}
            onTouchStart={e => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
            onTouchEnd={e => {
                if (touchStartX.current == null) return;
                const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
                touchStartX.current = null;
                if (Math.abs(dx) < 40) return;
                if (dx > 0) onPrev(); else onNext();
            }}
        >
            <div className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-full bg-black/40 text-white/90 text-xs font-semibold">
                {index + 1} / {count}
            </div>
            <button
                onClick={e => { e.stopPropagation(); onClose(); }}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-red-500 text-white/90 flex items-center justify-center cursor-pointer transition-all"
                aria-label="Tutup"
            >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
            {count > 1 && (
                <>
                    <button
                        onClick={e => { e.stopPropagation(); onPrev(); }}
                        className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white/90 flex items-center justify-center cursor-pointer transition-all"
                        aria-label="Sebelumnya"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 26 }}>chevron_left</span>
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); onNext(); }}
                        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white/90 flex items-center justify-center cursor-pointer transition-all"
                        aria-label="Berikutnya"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 26 }}>chevron_right</span>
                    </button>
                </>
            )}
            <div className="relative flex flex-col items-center gap-3 w-full max-w-4xl max-h-[92vh]" onClick={e => e.stopPropagation()}>
                <div className="relative overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 bg-black/40 flex items-center justify-center w-full" style={{ height: 'min(70vh, calc(92vh - 160px))' }}>
                    <PhotoImg photo={photo} className="max-w-full max-h-full object-contain" />
                </div>
                <div className="w-full max-w-3xl bg-neutral-950/60 border border-neutral-800/80 rounded-xl shadow-xl px-4 py-3">
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
