'use client';

import { useEffect, useState } from 'react';
import SearchableSelect, { type SearchableOption } from './SearchableSelect';

export interface PersonnelConfirmField {
    key: string;
    label: string;
    value: string;
    options: SearchableOption[];
    required?: boolean;
}

interface PersonnelConfirmModalProps {
    open: boolean;
    /** Konteks laporan, mis. "Group D • Harian 13 Jul 2026". */
    subtitle?: string;
    fields: PersonnelConfirmField[];
    onConfirm: (values: Record<string, string>) => void;
    onCancel: () => void;
}

/**
 * Pop-up konfirmasi personel sebelum simpan laporan (shift & harian):
 * Supervisor / Foreman / Diisi oleh ditampilkan & bisa dikoreksi di sini,
 * supaya nama yang tersimpan pasti sesuai grup yang dinas — bukan nilai
 * nyangkut dari localStorage grup sebelumnya (insiden harian 13 Jul 2026).
 */
export default function PersonnelConfirmModal({ open, subtitle, fields, onConfirm, onCancel }: PersonnelConfirmModalProps) {
    const [values, setValues] = useState<Record<string, string>>({});

    // Re-seed draft tiap kali modal dibuka (fields membawa nilai form saat itu).
    useEffect(() => {
        if (!open) return;
        setValues(Object.fromEntries(fields.map(f => [f.key, f.value])));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    const missing = fields.filter(f => f.required && !(values[f.key] ?? '').trim());

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#16202e] border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-blue-400 text-[22px]">badge</span>
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-white font-extrabold text-base">Konfirmasi Personel Laporan</h3>
                        {subtitle && <p className="text-slate-400 text-xs font-semibold truncate">{subtitle}</p>}
                    </div>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                    Pastikan nama-nama di bawah sudah benar sebelum laporan disimpan.
                </p>
                <div className="flex flex-col gap-3 mb-5">
                    {fields.map(f => (
                        <div key={f.key} className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                                {f.label} {f.required && <span className="text-red-400">*</span>}
                            </span>
                            <div className="flex items-center bg-[#101822] px-2.5 py-2 rounded-lg border border-slate-700/50 relative pr-6">
                                <SearchableSelect
                                    value={values[f.key] ?? ''}
                                    onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))}
                                    options={f.options}
                                    ariaLabel={f.label}
                                    triggerClassName="text-sm font-bold text-white"
                                />
                                <span className="material-symbols-outlined text-[16px] text-slate-500 absolute right-1.5 pointer-events-none">arrow_drop_down</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-bold hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => onConfirm(values)}
                        disabled={missing.length > 0}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Simpan
                    </button>
                </div>
                {missing.length > 0 && (
                    <p className="text-rose-400 text-[11px] font-semibold mt-2 text-center">
                        Isi dulu: {missing.map(m => m.label).join(', ')}
                    </p>
                )}
            </div>
        </div>
    );
}
