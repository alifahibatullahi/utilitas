'use client';

import { useState } from 'react';
import type { CriticalWithMaintenance, ActivityActionType } from '@/lib/supabase/types';
import OperatorCombobox from './OperatorCombobox';

const ACTION_ICON: Record<ActivityActionType, string> = {
    created: 'flag',
    status_changed: 'published_with_changes',
    note: 'chat_bubble',
    maintenance_added: 'build_circle',
    maintenance_updated: 'handyman',
    maintenance_deleted: 'remove_circle',
};

const ACTION_COLOR: Record<ActivityActionType, string> = {
    created: 'text-rose-400',
    status_changed: 'text-amber-400',
    note: 'text-sky-400',
    maintenance_added: 'text-emerald-400',
    maintenance_updated: 'text-purple-400',
    maintenance_deleted: 'text-slate-400',
};

const MAINT_STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
    OPEN: { bg: 'bg-blue-100 border border-blue-300', text: 'text-blue-700', label: 'Open' },
    IP:   { bg: 'bg-amber-100 border border-amber-300', text: 'text-amber-700', label: 'In Progress' },
    OK:   { bg: 'bg-emerald-100 border border-emerald-300', text: 'text-emerald-700', label: 'OK' },
};

function formatDateTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface CloseCriticalModalProps {
    open: boolean;
    critical: CriticalWithMaintenance;
    onClose: () => void;
    onConfirm: (actor: string) => Promise<{ error: string | null }>;
    operatorName?: string | null;
}

export default function CloseCriticalModal({ open, critical, onClose, onConfirm, operatorName }: CloseCriticalModalProps) {
    const [actor, setActor] = useState(operatorName ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    if (!open) return null;

    const maintenances = critical.maintenance_logs ?? [];
    const allOK = maintenances.length > 0 && maintenances.every(m => m.status === 'OK');
    const okCount = maintenances.filter(m => m.status === 'OK').length;

    const recentLogs = [...(critical.critical_activity_logs ?? [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6)
        .reverse();

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

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-600 to-slate-700 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>lock</span>
                        <div>
                            <h2 className="text-sm font-extrabold text-white">Tutup Critical</h2>
                            <p className="text-xs text-slate-300 font-medium truncate max-w-[220px]">{critical.item}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-300 hover:text-white cursor-pointer bg-white/10 hover:bg-white/20 p-1 rounded-lg">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto light-scrollbar">
                    {/* Maintenance Summary */}
                    <div className="px-5 pt-4 pb-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ringkasan Maintenance</p>
                            {maintenances.length > 0 && (
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${allOK ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {okCount}/{maintenances.length} OK
                                </span>
                            )}
                        </div>

                        {maintenances.length === 0 ? (
                            <p className="text-xs text-gray-400 italic text-center py-3">Tidak ada maintenance terkait</p>
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
                                Ada maintenance yang belum selesai (OK)
                            </div>
                        )}

                        {allOK && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                                Semua maintenance sudah selesai
                            </div>
                        )}
                    </div>

                    {/* Activity Summary */}
                    <div className="px-5 pt-2 pb-3 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Ringkasan Aktivitas</p>
                        {recentLogs.length === 0 ? (
                            <p className="text-xs text-gray-400 italic text-center py-3">Belum ada aktivitas tercatat</p>
                        ) : (
                            <div className="space-y-2 pr-1">
                                {recentLogs.map((log, i) => {
                                    const actionType = log.action_type as ActivityActionType;
                                    return (
                                        <div key={log.id} className="flex items-start gap-2.5">
                                            <div className="flex flex-col items-center flex-shrink-0">
                                                <div className="w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center border-gray-200">
                                                    <span className={`material-symbols-outlined ${ACTION_COLOR[actionType]}`} style={{ fontSize: 12 }}>
                                                        {ACTION_ICON[actionType] ?? 'circle'}
                                                    </span>
                                                </div>
                                                {i < recentLogs.length - 1 && (
                                                    <div className="w-px h-3 bg-gray-200 mt-0.5" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 pb-1">
                                                <p className="text-xs font-semibold text-gray-700 leading-snug">{log.description}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    {log.actor && <span className="font-bold text-gray-500">{log.actor} · </span>}
                                                    {formatDateTime(log.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                </div>

                {/* Ditutup Oleh — outside scroll so combobox dropdown is not clipped */}
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
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 text-white text-sm font-bold hover:from-slate-500 hover:to-slate-600 transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                Menutup...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
                                Tutup Critical
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
