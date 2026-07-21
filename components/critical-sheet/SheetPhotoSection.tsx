'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOperator } from '@/hooks/useOperator';
import { compressImage } from '@/lib/image-compression';
import PhotoGallery from '@/components/critical/PhotoGallery';
import type { SheetPhoto } from './types';
import { fetchSheetPhotos } from './types';

interface SheetPhotoSectionProps {
    parentKind: 'critical' | 'maintenance';
    rowUid: string;
    /** Foto awal bila parent sudah memuatnya (skip fetch ulang). */
    initialPhotos?: SheetPhoto[];
    compact?: boolean;
    onCountChange?: (count: number) => void;
}

/**
 * Blok foto satu baris sheet: galeri + tombol upload.
 * Upload → POST /api/sheet-photos (R2); teks tetap di spreadsheet.
 */
export default function SheetPhotoSection({
    parentKind, rowUid, initialPhotos, compact = false, onCountChange,
}: SheetPhotoSectionProps) {
    const { operator } = useOperator();
    const [photos, setPhotos] = useState<SheetPhoto[]>(initialPhotos ?? []);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialPhotos) { setPhotos(initialPhotos); return; }
        if (!rowUid) return;
        let cancelled = false;
        fetchSheetPhotos([rowUid])
            .then(p => { if (!cancelled) setPhotos(p.filter(x => x.parent_kind === parentKind)); })
            .catch(() => { /* galeri kosong saja */ });
        return () => { cancelled = true; };
    }, [rowUid, parentKind, initialPhotos]);

    useEffect(() => { onCountChange?.(photos.length); }, [photos.length, onCountChange]);

    async function handleFiles(files: FileList | null) {
        if (!files || files.length === 0 || !rowUid) return;
        setError(null);
        setUploading(true);
        for (const file of Array.from(files)) {
            const compressed = await compressImage(file).catch(() => file);
            const form = new FormData();
            form.append('file', compressed);
            form.append('parent_kind', parentKind);
            form.append('row_uid', rowUid);
            if (operator?.name) form.append('uploaded_by', operator.name);
            try {
                const res = await fetch('/api/sheet-photos', { method: 'POST', body: form });
                const json = await res.json();
                if (!res.ok) { setError(json.error ?? 'Upload gagal'); break; }
                setPhotos(prev => [...prev, json.photo as SheetPhoto]);
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
        if (res.ok) setPhotos(prev => prev.filter(p => p.id !== id));
    }, []);

    const handleCaption = useCallback(async (id: string, caption: string) => {
        const res = await fetch(`/api/sheet-photos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caption }),
        });
        if (res.ok) setPhotos(prev => prev.map(p => (p.id === id ? { ...p, caption: caption || null } : p)));
    }, []);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
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
                    disabled={uploading || !rowUid}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                               bg-blue-600 text-white hover:bg-blue-700 shadow-sm
                               transition-all disabled:opacity-50 cursor-pointer"
                    title={rowUid ? 'Upload foto' : 'Baris belum punya ID (refresh data dulu)'}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        {uploading ? 'more_horiz' : 'add_a_photo'}
                    </span>
                    {uploading ? 'Mengupload…' : 'Tambah Foto'}
                </button>
                {photos.length > 0 && (
                    <span className="text-[10px] font-semibold text-slate-400">{photos.length} foto</span>
                )}
                {error && <span className="text-[10px] text-rose-600 font-medium">{error}</span>}
            </div>
            {photos.length > 0 ? (
                <PhotoGallery
                    photos={photos}
                    srcBase="/api/sheet-photos"
                    compact={compact}
                    onDelete={handleDelete}
                    onCaptionUpdate={handleCaption}
                />
            ) : (
                <p className="text-[11px] text-slate-400 italic">Belum ada foto.</p>
            )}
        </div>
    );
}
