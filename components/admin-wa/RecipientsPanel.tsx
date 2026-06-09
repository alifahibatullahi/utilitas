'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    listRecipients,
    upsertRecipient,
    deleteRecipient,
    testSendRecipient,
    ReminderRecipientRow,
} from '@/app/admin/reminder-recipients/actions';

const GROUPS = ['A', 'B', 'C', 'D'] as const;
const emptyForm = { id: undefined as string | undefined, group_letter: 'A', name: '', phone_number: '', active: true };

export default function RecipientsPanel() {
    const [rows, setRows] = useState<ReminderRecipientRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [editing, setEditing] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await listRecipients();
        if (res.ok) setRows(res.data);
        else setMsg(`✗ ${res.error}`);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const startEdit = (r: ReminderRecipientRow) => {
        setForm({ id: r.id, group_letter: r.group_letter, name: r.name, phone_number: r.phone_number, active: r.active });
        setEditing(true);
        setMsg(null);
    };

    const reset = () => { setForm(emptyForm); setEditing(false); setMsg(null); };

    const save = async () => {
        const res = await upsertRecipient(form);
        setMsg(res.ok ? '✓ Tersimpan.' : `✗ ${res.error}`);
        if (res.ok) { reset(); await load(); }
    };

    const remove = async (id: string, name: string) => {
        if (!confirm(`Hapus penerima "${name}"?`)) return;
        const res = await deleteRecipient(id);
        if (res.ok) await load();
        else setMsg(`✗ ${res.error}`);
    };

    const test = async (phone: string) => {
        const res = await testSendRecipient(phone);
        setMsg(res.ok ? `✓ Test terkirim (status ${res.status}).` : `✗ Test gagal: ${res.error ?? res.status}`);
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-bold text-white">Penerima Pribadi Reminder</h3>
                <p className="text-xs text-text-secondary mt-1">
                    Untuk grup yang punya penerima di sini (mis. A–C), reminder <b>shift</b> &amp; <b>harian (LHUBB)</b>
                    dikirim <b>hanya ke nomor-nomor ini</b> — <i>tidak</i> ke grup WhatsApp. Grup tanpa penerima
                    (mis. D) tetap dikirim ke grup WhatsApp. Format: <code>628xxxxxxxxxx</code>.
                </p>
            </div>

            {msg && <div className="text-sm bg-surface-highlight/50 border border-slate-700 rounded-lg px-4 py-2 text-white">{msg}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white">Daftar Penerima</h4>
                        <span className="text-xs text-text-secondary">{rows.length} orang</span>
                    </div>
                    <div className="overflow-x-auto">
                        {loading && <div className="text-center py-8 text-text-secondary text-sm">Memuat...</div>}
                        {!loading && rows.length === 0 && <div className="text-center py-8 text-text-secondary text-sm">Belum ada penerima. Tambah di sebelah kanan.</div>}
                        {!loading && GROUPS.map(g => {
                            const groupRows = rows.filter(r => r.group_letter === g);
                            if (groupRows.length === 0) return null;
                            return (
                                <div key={g}>
                                    <div className="px-5 py-2 bg-surface-highlight/20 text-xs font-bold text-emerald-400 uppercase tracking-wider">Grup {g}</div>
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-slate-800/50">
                                            {groupRows.map(r => (
                                                <tr key={r.id} className="hover:bg-surface-highlight/30">
                                                    <td className="py-3 px-5">
                                                        <span className="text-white font-medium">{r.name}</span>
                                                    </td>
                                                    <td className="py-3 px-3"><code className="text-xs text-text-secondary">{r.phone_number}</code></td>
                                                    <td className="py-3 px-3 text-center">
                                                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${r.active ? 'bg-emerald-400' : 'bg-slate-600'}`} title={r.active ? 'Aktif' : 'Nonaktif'} />
                                                    </td>
                                                    <td className="py-3 px-5">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => test(r.phone_number)} title="Test send" className="p-1.5 rounded-lg hover:bg-surface-highlight text-text-secondary hover:text-emerald-400 cursor-pointer">
                                                                <span className="material-symbols-outlined text-base">send</span>
                                                            </button>
                                                            <button onClick={() => startEdit(r)} title="Edit" className="p-1.5 rounded-lg hover:bg-surface-highlight text-text-secondary hover:text-white cursor-pointer">
                                                                <span className="material-symbols-outlined text-base">edit</span>
                                                            </button>
                                                            <button onClick={() => remove(r.id, r.name)} title="Hapus" className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-secondary hover:text-red-400 cursor-pointer">
                                                                <span className="material-symbols-outlined text-base">delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-surface-dark rounded-xl border border-slate-800 p-5 space-y-4 h-fit">
                    <h4 className="text-sm font-bold text-white">{editing ? 'Edit Penerima' : 'Tambah Penerima'}</h4>

                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Grup</label>
                        <select value={form.group_letter} onChange={e => setForm({ ...form, group_letter: e.target.value })}
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary">
                            {GROUPS.map(g => <option key={g} value={g}>Grup {g}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Nama</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="Nama penerima"
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
                    </div>

                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Nomor WA</label>
                        <input value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })}
                            placeholder="628xxxxxxxxxx"
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-primary" />
                        <p className="text-xs text-text-secondary mt-1">Tanpa &quot;+&quot;. Awalan <code>0</code> otomatis jadi <code>62</code>.</p>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                        <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                        Aktif
                    </label>

                    <div className="flex gap-2 pt-2">
                        <button onClick={save} className="flex-1 px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg cursor-pointer">{editing ? 'Update' : 'Simpan'}</button>
                        {editing && <button onClick={reset} className="px-4 py-2 text-sm text-text-secondary hover:text-white rounded-lg cursor-pointer">Batal</button>}
                    </div>
                </div>
            </div>
        </div>
    );
}
