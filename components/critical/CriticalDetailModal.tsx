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

    const allScopes = Array.from(new Set([critical.scope, ...mLogs.map(m => m.scope)]));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" />
            <div
                className="relative bg-white w-full max-w-7xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header (Table-like, Black Bold text) */}
                <div className="flex-shrink-0 bg-[#EAEFF5] border-b border-[#D8E2ED] px-8 py-5 flex items-center justify-between text-slate-800">
                    <div className="flex items-center gap-3 overflow-x-auto light-scrollbar pr-4">
                        <h2 className="text-2xl font-black whitespace-nowrap">{critical.item}</h2>
                        <StatusBadge status={critical.status} className="px-4 py-1.5 text-base font-bold shadow-sm" />
                        {allScopes.map(s => (
                            <ScopeBadge key={s} scope={s} className="px-4 py-1.5 text-base font-bold shadow-sm" />
                        ))}
                        {critical.reported_by && (
                            <span className="px-4 py-1.5 bg-violet-100 text-violet-700 font-bold text-base rounded-full whitespace-nowrap shadow-sm">
                                👤 {critical.reported_by}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-[#D8E2ED] text-slate-500 hover:bg-slate-100 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>close</span>
                    </button>
                </div>

                {/* Body container -> 3 cols / 2 rows */}
                <div className="p-8 overflow-y-auto light-scrollbar flex-1 bg-slate-50 flex flex-col gap-8">
                    
                    {/* Top Row: Meta info */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 col-span-1">
                            <span className="text-xs uppercase font-extrabold text-slate-400 block mb-1.5">Tanggal</span>
                            <span className="text-base font-bold text-slate-800">{formatDate(critical.date)}</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border-rose-400 border-[1.5px] col-span-4">
                            <span className="text-sm uppercase font-extrabold text-slate-400 block mb-1.5">Deskripsi Critical</span>
                            <span className="text-lg font-bold text-slate-800 leading-relaxed">{critical.deskripsi}</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 col-span-1">
                            <span className="text-xs uppercase font-extrabold text-slate-400 block mb-1.5">Notif/SAP</span>
                            <span className="text-base font-bold text-slate-800">{critical.notif || '-'}</span>
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
                            
                            <div className="flex-1 rounded-2xl p-1 overflow-y-auto light-scrollbar flex flex-col gap-4">
                                {mLogs.length === 0 ? (
                                    <div className="my-auto flex flex-col items-center justify-center text-slate-400 bg-slate-100/50 rounded-2xl border border-slate-200 p-8">
                                        <span className="material-symbols-outlined text-5xl mb-3 text-slate-300">engineering</span>
                                        <p className="text-base font-medium">Belum ada maintenance</p>
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
                                            className={`group relative bg-white p-4 rounded-2xl border-2 transition-all cursor-grab active:cursor-grabbing ${
                                                draggedIdx === idx ? 'border-emerald-400 shadow-xl scale-[1.02] z-10 opacity-90' : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
                                            }`}
                                        >
                                            <div className="flex gap-4">
                                                <div className="flex-shrink-0 flex flex-col items-center justify-center w-10 bg-slate-50 rounded-xl border border-slate-100">
                                                    <span className="text-xl font-black text-slate-500 mb-1">#{idx + 1}</span>
                                                    <span className="material-symbols-outlined cursor-grab active:cursor-grabbing text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity pb-1">drag_indicator</span>
                                                </div>
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <h4 className="text-base font-extrabold text-slate-900 mb-3 break-words">
                                                        <span className={`font-bold ${
                                                            m.scope === 'mekanik' ? 'text-blue-600' :
                                                            m.scope === 'listrik' ? 'text-amber-600' :
                                                            m.scope === 'instrumen' ? 'text-purple-600' :
                                                            m.scope === 'sipil' ? 'text-teal-600' : 'text-slate-500'
                                                        }`}>{m.scope.charAt(0).toUpperCase() + m.scope.slice(1)} : </span>
                                                        <span className="text-slate-800 font-bold">{m.uraian}</span>
                                                    </h4>
                                                    
                                                    {/* Labels */}
                                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                                        <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm border border-amber-200">
                                                            <span className="material-symbols-outlined" style={{fontSize:14}}>event</span>
                                                            {formatDate(m.date)}
                                                        </span>
                                                        {m.notif && (
                                                            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-lg shadow-sm border border-indigo-200">
                                                                Notif: {m.notif}
                                                            </span>
                                                        )}
                                                        {m.reported_by && (
                                                            <span className="px-3 py-1 bg-teal-100 text-teal-800 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm border border-teal-200">
                                                                <span className="material-symbols-outlined" style={{fontSize:14}}>person</span>
                                                                {m.reported_by}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {m.keterangan && (
                                                        <div className="text-sm text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-100 mt-2">
                                                            <span className="font-bold text-slate-500 block mb-1 text-xs">Keterangan:</span>
                                                            {m.keterangan}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-shrink-0 flex flex-col justify-between items-end gap-3 min-w-[100px] border-l border-slate-100 pl-4">
                                                    <div className="w-full text-right">
                                                        <button 
                                                            onClick={() => {
                                                                const statuses: ('OPEN' | 'IP' | 'OK')[] = ['OPEN', 'IP', 'OK'];
                                                                const curr = statuses.indexOf(m.status);
                                                                const next = statuses[(curr + 1) % statuses.length];
                                                                setMLogs(prev => {
                                                                    const n = [...prev];
                                                                    n[idx] = { ...n[idx], status: next };
                                                                    return n;
                                                                });
                                                                // If a global callback exists, we'd fire it here. For now it updates locally.
                                                            }}
                                                            title="Klik untuk mengubah status"
                                                            className={`inline-block px-4 py-2 rounded-xl text-sm font-black border uppercase tracking-wider text-center w-full shadow-sm cursor-pointer hover:opacity-80 transition-opacity ${
                                                                m.status === 'OK' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                                                                m.status === 'IP' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                                                                'bg-blue-100 text-blue-700 border-blue-300'
                                                            }`}
                                                        >
                                                            {m.status}
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="flex flex-col gap-2 w-full mt-auto">
                                                        <button onClick={() => onEditMaintenance?.(m)} className="w-full py-1.5 rounded-lg text-slate-500 font-bold hover:text-blue-600 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 bg-slate-50 flex items-center justify-center gap-1.5 transition-colors text-xs">
                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                                            Edit
                                                        </button>
                                                        <button onClick={() => {
                                                            if (confirm('Hapus log maintenance ini?')) onDeleteMaintenance?.(m.id);
                                                        }} className="w-full py-1.5 rounded-lg text-slate-500 font-bold hover:text-rose-600 hover:bg-rose-50 border border-slate-100 hover:border-rose-200 bg-slate-50 flex items-center justify-center gap-1.5 transition-colors text-xs">
                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                                            Hapus
                                                        </button>
                                                    </div>
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
