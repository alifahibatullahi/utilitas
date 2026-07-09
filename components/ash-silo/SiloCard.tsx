'use client';

import { useState } from 'react';
import {
    SiloId, SILO_SPEC, getSiloStatus,
    siloFillHeightPct, siloVolumeM3, siloWeightTon,
} from '@/lib/ash-silo';
import { AshUnloadingEntry, SiloLevelInfo } from '@/hooks/useAshSiloData';

// Tema aksen ash silo — pola sama seperti TANK_COLORS di halaman tank-level.
const SILO_COLOR = {
    base: '#a78bfa', bgClass: 'bg-violet-500', textClass: 'text-violet-400',
    icon: 'inventory_2', borderClass: 'border-violet-500/30',
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

function formatDateLabel(dateStr: string, compact: boolean) {
    return new Date(dateStr).toLocaleDateString('id-ID', compact
        ? { day: '2-digit', month: 'short' }
        : { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SiloCard({ siloId, level, unloadings, loading, compact = false }: {
    siloId: SiloId;
    level: SiloLevelInfo | null;
    unloadings: AshUnloadingEntry[];
    loading: boolean;
    compact?: boolean;
}) {
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);

    const tc = SILO_COLOR;
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
        const lbl = `${formatDateLabel(entry.date, false)} • Shift ${SHIFT_LABEL[entry.shift] ?? entry.shift}`;
        return (
            <div key={entry.id ?? idx}
                className="flex items-center justify-between px-4 py-3 xl:px-5 xl:py-3.5 rounded-xl xl:rounded-2xl bg-surface-highlight/30 border border-slate-800 border-l-4 border-l-violet-500 hover:border-violet-500/40 hover:bg-surface-highlight/85 hover:-translate-y-[2px] hover:translate-x-[4px] hover:shadow-[0_6px_20px_rgba(167,139,250,0.12)] hover:z-10 transition-all duration-300 group relative overflow-hidden cursor-default shadow-sm">
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20 text-violet-400 shrink-0 shadow-inner group-hover:scale-110 group-hover:bg-violet-500/20 group-hover:border-violet-500/40 transition-all duration-300">
                        <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-1">{lbl}</span>
                        <span className="text-sm xl:text-base font-black text-white truncate leading-tight drop-shadow-md" title={`${entry.perusahaan} → ${entry.tujuan}`}>
                            {entry.perusahaan}{entry.tujuan ? ` → ${entry.tujuan}` : ''}
                        </span>
                    </div>
                </div>
                <div className="flex items-baseline gap-1 whitespace-nowrap z-10">
                    <span className="text-lg xl:text-xl font-black font-mono tracking-tighter leading-none text-violet-400">
                        {entry.ritase.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10px] xl:text-xs text-slate-500 font-bold">rit</span>
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
                    <button onClick={() => { setHistoryPage(1); setIsHistoryModalOpen(true); }}
                        className="bg-violet-500/10 hover:bg-violet-500 text-violet-400 hover:text-white border border-violet-500/30 hover:border-violet-500 p-2 lg:px-4 lg:py-2 rounded-full text-[10px] lg:text-[11px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer group">
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
                <div className="hidden lg:flex flex-shrink-0 w-48 xl:w-56 flex-col items-center justify-between py-6 px-6 border-r border-slate-800/60"
                    style={{ background: `linear-gradient(to bottom, ${tc.base}08, transparent)` }}>
                    <div className="w-full xl:w-3/4 flex-1 relative min-h-[300px]">
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
                    {/* % label below silo */}
                    <div className="mt-6 flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mb-1">Level</span>
                        <div className="flex items-center gap-2">
                            <p className="text-4xl xl:text-5xl font-black font-mono leading-none tracking-tighter" style={{ color: tc.base, textShadow: `0 0 20px ${tc.base}40` }}>
                                {pct === null ? '—' : `${pct.toFixed(1)}%`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats column */}
                <div className="flex-1 flex flex-col justify-between p-4 lg:p-6 gap-3 lg:gap-4 lg:overflow-hidden min-w-0">

                    {/* Berat fly ash — hero number */}
                    <div>
                        <p className="text-xs lg:text-sm text-slate-500 uppercase tracking-[0.2em] font-black mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">scale</span>
                            Estimasi Isi Fly Ash
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
                                            {ton!.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                                        </span>
                                        <span className={`font-black ${tc.textClass} tracking-tighter shrink-0`} style={{ fontSize: 'clamp(1rem, 2vw, 2rem)' }}>ton</span>
                                    </div>
                                    {/* % on mobile (no silo visual) */}
                                    <div className="lg:hidden ml-auto flex items-center gap-1 shrink-0">
                                        <span className="text-lg font-black font-mono" style={{ color: tc.base }}>{pct.toFixed(1)}%</span>
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
                                {/* Asal data level */}
                                <div className="flex items-center gap-2 text-xs xl:text-sm text-slate-400 font-semibold mt-3">
                                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                                    Data level:{' '}
                                    <span className={`font-black ${tc.textClass}`}>
                                        {formatDateLabel(level!.reportDate, compact)} • Shift {SHIFT_LABEL[level!.reportShift]}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Unloading Fly Ash */}
                    <div className="flex flex-col gap-3 lg:gap-3 mt-2 xl:mt-3 pt-3 border-t border-slate-800/60 flex-1">
                        <p className="text-[11px] xl:text-xs text-slate-500 uppercase font-black tracking-[0.15em] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px] xl:text-base">local_shipping</span> Unloading Fly Ash
                        </p>
                        <div className={`${unloadings.length > 0 ? 'flex flex-col gap-2.5 xl:gap-3 mt-1.5' : 'mt-1.5'}`}>
                            {unloadings.slice(0, 3).map((entry, idx) => renderUnloadingItem(entry, idx))}
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
                        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(167, 139, 250, 0.1)' }}>
                        {/* Header Modal */}
                        <div className="flex items-center justify-between px-6 py-5 2xl:px-8 2xl:py-6 border-b border-slate-800"
                            style={{ background: `linear-gradient(to right, ${tc.base}22, transparent 70%)` }}>
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-violet-500/20 shadow-[0_0_20px_rgba(167,139,250,0.2)] flex items-center justify-center">
                                    <span className="text-violet-400 material-symbols-outlined text-2xl 2xl:text-3xl">history</span>
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
                                        className="flex items-center gap-1.5 px-4 py-2 bg-violet-500/10 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-violet-400 hover:text-white border border-violet-500/30 hover:border-violet-500 rounded-xl transition-colors cursor-pointer">
                                        Next <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
