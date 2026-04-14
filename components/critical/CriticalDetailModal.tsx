'use client';

import { useState, useEffect } from 'react';
import type { CriticalWithMaintenance, MaintenanceLogRow, PhotoRow } from '@/lib/supabase/types';
import StatusBadge from './StatusBadge';
import ScopeBadge from './ScopeBadge';
import PhotoGallery from './PhotoGallery';
import PhotoUploadButton from './PhotoUploadButton';

const ACTION_CONFIG: Record<string, { icon: string; color: string }> = {
    created:              { icon: 'flag',                    color: 'text-rose-500' },
    status_changed:       { icon: 'published_with_changes',  color: 'text-amber-500' },
    note:                 { icon: 'chat_bubble',             color: 'text-blue-500' },
    maintenance_added:    { icon: 'build_circle',            color: 'text-emerald-500' },
    maintenance_updated:  { icon: 'handyman',                color: 'text-purple-500' },
    maintenance_deleted:  { icon: 'remove_circle',           color: 'text-gray-400' },
};

function formatDate(d: string) {
    if (!d) return '-';
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'baru saja';
    if (mins < 60) return `${mins} mnt lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} hari lalu`;
    return `${Math.floor(days / 30)} bln lalu`;
}

interface CriticalDetailModalProps {
    critical: CriticalWithMaintenance;
    onClose: () => void;
    onEditMaintenance?: (m: MaintenanceLogRow) => void;
    onDeleteMaintenance?: (id: string) => Promise<void>;
    onAddMaintenance?: (critical: CriticalWithMaintenance) => void;
    fetchPhotos?: (type: 'critical', id: string) => Promise<PhotoRow[]>;
    deletePhoto?: (id: string) => Promise<{ error: string | null }>;
    operatorName?: string;
}

