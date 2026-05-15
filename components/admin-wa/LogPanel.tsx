'use client';

import { useState, useEffect, useCallback } from 'react';
import { listNotifications, LogRow } from '@/app/admin/notification-log/actions';
import { KINDS } from '@/app/admin/notification-log/constants';

const KIND_BADGE: Record<string, string> = {
    shift_reminder:        'bg-amber-500/20 text-amber-300 border-amber-500/30',
    daily_reminder:        'bg-orange-500/20 text-orange-300 border-orange-500/30',
    shift_share:           'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    daily_share:           'bg-teal-500/20 text-teal-300 border-teal-500/30',
    maintenance_broadcast: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

const KIND_LABEL: Record<string, string> = Object.fromEntries(
    KINDS.filter(k => k.value).map(k => [k.value, k.label]),
);

function fmtWIB(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

function truncate(s: string | null, n = 100): string {
    if (!s) return '';
    return s.length > n ? s.slice(0, n) + '…' : s;
}

export default function LogPanel() {
    const [rows, setRows] = useState<LogRow[]>([]);
    const [kind, setKind] = useState('');
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<LogRow | null>(null);
    const [resending, setResending] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await listNotifications({ kind });
        if (res.ok) setRows(res.data);
        setLoading(false);
    }, [kind]);

    useEffect(() => { load(); }, [load]);

    const resend = async (logId: string) => {
        if (!confirm('Kirim ulang pesan ini ke target yang sama?')) return;
        setResending(logId);
        setMsg(null);
        try {
            const res = await fetch('/api/whatsapp/resend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logId }),
            });
            const data = await res.json();
            setMsg(res.ok && data.ok ? '✓ Terkirim ulang' : `✗ Gagal: ${data.error ?? data.status}`);
            if (res.ok && data.ok) await load();
        } catch (err) {
            setMsg(`✗ Error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setResending(null);
            setTimeout(() => setMsg(null), 5000);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">Riwayat pesan terkirim</h3>
                <div className="flex items-center gap-2">
                    <select
                        value={kind}
                        onChange={e => setKind(e.target.value)}
                        className="bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                    >
                        {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg cursor-pointer">
                        <span className="material-symbols-outlined text-base">refresh</span>
                        Refresh
                    </button>
                </div>
            </div>

            {msg && <div className="text-sm bg-surface-highlight/50 border border-slate-700 rounded-lg px-4 py-2 text-white">{msg}</div>}

            <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-800 bg-surface-highlight/20">
                                <th className="text-left text-xs text-text-secondary uppercase py-3 px-5">Waktu (WIB)</th>
                                <th className="text-left text-xs text-text-secondary uppercase py-3 px-3">Jenis</th>
                                <th className="text-left text-xs text-text-secondary uppercase py-3 px-3">Target</th>
                                <th className="text-left text-xs text-text-secondary uppercase py-3 px-3">Konteks</th>
                                <th className="text-left text-xs text-text-secondary uppercase py-3 px-3">Pesan (preview)</th>
                                <th className="text-center text-xs text-text-secondary uppercase py-3 px-5">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading && <tr><td colSpan={6} className="text-center py-8 text-text-secondary">Memuat...</td></tr>}
                            {!loading && rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-text-secondary">Belum ada notifikasi terkirim.</td></tr>}
                            {rows.map(r => (
                                <tr key={r.id} onClick={() => setDetail(r)} className="hover:bg-surface-highlight/30 cursor-pointer transition-colors">
                                    <td className="py-3 px-5 text-xs text-text-secondary font-mono whitespace-nowrap">{fmtWIB(r.sent_at)}</td>
                                    <td className="py-3 px-3">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${KIND_BADGE[r.kind] ?? 'bg-slate-700/30 text-slate-300 border-slate-600'}`}>
                                            {KIND_LABEL[r.kind] ?? r.kind}
                                        </span>
                                    </td>
                                    <td className="py-3 px-3">
                                        <div className="text-xs text-white">{r.target_label}</div>
                                        <code className="text-[10px] text-text-secondary">{r.sent_to}</code>
                                    </td>
                                    <td className="py-3 px-3 text-xs text-text-secondary">
                                        <div>{r.target_date}</div>
                                        {(r.target_shift || r.target_group) && (
                                            <div className="text-[10px]">
                                                {r.target_shift && <span>shift: <span className="text-amber-300">{r.target_shift}</span> </span>}
                                                {r.target_group && <span>· grup {r.target_group}</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-3 px-3 text-xs text-text-secondary max-w-md">{truncate(r.payload, 100)}</td>
                                    <td className="py-3 px-5 text-center" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => resend(r.id)} disabled={resending === r.id} title="Kirim ulang"
                                            className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-text-secondary hover:text-emerald-400 disabled:opacity-40 cursor-pointer">
                                            <span className="material-symbols-outlined text-base">{resending === r.id ? 'hourglass_top' : 'send'}</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {detail && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
                    <div className="bg-surface-dark rounded-xl border border-slate-700 max-w-2xl w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">Detail Notifikasi</h3>
                            <button onClick={() => setDetail(null)} className="text-text-secondary hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-text-secondary text-xs uppercase">Waktu</span><div className="text-white font-mono">{fmtWIB(detail.sent_at)}</div></div>
                            <div><span className="text-text-secondary text-xs uppercase">Jenis</span><div className="text-white">{KIND_LABEL[detail.kind] ?? detail.kind}</div></div>
                            <div><span className="text-text-secondary text-xs uppercase">Target Label</span><div className="text-white">{detail.target_label}</div></div>
                            <div><span className="text-text-secondary text-xs uppercase">Fonnte Target</span><code className="text-xs text-emerald-400">{detail.sent_to}</code></div>
                            <div><span className="text-text-secondary text-xs uppercase">Tanggal Konteks</span><div className="text-white">{detail.target_date}</div></div>
                            <div><span className="text-text-secondary text-xs uppercase">Shift/Grup</span><div className="text-white">{detail.target_shift ?? '—'} {detail.target_group && `· ${detail.target_group}`}</div></div>
                        </div>
                        <div>
                            <span className="text-text-secondary text-xs uppercase block mb-1.5">Pesan Lengkap</span>
                            <pre className="bg-surface-highlight border border-slate-700 rounded-lg p-3 text-xs text-white whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">{detail.payload ?? '(kosong)'}</pre>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDetail(null)} className="px-4 py-2 text-sm text-text-secondary hover:text-white rounded-lg cursor-pointer">Tutup</button>
                            <button onClick={() => { resend(detail.id); setDetail(null); }}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer">
                                <span className="material-symbols-outlined text-sm">send</span>
                                Kirim Ulang
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
