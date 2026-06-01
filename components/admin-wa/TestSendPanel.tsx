'use client';

import { useState, useEffect, useCallback } from 'react';
import { listGroups, testSend, sendCustomMessage, WhatsappGroupRow } from '@/app/admin/whatsapp-groups/actions';
import {
    listTemplates,
    renderTemplatePreview,
    sendTemplatePreview,
    TemplateRow,
    PreviewVars,
} from '@/app/admin/notification-templates/actions';

type Mode = 'group' | 'manual';

export default function TestSendPanel() {
    const [groups, setGroups] = useState<WhatsappGroupRow[]>([]);
    const [mode, setMode] = useState<Mode>('group');
    // Akun Fonnte pengirim: 'notif' (reminder, default) atau 'publish' (washift/U2/SU3A).
    const [account, setAccount] = useState<'notif' | 'publish'>('notif');
    const [target, setTarget] = useState('');
    const [manualTarget, setManualTarget] = useState('');
    const [message, setMessage] = useState('🧪 Test PowerOps WA — pesan dari hub admin.');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    // ─── Template preview state ──────────────────────────────────────────────
    const [templates, setTemplates] = useState<TemplateRow[]>([]);
    const [selectedKey, setSelectedKey] = useState<string>('shift_reminder');
    const [previewShift, setPreviewShift] = useState<'pagi' | 'sore' | 'malam'>('pagi');
    const [previewGroup, setPreviewGroup] = useState<string>('A');
    const [previewDate, setPreviewDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
    const [previewBody, setPreviewBody] = useState<string>('');
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        listGroups().then(r => { if (r.ok) setGroups(r.data); });
        listTemplates().then(r => { if (r.ok) setTemplates(r.data); });
    }, []);

    const overrides: PreviewVars = {
        shift: previewShift,
        group: previewGroup,
        date: previewDate,
    };

    const buildOverrides = useCallback((): PreviewVars => ({
        shift: previewShift,
        group: previewGroup,
        date: previewDate,
    }), [previewShift, previewGroup, previewDate]);

    const refreshPreview = useCallback(async () => {
        if (!selectedKey) return;
        setPreviewLoading(true);
        const res = await renderTemplatePreview(selectedKey, buildOverrides());
        if (res.ok) setPreviewBody(res.body);
        else setPreviewBody('(gagal render)');
        setPreviewLoading(false);
    }, [selectedKey, buildOverrides]);

    useEffect(() => {
        refreshPreview();
    }, [refreshPreview]);

    const effectiveTarget = mode === 'group' ? target : manualTarget.trim();

    const fmtErr = (res: { error?: string; status?: number; body?: unknown }) => {
        if (res.error) return res.error;
        if (res.body) return JSON.stringify(res.body);
        return `status ${res.status ?? '?'}`;
    };

    const sendDefault = async () => {
        if (!effectiveTarget) { setMsg('Target kosong.'); return; }
        setBusy(true); setMsg(null);
        const res = await testSend(effectiveTarget, account);
        setMsg(res.ok ? `✓ Test send terkirim (status ${res.status})` : `✗ Gagal: ${fmtErr(res)}`);
        setBusy(false);
    };

    const sendCustom = async () => {
        if (!effectiveTarget || !message.trim()) { setMsg('Target & isi pesan wajib.'); return; }
        setBusy(true); setMsg(null);
        const res = await sendCustomMessage(effectiveTarget, message, account);
        setMsg(res.ok ? `✓ Pesan custom terkirim (status ${res.status})` : `✗ Gagal: ${fmtErr(res)}`);
        setBusy(false);
    };

    const sendTemplate = async () => {
        if (!effectiveTarget || !selectedKey) { setMsg('Target & template wajib.'); return; }
        setBusy(true); setMsg(null);
        const res = await sendTemplatePreview(effectiveTarget, selectedKey, overrides, account);
        setMsg(res.ok ? `✓ Template "${selectedKey}" terkirim (status ${res.status})` : `✗ Gagal: ${fmtErr(res)}`);
        setBusy(false);
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-bold text-white">Test Send</h3>
                <p className="text-xs text-text-secondary mt-1">Kirim pesan tes ke group terdaftar, atau ke nomor pribadi/JID manual untuk verifikasi koneksi Fonnte.</p>
            </div>

            <div className="bg-surface-dark rounded-xl border border-slate-800 p-5 space-y-4 max-w-2xl">
                <div>
                    <label className="block text-xs text-text-secondary uppercase mb-1.5">Akun Fonnte (pengirim)</label>
                    <select value={account} onChange={e => setAccount(e.target.value as 'notif' | 'publish')}
                        className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary">
                        <option value="notif">Notif (reminder laporan — akun lama)</option>
                        <option value="publish">Publish (washift / Utilitas 2 / SU 3A — akun baru)</option>
                    </select>
                    <p className="text-xs text-text-secondary mt-1">Menentukan nomor WA pengirim untuk semua tombol kirim di panel ini.</p>
                </div>

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

            {/* ─── Template Preview ─────────────────────────────────────── */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 p-5 space-y-4 max-w-2xl">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-white">Preview Template</h4>
                        <p className="text-xs text-text-secondary mt-1">Lihat hasil render template dengan variable ({'{{links}}'}, {'{{shift}}'}, dll) terisi. Opsional kirim ke target di atas.</p>
                    </div>
                    <button onClick={refreshPreview} disabled={previewLoading}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg cursor-pointer">
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        Refresh
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Template</label>
                        <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)}
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary">
                            {templates.map(t => <option key={t.key} value={t.key}>{t.label} ({t.key})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Shift</label>
                        <select value={previewShift} onChange={e => setPreviewShift(e.target.value as 'pagi' | 'sore' | 'malam')}
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary">
                            <option value="pagi">Pagi</option>
                            <option value="sore">Sore</option>
                            <option value="malam">Malam</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Group</label>
                        <select value={previewGroup} onChange={e => setPreviewGroup(e.target.value)}
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary">
                            {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>Group {g}</option>)}
                        </select>
                    </div>
                    <div className="sm:col-span-4">
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Tanggal</label>
                        <input type="date" value={previewDate} onChange={e => setPreviewDate(e.target.value)}
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-text-secondary uppercase mb-1.5">Hasil Render</label>
                    <pre className="w-full bg-black/40 border border-slate-700 rounded-lg px-3 py-3 text-emerald-200 text-xs font-mono whitespace-pre-wrap break-words max-h-96 overflow-auto">
{previewLoading ? '(memuat…)' : (previewBody || '(kosong)')}
                    </pre>
                </div>

                <div className="flex justify-end">
                    <button onClick={sendTemplate} disabled={busy || !effectiveTarget || !selectedKey}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg cursor-pointer">
                        <span className="material-symbols-outlined text-sm">forward_to_inbox</span>
                        Kirim Template ke Target
                    </button>
                </div>
            </div>
        </div>
    );
}
