'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TankSelector from '@/components/input/TankSelector';
import Toast from '@/components/ui/Toast';
import { useOperator } from '@/hooks/useOperator';
import { useTankData, FlowRate, OutputFlowRate } from '@/hooks/useTankData';
import { TankId, TANKS } from '@/lib/constants';

export default function InputPage() {
    const { operator, isHandling } = useOperator();
    const { submitLevel, submitFlowRates, submitOutputFlowRates, submitSolarUnloading, currentLevels, flowRates, outputFlowRates: currentOutputFlowRates } = useTankData();
    const router = useRouter();

    const [selectedTank, setSelectedTank] = useState<TankId | null>(null);
    const [levelM3, setLevelM3] = useState('');
    const [note, setNote] = useState('');
    const [flowInputs, setFlowInputs] = useState<Record<string, string>>({});
    const [outputFlowInputs, setOutputFlowInputs] = useState<Record<string, string>>({});
    const [selectedPump, setSelectedPump] = useState<string>('');
    const [showToast, setShowToast] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Solar unloading fields
    const [solarDate, setSolarDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [solarLiters, setSolarLiters] = useState('');
    const [solarSupplier, setSolarSupplier] = useState('');

    const handleTankSelect = (tankId: TankId) => {
        setSelectedTank(tankId);
        const tankData = currentLevels[tankId];
        const capM3 = tankId === 'SOLAR' ? 200 : TANKS[tankId].capacityM3;
        if (tankData && tankData.operator !== '-' && tankData.level != null) {
            setLevelM3(Math.round(tankData.level / 100 * capM3).toString());
        } else {
            setLevelM3('');
        }
        const lastFlows = flowRates[tankId] || [];
        const newFlowInputs: Record<string, string> = {};
        lastFlows.forEach((f) => { newFlowInputs[f.sourceLabel] = f.rate.toFixed(1); });
        setFlowInputs(newFlowInputs);
        const lastOutputFlows = currentOutputFlowRates[tankId] || [];
        const newOutputInputs: Record<string, string> = {};
        lastOutputFlows.forEach((f) => {
            newOutputInputs[f.destinationLabel] = f.rate.toFixed(1);
            if (f.pump) setSelectedPump(f.pump);
        });
        setOutputFlowInputs(newOutputInputs);
    };

    useEffect(() => {
        if (!operator) {
            router.push('/');
        } else if (!isHandling) {
            router.push('/dashboard');
        }
    }, [operator, isHandling, router]);

    const handleSubmit = () => {
        if (!selectedTank || !levelM3 || !operator) return;
        const capM3 = selectedTank === 'SOLAR' ? 200 : TANKS[selectedTank].capacityM3;
        const numM3 = parseFloat(levelM3);
        if (isNaN(numM3) || numM3 < 0 || numM3 > capM3) return;
        const numLevel = (numM3 / capM3) * 100;

        setIsSubmitting(true);
        setTimeout(() => {
            submitLevel(selectedTank, numLevel, numM3, operator.name, note || undefined);

            // Submit input flow rates
            const sources = TANKS[selectedTank].inputSources;
            if (sources.length > 0) {
                const rates: FlowRate[] = sources
                    .map((src) => ({ sourceLabel: src, rate: parseFloat(flowInputs[src] || '0') || 0 }))
                    .filter((r) => r.rate > 0);
                if (rates.length > 0) submitFlowRates(selectedTank, rates, operator.name);
            }

            // Submit output flow rates (DEMIN)
            const outputs = TANKS[selectedTank].outputDestinations;
            if (outputs.length > 0) {
                const allOutRates: OutputFlowRate[] = [];
                // Flow-based destinations
                outputs.filter(d => d.hasFlow).forEach(dest => {
                    const rate = parseFloat(outputFlowInputs[dest.name] || '0') || 0;
                    if (rate > 0) allOutRates.push({ destinationLabel: dest.name, rate });
                });
                // Pump-only destinations (no flow, just record active pump)
                outputs.filter(d => !d.hasFlow && d.pumps?.length).forEach(dest => {
                    allOutRates.push({ destinationLabel: dest.name, rate: 0, pump: selectedPump || undefined });
                });
                if (allOutRates.length > 0) submitOutputFlowRates(selectedTank, allOutRates, operator.name);
            }

            // Submit solar unloading if SOLAR
            if (selectedTank === 'SOLAR' && solarLiters && solarSupplier) {
                submitSolarUnloading({
                    date: solarDate,
                    liters: parseFloat(solarLiters) || 0,
                    supplier: solarSupplier,
                });
            }

            setShowToast(true);
            setIsSubmitting(false);
            setTimeout(() => { router.push('/tank-level'); }, 1500);
        }, 500);
    };

    if (!operator || !isHandling) return null;

    const capM3 = selectedTank ? (selectedTank === 'SOLAR' ? 200 : TANKS[selectedTank].capacityM3) : 0;
    const numM3 = parseFloat(levelM3);
    const isValid = selectedTank && levelM3 && !isNaN(numM3) && numM3 >= 0 && numM3 <= capM3;

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-lg mx-auto">
            {/* Back button */}
            <button
                onClick={() => router.push('/tank-level')}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 transition-colors cursor-pointer"
            >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                <span className="text-sm">Kembali ke Tank Level</span>
            </button>

            {/* Title */}
            <div className="mb-6">
                <h1 className="text-2xl font-black text-white">Update Level Tank</h1>
                <p className="text-sm text-slate-400 mt-1">Operator Handling — Pilih tank dan masukkan level terkini</p>
            </div>

            {/* Tank selector */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-3">Pilih Tank</label>
                <TankSelector selected={selectedTank} onSelect={handleTankSelect} />
            </div>

            {/* Level input (M³) */}
            <div className="mb-5">
                <label className="block text-sm font-medium text-slate-300 mb-2">Level (m³){selectedTank === 'SOLAR' ? ' — per tanki' : ''}</label>
                {selectedTank && currentLevels[selectedTank] && currentLevels[selectedTank].operator !== '-' && (
                    <p className="text-xs text-slate-500 mb-2">
                        Input terakhir: <span className="text-slate-300 font-medium">{Math.round(currentLevels[selectedTank].level / 100 * capM3).toLocaleString('id-ID')} m³</span>
                        <span className="text-slate-600"> ({currentLevels[selectedTank].level.toFixed(1)}%)</span>
                        <span className="text-slate-600"> — oleh {currentLevels[selectedTank].operator}</span>
                    </p>
                )}
                <div className="relative">
                    <input
                        type="number"
                        inputMode="decimal"
                        value={levelM3}
                        onChange={(e) => setLevelM3(e.target.value)}
                        placeholder={selectedTank && currentLevels[selectedTank].operator !== '-' ? Math.round(currentLevels[selectedTank].level / 100 * capM3).toString() : '0'}
                        min="0"
                        max={capM3}
                        step="1"
                        className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-3xl font-bold text-white text-center focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 placeholder:text-slate-600 appearance-none"
                        style={selectedTank ? { borderColor: `${TANKS[selectedTank].liquidColor}50` } : {}}
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500">m³</span>
                </div>
                {levelM3 && (parseFloat(levelM3) < 0 || parseFloat(levelM3) > capM3) && (
                    <p className="text-red-400 text-xs mt-1.5">Level harus antara 0 – {capM3.toLocaleString('id-ID')} m³</p>
                )}
                {selectedTank && levelM3 && !isNaN(parseFloat(levelM3)) && parseFloat(levelM3) >= 0 && parseFloat(levelM3) <= capM3 && (
                    <p className="text-xs mt-2 text-slate-400">
                        = <span className="text-white font-bold text-sm">{(parseFloat(levelM3) / capM3 * 100).toFixed(1)}%</span>
                        <span className="text-slate-600"> dari {selectedTank === 'SOLAR' ? '200 m³ per tanki' : TANKS[selectedTank].capacity}</span>
                    </p>
                )}
            </div>

            {/* Flow rate inputs (tanks with input sources) */}
            {selectedTank && TANKS[selectedTank].inputSources.length > 0 && (
                <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Input Flow Rate (ton/h)</label>
                    <div className="space-y-3">
                        {TANKS[selectedTank].inputSources.map((source) => {
                            const lastRate = flowRates[selectedTank]?.find(f => f.sourceLabel === source);
                            return (
                                <div key={source}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TANKS[selectedTank].liquidColor }} />
                                        <span className="text-xs text-slate-400">{source}</span>
                                        {lastRate && (
                                            <span className="text-[10px] text-slate-600 ml-auto">terakhir: {lastRate.rate.toFixed(1)} ton/h</span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={flowInputs[source] || ''}
                                            onChange={(e) => setFlowInputs(prev => ({ ...prev, [source]: e.target.value }))}
                                            placeholder={lastRate ? lastRate.rate.toFixed(1) : '0.0'}
                                            min="0" step="0.1"
                                            className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600/50 rounded-xl text-xl font-bold text-white text-center focus:outline-none focus:ring-2 focus:ring-cyan-500/50 placeholder:text-slate-600 appearance-none"
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

            {/* Output Flow Rate inputs — hanya untuk destination yang punya flow (hasFlow: true) */}
            {selectedTank && TANKS[selectedTank].outputDestinations.some(d => d.hasFlow) && (
                <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Output Flow Rate (ton/h)</label>
                    <div className="space-y-3">
                        {TANKS[selectedTank].outputDestinations.filter(d => d.hasFlow).map((dest) => {
                            const lastRate = currentOutputFlowRates[selectedTank]?.find(f => f.destinationLabel === dest.name);
                            return (
                                <div key={dest.name}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                                        <span className="text-xs text-slate-400">{dest.name}</span>
                                        {lastRate && (
                                            <span className="text-[10px] text-slate-600 ml-auto">terakhir: {lastRate.rate.toFixed(1)} ton/h</span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={outputFlowInputs[dest.name] || ''}
                                            onChange={(e) => setOutputFlowInputs(prev => ({ ...prev, [dest.name]: e.target.value }))}
                                            placeholder={lastRate ? lastRate.rate.toFixed(1) : '0.0'}
                                            min="0" step="0.1"
                                            className="w-full px-4 py-3 bg-slate-800/80 border border-rose-500/20 rounded-xl text-xl font-bold text-white text-center focus:outline-none focus:ring-2 focus:ring-rose-500/50 placeholder:text-slate-600 appearance-none"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">ton/h</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Pompa Aktif — untuk destination tanpa flow (pump-only, e.g. Demin Revamp) */}
            {selectedTank && TANKS[selectedTank].outputDestinations.some(d => !d.hasFlow && d.pumps?.length) && (
                <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Pompa Aktif</label>
                    {TANKS[selectedTank].outputDestinations.filter(d => !d.hasFlow && d.pumps?.length).map(dest => {
                        const lastOut = currentOutputFlowRates[selectedTank]?.find(f => f.destinationLabel === dest.name);
                        return (
                            <div key={dest.name} className="bg-slate-800/50 border border-slate-600/30 rounded-xl p-4">
                                <p className="text-xs text-slate-400 font-bold uppercase mb-3">{dest.name}</p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPump('')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                                            !selectedPump
                                                ? 'bg-slate-600/50 text-slate-200 border-slate-400/50'
                                                : 'bg-slate-700/30 text-slate-500 border-slate-700/30 hover:border-slate-600'
                                        }`}
                                    >
                                        Mati
                                    </button>
                                    {dest.pumps!.map(pump => (
                                        <button
                                            key={pump}
                                            type="button"
                                            onClick={() => setSelectedPump(pump)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                                                selectedPump === pump
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                                                    : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:border-slate-500'
                                            }`}
                                        >
                                            {pump}
                                        </button>
                                    ))}
                                </div>
                                {lastOut?.pump && (
                                    <p className="text-[10px] text-slate-500 mt-2">Terakhir: <span className="text-slate-400">{lastOut.pump}</span></p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Solar Unloading form (only for SOLAR) */}
            {selectedTank === 'SOLAR' && (
                <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Data Unloading Solar</label>
                    <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Tanggal Unloading</label>
                            <input
                                type="date"
                                value={solarDate}
                                onChange={(e) => setSolarDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Jumlah (liter)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    value={solarLiters}
                                    onChange={(e) => setSolarLiters(e.target.value)}
                                    placeholder="5000"
                                    min="0"
                                    className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder:text-slate-600 appearance-none"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500">liter</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Perusahaan Pengirim</label>
                            <input
                                type="text"
                                value={solarSupplier}
                                onChange={(e) => setSolarSupplier(e.target.value)}
                                placeholder="PT Pertamina"
                                className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder:text-slate-600"
                            />
                        </div>
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
                    className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 placeholder:text-slate-600 resize-none"
                />
                <p className="text-xs text-slate-500 mt-1 text-right">{note.length}/100</p>
            </div>

            {/* Submit button */}
            <button
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
                className={`w-full py-4 rounded-xl text-lg font-bold transition-all duration-300 cursor-pointer ${isValid && !isSubmitting
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
                    'SIMPAN'
                )}
            </button>

            {/* Toast */}
            {showToast && (
                <Toast
                    message="Level berhasil disimpan!"
                    type="success"
                    onClose={() => setShowToast(false)}
                />
            )}
        </div>
    );
}
