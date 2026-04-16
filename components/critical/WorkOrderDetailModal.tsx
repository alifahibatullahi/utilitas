'use client';

import { useState, useEffect } from 'react';
import type { WorkOrderWithPekerjaan, MaintenanceLogRow } from '@/lib/supabase/types';
import ScopeBadge from './ScopeBadge';
import StatusBadge from './StatusBadge';

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
    operatorName?: string;
}

export default function WorkOrderDetailModal({
    workOrder, rowIndex, onClose, onEditPekerjaan, onDeletePekerjaan, onAddPekerjaan, operatorName,
}: WorkOrderDetailModalProps) {
    const [pekerjaan, setPekerjaan] = useState([...workOrder.maintenance_logs].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    ));

    useEffect(() => {
        setPekerjaan([...workOrder.maintenance_logs].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        ));
    }, [workOrder.maintenance_logs]);

    const isPreventif = workOrder.tipe === 'preventif';
    const accentColor = isPreventif ? 'emerald' : 'violet';
    const headerGradient = isPreventif ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-violet-500 to-violet-600';
    const tipeLabel = isPreventif ? 'Preventif' : 'Modifikasi';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" />
            <div
                className="relative bg-white w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`flex-shrink-0 ${headerGradient} px-8 py-5 flex items-center justify-between`}>
                    <div className="flex items-center gap-3 overflow-x-auto light-scrollbar pr-4">
                        {rowIndex !== undefined && (
                            <span className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/20 text-white text-base font-black">
                                {rowIndex}
                            </span>
                        )}
                        <span className={`px-3 py-1 bg-white/20 text-white text-sm font-black rounded-full uppercase tracking-widest whitespace-nowrap`}>
                            {tipeLabel}
                        </span>
                        <h2 className="text-2xl font-black text-white whitespace-nowrap">{workOrder.item}</h2>
                        <StatusBadge status={workOrder.status} solid className="px-4 py-1.5 text-base shadow-sm" />
                        <ScopeBadge scope={workOrder.scope} solid className="px-4 py-1.5 text-base shadow-sm" />
                        {workOrder.reported_by && (
                            <span className="px-3 py-1.5 bg-white/20 text-white font-bold text-sm rounded-full whitespace-nowrap">
                                👤 {workOrder.reported_by}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose}
                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto light-scrollbar flex-1 bg-slate-50 flex flex-col gap-6">
                    {/* Meta */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                            <span className="text-xs uppercase font-black text-black block mb-1.5">Tanggal</span>
                            <span className="text-base font-bold text-slate-800">{formatDate(workOrder.date)}</span>
                        </div>
                        <div className={`bg-white p-4 rounded-2xl shadow-sm border-${accentColor}-300 border-[1.5px] md:col-span-2`}>
                            <span className="text-xs uppercase font-black text-black block mb-1.5">Deskripsi</span>
                            <span className="text-base font-bold text-slate-800">{workOrder.deskripsi}</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                            <span className="text-xs uppercase font-black text-black block mb-1.5">Notif/SAP</span>
                            <span className="text-base font-bold text-slate-800">{workOrder.notif || '-'}</span>
                        </div>
                    </div>

                    {/* Pekerjaan list */}
                    <div className="flex flex-col gap-3 flex-1">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <span className={`material-symbols-outlined text-${accentColor}-500`}>checklist</span>
                                Daftar Pekerjaan ({pekerjaan.length})
                            </h3>
                            <button
                                onClick={() => onAddPekerjaan?.(workOrder)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg bg-${accentColor}-500 hover:bg-${accentColor}-600 text-white text-xs font-bold transition-all shadow-sm`}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                Tambah
                            </button>
                        </div>

                        {pekerjaan.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-slate-400 bg-slate-100/50 rounded-2xl border border-slate-200 p-8">
                                <span className="material-symbols-outlined text-5xl mb-3 text-slate-300">engineering</span>
                                <p className="text-base font-medium">Belum ada pekerjaan</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {pekerjaan.map((m, idx) => (
                                    <div key={m.id} className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm hover:border-slate-300">
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100">
                                                <span className="text-lg font-black text-slate-500">#{idx + 1}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <span className={`text-sm font-black uppercase px-2 py-0.5 rounded border ${
                                                        m.scope === 'mekanik' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                                                        m.scope === 'listrik' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                                        m.scope === 'instrumen' ? 'text-purple-600 bg-purple-50 border-purple-200' :
                                                        'text-teal-600 bg-teal-50 border-teal-200'
                                                    }`}>{m.scope}</span>
                                                    <span className="text-base font-bold text-slate-800">{m.uraian}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg border border-amber-200">
                                                        {formatDate(m.date)}
                                                    </span>
                                                    {m.notif && (
                                                        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-lg border border-indigo-200">
                                                            Notif: {m.notif}
                                                        </span>
                                                    )}
                                                    {m.reported_by && (
                                                        <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs font-bold rounded-lg border border-teal-200">
                                                            👤 {m.reported_by}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0 flex flex-col gap-2 items-end border-l border-slate-100 pl-4">
                                                {/* Status inline */}
                                                <div className="relative">
                                                    <select
                                                        value={m.status}
                                                        onChange={e => {
                                                            const s = e.target.value as 'OPEN' | 'IP' | 'OK';
                                                            setPekerjaan(prev => prev.map((p, i) => i === idx ? { ...p, status: s } : p));
                                                        }}
                                                        className={`appearance-none outline-none cursor-pointer px-3 py-1.5 pr-7 rounded-lg text-xs font-black border uppercase tracking-wider shadow-sm hover:opacity-80 transition-opacity ${
                                                            m.status === 'OK' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                                                            m.status === 'IP' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                                                            'bg-blue-100 text-blue-700 border-blue-300'
                                                        }`}
                                                    >
                                                        <option value="OPEN">OPEN</option>
                                                        <option value="IP">IP</option>
                                                        <option value="OK">OK</option>
                                                    </select>
                                                    <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" style={{ fontSize: 14 }}>expand_more</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => onEditPekerjaan?.(m)}
                                                        className="px-2.5 py-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-600 hover:text-white text-xs font-bold transition-all flex items-center gap-1">
                                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                                                    </button>
                                                    <button onClick={() => { if (confirm('Hapus pekerjaan ini?')) onDeletePekerjaan?.(m.id); }}
                                                        className="px-2.5 py-1.5 rounded-lg text-slate-400 bg-slate-50 border border-slate-200 hover:bg-rose-600 hover:text-white hover:border-transparent text-xs font-bold transition-all flex items-center gap-1">
                                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
