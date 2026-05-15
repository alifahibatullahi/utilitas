'use client';

import { useState, useEffect } from 'react';
import { listGroups, testSend, WhatsappGroupRow } from '@/app/admin/whatsapp-groups/actions';

export default function TestSendPanel() {
    const [groups, setGroups] = useState<WhatsappGroupRow[]>([]);
    const [target, setTarget] = useState('');
    const [message, setMessage] = useState('🧪 Test PowerOps WA — pesan dari hub admin.');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
        listGroups().then(r => { if (r.ok) setGroups(r.data); });
    }, []);

    const sendDefault = async () => {
        if (!target) { setMsg('Pilih target dulu.'); return; }
        setBusy(true); setMsg(null);
        const res = await testSend(target);
        setMsg(res.ok ? `✓ Test send terkirim (status ${res.status})` : `✗ Gagal (status ${res.status})`);
        setBusy(false);
    };

    const sendCustom = async () => {
        if (!target || !message.trim()) { setMsg('Pilih target & isi pesan.'); return; }
        setBusy(true); setMsg(null);
        try {
            // Use the broadcast endpoint with a fake "groupKey" — since we have raw target,
            // resolve via the listed group's key.
            const group = groups.find(g => g.fonnte_target === target);
            if (group) {
                const res = await fetch('/api/whatsapp/broadcast-maintenance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ groupKey: group.key, message }),
                });
                const data = await res.json();
                setMsg(res.ok && data.ok ? '✓ Pesan custom terkirim' : `✗ ${data.error ?? data.status}`);
            } else {
                setMsg('Target tidak terdaftar di whatsapp_groups.');
            }
        } catch (err) {
            setMsg(`✗ Error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-bold text-white">Test Send</h3>
                <p className="text-xs text-text-secondary mt-1">Kirim pesan tes ke salah satu group WA terdaftar untuk verifikasi koneksi Fonnte.</p>
            </div>

            <div className="bg-surface-dark rounded-xl border border-slate-800 p-5 space-y-4 max-w-2xl">
                <div>
                    <label className="block text-xs text-text-secondary uppercase mb-1.5">Target Group</label>
                    <select value={target} onChange={e => setTarget(e.target.value)}
                        className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary">
                        <option value="">— pilih target —</option>
                        {groups.map(g => <option key={g.id} value={g.fonnte_target}>{g.label} ({g.key})</option>)}
                    </select>
                    {groups.length === 0 && <p className="text-xs text-text-secondary mt-1">Belum ada group terdaftar. Tambah dulu di tab Groups.</p>}
                </div>

                <div>
                    <label className="block text-xs text-text-secondary uppercase mb-1.5">Pesan Custom</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                        className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary" />
                </div>

                {msg && <div className="text-sm bg-surface-highlight/50 border border-slate-700 rounded-lg px-4 py-2 text-white">{msg}</div>}

                <div className="flex gap-2 justify-end">
                    <button onClick={sendDefault} disabled={busy || !target}
                        className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg cursor-pointer">
                        Kirim Pesan Default
                    </button>
                    <button onClick={sendCustom} disabled={busy || !target || !message.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg cursor-pointer">
                        <span className="material-symbols-outlined text-sm">send</span>
                        Kirim Pesan Custom
                    </button>
                </div>
            </div>
        </div>
    );
}
