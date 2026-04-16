'use client';

import { useState } from 'react';
import { HAR_SCOPES, FOREMAN_OPTIONS } from '@/lib/constants';
import type { HarScope, ForemanType, MaintenanceLogRow, CriticalWithMaintenance, WorkOrderWithPekerjaan } from '@/lib/supabase/types';
import ItemCombobox from './ItemCombobox';
import OperatorCombobox from './OperatorCombobox';

type MaintenanceFormData = Omit<MaintenanceLogRow, 'id' | 'created_at' | 'updated_at'>;

interface MaintenanceFormModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: MaintenanceFormData) => Promise<{ error: string | null }>;
    activeCriticals: CriticalWithMaintenance[];
    // Jika diset, form hanya untuk pekerjaan di bawah work order ini
    workOrderContext?: WorkOrderWithPekerjaan;
    initial?: Partial<MaintenanceFormData>;
    operatorName?: string;
}

export default function MaintenanceFormModal({ open, onClose, onSubmit, activeCriticals, workOrderContext, initial, operatorName }: MaintenanceFormModalProps) {
    // Mode: 'wo' (pekerjaan dalam work order) atau 'corrective' (maintenance untuk critical)
    const isWOMode = !!workOrderContext || !!initial?.work_order_id;

    // Untuk mode corrective: tipeValue = critical_id yang dipilih, atau '' jika belum
    const initCriticalId = initial?.critical_id ?? '';
    const [criticalId, setCriticalId] = useState<string>(initCriticalId);

    const [item, setItem] = useState(initial?.item ?? workOrderContext?.item ?? '');
    const [uraian, setUraian] = useState(initial?.uraian ?? '');
    const [scope, setScope] = useState<HarScope>(initial?.scope ?? workOrderContext?.scope ?? 'mekanik');
    const [foreman, setForeman] = useState<ForemanType>(initial?.foreman ?? workOrderContext?.foreman ?? 'foreman_turbin');
    const [notif, setNotif] = useState(initial?.notif ?? '');
    const [reportedBy, setReportedBy] = useState(initial?.reported_by ?? operatorName ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    if (!open) return null;

    const activeCriticalList = activeCriticals.filter(c => c.status !== 'CLOSED');
    const selectedCritical = criticalId ? activeCriticals.find(c => c.id === criticalId) ?? null : null;

    const handleCriticalChange = (val: string) => {
        setCriticalId(val);
        const crit = activeCriticals.find(c => c.id === val);
        if (crit) {
            setItem(crit.item);
            setScope(crit.scope);
            setForeman(crit.foreman);
        }
    };

    const handleItemChange = (val: string) => {
        setItem(val);
        if (selectedCritical && selectedCritical.item.toLowerCase() !== val.trim().toLowerCase()) {
            setCriticalId('');
        }
    };

    const handleSubmit = async () => {
        if (!item.trim() || !uraian.trim()) {
            setErr('Item dan uraian pekerjaan wajib diisi');
            return;
        }
        setSaving(true);
        setErr(null);
        const today = new Date().toISOString().slice(0, 10);

        let tipe: MaintenanceFormData['tipe'] = 'corrective';
        if (isWOMode && workOrderContext) {
            tipe = workOrderContext.tipe; // 'preventif' atau 'modifikasi'
        } else if (!criticalId) {
            tipe = 'corrective'; // corrective tanpa critical linkage (jarang tapi valid)
        }

        const result = await onSubmit({
            shift_report_id: initial?.shift_report_id ?? null,
            critical_id: isWOMode ? null : (criticalId || null),
            work_order_id: workOrderContext?.id ?? initial?.work_order_id ?? null,
            date: initial?.date ?? today,
            item: item.trim(),
            uraian: uraian.trim(),
            scope,
            foreman,
            tipe,
            status: initial?.status ?? 'OPEN',
            keterangan: null,
            notif: notif.trim() || null,
            reported_by: reportedBy.trim() || null,
        });
        setSaving(false);
        if (result.error) { setErr(result.error); return; }
        onClose();
    };

    const isPreventifWO = workOrderContext?.tipe === 'preventif';
    const accentColor = isWOMode ? (isPreventifWO ? 'emerald' : 'violet') : 'blue';
    const headerGradient = isWOMode
        ? (isPreventifWO ? 'from-emerald-500 to-emerald-600' : 'from-violet-500 to-violet-600')
        : 'from-blue-500 to-blue-600';
    const ringClass = `focus:ring-${accentColor}-500/30 focus:border-${accentColor}-500`;
    const btnGradient = isWOMode
        ? (isPreventifWO ? 'from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-500/20' : 'from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-violet-500/20')
        : 'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-500/20';

    const modalTitle = isWOMode
        ? `${initial?.uraian ? 'Edit' : 'Tambah'} Pekerjaan — ${workOrderContext?.tipe === 'preventif' ? 'Preventif' : 'Modifikasi'}`
        : initial?.uraian ? 'Edit Maintenance' : 'Tambah Maintenance';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto light-scrollbar shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${headerGradient} rounded-t-2xl shadow-sm`}>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>construction</span>
                        <h2 className="text-base font-extrabold text-white tracking-wide">{modalTitle}</h2>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer transition-colors bg-white/10 hover:bg-white/20 p-1 rounded-lg">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Row 1: Item | Critical (hanya mode corrective) */}
                    <div>
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Item / Peralatan</label>
                        <ItemCombobox value={item} onChange={handleItemChange} light={true} />
                    </div>

                    {!isWOMode && (
                        <div>
                            <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Critical Terkait (ops)</label>
                            <div className="relative">
                                <select
                                    value={criticalId}
                                    onChange={e => handleCriticalChange(e.target.value)}
                                    className="appearance-none w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none cursor-pointer transition-all shadow-sm"
                                >
                                    <option value="">— Tanpa Critical —</option>
                                    {activeCriticalList.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.item} — {c.deskripsi.slice(0, 40)}
                                        </option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-black pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
                            </div>
                            {selectedCritical && (
                                <p className="text-[11px] text-black mt-1.5 leading-snug">
                                    <span className="font-bold">Critical: </span>{selectedCritical.deskripsi}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Work order context info */}
                    {isWOMode && workOrderContext && (
                        <div className={`bg-${isPreventifWO ? 'emerald' : 'violet'}-50 border border-${isPreventifWO ? 'emerald' : 'violet'}-200 rounded-xl px-4 py-3 flex flex-col gap-1`}>
                            <span className={`text-[10px] font-black text-${isPreventifWO ? 'emerald' : 'violet'}-600 uppercase tracking-widest`}>
                                {isPreventifWO ? 'Preventif' : 'Modifikasi'}
                            </span>
                            <span className={`text-sm font-extrabold text-${isPreventifWO ? 'emerald' : 'violet'}-800`}>{workOrderContext.item}</span>
                            <span className={`text-xs font-medium text-${isPreventifWO ? 'emerald' : 'violet'}-700`}>{workOrderContext.deskripsi}</span>
                        </div>
                    )}

                    {/* Uraian */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Uraian Pekerjaan</label>
                        <textarea
                            value={uraian}
                            onChange={e => setUraian(e.target.value)}
                            rows={3}
                            placeholder="Deskripsi pekerjaan..."
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 outline-none resize-none transition-all shadow-sm placeholder-gray-600"
                        />
                    </div>

                    {/* Scope */}
                    <div>
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Scope HAR</label>
                        <div className="relative">
                            <select value={scope} onChange={e => setScope(e.target.value as HarScope)}
                                className="appearance-none w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 outline-none cursor-pointer transition-all shadow-sm">
                                {HAR_SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-black pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
                        </div>
                    </div>

                    {/* Notif */}
                    <div>
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Notif SAP (ops)</label>
                        <input type="text" value={notif} onChange={e => setNotif(e.target.value)}
                            placeholder="Nomor SA..."
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 outline-none transition-all shadow-sm placeholder-gray-600" />
                        {selectedCritical?.notif && (
                            <button type="button" onClick={() => setNotif(selectedCritical.notif!)}
                                className="mt-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                                Pakai notif critical: <span className="font-extrabold">{selectedCritical.notif}</span>
                            </button>
                        )}
                    </div>

                    {/* Foreman */}
                    <div>
                        <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">P. Jawab</label>
                        <div className="relative">
                            <select value={foreman} onChange={e => setForeman(e.target.value as ForemanType)}
                                className="appearance-none w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 outline-none cursor-pointer transition-all shadow-sm">
                                {FOREMAN_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-black pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
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
                        className={`flex-1 py-2.5 rounded-xl bg-gradient-to-r ${btnGradient} text-white text-sm font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2`}>
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                Menyimpan...
                            </>
                        ) : 'Simpan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
