'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { createClient } from '@/lib/supabase/client';
import { TANKS, TANK_IDS, TankId } from '@/lib/constants';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from 'recharts';
import type { TankLevelRow } from '@/lib/supabase/types';

const TANK_COLORS: Record<TankId, string> = {
    DEMIN: '#0ea5e9',
    RCW:   '#14b8a6',
    SOLAR: '#f59e0b',
};

interface LevelRecord {
    id: string;
    tank_id: TankId;
    level_pct: number;
    level_m3: number;
    operator_name: string;
    note: string | null;
    created_at: string;
}

// Group records by rounded 30-min interval for chart
function buildChartData(records: LevelRecord[]) {
    const map = new Map<string, Record<string, number>>();
    const sorted = [...records].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (const r of sorted) {
        const d = new Date(r.created_at);
        // Round to nearest hour for chart readability
        d.setMinutes(0, 0, 0);
        const key = d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
        if (!map.has(key)) map.set(key, { time: key as unknown as number });
        const entry = map.get(key)!;
        entry[r.tank_id] = r.level_pct;
    }
    return Array.from(map.values());
}

export default function HistoryPage() {
    const { operator } = useOperator();
    const router = useRouter();

    // Default: last 7 days
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const [dateFrom, setDateFrom] = useState(fmt(weekAgo));
    const [dateTo, setDateTo] = useState(fmt(today));
    const [selectedTanks, setSelectedTanks] = useState<TankId[]>(['DEMIN', 'RCW', 'SOLAR']);
    const [records, setRecords] = useState<LevelRecord[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('tank_levels')
                .select('*')
                .gte('created_at', `${dateFrom}T00:00:00`)
                .lte('created_at', `${dateTo}T23:59:59`)
                .order('created_at', { ascending: false })
                .limit(500);

            if (!error && data) {
                setRecords((data as unknown as TankLevelRow[]).map(r => ({
                    id: r.id,
                    tank_id: r.tank_id as TankId,
                    level_pct: Number(r.level_pct),
                    level_m3: Number(r.level_m3),
                    operator_name: r.operator_name,
                    note: r.note,
                    created_at: r.created_at,
                })));
            }
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => {
        if (operator) fetchData();
    }, [operator, fetchData]);

    if (!operator) return null;

    const filtered = records.filter(r => selectedTanks.includes(r.tank_id));
    const chartData = buildChartData(filtered);

    const toggleTank = (t: TankId) => setSelectedTanks(prev =>
        prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-6">
            {/* Header */}
            <header className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-xl">
                        <span className="material-symbols-outlined text-primary text-2xl">history</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-white">History & Trend Tank Level</h2>
                        <p className="text-text-secondary text-sm mt-1">Data historis level DEMIN, RCW, dan Solar dari database</p>
                    </div>
                </div>
                <button onClick={() => router.push('/dashboard')}
                    className="flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Dashboard
                </button>
            </header>

            {/* Filters */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 p-5">
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Dari</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Sampai</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Tank</label>
                        <div className="flex gap-2">
                            {TANK_IDS.map(t => (
                                <button key={t} onClick={() => toggleTank(t)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border"
                                    style={selectedTanks.includes(t) ? {
                                        backgroundColor: `${TANK_COLORS[t]}20`,
                                        borderColor: `${TANK_COLORS[t]}50`,
                                        color: TANK_COLORS[t],
                                    } : {
                                        backgroundColor: 'transparent',
                                        borderColor: '#1e293b',
                                        color: '#64748b',
                                    }}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-base">refresh</span>
                        Tampilkan
                    </button>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">show_chart</span>
                    Trend Level (%)
                    {loading && <span className="text-xs text-slate-500 font-normal ml-2">Memuat...</span>}
                </h3>
                {chartData.length > 0 ? (
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    {TANK_IDS.map(t => (
                                        <linearGradient key={t} id={`grad-${t}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={TANK_COLORS[t]} stopOpacity={0.25} />
                                            <stop offset="100%" stopColor={TANK_COLORS[t]} stopOpacity={0} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false}
                                    interval="preserveStartEnd" />
                                <YAxis domain={[0, 100]} stroke="#475569" fontSize={11} tickLine={false} axisLine={false}
                                    tickFormatter={v => `${v}%`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', fontSize: '12px', color: '#f8fafc' }}
                                    formatter={(v: number | undefined, name: string | undefined) => [`${(v ?? 0).toFixed(1)}%`, name ?? '']}
                                />
                                <Legend />
                                {TANK_IDS.filter(t => selectedTanks.includes(t)).map(t => (
                                    <Area key={t} type="monotone" dataKey={t} name={TANKS[t].name}
                                        stroke={TANK_COLORS[t]} strokeWidth={2}
                                        fill={`url(#grad-${t})`} connectNulls dot={false} />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
                        {loading ? 'Memuat data...' : 'Tidak ada data untuk rentang tanggal ini.'}
                    </div>
                )}
            </div>

            {/* History Table */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 p-5 overflow-x-auto">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">table_chart</span>
                        Riwayat Inputan
                    </span>
                    <span className="text-xs text-slate-500 font-normal">{filtered.length} record</span>
                </h3>
                {filtered.length > 0 ? (
                    <table className="w-full text-sm min-w-[600px]">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-left text-xs text-text-secondary uppercase tracking-wider pb-3 pr-4">Waktu</th>
                                <th className="text-left text-xs text-text-secondary uppercase tracking-wider pb-3 pr-4">Tank</th>
                                <th className="text-center text-xs text-text-secondary uppercase tracking-wider pb-3 pr-4">Level %</th>
                                <th className="text-center text-xs text-text-secondary uppercase tracking-wider pb-3 pr-4">Volume m³</th>
                                <th className="text-left text-xs text-text-secondary uppercase tracking-wider pb-3 pr-4">Operator</th>
                                <th className="text-left text-xs text-text-secondary uppercase tracking-wider pb-3">Catatan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {filtered.map(row => {
                                const tc = TANK_COLORS[row.tank_id];
                                const dt = new Date(row.created_at);
                                return (
                                    <tr key={row.id} className="hover:bg-surface-highlight/40 transition-colors">
                                        <td className="py-2.5 pr-4 text-slate-400 text-xs tabular-nums whitespace-nowrap">
                                            {dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                                            <span className="text-slate-500">{dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                        </td>
                                        <td className="py-2.5 pr-4">
                                            <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase"
                                                style={{ backgroundColor: `${tc}20`, color: tc, border: `1px solid ${tc}40` }}>
                                                {row.tank_id}
                                            </span>
                                        </td>
                                        <td className="py-2.5 pr-4 text-center font-mono font-bold tabular-nums" style={{ color: tc }}>
                                            {row.level_pct.toFixed(1)}%
                                        </td>
                                        <td className="py-2.5 pr-4 text-center text-white font-mono font-semibold tabular-nums">
                                            {row.level_m3.toLocaleString('id-ID')} m³
                                        </td>
                                        <td className="py-2.5 pr-4 text-slate-300 text-xs">{row.operator_name}</td>
                                        <td className="py-2.5 text-slate-500 text-xs italic">{row.note ?? '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-sm text-slate-500 italic py-4">
                        {loading ? 'Memuat...' : 'Tidak ada data untuk filter ini.'}
                    </p>
                )}
            </div>
        </div>
    );
}
