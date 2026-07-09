'use client';

import { useState } from 'react';
import type { WorkOrderWithPekerjaan } from '@/lib/supabase/types';
import OperatorCombobox from './OperatorCombobox';
import ActivityTimelineImproved from './ActivityTimelineImproved';

const MAINT_STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
    OPEN: { bg: 'bg-blue-100 border border-blue-300', text: 'text-blue-700', label: 'Open' },
    IP:   { bg: 'bg-amber-100 border border-amber-300', text: 'text-amber-700', label: 'In Progress' },
    OK:   { bg: 'bg-emerald-100 border border-emerald-300', text: 'text-emerald-700', label: 'OK' },
};

interface CloseWorkOrderModalProps {
    open: boolean;
    workOrder: WorkOrderWithPekerjaan;
    onClose: () => void;
    onConfirm: (actor: string) => Promise<{ error: string | null }>;
    operatorName?: string | null;
}

export default function CloseWorkOrderModal({ open, workOrder, onClose, onConfirm, operatorName }: CloseWorkOrderModalProps) {
    const [actor, setActor] = useState(operatorName ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    if (!open) return null;

    const isPreventif = workOrder.tipe === 'preventif';
    const tipeLabel = isPreventif ? 'Preventif' : 'Modifikasi';

    const maintenances = (workOrder.maintenance_logs ?? []).filter(m => m.keterangan !== 'IS_NOTE' && m.item !== 'NOTE');
    const allOK = maintenances.length > 0 && maintenances.every(m => m.status === 'OK');
    const okCount = maintenances.filter(m => m.status === 'OK').length;

    const allLogs = workOrder.work_order_activity_logs ?? [];

    const handleConfirm = async () => {
        if (!actor.trim()) {
            setErr('Nama wajib diisi');
            return;
        }
        setSaving(true);
        setErr(null);
        const result = await onConfirm(actor.trim());
        setSaving(false);
        if (result.error) { setErr(result.error); return; }
        onClose();
    };

    const headerGrad = isPreventif
        ? 'from-emerald-500 to-emerald-600'
        : 'from-violet-500 to-violet-600';
    const buttonGrad = isPreventif
        ? 'from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-500/20'
        : 'from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-violet-500/20';

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${headerGrad} rounded-t-2xl`}>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>lock</span>
                        <div>
                            <h2 className="text-sm font-extrabold text-white">Tutup {tipeLabel}</h2>
                            <p className="text-xs text-white/80 font-medium truncate max-w-[220px]">{workOrder.item}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer bg-white/10 hover:bg-white/20 p-1 rounded-lg">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto light-scrollbar">
                    {/* Maintenance Summary */}
                    <div className="px-5 pt-4 pb-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ringkasan Pekerjaan</p>
                            {maintenances.length > 0 && (
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${allOK ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {okCount}/{maintenances.length} OK
                                </span>
                            )}
                        </div>

                        {maintenances.length === 0 ? (
                            <p className="text-xs text-gray-400 italic text-center py-3">Tidak ada pekerjaan terkait</p>
                        ) : (
                            <div className="space-y-1.5">
                                {maintenances.map(m => {
                                    const style = MAINT_STATUS_STYLE[m.status] ?? MAINT_STATUS_STYLE['OPEN'];
                                    return (
                                        <div key={m.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${style.bg} ${style.text} flex-shrink-0`}>
                                                {style.label}
                                            </span>
                                            <span className="text-xs font-semibold text-gray-700 truncate">{m.uraian}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!allOK && maintenances.length > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                                Ada pekerjaan yang belum selesai (OK)
                            </div>
                        )}

                        {allOK && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                                Semua pekerjaan sudah selesai
                            </div>
                        )}
                    </div>

                    {/* Activity Summary */}
                    <div className="px-5 pt-2 pb-3 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Ringkasan Aktivitas</p>
                        <ActivityTimelineImproved logs={allLogs} compact />
                    </div>
                </div>

                {/* Ditutup Oleh */}
                <div className="px-5 pt-3 pb-2 border-t border-dashed border-gray-200">
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Ditutup Oleh</label>
                    <OperatorCombobox
                        value={actor}
                        onChange={setActor}
                        placeholder="Pilih atau ketik nama..."
                    />
                    {err && (
                        <div className="mt-3 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-500" style={{ fontSize: 14 }}>error</span>
                            {err}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-5 py-4 bg-gray-50 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 bg-white text-sm font-bold hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={saving}
                        className={`flex-1 py-2.5 rounded-xl bg-gradient-to-r ${buttonGrad} text-white text-sm font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2`}
                    >
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                Menutup...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
                                Tutup {tipeLabel}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
