'use client';

import { useRef, useState } from 'react';
import type { PhotoRow } from '@/lib/supabase/types';

interface PhotoUploadButtonProps {
  criticalId?:     string;
  maintenanceId?:  string;
  uploadedBy?:     string;
  onUploadSuccess: (photo: PhotoRow) => void;
}

export default function PhotoUploadButton({
  criticalId,
  maintenanceId,
  uploadedBy,
  onUploadSuccess,
}: PhotoUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      if (criticalId)    form.append('critical_id',    criticalId);
      if (maintenanceId) form.append('maintenance_id', maintenanceId);
      if (uploadedBy)    form.append('uploaded_by',    uploadedBy);

      try {
        const res  = await fetch('/api/upload', { method: 'POST', body: form });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? 'Upload gagal');
          break;
        }
        onUploadSuccess(json.photo as PhotoRow);
      } catch {
        setError('Gagal terhubung ke server');
        break;
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="flex items-center gap-1.5">
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                   bg-violet-600 text-white hover:bg-violet-700 shadow-sm
                   transition-all disabled:opacity-50"
        title="Upload foto"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          {uploading ? 'more_horiz' : 'cloud_upload'}
        </span>
        {uploading ? 'Mengupload...' : 'Upload Foto'}
      </button>
      {error && (
        <span className="text-[9px] text-rose-600 font-medium">{error}</span>
      )}
    </div>
  );
}
