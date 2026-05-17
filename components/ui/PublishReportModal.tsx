'use client';

import { useState, useEffect } from 'react';

interface Props {
    kind: 'shift' | 'daily';
    reportId: string;
    open: boolean;
    onClose: () => void;
    pdfGroupKey?: string;      // default 'management'
    washiftKey?: string;       // group key for washift (default 'washift')
}

interface ChannelResult {
    ok: boolean;
    status?: number;
    error?: string;
    pdfUrl?: string;
}

export function PublishReportModal({
    kind,
    reportId,
    open,
    onClose,
    pdfGroupKey = 'management',
    washiftKey = 'washift',
}: Props) {
    const [tab, setTab] = useState<'pdf' | 'text'>('text');
    const [text, setText] = useState('');
    const [loadingText, setLoadingText] = useState(false);
    const [sending, setSending] = useState(false);
    const [results, setResults] = useState<{ pdf?: ChannelResult; text?: ChannelResult } | null>(null);

    // Load suggested text body from server when modal opens.
    useEffect(() => {
        if (!open || !reportId) return;
        setLoadingText(true);
        setResults(null);
        fetch(`/api/whatsapp/publish-${kind === 'shift' ? 'shift' : 'daily'}?reportId=${reportId}`)
            .then(r => r.json())
            .then(d => { if (d.text) setText(d.text); })
            .catch(err => console.warn('text fetch failed', err))
            .finally(() => setLoadingText(false));
    }, [open, reportId, kind]);

    if (!open) return null;

    const publish = async () => {
        setSending(true);
        setResults(null);
        try {
            const res = await fetch(`/api/whatsapp/publish-${kind === 'shift' ? 'shift' : 'daily'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId,
                    washiftMessage: text,
                    washiftTarget: washiftKey,
                    washiftIsGroupKey: true,
                    pdfGroupKey,
                }),
            });
            const data = await res.json();
            setResults(data);
        } catch (err) {
            setResults({
                pdf: { ok: false, error: err instanceof Error ? err.message : String(err) },
                text: { ok: false, error: err instanceof Error ? err.message : String(err) },
            });
        } finally {
            setSending(false);
        }
    };

    const kindLabel = kind === 'shift' ? 'Shift' : 'Harian';

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !sending && onClose()}>
            <div className="bg-surface-dark rounded-xl border border-slate-700 max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-800">
                    <div>
                        <h3 className="text-lg font-bold text-white">Publish Laporan {kindLabel}</h3>
                        <p className="text-xs text-text-secondary mt-0.5">Klik <b>Publish</b> untuk kirim PDF ke grup <code className="text-emerald-400">{pdfGroupKey}</code> + text ke <code className="text-emerald-400">{washiftKey}</code> sekaligus.</p>
                    </div>
                    <button onClick={onClose} disabled={sending} className="text-text-secondary hover:text-white disabled:opacity-30">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-800 flex gap-1 px-5">
                    <button onClick={() => setTab('text')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer
                            ${tab === 'text' ? 'border-primary text-white' : 'border-transparent text-text-secondary hover:text-white'}`}>
                        <span className="material-symbols-outlined text-base">chat</span>
                        Text ke {washiftKey}
                    </button>
                    <button onClick={() => setTab('pdf')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer
                            ${tab === 'pdf' ? 'border-primary text-white' : 'border-transparent text-text-secondary hover:text-white'}`}>
                        <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                        PDF ke {pdfGroupKey}
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {tab === 'text' && (
                        <div className="space-y-2">
                            <label className="block text-xs text-text-secondary uppercase">Isi pesan ke Washift (editable)</label>
                            {loadingText ? (
                                <div className="text-text-secondary text-sm py-8 text-center">Memuat template...</div>
                            ) : (
                                <textarea value={text} onChange={e => setText(e.target.value)} rows={20}
                                    className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary" />
                            )}
                            <p className="text-xs text-text-secondary">Berisi parameter laporan, list maintenance, dan catatan operasional. Edit bebas sebelum kirim.</p>
                        </div>
                    )}
                    {tab === 'pdf' && (
                        <div className="space-y-3 text-sm text-text-secondary">
                            <p>📄 Laporan akan di-generate sebagai PDF dengan layout tabel lengkap (parameter operasi, maintenance, catatan) dan dikirim ke grup <code className="text-emerald-400">{pdfGroupKey}</code>.</p>
                            <p>⚠️ Tidak ada teks/caption ikut dikirim — file PDF saja.</p>
                            <p>⏱️ Generate PDF butuh ~10–30 detik (puppeteer).</p>
                        </div>
                    )}
                </div>

                {/* Results */}
                {results && (
                    <div className="px-5 pb-2 space-y-2">
                        <ResultRow label="📄 PDF ke grup" res={results.pdf} extra={results.pdf?.pdfUrl} />
                        <ResultRow label="💬 Text ke Washift" res={results.text} />
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-800">
                    <button onClick={onClose} disabled={sending}
                        className="px-4 py-2 text-sm text-text-secondary hover:text-white rounded-lg disabled:opacity-30 cursor-pointer">
                        Tutup
                    </button>
                    <button onClick={publish} disabled={sending || loadingText || !text.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer">
                        {sending ? (
                            <>
                                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                Mengirim...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-base">publish</span>
                                Publish
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ResultRow({ label, res, extra }: { label: string; res?: ChannelResult; extra?: string }) {
    if (!res) return null;
    return (
        <div className={`text-xs flex items-start gap-2 px-3 py-2 rounded-lg ${res.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
            <span className="material-symbols-outlined text-sm">{res.ok ? 'check_circle' : 'error'}</span>
            <div className="flex-1">
                <div className="font-semibold">{label}</div>
                <div className="text-[10px] opacity-80">
                    {res.ok ? `Terkirim (status ${res.status ?? '?'})` : `Gagal: ${res.error ?? `status ${res.status ?? '?'}`}`}
                </div>
                {extra && <code className="text-[10px] opacity-80 break-all">{extra}</code>}
            </div>
        </div>
    );
}
