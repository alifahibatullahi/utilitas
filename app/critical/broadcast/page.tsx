'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import FeatureDisabled from '@/components/ui/FeatureDisabled';
import { DISABLED_FEATURES } from '@/lib/feature-flags';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { listOpenMaintenance, listGroupKeys, OpenMaintenanceRow } from './actions';

export default function MaintenanceBroadcastPage() {
    // Fitur nonaktif sementara — komponen asli tidak di-mount (0 query DB).
    if (DISABLED_FEATURES.critical) return <FeatureDisabled name="Broadcast Maintenance" />;
    return <MaintenanceBroadcastPageInner />;
}

function MaintenanceBroadcastPageInner() {
    const { operator } = useOperator();
    const router = useRouter();
    const [rows, setRows] = useState<OpenMaintenanceRow[]>([]);
    const [groups, setGroups] = useState<{ key: string; label: string }[]>([]);
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [groupKey, setGroupKey] = useState('maintenance');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const [r, g] = await Promise.all([listOpenMaintenance(), listGroupKeys()]);
        if (r.ok) {
            setRows(r.data);
            setSelected(Object.fromEntries(r.data.map(x => [x.id, true])));
        }
        setGroups(g);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!operator) router.push('/');
        else load();
    }, [operator, router, load]);

    // Auto-build the message body whenever selection or rows change.
    const autoBody = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        const picked = rows.filter(r => selected[r.id]);
        if (picked.length === 0) return '';
        const lines = [
            `🛠️ *Permintaan Maintenance OPEN*`,
            `Per: ${today}`,
            ``,
        ];
        picked.forEach((r, i) => {
            lines.push(`${i + 1}. *${r.item}* — ${r.uraian}`);
            lines.push(`   Scope: ${r.scope} | Foreman: ${r.foreman}${r.notif ? ` | Notif: ${r.notif}` : ''}`);
            lines.push(`   Tanggal: ${r.date}`);
        });
        return lines.join('\n');
    }, [rows, selected]);

    // Whenever the auto-body would change AND the user hasn't customized, seed it.
    useEffect(() => {
        setMessage(autoBody);
    }, [autoBody]);

    if (!operator) return null;

    const send = async () => {
        if (!message.trim()) { setMsg('Pesan kosong.'); return; }
        if (!confirm(`Kirim ke grup "${groupKey}"?`)) return;
        setBusy(true);
        setMsg(null);
        try {
            const res = await fetch('/api/whatsapp/broadcast-maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupKey, message }),
            });
            const data = await res.json();
            setMsg(res.ok && data.ok ? '✓ Terkirim ke WhatsApp' : `✗ Gagal: ${data.error ?? data.status}`);
        } catch (err) {
            setMsg(`✗ Error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-6">
            <header className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/20 rounded-xl">
                    <span className="material-symbols-outlined text-orange-400 text-2xl">campaign</span>
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-white">Broadcast Permintaan Maintenance</h2>
                    <p className="text-text-secondary text-sm mt-1">Pilih item OPEN, edit pesan, lalu kirim ke grup WhatsApp</p>
                </div>
            </header>

            {loading && <div className="text-text-secondary text-sm">Memuat...</div>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">Maintenance OPEN</h3>
                        <span className="text-xs text-text-secondary">{rows.length} item</span>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {rows.length === 0 && !loading && (
                            <p className="text-center py-8 text-text-secondary text-sm">Tidak ada maintenance OPEN.</p>
                        )}
                        <ul className="divide-y divide-slate-800/50">
                            {rows.map(r => (
                                <li key={r.id} className="flex items-start gap-3 py-3 px-5 hover:bg-surface-highlight/30">
                                    <input
                                        type="checkbox"
                                        checked={!!selected[r.id]}
                                        onChange={e => setSelected({ ...selected, [r.id]: e.target.checked })}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm text-white font-semibold">{r.item}</p>
                                        <p className="text-xs text-text-secondary">{r.uraian}</p>
                                        <p className="text-xs text-text-secondary mt-1">
                                            <span className="text-amber-400">{r.scope}</span> · {r.foreman} · {r.date}
                                            {r.notif && <span> · Notif {r.notif}</span>}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                <section className="bg-surface-dark rounded-xl border border-slate-800 p-5 space-y-4">
                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Target Grup WA</label>
                        <select
                            value={groupKey}
                            onChange={e => setGroupKey(e.target.value)}
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                        >
                            {groups.length === 0 && <option value="">— belum ada group —</option>}
                            {groups.map(g => <option key={g.key} value={g.key}>{g.label} ({g.key})</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-text-secondary uppercase mb-1.5">Pesan</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={16}
                            className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary"
                        />
                        <p className="text-xs text-text-secondary mt-1">Edit bebas sebelum dikirim.</p>
                    </div>

                    {msg && <div className="text-sm bg-surface-highlight/50 border border-slate-700 rounded-lg px-4 py-2 text-white">{msg}</div>}

                    <div className="flex justify-end gap-2">
                        <button onClick={load} disabled={busy} className="px-4 py-2 text-sm text-text-secondary hover:text-white rounded-lg cursor-pointer">Refresh</button>
                        <button onClick={send} disabled={busy || !message.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer">
                            <span className="material-symbols-outlined text-sm">send</span>
                            {busy ? 'Mengirim...' : 'Kirim ke WA'}
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
