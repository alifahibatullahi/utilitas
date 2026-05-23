'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
    kind: 'shift' | 'daily';
    reportId: string;
    open: boolean;
    onClose: () => void;
    pdfGroupKey?: string;      // default 'management'
    washiftKey?: string;       // group key for washift (default 'washift')
    reportDate?: string;       // e.g. '2026-05-23'
    reportShift?: string;      // e.g. 'Pagi' (only for shift reports)
    reportGroup?: string;      // e.g. 'C'
}

interface ChannelResult {
    ok: boolean;
    status?: number;
    error?: string;
    pdfUrl?: string;
}

const MOCK_SUPERVISORS = ['Bayu', 'Putra', 'Ade', 'Hendra', 'Fauzan'];
const MOCK_FOREMEN_TURBIN = ['Rian', 'Fahmi', 'Aris', 'Dwi', 'Eko'];
const MOCK_FOREMEN_BOILER = ['Taufik', 'Yudi', 'Slamet', 'Agus', 'Budi'];

export function PublishReportModal({
    kind,
    reportId,
    open,
    onClose,
    pdfGroupKey = 'management',
    washiftKey = 'washift',
    reportDate,
    reportShift,
    reportGroup,
}: Props) {
    const [tab, setTab] = useState<'pdf' | 'text'>('text');
    const [text, setText] = useState('');
    const [loadingText, setLoadingText] = useState(false);
    const [sending, setSending] = useState(false);
    const [copied, setCopied] = useState(false);
    const [results, setResults] = useState<{ pdf?: ChannelResult; text?: ChannelResult } | null>(null);
    const [supervisor, setSupervisor] = useState('');
    const [foremanTurbin, setForemanTurbin] = useState('');
    const [foremanBoiler, setForemanBoiler] = useState('');

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-adjust textarea height to fit content without internal scrollbar
    useEffect(() => {
        if (tab === 'text' && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [text, tab, open]);

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
                className="relative bg-gradient-to-b from-[#182333] to-[#0e1621] rounded-2xl border border-slate-700/60 max-w-3xl w-full max-h-[92vh] flex flex-col shadow-[0_0_60px_rgba(43,124,238,0.18)] overflow-hidden transform transition-all duration-300 scale-100" 
                onClick={e => e.stopPropagation()}
            >
                {/* Loading Overlay */}
                {sending && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4">
                        <div className="relative flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                            <div className="absolute w-10 h-10 rounded-full border-4 border-emerald-500/20 border-b-emerald-500 animate-spin duration-1000" />
                        </div>
                        <div className="space-y-1 text-center">
                            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest animate-pulse">
                                Mempublikasikan Laporan
                            </h4>
                            <p className="text-[10px] text-slate-400">
                                Sedang mengirim PDF dan pesan WhatsApp, mohon tunggu...
                            </p>
                        </div>
                    </div>
                )}

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

                {/* Personnel Selection */}
                <div className="px-6 pt-4">
                    <div className="bg-slate-900/35 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 select-none">
                            <span className="material-symbols-outlined text-[14px] text-blue-400">badge</span>
                            Penanggung Jawab Laporan
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Supervisor Dropdown */}
                            <div className="relative flex flex-col bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/60 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/30 rounded-xl px-3 py-1.5 transition-all duration-200">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Supervisor</label>
                                <div className="relative flex items-center">
                                    <select 
                                        value={supervisor} 
                                        onChange={e => setSupervisor(e.target.value)} 
                                        className="w-full bg-transparent border-none p-0 text-xs font-black text-slate-200 focus:ring-0 cursor-pointer appearance-none outline-none pr-6"
                                    >
                                        <option value="" className="bg-[#0e1621] text-slate-500">Pilih...</option>
                                        {MOCK_SUPERVISORS.map(name => (
                                            <option key={name} value={name} className="bg-[#0e1621] text-slate-100">{name}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined text-[18px] text-slate-500 absolute right-0 pointer-events-none select-none">expand_more</span>
                                </div>
                            </div>

                            {/* Foreman Turbin Dropdown */}
                            <div className="relative flex flex-col bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/60 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/30 rounded-xl px-3 py-1.5 transition-all duration-200">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Foreman Turbin</label>
                                <div className="relative flex items-center">
                                    <select 
                                        value={foremanTurbin} 
                                        onChange={e => setForemanTurbin(e.target.value)} 
                                        className="w-full bg-transparent border-none p-0 text-xs font-black text-indigo-300 focus:ring-0 cursor-pointer appearance-none outline-none pr-6"
                                    >
                                        <option value="" className="bg-[#0e1621] text-slate-500">Pilih...</option>
                                        {MOCK_FOREMEN_TURBIN.map(name => (
                                            <option key={name} value={name} className="bg-[#0e1621] text-slate-100">{name}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined text-[18px] text-slate-500 absolute right-0 pointer-events-none select-none">expand_more</span>
                                </div>
                            </div>

                            {/* Foreman Boiler Dropdown */}
                            <div className="relative flex flex-col bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/60 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/30 rounded-xl px-3 py-1.5 transition-all duration-200">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Foreman Boiler</label>
                                <div className="relative flex items-center">
                                    <select 
                                        value={foremanBoiler} 
                                        onChange={e => setForemanBoiler(e.target.value)} 
                                        className="w-full bg-transparent border-none p-0 text-xs font-black text-amber-300 focus:ring-0 cursor-pointer appearance-none outline-none pr-6"
                                    >
                                        <option value="" className="bg-[#0e1621] text-slate-500">Pilih...</option>
                                        {MOCK_FOREMEN_BOILER.map(name => (
                                            <option key={name} value={name} className="bg-[#0e1621] text-slate-100">{name}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined text-[18px] text-slate-500 absolute right-0 pointer-events-none select-none">expand_more</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {tab === 'text' && (
                        <div className="space-y-4">
                            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
                                {loadingText ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <span className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
                                        <span className="text-emerald-400 text-xs font-semibold tracking-wider uppercase animate-pulse">Memuat template...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col">
                                        <div className="flex justify-end mb-3">
                                            <button 
                                                onClick={copyToClipboard}
                                                disabled={loadingText || !text}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-40 active:scale-95 border text-[10px] font-bold uppercase tracking-wider
                                                    ${copied 
                                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                                                        : 'bg-slate-900 border-slate-800 hover:border-slate-700/80 text-slate-400 hover:text-white hover:scale-105 shadow-sm'}`}
                                            >
                                                <span className="material-symbols-outlined text-[13px]">{copied ? 'check' : 'content_copy'}</span>
                                                {copied ? 'Tersalin' : 'Salin Teks'}
                                            </button>
                                        </div>
                                        <textarea 
                                            ref={textareaRef}
                                            value={text} 
                                            onChange={e => setText(e.target.value)} 
                                            className="w-full bg-transparent border-none text-[11.5px] md:text-xs font-mono focus:outline-none focus:ring-0 text-slate-200 resize-none overflow-hidden leading-relaxed min-h-[200px]" 
                                            placeholder="Tulis laporan di sini..."
                                        />
                                    </div>
                                )}
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
                                            Laporan_{kindLabel}_{reportDate ?? 'unknown'}_{kind === 'shift' && reportShift ? reportShift : ''}{reportGroup ? `_Grup${reportGroup}` : ''}.pdf
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            PDF akan di-generate dari data laporan ini dan dikirim ke grup <span className="text-emerald-400 font-bold">{pdfGroupKey}</span>.
                                        </p>
                                    </div>

                                    {/* Report Metadata Badge Row */}
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                        {reportDate && (
                                            <span className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold">
                                                <span className="material-symbols-outlined text-[11px]">calendar_today</span>
                                                {reportDate}
                                            </span>
                                        )}
                                        {kind === 'shift' && reportShift && (
                                            <span className="inline-flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold">
                                                <span className="material-symbols-outlined text-[11px]">schedule</span>
                                                Shift {reportShift}
                                            </span>
                                        )}
                                        {reportGroup && (
                                            <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold">
                                                <span className="material-symbols-outlined text-[11px]">groups</span>
                                                Grup {reportGroup}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Preview Button */}
                                    <a 
                                        href={`/laporan-${kind === 'shift' ? 'shift' : 'harian'}/preview`} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="flex items-center gap-2.5 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-rose-300 hover:text-rose-200 border border-slate-800 hover:border-slate-700/80 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md hover:scale-[1.03] active:scale-[0.97]"
                                    >
                                        <span className="material-symbols-outlined text-sm">visibility</span>
                                        Lihat Preview PDF
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
