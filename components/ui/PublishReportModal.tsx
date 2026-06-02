'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useOperator } from '@/hooks/useOperator';
import { createClient } from '@/lib/supabase/client';

// ── Structured summary types (mirror dari server endpoints publish-{shift|daily}) ──
interface ShiftReviewSummary {
    header: {
        date: string;
        dateHumanized: string;
        shift: string;
        group: string;
        supervisor: string | null;
        foremanBoiler: string | null;
        foremanTurbin: string | null;
    };
    boilerA: { flow: number | null; pressSteam: number | null; tempSteam: number | null; tempFurnace: number | null; tempFlueGas: number | null; batubara: number | null; consumptionRate: number | null; status: string | null } | null;
    boilerB: { flow: number | null; pressSteam: number | null; tempSteam: number | null; tempFurnace: number | null; tempFlueGas: number | null; batubara: number | null; consumptionRate: number | null; status: string | null } | null;
    turbin: { flowSteam: number | null; pressSteam: number | null; tempSteam: number | null; thrustBearing: number | null; vacuum: number | null; streamDays: number | null } | null;
    steamDist: { pabrik1: number | null; pabrik2: number | null; pabrik3a: number | null; pabrik3b: number | null } | null;
    power: { stgUbb: number | null; internalUbb: number | null; pabrik2: number | null; pabrik3a: number | null; pabrik3b: number | null; piu: number | null; pln: number | null } | null;
    tankLevels: { rcw: number | null; demin: number | null } | null;
    catatan: string;
    maintenance: Array<{ item: string; uraian: string; scope: string; tipe: string; status: string }>;
    critical: Array<{ date: string; item: string; deskripsi: string; scope: string; foreman: string }>;
    // Data internal (Review only — tidak dikirim ke Washift).
    internal?: {
        ashUnloadings: Array<{ silo: string; perusahaan: string; tujuan: string; ritase: number }>;
        solarMasuk: Array<{ supplier: string; liters: number }>;
        solarKeluar: Array<{ tujuan: string; liters: number }>;
        bunkerBerasap: string[];
    };
}

interface DailyReviewSummary {
    header: { date: string; dateHumanized: string };
    boilerA: { flow: number | null; batubara: number | null; tempFurnace: number | null; status: string | null } | null;
    boilerB: { flow: number | null; batubara: number | null; tempFurnace: number | null; status: string | null } | null;
    turbin: { inletFlow: number | null; thrustBearing: number | null } | null;
    steamDist: { pabrik1: number | null; pabrik3: number | null } | null;
    power: { stgUbb: number | null; internalUbb: number | null; pabrik2: number | null; pabrik3a: number | null; pabrik3b: number | null; piu: number | null; pln: number | null } | null;
    tankLevels: { rcw: number | null; demin: number | null } | null;
    stockBatubara: number | null;
    notes: string;
    maintenance: Array<{ item: string; uraian: string; scope: string; tipe: string; status: string }>;
    critical: Array<{ date: string; item: string; deskripsi: string; scope: string; foreman: string }>;
}

