'use client';

import { useState } from 'react';
import { FOREMAN_OPTIONS } from '@/lib/constants';
import { capitalizeFirst } from '@/lib/utils';
import ScopeCombobox from './ScopeCombobox';
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
    const [scope, setScope] = useState<HarScope | ''>(initial?.scope ?? '');
    const [notif, setNotif] = useState(initial?.notif ?? '');
    const [foreman, setForeman] = useState<ForemanType | ''>(initial?.foreman ?? '');
    const [reportedBy, setReportedBy] = useState(initial?.reported_by ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    if (!open) return null;

    const handleSubmit = async () => {
        if (!item.trim() || !deskripsi.trim()) {
            setErr('Item dan deskripsi wajib diisi');
            return;
        }
        if (!scope) {
            setErr('Scope HAR wajib dipilih');
            return;
        }
        if (!foreman) {
            setErr('Penanggung jawab wajib dipilih');
            return;
        }
        setSaving(true);
        setErr(null);
        const today = new Date().toISOString().slice(0, 10);
        const result = await onSubmit({
            shift_report_id: initial?.shift_report_id ?? null,
            date: initial?.date ?? today,
            item: item.trim(),
            deskripsi: capitalizeFirst(deskripsi.trim()),
            scope: scope as HarScope,
            foreman: foreman as ForemanType,
            status: initial?.status ?? 'OPEN',
            notif: notif.trim() || null,
            reported_by: reportedBy.trim() || null,
        });
        setSaving(false);
        if (result.error) { setErr(result.error); return; }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4.5 bg-gradient-to-r from-rose-500 to-rose-600 shadow-sm flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-white/10 rounded-xl flex items-center justify-center text-white">
                            <span className="material-symbols-outlined font-black" style={{ fontSize: 20 }}>warning</span>
                        </div>
                        <h2 className="text-base font-black text-white tracking-wider">
                            {initial?.item ? 'EDIT CRITICAL EQUIPMENT' : 'TAMBAH CRITICAL EQUIPMENT'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-rose-100 hover:text-white cursor-pointer transition-all bg-white/10 hover:bg-white/20 p-1.5 rounded-xl hover:scale-105 active:scale-95">
                        <span className="material-symbols-outlined font-bold" style={{ fontSize: 18 }}>close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 overflow-y-auto light-scrollbar flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                    {/* Section 1 */}
                    <div className="md:col-span-2 flex items-center gap-2 pb-1.5 border-b border-slate-100 mb-1">
                        <span className="w-5 h-5 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-[10px] font-black text-rose-500">01</span>
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Detail Peralatan & Temuan Masalah</span>
                    </div>

                    {/* Item */}
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">No Item + Deskripsi</label>
                        <ItemCombobox value={item} onChange={setItem} light={true} />
                    </div>

                    {/* Deskripsi */}
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Deskripsi Masalah</label>
                        <textarea
                            value={deskripsi}
                            onChange={e => setDeskripsi(e.target.value)}
                            rows={3}
                            placeholder="Jelaskan kondisi critical secara detail..."
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold placeholder-slate-400 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none resize-none transition-all shadow-sm"
                        />
                    </div>

                    {/* Scope */}
                    <div>
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Scope HAR</label>
                        <ScopeCombobox value={scope} onChange={setScope} light={true} placeholder="Pilih scope HAR" />
                    </div>

                    {/* Section 2 */}
                    <div className="md:col-span-2 flex items-center gap-2 pb-1.5 border-b border-slate-100 mt-3 mb-1">
                        <span className="w-5 h-5 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-[10px] font-black text-rose-500">02</span>
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">PIC & Administrasi</span>
                    </div>

                    {/* Penanggung Jawab */}
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Penanggung Jawab (Foreman)</label>
                        <div className="flex gap-3">
                            {FOREMAN_OPTIONS.map(f => {
                                const active = foreman === f.value;
                                const activeClass = f.value === 'foreman_turbin' 
                                    ? 'border-teal-500 bg-teal-50/50 text-teal-700 ring-4 ring-teal-500/10 shadow-sm' 
                                    : 'border-orange-500 bg-orange-50/50 text-orange-700 ring-4 ring-orange-500/10 shadow-sm';
                                const icon = f.value === 'foreman_turbin' ? 'wind_power' : 'heat_pump';
                                return (
                                    <button
                                        key={f.value}
                                        type="button"
                                        onClick={() => setForeman(f.value as ForemanType)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-extrabold transition-all cursor-pointer select-none active:scale-[0.98] ${
                                            active
                                                ? activeClass
                                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
                                        {f.label}
                                        {active && (
                                            <span className="material-symbols-outlined text-[16px] font-black ml-0.5">check_circle</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Notif SAP */}
                    <div>
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Notif SAP</label>
                        <input
                            type="text"
                            value={notif}
                            onChange={e => setNotif(e.target.value)}
                            placeholder="Nomor notifikasi SAP (opsional)"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold placeholder-slate-400 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all shadow-sm"
                        />
                    </div>

                    {/* Yang Melaporkan */}
                    <div>
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Yang Melaporkan</label>
                        <OperatorCombobox
                            value={reportedBy}
                            onChange={setReportedBy}
                            placeholder="Pilih atau ketik nama pelapor..."
                            dropUp
                        />
                    </div>

                    {/* Error */}
                    {err && (
                        <div className="md:col-span-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-4 py-3 rounded-xl flex items-center gap-2 shadow-sm animate-shake">
                            <span className="material-symbols-outlined text-rose-500 font-bold" style={{ fontSize: 16 }}>error</span>
                            {err}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-3xl flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white text-sm font-bold hover:bg-slate-100 hover:text-slate-800 hover:border-slate-350 transition-all cursor-pointer shadow-sm active:scale-98"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white text-sm font-bold hover:from-rose-500 hover:to-rose-400 hover:shadow-lg active:scale-98 transition-all shadow-md shadow-rose-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin font-bold" style={{ fontSize: 16 }}>progress_activity</span>
                                Menyimpan...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined font-bold" style={{ fontSize: 18 }}>save</span>
                                Simpan Critical
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
