'use client';

import { useState } from 'react';
import { HAR_SCOPES, FOREMAN_OPTIONS } from '@/lib/constants';
import { capitalizeFirst } from '@/lib/utils';
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

    const gradientClass = isPreventif ? 'from-emerald-500 to-emerald-600' : 'from-violet-500 to-violet-600';
    const ringClass = isPreventif ? 'focus:ring-emerald-500/30 focus:border-emerald-500' : 'focus:ring-violet-500/30 focus:border-violet-500';
    const btnClass = isPreventif ? 'from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-500/20' : 'from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-violet-500/20';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4.5 bg-gradient-to-r ${gradientClass} shadow-sm flex-shrink-0`}>
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-white/10 rounded-xl flex items-center justify-center text-white">
                            <span className="material-symbols-outlined font-black" style={{ fontSize: 20 }}>
                                {isPreventif ? 'event_available' : 'precision_manufacturing'}
                            </span>
                        </div>
                        <h2 className="text-base font-black text-white tracking-wider uppercase">
                            {initial?.item ? `EDIT ${isPreventif ? 'PREVENTIF' : 'MODIFIKASI'}` : `TAMBAH ${isPreventif ? 'PREVENTIF' : 'MODIFIKASI'}`}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer transition-all bg-white/10 hover:bg-white/20 p-1.5 rounded-xl hover:scale-105 active:scale-95">
                        <span className="material-symbols-outlined font-bold" style={{ fontSize: 18 }}>close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 overflow-y-auto light-scrollbar flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                    {/* Section 1 */}
                    <div className="md:col-span-2 flex items-center gap-2 pb-1.5 border-b border-slate-100 mb-1">
                        <span className={`w-5 h-5 rounded-full ${isPreventif ? 'bg-emerald-50 border-emerald-100 text-emerald-500' : 'bg-violet-50 border-violet-100 text-violet-500'} border flex items-center justify-center text-[10px] font-black`}>01</span>
                        <span className="text-[11px] font-black text-black uppercase tracking-widest">Ruang Lingkup Pekerjaan</span>
                    </div>

                    {/* Tipe Pekerjaan */}
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wider">Tipe Pekerjaan</label>
                        <div className="flex gap-3">
                            {([
                                { value: 'preventif' as WorkOrderType, label: 'Preventif', desc: 'Pemeliharaan terencana & rutin', activeCls: 'border-emerald-500 bg-emerald-50/50 text-emerald-700 ring-4 ring-emerald-500/10 shadow-sm' },
                                { value: 'modifikasi' as WorkOrderType, label: 'Modifikasi', desc: 'Peningkatan / perubahan konstruksi', activeCls: 'border-violet-500 bg-violet-50/50 text-violet-700 ring-4 ring-violet-500/10 shadow-sm' },
                            ]).map(opt => {
                                const active = tipe === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setTipe(opt.value)}
                                        className={`flex-1 flex flex-col text-left py-2.5 px-4 rounded-xl border transition-all cursor-pointer select-none active:scale-[0.98] ${
                                            active
                                                ? opt.activeCls
                                                : 'bg-white border-slate-200 text-black hover:bg-slate-50 hover:border-slate-350'
                                        }`}
                                    >
                                        <span className="text-sm font-extrabold flex items-center gap-1.5">
                                            <span className={`material-symbols-outlined text-[18px] ${
                                                opt.value === 'preventif'
                                                    ? (active ? 'text-emerald-700' : 'text-emerald-500')
                                                    : (active ? 'text-violet-700' : 'text-violet-500')
                                            }`}>
                                                {opt.value === 'preventif' ? 'event_available' : 'precision_manufacturing'}
                                            </span>
                                            {opt.label}
                                            {active && <span className="material-symbols-outlined text-[14px] font-black ml-auto">check_circle</span>}
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-800 mt-0.5 leading-snug">{opt.desc}</span>
                                    </button>
                                );
                             })}
                        </div>
                    </div>

                    {/* Item */}
                    <div>
                        <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wider">No Item + Deskripsi</label>
                        <ItemCombobox value={item} onChange={setItem} light={true} />
                    </div>

                    {/* Scope */}
                    <div>
                        <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wider">Scope HAR</label>
                        <ScopeCombobox value={scope} onChange={setScope} light={true} placeholder="Pilih scope HAR" />
                    </div>

                    {/* Section 2 */}
                    <div className="md:col-span-2 flex items-center gap-2 pb-1.5 border-b border-slate-100 mt-3 mb-1">
                        <span className={`w-5 h-5 rounded-full ${isPreventif ? 'bg-emerald-50 border-emerald-100 text-emerald-500' : 'bg-violet-50 border-violet-100 text-violet-500'} border flex items-center justify-center text-[10px] font-black`}>02</span>
                        <span className="text-[11px] font-black text-black uppercase tracking-widest">Detail Rencana & PIC</span>
                    </div>

                    {/* Deskripsi */}
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wider">Deskripsi Pekerjaan</label>
                        <textarea
                            value={deskripsi}
                            onChange={e => setDeskripsi(e.target.value)}
                            rows={3}
                            placeholder="Jelaskan pekerjaan yang akan direncanakan..."
                            className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold placeholder-slate-400 ${ringClass} outline-none resize-none transition-all shadow-sm`}
                        />
                    </div>

                    {/* Penanggung Jawab */}
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wider">Penanggung Jawab (Foreman)</label>
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
                                                : 'bg-white border-slate-200 text-black hover:bg-slate-50 hover:border-slate-300'
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
                        <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wider">Notif SAP</label>
                        <input
                            type="text"
                            value={notif}
                            onChange={e => setNotif(e.target.value)}
                            placeholder="Nomor notifikasi SAP (opsional)"
                            className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold placeholder-slate-400 ${ringClass} outline-none transition-all shadow-sm`}
                        />
                    </div>

                    {/* Yang Membuat */}
                    <div>
                        <label className="block text-[11px] font-black text-black mb-1.5 uppercase tracking-wider">Yang Membuat</label>
                        <OperatorCombobox
                            value={reportedBy}
                            onChange={setReportedBy}
                            placeholder="Pilih atau ketik nama pembuat..."
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
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-black bg-white text-sm font-bold hover:bg-slate-100 hover:text-slate-800 hover:border-slate-350 transition-all cursor-pointer shadow-sm active:scale-98"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className={`flex-1 py-2.5 rounded-xl bg-gradient-to-r ${btnClass} text-white text-sm font-bold hover:shadow-lg active:scale-98 transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2`}
                    >
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin font-bold" style={{ fontSize: 16 }}>progress_activity</span>
                                Menyimpan...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined font-bold" style={{ fontSize: 18 }}>save</span>
                                Simpan {isPreventif ? 'Preventif' : 'Modifikasi'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