/** Format number untuk display — null/NaN → '-', integer no decimal, else 1 decimal. */
function fmt(v: number | null | undefined): string {
    if (v == null) return '-';
    const n = Number(v);
    if (isNaN(n)) return '-';
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Convert scope slug (e.g. "bengkel_las") jadi label readable (e.g. "Bengkel Las"). */
function humanizeScope(slug: string | null | undefined): string {
    if (!slug) return '-';
    return slug.split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Capitalize huruf pertama. Trim whitespace di depan. */
function capFirst(s: string | null | undefined): string {
    if (!s) return '';
    const t = s.trimStart();
    return t.charAt(0).toUpperCase() + t.slice(1);
}

function HeaderTile({ label, value, icon, className = '' }: { label: string; value: string | null | undefined; icon: string; className?: string }) {
    return (
        <div className={`flex flex-col bg-slate-950/45 rounded-xl p-2.5 border border-slate-800/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] ${className}`}>
            <span className="text-slate-400 text-[9px] uppercase tracking-wider font-extrabold flex items-center gap-1.5 select-none">
                <span className="material-symbols-outlined text-[12px] text-slate-500">{icon}</span>
                {label}
            </span>
            <span className="font-bold text-slate-100 text-[11.5px] mt-1 leading-tight truncate" title={value || '—'}>
                {value || '—'}
            </span>
        </div>
    );
}

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
    /** Initial dropdown values dari report DB — sync ke header input laporan. */
    initialSupervisor?: string;
    initialForemanTurbin?: string;   // shift only
    initialForemanBoiler?: string;   // shift only
    /** Callback saat dropdown diubah di modal — supaya nilai ikut ke header input
     *  (sinkron dua arah: terisi di modal → terisi juga di header, & sebaliknya). */
    onSupervisorChange?: (value: string) => void;
    onForemanTurbinChange?: (value: string) => void;   // shift only
    onForemanBoilerChange?: (value: string) => void;   // shift only
    /** Apakah operator yang sedang login bisa approve. Hanya supervisor/foreman/admin. */
    canReview?: boolean;
    /** Nama operator yang melakukan review — disimpan ke shift_reports.reviewed_by. */
    reviewerName?: string;
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
    reportDate,
    reportShift,
    initialSupervisor = '',
    initialForemanTurbin = '',
    initialForemanBoiler = '',
    onSupervisorChange,
    onForemanTurbinChange,
    onForemanBoilerChange,
    canReview = false,
    reviewerName = '',
}: Props) {
    // Default ke tab Review — kartu ringkasan + teks Washift digabung dalam 1 view
    // (stacked, scrollable) supaya di HP semua info terlihat tanpa pindah tab.
    const [tab, setTab] = useState<'review' | 'pdf'>('review');
    const [text, setText] = useState('');
    // Structured summary untuk review tab. Union karena kind shift vs daily struktur beda.
    const [summary, setSummary] = useState<ShiftReviewSummary | DailyReviewSummary | null>(null);
    const [loadingText, setLoadingText] = useState(false);
    const [sending, setSending] = useState(false);
    const [copied, setCopied] = useState(false);
    const [results, setResults] = useState<{ pdf?: ChannelResult; text?: ChannelResult } | null>(null);
    const [supervisor, setSupervisor] = useState(initialSupervisor);
    const [foremanTurbin, setForemanTurbin] = useState(initialForemanTurbin);
    const [foremanBoiler, setForemanBoiler] = useState(initialForemanBoiler);

    // Sync state dari props saat modal open atau initial values berubah dari parent.
    // Direksi: parent (input laporan / fetched report) → modal.
    useEffect(() => {
        if (open) {
            setSupervisor(initialSupervisor);
            setForemanTurbin(initialForemanTurbin);
            setForemanBoiler(initialForemanBoiler);
        }
    }, [open, initialSupervisor, initialForemanTurbin, initialForemanBoiler]);

    // Persist dropdown changes ke DB (direksi: modal → input laporan via DB).
    // Untuk shift: shift_reports.supervisor + shift_personnel.turbin_karu/boiler_karu/turbin_kasi/boiler_kasi.
    // Untuk daily: daily_report_totalizer.kasi_name (foreman tidak applicable).
    const persistChange = async (field: 'supervisor' | 'foreman_turbin' | 'foreman_boiler', value: string) => {
        if (!reportId) return;
        const supabase = createClient();
        const v = value || null;
        try {
            if (kind === 'shift') {
                if (field === 'supervisor') {
                    await supabase.from('shift_reports').update({ supervisor: v }).eq('id', reportId);
                    // Mirror ke shift_personnel.{turbin_kasi, boiler_kasi} sesuai konvensi input form.
                    await supabase.from('shift_personnel').update({ turbin_kasi: v, boiler_kasi: v }).eq('shift_report_id', reportId);
                } else if (field === 'foreman_turbin') {
                    await supabase.from('shift_personnel').update({ turbin_karu: v }).eq('shift_report_id', reportId);
                } else if (field === 'foreman_boiler') {
                    await supabase.from('shift_personnel').update({ boiler_karu: v }).eq('shift_report_id', reportId);
                }
            } else if (kind === 'daily' && field === 'supervisor') {
                // Harian simpan supervisor di daily_report_totalizer.kasi_name.
                await supabase.from('daily_report_totalizer').update({ kasi_name: v }).eq('daily_report_id', reportId);
            }
            // Re-fetch template body — supaya tampilan {{summary}} di template
            // auto-refresh dengan nilai supervisor/foreman baru.
            await fetchTemplate();
        } catch (err) {
            console.warn('[PublishReportModal] persistChange failed', field, err);
        }
    };

    // Daftar operator dibuat identik dgn dropdown di header input-shift
    // (app/input-shift/page.tsx:381-392): filter jabatan saja, TANPA sort & TANPA label
    // grup — supaya pilihan supervisor/foreman di modal sama persis dgn header.
    // - Supervisor: jabatan Supervisor ATAU Foreman (semua foreman bisa jadi supervisor approval).
    // - Foreman Boiler: UBB & jabatan 'Foreman Boiler' atau operator biasa (tanpa jabatan).
    // - Foreman Turbin: UBB & jabatan 'Foreman Turbin' atau operator biasa.
    const { operators } = useOperator();
    const supervisorOptions = useMemo(
        () => operators.filter(op => op.jabatan === 'Supervisor' || op.jabatan?.startsWith('Foreman')),
        [operators],
    );
    const foremanBoilerOptions = useMemo(
        () => operators.filter(op => op.company === 'UBB' && (op.jabatan === 'Foreman Boiler' || !op.jabatan)),
        [operators],
    );
    const foremanTurbinOptions = useMemo(
        () => operators.filter(op => op.company === 'UBB' && (op.jabatan === 'Foreman Turbin' || !op.jabatan)),
        [operators],
    );

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Grow textarea ke tinggi konten penuh supaya TIDAK ada scroll-dalam — body modal
    // jadi satu-satunya scroll container, jadi scroll di HP halus & seluruh teks
    // terlihat. Dipanggil saat template di-load (effect) dan tiap user ketik (onChange).
    const autoSizeTextarea = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        // Set height 'auto' sesaat (untuk ukur scrollHeight) membuat container scroll
        // memendek → browser meng-clamp scrollTop → tampilan "loncat ke atas" tiap keystroke
        // sehingga teks yang sedang diketik tidak terlihat (terutama di HP).
        // Cache scrollTop SEMUA ancestor yang bisa di-scroll + dokumen, lalu kembalikan
        // setelah resize — agar stabil di desktop maupun HP (pendekatan sama dengan
        // react-textarea-autosize). Restore sinkron sebelum browser repaint → tak ada kedip.
        const cached: { node: Element; top: number }[] = [];
        for (let node: HTMLElement | null = el.parentElement; node; node = node.parentElement) {
            if (node.scrollHeight > node.clientHeight) cached.push({ node, top: node.scrollTop });
        }
        const docEl = document.scrollingElement || document.documentElement;
        const docTop = docEl ? docEl.scrollTop : 0;

        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;

        for (const c of cached) c.node.scrollTop = c.top;
        if (docEl) docEl.scrollTop = docTop;
    }, []);

    // Sizing awal saat template selesai di-load. Saat user ketik, sizing dilakukan
    // langsung di onChange (lihat textarea) supaya tidak ada scroll-jump per keystroke.
    useEffect(() => {
        if (tab !== 'review' || !open || loadingText) return;
        const raf = requestAnimationFrame(autoSizeTextarea);
        return () => cancelAnimationFrame(raf);
    }, [tab, open, loadingText, autoSizeTextarea]);

    // Reusable: re-fetch template body dari server. Dipanggil saat modal open AND
    // setiap kali dropdown supervisor/foreman berubah supaya template auto-refresh.
    const fetchTemplate = async () => {
        if (!reportId) return;
        setLoadingText(true);
        try {
            const res = await fetch(`/api/whatsapp/publish-${kind === 'shift' ? 'shift' : 'daily'}?reportId=${reportId}`);
            const d = await res.json();
            if (d.text) setText(d.text);
            if (d.summary) setSummary(d.summary);
        } catch (err) {
            console.warn('text fetch failed', err);
        } finally {
            setLoadingText(false);
        }
    };

    // Load suggested text body from server when modal opens.
    useEffect(() => {
        if (!open || !reportId) return;
        setResults(null);
        fetchTemplate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, reportId, kind]);

    if (!open) return null;

    const copyToClipboard = () => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const publish = async () => {
        if (!reportId) return;
        setSending(true);
        setResults(null);
        try {
            // 1. Persist approval ke parent table (shift_reports / daily_reports).
            //    status=approved + reviewed_by + reviewed_at=now().
            //    Sementara: tidak gate by canReview — siapa pun yang klik button ini = reviewer.
            //    canReview tetap diteruskan dari parent untuk future-proof.
            void canReview;
            const supabase = createClient();
            const reviewedAt = new Date().toISOString();
            const reviewedByValue = reviewerName || 'Operator';
            const parentTable = kind === 'shift' ? 'shift_reports' : 'daily_reports';
            const { error: approveErr } = await supabase
                .from(parentTable)
                .update({ status: 'approved', reviewed_by: reviewedByValue, reviewed_at: reviewedAt })
                .eq('id', reportId);
            if (approveErr) {
                console.warn(`[PublishReportModal] approve persist failed (${parentTable}):`, approveErr.message);
                // Tetap lanjut publish — DB persist optional, jangan blokir kirim WA.
            }

            // 2. Kirim ke endpoint publish (WA washift + PDF management).
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
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-300"
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
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800/80">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg sm:text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400">
                            Publish Laporan {kindLabel}
                        </h3>
                        <button
                            onClick={onClose}
                            disabled={sending}
                            className="text-slate-450 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition-all duration-200 disabled:opacity-30 flex items-center justify-center flex-shrink-0 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                </div>

                {/* Tabs Wrapper — Review Summary + Teks Washift digabung di tab 'review'. */}
                <div className="px-4 sm:px-6 pt-4">
                    <div className="bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80 flex gap-2">
                        {/* Review & Teks — kartu ringkasan + textarea pesan Washift dalam satu view. */}
                        <button
                            onClick={() => setTab('review')}
                            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-4 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer relative
                                ${tab === 'review'
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)]'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'}`}
                        >
                            <span className="material-symbols-outlined text-base">fact_check</span>
                            Review &amp; Teks
                        </button>
                        <button
                            onClick={() => setTab('pdf')}
                            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-4 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer relative
                                ${tab === 'pdf'
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'}`}
                        >
                            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                            PDF<span className="hidden sm:inline">&nbsp;ke {pdfGroupKey}</span>
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 tracking-wider">SOON</span>
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {/* Penanggung Jawab Laporan — ikut scroll (bukan fixed) supaya tidak
                        makan tinggi modal di HP; kompak di layar kecil. */}
                    <div className="bg-slate-900/35 border border-slate-800/80 rounded-2xl p-3 sm:p-4 space-y-2.5 mb-4 sm:mb-5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 select-none">
                            <span className="material-symbols-outlined text-[14px] text-blue-400">badge</span>
                            Penanggung Jawab Laporan
                        </div>
                        <div className={`grid grid-cols-1 ${kind === 'shift' ? 'sm:grid-cols-3' : 'max-w-md'} gap-2 sm:gap-3`}>
                            {/* Supervisor Dropdown */}
                            <div className="relative flex flex-col bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/60 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/30 rounded-xl px-3 py-1.5 transition-all duration-200">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                    {kind === 'daily' ? 'Kasi / Supervisor' : 'Supervisor'}
                                </label>
                                <div className="relative flex items-center">
                                    <select
                                        value={supervisor}
                                        onChange={e => { const v = e.target.value; setSupervisor(v); onSupervisorChange?.(v); persistChange('supervisor', v); }}
                                        className="w-full bg-transparent border-none p-0 text-xs font-black text-slate-200 focus:ring-0 cursor-pointer appearance-none outline-none pr-6"
                                    >
                                        <option value="" className="bg-[#0e1621] text-slate-500">Pilih...</option>
                                        {supervisorOptions.map(op => (
                                            <option key={op.id} value={op.name} className="bg-[#0e1621] text-slate-100">
                                                {op.name}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined text-[18px] text-slate-500 absolute right-0 pointer-events-none select-none">expand_more</span>
                                </div>
                            </div>

                            {kind === 'shift' && (
                                <>
                                    {/* Foreman Turbin Dropdown */}
                                    <div className="relative flex flex-col bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/60 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/30 rounded-xl px-3 py-1.5 transition-all duration-200">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Foreman Turbin</label>
                                        <div className="relative flex items-center">
                                            <select
                                                value={foremanTurbin}
                                                onChange={e => { const v = e.target.value; setForemanTurbin(v); onForemanTurbinChange?.(v); persistChange('foreman_turbin', v); }}
                                                className="w-full bg-transparent border-none p-0 text-xs font-black text-indigo-300 focus:ring-0 cursor-pointer appearance-none outline-none pr-6"
                                            >
                                                <option value="" className="bg-[#0e1621] text-slate-500">Pilih...</option>
                                                {foremanTurbinOptions.map(op => (
                                                    <option key={op.id} value={op.name} className="bg-[#0e1621] text-slate-100">
                                                        {op.name}
                                                    </option>
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
                                                onChange={e => { const v = e.target.value; setForemanBoiler(v); onForemanBoilerChange?.(v); persistChange('foreman_boiler', v); }}
                                                className="w-full bg-transparent border-none p-0 text-xs font-black text-amber-300 focus:ring-0 cursor-pointer appearance-none outline-none pr-6"
                                            >
                                                <option value="" className="bg-[#0e1621] text-slate-500">Pilih...</option>
                                                {foremanBoilerOptions.map(op => (
                                                    <option key={op.id} value={op.name} className="bg-[#0e1621] text-slate-100">
                                                        {op.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined text-[18px] text-slate-500 absolute right-0 pointer-events-none select-none">expand_more</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Review & Teks — kartu ringkasan + pesan Washift digabung dalam satu view. */}
                    {tab === 'review' && (
                        loadingText || !summary ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <span className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
                                <span className="text-emerald-400 text-xs font-semibold tracking-wider uppercase animate-pulse">Memuat ringkasan...</span>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Kartu ringkasan per area */}
                                {kind === 'shift' ? (
                                    <ReviewSummaryShift summary={summary as ShiftReviewSummary} />
                                ) : (
                                    <ReviewSummaryDaily summary={summary as DailyReviewSummary} />
                                )}

                                {/* Pesan ke Washift — editable, tepat di bawah ringkasan supaya
                                    reviewer langsung lihat & koreksi sebelum publish. */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[14px] text-cyan-400">chat</span>
                                            Pesan ke {washiftKey}
                                        </div>
                                        <button
                                            onClick={copyToClipboard}
                                            disabled={loadingText || !text}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-40 active:scale-95 border text-[10px] font-bold uppercase tracking-wider
                                                ${copied
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                                                    : 'bg-slate-900 border-slate-800 hover:border-slate-700/80 text-slate-400 hover:text-white hover:scale-105 shadow-sm'}`}
                                        >
                                            <span className="material-symbols-outlined text-[13px]">{copied ? 'check' : 'content_copy'}</span>
                                            {copied ? 'Tersalin' : 'Salin'}
                                        </button>
                                    </div>
                                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
                                        <textarea
                                            ref={textareaRef}
                                            value={text}
                                            onChange={e => { setText(e.target.value); autoSizeTextarea(); }}
                                            className="w-full bg-transparent border-none text-xs sm:text-[13px] font-mono focus:outline-none focus:ring-0 text-slate-200 resize-none overflow-hidden leading-relaxed min-h-[240px]"
                                            placeholder="Tulis laporan di sini..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {tab === 'pdf' && (
                        <div className="space-y-4 py-12">
                            <div className="max-w-md mx-auto">
                                <div className="bg-slate-950/60 border border-slate-800/80 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
                                    <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.15)] border border-amber-500/30">
                                        <span className="material-symbols-outlined text-4xl">construction</span>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-base font-extrabold text-amber-300 uppercase tracking-wider">Coming Soon</h3>
                                        <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                                            Pengiriman PDF laporan ke grup <span className="text-emerald-400 font-bold">{pdfGroupKey}</span> sedang dalam pengembangan. Untuk sementara, gunakan tab <span className="text-cyan-300 font-bold">Text Washift</span> untuk publish.
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                                        Fitur dalam pengembangan
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Section */}
                {results && (
                    <div className="px-4 sm:px-6 pb-4 space-y-2.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laporan Publikasi</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <ResultRow label="📄 PDF ke Grup" res={results.pdf} extra={results.pdf?.pdfUrl} />
                            <ResultRow label="💬 Text ke Washift" res={results.text} />
                        </div>
                    </div>
                )}

                {/* Footer / Actions */}
                <div className="flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-slate-800/80 bg-slate-950/20">
                    <button 
                        onClick={onClose} 
                        disabled={sending} 
                        className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-800 cursor-pointer disabled:opacity-30"
                    >
                        Tutup
                    </button>
                    <button
                        onClick={publish}
                        disabled={sending || loadingText || !text.trim() || !reportId || tab === 'pdf'}
                        title={tab === 'pdf' ? 'PDF ke management belum tersedia (coming soon)' : !reportId ? 'Laporan belum disimpan' : `Setujui isi laporan dan kirim teks ke ${washiftKey}`}
                        className="flex items-center gap-2.5 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white rounded-xl cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 transition-all duration-300 shadow-[0_4px_16px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_24px_rgba(16,185,129,0.45)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                    >
                        {sending ? (
                            <>
                                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                                Mengirim Laporan...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                {tab === 'pdf' ? 'PDF Coming Soon' : 'Setujui & Kirim ke washift'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ──────────── Review Summary Components — kartu mini per area ────────────

function ReviewCard({ title, icon, color = 'slate', children }: { title: string; icon: string; color?: 'slate' | 'amber' | 'cyan' | 'purple' | 'emerald' | 'rose'; children: React.ReactNode }) {
    const colorMap: Record<string, { border: string; text: string; bg: string; accent: string }> = {
        slate: { border: 'border-slate-800/80', text: 'text-slate-350', bg: 'bg-slate-950/40', accent: 'bg-slate-600' },
        amber: { border: 'border-amber-500/25', text: 'text-amber-300', bg: 'bg-slate-950/40', accent: 'bg-amber-500' },
        cyan: { border: 'border-cyan-500/25', text: 'text-cyan-300', bg: 'bg-slate-950/40', accent: 'bg-cyan-500' },
        purple: { border: 'border-purple-500/25', text: 'text-purple-300', bg: 'bg-slate-950/40', accent: 'bg-purple-500' },
        emerald: { border: 'border-emerald-500/25', text: 'text-emerald-300', bg: 'bg-slate-950/40', accent: 'bg-emerald-500' },
        rose: { border: 'border-rose-500/25', text: 'text-rose-300', bg: 'bg-slate-950/40', accent: 'bg-rose-500' },
    };
    const c = colorMap[color] || colorMap.slate;
    return (
        <div className={`relative ${c.bg} border ${c.border} rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col justify-between`}>
            {/* Left Accent Strip */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${c.accent}`} />
            
            <div className="pl-1.5 space-y-3">
                <div className={`text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 ${c.text}`}>
                    <span className="material-symbols-outlined text-[16px]">{icon}</span>
                    {title}
                </div>
                <div className="space-y-1.5 text-[11.5px] text-slate-200">{children}</div>
            </div>
        </div>
    );
}

function Row({ label, value, unit }: { label: string; value: string | number | null | undefined; unit?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-2">
            <span className="text-slate-400 text-[10px]">{label}</span>
            <span className="font-mono font-bold text-slate-100">
                {value == null || value === '' ? '—' : value}
                {unit && value != null && value !== '' && <span className="ml-1 text-[10px] text-slate-400 font-normal">{unit}</span>}
            </span>
        </div>
    );
}

function StatusBadge({ value }: { value: string | null }) {
    if (!value) return <span className="text-slate-500">—</span>;
    const v = value.toLowerCase();
    const colorMap: Record<string, string> = {
        running: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
        standby: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
        maintenance: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
        berasap: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
        shutdown: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    };
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${colorMap[v] ?? colorMap.standby}`}>
            {value}
        </span>
    );
}

// Sub-list untuk data internal di kartu Catatan Shift (unloading silo / solar).
function InternalList({ title, rows }: { title: string; rows: string[] }) {
    // Sembunyikan total kalau tidak ada aktivitas (hanya tampil saat ada kejadian).
    if (rows.length === 0) return null;
    return (
        <div>
            <div className="text-[10px] font-bold text-slate-300">{title}</div>
            <ul className="space-y-0.5 mt-0.5">
                {rows.map((r, i) => (
                    <li key={i} className="text-[10px] text-slate-200 font-mono">{r}</li>
                ))}
            </ul>
        </div>
    );
}

function ReviewSummaryShift({ summary }: { summary: ShiftReviewSummary }) {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-4 shadow-[0_4px_20px_rgba(16,185,129,0.05)]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-1.5 select-none">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    Informasi Laporan Shift
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <HeaderTile label="Tanggal" value={summary.header.dateHumanized} icon="calendar_today" className="col-span-2 sm:col-span-1" />
                    <HeaderTile label="Shift" value={summary.header.shift} icon="schedule" className="col-span-1" />
                    <HeaderTile label="Grup" value={summary.header.group} icon="group" className="col-span-1" />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Boiler A */}
                <ReviewCard title="Boiler A" icon="factory" color="rose">
                    <Row label="Flow Steam" value={fmt(summary.boilerA?.flow)} unit="t/h" />
                    <Row label="Press Steam" value={fmt(summary.boilerA?.pressSteam)} unit="MPa" />
                    <Row label="Temp Steam" value={fmt(summary.boilerA?.tempSteam)} unit="°C" />
                    <Row label="Temp Furnace" value={fmt(summary.boilerA?.tempFurnace)} unit="°C" />
                    <Row label="Batubara" value={fmt(summary.boilerA?.batubara)} unit="ton" />
                    <Row label="Cons. Rate" value={summary.boilerA?.consumptionRate != null ? summary.boilerA.consumptionRate.toFixed(3) : null} unit="ton/ton" />
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-slate-400 text-[10px]">Status</span>
                        <StatusBadge value={summary.boilerA?.status ?? null} />
                    </div>
                </ReviewCard>

                {/* Boiler B */}
                <ReviewCard title="Boiler B" icon="factory" color="purple">
                    <Row label="Flow Steam" value={fmt(summary.boilerB?.flow)} unit="t/h" />
                    <Row label="Press Steam" value={fmt(summary.boilerB?.pressSteam)} unit="MPa" />
                    <Row label="Temp Steam" value={fmt(summary.boilerB?.tempSteam)} unit="°C" />
                    <Row label="Temp Furnace" value={fmt(summary.boilerB?.tempFurnace)} unit="°C" />
                    <Row label="Batubara" value={fmt(summary.boilerB?.batubara)} unit="ton" />
                    <Row label="Cons. Rate" value={summary.boilerB?.consumptionRate != null ? summary.boilerB.consumptionRate.toFixed(3) : null} unit="ton/ton" />
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-slate-400 text-[10px]">Status</span>
                        <StatusBadge value={summary.boilerB?.status ?? null} />
                    </div>
                </ReviewCard>

                {/* Turbin */}
                <ReviewCard title="Turbin" icon="mode_fan" color="cyan">
                    <Row label="Flow Steam" value={fmt(summary.turbin?.flowSteam)} unit="t/h" />
                    <Row label="Press Steam" value={fmt(summary.turbin?.pressSteam)} unit="MPa" />
                    <Row label="Temp Steam" value={fmt(summary.turbin?.tempSteam)} unit="°C" />
                    <Row label="Thrust Bearing" value={fmt(summary.turbin?.thrustBearing)} unit="°C" />
                    <Row label="Vacuum" value={summary.turbin?.vacuum ?? null} unit="MPa" />
                </ReviewCard>

                {/* Distribusi Steam */}
                <ReviewCard title="Distribusi Steam" icon="water_drop" color="cyan">
                    <Row label="Pabrik 1" value={fmt(summary.steamDist?.pabrik1)} unit="t/h" />
                    <Row label="Pabrik 2" value={fmt(summary.steamDist?.pabrik2)} unit="t/h" />
                    <Row label="Pabrik 3A" value={fmt(summary.steamDist?.pabrik3a)} unit="t/h" />
                    <Row label="Pabrik 3B" value={fmt(summary.steamDist?.pabrik3b)} unit="t/h" />
                </ReviewCard>

                {/* Power */}
                <ReviewCard title="Power" icon="bolt" color="amber">
                    <Row label="STG UBB" value={fmt(summary.power?.stgUbb)} unit="MW" />
                    <Row label="Internal UBB" value={fmt(summary.power?.internalUbb)} unit="MW" />
                    <Row label="Pabrik 2" value={fmt(summary.power?.pabrik2)} unit="MW" />
                    <Row label="Pabrik 3A" value={fmt(summary.power?.pabrik3a)} unit="MW" />
                    <Row label="Pabrik 3B" value={fmt(summary.power?.pabrik3b)} unit="MW" />
                    <Row label="PIU" value={fmt(summary.power?.piu)} unit="MW" />
                    <Row label="PLN" value={fmt(summary.power?.pln)} unit="MW" />
                </ReviewCard>

                {/* Tank Levels */}
                <ReviewCard title="Tank Level" icon="water" color="emerald">
                    <Row label="RCW" value={fmt(summary.tankLevels?.rcw)} unit="m³" />
                    <Row label="Demin" value={fmt(summary.tankLevels?.demin)} unit="m³" />
                </ReviewCard>
            </div>

            {/* Catatan Operasional + detail tambahan (unloading silo, solar, bunker berasap) — ikut ke washift */}
            <ReviewCard title="Catatan Operasional" icon="sticky_note_2" color="amber">
                {summary.catatan.trim() ? (
                    <pre className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">{summary.catatan}</pre>
                ) : (
                    <p className="text-[11px] text-slate-500 italic">Tidak ada catatan.</p>
                )}

                {summary.internal && (() => {
                    const ashRows = summary.internal.ashUnloadings.map(a => `Silo ${a.silo} · ${a.perusahaan} → ${a.tujuan} · ${a.ritase} rit`);
                    const solarInRows = summary.internal.solarMasuk.map(s => `${s.supplier} · ${fmt(s.liters)} L`);
                    const solarOutRows = summary.internal.solarKeluar.map(s => `${s.tujuan} · ${fmt(s.liters)} L`);
                    // bunkerBerasap sudah berformat "Bunker X berasap sejak DD/MM Shift Y" dari API.
                    const berasapRows = summary.internal.bunkerBerasap;
                    // Sembunyikan seluruh blok kalau tidak ada aktivitas apa pun.
                    if (!ashRows.length && !solarInRows.length && !solarOutRows.length && !berasapRows.length) return null;
                    return (
                        <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-2.5">
                            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">inventory_2</span>
                                Detail Catatan Operasional
                            </div>
                            <InternalList title="Unloading Silo (Fly Ash)" rows={ashRows} />
                            <InternalList title="Kedatangan Solar" rows={solarInRows} />
                            <InternalList title="Permintaan Solar" rows={solarOutRows} />
                            <InternalList title="Bunker Berasap" rows={berasapRows} />
                        </div>
                    );
                })()}
            </ReviewCard>

            {/* Maintenance */}
            <ReviewCard title={`Maintenance (${summary.maintenance.length})`} icon="build" color="slate">
                {summary.maintenance.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">Tidak ada item maintenance.</p>
                ) : (
                    <div className="space-y-2.5 divide-y divide-slate-800/55">
                        {summary.maintenance.map((m, i) => (
                            <div key={i} className={`flex flex-col gap-1.5 text-[11px] ${i > 0 ? 'pt-2.5' : ''}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-mono font-extrabold text-slate-400 text-[10px]">{String(i + 1).padStart(2, '0')}.</span>
                                        <span className="font-mono font-black text-cyan-400 text-[11px]">{m.item}</span>
                                        <span className="text-[9px] bg-slate-800/70 text-slate-300 px-2 py-0.5 rounded font-bold uppercase">{humanizeScope(m.scope)}</span>
                                    </div>
                                    <StatusBadge value={m.status} />
                                </div>
                                <div className="text-slate-300 pl-5 leading-normal font-medium">{capFirst(m.uraian)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </ReviewCard>

            {/* Critical Equipment */}
            {summary.critical.length > 0 && (
                <ReviewCard title={`Critical Equipment (${summary.critical.length})`} icon="warning" color="rose">
                    <div className="space-y-2.5 divide-y divide-slate-800/55">
                        {summary.critical.map((c, i) => (
                            <div key={i} className={`flex flex-col gap-1.5 text-[11px] ${i > 0 ? 'pt-2.5' : ''}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-mono text-[9px] text-slate-300 bg-slate-900 border border-slate-800/80 px-1.5 py-0.5 rounded font-bold">{c.date}</span>
                                        <span className="font-mono font-black text-rose-400 text-[11px]">{c.item}</span>
                                        <span className="text-[9px] bg-slate-800/70 text-slate-300 px-2 py-0.5 rounded font-bold uppercase">{humanizeScope(c.scope)}</span>
                                    </div>
                                </div>
                                <div className="text-slate-300 pl-1 leading-normal font-medium">{capFirst(c.deskripsi)}</div>
                            </div>
                        ))}
                    </div>
                </ReviewCard>
            )}
        </div>
    );
}

function ReviewSummaryDaily({ summary }: { summary: DailyReviewSummary }) {
    return (
        <div className="space-y-4">
            {/* Header Laporan Harian */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-4 shadow-[0_4px_20px_rgba(16,185,129,0.05)]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-1.5 select-none">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    Informasi Laporan Harian
                </div>
                <div className="grid grid-cols-1 gap-2.5 max-w-sm">
                    <HeaderTile label="Tanggal" value={summary.header.dateHumanized} icon="calendar_today" />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ReviewCard title="Boiler A" icon="factory" color="rose">
                    <Row label="Flow Steam (00:00)" value={fmt(summary.boilerA?.flow)} unit="t/h" />
                    <Row label="Batubara 24h" value={fmt(summary.boilerA?.batubara)} unit="ton" />
                    <Row label="Temp Furnace" value={fmt(summary.boilerA?.tempFurnace)} unit="°C" />
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-slate-400 text-[10px]">Status</span>
                        <StatusBadge value={summary.boilerA?.status ?? null} />
                    </div>
                </ReviewCard>
                <ReviewCard title="Boiler B" icon="factory" color="purple">
                    <Row label="Flow Steam (00:00)" value={fmt(summary.boilerB?.flow)} unit="t/h" />
                    <Row label="Batubara 24h" value={fmt(summary.boilerB?.batubara)} unit="ton" />
                    <Row label="Temp Furnace" value={fmt(summary.boilerB?.tempFurnace)} unit="°C" />
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-slate-400 text-[10px]">Status</span>
                        <StatusBadge value={summary.boilerB?.status ?? null} />
                    </div>
                </ReviewCard>
                <ReviewCard title="Turbin" icon="mode_fan" color="cyan">
                    <Row label="Inlet Flow" value={fmt(summary.turbin?.inletFlow)} unit="t/h" />
                    <Row label="Thrust Bearing" value={fmt(summary.turbin?.thrustBearing)} unit="°C" />
                </ReviewCard>
                <ReviewCard title="Distribusi Steam" icon="water_drop" color="cyan">
                    <Row label="Pabrik 1" value={fmt(summary.steamDist?.pabrik1)} unit="t/h" />
                    <Row label="Pabrik 3" value={fmt(summary.steamDist?.pabrik3)} unit="t/h" />
                </ReviewCard>
                <ReviewCard title="Power" icon="bolt" color="amber">
                    <Row label="STG UBB" value={fmt(summary.power?.stgUbb)} unit="MW" />
                    <Row label="Internal UBB" value={fmt(summary.power?.internalUbb)} unit="MW" />
                    <Row label="Pabrik 2" value={fmt(summary.power?.pabrik2)} unit="MW" />
                    <Row label="Pabrik 3A" value={fmt(summary.power?.pabrik3a)} unit="MW" />
                    <Row label="Pabrik 3B" value={fmt(summary.power?.pabrik3b)} unit="MW" />
                    <Row label="PIU" value={fmt(summary.power?.piu)} unit="MW" />
                    <Row label="PLN" value={fmt(summary.power?.pln)} unit="MW" />
                </ReviewCard>
                <ReviewCard title="Tank & Stock" icon="water" color="emerald">
                    <Row label="RCW" value={fmt(summary.tankLevels?.rcw)} unit="m³" />
                    <Row label="Demin" value={fmt(summary.tankLevels?.demin)} unit="m³" />
                    <Row label="Stock Batubara" value={fmt(summary.stockBatubara)} unit="ton" />
                </ReviewCard>
            </div>

            <ReviewCard title="Catatan Harian" icon="sticky_note_2" color="amber">
                {summary.notes.trim() ? (
                    <pre className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">{summary.notes}</pre>
                ) : (
                    <p className="text-[11px] text-slate-500 italic">Tidak ada catatan.</p>
                )}
            </ReviewCard>

            <ReviewCard title={`Maintenance (${summary.maintenance.length})`} icon="build" color="slate">
                {summary.maintenance.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">Tidak ada item maintenance.</p>
                ) : (
                    <div className="space-y-2.5 divide-y divide-slate-800/55">
                        {summary.maintenance.map((m, i) => (
                            <div key={i} className={`flex flex-col gap-1.5 text-[11px] ${i > 0 ? 'pt-2.5' : ''}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-mono font-extrabold text-slate-400 text-[10px]">{String(i + 1).padStart(2, '0')}.</span>
                                        <span className="font-mono font-black text-cyan-400 text-[11px]">{m.item}</span>
                                        <span className="text-[9px] bg-slate-800/70 text-slate-300 px-2 py-0.5 rounded font-bold uppercase">{humanizeScope(m.scope)}</span>
                                    </div>
                                    <StatusBadge value={m.status} />
                                </div>
                                <div className="text-slate-300 pl-5 leading-normal font-medium">{capFirst(m.uraian)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </ReviewCard>

            {summary.critical.length > 0 && (
                <ReviewCard title={`Critical Equipment (${summary.critical.length})`} icon="warning" color="rose">
                    <div className="space-y-2.5 divide-y divide-slate-800/55">
                        {summary.critical.map((c, i) => (
                            <div key={i} className={`flex flex-col gap-1.5 text-[11px] ${i > 0 ? 'pt-2.5' : ''}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-mono text-[9px] text-slate-300 bg-slate-900 border border-slate-800/80 px-1.5 py-0.5 rounded font-bold">{c.date}</span>
                                        <span className="font-mono font-black text-rose-400 text-[11px]">{c.item}</span>
                                        <span className="text-[9px] bg-slate-800/70 text-slate-300 px-2 py-0.5 rounded font-bold uppercase">{humanizeScope(c.scope)}</span>
                                    </div>
                                </div>
                                <div className="text-slate-300 pl-1 leading-normal font-medium">{capFirst(c.deskripsi)}</div>
                            </div>
                        ))}
                    </div>
                </ReviewCard>
            )}
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
