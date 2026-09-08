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
        else if (!canManageUsers) router.push('/home');
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
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <span className="material-symbols-outlined text-emerald-500 text-2xl">forum</span>
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900">WhatsApp Groups</h2>
                    <p className="text-slate-500 text-sm mt-1">Target group Fonnte untuk reminder & broadcast notifikasi</p>
                </div>
            </header>

            {msg && <div className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-800">{msg}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">Daftar Group</h3>
                        <span className="text-xs text-slate-500">{rows.length} group</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="text-left text-xs text-slate-500 uppercase py-3 px-5">Key</th>
                                    <th className="text-left text-xs text-slate-500 uppercase py-3 px-3">Label</th>
                                    <th className="text-left text-xs text-slate-500 uppercase py-3 px-3">Target Fonnte</th>
                                    <th className="text-center text-xs text-slate-500 uppercase py-3 px-3">Aktif</th>
                                    <th className="text-center text-xs text-slate-500 uppercase py-3 px-5">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && <tr><td colSpan={5} className="text-center py-8 text-slate-500">Memuat...</td></tr>}
                                {!loading && rows.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-500">Belum ada group. Tambah di sebelah kanan.</td></tr>}
                                {rows.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="py-3 px-5"><code className="text-xs text-emerald-600">{r.key}</code></td>
                                        <td className="py-3 px-3 text-slate-800">{r.label}</td>
                                        <td className="py-3 px-3"><code className="text-xs text-slate-500">{r.fonnte_target}</code></td>
                                        <td className="py-3 px-3 text-center">
                                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${r.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                        </td>
                                        <td className="py-3 px-5">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => testRow(r.fonnte_target)} title="Test send" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-emerald-600 cursor-pointer">
                                                    <span className="material-symbols-outlined text-base">send</span>
                                                </button>
                                                <button onClick={() => startEdit(r)} title="Edit" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer">
                                                    <span className="material-symbols-outlined text-base">edit</span>
                                                </button>
                                                <button onClick={() => remove(r.id)} title="Hapus" className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 cursor-pointer">
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

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 h-fit">
                    <h3 className="text-sm font-bold text-slate-900">{editing ? 'Edit Group' : 'Tambah Group'}</h3>

                    <div>
                        <label className="block text-xs text-slate-500 uppercase mb-1.5">Key</label>
                        <select
                            value={form.key}
                            onChange={e => {
                                const v = e.target.value;
                                // Washift selalu chat pribadi (bukan group) — auto uncheck is_group.
                                const autoIsGroup = v === 'washift' ? false : form.is_group;
                                setForm({
                                    ...form,
                                    key: v,
                                    label: form.label || (PRESET_KEYS.find(p => p.value === v)?.label ?? ''),
                                    is_group: autoIsGroup,
                                });
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-primary"
                        >
                            <option value="">— pilih —</option>
                            {PRESET_KEYS.map(k => <option key={k.value} value={k.value}>{k.value}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 uppercase mb-1.5">Label</label>
                        <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-primary" />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 uppercase mb-1.5">Fonnte Target</label>
                        <input value={form.fonnte_target} onChange={e => setForm({ ...form, fonnte_target: e.target.value })}
                            placeholder="120363xxxxxxx@g.us atau 628xxx"
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono text-xs focus:outline-none focus:border-primary" />
                        <p className="text-xs text-slate-500 mt-1">Group JID Fonnte (akhiran <code>@g.us</code>) atau nomor pribadi.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className={`flex items-center gap-2 text-xs ${form.key === 'washift' ? 'text-slate-400 cursor-not-allowed' : 'text-slate-500 cursor-pointer'}`}
                            title={form.key === 'washift' ? 'Washift selalu chat pribadi' : undefined}
                        >
                            <input
                                type="checkbox"
                                checked={form.is_group}
                                disabled={form.key === 'washift'}
                                onChange={e => setForm({ ...form, is_group: e.target.checked })}
                            />
                            Group chat
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                            Aktif
                        </label>
                    </div>
                    {form.key === 'washift' && (
                        <p className="text-[10px] text-amber-800 -mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            Washift selalu chat pribadi. Field target wajib nomor pribadi (<code className="text-amber-900">628xxx</code>).
                        </p>
                    )}

                    <div className="flex gap-2 pt-2">
                        <button onClick={save} className="flex-1 px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg cursor-pointer">{editing ? 'Update' : 'Simpan'}</button>
                        {editing && <button onClick={reset} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer">Batal</button>}
                    </div>
                </div>
            </div>
        </div>
    );
}
