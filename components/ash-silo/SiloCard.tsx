'use client';

import { useEffect, useState } from 'react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip as RechartsTooltip, ReferenceLine,
} from 'recharts';
import {
    SiloId, SILO_SPEC, SILO_THRESHOLDS, getSiloStatus,
    siloFillHeightPct, siloVolumeM3, siloWeightTon,
} from '@/lib/ash-silo';
import { AshUnloadingEntry, SiloLevelInfo, SiloTrendPoint } from '@/hooks/useAshSiloData';

// Tema aksen per silo — pola sama seperti TANK_COLORS di halaman tank-level.
// A ungu, B cyan supaya kedua kartu langsung terbedakan di layar CCR.
const SILO_COLORS: Record<SiloId, {
    base: string; bgClass: string; textClass: string; icon: string; borderClass: string;
    itemClass: string; iconBoxClass: string; buttonClass: string; modalIconClass: string;
}> = {
    A: {
        base: '#a78bfa', bgClass: 'bg-violet-500', textClass: 'text-violet-400',
        icon: 'inventory_2', borderClass: 'border-violet-500/30',
        itemClass: 'border-l-violet-500 hover:border-violet-500/40 hover:shadow-[0_6px_20px_rgba(167,139,250,0.12)]',
        iconBoxClass: 'bg-violet-500/10 border-violet-500/20 text-violet-400 group-hover:bg-violet-500/20 group-hover:border-violet-500/40',
        buttonClass: 'bg-violet-500/10 hover:bg-violet-500 text-violet-400 border-violet-500/30 hover:border-violet-500',
        modalIconClass: 'bg-violet-500/20 text-violet-400',
    },
    B: {
        base: '#22d3ee', bgClass: 'bg-cyan-500', textClass: 'text-cyan-400',
        icon: 'inventory_2', borderClass: 'border-cyan-500/30',
        itemClass: 'border-l-cyan-500 hover:border-cyan-500/40 hover:shadow-[0_6px_20px_rgba(34,211,238,0.12)]',
        iconBoxClass: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:border-cyan-500/40',
        buttonClass: 'bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 border-cyan-500/30 hover:border-cyan-500',
        modalIconClass: 'bg-cyan-500/20 text-cyan-400',
    },
};

// Siluet silinder + kerucut bawah. Sambungan kerucut di 4,8 m dari 12,69 m
// total → 62,2% dari atas kotak visual.
const CONE_TOP_FROM_TOP_PCT = (1 - SILO_SPEC.coneHeightM / SILO_SPEC.totalHeightM) * 100; // ≈62.2
const SILO_CLIP_PATH = `polygon(0% 0%, 100% 0%, 100% ${CONE_TOP_FROM_TOP_PCT.toFixed(1)}%, 57% 100%, 43% 100%, 0% ${CONE_TOP_FROM_TOP_PCT.toFixed(1)}%)`;

// Penanda skala di posisi TINGGI fisik (bukan % level linear).
const SCALE_MARKS = [100, 40, 20, 0].map(pct => ({
    pct,
    // 100% → 12,69 m; 40% → 4,80 m; 20% → 2,20 m; 0% → 0 m
    topPct: (1 - (pct === 100 ? 12.69 : pct === 40 ? 4.8 : pct === 20 ? 2.2 : 0) / SILO_SPEC.totalHeightM) * 100,
}));

const SHIFT_LABEL: Record<string, string> = { pagi: 'Pagi', sore: 'Sore', malam: 'Malam' };

