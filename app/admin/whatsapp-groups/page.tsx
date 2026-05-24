'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import {
    listGroups,
    upsertGroup,
    deleteGroup,
    testSend,
    WhatsappGroupRow,
} from './actions';

const PRESET_KEYS = [
    { value: 'shift_a', label: 'Shift Grup A' },
    { value: 'shift_b', label: 'Shift Grup B' },
    { value: 'shift_c', label: 'Shift Grup C' },
    { value: 'shift_d', label: 'Shift Grup D' },
    { value: 'management', label: 'Management' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'washift', label: 'Washift (nomor pribadi penerima laporan)' },
];

const emptyForm = { id: undefined as string | undefined, key: '', label: '', fonnte_target: '', is_group: true, active: true };

export default function WhatsappGroupsPage() {
    const { operator, canManageUsers } = useOperator();
    const router = useRouter();
    const [rows, setRows] = useState<WhatsappGroupRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [editing, setEditing] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await listGroups();
        if (res.ok) setRows(res.data);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!operator) router.push('/');
        else if (!canManageUsers) router.push('/dashboard');
        else load();
    }, [operator, canManageUsers, router, load]);

    if (!operator || !canManageUsers) return null;

    const startEdit = (r: WhatsappGroupRow) => {
        setForm({ id: r.id, key: r.key, label: r.label, fonnte_target: r.fonnte_target, is_group: r.is_group, active: r.active });
        setEditing(true);
        setMsg(null);
    };

    const reset = () => { setForm(emptyForm); setEditing(false); setMsg(null); };

    const save = async () => {
        const res = await upsertGroup(form);
        setMsg(res.ok ? '✓ Tersimpan.' : `✗ ${res.error}`);
        if (res.ok) { reset(); await load(); }
    };

    const remove = async (id: string) => {
        if (!confirm('Hapus group ini?')) return;
        const res = await deleteGroup(id);
        if (res.ok) await load();
        else setMsg(`✗ ${res.error}`);
    };

    const testRow = async (target: string) => {
        const res = await testSend(target);
        setMsg(res.ok ? `✓ Test send terkirim (status ${res.status}).` : `✗ Test gagal (status ${res.status}).`);
    };

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-6">
            <header className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                    <span className="material-symbols-outlined text-emerald-400 text-2xl">forum</span>
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-white">WhatsApp Groups</h2>
                    <p className="text-text-secondary text-sm mt-1">Target group Fonnte untuk reminder & broadcast notifikasi</p>
                </div>
            </header>

            {msg && <div className="text-sm bg-surface-highlight/50 border border-slate-700 rounded-lg px-4 py-2 text-white">{msg}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">Daftar Group</h3>
                        <span className="text-xs text-text-secondary">{rows.length} group</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800 bg-surface-highlight/20">
                                    <th className="text-left text-xs text-text-secondary uppercase py-3 px-5">Key</th>
                                    <th className="text-left text-xs text-text-secondary uppercase py-3 px-3">Label</th>
                                    <th className="text-left text-xs text-text-secondary uppercase py-3 px-3">Target Fonnte</th>
                                    <th className="text-center text-xs text-text-secondary uppercase py-3 px-3">Aktif</th>
                                    <th className="text-center text-xs text-text-secondary uppercase py-3 px-5">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {loading && <tr><td colSpan={5} className="text-center py-8 text-text-secondary">Memuat...</td></tr>}
                                {!loading && rows.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-text-secondary">Belum ada group. Tambah di sebelah kanan.</td></tr>}
                                {rows.map(r => (
                                    <tr key={r.id} className="hover:bg-surface-highlight/30">
                                        <td className="py-3 px-5"><code className="text-xs text-emerald-400">{r.key}</code></td>
                                        <td className="py-3 px-3 text-white">{r.label}</td>
                                        <td className="py-3 px-3"><code className="text-xs text-text-secondary">{r.fonnte_target}</code></td>
                                        <td className="py-3 px-3 text-center">
                                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${r.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                                        </td>
                                        <td className="py-3 px-5">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => testRow(r.fonnte_target)} title="Test send" className="p-1.5 rounded-lg hover:bg-surface-highlight text-text-secondary hover:text-emerald-400 cursor-pointer">
                                                    <span className="material-symbols-outlined text-base">send</span>
                                                </button>
                                                <button onClick={() => startEdit(r)} title="Edit" className="p-1.5 rounded-lg hover:bg-surface-highlight text-text-secondary hover:text-white cursor-pointer">
                                                    <span className="material-symbols-outlined text-base">edit</span>
                                                </button>
                                                <button onClick={() => remove(r.id)} title="Hapus" className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-secondary hover:text-red-400 cursor-pointer">
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-surface-dark rounded-xl border border-slate-800 p-5 space-y-4 h-fit">
                    <h3 className="text-sm font-bold text-white">{editing ? 'Edit Group' : 'Tambah Group'}</h3>

                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Key</label>
                        <select
                            value={form.key}
                            onChange={e => setForm({ ...form, key: e.target.value, label: form.label || (PRESET_KEYS.find(p => p.value === e.target.value)?.label ?? '') })}
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                        >
                            <option value="">— pilih —</option>
                            {PRESET_KEYS.map(k => <option key={k.value} value={k.value}>{k.value}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Label</label>
                        <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
                    </div>

                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Fonnte Target</label>
                        <input value={form.fonnte_target} onChange={e => setForm({ ...form, fonnte_target: e.target.value })}
                            placeholder="120363xxxxxxx@g.us atau 628xxx"
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-primary" />
                        <p className="text-xs text-text-secondary mt-1">Group JID Fonnte (akhiran <code>@g.us</code>) atau nomor pribadi.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                            <input type="checkbox" checked={form.is_group} onChange={e => setForm({ ...form, is_group: e.target.checked })} />
                            Group chat
                        </label>
                        <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                            Aktif
                        </label>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={save} className="flex-1 px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg cursor-pointer">{editing ? 'Update' : 'Simpan'}</button>
                        {editing && <button onClick={reset} className="px-4 py-2 text-sm text-text-secondary hover:text-white rounded-lg cursor-pointer">Batal</button>}
                    </div>
                </div>
            </div>
        </div>
    );
}
