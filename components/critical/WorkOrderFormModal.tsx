'use client';

import { useState } from 'react';
import { HAR_SCOPES, FOREMAN_OPTIONS } from '@/lib/constants';
import type { HarScope, ForemanType, WorkOrderRow, WorkOrderType } from '@/lib/supabase/types';
import ItemCombobox from './ItemCombobox';
import OperatorCombobox from './OperatorCombobox';
import ScopeCombobox from './ScopeCombobox';

type WorkOrderFormData = Omit<WorkOrderRow, 'id' | 'created_at' | 'updated_at'>;

interface WorkOrderFormModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: WorkOrderFormData) => Promise<{ error: string | null }>;
    initial?: Partial<WorkOrderFormData>;
}

export default function WorkOrderFormModal({ open, onClose, onSubmit, initial }: WorkOrderFormModalProps) {
    const [tipe, setTipe] = useState<WorkOrderType>(initial?.tipe ?? 'preventif');
    const [item, setItem] = useState(initial?.item ?? '');
    const [deskripsi, setDeskripsi] = useState(initial?.deskripsi ?? '');
    const [scope, setScope] = useState<HarScope | ''>(initial?.scope ?? '');
    const [foreman, setForeman] = useState<ForemanType | ''>(initial?.foreman ?? '');
    const [notif, setNotif] = useState(initial?.notif ?? '');
    const [reportedBy, setReportedBy] = useState(initial?.reported_by ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    if (!open) return null;

    const isPreventif = tipe === 'preventif';
    const color = isPreventif ? 'emerald' : 'violet';

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
            tipe,
            date: initial?.date ?? today,
            item: item.trim(),
            deskripsi: deskripsi.trim(),
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

    const gradientClass = isPreventif ? 'from-emerald-500 to-emerald-600' : 'from-violet-500 to-violet-600';
    const ringClass = isPreventif ? 'focus:ring-emerald-500/30 focus:border-emerald-500' : 'focus:ring-violet-500/30 focus:border-violet-500';
    const btnClass = isPreventif ? 'from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-500/20' : 'from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-violet-500/20';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto light-scrollbar shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${gradientClass} rounded-t-2xl shadow-sm`}>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
                            {isPreventif ? 'event_available' : 'precision_manufacturing'}
                        </span>
                        <h2 className="text-base font-extrabold text-white tracking-wide">
                            {initial?.item ? `Edit ${isPreventif ? 'Preventif' : 'Modifikasi'}` : `Tambah ${isPreventif ? 'Preventif' : 'Modifikasi'}`}
                        </h2>
                    </div>
                    <button onClick={onClose} className={`text-${color}-100 hover:text-white cursor-pointer transition-colors bg-white/10 hover:bg-white/20 p-1 rounded-lg`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Tipe */}
                    <div>
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Tipe Pekerjaan</label>
                        <div className="relative">
                            <select
                                value={tipe}
                                onChange={e => setTipe(e.target.value as WorkOrderType)}
                                className={`appearance-none w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-black text-sm font-bold ${ringClass} outline-none cursor-pointer transition-all shadow-sm`}
                            >
                                <option value="preventif">Preventif</option>
                                <option value="modifikasi">Modifikasi</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-black pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
                        </div>
                    </div>

                    {/* Item */}
                    <div>
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">No Item + Deskripsi</label>
                        <ItemCombobox value={item} onChange={setItem} light={true} />
                    </div>

                    {/* Deskripsi */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Deskripsi</label>
                        <textarea
                            value={deskripsi}
                            onChange={e => setDeskripsi(e.target.value)}
                            rows={3}
                            placeholder="Jelaskan pekerjaan yang akan dilakukan..."
                            className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-black text-sm font-bold ${ringClass} outline-none resize-none transition-all shadow-sm placeholder-gray-400`}
                        />
                    </div>

                    {/* Scope */}
                    <div>
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Scope HAR</label>
                        <ScopeCombobox value={scope} onChange={setScope} light={true} placeholder="Pilih scope HAR" />
                    </div>

                    {/* Notif */}
                    <div>
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Notif SAP (ops)</label>
                        <input type="text" value={notif} onChange={e => setNotif(e.target.value)}
                            placeholder="Nomor notifikasi SAP..."
                            className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-black text-sm font-bold ${ringClass} outline-none transition-all shadow-sm placeholder-gray-400`} />
                    </div>

                    {/* Foreman */}
                    <div>
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Penanggung Jawab</label>
                        <div className="flex gap-2">
                            {FOREMAN_OPTIONS.map(f => {
                                const active = foreman === f.value;
                                const activeClass = f.value === 'foreman_turbin' 
                                    ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-sm' 
                                    : 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm';
                                return (
                                    <button
                                        key={f.value}
                                        type="button"
                                        onClick={() => setForeman(f.value as ForemanType)}
                                        className={`flex-1 py-2.5 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer text-center ${
                                            active
                                                ? activeClass
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Yang Membuat */}
                    <div>
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Yang Membuat</label>
                        <OperatorCombobox value={reportedBy} onChange={setReportedBy} placeholder="Pilih atau ketik nama..." dropUp />
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
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-black bg-white text-sm font-bold hover:bg-gray-50 transition-colors cursor-pointer shadow-sm">
                        Batal
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className={`flex-1 py-2.5 rounded-xl bg-gradient-to-r ${btnClass} text-white text-sm font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2`}>
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                Menyimpan...
                            </>
                        ) : `Simpan ${isPreventif ? 'Preventif' : 'Modifikasi'}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
