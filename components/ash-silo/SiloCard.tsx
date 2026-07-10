'use client';

import { useState } from 'react';
import {
    SiloId, SILO_SPEC, getSiloStatus,
    siloFillHeightPct, siloVolumeM3, siloWeightTon,
} from '@/lib/ash-silo';
import { AshUnloadingEntry, SiloLevelInfo } from '@/hooks/useAshSiloData';

// Color themes matching the rest of the application
const SILO_COLOR = {
    base: '#a78bfa',
    bgClass: 'bg-violet-500',
    textClass: 'text-violet-400',
    icon: 'inventory_2',
    borderClass: 'border-violet-500/30',
};

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

    const statusObj = status === 'normal'
        ? { label: 'Normal', color: 'bg-emerald-500', text: 'text-emerald-400', textLight: 'text-emerald-300' }
        : status === 'warning'
            ? { label: 'Perlu Unloading', color: 'bg-amber-500', text: 'text-amber-400', textLight: 'text-amber-300' }
            : { label: 'Kritis', color: 'bg-red-500', text: 'text-red-400', textLight: 'text-red-300' };

    const ton = pct === null ? null : siloWeightTon(pct);
    const m3 = pct === null ? null : siloVolumeM3(pct);
    const fillPct = pct === null ? 0 : siloFillHeightPct(pct);
    
    // Remaining capacity calculations
    const sisaTon = ton === null ? null : Math.max(0, SILO_SPEC.totalTon - ton);
    const sisaM3 = m3 === null ? null : Math.max(0, SILO_SPEC.totalM3 - m3);

    const totalPages = Math.max(1, Math.ceil(unloadings.length / 5));

    // Helper to generate fly ash pile peaked curve/path inside the SVG
    const getAshFillPath = (pctValue: number) => {
        if (pctValue <= 0) return '';
        const totalVisualHeight = 268; // 290 - 22
        const hPx = (pctValue / 100) * totalVisualHeight;
        const yCenter = Math.max(22, 290 - hPx);
        // The peak offset (ash pile angle of repose)
        const peakOffset = pctValue > 10 ? 10 : 2; // smaller peak if nearly empty
        const ySides = Math.min(290, yCenter + peakOffset);
        
        const getXLeft = (y: number) => {
            if (y <= 200) return 20;
            return 20 + ((y - 200) / 90) * 52;
        };
        const getXRight = (y: number) => {
            if (y <= 200) return 140;
            return 140 - ((y - 200) / 90) * 52;
        };

        const xl = getXLeft(ySides);
        const xr = getXRight(ySides);

        let path = `M 80 ${yCenter}`;
        path += ` L ${xr} ${ySides}`;
        
        if (ySides <= 200) {
            path += ` L 140 200`;
        }
        path += ` L 88 290`;
        path += ` L 72 290`;
        if (ySides <= 200) {
            path += ` L 20 200`;
        }
        path += ` L ${xl} ${ySides}`;
        path += ` Z`;
        return path;
    };

    // Calculate boundary coordinates for scanner line
    const totalVisualHeight = 268;
    const hPx = (fillPct / 100) * totalVisualHeight;
    const yCenter = Math.max(22, 290 - hPx);
    const peakOffset = fillPct > 10 ? 10 : 2;
    const ySides = Math.min(290, yCenter + peakOffset);
    
    const getXLeft = (y: number) => {
        if (y <= 200) return 20;
        return 20 + ((y - 200) / 90) * 52;
    };
    const getXRight = (y: number) => {
        if (y <= 200) return 140;
        return 140 - ((y - 200) / 90) * 52;
    };

    const scannerXLeft = getXLeft(ySides);
    const scannerXRight = getXRight(ySides);

    // Modal aggregates
    const totalRit = unloadings.reduce((sum, u) => sum + u.ritase, 0);
    const totalTrips = unloadings.length;
    const contractorCount = Array.from(new Set(unloadings.map(u => u.perusahaan))).length;
    const displayTotalRit = unloadings.slice(0, 3).reduce((acc, u) => acc + u.ritase, 0);

    const renderUnloadingItem = (entry: AshUnloadingEntry, idx: number) => {
        const lbl = `${formatDateLabel(entry.date, false)} • Shift ${SHIFT_LABEL[entry.shift] ?? entry.shift}`;
        return (
            <div key={entry.id ?? idx}
                className="flex items-center justify-between px-4 py-3 xl:px-5 xl:py-3.5 rounded-xl xl:rounded-2xl bg-slate-900/40 border border-slate-800 border-l-4 border-l-violet-500 hover:border-violet-500/40 hover:bg-slate-900/70 hover:-translate-y-[2px] hover:translate-x-[4px] hover:shadow-[0_6px_20px_rgba(167,139,250,0.12)] hover:z-10 transition-all duration-300 group relative overflow-hidden cursor-default shadow-sm">
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20 text-violet-400 shrink-0 shadow-inner group-hover:scale-110 group-hover:bg-violet-500/20 group-hover:border-violet-500/40 transition-all duration-300">
                        <span className="material-symbols-outlined text-[18px] transition-transform duration-300 group-hover:translate-x-1">local_shipping</span>
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

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes laserPulse {
                    0%, 100% { opacity: 0.9; filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.9)); }
                    50% { opacity: 0.4; filter: drop-shadow(0 0 2px rgba(167, 139, 250, 0.4)); }
                }
                @keyframes scanBeam {
                    0%, 100% { opacity: 0.2; }
                    50% { opacity: 0.6; }
                }
                @keyframes dustFloat {
                    0% { transform: translateY(0px) rotate(0deg); opacity: 0.2; }
                    50% { transform: translateY(-3px) rotate(180deg); opacity: 0.4; }
                    100% { transform: translateY(-6px) rotate(360deg); opacity: 0; }
                }
            `}} />

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
                <div className="hidden lg:flex flex-shrink-0 w-48 xl:w-56 flex-col items-center justify-between py-6 px-4 border-r border-slate-800/60 relative"
                    style={{ background: `linear-gradient(to bottom, ${tc.base}08, transparent)` }}>
                    
                    {/* SVG Silo Visualizer */}
                    <div className="w-full flex-1 relative min-h-[300px] flex items-center justify-center">
                        <svg viewBox="0 0 160 320" width="100%" height="100%" className="drop-shadow-[0_0_20px_rgba(167,139,250,0.15)] overflow-visible">
                            <defs>
                                <filter id="glow-violet-silo" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="3" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                                <linearGradient id="ash-gradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.85" />
                                    <stop offset="100%" stopColor="#5b21b6" stopOpacity="0.95" />
                                </linearGradient>
                                <pattern id="ash-texture" width="8" height="8" patternUnits="userSpaceOnUse">
                                    <circle cx="2" cy="2" r="0.8" fill="#ffffff" opacity="0.2" />
                                    <circle cx="6" cy="5" r="0.5" fill="#ffffff" opacity="0.15" />
                                </pattern>
                                <linearGradient id="glass-gradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="rgba(255, 255, 255, 0.08)" />
                                    <stop offset="30%" stopColor="rgba(255, 255, 255, 0.03)" />
                                    <stop offset="70%" stopColor="rgba(255, 255, 255, 0.01)" />
                                    <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
                                </linearGradient>
                            </defs>

                            {/* Bracing & Support legs */}
                            <line x1="20" y1="200" x2="20" y2="310" stroke="rgba(255,255,255,0.15)" strokeWidth="3" strokeLinecap="round" />
                            <line x1="140" y1="200" x2="140" y2="310" stroke="rgba(255,255,255,0.15)" strokeWidth="3" strokeLinecap="round" />
                            
                            {/* Steel trusses cross bracing */}
                            <line x1="20" y1="215" x2="140" y2="245" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                            <line x1="140" y1="215" x2="20" y2="245" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                            <line x1="20" y1="255" x2="140" y2="285" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                            <line x1="140" y1="255" x2="20" y2="285" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />

                            {/* Outlet pipe at bottom of cone */}
                            <path d="M 70 290 L 90 290 L 90 300 L 70 300 Z" fill="#334155" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                            <line x1="75" y1="300" x2="75" y2="310" stroke="#475569" strokeWidth="2.5" />
                            <line x1="85" y1="300" x2="85" y2="310" stroke="#475569" strokeWidth="2.5" />

                            {/* Background Silo Interior */}
                            <path d="M 20 22 L 140 22 L 140 200 L 88 290 L 72 290 L 20 200 Z" fill="rgba(15, 23, 42, 0.5)" />

                            {/* Grid markers inside background */}
                            {[80, 60, 40, 20].map(p => {
                                const y = 290 - (p / 100) * 268;
                                return (
                                    <line key={p} x1="20" y1={y} x2="140" y2={y} stroke="rgba(255,255,255,0.03)" strokeDasharray="3,3" />
                                );
                            })}

                            {/* Dynamic Ash Fill Path */}
                            {pct !== null && fillPct > 0 && (
                                <>
                                    {/* Primary solid gradient fill */}
                                    <path d={getAshFillPath(fillPct)} fill="url(#ash-gradient)" />
                                    {/* Overlaid granular powder texture */}
                                    <path d={getAshFillPath(fillPct)} fill="url(#ash-texture)" />
                                </>
                            )}

                            {/* Outer Silo Glass Shell */}
                            <path d="M 20 22 L 140 22 L 140 200 L 88 290 L 72 290 L 20 200 Z" fill="url(#glass-gradient)" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" strokeLinecap="round" />

                            {/* Top Inlet Valve flange */}
                            <path d="M 68 15 L 92 15 L 90 22 L 70 22 Z" fill="#475569" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

                            {/* Scale indicators */}
                            {[100, 80, 60, 40, 20, 0].map(p => {
                                const y = 290 - (p / 100) * 268;
                                return (
                                    <g key={p}>
                                        <line x1="14" y1={y} x2="20" y2={y} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                                        <text x="8" y={y + 3} textAnchor="end" fill="#64748b" fontSize="8" fontWeight="800" fontFamily="monospace" letterSpacing="-0.5">{p}%</text>
                                    </g>
                                );
                            })}

                            {/* Telemetry/Radar level scan effects */}
                            {pct !== null && (
                                <>
                                    {/* Blinking radar emitter at top */}
                                    <circle cx="80" cy="22" r="3" fill="#10b981" />
                                    <circle cx="80" cy="22" r="6" fill="#10b981" opacity="0.4" className="animate-ping" style={{ transformOrigin: '80px 22px' }} />
                                    
                                    {/* Laser ranging dotted line */}
                                    <line x1="80" y1="22" x2="80" y2={yCenter} stroke="#10b981" strokeWidth="1.2" strokeDasharray="3,4" opacity="0.6" style={{ animation: 'beamPulse 2s infinite ease-in-out' }} />
                                    
                                    {/* Ranging laser landing point */}
                                    <circle cx="80" cy={yCenter} r="2.5" fill="#a78bfa" filter="url(#glow-violet-silo)" />

                                    {/* Pulsing Lidar Scanning line along surface */}
                                    <line x1={scannerXLeft - 2} y1={ySides} x2={scannerXRight + 2} y2={ySides} 
                                        stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round"
                                        style={{ animation: 'laserPulse 2s infinite ease-in-out' }} />
                                </>
                            )}
                        </svg>
                    </div>

                    {/* % label below silo */}
                    <div className="mt-4 flex flex-col items-center">
                        <span className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-black mb-0.5">Telemetry Level</span>
                        <p className="text-4xl font-black font-mono leading-none tracking-tighter" style={{ color: tc.base, textShadow: `0 0 20px ${tc.base}40` }}>
                            {pct === null ? '—' : `${pct.toFixed(1)}%`}
                        </p>
                    </div>
                </div>

                {/* Stats column */}
                <div className="flex-1 flex flex-col justify-between p-4 lg:p-6 gap-3 lg:gap-4 lg:overflow-hidden min-w-0">

                    {/* Telemetry Metric Cards */}
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-[0.2em] font-black mb-3.5 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">analytics</span>
                            Ash Silo Telemetry
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            
                            {/* Card 1: Level Percentage */}
                            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 xl:p-4 flex flex-col justify-between relative overflow-hidden group hover:border-violet-500/30 transition-all duration-300 shadow-sm">
                                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="flex items-center justify-between text-slate-500 mb-2.5">
                                    <span className="text-[10px] xl:text-[11px] font-black uppercase tracking-wider">Level</span>
                                    <span className="material-symbols-outlined text-xs xl:text-sm">percent</span>
                                </div>
                                <div className="z-10">
                                    <p className="text-2xl xl:text-3xl font-black font-mono text-white leading-tight">
                                        {pct === null ? '—' : `${pct.toFixed(1)}%`}
                                    </p>
                                    <span className={`text-[10px] xl:text-xs font-bold uppercase tracking-wider block mt-1 ${statusObj.text}`}>
                                        {statusObj.label}
                                    </span>
                                </div>
                            </div>

                            {/* Card 2: Current Content (Ton) */}
                            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 xl:p-4 flex flex-col justify-between relative overflow-hidden group hover:border-violet-500/30 transition-all duration-300 shadow-sm">
                                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="flex items-center justify-between text-slate-500 mb-2.5">
                                    <span className="text-[10px] xl:text-[11px] font-black uppercase tracking-wider">Estimasi Isi</span>
                                    <span className="material-symbols-outlined text-xs xl:text-sm">scale</span>
                                </div>
                                <div className="z-10">
                                    <p className="text-2xl xl:text-3xl font-black font-mono text-white leading-none tracking-tight">
                                        {ton === null ? '—' : `${ton.toLocaleString('id-ID', { maximumFractionDigits: 1 })}`}
                                        {ton !== null && <span className="text-xs xl:text-sm font-bold text-slate-500 ml-1">ton</span>}
                                    </p>
                                    <span className="text-[10px] xl:text-xs text-slate-400 font-bold block mt-1">
                                        {m3 === null ? '—' : `${m3.toLocaleString('id-ID', { maximumFractionDigits: 1 })} m³`}
                                    </span>
                                </div>
                            </div>

                            {/* Card 3: Remaining Space (Ton) */}
                            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 xl:p-4 flex flex-col justify-between relative overflow-hidden group hover:border-violet-500/30 transition-all duration-300 shadow-sm">
                                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="flex items-center justify-between text-slate-500 mb-2.5">
                                    <span className="text-[10px] xl:text-[11px] font-black uppercase tracking-wider">Sisa Ruang</span>
                                    <span className="material-symbols-outlined text-xs xl:text-sm">hourglass_empty</span>
                                </div>
                                <div className="z-10">
                                    <p className="text-2xl xl:text-3xl font-black font-mono text-violet-400 leading-none tracking-tight">
                                        {sisaTon === null ? '—' : `${sisaTon.toLocaleString('id-ID', { maximumFractionDigits: 1 })}`}
                                        {sisaTon !== null && <span className="text-xs xl:text-sm font-bold text-slate-500 ml-1">ton</span>}
                                    </p>
                                    <span className="text-[10px] xl:text-xs text-slate-400 font-bold block mt-1">
                                        {sisaM3 === null ? '—' : `${sisaM3.toLocaleString('id-ID', { maximumFractionDigits: 1 })} m³`}
                                    </span>
                                </div>
                            </div>

                        </div>

                        {/* Mobile Progress Bar (Visible on mobile only) */}
                        {pct !== null && (
                            <div className="mt-4 lg:hidden">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                                    <span>CAPACITY UTILIZATION</span>
                                    <span className={statusObj.text}>{pct.toFixed(1)}%</span>
                                </div>
                                <div className="h-3 rounded-full bg-slate-800/60 overflow-hidden border border-slate-700/30 shadow-inner p-[1.5px]">
                                    <div className="h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${Math.min(fillPct, 100)}%`, backgroundColor: tc.base,
                                            boxShadow: `0 0 15px ${tc.base}` }} />
                                </div>
                            </div>
                        )}

                        {/* Data Timestamp Pill */}
                        {level && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-slate-800/80 rounded-xl text-[10px] xl:text-xs text-slate-400 font-semibold w-fit mt-3">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                                </span>
                                <span className="text-slate-500 font-bold uppercase tracking-wider">Sumber Laporan:</span>
                                <span className={`font-black ${tc.textClass}`}>
                                    {formatDateLabel(level.reportDate, compact)} • Shift {SHIFT_LABEL[level.reportShift]}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Unloading Fly Ash */}
                    <div className="flex flex-col gap-3 lg:gap-3 mt-2 xl:mt-3 pt-3 border-t border-slate-800/60 flex-1">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] xl:text-xs text-slate-500 uppercase font-black tracking-[0.15em] flex items-center gap-2">
                                <span className="material-symbols-outlined text-[14px] xl:text-base">local_shipping</span> Unloading Fly Ash
                            </p>
                            {unloadings.length > 0 && (
                                <span className="text-[9px] xl:text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-0.5 rounded-md font-bold tracking-wider uppercase">
                                    Terkini: {displayTotalRit} RIT
                                </span>
                            )}
                        </div>
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

                        {/* Modal Body */}
                        <div className="p-6 2xl:p-8 overflow-y-auto flex-1 flex flex-col justify-between gap-6 custom-scrollbar bg-slate-900/50">
                            
                            {/* Aggregates Dashboard Bar */}
                            <div className="grid grid-cols-3 gap-3 bg-slate-950/40 border border-slate-800/80 p-4 rounded-2xl">
                                <div className="text-center border-r border-slate-800/80">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Ritase</p>
                                    <p className="text-2xl font-black font-mono text-violet-400 mt-1">{totalRit} <span className="text-xs font-bold text-slate-500">RIT</span></p>
                                </div>
                                <div className="text-center border-r border-slate-800/80">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Trip</p>
                                    <p className="text-2xl font-black font-mono text-white mt-1">{totalTrips} <span className="text-xs font-bold text-slate-500">x</span></p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Kontraktor</p>
                                    <p className="text-2xl font-black font-mono text-white mt-1">{contractorCount} <span className="text-xs font-bold text-slate-500">mitra</span></p>
                                </div>
                            </div>

                            {/* Detailed Records List / Table */}
                            <div className="flex-1">
                                {unloadings.length > 0 ? (
                                    <>
                                        {/* Desktop Structured Table */}
                                        <div className="hidden md:block overflow-hidden border border-slate-800/80 rounded-2xl">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-950/60 border-b border-slate-800/80 text-[10px] xl:text-[11px] text-slate-400 font-black uppercase tracking-wider">
                                                        <th className="py-3 px-4">Tanggal & Shift</th>
                                                        <th className="py-3 px-4">Transportir / Perusahaan</th>
                                                        <th className="py-3 px-4">Tujuan</th>
                                                        <th className="py-3 px-4 text-right">Ritase</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800/40 text-xs xl:text-sm font-semibold text-slate-300">
                                                    {unloadings.slice((historyPage - 1) * 5, historyPage * 5).map((entry, idx) => (
                                                        <tr key={entry.id ?? idx} className="hover:bg-slate-800/30 transition-colors group">
                                                            <td className="py-3.5 px-4 font-mono text-xs">
                                                                {formatDateLabel(entry.date, false)}
                                                                <span className="ml-1.5 text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                                                    {SHIFT_LABEL[entry.shift] ?? entry.shift}
                                                                </span>
                                                            </td>
                                                            <td className="py-3.5 px-4 text-white font-bold">{entry.perusahaan}</td>
                                                            <td className="py-3.5 px-4 text-slate-400">{entry.tujuan || '—'}</td>
                                                            <td className="py-3.5 px-4 text-right font-black font-mono text-violet-400 group-hover:scale-105 transition-transform origin-right">
                                                                {entry.ritase} <span className="text-[10px] font-bold text-slate-500">rit</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        
                                        {/* Mobile Fallback Cards */}
                                        <div className="md:hidden flex flex-col gap-3">
                                            {unloadings.slice((historyPage - 1) * 5, historyPage * 5).map((entry, idx) => renderUnloadingItem(entry, idx))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                                        <span className="material-symbols-outlined text-4xl mb-3 opacity-30">inbox</span>
                                        <p className="font-bold tracking-wide">Belum ada riwayat unloading fly ash</p>
                                    </div>
                                )}
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
