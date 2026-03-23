'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/ui/AppHeader';
import Toast from '@/components/ui/Toast';
import { useOperator } from '@/hooks/useOperator';
import { TANK_IDS, TankId, TANKS, TOTALISER_SOURCES } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/utils';

// Dummy totaliser records
interface TotaliserRecord {
    id: number;
    date: string;
    tankId: TankId;
    sourceId: string;
    sourceLabel: string;
    value: number;
    operator: string;
    timestamp: string;
}

const dummyRecords: TotaliserRecord[] = [
    { id: 1, date: '2025-02-24', tankId: 'DEMIN', sourceId: 'demin_utilitas1', sourceLabel: 'Utilitas 1', value: 15420, operator: 'Budi Santoso', timestamp: '2025-02-24T23:00:00' },
    { id: 2, date: '2025-02-24', tankId: 'DEMIN', sourceId: 'demin_3a', sourceLabel: 'Demin 3A', value: 8230, operator: 'Budi Santoso', timestamp: '2025-02-24T23:00:00' },
    { id: 3, date: '2025-02-24', tankId: 'RCW', sourceId: 'rcw_utilitas1', sourceLabel: 'Utilitas 1', value: 22100, operator: 'Ahmad Fauzi', timestamp: '2025-02-24T23:00:00' },
    { id: 4, date: '2025-02-24', tankId: 'SOLAR', sourceId: 'solar_unloading', sourceLabel: 'Unloading Truk', value: 5600, operator: 'Dewi Kartika', timestamp: '2025-02-24T23:00:00' },
    { id: 5, date: '2025-02-23', tankId: 'DEMIN', sourceId: 'demin_utilitas1', sourceLabel: 'Utilitas 1', value: 15200, operator: 'Budi Santoso', timestamp: '2025-02-23T23:00:00' },
    { id: 6, date: '2025-02-23', tankId: 'DEMIN', sourceId: 'demin_3a', sourceLabel: 'Demin 3A', value: 8100, operator: 'Budi Santoso', timestamp: '2025-02-23T23:00:00' },
    { id: 7, date: '2025-02-23', tankId: 'RCW', sourceId: 'rcw_utilitas1', sourceLabel: 'Utilitas 1', value: 21850, operator: 'Ahmad Fauzi', timestamp: '2025-02-23T23:00:00' },
    { id: 8, date: '2025-02-23', tankId: 'SOLAR', sourceId: 'solar_unloading', sourceLabel: 'Unloading Truk', value: 5450, operator: 'Dewi Kartika', timestamp: '2025-02-23T23:00:00' },
];