function formatDateLabel(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('id-ID',
        { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SiloCard({ siloId, level, unloadings, trend, loadTrend, loading }: {
    siloId: SiloId;
    level: SiloLevelInfo | null;
    unloadings: AshUnloadingEntry[];
    trend: SiloTrendPoint[];
    loadTrend: () => void;
    loading: boolean;
}) {
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [isTrendModalOpen, setIsTrendModalOpen] = useState(false);
    const [trendRange, setTrendRange] = useState<'7d' | '30d' | 'all'>('7d');

    // History level di-fetch lazy saat modal trend dibuka (hemat egress).
    useEffect(() => {
        if (isTrendModalOpen) loadTrend();
    }, [isTrendModalOpen, loadTrend]);

    const tc = SILO_COLORS[siloId];
    const pct = level?.pct ?? null;
    const status = pct === null ? 'normal' : getSiloStatus(pct);

    // Semantik alarm TERBALIK dari tangki: level tinggi = perlu unloading.
    const statusObj = status === 'normal'
        ? { label: 'Normal', color: 'bg-emerald-500', text: 'text-emerald-400' }
        : status === 'warning'
            ? { label: 'Perlu Unloading', color: 'bg-amber-500', text: 'text-amber-400' }
            : { label: 'Kritis', color: 'bg-red-500', text: 'text-red-400' };

    const ton = pct === null ? null : siloWeightTon(pct);
    const m3 = pct === null ? null : siloVolumeM3(pct);
    const fillPct = pct === null ? 0 : siloFillHeightPct(pct);
    const totalPages = Math.max(1, Math.ceil(unloadings.length / 5));

    const renderUnloadingItem = (entry: AshUnloadingEntry, idx: number) => {
        const lbl = `${formatDateLabel(entry.date)} • Shift ${SHIFT_LABEL[entry.shift] ?? entry.shift}`;
        return (
            <div key={entry.id ?? idx}
                className={`flex items-center justify-between px-5 py-4 xl:px-6 xl:py-5 rounded-xl xl:rounded-2xl bg-surface-highlight/30 border border-slate-800 border-l-4 ${tc.itemClass} hover:bg-surface-highlight/85 hover:-translate-y-[2px] hover:translate-x-[4px] hover:z-10 transition-all duration-300 group relative overflow-hidden cursor-default shadow-sm`}>
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`w-12 h-12 rounded-lg ${tc.iconBoxClass} flex items-center justify-center border shrink-0 shadow-inner group-hover:scale-110 transition-all duration-300`}>
                        <span className="material-symbols-outlined text-[26px]">local_shipping</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm text-slate-300 font-bold uppercase tracking-wider leading-none mb-1.5">{lbl}</span>
                        <span className="text-lg xl:text-xl font-black text-white leading-snug break-words drop-shadow-md">
                            <span className={`font-mono ${tc.textClass}`}>{entry.ritase.toLocaleString('id-ID')} Rit</span>
                            <span className="text-slate-300 font-bold"> Tujuan : </span>
                            {entry.tujuan || '—'}
                            <span className="text-slate-300 font-bold"> Truck : </span>
                            {entry.perusahaan || '—'}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`bg-surface-dark border ${tc.borderClass} rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300 lg:h-full relative`}
            style={{ boxShadow: `0 0 40px ${tc.base}15` }}>

            {/* ── Card Header ── */}
            <div className="flex-shrink-0 px-4 lg:px-6 py-3 lg:py-4 border-b border-slate-800 flex items-center justify-between"
                style={{ background: `linear-gradient(to right, ${tc.base}22, transparent 60%)` }}>
                <div className="flex items-center gap-3 lg:gap-4">
                    <div className={`p-2 lg:p-3 ${tc.bgClass} rounded-xl`}
                        style={{ boxShadow: `0 0 20px ${tc.base}80` }}>
                        <span className="material-symbols-outlined text-white text-xl lg:text-3xl">{tc.icon}</span>
                    </div>
                    <div>
                        <h3 className="text-white font-black text-xl lg:text-3xl uppercase tracking-tight leading-none">Ash Silo {siloId}</h3>
                        <p className="text-slate-400 text-xs lg:text-sm font-semibold mt-0.5">Kapasitas {SILO_SPEC.totalM3.toLocaleString('id-ID')} m³ • {SILO_SPEC.totalTon.toLocaleString('id-ID')} ton</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 lg:gap-3">
                    <button onClick={() => setIsTrendModalOpen(true)}
                        className={`${tc.buttonClass} hover:text-white border p-2 lg:px-4 lg:py-2 rounded-full text-[10px] lg:text-[11px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer group`}>
                        <span className="material-symbols-outlined text-[16px] lg:text-[14px]">timeline</span>
                        <span className="hidden lg:inline">Trend</span>
                    </button>
                    <button onClick={() => { setHistoryPage(1); setIsHistoryModalOpen(true); }}
                        className={`${tc.buttonClass} hover:text-white border p-2 lg:px-4 lg:py-2 rounded-full text-[10px] lg:text-[11px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer group`}>
                        <span className="material-symbols-outlined text-[16px] lg:text-[14px]">history</span>
                        <span className="hidden lg:inline">History</span>
                    </button>
                    <div className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full border ${
                        status === 'normal' ? 'bg-emerald-500/10 border-emerald-500/30' :
                        status === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                        'bg-red-500/10 border-red-500/30'}`}>
                        <span className="relative flex h-2.5 w-2.5 lg:h-3 lg:w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusObj.color} opacity-60`}></span>
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 lg:h-3 lg:w-3 ${statusObj.color}`}></span>
                        </span>
                        <span className={`${statusObj.text} text-xs lg:text-sm font-black uppercase tracking-widest whitespace-nowrap`}>{statusObj.label}</span>
                    </div>
                </div>
            </div>

            {/* ── Main Body ── */}
            <div className="flex-1 flex gap-0 lg:min-h-0 lg:overflow-hidden">

                {/* Silo visual column — desktop only */}
                <div className="hidden lg:flex flex-shrink-0 w-72 xl:w-80 flex-col items-center justify-between py-6 px-6 border-r border-slate-800/60"
                    style={{ background: `linear-gradient(to bottom, ${tc.base}08, transparent)` }}>
                    <div className="w-full flex-1 relative min-h-[380px]">
                        {/* badan silo ter-clip bentuk silinder+kerucut.
                            position absolute via inline style — .glass-tank
                            (unlayered CSS) menimpa utility `absolute` Tailwind. */}
                        <div className="glass-tank bg-slate-800/60"
                            style={{ position: 'absolute', inset: 0, clipPath: SILO_CLIP_PATH, borderRadius: '18px 18px 0 0' }}>
                            <div className="liquid backdrop-blur-md"
                                style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                                    height: `${Math.min(Math.max(fillPct, 0), 100)}%`,
                                    backgroundColor: `${tc.base}CC`,
                                    boxShadow: `0 -10px 40px ${tc.base}50` }}>
                                <div className="liquid-surface" style={{ backgroundColor: tc.base, filter: 'brightness(1.5)', height: '15px', top: '-7.5px' }} />
                            </div>
                        </div>
                        {/* penanda skala di posisi tinggi fisik */}
                        <div className="absolute inset-0 z-20 pointer-events-none">
                            {SCALE_MARKS.map(mark => (
                                <div key={mark.pct}
                                    className="absolute left-0 right-0 border-t border-white/10 text-xs xl:text-sm text-right text-slate-500 pr-2 font-bold uppercase tracking-widest"
                                    style={{ top: `${mark.topPct}%` }}>
                                    {mark.pct}%
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* tonase di bawah silo — tukar posisi dengan % yang pindah ke hero */}
                    <div className="mt-6 flex flex-col items-center">
                        <span className="text-xs text-slate-500 uppercase tracking-[0.2em] font-black mb-1.5">Estimasi Isi</span>
                        <div className="flex items-baseline gap-1.5">
                            <p className="text-4xl xl:text-5xl font-black font-mono leading-none tracking-tighter text-white"
                                style={{ textShadow: `0 0 40px ${tc.base}80, 0 0 80px ${tc.base}30` }}>
                                {ton === null ? '—' : ton.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                            </p>
                            {ton !== null && <span className={`text-lg xl:text-xl font-black ${tc.textClass}`}>ton</span>}
                        </div>
                    </div>
                </div>

                {/* Stats column */}
                <div className="flex-1 flex flex-col justify-between p-4 lg:p-6 gap-3 lg:gap-4 lg:overflow-hidden min-w-0">

                    {/* Berat fly ash — hero number */}
                    <div>
                        <p className="text-xs lg:text-sm text-slate-500 uppercase tracking-[0.2em] font-black mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">percent</span>
                            Level Fly Ash
                        </p>
                        {pct === null ? (
                            <div>
                                <span className="font-black text-slate-500 leading-none tracking-tighter" style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)' }}>—</span>
                                <p className="text-xs lg:text-sm text-slate-500 font-bold mt-2 italic">
                                    {loading ? 'Memuat data…' : 'Belum ada input level silo dari laporan shift'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-x-3 xl:gap-x-4 flex-wrap min-w-0">
                                    <div className="flex items-baseline gap-x-1.5 min-w-0">
                                        <span className="font-black text-white leading-none tracking-tighter"
                                            style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)',
                                                textShadow: `0 0 40px ${tc.base}80, 0 0 80px ${tc.base}30` }}>
                                            {pct.toFixed(1)}
                                        </span>
                                        <span className={`font-black ${tc.textClass} tracking-tighter shrink-0`} style={{ fontSize: 'clamp(1rem, 2vw, 2rem)' }}>%</span>
                                    </div>
                                    {/* tonase on mobile (no silo visual) */}
                                    <div className="lg:hidden ml-auto flex items-baseline gap-1 shrink-0">
                                        <span className="text-2xl font-black font-mono text-white"
                                            style={{ textShadow: `0 0 20px ${tc.base}80` }}>{ton!.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</span>
                                        <span className={`text-xs font-black ${tc.textClass}`}>ton</span>
                                    </div>
                                </div>
                                <div className="mt-3 bg-slate-800/50 border border-slate-700/60 px-3 py-2 rounded-xl w-full overflow-hidden">
                                    <div className="text-xs xl:text-base text-slate-400 font-bold flex items-center gap-1.5 flex-wrap">
                                        <span className="material-symbols-outlined text-sm shrink-0">deployed_code</span>
                                        <span className="shrink-0">Volume:</span>
                                        <span className="text-white font-black text-base xl:text-xl break-all">{m3!.toLocaleString('id-ID', { maximumFractionDigits: 1 })} m³</span>
                                    </div>
                                </div>
                                {/* Progress bar — mobile */}
                                <div className="mt-4 lg:hidden h-3 rounded-full bg-slate-700/70 overflow-hidden shadow-inner">
                                    <div className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${Math.min(fillPct, 100)}%`, backgroundColor: tc.base,
                                            boxShadow: `0 0 15px ${tc.base}` }} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Unloading Fly Ash */}
                    <div className="flex flex-col gap-3 lg:gap-3 mt-2 xl:mt-3 pt-3 border-t border-slate-800/60 flex-1 lg:min-h-0">
                        <p className="text-xs xl:text-sm text-slate-500 uppercase font-black tracking-[0.15em] flex items-center gap-2">
                            <span className="material-symbols-outlined text-base xl:text-lg">local_shipping</span> Unloading Fly Ash
                        </p>
                        <div className={`${unloadings.length > 0 ? 'flex flex-col gap-2.5 xl:gap-3 mt-1.5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto custom-scrollbar pr-1' : 'mt-1.5'}`}>
                            {unloadings.slice(0, 5).map((entry, idx) => renderUnloadingItem(entry, idx))}
                        </div>
                        {unloadings.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-surface-highlight/10 border border-slate-800/40 text-center mt-1.5">
                                <span className="material-symbols-outlined text-slate-600 text-2xl mb-1 opacity-30">local_shipping</span>
                                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider italic">Belum ada riwayat unloading fly ash</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal History Unloading */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8 bg-slate-950/80 backdrop-blur-md"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <div className="bg-surface-dark border border-slate-700/60 rounded-[28px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
                        style={{ boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${tc.base}1A` }}>
                        {/* Header Modal */}
                        <div className="flex items-center justify-between px-6 py-5 2xl:px-8 2xl:py-6 border-b border-slate-800"
                            style={{ background: `linear-gradient(to right, ${tc.base}22, transparent 70%)` }}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${tc.modalIconClass} flex items-center justify-center`}
                                    style={{ boxShadow: `0 0 20px ${tc.base}33` }}>
                                    <span className="material-symbols-outlined text-2xl 2xl:text-3xl">history</span>
                                </div>
                                <div>
                                    <h3 className="text-xl 2xl:text-2xl font-black text-white leading-tight">History Unloading Silo {siloId}</h3>
                                    <p className="text-[11px] 2xl:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Fly Ash Tracking</p>
                                </div>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)}
                                className="text-slate-400 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/30 transition-all cursor-pointer bg-slate-800/80 border border-slate-700 w-10 h-10 2xl:w-12 2xl:h-12 rounded-xl flex items-center justify-center">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* List Content */}
                        <div className="p-6 2xl:p-8 overflow-y-auto flex-1 flex flex-col justify-between gap-4 custom-scrollbar bg-slate-900/50">
                            <div className="flex flex-col gap-3">
                                {unloadings.length > 0
                                    ? unloadings.slice((historyPage - 1) * 5, historyPage * 5).map((entry, idx) => renderUnloadingItem(entry, idx))
                                    : <div className="py-12 flex flex-col items-center justify-center text-slate-500"><span className="material-symbols-outlined text-4xl mb-3 opacity-30">inbox</span><p className="font-bold tracking-wide">Belum ada riwayat unloading fly ash</p></div>
                                }
                            </div>

                            {/* Pagination Controls */}
                            {unloadings.length > 5 && (
                                <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-800/60 font-mono">
                                    <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white rounded-xl transition-colors cursor-pointer border border-slate-700">
                                        <span className="material-symbols-outlined text-[16px]">chevron_left</span> Back
                                    </button>
                                    <span className="text-xs font-bold text-slate-400">Page {historyPage} / {totalPages}</span>
                                    <button onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))} disabled={historyPage === totalPages}
                                        className={`flex items-center gap-1.5 px-4 py-2 ${tc.buttonClass} disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold hover:text-white border rounded-xl transition-colors cursor-pointer`}>
                                        Next <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Trend Level (%) — pola sama seperti trend tank */}
            {isTrendModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8 bg-slate-950/80 backdrop-blur-md"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <div className="bg-surface-dark border border-slate-700/60 rounded-[28px] shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden"
                        style={{ boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${tc.base}1A` }}>
                        <div className="flex items-center justify-between px-6 py-5 2xl:px-8 2xl:py-6 border-b border-slate-800"
                            style={{ background: `linear-gradient(to right, ${tc.base}22, transparent 70%)` }}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${tc.modalIconClass} flex items-center justify-center`}
                                    style={{ boxShadow: `0 0 20px ${tc.base}33` }}>
                                    <span className="material-symbols-outlined text-2xl 2xl:text-3xl">timeline</span>
                                </div>
                                <div>
                                    <h3 className="text-xl 2xl:text-2xl font-black text-white leading-tight">Trend Level Silo {siloId}</h3>
                                    <p className="text-[11px] 2xl:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Level Fly Ash (%)</p>
                                </div>
                            </div>
                            <button onClick={() => setIsTrendModalOpen(false)}
                                className="text-slate-400 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/30 transition-all cursor-pointer bg-slate-800/80 border border-slate-700 w-10 h-10 2xl:w-12 2xl:h-12 rounded-xl flex items-center justify-center">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 2xl:p-8 overflow-y-auto flex-1 flex flex-col gap-3 bg-slate-900/50">
                            {/* Range filter chips */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {([
                                    { key: '7d',  label: '7 Hari' },
                                    { key: '30d', label: '30 Hari' },
                                    { key: 'all', label: 'Semua' },
                                ] as const).map(opt => (
                                    <button key={opt.key}
                                        onClick={() => setTrendRange(opt.key)}
                                        style={trendRange === opt.key ? { backgroundColor: tc.base, boxShadow: `0 0 15px ${tc.base}66` } : undefined}
                                        className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all cursor-pointer border ${
                                            trendRange === opt.key
                                                ? 'text-white border-transparent'
                                                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                                        }`}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {(() => {
                                const nowMs = Date.now();
                                const rangeMs: Record<typeof trendRange, number | null> = {
                                    '7d': 7 * 24 * 60 * 60 * 1000,
                                    '30d': 30 * 24 * 60 * 60 * 1000,
                                    'all': null,
                                };
                                const cutoff = rangeMs[trendRange];
                                const filtered = cutoff == null ? trend : trend.filter(d => nowMs - d.ts <= cutoff);

                                const fmtTick = (ts: number) => {
                                    const d = new Date(ts);
                                    if (trendRange === '7d') {
                                        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' ' +
                                               d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
                                    }
                                    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: trendRange === 'all' ? '2-digit' : undefined });
                                };

                                return (
                                    <>
                                        <div className="text-xs text-slate-500 font-bold mt-1">
                                            {filtered.length} titik data{filtered.length === 0 ? ' — tidak ada data pada rentang ini' : ''}
                                        </div>
                                        <div className="h-[360px] 2xl:h-[460px] w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={filtered} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                                    <defs>
                                                        <linearGradient id={`colorSiloTrend-${siloId}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor={tc.base} stopOpacity={0.4} />
                                                            <stop offset="95%" stopColor={tc.base} stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                                    <XAxis dataKey="ts" type="number" scale="time"
                                                        domain={['dataMin', 'dataMax']}
                                                        stroke="#94a3b8"
                                                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}
                                                        tickLine={false} axisLine={{ stroke: '#334155' }} dy={10}
                                                        tickFormatter={fmtTick} interval="preserveStartEnd" minTickGap={50} />
                                                    <YAxis stroke="#94a3b8"
                                                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}
                                                        tickLine={false} axisLine={{ stroke: '#334155' }} dx={-10}
                                                        domain={[0, 100]}
                                                        tickFormatter={v => `${v}%`} />
                                                    <RechartsTooltip content={({ active, payload }) => {
                                                        if (!active || !payload?.length) return null;
                                                        const p = payload[0].payload as SiloTrendPoint;
                                                        return (
                                                            <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 shadow-xl">
                                                                <p className="text-[11px] text-slate-400 font-bold">
                                                                    {new Date(p.ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                </p>
                                                                <p className="text-base font-black font-mono" style={{ color: tc.base }}>{p.pct.toFixed(1)}%</p>
                                                            </div>
                                                        );
                                                    }} />
                                                    {/* Ambang alarm: level TINGGI = perlu unloading */}
                                                    <ReferenceLine y={SILO_THRESHOLDS.warning_high} stroke="#f59e0b" strokeDasharray="6 4"
                                                        label={{ value: `Perlu Unloading ${SILO_THRESHOLDS.warning_high}%`, fill: '#f59e0b', fontSize: 11, fontWeight: 'bold', position: 'insideBottomRight' }} />
                                                    <ReferenceLine y={SILO_THRESHOLDS.critical_high} stroke="#ef4444" strokeDasharray="6 4"
                                                        label={{ value: `Kritis ${SILO_THRESHOLDS.critical_high}%`, fill: '#ef4444', fontSize: 11, fontWeight: 'bold', position: 'insideTopRight' }} />
                                                    <Area type="monotone" dataKey="pct"
                                                        stroke={tc.base} strokeWidth={3}
                                                        fill={`url(#colorSiloTrend-${siloId})`}
                                                        dot={filtered.length <= 60 ? { r: 4, fill: '#0f172a', stroke: tc.base, strokeWidth: 2 } : false}
                                                        activeDot={{ r: 7, fill: tc.base, stroke: '#fff', strokeWidth: 2 }} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
