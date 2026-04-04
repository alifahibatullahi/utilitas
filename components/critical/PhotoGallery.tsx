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
      <div className="flex flex-wrap gap-1.5">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group flex-shrink-0">
            <button
              onClick={() => setLightboxUrl(photo.url)}
              className="block rounded-md overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
              title={photo.filename}
            >
              <Image
                src={photo.url}
                alt={photo.filename}
                width={thumbSize}
                height={thumbSize}
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
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white
                           flex items-center justify-center opacity-0 group-hover:opacity-100
                           transition-opacity disabled:opacity-50 hover:bg-rose-600"
                title="Hapus foto"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
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
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white
                         flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