export default function CriticalDetailModal({
    critical, onClose, onEditMaintenance, onDeleteMaintenance, onAddMaintenance, fetchPhotos, deletePhoto, operatorName
}: CriticalDetailModalProps) {
    const [photos, setPhotos] = useState<PhotoRow[]>([]);
    const [photosLoaded, setPhotosLoaded] = useState(false);
    const [mLogs, setMLogs] = useState([...critical.maintenance_logs].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

    // Sync when maintenance logs change externally
    useEffect(() => {
        setMLogs([...critical.maintenance_logs].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    }, [critical.maintenance_logs]);

    useEffect(() => {
        let isMounted = true;
        async function loadPhotos() {
            if (fetchPhotos) {
                const p = await fetchPhotos('critical', critical.id);
                if (isMounted) {
                    setPhotos(p);
                    setPhotosLoaded(true);
                }
            }
        }
        loadPhotos();
        return () => { isMounted = false; };
    }, [critical.id, fetchPhotos]);

    function handlePhotoUploaded(photo: PhotoRow) {
        setPhotos(prev => [...prev, photo]);
    }

    async function handlePhotoDeleted(photoId: string) {
        if (!deletePhoto) return;
        const result = await deletePhoto(photoId);
        if (!result.error) {
            setPhotos(prev => prev.filter(p => p.id !== photoId));
        }
    }

    function handleDragStart(e: React.DragEvent, idx: number) {
        setDraggedIdx(idx);
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnter(idx: number) {
        if (draggedIdx === null || draggedIdx === idx) return;
        setMLogs(prev => {
            const next = [...prev];
            const item = next[draggedIdx];
            next.splice(draggedIdx, 1);
            next.splice(idx, 0, item);
            return next;
        });
        setDraggedIdx(idx);
    }

    function handleDragEnd() {
        setDraggedIdx(null);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <div
                className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header (Colorful) */}
                <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-xl font-extrabold truncate">{critical.item}</h2>
                            <StatusBadge status={critical.status} />
                            <ScopeBadge scope={critical.scope} />
                        </div>
                        <p className="text-blue-100 text-sm line-clamp-2">{critical.deskripsi}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-4 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                {/* Body container -> 3 cols / 2 rows */}
                <div className="p-6 overflow-y-auto light-scrollbar flex-1 bg-slate-50 flex flex-col gap-6">
                    
                    {/* Top Row: Meta info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tanggal</span>
                            <span className="text-sm font-semibold text-slate-800">{formatDate(critical.date)}</span>
                        </div>
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Notif/SAP</span>
                            <span className="text-sm font-semibold text-slate-800">{critical.notif || '-'}</span>
                        </div>
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 col-span-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Pelapor</span>
                            <span className="text-sm font-semibold text-slate-800">{critical.reported_by || '-'}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-[300px]">
                        {/* Maintenance Col (2 spans) */}
                        <div className="md:col-span-2 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-emerald-500">handyman</span>
                                    Log Maintenance
                                </h3>
                                <button
                                    onClick={() => onAddMaintenance?.(critical)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-500/20"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                    Tambah
                                </button>
                            </div>
                            
                            <div className="flex-1 bg-slate-100/50 rounded-2xl border border-slate-200 p-2 overflow-y-auto light-scrollbar flex flex-col gap-2">
                                {mLogs.length === 0 ? (
                                    <div className="my-auto flex flex-col items-center justify-center text-slate-400">
                                        <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">engineering</span>
                                        <p className="text-sm font-medium">Belum ada maintenance</p>
                                    </div>
                                ) : (
                                    mLogs.map((m, idx) => (
                                        <div
                                            key={m.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, idx)}
                                            onDragEnter={() => handleDragEnter(idx)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => e.preventDefault()}
                                            className={`group relative bg-white p-3 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing ${
                                                draggedIdx === idx ? 'border-blue-400 shadow-md scale-[1.02] z-10' : 'border-transparent shadow-sm border-slate-100 hover:border-slate-200'
                                            }`}
                                        >
                                            <div className="flex gap-3">
                                                <div className="flex-shrink-0 flex flex-col items-center justify-center w-6 opacity-30 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-[10px] font-black text-slate-400">#{idx + 1}</span>
                                                    <span className="material-symbols-outlined cursor-grab active:cursor-grabbing text-slate-400">drag_indicator</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between mb-1 gap-2">
                                                        <p className="text-sm font-semibold text-slate-800 break-words">{m.uraian}</p>
                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                m.status === 'OK' ? 'bg-emerald-100 text-emerald-700' :
                                                                m.status === 'IP' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-blue-100 text-blue-700'
                                                            }`}>{m.status}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                                                            {formatDate(m.date)}
                                                        </span>
                                                        <span className="font-medium text-slate-700">{m.tipe}</span>
                                                    </div>
                                                    {m.keterangan && (
                                                        <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                            {m.keterangan}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex-shrink-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => onEditMaintenance?.(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 bg-slate-50">
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                                    </button>
                                                    <button onClick={() => {
                                                        if (confirm('Hapus log maintenance ini?')) onDeleteMaintenance?.(m.id);
                                                    }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-slate-50">
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-6">
                            {/* Photos */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-purple-500">photo_library</span>
                                        Foto
                                    </h3>
                                    <PhotoUploadButton
                                        criticalId={critical.id}
                                        uploadedBy={operatorName}
                                        onUploadSuccess={handlePhotoUploaded}
                                    />
                                </div>
                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 min-h-[140px] flex flex-col">
                                    {!photosLoaded ? (
                                        <div className="my-auto flex items-center justify-center gap-2 text-slate-400 text-xs">
                                            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                                            Memuat foto...
                                        </div>
                                    ) : photos.length === 0 ? (
                                        <div className="my-auto flex flex-col items-center justify-center text-slate-300">
                                            <span className="material-symbols-outlined text-3xl mb-1">add_photo_alternate</span>
                                            <p className="text-xs font-medium">Belum ada foto</p>
                                        </div>
                                    ) : (
                                        <PhotoGallery photos={photos} onDelete={deletePhoto ? handlePhotoDeleted : undefined} />
                                    )}
                                </div>
                            </div>
                            
                            {/* Activity logs */}
                            <div className="flex flex-col gap-3 flex-1">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-500">history</span>
                                    Riwayat Aktivitas
                                </h3>
                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex-1 overflow-y-auto light-scrollbar">
                                    {critical.critical_activity_logs.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 py-4">
                                            <span className="material-symbols-outlined text-3xl mb-1">timeline</span>
                                            <p className="text-xs font-medium">Belum ada aktivitas</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {[...critical.critical_activity_logs]
                                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                .map(log => {
                                                    const cfg = ACTION_CONFIG[log.action_type] || { icon: 'info', color: 'text-slate-400' };
                                                    return (
                                                        <div key={log.id} className="flex items-start gap-2.5">
                                                            <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center bg-slate-50 border border-slate-100 flex-shrink-0 ${cfg.color}`}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{cfg.icon}</span>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-slate-700 leading-tight mb-0.5">{log.description}</p>
                                                                <p className="text-[10px] text-slate-400">
                                                                    {log.actor && <span className="font-medium text-slate-500 mr-1">{log.actor} •</span>}
                                                                    {timeAgo(log.created_at)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
