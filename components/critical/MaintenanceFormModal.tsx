'use client';

import { useState } from 'react';
import { FOREMAN_OPTIONS } from '@/lib/constants';
import { capitalizeFirst } from '@/lib/utils';
import type { HarScope, ForemanType, MaintenanceLogRow, CriticalWithMaintenance, WorkOrderWithPekerjaan, MaintenanceType, WorkOrderRow } from '@/lib/supabase/types';
import ItemCombobox from './ItemCombobox';
import OperatorCombobox from './OperatorCombobox';
import ScopeCombobox from './ScopeCombobox';

type MaintenanceFormData = Omit<MaintenanceLogRow, 'id' | 'created_at' | 'updated_at'>;
type WorkOrderFormData = Omit<WorkOrderRow, 'id' | 'created_at' | 'updated_at'>;

interface MaintenanceFormModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: MaintenanceFormData) => Promise<{ error: string | null }>;
    onSubmitPreventifModifikasi?: (wo: WorkOrderFormData, uraian: string) => Promise<{ error: string | null }>;
    activeCriticals: CriticalWithMaintenance[];
    workOrderContext?: WorkOrderWithPekerjaan;
    initial?: Partial<MaintenanceFormData>;
    operatorName?: string;
    // Saat 'preventifModifikasi': hanya tampilkan tipe preventif/modifikasi (corrective disembunyikan)
    restrictTipe?: 'preventifModifikasi';
}

