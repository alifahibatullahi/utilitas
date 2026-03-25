'use client';

import { useOperator } from '@/hooks/useOperator';
import { useTankData } from '@/hooks/useTankData';
import { TANK_IDS, TANKS, TankId } from '@/lib/constants';
import { getAlertStatus } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// Per-tank color themes
const TANK_COLORS: Record<string, {
    base: string; bgClass: string; textClass: string; icon: string; hoverBorderClass: string;
    liquidBg: string; liquidSurface: string;
}> = {
    DEMIN: { base: '#0ea5e9', bgClass: 'bg-sky-500', textClass: 'text-sky-400', icon: 'water_drop', hoverBorderClass: 'hover:border-sky-500/30', liquidBg: 'bg-sky-500', liquidSurface: 'bg-sky-400' },
    RCW: { base: '#14b8a6', bgClass: 'bg-teal-500', textClass: 'text-teal-400', icon: 'water_pump', hoverBorderClass: 'hover:border-teal-500/30', liquidBg: 'bg-teal-500', liquidSurface: 'bg-teal-400' },
    SOLAR: { base: '#f59e0b', bgClass: 'bg-amber-500', textClass: 'text-amber-400', icon: 'oil_barrel', hoverBorderClass: 'hover:border-amber-500/30', liquidBg: 'bg-amber-500', liquidSurface: 'bg-amber-400' },
};