export default function TotaliserPage() {
    const { operator, isHandling } = useOperator();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'input' | 'riwayat'>('input');
    const [records, setRecords] = useState(dummyRecords);
    const [showToast, setShowToast] = useState(false);

    // Form state for input tab
    const [inputDate, setInputDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [inputValues, setInputValues] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!operator) router.push('/');
        else if (!isHandling) router.push('/dashboard');
    }, [operator, isHandling, router]);

    if (!operator || !isHandling) return null;

    const handleSubmit = () => {
        const newRecords: TotaliserRecord[] = [];
        TANK_IDS.forEach((tankId) => {
            TOTALISER_SOURCES[tankId].forEach((source) => {
                const val = inputValues[source.id];
                if (val && !isNaN(parseFloat(val))) {
                    newRecords.push({
                        id: records.length + newRecords.length + 1,
                        date: inputDate,
                        tankId,
                        sourceId: source.id,
                        sourceLabel: source.label,
                        value: parseFloat(val),
                        operator: operator.name,
                        timestamp: new Date().toISOString(),
                    });
                }
            });
        });
        if (newRecords.length > 0) {
            setRecords(prev => [...newRecords, ...prev]);
            setInputValues({});
            setShowToast(true);
        }
    };

    // Calculate daily consumption
    const getDailyConsumption = (date: string, sourceId: string): number | null => {
        const today = records.find(r => r.date === date && r.sourceId === sourceId);
        // Find previous day
        const prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
        const yesterday = records.find(r => r.date === prevDateStr && r.sourceId === sourceId);
        if (today && yesterday) {
            return today.value - yesterday.value;
        }
        return null;
    };

    // Get unique dates
    const uniqueDates = [...new Set(records.map(r => r.date))].sort().reverse();

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            <AppHeader />

            <main className="max-w-4xl mx-auto px-4 py-6">
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

                {/* Title */}
                <div className="mb-6">
                    <h1 className="text-xl font-bold text-white">📊 Laporan Totaliser Harian</h1>
                    <p className="text-sm text-slate-400 mt-1">Input totaliser jam 23:00 dan lihat konsumsi harian</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl mb-6 border border-slate-700/30">
                    {(['input', 'riwayat'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                ${activeTab === tab
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            {tab === 'input' ? '📝 Input Totaliser' : '📋 Riwayat Harian'}
                        </button>
                    ))}
                </div>

                {/* Tab: Input */}
                {activeTab === 'input' && (
                    <div className="space-y-5">
                        {/* Date picker */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Tanggal Input</label>
                            <input
                                type="date"
                                value={inputDate}
                                onChange={(e) => setInputDate(e.target.value)}
                                className="px-4 py-2.5 bg-slate-800/80 border border-slate-600/50 rounded-xl text-slate-200
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                            />
                        </div>

                        {/* Per-tank input fields */}
                        {TANK_IDS.map((tankId) => {
                            const tank = TANKS[tankId];
                            const sources = TOTALISER_SOURCES[tankId];
                            return (
                                <div
                                    key={tankId}
                                    className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-5"
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: tank.liquidColor }}
                                        />
                                        <h3 className="text-base font-semibold text-white">{tank.name}</h3>
                                        <span className="text-xs text-slate-500">({tank.capacity})</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {sources.map((source) => (
                                            <div key={source.id}>
                                                <label className="block text-xs text-slate-400 mb-1">
                                                    {source.label} ({source.unit})
                                                </label>
                                                <input
                                                    type="number"
                                                    value={inputValues[source.id] || ''}
                                                    onChange={(e) => setInputValues(prev => ({ ...prev, [source.id]: e.target.value }))}
                                                    placeholder="0"
                                                    step="0.1"
                                                    className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-600/40 rounded-lg text-white text-lg font-semibold
                            focus:outline-none focus:ring-2 focus:ring-cyan-500/30 placeholder:text-slate-600"
                                                    style={{ borderColor: `${tank.liquidColor}30` }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl
                shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.005] active:scale-[0.995]
                transition-all duration-200 cursor-pointer"
                        >
                            💾 SIMPAN TOTALISER
                        </button>
                    </div>
                )}

                {/* Tab: Riwayat */}
                {activeTab === 'riwayat' && (
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-800/80">
                                        <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Tanggal</th>
                                        <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Tank</th>
                                        <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Sumber</th>
                                        <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Totaliser</th>
                                        <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Konsumsi Harian</th>
                                        <th className="text-left px-4 py-2.5 text-slate-400 font-medium hidden sm:table-cell">Operator</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/30">
                                    {records.map((row) => {
                                        const tank = TANKS[row.tankId];
                                        const consumption = getDailyConsumption(row.date, row.sourceId);
                                        return (
                                            <tr key={row.id} className="hover:bg-slate-700/20 transition-colors">
                                                <td className="px-4 py-2.5 text-slate-300">{formatDate(row.date)}</td>
                                                <td className="px-4 py-2.5">
                                                    <span
                                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                                                        style={{
                                                            backgroundColor: `${tank.liquidColor}20`,
                                                            color: tank.liquidColor,
                                                        }}
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tank.liquidColor }} />
                                                        {row.tankId}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-300 text-xs">{row.sourceLabel}</td>
                                                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-100">
                                                    {row.value.toLocaleString('id-ID')} m³
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono font-semibold">
                                                    {consumption !== null ? (
                                                        <span className={consumption >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                            {consumption >= 0 ? '+' : ''}{consumption.toLocaleString('id-ID')} m³
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-600">–</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-400 text-xs hidden sm:table-cell">{row.operator}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {showToast && (
                <Toast
                    message="Totaliser berhasil disimpan!"
                    type="success"
                    onClose={() => setShowToast(false)}
                />
            )}
        </div>
    );
}
