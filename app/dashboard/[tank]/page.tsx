'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AppHeader from '@/components/ui/AppHeader';
import HistoryTable from '@/components/ui/HistoryTable';
import { useOperator } from '@/hooks/useOperator';
import { useTankData } from '@/hooks/useTankData';
import { TANKS, TankId, TANK_IDS } from '@/lib/constants';
import { getAlertStatus } from '@/lib/utils';

export default function TankDetailPage({ params }: { params: Promise<{ tank: string }> }) {
    const { tank: tankSlug } = use(params);
    const { operator } = useOperator();
    const { currentLevels, history } = useTankData();
    const router = useRouter();

    // Find tank by slug (lowercase id)
    const tankId = TANK_IDS.find(t => t.toLowerCase() === tankSlug.toLowerCase()) as TankId | undefined;
    const tank = tankId ? TANKS[tankId] : null;

    useEffect(() => {
        if (!operator) {
            router.push('/');
        }
    }, [operator, router]);

    if (!operator || !tank || !tankId) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-slate-400 text-lg">Tank tidak ditemukan</p>
                    <button onClick={() => router.push('/dashboard')} className="mt-4 text-cyan-400 hover:text-cyan-300 cursor-pointer">
                        ← Kembali ke Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const data = currentLevels[tankId];
    const tankHistory = history
        .filter(h => h.tankId === tankId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const alertStatus = getAlertStatus(data.level);

    // Real trend from DB history
    const detailedTrend = tankHistory.map(h => ({
        time: new Date(h.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }),
        level: h.level,
    }));

    // Stats from real data
    const levels = tankHistory.map(h => h.level);
    const minLevel = levels.length ? Math.min(...levels) : data.level;
    const maxLevel = levels.length ? Math.max(...levels) : data.level;
    const avgLevel = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : data.level;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            <AppHeader />

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Back button */}
                <button
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 transition-colors cursor-pointer"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    <span className="text-sm">Kembali ke Dashboard</span>
                </button>

                {/* Tank header */}
                <div className="flex items-center gap-4 mb-6">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${tank.liquidColor}20` }}
                    >
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: tank.liquidColor }} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{tank.name}</h1>
                        <p className="text-sm text-slate-400">Kapasitas: {tank.capacity}</p>
                    </div>
                    <div className="ml-auto text-right">
                        <p className="text-3xl font-bold text-white">{data.level.toFixed(1)}%</p>
                        <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${alertStatus === 'critical'
                                ? 'bg-red-500/20 text-red-400'
                                : alertStatus === 'warning'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-green-500/20 text-green-400'
                                }`}
                        >
                            {alertStatus === 'critical' ? '⚠️ CRITICAL' : alertStatus === 'warning' ? '⚡ WARNING' : '✅ NORMAL'}
                        </span>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {[
                        { label: 'Level Saat Ini', value: `${data.level.toFixed(1)}%`, color: tank.liquidColor },
                        { label: `Min (${levels.length} data)`, value: `${minLevel.toFixed(1)}%`, color: '#94a3b8' },
                        { label: `Max (${levels.length} data)`, value: `${maxLevel.toFixed(1)}%`, color: '#94a3b8' },
                        { label: 'Rata-rata', value: `${avgLevel.toFixed(1)}%`, color: '#94a3b8' },
                    ].map((item) => (
                        <div key={item.label} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                            <p className="text-xs text-slate-400">{item.label}</p>
                            <p className="text-lg font-bold mt-1" style={{ color: item.color }}>{item.value}</p>
                        </div>
                    ))}
                </div>

                {/* Input sources */}
                {tank.inputSources.length > 0 && (
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 mb-6">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Input Sources</p>
                        <div className="flex flex-wrap gap-2">
                            {tank.inputSources.map((source) => (
                                <span
                                    key={source}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                                    style={{
                                        backgroundColor: `${tank.liquidColor}15`,
                                        color: tank.liquidColor,
                                        border: `1px solid ${tank.liquidColor}30`,
                                    }}
                                >
                                    ⚡ {source}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Output destinations */}
                {tank.outputDestinations.length > 0 && (
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 mb-6">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Output Destinations</p>
                        <div className="space-y-2">
                            {tank.outputDestinations.map((dest) => (
                                <div key={dest.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/30 border border-slate-600/30">
                                    <span className="text-sm text-slate-300 font-medium">{dest.name}</span>
                                    <div className="flex items-center gap-2">
                                        {dest.hasFlow ? (
                                            <span className="text-xs text-emerald-400 font-medium">Flow ✓</span>
                                        ) : (
                                            <span className="text-[10px] text-slate-500 italic">tanpa flow</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {/* Show pump choices if applicable */}
                            {tank.outputDestinations.filter(d => d.pumps).map(dest => (
                                <div key={`pumps-${dest.name}`} className="ml-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-xs text-slate-500">engineering</span>
                                    <span className="text-[11px] text-slate-400">Pompa {dest.name}: {dest.pumps!.join(' / ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Trend chart */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-slate-200">📈 Trend Level ({tankHistory.length} data terakhir)</h2>
                    </div>
                    {detailedTrend.length === 0 ? (
                        <div className="h-32 flex items-center justify-center text-slate-500 text-sm italic">Belum ada data historis</div>
                    ) : (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={detailedTrend}>
                                <defs>
                                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={tank.liquidColor} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={tank.liquidColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                                <XAxis
                                    dataKey="time"
                                    stroke="#64748b"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    stroke="#64748b"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `${v}%`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        border: '1px solid rgba(148, 163, 184, 0.3)',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        color: '#f8fafc',
                                    }}
                                    formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Level']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="level"
                                    stroke={tank.liquidColor}
                                    strokeWidth={2}
                                    fill="url(#areaGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    )}
                </div>

                {/* History table */}
                <HistoryTable data={tankHistory} maxRows={50} showTankColumn={false} />
            </main>
        </div>
    );
}

