'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
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

    function handlePhotoUploaded(p: PhotoRow) { setPhotos(prev => [p, ...prev]); }
    async function handlePhotoDeleted(id: string) {
        if (!deletePhoto) return;
        const res = await deletePhoto(id);
        if (!res.error) setPhotos(prev => prev.filter(p => p.id !== id));
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
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" />
            <div
                className="relative bg-white w-full max-w-7xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header — sama dengan CriticalDetailModal */}
                <div className="flex-shrink-0 bg-[#EAEFF5] border-b border-[#D8E2ED] px-8 py-5 flex items-start justify-between">
                    <div className="flex flex-col gap-3 w-full overflow-hidden">
                        <div className="flex items-center gap-3 overflow-x-auto light-scrollbar pr-4 pb-1">
                            <span className={`px-4 py-1.5 ${accentBg} text-white text-sm font-black rounded-full uppercase tracking-widest whitespace-nowrap shadow-sm`}>{tipeLabel}</span>
                            <h2 className="text-2xl font-black text-slate-800 whitespace-nowrap uppercase">ITEM : {getDisplayItem(workOrder.item)}</h2>
                            <span className="px-3 py-1 bg-white text-slate-700 text-sm font-bold rounded-full border border-slate-200 whitespace-nowrap">ID {tipeLabel.toUpperCase()} : #{workOrder.id.slice(0, 8).toUpperCase()}</span>
                            <StatusBadge status={workOrder.status} solid className="px-3 py-1 text-sm shadow-sm" />
                        </div>
                        <div className="flex items-center gap-3 overflow-x-auto light-scrollbar pr-4 pb-1">
                            {workOrder.reported_by && (
                                <span className="px-3 py-1 bg-white text-slate-700 font-bold text-sm rounded-full border border-slate-200 whitespace-nowrap">
                                    👤 Yang Melaporkan : {workOrder.reported_by}
                                </span>
                            )}
                            <ScopeBadge scope={workOrder.scope} solid className="px-6 py-2 text-xl font-black shadow-sm" />
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="flex-shrink-0 ml-4 w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-[#D8E2ED] hover:bg-slate-100 text-slate-500 transition-colors shadow-sm">
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>close</span>
                    </button>
                </div>

                {/* Body — 3 kolom seperti critical */}
                <div className="overflow-y-auto light-scrollbar flex-1 bg-slate-50">
                    <div className="p-8 pb-32 flex flex-col gap-8 min-h-max">
                        {/* Meta info */}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                            <div className="bg-white p-4 rounded-2xl shadow-sm col-span-1">
                                <span className="text-xs uppercase font-black text-black block mb-1.5">Tanggal</span>
                                <span className="text-base font-bold text-slate-800">{formatDate(workOrder.date)}</span>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 col-span-4">
                                <span className="text-sm uppercase font-black text-black block mb-1.5">Deskripsi {tipeLabel}</span>
                                <span className="text-lg font-bold text-slate-800 leading-relaxed">{workOrder.deskripsi}</span>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm col-span-1">
                                <span className="text-xs uppercase font-black text-black block mb-1.5">Notif/SAP</span>
                                <span className="text-base font-bold text-slate-800">{workOrder.notif || '-'}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-[300px]">
                            {/* Pekerjaan column (2 spans) */}
                            <div className="md:col-span-2 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <span className={`material-symbols-outlined ${accentText}`}>handyman</span>
                                        Daftar Pekerjaan
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
                                            onClick={() => onAddPekerjaan?.(workOrder)}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${accentBg} ${accentHover} text-white text-xs font-bold transition-all shadow-sm ${accentShadow}`}
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
                                                    <div key={m.id} className="group relative p-3 rounded-xl border bg-[#FFFDF7] border-amber-200/60 shadow-sm hover:shadow-md">
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
                                                                <button onClick={() => handleEditNote(m)} className="w-9 h-9 rounded-lg flex items-center justify-center transition-all shadow-sm border text-blue-600 hover:text-white bg-blue-50 border-blue-200 hover:bg-blue-600 hover:border-transparent">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                                                                </button>
                                                                <button onClick={() => { if (confirm('Hapus note ini?')) onDeletePekerjaan?.(m.id); }} className="w-9 h-9 rounded-lg flex items-center justify-center transition-all shadow-sm border text-rose-600 hover:text-white bg-rose-50 border-rose-200 hover:bg-rose-600 hover:border-transparent">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={m.id} className={`group relative p-4 rounded-2xl border-2 transition-all duration-200 ${
                                                    isOk ? 'border-slate-200 shadow-sm bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#f1f5f9_10px,#f1f5f9_20px)]' : 'border-slate-300 shadow-sm hover:border-slate-400 hover:shadow-lg bg-white'
                                                }`}>
                                                    <div className={`flex items-center gap-4 ${isOk ? 'opacity-80' : ''}`}>
                                                        <div className={`flex-shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-xl border ${isOk ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
                                                            <span className={`text-xl font-black ${isOk ? 'text-slate-400' : 'text-black'}`}>#{pekerjaanIndex}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <div className="flex flex-wrap items-center gap-3 mb-3">
                                                                <span className={`text-base font-black uppercase tracking-wide ${
                                                                    m.scope === 'mekanik' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                                                                    m.scope === 'listrik' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                                                    m.scope === 'instrumen' ? 'text-purple-600 bg-purple-50 border-purple-200' :
                                                                    'text-teal-600 bg-teal-50 border-teal-200'
                                                                } px-2 py-0.5 rounded shadow-sm border`}>{m.scope}</span>
                                                                <span className={`text-lg font-black flex-1 ${isOk ? 'text-slate-400' : 'text-slate-800'}`}>{m.uraian}</span>
                                                                
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
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${isOk ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                                                                    {formatDate(m.date)}
                                                                </span>
                                                                {m.notif && (
                                                                    <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${isOk ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-100 text-indigo-800 border-indigo-200'}`}>
                                                                        Notif: {m.notif}
                                                                    </span>
                                                                )}
                                                                {m.reported_by && (
                                                                    <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${isOk ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-teal-100 text-teal-800 border-teal-200'}`}>
                                                                        👤 {m.reported_by}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className={`flex-shrink-0 flex flex-col gap-2 min-w-[100px] border-l pl-4 ${isOk ? 'border-slate-200' : 'border-slate-100'}`}>
                                                            <button onClick={() => onEditPekerjaan?.(m)} className={`w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-sm shadow-sm border ${isOk ? 'text-slate-400 bg-slate-100 border-slate-200 hover:bg-slate-200' : 'text-blue-600 hover:text-white bg-blue-50 border-blue-200 hover:bg-blue-600 hover:border-transparent'}`}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>Edit
                                                            </button>
                                                            <button onClick={() => handleDeletePekerjaan(m)} className={`w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-sm shadow-sm border ${isOk ? 'text-slate-400 bg-slate-100 border-slate-200 hover:bg-slate-200' : 'text-rose-600 hover:text-white bg-rose-50 border-rose-200 hover:bg-rose-600 hover:border-transparent'}`}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>Hapus
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
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
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
                                            logs={workOrder.work_order_activity_logs ?? []}
                                            onAddNote={async (note, actor) => {
                                                if (addActivityNote) return addActivityNote(workOrder.id, note, actor);
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowNoteForm(false)}>
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
