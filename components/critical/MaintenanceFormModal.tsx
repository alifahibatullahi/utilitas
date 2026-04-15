'use client';

import { useState } from 'react';
import { HAR_SCOPES, FOREMAN_OPTIONS } from '@/lib/constants';
import type { HarScope, ForemanType, MaintenanceLogRow, CriticalWithMaintenance } from '@/lib/supabase/types';
import ItemCombobox from './ItemCombobox';
import OperatorCombobox from './OperatorCombobox';

type MaintenanceFormData = Omit<MaintenanceLogRow, 'id' | 'created_at' | 'updated_at'>;

interface MaintenanceFormModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: MaintenanceFormData) => Promise<{ error: string | null }>;
    activeCriticals: CriticalWithMaintenance[];
    initial?: Partial<MaintenanceFormData>;
    operatorName?: string;
}

export default function MaintenanceFormModal({ open, onClose, onSubmit, activeCriticals, initial, operatorName }: MaintenanceFormModalProps) {
    const [criticalId, setCriticalId] = useState<string>(initial?.critical_id ?? '');
    const [item, setItem] = useState(initial?.item ?? '');
    const [uraian, setUraian] = useState(initial?.uraian ?? '');
    const [scope, setScope] = useState<HarScope>(initial?.scope ?? 'mekanik');
    const [foreman, setForeman] = useState<ForemanType>(initial?.foreman ?? 'foreman_turbin');
    const [notif, setNotif] = useState(initial?.notif ?? '');
    const [reportedBy, setReportedBy] = useState(initial?.reported_by ?? operatorName ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    if (!open) return null;

    const isPreventif = criticalId === '' || criticalId === 'preventif';

    // Criticals aktif yang itemnya cocok dengan item yang diketik
    const matchingCriticals = item.trim()
        ? activeCriticals.filter(c => c.status !== 'CLOSED' && c.item.toLowerCase() === item.trim().toLowerCase())
        : activeCriticals.filter(c => c.status !== 'CLOSED');

    // Ketika item berubah, reset criticalId jika critical yang dipilih tidak lagi cocok
    const handleItemChange = (val: string) => {
        setItem(val);
        if (criticalId && criticalId !== 'preventif') {
            const stillValid = activeCriticals.find(c => c.id === criticalId && c.item.toLowerCase() === val.trim().toLowerCase());
            if (!stillValid) setCriticalId('');
        }
    };

    // Auto-fill item, scope, foreman dari critical yang dipilih
    const handleCriticalChange = (val: string) => {
        setCriticalId(val);
        if (val && val !== 'preventif') {
            const crit = activeCriticals.find(c => c.id === val);
            if (crit) {
                setItem(crit.item);
                setScope(crit.scope);
                setForeman(crit.foreman);
            }
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
        const result = await onSubmit({
            shift_report_id: initial?.shift_report_id ?? null,
            critical_id: isPreventif ? null : criticalId,
            date: initial?.date ?? today,
            item: item.trim(),
            uraian: uraian.trim(),
            scope,
            foreman,
            tipe: isPreventif ? 'preventif' : 'corrective',
            status: initial?.status ?? 'OPEN',
            keterangan: null,
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
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-2xl shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>build</span>
                        <h2 className="text-base font-extrabold text-white tracking-wide">
                            {initial?.item ? 'Edit Maintenance' : 'Tambah Maintenance'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-emerald-100 hover:text-white cursor-pointer transition-colors bg-white/10 hover:bg-white/20 p-1 rounded-lg">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Row 1: Item | Tipe Maintenance */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Item / Peralatan</label>
                        <ItemCombobox value={item} onChange={handleItemChange} light={true} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Tipe Maintenance</label>
                        <div className="relative">
                            <select
                                value={criticalId || 'preventif'}
                                onChange={e => handleCriticalChange(e.target.value)}
                                className="appearance-none w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none cursor-pointer transition-all shadow-sm"
                            >
                                <option value="preventif">Preventif (tanpa critical)</option>
                                {matchingCriticals.map(c => (
                                    <option key={c.id} value={c.id}>
                                        Critical: {c.item} — {c.deskripsi.slice(0, 40)}
                                    </option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
                        </div>
                        {item.trim() && matchingCriticals.length === 0 && (
                            <p className="text-[10px] font-semibold text-gray-400 mt-1.5 tracking-wide">Tidak ada critical aktif untuk item ini</p>
                        )}
                        {/* Deskripsi critical yang dipilih */}
                        {criticalId && criticalId !== 'preventif' && (() => {
                            const selectedCrit = activeCriticals.find(c => c.id === criticalId);
                            return selectedCrit ? (
                                <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">
                                    <span className="font-bold">Critical : </span>{selectedCrit.deskripsi}
                                </p>
                            ) : null;
                        })()}
                    </div>

                    {/* Row 2: Uraian (full width) */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Uraian Pekerjaan</label>
                        <textarea
                            value={uraian}
                            onChange={e => setUraian(e.target.value)}
                            rows={3}
                            placeholder="Deskripsi pekerjaan maintenance..."
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none resize-none transition-all shadow-sm placeholder-gray-400"
                        />
                    </div>

                    {/* Row 3: Scope HAR | Notif SAP */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Scope HAR</label>
                        <div className="relative">
                            <select
                                value={scope}
                                onChange={e => setScope(e.target.value as HarScope)}
                                className="appearance-none w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none cursor-pointer transition-all shadow-sm"
                            >
                                {HAR_SCOPES.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Notif SAP (ops)</label>
                        <input
                            type="text"
                            value={notif}
                            onChange={e => setNotif(e.target.value)}
                            placeholder="Nomor SA..."
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all shadow-sm placeholder-gray-400"
                        />
                        {criticalId && criticalId !== 'preventif' && (() => {
                            const selectedCrit = activeCriticals.find(c => c.id === criticalId);
                            return selectedCrit?.notif ? (
                                <button
                                    type="button"
                                    onClick={() => setNotif(selectedCrit.notif!)}
                                    className="mt-1.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                                >
                                    Pakai notif critical: <span className="font-extrabold">{selectedCrit.notif}</span>
                                </button>
                            ) : null;
                        })()}
                    </div>

                    {/* Row 4: Foreman | Yang Membuat */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">P. Jawab</label>
                        <div className="relative">
                            <select
                                value={foreman}
                                onChange={e => setForeman(e.target.value as ForemanType)}
                                className="appearance-none w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none cursor-pointer transition-all shadow-sm"
                            >
                                {FOREMAN_OPTIONS.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Yang Membuat Maintenance</label>
                        <OperatorCombobox
                            value={reportedBy}
                            onChange={setReportedBy}
                            placeholder="Pilih atau ketik nama..."
                            dropUp
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
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-bold hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                Menyimpan...
                            </>
                        ) : 'Simpan Maintenance'}
                    </button>
                </div>
            </div>
        </div>
    );
}
