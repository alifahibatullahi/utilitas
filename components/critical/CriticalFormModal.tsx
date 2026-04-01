'use client';

import { useState } from 'react';
import { HAR_SCOPES, FOREMAN_OPTIONS } from '@/lib/constants';
import type { HarScope, ForemanType, CriticalEquipmentRow } from '@/lib/supabase/types';
import ItemCombobox from './ItemCombobox';
import OperatorCombobox from './OperatorCombobox';

type CriticalFormData = Omit<CriticalEquipmentRow, 'id' | 'created_at' | 'updated_at'>;

interface CriticalFormModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CriticalFormData) => Promise<{ error: string | null }>;
    initial?: Partial<CriticalFormData>;
    operatorName?: string;
}

export default function CriticalFormModal({ open, onClose, onSubmit, initial }: CriticalFormModalProps) {
    const [item, setItem] = useState(initial?.item ?? '');
    const [deskripsi, setDeskripsi] = useState(initial?.deskripsi ?? '');
    const [scope, setScope] = useState<HarScope>(initial?.scope ?? 'mekanik');
    const [notif, setNotif] = useState(initial?.notif ?? '');
    const [foreman, setForeman] = useState<ForemanType>(initial?.foreman ?? 'foreman_turbin');
    const [reportedBy, setReportedBy] = useState(initial?.reported_by ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    if (!open) return null;

    const handleSubmit = async () => {
        if (!item.trim() || !deskripsi.trim()) {
            setErr('Item dan deskripsi wajib diisi');
            return;
        }
        setSaving(true);
        setErr(null);
        const today = new Date().toISOString().slice(0, 10);
        const result = await onSubmit({
            shift_report_id: initial?.shift_report_id ?? null,
            date: initial?.date ?? today,
            item: item.trim(),
            deskripsi: deskripsi.trim(),
            scope,
            foreman,
            status: initial?.status ?? 'OPEN',
            notif: notif.trim() || null,
            reported_by: reportedBy.trim() || null,
        });
        setSaving(false);
        if (result.error) { setErr(result.error); return; }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto light-scrollbar shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-rose-500 to-rose-600 rounded-t-2xl shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>warning</span>
                        <h2 className="text-base font-extrabold text-white tracking-wide">
                            {initial?.item ? 'Edit Critical' : 'Tambah Critical'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-rose-100 hover:text-white cursor-pointer transition-colors bg-white/10 hover:bg-white/20 p-1 rounded-lg">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Item */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Item / Peralatan</label>
                        <ItemCombobox value={item} onChange={setItem} light={true} />
                    </div>

                    {/* Deskripsi */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Deskripsi Masalah</label>
                        <textarea
                            value={deskripsi}
                            onChange={e => setDeskripsi(e.target.value)}
                            rows={3}
                            placeholder="Jelaskan kondisi critical..."
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none resize-none transition-all shadow-sm placeholder-gray-400"
                        />
                    </div>

                    {/* Scope */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Scope HAR</label>
                        <div className="relative">
                            <select
                                value={scope}
                                onChange={e => setScope(e.target.value as HarScope)}
                                className="appearance-none w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none cursor-pointer transition-all shadow-sm"
                            >
                                {HAR_SCOPES.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
                        </div>
                    </div>

                    {/* Notif SAP */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Notif SAP</label>
                        <input
                            type="text"
                            value={notif}
                            onChange={e => setNotif(e.target.value)}
                            placeholder="Nomor notifikasi SAP (opsional)"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none transition-all shadow-sm placeholder-gray-400"
                        />
                    </div>

                    {/* Penanggung Jawab */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Penanggung Jawab</label>
                        <div className="relative">
                            <select
                                value={foreman}
                                onChange={e => setForeman(e.target.value as ForemanType)}
                                className="appearance-none w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none cursor-pointer transition-all shadow-sm"
                            >
                                {FOREMAN_OPTIONS.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
                        </div>
                    </div>

                    {/* Yang Melaporkan */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Yang Melaporkan</label>
                        <OperatorCombobox
                            value={reportedBy}
                            onChange={setReportedBy}
                            placeholder="Pilih atau ketik nama pelapor..."
                        />
                    </div>

                    {/* Error */}
                    {err && (
                        <div className="md:col-span-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-4 py-3 rounded-xl flex items-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-rose-500" style={{ fontSize: 16 }}>error</span>
                            {err}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 bg-white text-sm font-bold hover:bg-gray-50 hover:text-gray-700 transition-colors cursor-pointer shadow-sm"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white text-sm font-bold hover:from-rose-500 hover:to-rose-400 transition-all shadow-md shadow-rose-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                Menyimpan...
                            </>
                        ) : 'Simpan Critical'}
                    </button>
                </div>
            </div>
        </div>
    );
}
