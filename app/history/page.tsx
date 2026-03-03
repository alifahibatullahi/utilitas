'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';

const PARAMETERS = [
    { id: 'steam', label: 'Steam', color: '#2b7cee', icon: 'air' },
    { id: 'coal', label: 'Batubara', color: '#f59e0b', icon: 'local_fire_department' },
    { id: 'load', label: 'Load MW', color: '#8b5cf6', icon: 'electric_bolt' },
    { id: 'tank', label: 'Tank Level', color: '#22c55e', icon: 'propane_tank' },
    { id: 'temp', label: 'Temperatur', color: '#ef4444', icon: 'thermometer' },
];

const HISTORY_TABLE = [
    { date: '25 Feb 2026', steamA: 2100, steamB: 2050, coal: 720, load: 12.3, demin: 72 },
    { date: '24 Feb 2026', steamA: 2080, steamB: 2030, coal: 710, load: 12.1, demin: 68 },
    { date: '23 Feb 2026', steamA: 2120, steamB: 2060, coal: 725, load: 12.4, demin: 70 },
    { date: '22 Feb 2026', steamA: 2050, steamB: 2000, coal: 700, load: 11.9, demin: 65 },
    { date: '21 Feb 2026', steamA: 2110, steamB: 2040, coal: 715, load: 12.2, demin: 74 },
    { date: '20 Feb 2026', steamA: 2090, steamB: 2020, coal: 705, load: 12.0, demin: 71 },
];

export default function HistoryPage() {
    const { operator } = useOperator();
    const router = useRouter();
    const [dateFrom, setDateFrom] = useState('2026-02-20');
    const [dateTo, setDateTo] = useState('2026-02-25');
    const [selectedParams, setSelectedParams] = useState(['steam', 'load']);

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    if (!operator) return null;

    const toggleParam = (id: string) => {
        setSelectedParams(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-6">
            {/* Header */}
            <header className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-xl">
                    <span className="material-symbols-outlined text-primary text-2xl">history</span>
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-white">History & Trend</h2>
                    <p className="text-text-secondary text-sm mt-1">Analisis data historis dan tren multi-parameter</p>
                </div>
            </header>

            {/* Filters */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 p-5">
                <div className="flex flex-wrap items-end gap-4 mb-4">
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Dari</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Sampai</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-text-secondary mb-2 uppercase tracking-wider">Parameter</label>
                    <div className="flex flex-wrap gap-2">
                        {PARAMETERS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => toggleParam(p.id)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border"
                                style={selectedParams.includes(p.id) ? {
                                    backgroundColor: `${p.color}20`,
                                    borderColor: `${p.color}50`,
                                    color: p.color,
                                } : {
                                    backgroundColor: 'transparent',
                                    borderColor: '#1e293b',
                                    color: '#64748b',
                                }}
                            >
                                <span className="material-symbols-outlined text-sm">{p.icon}</span>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">show_chart</span>
                    Grafik Trend
                </h3>
                <div className="h-64 flex items-center justify-center">
                    <div className="relative w-full max-w-lg mx-auto h-48 border-l-2 border-b-2 border-slate-700/50">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className="absolute left-0 right-0 border-t border-slate-800/50" style={{ bottom: `${(i + 1) * 25}%` }} />
                        ))}
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                            <polyline points="0,80 66,75 133,60 200,65 266,50 333,55 400,45" fill="none" stroke="#2b7cee" strokeWidth="2" opacity="0.8" />
                            <polyline points="0,120 66,110 133,130 200,125 266,115 333,120 400,110" fill="none" stroke="#8b5cf6" strokeWidth="2" opacity="0.8" />
                        </svg>
                        <div className="absolute -bottom-8 left-0 right-0 flex justify-center gap-4">
                            {selectedParams.map(pid => {
                                const p = PARAMETERS.find(x => x.id === pid);
                                if (!p) return null;
                                return (
                                    <div key={pid} className="flex items-center gap-1">
                                        <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: p.color }} />
                                        <span className="text-[10px] text-text-secondary">{p.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary table */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 p-5 overflow-x-auto">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">table_chart</span>
                    Tabel Ringkasan Harian
                </h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-700/50">
                            <th className="text-left text-xs text-text-secondary uppercase tracking-wider pb-3">Tanggal</th>
                            <th className="text-center text-xs text-text-secondary uppercase tracking-wider pb-3">Steam A</th>
                            <th className="text-center text-xs text-text-secondary uppercase tracking-wider pb-3">Steam B</th>
                            <th className="text-center text-xs text-text-secondary uppercase tracking-wider pb-3">Coal</th>
                            <th className="text-center text-xs text-text-secondary uppercase tracking-wider pb-3">Load MW</th>
                            <th className="text-center text-xs text-text-secondary uppercase tracking-wider pb-3">DEMIN %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {HISTORY_TABLE.map(row => (
                            <tr key={row.date} className="hover:bg-surface-highlight/50 transition-colors">
                                <td className="py-2.5 text-slate-300 text-sm">{row.date}</td>
                                <td className="py-2.5 text-center text-white font-medium tabular-nums">{row.steamA.toLocaleString()}</td>
                                <td className="py-2.5 text-center text-white font-medium tabular-nums">{row.steamB.toLocaleString()}</td>
                                <td className="py-2.5 text-center text-white font-medium tabular-nums">{row.coal}</td>
                                <td className="py-2.5 text-center text-primary font-medium tabular-nums">{row.load}</td>
                                <td className="py-2.5 text-center text-emerald-400 font-medium tabular-nums">{row.demin}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button className="px-5 py-3 bg-surface-dark text-white text-sm font-medium rounded-xl border border-slate-800 hover:bg-surface-highlight transition-all cursor-pointer flex items-center gap-2">
                <span className="material-symbols-outlined text-base">table_chart</span>
                Export Excel
            </button>
        </div>
    );
}
