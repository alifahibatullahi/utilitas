'use client';

import { useState } from 'react';

interface Props {
    kind: 'shift' | 'daily';
    reportId: string;
    groupKey?: string;
    className?: string;
}

export function ShareToWAButton({ kind, reportId, groupKey = 'management', className = '' }: Props) {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const send = async () => {
        if (!confirm(`Kirim ringkasan laporan ${kind === 'shift' ? 'shift' : 'harian'} ke grup WhatsApp "${groupKey}"?`)) return;
        setBusy(true);
        setMsg(null);
        try {
            const path = kind === 'shift'
                ? '/api/whatsapp/share-shift-report'
                : '/api/whatsapp/share-daily-report';
            const res = await fetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId, groupKey }),
            });
            const data = await res.json();
            if (res.ok && data.ok) setMsg('✓ Terkirim ke WhatsApp');
            else setMsg(`✗ Gagal: ${data.error ?? data.status ?? 'unknown'}`);
        } catch (err) {
            setMsg(`✗ Error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setBusy(false);
            setTimeout(() => setMsg(null), 5000);
        }
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <button
                onClick={send}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
                title="Share ke WhatsApp Group"
            >
                <span className="material-symbols-outlined text-sm">send</span>
                {busy ? 'Mengirim...' : 'Share ke WA'}
            </button>
            {msg && <span className="text-xs text-text-secondary">{msg}</span>}
        </div>
    );
}
