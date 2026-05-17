'use client';

import { useState, useEffect } from 'react';
import { listGroups, testSend, sendCustomMessage, WhatsappGroupRow } from '@/app/admin/whatsapp-groups/actions';

type Mode = 'group' | 'manual';

export default function TestSendPanel() {
    const [groups, setGroups] = useState<WhatsappGroupRow[]>([]);
    const [mode, setMode] = useState<Mode>('group');
    const [target, setTarget] = useState('');
    const [manualTarget, setManualTarget] = useState('');
    const [message, setMessage] = useState('🧪 Test PowerOps WA — pesan dari hub admin.');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
        listGroups().then(r => { if (r.ok) setGroups(r.data); });
    }, []);

    const effectiveTarget = mode === 'group' ? target : manualTarget.trim();

    const sendDefault = async () => {
        if (!effectiveTarget) { setMsg('Target kosong.'); return; }
        setBusy(true); setMsg(null);
        const res = await testSend(effectiveTarget);
        setMsg(res.ok ? `✓ Test send terkirim (status ${res.status})` : `✗ Gagal (status ${res.status})`);
        setBusy(false);
    };

    const sendCustom = async () => {
        if (!effectiveTarget || !message.trim()) { setMsg('Target & isi pesan wajib.'); return; }
        setBusy(true); setMsg(null);
        const res = await sendCustomMessage(effectiveTarget, message);
        setMsg(res.ok ? `✓ Pesan custom terkirim (status ${res.status})` : `✗ Gagal: ${res.error ?? res.status}`);
        setBusy(false);
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-bold text-white">Test Send</h3>
                <p className="text-xs text-text-secondary mt-1">Kirim pesan tes ke group terdaftar, atau ke nomor pribadi/JID manual untuk verifikasi koneksi Fonnte.</p>
            </div>

            <div className="bg-surface-dark rounded-xl border border-slate-800 p-5 space-y-4 max-w-2xl">
                <div className="flex gap-1 p-1 bg-surface-highlight/30 rounded-lg w-fit">
                    <button onClick={() => setMode('group')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${mode === 'group' ? 'bg-primary text-white' : 'text-text-secondary hover:text-white'}`}>
                        Group terdaftar
                    </button>
                    <button onClick={() => setMode('manual')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${mode === 'manual' ? 'bg-primary text-white' : 'text-text-secondary hover:text-white'}`}>
                        Nomor / JID manual
                    </button>
                </div>

                {mode === 'group' ? (
                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Target Group</label>
                        <select value={target} onChange={e => setTarget(e.target.value)}
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary">
                            <option value="">— pilih target —</option>
                            {groups.map(g => <option key={g.id} value={g.fonnte_target}>{g.label} ({g.key})</option>)}
                        </select>
                        {groups.length === 0 && <p className="text-xs text-text-secondary mt-1">Belum ada group terdaftar. Tambah dulu di tab Groups WA.</p>}
                    </div>
                ) : (
                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Nomor pribadi / Group JID</label>
                        <input value={manualTarget} onChange={e => setManualTarget(e.target.value)}
                            placeholder="628xxxxxxxxxx  atau  120363xxx@g.us"
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-primary" />
                        <p className="text-xs text-text-secondary mt-1">Format Fonnte: <code>628xxx</code> tanpa &quot;+&quot;, atau group JID berakhiran <code>@g.us</code>.</p>
                    </div>
                )}

                <div>
                    <label className="block text-xs text-text-secondary uppercase mb-1.5">Pesan Custom</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                        className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary" />
                </div>

                {msg && <div className="text-sm bg-surface-highlight/50 border border-slate-700 rounded-lg px-4 py-2 text-white">{msg}</div>}

                <div className="flex gap-2 justify-end">
                    <button onClick={sendDefault} disabled={busy || !effectiveTarget}
                        className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg cursor-pointer">
                        Kirim Pesan Default
                    </button>
                    <button onClick={sendCustom} disabled={busy || !effectiveTarget || !message.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg cursor-pointer">
                        <span className="material-symbols-outlined text-sm">send</span>
                        Kirim Pesan Custom
                    </button>
                </div>
            </div>
        </div>
    );
}
