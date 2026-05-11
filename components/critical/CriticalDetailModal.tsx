'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CriticalWithMaintenance, MaintenanceLogRow, PhotoRow } from '@/lib/supabase/types';
import StatusBadge from './StatusBadge';
import ScopeBadge from './ScopeBadge';
import PhotoGallery from './PhotoGallery';
import PhotoUploadButton from './PhotoUploadButton';
import ActivityTimelineImproved from './ActivityTimelineImproved';
import { useEquipmentItems } from '@/hooks/useMasterData';
import ClickableStatusDropdown from './ClickableStatusDropdown';

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
    rowIndex?: number;
    onClose: () => void;
    onEditMaintenance?: (m: MaintenanceLogRow) => void;
    onDeleteMaintenance?: (id: string) => Promise<void>;
    onAddMaintenance?: (critical: CriticalWithMaintenance) => void;
    onRefresh?: () => Promise<void>;
    fetchPhotos?: (type: 'critical', id: string) => Promise<PhotoRow[]>;
    deletePhoto?: (id: string) => Promise<{ error: string | null }>;
    operatorName?: string;
    addActivityNote?: (criticalId: string, note: string, actor?: string | null) => Promise<{ error: string | null }>;
}

export default function CriticalDetailModal({
    critical, rowIndex, onClose, onEditMaintenance, onDeleteMaintenance, onAddMaintenance, onRefresh, fetchPhotos, deletePhoto, operatorName, addActivityNote,
}: CriticalDetailModalProps) {
    const { items: equipmentItems } = useEquipmentItems();

    function getDisplayItem(rawItem: string) {
        if (!rawItem) return '-';
        if (rawItem.includes(' - ')) return rawItem;
        const found = equipmentItems.find(it => it.deskripsi === rawItem);
        if (found && found.no_item) return `${found.no_item} - ${found.deskripsi}`;
        return rawItem;
    }

    const ORDER_KEY = `mlog-order-${critical.id}`;

    function applySavedOrder(logs: MaintenanceLogRow[]): MaintenanceLogRow[] {
        try {
            const raw = localStorage.getItem(ORDER_KEY);
            if (raw) {
                const savedIds: string[] = JSON.parse(raw);
                const map = new Map(logs.map(m => [m.id, m]));
                const ordered: MaintenanceLogRow[] = [];
                // Place items in saved order first
                for (const id of savedIds) {
                    const item = map.get(id);
                    if (item) { ordered.push(item); map.delete(id); }
                }
                // Append any new items not in saved order
                for (const item of map.values()) ordered.push(item);
                return ordered;
            }
        } catch { /* ignore */ }
        return [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    function saveOrder(logs: MaintenanceLogRow[]) {
        try { localStorage.setItem(ORDER_KEY, JSON.stringify(logs.map(m => m.id))); } catch { /* quota */ }
    }

    const [photos, setPhotos] = useState<PhotoRow[]>([]);
    const [photosLoaded, setPhotosLoaded] = useState(false);
    const [mLogs, setMLogs] = useState(() => applySavedOrder(critical.maintenance_logs));
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [showNoteForm, setShowNoteForm] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [isSubmittingNote, setIsSubmittingNote] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

    function handleEditNote(m: MaintenanceLogRow) {
        setEditingNoteId(m.id);
        const text = m.uraian.startsWith('Note: ') ? m.uraian.substring(6) : m.uraian.startsWith('Note:') ? m.uraian.substring(5) : m.uraian;
        setNoteText(text);
        setShowNoteForm(true);
    }

    async function submitNote() {
        if (!noteText.trim()) return;
        setIsSubmittingNote(true);
        const supabase = createClient();
        const noteUraian = noteText.startsWith('Note:') ? noteText : `Note: ${noteText}`;
        
        if (editingNoteId) {
            const { data, error } = await supabase.from('maintenance_logs')
                .update({ uraian: noteUraian })
                .eq('id', editingNoteId)
                .select().single();
            setIsSubmittingNote(false);
            if (!error && data) {
                setMLogs(prev => {
                    const next = prev.map(m => m.id === editingNoteId ? data as MaintenanceLogRow : m);
                    saveOrder(next);
                    return next;
                });
                setShowNoteForm(false);
                setNoteText('');
                setEditingNoteId(null);
                await onRefresh?.();
            } else {
                alert('Gagal mengupdate note');
            }
        } else {
            const newLog = {
                critical_id: critical.id,
                date: new Date().toISOString().split('T')[0],
                item: 'NOTE',
                uraian: noteUraian,
                scope: critical.scope,
                foreman: critical.foreman,
                tipe: 'preventif',
                status: 'OPEN',
                keterangan: 'IS_NOTE',
                reported_by: operatorName || null
            };
            const { data, error } = await supabase.from('maintenance_logs').insert(newLog).select().single();
            setIsSubmittingNote(false);
            if (!error && data) {
                setMLogs(prev => {
                    const next = [...prev, data as MaintenanceLogRow];
                    saveOrder(next);
                    return next;
                });
                setShowNoteForm(false);
                setNoteText('');
                await onRefresh?.();
            } else {
                alert('Gagal menambah note');
            }
        }
    }

    async function updateMaintenanceStatus(id: string, newStatus: 'OPEN' | 'IP' | 'OK', idx: number) {
        // Optimistic local update
        setMLogs(prev => {
            const n = [...prev];
            n[idx] = { ...n[idx], status: newStatus };
            return n;
        });
        // Persist to Supabase
        const supabase = createClient();
        const { error } = await supabase.from('maintenance_logs').update({ status: newStatus }).eq('id', id);
        if (error) {
            alert('Gagal mengubah status');
            setMLogs(applySavedOrder(critical.maintenance_logs));
        } else {
            await onRefresh?.();
        }
    }

    // Sync when maintenance logs change externally — preserve saved order
    useEffect(() => {
        setMLogs(applySavedOrder(critical.maintenance_logs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Save order immediately after drag
        saveOrder(mLogs);
    }

    function handleClose() {
        saveOrder(mLogs);
        onClose();
    }

    const allScopes = Array.from(new Set([critical.scope, ...mLogs.map(m => m.scope)]));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onClick={handleClose}>
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" />
            <div
                className="relative bg-white w-full max-w-7xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-shrink-0 bg-[#EAEFF5] border-b border-[#D8E2ED] px-8 py-5 flex items-start justify-between">
                    <div className="flex flex-col gap-3 w-full overflow-hidden">
                        {/* Upper Part */}
                        <div className="flex items-center gap-3 overflow-x-auto light-scrollbar pr-4 pb-1">
                            <span className="px-4 py-1.5 bg-rose-500 text-white text-sm font-black rounded-full uppercase tracking-widest whitespace-nowrap shadow-sm">CRITICAL</span>
                            <h2 className="text-2xl font-black text-slate-800 whitespace-nowrap uppercase">ITEM : {getDisplayItem(critical.item)}</h2>
                            <span className="px-3 py-1 bg-white text-slate-700 text-sm font-bold rounded-full border border-slate-200 whitespace-nowrap">ID CRITICAL : #{critical.id.slice(0, 8).toUpperCase()}</span>
                            <StatusBadge status={critical.status} solid className="px-3 py-1 text-sm shadow-sm" />
                        </div>
                        {/* Lower Part */}
                        <div className="flex items-center gap-3 overflow-x-auto light-scrollbar pr-4 pb-1">
                            {critical.reported_by && (
                                <span className="px-3 py-1 bg-white text-slate-700 font-bold text-sm rounded-full border border-slate-200 whitespace-nowrap">
                                    👤 Yang Melaporkan : {critical.reported_by}
                                </span>
                            )}
                            {allScopes.map(s => (
                                <ScopeBadge key={s} scope={s} solid className="px-6 py-2 text-xl font-black shadow-sm" />
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="flex-shrink-0 ml-4 w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-[#D8E2ED] hover:bg-slate-100 text-slate-500 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>close</span>
                    </button>
                </div>

                {/* Body container -> 3 cols / 2 rows */}
                <div className="overflow-y-auto light-scrollbar flex-1 bg-slate-50">
                    <div className="p-8 pb-32 flex flex-col gap-8 min-h-max">
                        
                        {/* Top Row: Meta info */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                        <div className="bg-white p-4 rounded-2xl shadow-sm col-span-1">
                            <span className="text-xs uppercase font-black text-black block mb-1.5">Tanggal</span>
                            <span className="text-base font-bold text-slate-800">{formatDate(critical.date)}</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 col-span-4">
                            <span className="text-sm uppercase font-black text-black block mb-1.5">Deskripsi Critical</span>
                            <span className="text-lg font-bold text-slate-800 leading-relaxed">{critical.deskripsi}</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm col-span-1">
                            <span className="text-xs uppercase font-black text-black block mb-1.5">Notif/SAP</span>
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
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setEditingNoteId(null); setNoteText(''); setShowNoteForm(true); }}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm shadow-amber-500/20"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_note</span>
                                        Note
                                    </button>
                                    <button
                                        onClick={() => onAddMaintenance?.(critical)}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-500/20"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                        Tambah
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex-1 rounded-2xl p-1 overflow-y-auto light-scrollbar flex flex-col gap-4">
                                {mLogs.length === 0 ? (
                                    <div className="my-auto flex flex-col items-center justify-center text-slate-400 bg-slate-100/50 rounded-2xl border border-slate-200 p-8">
                                        <span className="material-symbols-outlined text-5xl mb-3 text-slate-300">engineering</span>
                                        <p className="text-base font-medium">Belum ada maintenance</p>
                                    </div>
                                ) : (
                                    mLogs.map((m, idx) => {
                                        const isOk = m.status === 'OK';
                                        const isNote = m.keterangan === 'IS_NOTE' || m.item === 'NOTE';
                                        // Compute maintenance-only index (notes excluded)
                                        const maintenanceIndex = isNote ? -1 : mLogs.slice(0, idx).filter(x => x.keterangan !== 'IS_NOTE' && x.item !== 'NOTE').length + 1;
                                        
                                        if (isNote) {
                                            return (
                                                <div
                                                    key={m.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, idx)}
                                                    onDragEnter={() => handleDragEnter(idx)}
                                                    onDragEnd={handleDragEnd}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    className={`group relative p-3 rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing active:scale-[0.98] active:shadow-inner active:translate-y-0 ${
                                                        draggedIdx === idx ? 'shadow-xl scale-[1.02] rotate-1 z-10 opacity-95 ring-4 ring-amber-400/30 bg-amber-50 border-amber-300' : 'shadow-sm hover:shadow-md hover:-translate-y-0.5 bg-[#FFFDF7] border-amber-200/60'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-amber-100 rounded-lg text-amber-600 shadow-sm border border-amber-200">
                                                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sticky_note_2</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[15px] font-black text-slate-800 break-words">{m.uraian}</span>
                                                            {m.reported_by && (
                                                                <span className="text-[10px] text-slate-500 block font-black tracking-wide uppercase mt-0.5">— {m.reported_by}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex-shrink-0 flex items-center gap-2 border-l border-amber-200/50 pl-3">
                                                            <button onClick={() => handleEditNote(m)} className="w-9 h-9 rounded-lg font-bold flex items-center justify-center transition-all text-sm shadow-sm border text-blue-600 hover:text-white bg-blue-50 border-blue-200 hover:bg-blue-600 hover:border-transparent">
                                                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                                                            </button>
                                                            <button onClick={() => {
                                                                if (confirm('Hapus note ini?')) onDeleteMaintenance?.(m.id);
                                                            }} className="w-9 h-9 rounded-lg font-bold flex items-center justify-center transition-all text-sm shadow-sm border text-rose-600 hover:text-white bg-rose-50 border-rose-200 hover:bg-rose-600 hover:border-transparent">
                                                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                        <div
                                            key={m.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, idx)}
                                            onDragEnter={() => handleDragEnter(idx)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => e.preventDefault()}
                                            className={`group relative p-4 rounded-2xl border-2 transition-all duration-200 cursor-grab active:cursor-grabbing active:scale-[0.98] active:shadow-inner active:translate-y-0 ${
                                                draggedIdx === idx ? 'border-emerald-400 shadow-2xl scale-[1.03] rotate-1 z-10 opacity-95 ring-4 ring-emerald-400/30 bg-white' : 
                                                (isOk ? 'border-slate-200 shadow-sm bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#f1f5f9_10px,#f1f5f9_20px)]' : 'border-slate-300 shadow-sm hover:border-slate-400 hover:shadow-lg hover:-translate-y-1 bg-white')
                                            }`}
                                        >
                                            <div className={`flex items-center gap-4 ${isOk ? 'opacity-80' : ''}`}>
                                                <div className={`flex-shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-xl border ${isOk ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
                                                    <span className={`text-xl font-black ${isOk ? 'text-slate-400' : 'text-black'}`}>#{maintenanceIndex}</span>
                                                </div>
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="flex flex-wrap items-center gap-3 mb-3 break-words">
                                                        <span className={`text-lg font-black uppercase tracking-wide ${
                                                            m.scope === 'mekanik' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                                                            m.scope === 'listrik' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                                            m.scope === 'instrumen' ? 'text-purple-600 bg-purple-50 border-purple-200' :
                                                            m.scope === 'sipil' ? 'text-teal-600 bg-teal-50 border-teal-200' : 'text-slate-500 bg-slate-50 border-slate-200'
                                                        } px-2 py-0.5 rounded shadow-sm border`}>{m.scope}</span>
                                                        <span className={`text-xl font-black leading-tight flex-1 ${isOk ? 'text-slate-400' : 'text-slate-800'}`}>{m.uraian}</span>
                                                        
                                                        {/* Status Dropdown Inline */}
                                                        <div className="relative flex-shrink-0">
                                                            <ClickableStatusDropdown
                                                                currentStatus={m.status}
                                                                options={[
                                                                    { value: 'OPEN', label: 'OPEN', color: 'bg-rose-500 text-white' },
                                                                    { value: 'IP', label: 'IN PROGRESS', color: 'bg-amber-500 text-white' },
                                                                    { value: 'OK', label: 'SELESAI', color: 'bg-slate-600 text-white' }
                                                                ]}
                                                                onChange={(newStatus) => updateMaintenanceStatus(m.id, newStatus as 'OPEN' | 'IP' | 'OK', idx)}
                                                                label="Status Pekerjaan"
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Labels */}
                                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                                        <span className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm border ${isOk ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                                                            <span className="material-symbols-outlined" style={{fontSize:14}}>event</span>
                                                            {formatDate(m.date)}
                                                        </span>
                                                        {m.notif && (
                                                            <span className={`px-3 py-1 text-xs font-bold rounded-lg shadow-sm border ${isOk ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-100 text-indigo-800 border-indigo-200'}`}>
                                                                Notif: {m.notif}
                                                            </span>
                                                        )}
                                                        {m.reported_by && (
                                                            <span className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm border ${isOk ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-teal-100 text-teal-800 border-teal-200'}`}>
                                                                <span className="material-symbols-outlined" style={{fontSize:14}}>person</span>
                                                                {m.reported_by}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {m.keterangan && (
                                                        <div className={`text-sm p-3 rounded-xl border mt-2 ${isOk ? 'text-slate-400 bg-slate-100 border-slate-200' : 'text-slate-600 bg-slate-50/80 border-slate-100'}`}>
                                                            <span className={`font-bold block mb-1 text-xs ${isOk ? 'text-slate-400' : 'text-slate-500'}`}>Keterangan:</span>
                                                            {m.keterangan}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`flex-shrink-0 flex flex-col justify-center gap-2 min-w-[100px] border-l pl-4 ${isOk ? 'border-slate-200' : 'border-slate-100'}`}>
                                                    <button onClick={() => onEditMaintenance?.(m)} className={`w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-sm shadow-sm border ${isOk ? 'text-slate-400 bg-slate-100 border-slate-200 hover:bg-slate-200 hover:text-slate-500' : 'text-blue-600 hover:text-white bg-blue-50 border-blue-200 hover:bg-blue-600 hover:border-transparent'}`}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                                                        Edit
                                                    </button>
                                                    <button onClick={() => {
                                                        if (confirm('Hapus log maintenance ini?')) onDeleteMaintenance?.(m.id);
                                                    }} className={`w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-sm shadow-sm border ${isOk ? 'text-slate-400 bg-slate-100 border-slate-200 hover:bg-slate-200 hover:text-slate-500' : 'text-rose-600 hover:text-white bg-rose-50 border-rose-200 hover:bg-rose-600 hover:border-transparent'}`}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                                                        Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })
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
                            <div className="flex flex-col gap-3 flex-1 min-h-[300px]">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-500">history</span>
                                    Riwayat Aktivitas
                                </h3>
                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex-1 flex flex-col">
                                    <ActivityTimelineImproved
                                        logs={critical.critical_activity_logs ?? []}
                                        onAddNote={async (note, actor) => {
                                            if (addActivityNote) return addActivityNote(critical.id, note, actor);
                                            return { error: 'Handler tidak tersedia' };
                                        }}
                                        operatorName={operatorName}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
            {/* Note Pop Up Form */}
            {showNoteForm && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm rounded-3xl" onClick={() => setShowNoteForm(false)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4 text-amber-600">
                            <span className="material-symbols-outlined text-3xl">edit_note</span>
                            <h3 className="text-xl font-black text-slate-800">{editingNoteId ? 'Edit Note' : 'Tambah Note Baru'}</h3>
                        </div>
                        <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            className="w-full border-2 border-slate-200 rounded-xl p-3 h-32 text-black focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 outline-none transition-all text-sm font-medium resize-none light-scrollbar"
                            placeholder="Ketik isi note..."
                            autoFocus
                        />
                        <div className="flex items-center justify-end gap-3 mt-5">
                            <button onClick={() => setShowNoteForm(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                            <button onClick={submitNote} disabled={isSubmittingNote || !noteText.trim()} className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                                {isSubmittingNote ? <span className="material-symbols-outlined animate-spin" style={{fontSize:18}}>sync</span> : <span className="material-symbols-outlined" style={{fontSize:18}}>save</span>}
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