export default function MaintenanceFormModal({ open, onClose, onSubmit, onSubmitPreventifModifikasi, activeCriticals, workOrderContext, initial, operatorName, restrictTipe }: MaintenanceFormModalProps) {
    // Mode: 'wo' (pekerjaan dalam work order) atau 'corrective' (maintenance untuk critical)
    const isWOMode = !!workOrderContext || !!initial?.work_order_id;

    // Untuk mode corrective: tipeValue = critical_id yang dipilih, atau '' jika belum
    const initCriticalId = initial?.critical_id ?? '';
    const [criticalId, setCriticalId] = useState<string>(initCriticalId);

    const [item, setItem] = useState(initial?.item ?? workOrderContext?.item ?? '');
    const [uraian, setUraian] = useState(initial?.uraian ?? '');
    const [scope, setScope] = useState<HarScope | ''>(initial?.scope ?? workOrderContext?.scope ?? '');
    const [foreman, setForeman] = useState<ForemanType>(initial?.foreman ?? workOrderContext?.foreman ?? 'foreman_turbin');
    const [notif, setNotif] = useState(initial?.notif ?? '');
    const [reportedBy, setReportedBy] = useState(initial?.reported_by ?? operatorName ?? '');
    const [tipeSelected, setTipeSelected] = useState<MaintenanceType>(
        initial?.tipe ?? (restrictTipe === 'preventifModifikasi' ? 'preventif' : 'corrective')
    );
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Tampilkan tipe selector hanya saat: bukan WO mode, bukan edit, & tidak ada critical_id awal
    const showTipeSelector = !isWOMode && ((!initial?.uraian && !initial?.critical_id) || restrictTipe === 'preventifModifikasi');
    const isPreventifModifikasiMode = !isWOMode && (restrictTipe === 'preventifModifikasi'
        ? true
        : showTipeSelector && (tipeSelected === 'preventif' || tipeSelected === 'modifikasi'));

    if (!open) return null;

    // Hanya tampilkan critical OPEN dan dengan item yang sama dengan yang dipilih di form
    const activeCriticalList = activeCriticals.filter(c => {
        if (c.status === 'CLOSED') return false;
        if (!item) return true; // belum pilih item → tampilkan semua
        const itemMatch = c.item === item || (item.includes(' - ') && c.item === item.split(' - ')[0]);
        return itemMatch;
    });
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
        if (!scope) {
            setErr('Scope HAR wajib dipilih');
            return;
        }
        setSaving(true);
        setErr(null);
        const today = new Date().toISOString().slice(0, 10);

        // Mode preventif/modifikasi: buat WorkOrder + auto MaintenanceLog tertaut
        if (isPreventifModifikasiMode) {
            if (!onSubmitPreventifModifikasi) {
                setSaving(false);
                setErr('Handler preventif/modifikasi belum tersedia');
                return;
            }
            const woData: WorkOrderFormData = {
                date: initial?.date ?? today,
                item: item.trim(),
                deskripsi: capitalizeFirst(uraian.trim()),
                tipe: tipeSelected as 'preventif' | 'modifikasi',
                scope,
                foreman,
                status: 'OPEN',
                notif: notif.trim() || null,
                reported_by: reportedBy.trim() || null,
            };
            const res = await onSubmitPreventifModifikasi(woData, capitalizeFirst(uraian.trim()));
            setSaving(false);
            if (res.error) { setErr(res.error); return; }
            onClose();
            return;
        }

        let tipe: MaintenanceFormData['tipe'] = 'corrective';
        if (isWOMode && workOrderContext) {
            tipe = workOrderContext.tipe;
        } else if (!criticalId) {
            tipe = 'corrective';
        }

        const result = await onSubmit({
            shift_report_id: initial?.shift_report_id ?? null,
            critical_id: isWOMode ? null : (criticalId || null),
            work_order_id: workOrderContext?.id ?? initial?.work_order_id ?? null,
            date: initial?.date ?? today,
            item: item.trim(),
            uraian: capitalizeFirst(uraian.trim()),
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

    const isPreventifWO = workOrderContext?.tipe === 'preventif' || tipeSelected === 'preventif';
    const isModifikasiNew = !isWOMode && tipeSelected === 'modifikasi' && showTipeSelector;
    const useEmerald = (isWOMode && workOrderContext?.tipe === 'preventif') || (isPreventifModifikasiMode && tipeSelected === 'preventif');
    const useViolet = (isWOMode && workOrderContext?.tipe === 'modifikasi') || (isPreventifModifikasiMode && tipeSelected === 'modifikasi');
    const headerGradient = useEmerald ? 'from-emerald-500 to-emerald-600'
                         : useViolet ? 'from-violet-500 to-violet-600'
                         : 'from-blue-500 to-blue-600';
    const btnGradient = useEmerald ? 'from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-500/20'
                      : useViolet ? 'from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-violet-500/20'
                      : 'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-500/20';

    const ringClass = useEmerald ? 'focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500'
                    : useViolet ? 'focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500'
                    : 'focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500';
    const stepCircleBg = useEmerald ? 'bg-emerald-50 border-emerald-100 text-emerald-500'
                        : useViolet ? 'bg-violet-50 border-violet-100 text-violet-600'
                        : 'bg-blue-50 border-blue-100 text-blue-500';

    const modalTitle = isWOMode
        ? `${initial?.uraian ? 'Edit' : 'Tambah'} Pekerjaan — ${workOrderContext?.tipe === 'preventif' ? 'Preventif' : 'Modifikasi'}`
        : isPreventifModifikasiMode
            ? `Tambah ${tipeSelected === 'preventif' ? 'Preventif' : 'Modifikasi'}`
            : initial?.uraian ? 'Edit Maintenance' : 'Tambah Maintenance';
    // suppress unused warnings
    void isModifikasiNew; void isPreventifWO;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-955/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4.5 bg-gradient-to-r ${headerGradient} shadow-sm flex-shrink-0`}>
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-white/10 rounded-xl flex items-center justify-center text-white">
                            <span className="material-symbols-outlined font-black" style={{ fontSize: 20 }}>construction</span>
                        </div>
                        <h2 className="text-base font-black text-white tracking-wider uppercase">{modalTitle}</h2>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer transition-all bg-white/10 hover:bg-white/20 p-1.5 rounded-xl hover:scale-105 active:scale-95">
                        <span className="material-symbols-outlined font-bold" style={{ fontSize: 18 }}>close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 overflow-y-auto light-scrollbar flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                    {/* Section 1 */}
                    <div className="md:col-span-2 flex items-center gap-2 pb-1.5 border-b border-slate-100 mb-1">
                        <span className={`w-5 h-5 rounded-full ${stepCircleBg} border flex items-center justify-center text-[10px] font-black`}>01</span>
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Tipe & Peralatan</span>
                    </div>

                    {/* Tipe Maintenance — hanya muncul saat tambah baru tanpa konteks WO/critical */}
                    {showTipeSelector && (
                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Tipe Maintenance</label>
                            <div className="flex gap-3">
                                {([
                                    { value: 'corrective' as MaintenanceType, label: 'Critical', desc: 'Terkait Critical Equipment', activeCls: 'border-blue-500 bg-blue-50/50 text-blue-700 ring-4 ring-blue-500/10 shadow-sm', titleCls: 'text-blue-800', descCls: 'text-blue-600/70', icon: 'warning' },
                                    { value: 'preventif' as MaintenanceType, label: 'Preventif', desc: 'Pemeliharaan rutin', activeCls: 'border-emerald-500 bg-emerald-50/50 text-emerald-700 ring-4 ring-emerald-500/10 shadow-sm', titleCls: 'text-emerald-800', descCls: 'text-emerald-600/70', icon: 'event_available' },
                                    { value: 'modifikasi' as MaintenanceType, label: 'Modifikasi', desc: 'Perubahan/upgrade', activeCls: 'border-violet-500 bg-violet-50/50 text-violet-700 ring-4 ring-violet-500/10 shadow-sm', titleCls: 'text-violet-800', descCls: 'text-violet-600/70', icon: 'precision_manufacturing' },
                                ])
                                .filter(opt => restrictTipe !== 'preventifModifikasi' || opt.value !== 'corrective')
                                .map(opt => {
                                    const active = tipeSelected === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => { setTipeSelected(opt.value); if (opt.value !== 'corrective') setCriticalId(''); }}
                                            className={`flex-1 px-4 py-3 rounded-xl border transition-all cursor-pointer select-none active:scale-[0.98] text-left flex flex-col gap-0.5 ${active ? opt.activeCls : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-350'}`}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                                                <div className={`text-sm font-extrabold ${active ? opt.titleCls : 'text-slate-700'}`}>{opt.label}</div>
                                                {active && <span className="material-symbols-outlined text-[14px] font-black ml-auto">check_circle</span>}
                                            </div>
                                            <div className={`text-[10px] font-semibold ${active ? opt.descCls : 'text-slate-500'} mt-0.5 leading-snug`}>{opt.desc}</div>
                                        </button>
                                    );
                                })}
                            </div>
                            {isPreventifModifikasiMode && (
                                <p className="text-[11px] font-medium text-slate-500 mt-2.5 italic flex items-center gap-1">
                                    <span className="material-symbols-outlined text-amber-500 font-bold" style={{ fontSize: 14 }}>info</span>
                                    Akan dibuat sebagai pekerjaan {tipeSelected} baru dan ditambahkan langsung ke daftar pekerjaan tim HAR
                                </p>
                            )}
                        </div>
                    )}

                    {/* Row 1: Item | Critical (hanya mode corrective) */}
                    <div className={isPreventifModifikasiMode || isWOMode ? 'md:col-span-2' : ''}>
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">No Item + Deskripsi</label>
                        <ItemCombobox value={item} onChange={handleItemChange} light={true} />
                    </div>

                    {!isWOMode && !isPreventifModifikasiMode && (
                        <div className="min-w-0">
                            <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Critical Terkait (opsional)</label>
                            <div className="relative w-full">
                                <select
                                    value={criticalId}
                                    onChange={e => handleCriticalChange(e.target.value)}
                                    className={`appearance-none w-full max-w-full px-3.5 py-2.5 pr-9 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold ${ringClass} outline-none cursor-pointer transition-all shadow-sm truncate`}
                                    style={{ textOverflow: 'ellipsis' }}
                                >
                                    <option value="">— Tanpa Critical —</option>
                                    {activeCriticalList.length === 0 && item && (
                                        <option value="" disabled>(Tidak ada critical OPEN untuk item ini)</option>
                                    )}
                                    {activeCriticalList.map(c => {
                                        const desc = c.deskripsi.length > 30 ? c.deskripsi.slice(0, 30) + '…' : c.deskripsi;
                                        return (
                                            <option key={c.id} value={c.id}>
                                                {c.item} — {desc}
                                            </option>
                                        );
                                    })}
                                </select>
                                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
                            </div>
                            {selectedCritical && (
                                <p className="text-[11px] text-slate-600 mt-1.5 leading-snug break-words">
                                    <span className="font-bold">Critical: </span>{selectedCritical.deskripsi}
                                </p>
                            )}
                            {item && activeCriticalList.length === 0 && !selectedCritical && (
                                <p className="text-[11px] text-slate-400 italic mt-1.5">Tidak ada critical OPEN untuk item ini.</p>
                            )}
                        </div>
                    )}

                    {/* Section 2 */}
                    <div className="md:col-span-2 flex items-center gap-2 pb-1.5 border-b border-slate-100 mt-3 mb-1">
                        <span className={`w-5 h-5 rounded-full ${stepCircleBg} border flex items-center justify-center text-[10px] font-black`}>02</span>
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Rincian Pekerjaan</span>
                    </div>

                    {/* Uraian */}
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Uraian Pekerjaan</label>
                        <textarea
                            value={uraian}
                            onChange={e => setUraian(e.target.value)}
                            rows={3}
                            placeholder="Deskripsikan tindakan atau penemuan pekerjaan..."
                            className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold placeholder-slate-400 ${ringClass} outline-none resize-none transition-all shadow-sm`}
                        />
                    </div>

                    {/* Scope */}
                    <div>
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Scope HAR</label>
                        <ScopeCombobox value={scope} onChange={setScope} light={true} />
                    </div>

                    {/* Notif */}
                    <div>
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Notif SAP (opsional)</label>
                        <input
                            type="text"
                            value={notif}
                            onChange={e => setNotif(e.target.value)}
                            placeholder="Nomor notifikasi SAP..."
                            className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold placeholder-slate-400 ${ringClass} outline-none transition-all shadow-sm`}
                        />
                        {selectedCritical?.notif && (
                            <button type="button" onClick={() => setNotif(selectedCritical.notif!)}
                                className="mt-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">content_copy</span>
                                Pakai notif critical: <span className="font-extrabold">{selectedCritical.notif}</span>
                            </button>
                        )}
                    </div>

                    {/* Section 3 */}
                    <div className="md:col-span-2 flex items-center gap-2 pb-1.5 border-b border-slate-100 mt-3 mb-1">
                        <span className={`w-5 h-5 rounded-full ${stepCircleBg} border flex items-center justify-center text-[10px] font-black`}>03</span>
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Personil</span>
                    </div>

                    {/* Foreman */}
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

                    {/* Yang Membuat */}
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Yang Membuat</label>
                        <OperatorCombobox value={reportedBy} onChange={setReportedBy} placeholder="Pilih atau ketik nama..." dropUp />
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
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white text-sm font-bold hover:bg-slate-100 hover:text-slate-800 hover:border-slate-350 transition-all cursor-pointer shadow-sm active:scale-98">
                        Batal
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className={`flex-1 py-2.5 rounded-xl bg-gradient-to-r ${btnGradient} text-white text-sm font-bold hover:shadow-lg active:scale-98 transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2`}>
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin font-bold" style={{ fontSize: 16 }}>progress_activity</span>
                                Menyimpan...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined font-bold" style={{ fontSize: 18 }}>save</span>
                                Simpan Maintenance
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
