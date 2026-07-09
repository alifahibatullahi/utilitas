'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { listTemplates, updateTemplate, TemplateRow } from './actions';

const PLACEHOLDERS: Record<string, string[]> = {
    shift_reminder:        ['{{shift}}', '{{group}}', '{{date}}', '{{links}}'],
    daily_reminder:        ['{{date}}', '{{links}}'],
    shift_share:           ['{{shift}}', '{{group}}', '{{date}}', '{{summary}}'],
    daily_share:           ['{{date}}', '{{summary}}'],
    maintenance_broadcast: ['{{date}}', '{{summary}}'],
};

export default function NotificationTemplatesPage() {
    const { operator, canManageUsers } = useOperator();
    const router = useRouter();
    const [rows, setRows] = useState<TemplateRow[]>([]);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await listTemplates();
        if (res.ok) {
            setRows(res.data);
            setDrafts(Object.fromEntries(res.data.map(r => [r.key, r.body])));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!operator) router.push('/');
        else if (!canManageUsers) router.push('/dashboard');
        else load();
    }, [operator, canManageUsers, router, load]);

    if (!operator || !canManageUsers) return null;

    const save = async (key: string) => {
        const res = await updateTemplate(key, drafts[key] ?? '');
        setMsg(res.ok ? `✓ Template "${key}" tersimpan.` : `✗ ${res.error}`);
        if (res.ok) await load();
    };

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto space-y-6">
            <header className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/20 rounded-xl">
                    <span className="material-symbols-outlined text-amber-400 text-2xl">draft</span>
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-white">Template Pesan Notifikasi</h2>
                    <p className="text-text-secondary text-sm mt-1">Edit template — placeholder akan diganti otomatis saat kirim.</p>
                </div>
            </header>

            {msg && <div className="text-sm bg-surface-highlight/50 border border-slate-700 rounded-lg px-4 py-2 text-white">{msg}</div>}

            {loading && <div className="text-text-secondary text-sm">Memuat...</div>}

            <div className="space-y-4">
                {rows.map(r => (
                    <div key={r.key} className="bg-surface-dark rounded-xl border border-slate-800 p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white">{r.label}</h3>
                                <code className="text-xs text-emerald-400">{r.key}</code>
                            </div>
                            <span className="text-xs text-text-secondary">Updated: {new Date(r.updated_at).toLocaleString('id-ID')}</span>
                        </div>
                        <div>
                            <p className="text-xs text-text-secondary mb-1.5">Placeholder tersedia: {(PLACEHOLDERS[r.key] ?? []).map(p => <code key={p} className="mx-0.5 text-amber-300">{p}</code>)}</p>
                            <textarea
                                value={drafts[r.key] ?? ''}
                                onChange={e => setDrafts({ ...drafts, [r.key]: e.target.value })}
                                rows={8}
                                className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={() => save(r.key)}
                                disabled={drafts[r.key] === r.body}
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer"
                            >
                                Simpan
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
