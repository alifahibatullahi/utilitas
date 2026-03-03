'use client';

import { useOperator } from '@/hooks/useOperator';
import { useTankData } from '@/hooks/useTankData';
import { TANK_IDS, TANKS } from '@/lib/constants';
import { getAlertStatus } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Per-tank color themes (matching each tank's identity)
const TANK_COLORS: Record<string, {
    bar: string; barGradient: string; text: string; accent: string; icon: string; glow: string;
}> = {
    DEMIN: {
        bar: '#0ea5e9',        // sky-500
        barGradient: '#38bdf8', // sky-400
        text: 'text-sky-400',
        accent: 'bg-sky-500',
        icon: 'water_drop',
        glow: 'shadow-sky-500/30',
    },
    RCW: {
        bar: '#14b8a6',        // teal-500
        barGradient: '#2dd4bf', // teal-400
        text: 'text-teal-400',
        accent: 'bg-teal-500',
        icon: 'water',
        glow: 'shadow-teal-500/30',
    },
    SOLAR: {
        bar: '#f59e0b',        // amber-500
        barGradient: '#fbbf24', // amber-400
        text: 'text-amber-400',
        accent: 'bg-amber-500',
        icon: 'oil_barrel',
        glow: 'shadow-amber-500/30',
    },
};

// Status override colors (for critical/warning states)
const STATUS_COLORS = {
    critical: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', text: 'text-red-400', bar: '#ef4444' },
    warning: { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', text: 'text-amber-400', bar: '#eab308' },
    normal: { badge: '', text: '', bar: '' }, // will use tank color
};

function TankGauge({ tankId, level }: { tankId: string; level: number }) {
    const tank = TANKS[tankId as keyof typeof TANKS];
    const status = getAlertStatus(level);
    const tc = TANK_COLORS[tankId] || TANK_COLORS.DEMIN;
    const sc = STATUS_COLORS[status];
    const bgPulse = status === 'critical' ? 'animate-alert-pulse' : '';

    const statusLabel = status === 'critical' ? 'KRITIS' : status === 'warning' ? 'Warning' : 'Normal';

    // Use tank-specific color for normal, override for warning/critical
    const fillColor = status === 'normal' ? tc.bar : sc.bar;
    const fillGradient = status === 'normal' ? tc.barGradient : sc.bar;
    const textColor = status === 'normal' ? tc.text : sc.text;
    const badgeClass = status === 'normal'
        ? `bg-emerald-500/20 text-emerald-400 border-emerald-500/30`
        : sc.badge;

    return (
        <div className={`bg-surface-dark border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all ${bgPulse}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${fillColor}20` }}>
                        <span className="material-symbols-outlined" style={{ color: fillColor }}>{tc.icon}</span>
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-lg">{tank.name}</h4>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${badgeClass}`}>{statusLabel}</span>
                    </div>
                </div>
                <p className={`text-3xl font-black ${textColor}`}>{level.toFixed(0)}%</p>
            </div>

            {/* Tank Visual */}
            <div className="relative h-40 bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden mb-4">
                {/* Fill */}
                <div
                    className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out"
                    style={{
                        height: `${Math.min(Math.max(level, 0), 100)}%`,
                        background: `linear-gradient(to top, ${fillColor}, ${fillGradient})`,
                        opacity: 0.85,
                    }}
                >
                    {/* Surface wave effect */}
                    <div className="absolute top-0 left-0 right-0 h-3 bg-white/15 rounded-t" style={{ animation: 'liquidWave 3s ease-in-out infinite' }}></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/5"></div>
                </div>

                {/* Level markers */}
                {[25, 50, 75].map(mark => (
                    <div key={mark} className="absolute left-0 right-0 flex items-center" style={{ bottom: `${mark}%` }}>
                        <div className="w-2 border-t border-dashed border-slate-600/50"></div>
                        <span className="text-[9px] text-slate-600 ml-1 font-mono">{mark}%</span>
                    </div>
                ))}

                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-white font-bold text-xl drop-shadow-lg">{tank.name}</p>
                    <p className="text-white/60 text-xs font-mono">{level.toFixed(1)}%</p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-xs text-text-secondary">Kapasitas: {tank.capacity}</p>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fillColor }}></span>
                    <span className="text-xs font-medium" style={{ color: fillColor }}>{tank.name}</span>
                </div>
            </div>
        </div>
    );
}

export default function TankLevelPage() {
    const { operator, canInputTank } = useOperator();
    const { currentLevels, flowRates } = useTankData();
    const router = useRouter();

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    if (!operator) return null;

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-xl">
                        <span className="material-symbols-outlined text-primary text-2xl">propane_tank</span>
                    </div>
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white">Tank Level</h2>
                        <p className="text-text-secondary text-sm mt-1">Monitoring level tank DEMIN, RCW, dan SOLAR</p>
                    </div>
                </div>
                {canInputTank && (
                    <button
                        onClick={() => router.push('/input')}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-primary/20 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">add_circle</span>
                        Tambah Input
                    </button>
                )}
            </header>

            {/* Tank gauges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TANK_IDS.map(tankId => {
                    const data = currentLevels[tankId];
                    return <TankGauge key={tankId} tankId={tankId} level={data.level} />;
                })}
            </div>

            {/* Flow rates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TANK_IDS.map(tankId => {
                    const tank = TANKS[tankId];
                    const tc = TANK_COLORS[tankId] || TANK_COLORS.DEMIN;
                    const flows = flowRates[tankId] || [];
                    return (
                        <div key={tankId} className="bg-surface-dark border border-slate-800 rounded-xl p-5">
                            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base" style={{ color: tc.bar }}>{tc.icon}</span>
                                Flow — {tank.name}
                            </h4>
                            {flows.length > 0 ? (
                                <div className="space-y-2">
                                    {flows.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between p-2.5 bg-surface-highlight/30 rounded-lg border border-slate-700/50">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tc.bar }} />
                                                <span className="text-text-secondary text-sm">{f.sourceLabel}</span>
                                            </div>
                                            <span className="font-bold text-white tabular-nums">{f.rate.toFixed(1)} <span className="text-xs text-slate-400 font-normal">t/h</span></span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-text-secondary/60 italic">
                                    {tankId === 'SOLAR' ? 'Manual unloading truk' : 'Belum ada data flow'}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Trend placeholder */}
            <div className="bg-surface-dark border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">show_chart</span>
                    Trend Level 24 Jam
                </h3>
                <div className="h-48 flex items-center justify-center text-text-secondary/40 text-sm">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-5xl mb-2 block">timeline</span>
                        Grafik trend akan tampil di sini
                    </div>
                </div>
            </div>
        </div>
    );
}
