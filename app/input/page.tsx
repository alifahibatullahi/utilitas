'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/ui/AppHeader';
import TankSelector from '@/components/input/TankSelector';
import Toast from '@/components/ui/Toast';
import { useOperator } from '@/hooks/useOperator';
import { useTankData, FlowRate } from '@/hooks/useTankData';
import { TankId, TANKS } from '@/lib/constants';
import { useEffect } from 'react';

export default function InputPage() {
    const { operator, isHandling } = useOperator();
    const { submitLevel, submitFlowRates, currentLevels, flowRates } = useTankData();
    const router = useRouter();

    const [selectedTank, setSelectedTank] = useState<TankId | null>(null);
    const [level, setLevel] = useState('');
    const [note, setNote] = useState('');
    const [flowInputs, setFlowInputs] = useState<Record<string, string>>({});
    const [showToast, setShowToast] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // When a tank is selected, prefill with last known level and flow rates
    const handleTankSelect = (tankId: TankId) => {
        setSelectedTank(tankId);
        const lastLevel = currentLevels[tankId]?.level;
        if (lastLevel !== undefined && lastLevel !== null) {
            setLevel(lastLevel.toFixed(1));
        }
        // Prefill flow rates from last known values
        const lastFlows = flowRates[tankId] || [];
        const newFlowInputs: Record<string, string> = {};
        lastFlows.forEach((f) => {
            newFlowInputs[f.sourceLabel] = f.rate.toFixed(1);
        });
        setFlowInputs(newFlowInputs);
    };

    // Redirect if not handling
    useEffect(() => {
        if (!operator) {
            router.push('/');
        } else if (!isHandling) {
            router.push('/dashboard');
        }
    }, [operator, isHandling, router]);

    const handleSubmit = () => {
        if (!selectedTank || !level || !operator) return;
        const numLevel = parseFloat(level);
        if (isNaN(numLevel) || numLevel < 0 || numLevel > 100) return;

        setIsSubmitting(true);
        // Simulate API call delay
        setTimeout(() => {
            submitLevel(selectedTank, numLevel, operator.name, note || undefined);

            // Submit flow rates if DEMIN or RCW
            const sources = TANKS[selectedTank].flowSources;
            if (sources.length > 0) {
                const rates: FlowRate[] = sources
                    .map((src) => ({
                        sourceLabel: src,
                        rate: parseFloat(flowInputs[src] || '0') || 0,
                    }))
                    .filter((r) => r.rate > 0);
                if (rates.length > 0) {
                    submitFlowRates(selectedTank, rates);
                }
            }

            setShowToast(true);
            setIsSubmitting(false);
            setTimeout(() => {
                router.push('/dashboard');
            }, 1500);
        }, 500);
    };

    if (!operator || !isHandling) return null;

    const isValid = selectedTank && level && !isNaN(parseFloat(level)) && parseFloat(level) >= 0 && parseFloat(level) <= 100;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            <AppHeader />

            <main className="max-w-lg mx-auto px-4 py-6">
                {/* Back button */}
                <button
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 transition-colors cursor-pointer"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    <span className="text-sm">Kembali ke Dashboard</span>
                </button>

                {/* Title */}
                <div className="mb-6">
                    <h1 className="text-xl font-bold text-white">Input Level Tank</h1>
                    <p className="text-sm text-slate-400 mt-1">Pilih tank dan masukkan level saat ini</p>
                </div>

                {/* Tank selector */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-3">Pilih Tank</label>
                    <TankSelector selected={selectedTank} onSelect={handleTankSelect} />
                </div>

                {/* Level input */}
                <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Level (%)</label>
                    {selectedTank && currentLevels[selectedTank] && (
                        <p className="text-xs text-slate-500 mb-2">
                            Input terakhir: <span className="text-slate-300 font-medium">{currentLevels[selectedTank].level.toFixed(1)}%</span>
                            <span className="text-slate-600"> — oleh {currentLevels[selectedTank].operator}</span>
                        </p>
                    )}
                    <div className="relative">
                        <input
                            type="number"
                            value={level}
                            onChange={(e) => setLevel(e.target.value)}
                            placeholder={selectedTank ? currentLevels[selectedTank]?.level.toFixed(1) : '0.0'}
                            min="0"
                            max="100"
                            step="0.1"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl
                text-3xl font-bold text-white text-center
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                placeholder:text-slate-600 appearance-none"
                            style={selectedTank ? {
                                borderColor: `${TANKS[selectedTank].liquidColor}50`,
                            } : {}}
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500">%</span>
                    </div>
                    {level && (parseFloat(level) < 0 || parseFloat(level) > 100) && (
                        <p className="text-red-400 text-xs mt-1.5">Level harus antara 0% – 100%</p>
                    )}
                </div>

                {/* Flow rate inputs (DEMIN & RCW only) */}
                {selectedTank && TANKS[selectedTank].flowSources.length > 0 && (
                    <div className="mb-5">
                        <label className="block text-sm font-medium text-slate-300 mb-2">Flow Rate (ton/h)</label>
                        <div className="space-y-3">
                            {TANKS[selectedTank].flowSources.map((source) => {
                                const lastRate = flowRates[selectedTank]?.find(f => f.sourceLabel === source);
                                return (
                                    <div key={source}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: TANKS[selectedTank].liquidColor }}
                                            />
                                            <span className="text-xs text-slate-400">{source}</span>
                                            {lastRate && (
                                                <span className="text-[10px] text-slate-600 ml-auto">
                                                    terakhir: {lastRate.rate.toFixed(1)} ton/h
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={flowInputs[source] || ''}
                                                onChange={(e) => setFlowInputs(prev => ({ ...prev, [source]: e.target.value }))}
                                                placeholder={lastRate ? lastRate.rate.toFixed(1) : '0.0'}
                                                min="0"
                                                step="0.1"
                                                className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600/50 rounded-xl
                                                    text-xl font-bold text-white text-center
                                                    focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                                                    placeholder:text-slate-600 appearance-none"
                                                style={{ borderColor: `${TANKS[selectedTank].liquidColor}30` }}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">ton/h</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Note input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Catatan <span className="text-slate-500 font-normal">(opsional, max 100 karakter)</span>
                    </label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value.slice(0, 100))}
                        placeholder="Contoh: Setelah pengisian dari truk..."
                        maxLength={100}
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600/50 rounded-xl text-sm text-slate-200
              focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
              placeholder:text-slate-600 resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-1 text-right">{note.length}/100</p>
                </div>

                {/* Submit button */}
                <button
                    onClick={handleSubmit}
                    disabled={!isValid || isSubmitting}
                    className={`w-full py-4 rounded-xl text-lg font-bold transition-all duration-300 cursor-pointer
            ${isValid && !isSubmitting
                            ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.01] active:scale-[0.99]'
                            : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                        }`}
                >
                    {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            Menyimpan...
                        </span>
                    ) : (
                        '💾 SIMPAN'
                    )}
                </button>
            </main>

            {/* Toast */}
            {showToast && (
                <Toast
                    message="Level berhasil disimpan! Mengalihkan ke dashboard..."
                    type="success"
                    onClose={() => setShowToast(false)}
                />
            )}
        </div>
    );
}
