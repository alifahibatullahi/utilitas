'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { ROLE_LABELS, ROLE_DOT_COLORS, OperatorRole } from '@/lib/constants';
import { listOperators, updateOperatorPhone } from './actions';

interface DbOperator {
    id: string;
    name: string;
    role: OperatorRole;
    group_name: string | null;
    jabatan: string | null;
    company: string | null;
    phone_number: string | null;
}

export default function AdminUsersPage() {
    const { operator, canManageUsers } = useOperator();
    const router = useRouter();
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

    useEffect(() => {
        if (!operator) router.push('/');
        else if (!canManageUsers) router.push('/dashboard');
        else load();
    }, [operator, canManageUsers, router, load]);

    if (!operator || !canManageUsers) return null;

    const openEdit = (op: DbOperator) => {
        setEditing(op);
        setPhoneInput(op.phone_number ?? '');
        setSaveErr(null);
    };

    const save = async () => {
        if (!editing) return;
        setSaveErr(null);
        const res = await updateOperatorPhone(editing.id, phoneInput);
        if (!res.ok) {
            setSaveErr(res.error ?? 'Gagal menyimpan.');
            return;
        }
        setEditing(null);
        await load();
    };

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-6">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-xl">
                        <span className="material-symbols-outlined text-primary text-2xl">group</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-white">User & WhatsApp</h2>
                        <p className="text-text-secondary text-sm mt-1">Kelola operator + nomor WhatsApp untuk notifikasi</p>
                    </div>
                </div>
            </header>

            <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800 bg-gradient-to-r from-surface-highlight/50 to-transparent flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">list</span>
                        Daftar Operator
                    </h3>
                    <span className="text-xs text-text-secondary">{rows.length} orang</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-800 bg-surface-highlight/20">
                                <th className="text-left text-xs text-text-secondary uppercase tracking-wider py-3 px-5">Nama</th>
                                <th className="text-left text-xs text-text-secondary uppercase tracking-wider py-3 px-3">Role</th>
                                <th className="text-left text-xs text-text-secondary uppercase tracking-wider py-3 px-3">Grup</th>
                                <th className="text-left text-xs text-text-secondary uppercase tracking-wider py-3 px-3">WhatsApp</th>
                                <th className="text-center text-xs text-text-secondary uppercase tracking-wider py-3 px-5">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading && (
                                <tr><td colSpan={5} className="text-center py-8 text-text-secondary text-sm">Memuat...</td></tr>
                            )}
                            {!loading && rows.length === 0 && (
                                <tr><td colSpan={5} className="text-center py-8 text-text-secondary text-sm">Tidak ada operator. Pastikan tabel operators terisi.</td></tr>
                            )}
                            {rows.map((op) => (
                                <tr key={op.id} className="hover:bg-surface-highlight/30 transition-colors">
                                    <td className="py-3 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-600">
                                                {op.name.charAt(0)}
                                            </div>
                                            <div>
                                                <span className="text-white font-medium block">{op.name}</span>
                                                {op.jabatan && <span className="text-xs text-text-secondary">{op.jabatan}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${ROLE_DOT_COLORS[op.role]}`} />
                                            <span className="text-text-secondary text-xs">{ROLE_LABELS[op.role]}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3 text-text-secondary text-xs">{op.group_name ?? '—'}</td>
                                    <td className="py-3 px-3">
                                        {op.phone_number ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                                                <span className="font-mono text-xs text-white">{op.phone_number}</span>
                                            </div>
                                        ) : (
                                            <span className="text-text-secondary text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-5 text-center">
                                        <button
                                            onClick={() => openEdit(op)}
                                            className="p-1.5 rounded-lg hover:bg-surface-highlight text-text-secondary hover:text-white transition-all cursor-pointer"
                                            title="Edit nomor WA"
                                        >
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
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
                    <div className="bg-surface-dark rounded-xl border border-slate-700 max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div>
                            <h3 className="text-lg font-bold text-white">Edit Nomor WhatsApp</h3>
                            <p className="text-sm text-text-secondary mt-1">{editing.name}</p>
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary uppercase tracking-wider mb-2">Nomor WA</label>
                            <input
                                type="tel"
                                value={phoneInput}
                                onChange={e => setPhoneInput(e.target.value)}
                                placeholder="628xxxxxxxxxx"
                                className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary"
                            />
                            <p className="text-xs text-text-secondary mt-1.5">Format Fonnte: tanpa &quot;+&quot;, mulai dengan 628.</p>
                        </div>
                        {saveErr && <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{saveErr}</div>}
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-text-secondary hover:text-white rounded-lg cursor-pointer">Batal</button>
                            <button onClick={save} className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg cursor-pointer">Simpan</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
