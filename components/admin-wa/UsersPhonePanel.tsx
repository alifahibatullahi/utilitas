'use client';

import { useState, useEffect, useCallback } from 'react';
import { ROLE_LABELS, ROLE_DOT_COLORS, OperatorRole } from '@/lib/constants';
import { listOperators, updateOperatorPhone } from '@/app/admin/users/actions';

interface DbOperator {
    id: string;
    name: string;
    role: OperatorRole;
    group_name: string | null;
    jabatan: string | null;
    company: string | null;
    phone_number: string | null;
}

export default function UsersPhonePanel() {
    const [rows, setRows] = useState<DbOperator[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<DbOperator | null>(null);
    const [phoneInput, setPhoneInput] = useState('');
    const [saveErr, setSaveErr] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await listOperators();
        if (res.ok) setRows(res.data as DbOperator[]);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const openEdit = (op: DbOperator) => {
        setEditing(op);
        setPhoneInput(op.phone_number ?? '');
        setSaveErr(null);
    };

    const save = async () => {
        if (!editing) return;
        setSaveErr(null);
        const res = await updateOperatorPhone(editing.id, phoneInput);
        if (!res.ok) { setSaveErr(res.error ?? 'Gagal menyimpan.'); return; }
        setEditing(null);
        await load();
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-bold text-slate-900">Nomor WhatsApp Operator</h3>
                <p className="text-xs text-slate-500 mt-1">Format Fonnte: <code>628xxxxxxxxxx</code> tanpa &quot;+&quot;.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">Daftar Operator</h4>
                    <span className="text-xs text-slate-500">{rows.length} orang</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="text-left text-xs text-slate-500 uppercase py-3 px-5">Nama</th>
                                <th className="text-left text-xs text-slate-500 uppercase py-3 px-3">Role</th>
                                <th className="text-left text-xs text-slate-500 uppercase py-3 px-3">Grup</th>
                                <th className="text-left text-xs text-slate-500 uppercase py-3 px-3">WhatsApp</th>
                                <th className="text-center text-xs text-slate-500 uppercase py-3 px-5">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && <tr><td colSpan={5} className="text-center py-8 text-slate-500">Memuat...</td></tr>}
                            {!loading && rows.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-500">Tidak ada operator.</td></tr>}
                            {rows.map(op => (
                                <tr key={op.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-200">{op.name.charAt(0)}</div>
                                            <div>
                                                <span className="text-slate-800 font-medium block">{op.name}</span>
                                                {op.jabatan && <span className="text-xs text-slate-500">{op.jabatan}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${ROLE_DOT_COLORS[op.role]}`} />
                                            <span className="text-slate-500 text-xs">{ROLE_LABELS[op.role]}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3 text-slate-500 text-xs">{op.group_name ?? '—'}</td>
                                    <td className="py-3 px-3">
                                        {op.phone_number ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                                                <span className="font-mono text-xs text-slate-800">{op.phone_number}</span>
                                            </div>
                                        ) : <span className="text-slate-500 text-xs">—</span>}
                                    </td>
                                    <td className="py-3 px-5 text-center">
                                        <button onClick={() => openEdit(op)} title="Edit nomor WA"
                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all cursor-pointer">
                                            <span className="material-symbols-outlined text-base">edit</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {editing && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Edit Nomor WhatsApp</h3>
                            <p className="text-sm text-slate-500 mt-1">{editing.name}</p>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Nomor WA</label>
                            <input type="tel" value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                                placeholder="628xxxxxxxxxx"
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono text-sm focus:outline-none focus:border-primary" />
                            <p className="text-xs text-slate-500 mt-1.5">Format Fonnte: tanpa &quot;+&quot;, mulai dengan 628.</p>
                        </div>
                        {saveErr && <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{saveErr}</div>}
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer">Batal</button>
                            <button onClick={save} className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg cursor-pointer">Simpan</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
