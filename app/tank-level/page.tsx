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
                <div className="hidden lg:flex flex-shrink-0 w-40 flex-col items-center justify-end py-4 px-5 border-r border-slate-800/60"
                    style={{ background: `linear-gradient(to bottom, ${tc.base}08, transparent)` }}>
                    <div className="w-full glass-tank rounded-xl relative bg-slate-800/60 h-52">
                        {/* scale marks */}
                        <div className="absolute inset-0 flex flex-col justify-between py-3 px-2 z-20 pointer-events-none">
                            <div className="border-t border-white/10 text-[10px] text-right text-slate-600 pr-1">100%</div>
                            <div className="border-t border-white/10 text-[10px] text-right text-slate-600 pr-1">75%</div>
                            <div className="border-t border-white/10 text-[10px] text-right text-slate-600 pr-1">50%</div>
                            <div className="border-t border-white/10 text-[10px] text-right text-slate-600 pr-1">25%</div>
                            <div className="border-t border-white/10 text-[10px] text-right text-slate-600 pr-1">0%</div>
                        </div>
                        {/* liquid */}
                        <div className="liquid backdrop-blur-sm"
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                                height: `${Math.min(Math.max(level, 0), 100)}%`,
                                backgroundColor: `${tc.base}CC`,
                                boxShadow: `0 0 30px ${tc.base}66` }}>
                            <div className="liquid-surface" style={{ backgroundColor: tc.base, filter: 'brightness(1.3)' }} />
                        </div>
                    </div>
                    {/* % label below tank */}
                    <p className="mt-3 text-2xl font-black font-mono" style={{ color: tc.base }}>{level.toFixed(1)}%</p>
                </div>

                {/* Stats column */}
                <div className="flex-1 flex flex-col justify-between p-4 lg:p-6 gap-3 lg:gap-4 lg:overflow-hidden">

                    {/* Current Level — hero number */}
                    <div>
                        <p className="text-[10px] lg:text-xs text-slate-500 uppercase tracking-[0.2em] font-black mb-1 lg:mb-2">Current Level</p>
                        <div className="flex items-baseline gap-2 lg:gap-3">
                            <span className="font-black text-white leading-none"
                                style={{ fontSize: 'clamp(2.2rem, 8vw, 5.5rem)',
                                    textShadow: `0 0 40px ${tc.base}, 0 0 80px ${tc.base}60` }}>
                                {m3.toLocaleString('id-ID')}
                            </span>
                            <span className={`font-black ${tc.textClass}`} style={{ fontSize: 'clamp(1rem, 3vw, 2.5rem)' }}>m³</span>
                            {/* % on mobile (no glass tank) */}
                            <span className="lg:hidden ml-auto text-base font-black font-mono" style={{ color: tc.base }}>{level.toFixed(1)}%</span>
                        </div>
                        {tankId === 'SOLAR' && (
                            <p className="text-sm text-white/50 font-bold mt-1">
                                Total 2 tanki: <span className="text-white font-black">{(m3 * 2).toLocaleString('id-ID')} m³</span>
                            </p>
                        )}
                        {/* Progress bar */}
                        <div className="mt-2 lg:mt-3 h-2.5 lg:h-3 rounded-full bg-slate-700/70 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(level, 100)}%`, backgroundColor: tc.base,
                                    boxShadow: `0 0 10px ${tc.base}` }} />
                        </div>
                    </div>

                    {/* Flow In / Out (DEMIN & RCW) */}
                    {tankId !== 'SOLAR' && (
                        <div className={`grid ${tankId === 'DEMIN' ? 'grid-cols-2' : 'grid-cols-1'} gap-2 lg:gap-3`}>
                            <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 lg:px-4 py-2 lg:py-3">
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-0.5 lg:mb-1">Flow In</p>
                                <p className="text-2xl lg:text-3xl font-black font-mono text-emerald-400 leading-none">
                                    {totalFlowIn.toFixed(1)}<span className="text-sm lg:text-base ml-1 opacity-60">t/h</span>
                                </p>
                            </div>
                            {tankId === 'DEMIN' && (
                                <div className="bg-rose-500/8 border border-rose-500/20 rounded-xl px-3 lg:px-4 py-2 lg:py-3">
                                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-0.5 lg:mb-1">Flow Out</p>
                                    <p className="text-2xl lg:text-3xl font-black font-mono text-rose-400 leading-none">
                                        {totalFlowOut.toFixed(1)}<span className="text-sm lg:text-base ml-1 opacity-60">t/h</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Details — sources / destinations / unloading */}
                    <div className="flex flex-col gap-2">
                        {tankId === 'SOLAR' ? (
                            <>
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">3 Unloading Terakhir</p>
                                {solarUnloadings.slice(0, 3).map((entry, idx) => {
                                    const lbl = new Date(entry.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                                    return (
                                        <div key={idx} className="flex items-center justify-between px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl bg-surface-highlight/60 border border-slate-700/50">
                                            <div>
                                                <span className="text-sm font-bold text-white block">{lbl}</span>
                                                <span className="text-xs text-slate-500">{entry.supplier}</span>
                                            </div>
                                            <span className={`text-sm lg:text-base font-black font-mono ${tc.textClass}`}>{entry.liters.toLocaleString('id-ID')} L</span>
                                        </div>
                                    );
                                })}
                                {solarUnloadings.length === 0 && (
                                    <p className="text-xs text-slate-600 italic py-1">Belum ada riwayat unloading</p>
                                )}
                            </>
                        ) : (
                            <>
                                {tank.inputSources.length > 0 && (
                                    <>
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Input Sources</p>
                                        {tank.inputSources.map(source => {
                                            const f = flows.find(f => f.sourceLabel === source);
                                            const active = f && f.rate > 0;
                                            return (
                                                <div key={source} className={`flex items-center justify-between px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl ${active ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-700/20 border border-slate-700/40'}`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                                                        <span className={`text-xs lg:text-sm font-bold uppercase ${active ? 'text-emerald-400' : 'text-slate-500'}`}>{source}</span>
                                                    </div>
                                                    <span className={`text-xs lg:text-sm font-mono font-bold ${active ? 'text-emerald-400' : 'text-slate-600'}`}>{f ? f.rate.toFixed(1) : '0.0'} t/h</span>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                                {tank.outputDestinations.length > 0 && (
                                    <>
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Output Destinations</p>
                                        {tankId === 'DEMIN' ? tank.outputDestinations.map(dest => {
                                            const outFlow = outFlows.find(f => f.destinationLabel === dest.name);
                                            const outActive = dest.hasFlow
                                                ? !!(outFlow && outFlow.rate > 0)
                                                : !!(outFlow?.pump);
                                            return (
                                                <div key={dest.name} className={`flex flex-col gap-1 px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl ${outActive ? 'bg-rose-500/10 border border-rose-500/30' : 'bg-slate-700/20 border border-slate-700/40'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-xs lg:text-sm font-bold uppercase ${outActive ? 'text-rose-400' : 'text-slate-500'}`}>{dest.name}</span>
                                                        {dest.hasFlow && (
                                                            <span className={`text-xs lg:text-sm font-mono font-bold ${outActive ? 'text-rose-400' : 'text-slate-600'}`}>{outFlow ? outFlow.rate.toFixed(1) : '0.0'} t/h</span>
                                                        )}
                                                    </div>
                                                    {dest.pumps && (
                                                        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-600/30">
                                                            {dest.pumps.map(pump => {
                                                                const isActive = outFlow?.pump === pump;
                                                                return isActive ? (
                                                                    <div key={pump} className="flex items-center gap-1.5">
                                                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"></span>
                                                                        <span className="text-xs font-bold text-emerald-400">{pump}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div key={pump} className="flex items-center gap-1.5 opacity-35">
                                                                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                                                                        <span className="text-xs font-bold text-slate-400">{pump}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }) : (
                                            <div className="flex flex-wrap gap-2">
                                                {tank.outputDestinations.map(dest => (
                                                    <span key={dest.name} className="px-3 py-1.5 rounded-lg bg-surface-highlight border border-slate-700 text-xs text-slate-300 font-semibold uppercase tracking-wider">
                                                        {dest.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TankLevelPage() {
    const { operator, canInputTank } = useOperator();
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
        if (!operator) router.push('/');
    }, [operator, router]);

    if (!operator) return null;

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
                <div className="hidden lg:flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white leading-tight">
                            Tank Level <span className="text-primary">Monitoring UBB</span>
                        </h1>
                        <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mt-0.5">CCR Live Display</p>
                    </div>

                    <div className="flex items-stretch gap-4">
                        <div className="bg-surface-dark border border-primary/25 rounded-2xl px-6 py-3 flex flex-col items-center justify-center gap-0.5 shadow-[0_0_30px_rgba(43,124,238,0.15)]">
                            <span className="text-[10px] uppercase font-black text-primary tracking-[0.2em]">Last Data Update</span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="material-symbols-outlined text-primary text-2xl">schedule</span>
                                <span className="text-4xl font-black font-mono text-white tracking-tighter leading-none"
                                    style={{ textShadow: '0 0 20px rgba(43,124,238,0.6)' }}>
                                    {lastUpdateTime}
                                </span>
                            </div>
                            <span className="text-sm font-semibold text-slate-400">{lastUpdateDate}</span>
                        </div>

                        <div className="bg-surface-dark border border-slate-800 rounded-2xl px-5 py-3 flex flex-col items-center justify-center gap-0.5">
                            <span className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">Waktu</span>
                            <span className="text-3xl font-black font-mono text-slate-300 tracking-tighter leading-none">{now}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {canInputTank && (
                            <button onClick={() => router.push('/input')}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer">
                                <span className="material-symbols-outlined text-base">edit</span>
                                Update Level
                            </button>
                        )}
                        <button onClick={() => window.location.reload()}
                            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-primary/20 cursor-pointer">
                            <span className="material-symbols-outlined text-base">refresh</span>
                            Refresh
                        </button>
                        <button onClick={() => router.push('/dashboard')}
                            className="flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer">
                            <span className="material-symbols-outlined text-base">arrow_back</span>
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
