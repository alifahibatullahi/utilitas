'use client';

import { useState, useEffect, useCallback } from 'react';
import { listTemplates, updateTemplate, TemplateRow } from '@/app/admin/notification-templates/actions';

const PLACEHOLDERS: Record<string, string[]> = {
    shift_reminder:        ['{{shift}}', '{{group}}', '{{date}}', '{{link}}', '{{links}}'],
    daily_reminder:        ['{{date}}', '{{link}}', '{{links}}'],
    shift_share:           ['{{shift}}', '{{group}}', '{{date}}', '{{summary}}'],
    daily_share:           ['{{date}}', '{{summary}}'],
    maintenance_broadcast: ['{{date}}', '{{summary}}'],
};

export default function TemplatePanel() {
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

    useEffect(() => { load(); }, [load]);

    const save = async (key: string) => {
        const res = await updateTemplate(key, drafts[key] ?? '');
        setMsg(res.ok ? `✓ Template "${key}" tersimpan.` : `✗ ${res.error}`);
        if (res.ok) await load();
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-bold text-slate-900">Template Pesan Notifikasi</h3>
                <p className="text-xs text-slate-500 mt-1">Edit template — placeholder akan diganti otomatis saat kirim.</p>
            </div>

            {msg && <div className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-800">{msg}</div>}
            {loading && <div className="text-slate-500 text-sm">Memuat...</div>}

            <div className="space-y-4">
                {rows.map(r => (
                    <div key={r.key} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-slate-900">{r.label}</h4>
                                <code className="text-xs text-emerald-600">{r.key}</code>
                            </div>
                            <span className="text-xs text-slate-500">Updated: {new Date(r.updated_at).toLocaleString('id-ID')}</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1.5">Placeholder tersedia: {(PLACEHOLDERS[r.key] ?? []).map(p => <code key={p} className="mx-0.5 text-amber-700">{p}</code>)}</p>
                            <textarea
                                value={drafts[r.key] ?? ''}
                                onChange={e => setDrafts({ ...drafts, [r.key]: e.target.value })}
                                rows={8}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-sm font-mono focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button onClick={() => save(r.key)} disabled={drafts[r.key] === r.body}
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer">
                                Simpan
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
