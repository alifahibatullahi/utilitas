'use client';

import { useState, useEffect } from 'react';

export interface MasterDataField {
    key: string;
    label: string;
    placeholder?: string;
    required?: boolean;
}

interface MasterDataFormModalProps {
    open: boolean;
    title: string;
    fields: MasterDataField[];
    initial?: Record<string, string>;
    onClose: () => void;
    onSubmit: (data: Record<string, string>) => Promise<{ error: string | null }>;
}

export default function MasterDataFormModal({ open, title, fields, initial, onClose, onSubmit }: MasterDataFormModalProps) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            const init: Record<string, string> = {};
            for (const f of fields) init[f.key] = initial?.[f.key] ?? '';
            setValues(init);
            setErr(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initial]);

    if (!open) return null;

    const handleSubmit = async () => {
        for (const f of fields) {
            if (f.required && !values[f.key]?.trim()) {
                setErr(`${f.label} wajib diisi`);
                return;
            }
        }
        setSaving(true);
        const trimmed: Record<string, string> = {};
        for (const k in values) trimmed[k] = values[k].trim();
        const res = await onSubmit(trimmed);
        setSaving(false);
        if (res.error) { setErr(res.error); return; }
        onClose();
    };

    const isEdit = !!initial;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>{isEdit ? 'edit' : 'add_circle'}</span>
                        <h2 className="text-base font-extrabold text-white tracking-wide">{title}</h2>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1 rounded-lg">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    {fields.map(f => (
                        <div key={f.key}>
                            <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                                {f.label} {f.required && <span className="text-rose-500">*</span>}
                            </label>
                            <input
                                type="text"
                                value={values[f.key] ?? ''}
                                onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                placeholder={f.placeholder}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all shadow-sm"
                                autoFocus={f.key === fields[0]?.key}
                            />
                        </div>
                    ))}

                    {err && (
                        <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-500" style={{ fontSize: 16 }}>error</span>
                            {err}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-black bg-white text-sm font-bold hover:bg-gray-50">
                        Batal
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                Menyimpan...
                            </>
                        ) : (isEdit ? 'Update' : 'Simpan')}
                    </button>
                </div>
            </div>
        </div>
    );
}
