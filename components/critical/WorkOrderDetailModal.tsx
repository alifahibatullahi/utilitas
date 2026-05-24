'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { capitalizeFirst } from '@/lib/utils';
import type { WorkOrderWithPekerjaan, MaintenanceLogRow, PhotoRow } from '@/lib/supabase/types';
import StatusBadge from './StatusBadge';
import ScopeBadge from './ScopeBadge';
import PhotoGallery from './PhotoGallery';
import PhotoUploadButton from './PhotoUploadButton';
import ActivityTimelineImproved from './ActivityTimelineImproved';
import { useEquipmentItems } from '@/hooks/useMasterData';
import ClickableStatusDropdown from './ClickableStatusDropdown';

const PEKERJAAN_STATUS_OPTIONS = [
    { value: 'OPEN', label: 'OPEN', color: 'bg-rose-500 text-white' },
    { value: 'IP', label: 'IN PROGRESS', color: 'bg-amber-500 text-white' },
    { value: 'OK', label: 'SELESAI', color: 'bg-slate-600 text-white' },
];

function formatDate(d: string) {
    if (!d) return '-';
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface WorkOrderDetailModalProps {
    workOrder: WorkOrderWithPekerjaan;
    rowIndex?: number;
    onClose: () => void;
    onEditPekerjaan?: (m: MaintenanceLogRow) => void;
    onDeletePekerjaan?: (id: string) => Promise<void>;
    onAddPekerjaan?: (wo: WorkOrderWithPekerjaan) => void;
    onRefresh?: () => Promise<void>;
    fetchPhotos?: (workOrderId: string) => Promise<PhotoRow[]>;
    deletePhoto?: (id: string) => Promise<{ error: string | null }>;
    operatorName?: string;
    addActivityNote?: (workOrderId: string, note: string, actor?: string | null) => Promise<{ error: string | null }>;
    onChangePekerjaanStatus?: (id: string, newStatus: 'OPEN' | 'IP' | 'OK', actor?: string | null) => Promise<{ error: string | null }>;
}

export default function WorkOrderDetailModal({
    workOrder, onClose, onEditPekerjaan, onDeletePekerjaan, onAddPekerjaan,
    onRefresh, fetchPhotos, deletePhoto, operatorName, addActivityNote, onChangePekerjaanStatus,
}: WorkOrderDetailModalProps) {
    const { items: equipmentItems } = useEquipmentItems();

    function getDisplayItem(rawItem: string) {
        if (!rawItem) return '-';
        if (rawItem.includes(' - ')) return rawItem;
        const found = equipmentItems.find(it => it.deskripsi === rawItem);
        if (found && found.no_item) return `${found.no_item} - ${found.deskripsi}`;
        return rawItem;
    }

    const [pekerjaan, setPekerjaan] = useState([...workOrder.maintenance_logs].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    ));
    const [photos, setPhotos] = useState<PhotoRow[]>([]);
    const [photosLoaded, setPhotosLoaded] = useState(false);

    // Note (sticky note style)
    const [showNoteForm, setShowNoteForm] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [isSubmittingNote, setIsSubmittingNote] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

    // Dirty tracking — set true tiap kali user bikin perubahan, di-clear oleh tombol Simpan
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);
    const markDirty = () => setDirty(true);

    async function handleSaveAll() {
        setSaving(true);
        if (onRefresh) await onRefresh();
        setDirty(false);
        setSaving(false);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
    }

    function handleClose() {
        if (dirty) {
            const ok = confirm('Ada perubahan terbaru di sesi ini. Tutup tanpa Simpan ulang?\n\n(Catatan: perubahan kamu sudah otomatis tersimpan ke database. Tombol Simpan hanya untuk refresh tampilan.)');
            if (!ok) return;
        }
        onClose();
    }

    useEffect(() => {
        setPekerjaan([...workOrder.maintenance_logs].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        ));
    }, [workOrder.maintenance_logs]);

    useEffect(() => {
        if (!fetchPhotos) { setPhotosLoaded(true); return; }
        fetchPhotos(workOrder.id).then(p => { setPhotos(p); setPhotosLoaded(true); });
    }, [fetchPhotos, workOrder.id]);

    const isPreventif = workOrder.tipe === 'preventif';
    const accentBg = isPreventif ? 'bg-emerald-500' : 'bg-violet-500';
    const accentText = isPreventif ? 'text-emerald-500' : 'text-violet-500';
    const accentHover = isPreventif ? 'hover:bg-emerald-600' : 'hover:bg-violet-600';
    const accentShadow = isPreventif ? 'shadow-emerald-500/20' : 'shadow-violet-500/20';
    const tipeLabel = isPreventif ? 'Preventif' : 'Modifikasi';

    // Count non-note pekerjaan
    const realPekerjaan = pekerjaan.filter(p => p.keterangan !== 'IS_NOTE' && p.item !== 'NOTE');

    async function updatePekerjaanStatus(id: string, newStatus: 'OPEN' | 'IP' | 'OK', idx: number) {
        setPekerjaan(prev => {
            const n = [...prev];
            n[idx] = { ...n[idx], status: newStatus };
            return n;
        });
        // Use centralized hook callback so activity log is properly recorded
        if (onChangePekerjaanStatus) {
            const result = await onChangePekerjaanStatus(id, newStatus, operatorName ?? null);
            if (result.error) {
                alert('Gagal mengubah status');
                setPekerjaan([...workOrder.maintenance_logs].sort(
                    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                ));
            } else {
                markDirty();
            }
        } else {
            // Fallback: direct Supabase update (no activity log)
            const supabase = createClient();
            const { error } = await supabase.from('maintenance_logs').update({ status: newStatus }).eq('id', id);
            if (error) {
                alert('Gagal mengubah status');
                setPekerjaan([...workOrder.maintenance_logs].sort(
                    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                ));
            } else {
                await onRefresh?.();
            }
        }
    }

    function handleDeletePekerjaan(m: MaintenanceLogRow) {
        const isLastReal = realPekerjaan.length === 1 && realPekerjaan[0].id === m.id;
        const message = isLastReal
            ? `Ini adalah pekerjaan terakhir. Menghapusnya akan menghapus ${tipeLabel} "${workOrder.item}" secara keseluruhan.\n\nLanjutkan hapus?`
            : 'Hapus pekerjaan ini?';
        if (confirm(message)) onDeletePekerjaan?.(m.id);
    }

    function handlePhotoUploaded(p: PhotoRow) { setPhotos(prev => [p, ...prev]); markDirty(); }
    async function handlePhotoDeleted(id: string) {
        if (!deletePhoto) return;
        const res = await deletePhoto(id);
        if (!res.error) { setPhotos(prev => prev.filter(p => p.id !== id)); markDirty(); }
    }
    async function handleCaptionUpdated(id: string, caption: string) {
        setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p));
        try {
            const res = await fetch(`/api/upload/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caption }),
            });
            if (!res.ok) throw new Error('failed');
            markDirty();
        } catch {
            if (fetchPhotos) {
                const fresh = await fetchPhotos(workOrder.id);
                setPhotos(fresh);
            }
        }
    }

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
                .update({ uraian: noteUraian }).eq('id', editingNoteId).select().single();
            setIsSubmittingNote(false);
            if (!error && data) {
                setPekerjaan(prev => prev.map(m => m.id === editingNoteId ? data as MaintenanceLogRow : m));
                setShowNoteForm(false); setNoteText(''); setEditingNoteId(null);
                await onRefresh?.();
            } else { alert('Gagal mengupdate note'); }
        } else {
            const today = new Date().toISOString().slice(0, 10);
            const { data, error } = await supabase.from('maintenance_logs').insert({
                shift_report_id: null, critical_id: null, work_order_id: workOrder.id,
                date: today, item: 'NOTE', uraian: noteUraian,
                scope: workOrder.scope, foreman: workOrder.foreman, tipe: workOrder.tipe,
                status: 'OK', keterangan: 'IS_NOTE', notif: null,
                reported_by: operatorName ?? null,
            }).select().single();
            setIsSubmittingNote(false);
            if (!error && data) {
                setPekerjaan(prev => [...prev, data as MaintenanceLogRow]);
                setShowNoteForm(false); setNoteText('');
                await onRefresh?.();
            } else { alert('Gagal menambah note'); }
        }
    }    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onClick={handleClose}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <div
                className="relative bg-white w-full max-w-7xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100"
                onClick={e => e.stopPropagation()}
            >
                {/* Header — matching gradient depending on tipe (preventif / modifikasi) */}
                <div className={`flex-shrink-0 bg-gradient-to-r ${isPreventif ? 'from-emerald-50/90' : 'from-violet-50/90'} via-slate-50/90 to-white/80 border-b border-slate-200 border-l-[6px] ${isPreventif ? 'border-l-emerald-500' : 'border-l-violet-500'} px-8 py-5 flex items-start justify-between backdrop-blur-md`}>
                    <div className="flex flex-col gap-3 w-full overflow-hidden">
                        <div className="flex items-center gap-3 overflow-x-auto light-scrollbar pr-4 pb-1">
                            <span className={`px-4 py-1.5 ${accentBg} text-white text-xs font-black rounded-full uppercase tracking-widest whitespace-nowrap shadow-sm flex items-center gap-2`}>
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>
                                {tipeLabel}
                            </span>
                            <h2 className="text-2xl font-black text-slate-800 whitespace-nowrap uppercase tracking-tight">
                                ITEM : <span className={accentText}>{getDisplayItem(workOrder.item)}</span>
                            </h2>
                            <span className="px-3 py-1 bg-white/85 text-slate-700 text-xs font-extrabold rounded-full border border-slate-200/80 whitespace-nowrap shadow-sm">
                                ID {tipeLabel.toUpperCase()} : #{workOrder.id.slice(0, 8).toUpperCase()}
                            </span>
                            <StatusBadge status={workOrder.status} solid className="px-3 py-1 text-xs shadow-sm font-bold" />
                        </div>
                        <div className="flex items-center gap-3 overflow-x-auto light-scrollbar pr-4 pb-1">
                            {workOrder.reported_by && (
                                <span className="px-3 py-1 bg-white/90 text-slate-600 font-bold text-xs rounded-full border border-slate-250/80 whitespace-nowrap flex items-center gap-1.5 shadow-sm">
                                    <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>person</span>
                                    Melaporkan : <span className="text-slate-800 font-black">{workOrder.reported_by}</span>
                                </span>
                            )}
                            <ScopeBadge scope={workOrder.scope} solid className="px-4 py-1 text-xs font-extrabold shadow-sm" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        <button
                            onClick={handleSaveAll}
                            disabled={saving}
                            className={`px-4 h-10 flex items-center gap-1.5 rounded-xl text-sm font-bold border transition-all duration-150 shadow-sm cursor-pointer disabled:opacity-50 ${
                                savedFlash
                                    ? 'bg-emerald-50 border-emerald-400 text-white'
                                    : dirty
                                    ? `${accentBg} border-transparent text-white ${accentHover} hover:shadow-md ${accentShadow}`
                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                            title={dirty ? 'Refresh tampilan & tandai sudah disimpan' : 'Tidak ada perubahan'}
                        >
                            {saving ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                                    Menyimpan…
                                </>
                            ) : savedFlash ? (
                                <>
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                                    Tersimpan
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
                                    {dirty ? 'Simpan' : 'Tersimpan'}
                                </>
                            )}
                        </button>
                        <button onClick={handleClose}
                            className="group w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-rose-500 hover:border-rose-400 hover:scale-110 hover:shadow-rose-500/30 text-slate-500 hover:text-white transition-all duration-150 shadow-sm hover:shadow-md cursor-pointer"
                            title={dirty ? 'Tutup (ada perubahan terbaru)' : 'Tutup'}>
                            <span className="material-symbols-outlined transition-transform group-hover:rotate-90" style={{ fontSize: 24 }}>close</span>
                        </button>
                    </div>
                </div>

                {/* Body — 3 kolom seperti critical */}
                <div className="overflow-y-auto detail-scrollbar flex-1 bg-slate-50">
                    <div className="p-8 pb-32 flex flex-col gap-8 min-h-max">
                        {/* Meta info Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                            <div className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-4 ${isPreventif ? 'border-l-emerald-500' : 'border-l-violet-500'} col-span-1 flex flex-col justify-between`}>
                                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <span className={`material-symbols-outlined ${accentText}`} style={{ fontSize: 16 }}>calendar_today</span>
                                    Tanggal
                                </span>
                                <span className="text-sm font-black text-slate-800 mt-2">{formatDate(workOrder.date)}</span>
                            </div>
                            <div className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-200 border-l-4 ${isPreventif ? 'border-l-emerald-500' : 'border-l-violet-500'} col-span-4 flex flex-col justify-between`}>
                                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <span className={`material-symbols-outlined ${accentText}`} style={{ fontSize: 16 }}>description</span>
                                    Deskripsi {tipeLabel}
                                </span>
                                <span className="text-base font-black text-slate-900 leading-relaxed mt-2">{workOrder.deskripsi}</span>
                            </div>
                            <div className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-4 ${isPreventif ? 'border-l-emerald-500' : 'border-l-violet-500'} col-span-1 flex flex-col justify-between`}>
                                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                                    <span className={`material-symbols-outlined ${accentText}`} style={{ fontSize: 16 }}>tag</span>
                                    Notif/SAP
                                </span>
                                <span className="text-sm font-black text-slate-800 mt-2">{workOrder.notif || '-'}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-[300px]">
                            {/* Pekerjaan column (2 spans) */}
                            <div className="md:col-span-2 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                        <span className={`material-symbols-outlined ${accentText}`}>handyman</span>
                                        Daftar Pekerjaan
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => { setEditingNoteId(null); setNoteText(''); setShowNoteForm(true); }}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm shadow-amber-500/20"
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_note</span>
                                            Note
                                        </button>
                                        <button
                                            onClick={() => onAddPekerjaan?.(workOrder)}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl ${accentBg} ${accentHover} text-white text-xs font-bold transition-all shadow-sm ${accentShadow}`}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                            Tambah
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 rounded-2xl p-1 overflow-y-auto light-scrollbar flex flex-col gap-4">
                                    {pekerjaan.length === 0 ? (
                                        <div className="my-auto flex flex-col items-center justify-center text-slate-400 bg-slate-100/50 rounded-2xl border border-slate-200 p-8">
                                            <span className="material-symbols-outlined text-5xl mb-3 text-slate-300">engineering</span>
                                            <p className="text-base font-medium">Belum ada pekerjaan</p>
                                        </div>
                                    ) : (
                                        pekerjaan.map((m, idx) => {
                                            const isOk = m.status === 'OK';
                                            const isNote = m.keterangan === 'IS_NOTE' || m.item === 'NOTE';
                                            const pekerjaanIndex = isNote ? -1 : pekerjaan.slice(0, idx).filter(x => x.keterangan !== 'IS_NOTE' && x.item !== 'NOTE').length + 1;

                                            if (isNote) {
                                                return (
                                                    <div key={m.id} className="group relative p-4 rounded-2xl border bg-gradient-to-br from-amber-50/70 to-amber-100/30 border-amber-200/80 border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-all duration-205">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 text-amber-600">
                                                                <span className="material-symbols-outlined text-slate-300 mr-1" style={{ fontSize: 20 }}>drag_indicator</span>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>sticky_note_2</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0 pl-1">
                                                                <span className="text-base font-bold text-slate-800 break-words leading-relaxed">{capitalizeFirst(m.uraian)}</span>
                                                                {m.reported_by && (
                                                                    <span className="text-[10px] text-amber-800/70 block font-bold tracking-wide uppercase mt-1">
                                                                        — Oleh: {m.reported_by}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex-shrink-0 flex items-center gap-2 border-l border-amber-200/60 pl-3">
                                                                <button onClick={() => handleEditNote(m)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm border text-blue-600 hover:text-white bg-white hover:bg-blue-600 border-slate-200 hover:border-transparent">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                                                                </button>
                                                                <button onClick={() => { if (confirm('Hapus note ini?')) onDeletePekerjaan?.(m.id); }} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm border text-rose-600 hover:text-white bg-white hover:bg-rose-600 border-slate-200 hover:border-transparent">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            const scopeBorderColor = 
                                                m.scope === 'mekanik' ? 'border-l-blue-500' :
                                                m.scope === 'listrik' ? 'border-l-amber-500' :
                                                m.scope === 'instrumen' ? 'border-l-purple-500' : 'border-l-teal-500';

                                            return (
                                                <div key={m.id} className={`group relative p-5 rounded-2xl border border-slate-200 border-l-[6px] ${scopeBorderColor} transition-all duration-200 ${
                                                    isOk
                                                        ? 'bg-slate-50/70 opacity-90 shadow-sm border-slate-200 bg-[repeating-linear-gradient(45deg,#fcfdfe,#fcfdfe_8px,#f8fafc_8px,#f8fafc_16px)]'
                                                        : 'bg-white shadow-sm hover:shadow-lg hover:border-slate-350'
                                                }`}>
                                                    <div className="flex items-center gap-4">
                                                        {/* Left Section: Index / Checkmark */}
                                                        <div className="flex-shrink-0 flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 20 }}>drag_indicator</span>
                                                            <div className={`flex flex-col items-center justify-center w-9 h-9 rounded-xl border font-bold ${
                                                                isOk ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-800'
                                                            }`}>
                                                                {isOk ? (
                                                                    <span className="material-symbols-outlined font-black" style={{ fontSize: 18 }}>check</span>
                                                                ) : (
                                                                    <span className="text-sm font-black">#{pekerjaanIndex}</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Middle Section: Info & Title */}
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <div className="flex flex-wrap items-center gap-3 mb-2.5 break-words">
                                                                <span className={`text-xs font-black uppercase tracking-wider ${
                                                                    m.scope === 'mekanik' ? 'text-blue-700 bg-blue-50 border-blue-200/80' :
                                                                    m.scope === 'listrik' ? 'text-amber-700 bg-amber-50 border-amber-200/80' :
                                                                    m.scope === 'instrumen' ? 'text-purple-700 bg-purple-50 border-purple-200/80' :
                                                                    'text-teal-700 bg-teal-50 border-teal-200/80'
                                                                } px-2.5 py-1 rounded-lg border shadow-sm`}>{m.scope}</span>
                                                                
                                                                <span className={`text-lg font-bold leading-snug flex-1 ${isOk ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{capitalizeFirst(m.uraian)}</span>
                                                                
                                                                {/* Status Dropdown */}
                                                                <div className="relative flex-shrink-0">
                                                                    <ClickableStatusDropdown
                                                                        currentStatus={m.status}
                                                                        options={PEKERJAAN_STATUS_OPTIONS}
                                                                        onChange={(newStatus) => updatePekerjaanStatus(m.id, newStatus as 'OPEN' | 'IP' | 'OK', idx)}
                                                                        label="Status Pekerjaan"
                                                                    />
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Labels / Badges */}
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 border ${
                                                                    isOk ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 text-slate-600 border-slate-200/60'
                                                                }`}>
                                                                    <span className="material-symbols-outlined text-slate-400" style={{fontSize:14}}>event</span>
                                                                    {formatDate(m.date)}
                                                                </span>
                                                                {m.notif && (
                                                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                                                                        isOk ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-150'
                                                                    }`}>
                                                                        Notif: {m.notif}
                                                                    </span>
                                                                )}
                                                                {m.reported_by && (
                                                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 border ${
                                                                        isOk ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-teal-50 text-teal-700 border-teal-150'
                                                                    }`}>
                                                                        <span className="material-symbols-outlined text-teal-500/70" style={{fontSize:14}}>person</span>
                                                                        {m.reported_by}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {m.keterangan && (
                                                                <div className={`text-xs p-3 rounded-xl border mt-3 ${
                                                                    isOk ? 'text-slate-400 bg-slate-50/50 border-slate-100' : 'text-slate-600 bg-slate-50 border-slate-200/50'
                                                                }`}>
                                                                    <span className={`font-black block mb-1 uppercase tracking-wider text-[10px] ${isOk ? 'text-slate-400' : 'text-slate-500'}`}>Keterangan:</span>
                                                                    <p className="font-medium leading-relaxed">{m.keterangan}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-shrink-0 flex flex-col justify-center gap-2 min-w-[90px] border-l border-slate-150 pl-4">
                                                            <button
                                                                onClick={() => onEditPekerjaan?.(m)}
                                                                className={`w-full py-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-xs shadow-sm border ${
                                                                    isOk
                                                                        ? 'text-slate-400 bg-white border-slate-200 hover:bg-slate-50'
                                                                        : 'text-blue-600 bg-white border-slate-200 hover:bg-blue-600 hover:text-white hover:border-transparent'
                                                                }`}
                                                            >
                                                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeletePekerjaan(m)}
                                                                className={`w-full py-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-xs shadow-sm border ${
                                                                    isOk
                                                                        ? 'text-slate-400 bg-white border-slate-200 hover:bg-slate-50'
                                                                        : 'text-rose-600 bg-white border-slate-200 hover:bg-rose-600 hover:text-white hover:border-transparent'
                                                                }`}
                                                            >
                                                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
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

                            {/* Photos & Activity column */}
                            <div className="flex flex-col gap-6">
                                {/* Photos */}
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-purple-500">photo_library</span>
                                            Foto
                                        </h3>
                                        <PhotoUploadButton
                                            workOrderId={workOrder.id}
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
                                            <PhotoGallery photos={photos} onDelete={deletePhoto ? handlePhotoDeleted : undefined} onCaptionUpdate={handleCaptionUpdated} />
                                        )}
                                    </div>
                                </div>

                                {/* Activity logs */}
                                <div className="flex flex-col gap-3 flex-1 min-h-[300px]">
                                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-500">history</span>
                                        Riwayat Aktivitas
                                    </h3>
                                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex-1 flex flex-col">
                                        <ActivityTimelineImproved
                                            logs={workOrder.work_order_activity_logs ?? []}
                                            onAddNote={async (note, actor) => {
                                                if (!addActivityNote) return { error: 'Handler tidak tersedia' };
                                                const r = await addActivityNote(workOrder.id, note, actor);
                                                if (!r.error) markDirty();
                                                return r;
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowNoteForm(false)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100" onClick={e => e.stopPropagation()}>
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
                            <button onClick={() => setShowNoteForm(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Batal</button>
                            <button onClick={submitNote} disabled={isSubmittingNote || !noteText.trim()} className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2">
                                {isSubmittingNote ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>sync</span> : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>}
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
