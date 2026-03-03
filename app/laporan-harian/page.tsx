'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';

const DAILY_DATA = {
    date: '2026-02-24',
    isFinalized: true,
    totalSteamA: 2100,
    totalSteamB: 2050,
    totalCoal: 720,
    avgLoadMW: 12.3,
    totalSteamPabrik1: 360,
    totalSteamPabrik3: 300,
    totalCondensate: 2040,
    shifts: [
        { shift: 'A', operator: 'Budi Santoso', steamA: 45.2, steamB: 42.8, coal: 240, loadMW: 12.5, status: 'approved' },
        { shift: 'B', operator: 'Rizky Pratama', steamA: 44.0, steamB: 41.5, coal: 235, loadMW: 12.0, status: 'approved' },
        { shift: 'C', operator: 'Eko Prasetyo', steamA: 43.5, steamB: 42.0, coal: 245, loadMW: 12.3, status: 'approved' },
    ],
};

function SummaryCard({ label, value, unit, icon, color = 'text-white' }: { label: string; value: string; unit: string; icon: string; color?: string }) {
    return (
        <div className="bg-surface-dark rounded-xl p-4 border border-slate-800">
            <div className="flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-sm text-text-secondary">{icon}</span>
                <p className="text-[10px] text-text-secondary uppercase tracking-wider">{label}</p>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>
                {value} <span className="text-xs text-slate-400 font-normal">{unit}</span>
            </p>
        </div>
    );
}

export default function LaporanHarianPage() {
    const { operator, isAdmin } = useOperator();
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState('2026-02-24');

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    if (!operator) return null;

    const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-6">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-xl">
                        <span className="material-symbols-outlined text-primary text-2xl">calendar_month</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-white">Laporan Harian</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-text-secondary">{formatDate(selectedDate)}</span>
                            {DAILY_DATA.isFinalized && (
                                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold rounded-full flex items-center gap-1 border border-emerald-500/30">
                                    <span className="material-symbols-outlined text-xs">lock</span> Finalized
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {isAdmin && DAILY_DATA.isFinalized && (
                    <button className="px-3 py-2 text-xs font-medium bg-amber-500/15 text-amber-400 rounded-lg border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">lock_open</span>
                        Unlock (Admin)
                    </button>
                )}
            </header>

            {/* Date navigation */}
            <div className="flex items-center justify-center gap-3">
                <button
                    onClick={() => setSelectedDate('2026-02-23')}
                    className="px-3 py-1.5 bg-surface-dark text-text-secondary rounded-lg border border-slate-800 hover:bg-surface-highlight text-sm cursor-pointer transition-all flex items-center gap-1"
                >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                    23 Feb
                </button>
                <div className="px-4 py-2 bg-primary/10 text-primary rounded-xl border border-primary/30 text-sm font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    {formatDate(selectedDate)}
                </div>
                <button
                    onClick={() => setSelectedDate('2026-02-25')}
                    className="px-3 py-1.5 bg-surface-dark text-text-secondary rounded-lg border border-slate-800 hover:bg-surface-highlight text-sm cursor-pointer transition-all flex items-center gap-1"
                >
                    25 Feb
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <SummaryCard label="Total Steam A+B" value={(DAILY_DATA.totalSteamA + DAILY_DATA.totalSteamB).toLocaleString()} unit="ton" icon="air" />
                <SummaryCard label="Total Batubara" value={DAILY_DATA.totalCoal.toLocaleString()} unit="ton" icon="local_fire_department" />
                <SummaryCard label="Rata-rata Load" value={DAILY_DATA.avgLoadMW.toFixed(1)} unit="MW" icon="electric_bolt" color="text-primary" />
                <SummaryCard label="Steam ke Pabrik" value={(DAILY_DATA.totalSteamPabrik1 + DAILY_DATA.totalSteamPabrik3).toLocaleString()} unit="ton" icon="factory" />
            </div>

            {/* Shift comparison table */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 p-5 overflow-x-auto">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">compare</span>
                    Perbandingan 3 Shift
                </h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-700/50">
                            <th className="text-left text-xs text-text-secondary uppercase tracking-wider pb-3 pr-4">Parameter</th>
                            {DAILY_DATA.shifts.map(s => (
                                <th key={s.shift} className="text-center text-xs text-text-secondary uppercase tracking-wider pb-3 px-3">
                                    Shift {s.shift}
                                </th>
                            ))}
                            <th className="text-center text-xs text-text-secondary uppercase tracking-wider pb-3 pl-3">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        <tr>
                            <td className="py-2.5 text-text-secondary pr-4">Steam A (t/h)</td>
                            {DAILY_DATA.shifts.map(s => <td key={s.shift} className="py-2.5 text-center text-white font-medium tabular-nums">{s.steamA}</td>)}
                            <td className="py-2.5 text-center text-text-secondary/50">—</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 text-text-secondary pr-4">Steam B (t/h)</td>
                            {DAILY_DATA.shifts.map(s => <td key={s.shift} className="py-2.5 text-center text-white font-medium tabular-nums">{s.steamB}</td>)}
                            <td className="py-2.5 text-center text-text-secondary/50">—</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 text-text-secondary pr-4">Total Coal (ton)</td>
                            {DAILY_DATA.shifts.map(s => <td key={s.shift} className="py-2.5 text-center text-white font-medium tabular-nums">{s.coal}</td>)}
                            <td className="py-2.5 text-center text-primary font-bold tabular-nums">{DAILY_DATA.totalCoal}</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 text-text-secondary pr-4">Load MW</td>
                            {DAILY_DATA.shifts.map(s => <td key={s.shift} className="py-2.5 text-center text-primary font-medium tabular-nums">{s.loadMW}</td>)}
                            <td className="py-2.5 text-center text-text-secondary/50">—</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 text-text-secondary pr-4">Operator</td>
                            {DAILY_DATA.shifts.map(s => <td key={s.shift} className="py-2.5 text-center text-slate-300 text-xs">{s.operator.split(' ')[0]}</td>)}
                            <td className="py-2.5" />
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Chart placeholder */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">show_chart</span>
                        Grafik 24 Jam
                    </h3>
                    <div className="flex gap-1.5">
                        {['Steam', 'Batubara', 'Load MW'].map(label => (
                            <button key={label} className="px-2.5 py-1 bg-surface-highlight text-text-secondary text-[10px] rounded-md border border-slate-700/50 hover:bg-slate-700 cursor-pointer transition-all">
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="h-48 flex items-center justify-center text-text-secondary/40 text-sm">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-5xl mb-2 block">timeline</span>
                        Grafik 24 jam akan tampil di sini
                    </div>
                </div>
            </div>

            {/* Export buttons */}
            <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-xl text-sm font-semibold bg-surface-dark text-white border border-slate-800 hover:bg-surface-highlight transition-all cursor-pointer flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                    Export PDF
                </button>
                <button className="flex-1 py-3 rounded-xl text-sm font-semibold bg-surface-dark text-white border border-slate-800 hover:bg-surface-highlight transition-all cursor-pointer flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-base">table_chart</span>
                    Export Excel
                </button>
            </div>
        </div>
    );
}
