'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { PhotoRow } from '@/lib/supabase/types';

interface PhotoGalleryProps {
  photos: PhotoRow[];
  onDelete?: (id: string) => Promise<void>;
  compact?: boolean;
}

export default function PhotoGallery({ photos, onDelete, compact = false }: PhotoGalleryProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  if (photos.length === 0) return null;

  const thumbSize = compact ? 48 : 72;

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDelete?.(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group w-full aspect-square">
            <button
              onClick={() => setLightboxUrl(photo.url)}
              className="block w-full h-full rounded-xl overflow-hidden border-2 border-slate-100 hover:border-blue-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-400"
              title={photo.filename}
            >
              <Image
                src={photo.url}
                alt={photo.filename}
                fill
                className="object-cover"
              />
            </button>
            {photo.uploaded_via === 'whatsapp' && (
              <span
                className="absolute bottom-0.5 left-0.5 w-3 h-3 bg-green-500 rounded-full border border-white"
                title="Dikirim via WhatsApp"
              />
            )}
            {onDelete && (
              <button
                onClick={() => handleDelete(photo.id)}
                disabled={deletingId === photo.id}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-rose-500 text-white shadow-md
                           flex items-center justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100
                           transition-all disabled:opacity-50 hover:bg-rose-600"
                title="Hapus foto"
              >
                <span className="material-symbols-outlined font-bold" style={{ fontSize: 16 }}>
                  {deletingId === photo.id ? 'more_horiz' : 'close'}
                </span>
              </button>
            )}
          </div>
        ))}
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] w-full"
            onClick={e => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Preview"
              className="w-full h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-12 right-0 md:-right-12 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20
                         flex items-center justify-center transition-colors border border-white/20 backdrop-blur-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
