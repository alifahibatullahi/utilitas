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
                        <div className="bg-slate-950/40 border border-slate-800 p-4.5 rounded-xl space-y-3.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="uppercase font-bold tracking-wider text-slate-400">Isi Pesan WhatsApp (Editable)</span>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={copyToClipboard}
                                        disabled={loadingText || !text}
                                        className="flex items-center gap-1.5 hover:text-white bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">{copied ? 'check' : 'content_copy'}</span>
                                        {copied ? 'Tersalin' : 'Salin Teks'}
                                    </button>
                                    <span className="bg-slate-900/80 px-2.5 py-1 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-300">
                                        {text.length} karakter
                                    </span>
                                </div>
                            </div>
                            
                            {loadingText ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <span className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
                                    <span className="text-slate-400 text-xs font-semibold">Memuat template laporan...</span>
                                </div>
                            ) : (
                                <textarea 
                                    value={text} 
                                    onChange={e => setText(e.target.value)} 
                                    rows={12}
                                    className="w-full bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-white text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all duration-150 resize-none min-h-[280px] light-scrollbar" 
                                />
                            )}
                            
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span className="material-symbols-outlined text-sm text-cyan-400 flex-shrink-0">info</span>
                                <p>Berisi parameter operasional, list maintenance, dan catatan shift. Silakan edit bebas sebelum mempublikasikan.</p>
                            </div>
                        </div>
                    )}

                    {tab === 'pdf' && (
                        <div className="space-y-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detail Dokumen PDF</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                {/* Card 1: Engine */}
                                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col">
                                    <div className="bg-blue-500/10 text-blue-400 w-8 h-8 rounded-lg flex items-center justify-center">
                                        <span className="material-symbols-outlined text-lg">auto_settings</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-200">Engine Render</span>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        Menyusun tabel parameter, log aktivitas maintenance, dan catatan ke PDF menggunakan engine server (Puppeteer).
                                    </p>
                                </div>
                                
                                {/* Card 2: Target */}
                                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col">
                                    <div className="bg-emerald-500/10 text-emerald-400 w-8 h-8 rounded-lg flex items-center justify-center">
                                        <span className="material-symbols-outlined text-lg">send_and_archive</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-200">Tujuan Kirim</span>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        Mengirimkan file PDF secara langsung ke saluran komunikasi tim manajemen (<code className="text-emerald-400">{pdfGroupKey}</code>).
                                    </p>
                                </div>

                                {/* Card 3: Layout */}
                                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col">
                                    <div className="bg-purple-500/10 text-purple-400 w-8 h-8 rounded-lg flex items-center justify-center">
                                        <span className="material-symbols-outlined text-lg">fact_check</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-200">Format Laporan</span>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        Dokumen PDF memuat visualisasi layout penuh yang siap diunduh, dicetak, atau diarsipkan.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex gap-3 items-start">
                                <span className="material-symbols-outlined text-amber-400 text-lg flex-shrink-0">warning</span>
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-amber-300">Catatan Khusus PDF</div>
                                    <p className="text-[11px] text-amber-200/70 leading-relaxed">
                                        Tidak ada pesan teks/caption pendukung yang dikirim bersamanya (hanya file PDF). Waktu generate memerlukan waktu sekitar 10–30 detik.
                                    </p>
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
