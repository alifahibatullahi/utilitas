'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MaintenanceLogRow, MaintenanceStatus, MaintenanceType, ShiftType } from '@/lib/supabase/types';

interface SelectMaintenanceModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (addIds: string[], removeIds: string[]) => Promise<void> | void;
    alreadyAssignedIds: string[];
    date: string;
    shift: ShiftType;
}

const TIPE_LABEL: Record<MaintenanceType, string> = {
    corrective: 'Corrective',
    preventif: 'Preventif',
    modifikasi: 'Modifikasi',
};

const STATUS_BADGE: Record<MaintenanceStatus, string> = {
    OPEN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    IP: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    OK: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

export default function SelectMaintenanceModal({ open, onClose, onConfirm, alreadyAssignedIds, date, shift }: SelectMaintenanceModalProps) {
    const [allMaint, setAllMaint] = useState<MaintenanceLogRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | 'all'>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSelectedIds(new Set(alreadyAssignedIds));
        setSearch('');
        setStatusFilter('all');

        let cancelled = false;
        async function fetchAll() {
            setLoading(true);
            const supabase = createClient();
            const { data } = await supabase
                .from('maintenance_logs')
                .select('*')
                .neq('keterangan', 'IS_NOTE')
                .order('date', { ascending: false })
                .order('updated_at', { ascending: false });
            if (cancelled) return;
            setAllMaint(((data ?? []) as MaintenanceLogRow[]).filter(m => m.item !== 'NOTE'));
            setLoading(false);
        }
        fetchAll();
        return () => { cancelled = true; };
    }, [open, alreadyAssignedIds]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allMaint
            .filter(m => statusFilter === 'all' || m.status === statusFilter)
            .filter(m => !q || m.item.toLowerCase().includes(q) || m.uraian.toLowerCase().includes(q));
    }, [allMaint, search, statusFilter]);

    const toggleId = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleConfirm = async () => {
        const original = new Set(alreadyAssignedIds);
        const addIds = Array.from(selectedIds).filter(id => !original.has(id));
        const removeIds = Array.from(original).filter(id => !selectedIds.has(id));
        if (addIds.length === 0 && removeIds.length === 0) {
            onClose();
            return;
        }
        setSaving(true);
        await onConfirm(addIds, removeIds);
        setSaving(false);
        onClose();
    };

    if (!open) return null;

    const counts = {
        selected: selectedIds.size,
        added: Array.from(selectedIds).filter(id => !alreadyAssignedIds.includes(id)).length,
        removed: alreadyAssignedIds.filter(id => !selectedIds.has(id)).length,
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>checklist</span>
                        <div>
                            <h2 className="text-base font-extrabold text-white tracking-wide">Pilih Maintenance</h2>
                            <p className="text-[11px] font-medium text-emerald-50">Untuk laporan shift {shift.toUpperCase()} · {date}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-emerald-100 hover:text-white cursor-pointer transition-colors bg-white/10 hover:bg-white/20 p-1 rounded-lg">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                {/* Filter bar */}
                <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="relative flex-1 min-w-[180px]">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" style={{ fontSize: 16 }}>search</span>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cari item / uraian…"
                            className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                        />
                    </div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as MaintenanceStatus | 'all')} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none cursor-pointer">
                        <option value="all">Semua Status</option>
                        <option value="OPEN">Open</option>
                        <option value="IP">In Progress</option>
                        <option value="OK">Selesai</option>
                    </select>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto light-scrollbar p-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-gray-400">
                            <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: 20 }}>progress_activity</span>
                            Memuat maintenance…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm font-medium">Tidak ada maintenance.</div>
                    ) : (
                        <div className="space-y-1.5">
                            {filtered.map(m => {
                                const checked = selectedIds.has(m.id);
                                const wasAssigned = alreadyAssignedIds.includes(m.id);
                                return (
                                    <label
                                        key={m.id}
                                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                            checked
                                                ? 'bg-emerald-50 border-emerald-300'
                                                : 'bg-white border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleId(m.id)}
                                            className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-bold text-gray-800">{m.item}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${STATUS_BADGE[m.status]}`}>{m.status}</span>
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-600 border border-gray-200">{TIPE_LABEL[m.tipe]}</span>
                                                {m.status === 'OPEN' && (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title="Status OPEN biasanya tidak dilaporkan, tapi bisa dipilih manual">
                                                        ⚠ tidak otomatis dilaporkan
                                                    </span>
                                                )}
                                                {wasAssigned && (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">sudah ter-assign</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-600 mt-0.5">{m.uraian}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">Tanggal: {m.date} · Scope: {m.scope} · Foreman: {m.foreman}</p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
                    <div className="text-xs font-bold text-gray-500">
                        Dipilih: <span className="text-gray-800">{counts.selected}</span>
                        {counts.added > 0 && <span className="text-emerald-600 ml-2">+{counts.added}</span>}
                        {counts.removed > 0 && <span className="text-rose-600 ml-2">−{counts.removed}</span>}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 bg-white text-sm font-bold hover:bg-gray-100 transition-colors cursor-pointer shadow-sm"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={saving || (counts.added === 0 && counts.removed === 0)}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-bold hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                    Menyimpan…
                                </>
                            ) : 'Simpan Pilihan'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