function TankCard({ tankId }: { tankId: TankId }) {
    const { currentLevels, flowRates, outputFlowRates, solarUnloadings } = useTankData();
    const tank = TANKS[tankId];
    const data = currentLevels[tankId];
    const level = data?.level || 0;
    const status = getAlertStatus(level);
    const tc = TANK_COLORS[tankId] || TANK_COLORS.DEMIN;

    const flows = flowRates[tankId] || [];
    const outFlows = outputFlowRates[tankId] || [];

    const totalFlowIn = flows.reduce((sum, f) => sum + f.rate, 0);
    const totalFlowOut = outFlows.reduce((sum, f) => sum + f.rate, 0);

    const statusObj = status === 'normal'
        ? { label: 'Normal', color: 'bg-emerald-500', text: 'text-emerald-500' }
        : status === 'warning'
            ? { label: 'Warning', color: 'bg-amber-500', text: 'text-amber-500' }
            : { label: 'Kritis', color: 'bg-red-500', text: 'text-red-500' };

    return (
        <div className={`bg-surface-dark border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-full relative group ${tc.hoverBorderClass} transition-all duration-300 min-h-[640px]`}>
            {/* Header */}
            <div className={`p-6 border-b border-slate-800 flex justify-between items-center relative z-10`} style={{ background: `linear-gradient(to right, ${tc.base}1A, var(--color-surface-highlight) 50%, transparent)` }}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 ${tc.bgClass} rounded-xl`} style={{ boxShadow: `0 0 15px ${tc.base}80` }}>
                        <span className="material-symbols-outlined text-white text-2xl">{tc.icon}</span>
                    </div>
                    <div>
                        <h3 className="text-white font-black text-2xl uppercase tracking-tighter drop-shadow-sm">{tank.name}</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusObj.color} opacity-75`}></span>
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusObj.color}`}></span>
                            </span>
                            <span className={`${statusObj.text} text-xs font-bold uppercase tracking-wide`}>{statusObj.label}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Visual & Stats */}
            <div className="px-6 py-8 flex-1 flex flex-col items-center justify-between gap-6 relative z-10">
                <div className="flex w-full items-center justify-between gap-6 flex-col sm:flex-row lg:flex-col xl:flex-row">
                    {/* Glass Tank Visual */}
                    <div className="w-28 h-56 glass-tank rounded-xl relative bg-slate-800/50 flex-shrink-0 mx-auto xl:mx-0">
                        <div className="absolute right-0 top-0 bottom-0 w-full flex flex-col justify-between py-4 px-2 z-20 pointer-events-none">
                            <div className="w-full border-t border-white/10 text-[9px] text-right text-slate-500 pr-1">100%</div>
                            <div className="w-3/4 border-t border-white/10 self-end"></div>
                            <div className="w-3/4 border-t border-white/10 self-end"></div>
                            <div className="w-3/4 border-t border-white/10 self-end"></div>
                            <div className="w-full border-t border-white/10 text-[9px] text-right text-slate-500 pr-1">0%</div>
                        </div>
                        <div className="liquid backdrop-blur-sm" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${Math.min(Math.max(level, 0), 100)}%`, backgroundColor: `${tc.base}CC`, boxShadow: `0 0 20px ${tc.base}66` }}>
                            <div className="liquid-surface" style={{ backgroundColor: tc.base, filter: 'brightness(1.3)' }}></div>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="flex-1 flex flex-col justify-center text-center xl:text-right w-full space-y-5">
                        <div>
                            <span className="text-xs text-text-secondary uppercase tracking-widest font-bold block mb-1">Current Level</span>
                            <div className="flex items-baseline justify-center xl:justify-end gap-1.5">
                                <span className="text-5xl font-black text-white tracking-tighter" style={{ textShadow: `0 0 20px ${tc.base}80` }}>{Math.round(level / 100 * (tankId === 'SOLAR' ? 200 : tank.capacityM3)).toLocaleString('id-ID')}</span>
                                <span className={`text-lg font-bold ${tc.textClass}`}>m³</span>
                            </div>
                            {tankId === 'SOLAR' ? (
                                <>
                                    <div className="mt-2 text-sm text-white/70 font-bold">
                                        Total: {(Math.round(level / 100 * 200) * 2).toLocaleString('id-ID')} m³  <span className="text-[10px] text-slate-500">(2 tanki)</span>
                                    </div>
                                    <div className="mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                        {level.toFixed(1)}% &bull; 2×200 m³
                                    </div>
                                </>
                            ) : (
                                <div className="mt-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                    {level.toFixed(1)}% &bull; Kapasitas: {tank.capacity}
                                </div>
                            )}
                        </div>

                        {/* Flow Summaries (DEMIN & RCW) */}
                        {tankId !== 'SOLAR' && (
                            <div className="space-y-4 pt-4 border-t border-slate-700/50">
                                <div className="flex justify-between items-end">
                                    <span className="text-slate-500 uppercase font-bold text-[10px]">Flow In</span>
                                    <span className="text-emerald-400 font-mono font-bold text-xl leading-none">{totalFlowIn.toFixed(1)} <span className="text-[10px] uppercase ml-1 opacity-60">t/h</span></span>
                                </div>
                                {tankId === 'DEMIN' && (
                                    <div className="flex justify-between items-end">
                                        <span className="text-slate-500 uppercase font-bold text-[10px]">Flow Out</span>
                                        <span className="text-rose-400 font-mono font-bold text-xl leading-none">{totalFlowOut.toFixed(1)} <span className="text-[10px] uppercase ml-1 opacity-60">t/h</span></span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Details Section */}
                <div className="w-full space-y-5 pt-4">
                    {tankId === 'SOLAR' ? (
                        <>
                            <div>
                                <p className="text-xs text-text-secondary uppercase font-bold tracking-widest mb-3">3 Unloading Terakhir</p>
                                <div className="space-y-2">
                                    {solarUnloadings.slice(0, 3).map((entry, idx) => {
                                        const dateLabel = new Date(entry.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-surface-highlight/50 border border-slate-700/50">
                                                <div className="flex flex-col text-left">
                                                    <span className="text-sm font-bold text-white">{dateLabel}</span>
                                                    <span className="text-xs text-text-secondary">{entry.supplier}</span>
                                                </div>
                                                <span className={`text-base font-mono font-bold ${tc.textClass}`}>{entry.liters.toLocaleString('id-ID')} L</span>
                                            </div>
                                        );
                                    })}
                                    {solarUnloadings.length === 0 && (
                                        <p className="text-xs text-text-secondary/60 italic text-center py-2">Belum ada riwayat unloading</p>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Input Sources */}
                            {tank.inputSources.length > 0 && (
                                <div>
                                    <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest mb-3">Input Sources</p>
                                    <div className="space-y-2">
                                        {tank.inputSources.map((source) => {
                                            const f = flows.find(f => f.sourceLabel === source);
                                            const flowActive = f && f.rate > 0;
                                            return (
                                                <div key={source} className={`flex items-center justify-between px-3 py-2 rounded ${flowActive ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-700/20 border border-slate-700/40'}`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${flowActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                                                        <span className={`text-xs font-bold uppercase ${flowActive ? 'text-emerald-400' : 'text-slate-500'}`}>{source}</span>
                                                    </div>
                                                    <span className={`text-xs font-mono font-bold ${flowActive ? 'text-emerald-400' : 'text-slate-600'}`}>{f ? f.rate.toFixed(1) : '0.0'} t/h</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Output Destinations */}
                            {tank.outputDestinations.length > 0 && (
                                <div>
                                    <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest mb-3">Output Destinations</p>
                                    {tankId === 'DEMIN' ? (
                                        <div className="space-y-2">
                                            {tank.outputDestinations.map(dest => {
                                                const outFlow = outFlows.find(f => f.destinationLabel === dest.name);
                                                const outActive = outFlow && outFlow.rate > 0;
                                                return (
                                                    <div key={dest.name} className={`flex flex-col gap-1 px-3 py-2 rounded ${outActive ? 'bg-rose-500/10 border border-rose-500/30' : 'bg-slate-700/20 border border-slate-700/40'}`}>
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-xs font-bold uppercase ${outActive ? 'text-rose-400' : 'text-slate-500'}`}>{dest.name}</span>
                                                            <span className={`text-xs font-mono font-bold ${outActive ? 'text-rose-400' : 'text-slate-600'}`}>{outFlow ? outFlow.rate.toFixed(1) : '0.0'} t/h</span>
                                                        </div>
                                                        {dest.pumps && (
                                                            <div className="flex flex-wrap items-center gap-3 mt-1 pt-1 border-t border-rose-500/20">
                                                                {dest.pumps.map(pump => {
                                                                    const isActive = outFlow?.pump === pump;
                                                                    return isActive ? (
                                                                        <div key={pump} className="flex items-center gap-1.5">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
                                                                            <span className="text-[9px] font-bold text-emerald-500">{pump}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div key={pump} className="flex items-center gap-1.5 opacity-40">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                                                            <span className="text-[9px] font-bold text-slate-400">{pump}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {tank.outputDestinations.map(dest => (
                                                <span key={dest.name} className="px-2.5 py-1.5 rounded bg-surface-highlight border border-slate-700 text-[10px] text-slate-300 font-semibold uppercase tracking-wider">
                                                    {dest.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function TankTrendChart({ tankId }: { tankId: TankId }) {
    const { trendData } = useTankData();
    const tc = TANK_COLORS[tankId] || TANK_COLORS.DEMIN;
    const tank = TANKS[tankId];
    const trend = trendData[tankId] || [];

    return (
        <div className="bg-surface-dark border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 ${tc.bgClass} rounded-lg`} style={{ boxShadow: `0 0 10px ${tc.base}60` }}>
                        <span className="material-symbols-outlined text-white text-base">{tc.icon}</span>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm">{tank.name}</h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Trend Level 1 Jam Terakhir</p>
                    </div>
                </div>
                {trend.length > 0 && (
                    <div className="text-right">
                        <span className="text-lg font-black text-white" style={{ textShadow: `0 0 10px ${tc.base}60` }}>
                            {trend[trend.length - 1].level.toFixed(1)}%
                        </span>
                    </div>
                )}
            </div>
            <div className="h-48">
                {trend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`grad-${tankId}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={tc.base} stopOpacity={0.15} />
                                    <stop offset="100%" stopColor={tc.base} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" />
                            <XAxis
                                dataKey="time"
                                stroke="#475569"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                domain={[0, 100]}
                                stroke="#475569"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => `${v}%`}
                                width={40}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    border: `1px solid ${tc.base}40`,
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: '#f8fafc',
                                    boxShadow: `0 0 15px ${tc.base}20`,
                                }}
                                formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Level']}
                                labelStyle={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '10px' }}
                            />
                            <ReferenceLine y={40} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.4} />
                            <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} />
                            <Line
                                type="monotone"
                                dataKey="level"
                                stroke={tc.base}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5, fill: tc.base, stroke: '#0f172a', strokeWidth: 2 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-xs text-slate-600 italic">Belum ada data trend</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TankLevelPage() {
    const { operator, canInputTank } = useOperator();
    const { currentLevels } = useTankData();
    const router = useRouter();
    const [, setTick] = useState(0);

    // Auto-refresh every 30 seconds for continuous CCR monitoring
    useEffect(() => {
        const interval = setInterval(() => {
            setTick(t => t + 1);
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Find most recent data update timestamp
    const lastUpdate = Object.values(currentLevels)
        .map(d => d?.timestamp)
        .filter(Boolean)
        .sort()
        .reverse()[0];

    const lastUpdateLabel = lastUpdate
        ? new Date(lastUpdate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '--:--';

    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    if (!operator) return null;

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(43,124,238,0.3)]">Tank Level <span className="text-primary">Monitoring</span></h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">CCR Live Display</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-surface-dark/40 border border-slate-800/50 px-4 py-2 rounded-full flex items-center gap-3 shadow-inner">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] uppercase font-black text-primary tracking-[0.2em] mb-1">Last Data Update</span>
                            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 px-6 py-1.5 rounded-2xl shadow-[0_0_20px_rgba(43,124,238,0.1)]">
                                <span className="material-symbols-outlined text-primary text-xl">schedule</span>
                                <span className="text-lg font-bold font-mono text-white tracking-tight">{lastUpdateLabel}</span>
                            </div>
                        </div>
                    </div>
                    <div className="hidden sm:flex flex-col items-center text-slate-600">
                        <span className="text-[9px] uppercase tracking-widest font-bold">Waktu</span>
                        <span className="text-sm font-mono font-bold">{now}</span>
                    </div>
                    {canInputTank && (
                        <button
                            onClick={() => router.push('/input')}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-600/20"
                        >
                            <span className="material-symbols-outlined text-base">edit</span>
                            Update Level
                        </button>
                    )}
                    <button onClick={() => window.location.reload()} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-base">refresh</span>
                        Refresh
                    </button>
                </div>
            </header>

            {/* Tank Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                {TANK_IDS.map(id => <TankCard key={id} tankId={id} />)}
            </div>

            {/* Trend Charts — one line chart per tank */}
            <div>
                <div className="flex items-center gap-3 mb-5">
                    <span className="material-symbols-outlined text-text-secondary text-xl">query_stats</span>
                    <h3 className="text-white font-bold text-lg">Trend Analysis</h3>
                    <div className="flex-1 h-px bg-slate-800"></div>
                    <div className="flex items-center gap-4">
                        {TANK_IDS.map(id => (
                            <div key={id} className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TANK_COLORS[id].base }}></span>
                                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{TANKS[id].name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {TANK_IDS.map(id => <TankTrendChart key={id} tankId={id} />)}
                </div>
            </div>
        </div>
    );
}
