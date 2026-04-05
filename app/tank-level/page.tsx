'use client';

import { useOperator } from '@/hooks/useOperator';
import { useTankData } from '@/hooks/useTankData';
import { TANK_IDS, TANKS, TankId, TANK_THRESHOLDS, DEFAULT_THRESHOLDS } from '@/lib/constants';
import { getAlertStatus } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Per-tank color themes
const TANK_COLORS: Record<string, {
    base: string; bgClass: string; textClass: string; icon: string; borderClass: string;
}> = {
    DEMIN: { base: '#0ea5e9', bgClass: 'bg-sky-500',   textClass: 'text-sky-400',   icon: 'water_drop', borderClass: 'border-sky-500/30' },
    RCW:   { base: '#14b8a6', bgClass: 'bg-teal-500',  textClass: 'text-teal-400',  icon: 'water_pump', borderClass: 'border-teal-500/30' },
    SOLAR: { base: '#f59e0b', bgClass: 'bg-amber-500', textClass: 'text-amber-400', icon: 'oil_barrel', borderClass: 'border-amber-500/30' },
};

function TankCard({ tankId }: { tankId: TankId }) {
    const { currentLevels, flowRates, outputFlowRates, solarUnloadings } = useTankData();
    const tank = TANKS[tankId];
    const data = currentLevels[tankId];
    const level = data?.level || 0;
    const thresholds = TANK_THRESHOLDS[tankId] || DEFAULT_THRESHOLDS;
    const status = getAlertStatus(level, thresholds);
    const tc = TANK_COLORS[tankId] || TANK_COLORS.DEMIN;

    const flows    = flowRates[tankId]       || [];
    const outFlows = outputFlowRates[tankId] || [];

    const totalFlowIn  = flows.reduce((s, f) => s + f.rate, 0);
    const totalFlowOut = outFlows
        .filter(f => tank.outputDestinations.find(d => d.name === f.destinationLabel)?.hasFlow)
        .reduce((s, f) => s + f.rate, 0);

    const statusObj = status === 'normal'
        ? { label: 'Normal',  color: 'bg-emerald-500', text: 'text-emerald-400', ring: 'shadow-emerald-500/40' }
        : status === 'warning'
            ? { label: 'Warning', color: 'bg-amber-500',   text: 'text-amber-400',   ring: 'shadow-amber-500/40' }
            : { label: 'Kritis',  color: 'bg-red-500',     text: 'text-red-400',     ring: 'shadow-red-500/40' };

    const m3 = Math.round(level / 100 * (tankId === 'SOLAR' ? 200 : tank.capacityM3));

    return (
        <div className={`bg-surface-dark border ${tc.borderClass} rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300 lg:h-full`}
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
                        <h3 className="text-white font-black text-xl lg:text-3xl uppercase tracking-tight leading-none">{tank.name}</h3>
                        <p className="text-slate-400 text-xs lg:text-sm font-semibold mt-0.5">{tank.capacity}</p>
                    </div>
                </div>
                {/* Status badge */}
                <div className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full border ${
                    status === 'normal' ? 'bg-emerald-500/10 border-emerald-500/30' :
                    status === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                    'bg-red-500/10 border-red-500/30'}`}>
                    <span className="relative flex h-2.5 w-2.5 lg:h-3 lg:w-3">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusObj.color} opacity-60`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 lg:h-3 lg:w-3 ${statusObj.color}`}></span>
                    </span>
                    <span className={`${statusObj.text} text-xs lg:text-sm font-black uppercase tracking-widest`}>{statusObj.label}</span>
                </div>
            </div>

            {/* ── Main Body ── */}
            <div className="flex-1 flex gap-0 lg:min-h-0 lg:overflow-hidden">

                {/* Glass Tank column — desktop only */}
                <div className="hidden lg:flex flex-shrink-0 w-48 xl:w-56 flex-col items-center justify-between py-6 px-6 border-r border-slate-800/60"
                    style={{ background: `linear-gradient(to bottom, ${tc.base}08, transparent)` }}>
                    <div className="w-full xl:w-3/4 flex-1 glass-tank rounded-3xl relative bg-slate-800/60 min-h-[300px]">
                        {/* scale marks */}
                        <div className="absolute inset-0 flex flex-col justify-between py-8 px-3 z-20 pointer-events-none">
                            <div className="border-t border-white/10 text-xs xl:text-sm text-right text-slate-500 pr-2 font-bold uppercase tracking-widest">100%</div>
                            <div className="border-t border-white/10 text-xs xl:text-sm text-right text-slate-500 pr-2 font-bold uppercase tracking-widest">75%</div>
                            <div className="border-t border-white/10 text-xs xl:text-sm text-right text-slate-500 pr-2 font-bold uppercase tracking-widest">50%</div>
                            <div className="border-t border-white/10 text-xs xl:text-sm text-right text-slate-500 pr-2 font-bold uppercase tracking-widest">25%</div>
                            <div className="border-t border-white/10 text-xs xl:text-sm text-right text-slate-500 pr-2 font-bold uppercase tracking-widest">0%</div>
                        </div>
                        {/* liquid */}
                        <div className="liquid backdrop-blur-md rounded-b-3xl"
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                                height: `${Math.min(Math.max(level, 0), 100)}%`,
                                backgroundColor: `${tc.base}CC`,
                                boxShadow: `0 -10px 40px ${tc.base}50` }}>
                            <div className="liquid-surface" style={{ backgroundColor: tc.base, filter: 'brightness(1.5)', height: '15px', top: '-7.5px' }} />
                        </div>
                    </div>
                    {/* % label below tank */}
                    <div className="mt-6 flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mb-1">Percentage</span>
                        <p className="text-4xl xl:text-5xl font-black font-mono leading-none tracking-tighter" style={{ color: tc.base, textShadow: `0 0 20px ${tc.base}40` }}>{level.toFixed(1)}%</p>
                    </div>
                </div>

                {/* Stats column */}
                <div className="flex-1 flex flex-col justify-between p-4 lg:p-6 gap-3 lg:gap-4 lg:overflow-hidden">

                    {/* Current Level — hero number */}
                    <div>
                        <p className="text-xs lg:text-sm text-slate-500 uppercase tracking-[0.2em] font-black mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">water</span>
                            Total Volume Available
                        </p>
                        <div className="flex items-baseline gap-3 xl:gap-4">
                            <span className="font-black text-white leading-none tracking-tighter"
                                style={{ fontSize: 'clamp(3rem, 7vw, 6.5rem)',
                                    textShadow: `0 0 50px ${tc.base}80, 0 0 100px ${tc.base}40` }}>
                                {m3.toLocaleString('id-ID')}
                            </span>
                            <span className={`font-black ${tc.textClass} tracking-tighter`} style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3rem)' }}>m³</span>
                            {/* % on mobile (no glass tank) */}
                            <span className="lg:hidden ml-auto text-3xl font-black font-mono" style={{ color: tc.base }}>{level.toFixed(1)}%</span>
                        </div>
                        {tankId === 'SOLAR' && (
                            <div className="inline-block mt-3 bg-slate-800/50 border border-slate-700/60 px-4 py-2 rounded-xl">
                                <p className="text-sm xl:text-base text-slate-400 font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">layers</span>
                                    Total 2 tanki: <span className="text-white font-black text-lg xl:text-xl">{(m3 * 2).toLocaleString('id-ID')} m³</span>
                                </p>
                            </div>
                        )}
                        {/* Progress bar */}
                        <div className="mt-4 lg:hidden h-3 rounded-full bg-slate-700/70 overflow-hidden shadow-inner">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(level, 100)}%`, backgroundColor: tc.base,
                                    boxShadow: `0 0 15px ${tc.base}` }} />
                        </div>
                    </div>

                    {/* Flow In / Out (DEMIN & RCW) */}
                    {tankId !== 'SOLAR' && (
                        <div className={`grid ${tankId === 'DEMIN' ? 'grid-cols-2' : 'grid-cols-1'} gap-3 xl:gap-4 mt-2`}>
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3 xl:px-5 xl:py-4 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                                <p className="text-[11px] xl:text-xs text-emerald-500/80 uppercase font-black tracking-widest mb-1 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">login</span> Flow In
                                </p>
                                <p className="text-2xl lg:text-3xl xl:text-4xl font-black font-mono text-emerald-400 leading-none tracking-tighter">
                                    {totalFlowIn.toFixed(1)}<span className="text-sm lg:text-base xl:text-xl ml-1 xl:ml-2 font-bold opacity-60">t/h</span>
                                </p>
                            </div>
                            {tankId === 'DEMIN' && (
                                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl px-4 py-3 xl:px-5 xl:py-4 shadow-[0_0_20px_rgba(244,63,94,0.05)]">
                                    <p className="text-[11px] xl:text-xs text-rose-500/80 uppercase font-black tracking-widest mb-1 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">logout</span> Flow Out
                                    </p>
                                    <p className="text-2xl lg:text-3xl xl:text-4xl font-black font-mono text-rose-400 leading-none tracking-tighter">
                                        {totalFlowOut.toFixed(1)}<span className="text-sm lg:text-base xl:text-xl ml-1 xl:ml-2 font-bold opacity-60">t/h</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Details — sources / destinations / unloading */}
                    <div className="flex flex-col gap-3 lg:gap-4 mt-auto pt-4 border-t border-slate-800/60">
                        {tankId === 'SOLAR' ? (
                            <>
                                <p className="text-[11px] xl:text-xs text-slate-500 uppercase font-black tracking-[0.15em] flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[14px] xl:text-base">local_shipping</span> 3 Unloading Terakhir
                                </p>
                                <div className={`${solarUnloadings.length > 0 ? 'grid grid-cols-1 xl:grid-cols-3 gap-3' : ''}`}>
                                    {solarUnloadings.slice(0, 3).map((entry, idx) => {
                                        const lbl = new Date(entry.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                                        return (
                                            <div key={idx} className="flex xl:flex-col items-center xl:items-start justify-between px-4 py-3 xl:p-4 rounded-xl xl:rounded-2xl bg-surface-highlight/40 border border-slate-700/60 hover:bg-surface-highlight/80 transition-colors group relative">
                                                <div className="xl:mb-2 xl:border-b border-slate-700/50 xl:pb-2 w-full pr-12 xl:pr-0 relative">
                                                    <span className="text-sm xl:text-[15px] font-bold text-white block truncate">{lbl}</span>
                                                    <span className="text-[11px] xl:text-xs text-slate-400 truncate block mt-0.5 group-hover:text-slate-300 transition-colors" title={entry.supplier}>{entry.supplier}</span>
                                                    
                                                    {/* Hover Actions */}
                                                    <div className="absolute top-0 right-0 xl:-top-2 xl:-right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-dark/80 backdrop-blur-sm rounded-lg p-1 border border-slate-700/50">
                                                        <button className="text-slate-400 hover:text-emerald-400 transition-colors p-1 rounded hover:bg-slate-700 cursor-pointer" title="Edit Unloading">
                                                            <span className="material-symbols-outlined text-[14px]">edit</span>
                                                        </button>
                                                        <button className="text-slate-400 hover:text-rose-400 transition-colors p-1 rounded hover:bg-slate-700 cursor-pointer" title="Hapus Unloading">
                                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <span className={`text-lg xl:text-2xl font-black font-mono tracking-tighter leading-none ${tc.textClass} mt-0 xl:mt-2`}>{entry.liters.toLocaleString('id-ID')} <span className="text-xs xl:text-sm text-slate-500 font-bold ml-0.5">L</span></span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {solarUnloadings.length === 0 && (
                                    <p className="text-sm text-slate-600 italic py-2">Belum ada riwayat unloading</p>
                                )}
                            </>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 mt-1">
                                {tank.inputSources.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-[10px] xl:text-[11px] text-slate-500 uppercase font-black tracking-[0.1em] flex items-center gap-1.5 mb-0.5">
                                            <span className="material-symbols-outlined text-[14px]">turn_left</span> Input Sources
                                        </p>
                                        <div className="flex flex-col gap-1.5">
                                            {tank.inputSources.map(source => {
                                                const f = flows.find(f => f.sourceLabel === source);
                                                const active = f && f.rate > 0;
                                                return (
                                                    <div key={source} className={`flex items-center justify-between px-3 py-2 xl:px-4 xl:py-2.5 rounded-xl border ${active ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-700/10 border-slate-700/40'} transition-all`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 xl:w-2.5 xl:h-2.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`}></span>
                                                            <span className={`text-xs xl:text-sm font-bold uppercase tracking-tight ${active ? 'text-emerald-400' : 'text-slate-400'}`}>{source}</span>
                                                        </div>
                                                        <span className={`text-sm xl:text-base font-mono font-black tracking-tighter ${active ? 'text-emerald-400' : 'text-slate-600'}`}>{f ? f.rate.toFixed(1) : '0.0'} <span className="text-[10px] xl:text-xs font-bold opacity-60">t/h</span></span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {tank.outputDestinations.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-[10px] xl:text-[11px] text-slate-500 uppercase font-black tracking-[0.1em] flex items-center gap-1.5 mb-0.5 mt-2 xl:mt-0">
                                            <span className="material-symbols-outlined text-[14px]">turn_right</span> Output Destinations
                                        </p>
                                        <div className="flex flex-col gap-1.5">
                                            {tankId === 'DEMIN' ? tank.outputDestinations.map(dest => {
                                                const outFlow = outFlows.find(f => f.destinationLabel === dest.name);
                                                const outActive = dest.hasFlow
                                                    ? !!(outFlow && outFlow.rate > 0)
                                                    : !!(outFlow?.pump);
                                                return (
                                                    <div key={dest.name} className={`flex flex-col gap-1.5 px-3 py-2 xl:px-4 xl:py-2.5 rounded-xl border ${outActive ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-700/10 border-slate-700/40'} transition-all`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 xl:w-2.5 xl:h-2.5 rounded-full ${outActive ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-slate-600'}`}></span>
                                                                <span className={`text-xs xl:text-sm font-bold uppercase tracking-tight ${outActive ? 'text-rose-400' : 'text-slate-400'}`}>{dest.name}</span>
                                                            </div>
                                                            {dest.hasFlow && (
                                                                <span className={`text-sm xl:text-base font-mono font-black tracking-tighter ${outActive ? 'text-rose-400' : 'text-slate-600'}`}>{outFlow ? outFlow.rate.toFixed(1) : '0.0'} <span className="text-[10px] xl:text-xs font-bold opacity-60">t/h</span></span>
                                                            )}
                                                        </div>
                                                        {dest.pumps && (
                                                            <div className="flex flex-wrap items-center gap-2 pt-2 mt-0.5 border-t border-slate-600/30">
                                                                {dest.pumps.map(pump => {
                                                                    const isActive = outFlow?.pump === pump;
                                                                    return isActive ? (
                                                                        <div key={pump} className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 px-2 py-1 xl:px-2.5 xl:py-1 rounded-md shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]">
                                                                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                                                                            <span className="text-[10px] xl:text-[11px] font-bold text-emerald-400 uppercase tracking-widest">{pump}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div key={pump} className="flex items-center gap-1.5 bg-slate-800/50 border border-slate-700/50 px-2 py-1 xl:px-2.5 xl:py-1 rounded-md opacity-60">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                                                            <span className="text-[10px] xl:text-[11px] font-bold text-slate-400 uppercase tracking-widest">{pump}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }) : (
                                                <div className="flex flex-wrap gap-2 xl:gap-3">
                                                    {tank.outputDestinations.map(dest => (
                                                        <span key={dest.name} className="px-4 py-2 rounded-xl bg-surface-highlight/50 border border-slate-700 shadow-sm text-xs xl:text-sm text-slate-300 font-bold uppercase tracking-widest">
                                                            {dest.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TankLevelPage() {
    const { operator, canInputTank, loading: operatorLoading } = useOperator();
    const { currentLevels } = useTankData();
    const router = useRouter();
    const [now, setNow] = useState('');

    // Tick every second for live clock
    useEffect(() => {
        const tick = () => setNow(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    // Auto-refresh every 30 s
    useEffect(() => {
        const id = setInterval(() => window.location.reload(), 30000);
        return () => clearInterval(id);
    }, []);

    const lastUpdate = Object.values(currentLevels)
        .map(d => d?.timestamp).filter(Boolean).sort().reverse()[0];

    const lastUpdateTime = lastUpdate
        ? new Date(lastUpdate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '--:--';

    const lastUpdateDate = lastUpdate
        ? new Date(lastUpdate).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
        : '---';

    useEffect(() => {
        if (!operatorLoading && !operator) router.push('/');
    }, [operator, operatorLoading, router]);

    if (operatorLoading || !operator) return null;

    return (
        /* Mobile: scrollable min-h-screen | Desktop (lg+): full-screen CCR no-scroll */
        <div className="flex flex-col gap-3 px-4 py-4 min-h-screen lg:h-screen lg:overflow-hidden lg:px-5 lg:py-4"
            style={{ background: 'var(--color-background, #060c1a)' }}>

            {/* ── Header ── */}
            <header className="flex-shrink-0">
                {/* Mobile header layout */}
                <div className="flex lg:hidden items-center justify-between gap-2 mb-2">
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-white leading-tight">
                            Tank Level <span className="text-primary">Monitoring UBB</span>
                        </h1>
                        <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-bold">CCR Live Display</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {canInputTank && (
                            <button onClick={() => router.push('/input')}
                                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer">
                                <span className="material-symbols-outlined text-sm">edit</span>
                                Update
                            </button>
                        )}
                        <button onClick={() => window.location.reload()}
                            className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-primary/20 cursor-pointer">
                            <span className="material-symbols-outlined text-sm">refresh</span>
                        </button>
                        <button onClick={() => router.push('/dashboard')}
                            className="flex items-center gap-1 text-slate-400 hover:text-white hover:bg-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer">
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                        </button>
                    </div>
                </div>

                {/* Mobile: Last Update + Clock row */}
                <div className="flex lg:hidden items-center gap-3 bg-surface-dark border border-primary/20 rounded-xl px-4 py-2.5 shadow-sm">
                    <span className="material-symbols-outlined text-primary text-lg">schedule</span>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-primary font-black uppercase tracking-widest">Last Update</span>
                        <span className="text-xl font-black font-mono text-white leading-none">{lastUpdateTime}</span>
                        <span className="text-xs text-slate-400 font-semibold">{lastUpdateDate}</span>
                    </div>
                    <div className="ml-auto flex flex-col items-end">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Waktu</span>
                        <span className="text-xl font-black font-mono text-slate-300 leading-none">{now}</span>
                    </div>
                </div>

                {/* Desktop header layout */}
                <div className="hidden lg:flex items-center justify-between gap-6 px-1 lg:py-2">
                    <div>
                        <h1 className="text-3xl lg:text-5xl font-black tracking-tighter text-white leading-tight">
                            Tank Level <span className="text-primary">Monitoring UBB</span>
                        </h1>
                        <p className="text-[11px] lg:text-sm text-primary uppercase tracking-[0.3em] font-black mt-2">CCR Live Display</p>
                    </div>

                    <div className="flex items-stretch gap-6">
                        <div className="bg-surface-dark border border-primary/30 rounded-[2rem] px-8 py-4 lg:py-5 flex flex-col items-center justify-center gap-1 shadow-[0_0_40px_rgba(43,124,238,0.15)] relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                            <span className="text-xs lg:text-sm uppercase font-black text-primary tracking-[0.2em] relative z-10">Last Data Update</span>
                            <div className="flex items-center gap-3 mt-1 relative z-10">
                                <span className="material-symbols-outlined text-primary text-3xl lg:text-4xl">schedule</span>
                                <span className="text-5xl lg:text-6xl font-black font-mono text-white tracking-tighter leading-none"
                                    style={{ textShadow: '0 0 30px rgba(43,124,238,0.5)' }}>
                                    {lastUpdateTime}
                                </span>
                            </div>
                            <span className="text-sm lg:text-base font-bold text-slate-400 mt-1 relative z-10">{lastUpdateDate}</span>
                        </div>

                        <div className="bg-surface-dark border border-slate-800 rounded-[2rem] px-8 py-4 lg:py-5 flex flex-col items-center justify-center gap-1 shadow-xl">
                            <span className="text-xs lg:text-sm uppercase font-black text-slate-500 tracking-[0.2em]">Local Time</span>
                            <span className="text-4xl lg:text-5xl font-black font-mono text-slate-300 tracking-tighter leading-none mt-2">{now}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {canInputTank && (
                            <button onClick={() => router.push('/input')}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 lg:px-6 py-3 lg:py-4 rounded-2xl text-sm lg:text-base font-bold transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-600/30 cursor-pointer">
                                <span className="material-symbols-outlined text-lg lg:text-xl">edit</span>
                                Update Level
                            </button>
                        )}
                        <button onClick={() => window.location.reload()}
                            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 lg:px-6 py-3 lg:py-4 rounded-2xl text-sm lg:text-base font-bold transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/30 cursor-pointer">
                            <span className="material-symbols-outlined text-lg lg:text-xl">refresh</span>
                            Refresh
                        </button>
                        <button onClick={() => router.push('/dashboard')}
                            className="flex items-center gap-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 px-5 lg:px-6 py-3 lg:py-4 rounded-2xl text-sm lg:text-base font-bold transition-colors cursor-pointer border border-slate-700/50">
                            <span className="material-symbols-outlined text-lg lg:text-xl">home</span>
                            Dashboard
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Tank Cards ── */}
            {/* Mobile: stacked, Desktop: 3-col fill remaining height */}
            <div className="grid grid-cols-1 gap-4 lg:flex-1 lg:grid-cols-3 lg:min-h-0">
                {TANK_IDS.map(id => <TankCard key={id} tankId={id} />)}
            </div>
        </div>
    );
}
