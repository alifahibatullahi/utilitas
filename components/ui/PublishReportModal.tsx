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
    const [copied, setCopied] = useState(false);
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

    const copyToClipboard = () => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
        <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300" 
            onClick={() => !sending && onClose()}
        >
            <div 
                className="bg-gradient-to-b from-[#182333] to-[#0e1621] rounded-2xl border border-slate-700/60 max-w-3xl w-full max-h-[92vh] flex flex-col shadow-[0_0_60px_rgba(43,124,238,0.18)] overflow-hidden transform transition-all duration-300 scale-100" 
                onClick={e => e.stopPropagation()}
            >
                {/* Accent Top Bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-500" />

                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-800/80">
                    <div className="space-y-1">
                        <h3 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400">
                            Publish Laporan {kindLabel}
                        </h3>
                        <p className="text-xs text-text-secondary leading-relaxed flex flex-wrap items-center gap-1.5">
                            Klik <span className="font-semibold text-slate-200">Publish</span> untuk kirim PDF ke grup 
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold">
                                <span className="material-symbols-outlined text-[10px]">group</span>{pdfGroupKey}
                            </span> 
                            dan teks ke 
                            <span className="inline-flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold">
                                <span className="material-symbols-outlined text-[10px]">chat</span>{washiftKey}
                            </span> 
                            sekaligus.
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        disabled={sending} 
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition-all duration-200 disabled:opacity-30 flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                {/* Tabs Wrapper */}
                <div className="px-6 pt-4">
                    <div className="bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80 flex gap-2">
                        <button 
                            onClick={() => setTab('text')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer
                                ${tab === 'text' 
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'}`}
                        >
                            <span className="material-symbols-outlined text-base">chat</span>
                            Text ke {washiftKey}
                        </button>
                        <button 
                            onClick={() => setTab('pdf')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer
                                ${tab === 'pdf' 
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'}`}
                        >
                            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                            PDF ke {pdfGroupKey}
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {tab === 'text' && (
                        <div className="space-y-4">
                            {/* Editor Header */}
                            <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-base">chat</span>
                                    WhatsApp Broadcast Preview
                                </span>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={copyToClipboard}
                                        disabled={loadingText || !text}
                                        className="flex items-center gap-1.5 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40 hover:scale-105 active:scale-95 shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">{copied ? 'check' : 'content_copy'}</span>
                                        {copied ? 'Tersalin' : 'Salin Teks'}
                                    </button>
                                    <span className="bg-slate-900/80 px-3 py-1.5 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-300 font-bold">
                                        {text.length} karakter
                                    </span>
                                </div>
                            </div>
                            
                            {/* Highlighted WhatsApp Window Container */}
                            <div className="bg-[#0b141a] rounded-2xl border border-slate-800/80 shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
                                {/* Chat Header */}
                                <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between border-b border-slate-950/40">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md">
                                            <span className="material-symbols-outlined text-lg">group</span>
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-slate-100">Grup {washiftKey}</div>
                                            <div className="text-[9px] text-emerald-400 font-medium flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                                                Saluran Aktif
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono bg-slate-950/40 px-2.5 py-0.5 rounded border border-slate-900">Broadcast</span>
                                </div>

                                {/* Chat Body Area */}
                                <div className="p-5 bg-gradient-to-b from-[#0b141a] to-[#080d10] relative min-h-[300px] flex flex-col justify-between">
                                    {loadingText ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-3 my-auto mx-auto">
                                            <span className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
                                            <span className="text-emerald-400 text-xs font-semibold tracking-wider uppercase animate-pulse">Memuat template...</span>
                                        </div>
                                    ) : (
                                        <div className="bg-[#005c4b] text-[#e9edef] rounded-xl p-4 max-w-[90%] self-start relative shadow-[0_2px_12px_rgba(0,0,0,0.3)] border-l-4 border-emerald-400 flex flex-col w-full">
                                            <textarea 
                                                value={text} 
                                                onChange={e => setText(e.target.value)} 
                                                rows={15}
                                                className="w-full bg-transparent border-none text-[11px] md:text-xs font-mono focus:outline-none focus:ring-0 text-[#e9edef] resize-none min-h-[260px] leading-relaxed light-scrollbar" 
                                            />
                                            <div className="text-[9px] text-emerald-300/80 font-mono text-right mt-1.5 flex items-center justify-end gap-1 select-none">
                                                <span>Draft</span>
                                                <span className="material-symbols-outlined text-[10px]">done_all</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/30 p-3 rounded-xl border border-slate-800/40">
                                <span className="material-symbols-outlined text-sm text-cyan-400 flex-shrink-0">info</span>
                                <p>Teks di atas dapat diedit secara langsung. Perubahan bersifat sementara dan hanya berlaku untuk pengiriman saat ini.</p>
                            </div>
                        </div>
                    )}

                    {tab === 'pdf' && (
                        <div className="space-y-4 py-6">
                            <div className="max-w-md mx-auto">
                                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-5 shadow-[0_4px_20px_rgba(0,0,0,0.35)] relative overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-amber-500" />
                                    
                                    {/* Glowing PDF File Icon */}
                                    <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.12)] border border-rose-500/20">
                                        <span className="material-symbols-outlined text-4xl">picture_as_pdf</span>
                                    </div>
                                    
                                    {/* Document Details */}
                                    <div className="space-y-1.5">
                                        <div className="text-sm font-extrabold text-slate-100 font-mono tracking-tight break-all">
                                            Laporan_{kindLabel}_{reportId || 'Preview'}.pdf
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            Tautan pratinjau layout cetak resmi yang akan dipublikasikan ke grup <span className="text-emerald-400 font-bold">{pdfGroupKey}</span>.
                                        </p>
                                    </div>
                                    
                                    {/* Preview Button */}
                                    <a 
                                        href={`/laporan-${kind === 'shift' ? 'shift' : 'harian'}/preview`} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="flex items-center gap-2.5 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-rose-300 hover:text-rose-200 border border-slate-800 hover:border-slate-700/80 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md hover:scale-[1.03] active:scale-[0.97]"
                                    >
                                        <span className="material-symbols-outlined text-sm">visibility</span>
                                        Buka Link PDF Tertaut
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Section */}
                {results && (
                    <div className="px-6 pb-4 space-y-2.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laporan Publikasi</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <ResultRow label="📄 PDF ke Grup" res={results.pdf} extra={results.pdf?.pdfUrl} />
                            <ResultRow label="💬 Text ke Washift" res={results.text} />
                        </div>
                    </div>
                )}

                {/* Footer / Actions */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800/80 bg-slate-950/20">
                    <button 
                        onClick={onClose} 
                        disabled={sending} 
                        className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-800 cursor-pointer disabled:opacity-30"
                    >
                        Tutup
                    </button>
                    <button 
                        onClick={publish} 
                        disabled={sending || loadingText || !text.trim()}
                        className="flex items-center gap-2.5 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white rounded-xl cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 transition-all duration-300 shadow-[0_4px_16px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_24px_rgba(16,185,129,0.45)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                    >
                        {sending ? (
                            <>
                                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                                Mengirim Laporan...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-sm">publish</span>
                                Publish Laporan
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
    const isOk = res.ok;
    
    return (
        <div 
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200 
                ${isOk 
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300 shadow-[0_2px_8px_rgba(16,185,129,0.05)]' 
                    : 'bg-rose-500/5 border-rose-500/20 text-rose-300 shadow-[0_2px_8px_rgba(244,63,94,0.05)]'}`}
        >
            <div className="relative flex-shrink-0 mt-0.5">
                <span className={`block w-2 h-2 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className={`absolute top-0 left-0 w-2 h-2 rounded-full animate-ping opacity-75 ${isOk ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-100 leading-none mb-1">{label}</div>
                <div className="text-[10px] font-medium opacity-90 mb-1">
                    {isOk ? 'Berhasil dikirim' : 'Gagal terkirim'}
                </div>
                <div className="text-[9px] font-mono opacity-70">
                    {isOk ? `Status: ${res.status ?? 200}` : `Error: ${res.error ?? 'Unknown Code'}`}
                </div>
                {extra && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 text-[9px] font-mono bg-slate-950/40 p-2 rounded-lg text-slate-400 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[11px] text-blue-400 flex-shrink-0">link</span>
                        <a 
                            href={extra} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:underline text-blue-400 hover:text-blue-300 truncate flex-1"
                        >
                            {extra}
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
