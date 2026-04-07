'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TankSelector from '@/components/input/TankSelector';
import Toast from '@/components/ui/Toast';
import { useOperator } from '@/hooks/useOperator';
import { useTankData, FlowRate, OutputFlowRate } from '@/hooks/useTankData';
import { TankId, TANKS } from '@/lib/constants';

interface TankDraft {
    levelM3: string;
    note: string;
    flowInputs: Record<string, string>;
    outputFlowInputs: Record<string, string>;
    selectedPump: string;
    solarDate: string;
    solarLiters: string;
    solarSupplier: string;
}

function emptyDraft(solarDate: string): TankDraft {
    return { levelM3: '', note: '', flowInputs: {}, outputFlowInputs: {}, selectedPump: '', solarDate, solarLiters: '', solarSupplier: '' };
}

export default function InputPage() {
    const { operator, isHandling } = useOperator();
    const { submitLevel, submitFlowRates, submitOutputFlowRates, submitSolarUnloading, currentLevels, flowRates, outputFlowRates: currentOutputFlowRates } = useTankData();
    const router = useRouter();

    const today = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const [selectedTank, setSelectedTank] = useState<TankId | null>(null);
    const [drafts, setDrafts] = useState<Partial<Record<TankId, TankDraft>>>({});
    const [current, setCurrent] = useState<TankDraft>(emptyDraft(today));
    const [showToast, setShowToast] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Track which tanks have been saved in this session
    const [savedTanks, setSavedTanks] = useState<Set<TankId>>(new Set());

    // Ref to read current draft without stale closure issues
    const currentRef = useRef(current);
    useEffect(() => { currentRef.current = current; }, [current]);
    const selectedTankRef = useRef(selectedTank);
    useEffect(() => { selectedTankRef.current = selectedTank; }, [selectedTank]);

    useEffect(() => {
        if (!operator) router.push('/');
        else if (!isHandling) router.push('/dashboard');
    }, [operator, isHandling, router]);

    const handleTankSelect = (tankId: TankId) => {
        // Save current draft before switching
        if (selectedTankRef.current) {
            setDrafts(prev => ({ ...prev, [selectedTankRef.current!]: currentRef.current }));
        }

        const existingDraft = drafts[tankId];
        if (existingDraft) {
            // Restore saved draft
            setCurrent(existingDraft);
        } else {
            // Initialize from Supabase data
            const capM3 = tankId === 'SOLAR' ? 200 : TANKS[tankId].capacityM3;
            const tankData = currentLevels[tankId];
            const levelM3 = (tankData && tankData.operator !== '-' && tankData.level != null)
                ? Math.round(tankData.level / 100 * capM3).toString()
                : '';

            const flowInputs: Record<string, string> = {};
            (flowRates[tankId] || []).forEach(f => { flowInputs[f.sourceLabel] = f.rate.toFixed(1); });

            const outputFlowInputs: Record<string, string> = {};
            let selectedPump = '';
            (currentOutputFlowRates[tankId] || []).forEach(f => {
                outputFlowInputs[f.destinationLabel] = f.rate.toFixed(1);
                if (f.pump) selectedPump = f.pump;
            });

            setCurrent({ levelM3, note: '', flowInputs, outputFlowInputs, selectedPump, solarDate: today, solarLiters: '', solarSupplier: '' });
        }

        setSelectedTank(tankId);
    };

    const setField = <K extends keyof TankDraft>(key: K, value: TankDraft[K]) => {
        setCurrent(prev => ({ ...prev, [key]: value }));
    };

    const saveTank = (tankId: TankId, draft: TankDraft) => {
        if (!operator || !draft.levelM3) return;
        const capM3 = tankId === 'SOLAR' ? 200 : TANKS[tankId].capacityM3;
        const numM3 = parseFloat(draft.levelM3);
        if (isNaN(numM3) || numM3 < 0 || numM3 > capM3) return;
        const numLevel = (numM3 / capM3) * 100;

        submitLevel(tankId, numLevel, numM3, operator.name);

        const sources = TANKS[tankId].inputSources;
        if (sources.length > 0) {
            const rates: FlowRate[] = sources.map(src => ({ sourceLabel: src, rate: parseFloat(draft.flowInputs[src] || '0') || 0 }));
            submitFlowRates(tankId, rates, operator.name);
        }

        const outputs = TANKS[tankId].outputDestinations;
        if (outputs.length > 0) {
            const allOutRates: OutputFlowRate[] = [];
            outputs.filter(d => d.hasFlow).forEach(dest => {
                allOutRates.push({ destinationLabel: dest.name, rate: parseFloat(draft.outputFlowInputs[dest.name] || '0') || 0 });
            });
            outputs.filter(d => !d.hasFlow && d.pumps?.length).forEach(dest => {
                allOutRates.push({ destinationLabel: dest.name, rate: 0, pump: draft.selectedPump || undefined });
            });
            if (allOutRates.length > 0) submitOutputFlowRates(tankId, allOutRates, operator.name);
        }

        if (tankId === 'SOLAR' && draft.solarLiters && draft.solarSupplier) {
            submitSolarUnloading({ date: draft.solarDate, liters: parseFloat(draft.solarLiters) || 0, supplier: draft.solarSupplier });
        }
    };

    const handleSubmit = () => {
        if (!operator) return;

        // Merge current draft into drafts map
        const allDrafts: Partial<Record<TankId, TankDraft>> = { ...drafts };
        if (selectedTank) allDrafts[selectedTank] = current;

        // Save all tanks that have levelM3 filled
        const saved: TankId[] = [];
        (['DEMIN', 'RCW', 'SOLAR'] as TankId[]).forEach(tankId => {
            const draft = allDrafts[tankId];
            if (draft?.levelM3) {
                saveTank(tankId, draft);
                saved.push(tankId);
            }
        });

        if (saved.length === 0) return;

        setIsSubmitting(true);
        setTimeout(() => {
            setSavedTanks(new Set(saved));
            setDrafts({});
            setToastMsg(`${saved.join(', ')} berhasil disimpan!`);
            setShowToast(true);
            setIsSubmitting(false);
        }, 500);
    };

    if (!operator || !isHandling) return null;

    const capM3 = selectedTank ? (selectedTank === 'SOLAR' ? 200 : TANKS[selectedTank].capacityM3) : 0;
    const numM3 = parseFloat(current.levelM3);
    // Valid jika minimal ada 1 tank terisi (current atau salah satu draft)
    const allDraftsNow = { ...drafts, ...(selectedTank ? { [selectedTank]: current } : {}) };
    const isValid = Object.entries(allDraftsNow).some(([, d]) => d?.levelM3);

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
                <TankSelector selected={selectedTank} onSelect={handleTankSelect} savedTanks={savedTanks} />
            </div>

            {!selectedTank && (
                <p className="text-slate-500 text-sm text-center py-8">Pilih tank di atas untuk mulai input</p>
            )}

            {selectedTank && (
                <>
                    {/* Level input */}
                    <div className="mb-5">
                        <label className="block text-sm font-medium text-slate-300 mb-2">Level (m³){selectedTank === 'SOLAR' ? ' — per tanki' : ''}</label>
                        {currentLevels[selectedTank]?.operator !== '-' && (
                            <p className="text-xs text-slate-500 mb-2">
                                Tersimpan: <span className="text-slate-300 font-medium">{Math.round(currentLevels[selectedTank].level / 100 * capM3).toLocaleString('id-ID')} m³</span>
                                <span className="text-slate-600"> ({currentLevels[selectedTank].level.toFixed(1)}%)</span>
                                <span className="text-slate-600"> — {currentLevels[selectedTank].operator}</span>
                            </p>
                        )}
                        <div className="relative">
                            <input
                                type="number" inputMode="decimal"
                                value={current.levelM3}
                                onChange={e => setField('levelM3', e.target.value)}
                                placeholder="0"
                                min="0" max={capM3} step="1"
                                className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-3xl font-bold text-white text-center focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 placeholder:text-slate-600 appearance-none"
                                style={{ borderColor: `${TANKS[selectedTank].liquidColor}50` }}
                            />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500">m³</span>
                        </div>
                        {current.levelM3 && (parseFloat(current.levelM3) < 0 || parseFloat(current.levelM3) > capM3) && (
                            <p className="text-red-400 text-xs mt-1.5">Level harus antara 0 – {capM3.toLocaleString('id-ID')} m³</p>
                        )}
                        {selectedTank && current.levelM3 && !isNaN(parseFloat(current.levelM3)) && parseFloat(current.levelM3) >= 0 && parseFloat(current.levelM3) <= capM3 && (
                            <p className="text-xs mt-2 text-slate-400">
                                = <span className="text-white font-bold text-sm">{(parseFloat(current.levelM3) / capM3 * 100).toFixed(1)}%</span>
                                <span className="text-slate-600"> dari {selectedTank === 'SOLAR' ? '200 m³ per tanki' : TANKS[selectedTank].capacity}</span>
                            </p>
                        )}
                    </div>

                    {/* Input flow rates */}
                    {TANKS[selectedTank].inputSources.length > 0 && (
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Input Flow Rate (ton/h)</label>
                            <div className="space-y-3">
                                {TANKS[selectedTank].inputSources.map(source => {
                                    const lastRate = flowRates[selectedTank]?.find(f => f.sourceLabel === source);
                                    return (
                                        <div key={source}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TANKS[selectedTank].liquidColor }} />
                                                <span className="text-xs text-slate-400">{source}</span>
                                                {lastRate && <span className="text-[10px] text-slate-600 ml-auto">terakhir: {lastRate.rate.toFixed(1)} ton/h</span>}
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="number" inputMode="decimal"
                                                    value={current.flowInputs[source] || ''}
                                                    onChange={e => setField('flowInputs', { ...current.flowInputs, [source]: e.target.value })}
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

                    {/* Output flow rates */}
                    {TANKS[selectedTank].outputDestinations.some(d => d.hasFlow) && (
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Output Flow Rate (ton/h)</label>
                            <div className="space-y-3">
                                {TANKS[selectedTank].outputDestinations.filter(d => d.hasFlow).map(dest => {
                                    const lastRate = currentOutputFlowRates[selectedTank]?.find(f => f.destinationLabel === dest.name);
                                    return (
                                        <div key={dest.name}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="w-2 h-2 rounded-full bg-rose-400" />
                                                <span className="text-xs text-slate-400">{dest.name}</span>
                                                {lastRate && <span className="text-[10px] text-slate-600 ml-auto">terakhir: {lastRate.rate.toFixed(1)} ton/h</span>}
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="number" inputMode="decimal"
                                                    value={current.outputFlowInputs[dest.name] || ''}
                                                    onChange={e => setField('outputFlowInputs', { ...current.outputFlowInputs, [dest.name]: e.target.value })}
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

                    {/* Pompa aktif */}
                    {TANKS[selectedTank].outputDestinations.some(d => !d.hasFlow && d.pumps?.length) && (
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Pompa Aktif</label>
                            {TANKS[selectedTank].outputDestinations.filter(d => !d.hasFlow && d.pumps?.length).map(dest => {
                                const lastOut = currentOutputFlowRates[selectedTank]?.find(f => f.destinationLabel === dest.name);
                                return (
                                    <div key={dest.name} className="bg-slate-800/50 border border-slate-600/30 rounded-xl p-4">
                                        <p className="text-xs text-slate-400 font-bold uppercase mb-3">{dest.name}</p>
                                        <div className="flex flex-wrap gap-2">
                                            <button type="button" onClick={() => setField('selectedPump', '')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${!current.selectedPump ? 'bg-slate-600/50 text-slate-200 border-slate-400/50' : 'bg-slate-700/30 text-slate-500 border-slate-700/30 hover:border-slate-600'}`}>
                                                Mati
                                            </button>
                                            {dest.pumps!.map(pump => (
                                                <button key={pump} type="button" onClick={() => setField('selectedPump', pump)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${current.selectedPump === pump ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:border-slate-500'}`}>
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

                    {/* Solar unloading */}
                    {selectedTank === 'SOLAR' && (
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Data Unloading Solar</label>
                            <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Tanggal Unloading</label>
                                    <input type="date" value={current.solarDate} onChange={e => setField('solarDate', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Jumlah (liter)</label>
                                    <div className="relative">
                                        <input type="number" inputMode="decimal" value={current.solarLiters} onChange={e => setField('solarLiters', e.target.value)}
                                            placeholder="5000" min="0"
                                            className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder:text-slate-600 appearance-none" />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500">liter</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Perusahaan Pengirim</label>
                                    <input type="text" value={current.solarSupplier} onChange={e => setField('solarSupplier', e.target.value)}
                                        placeholder="PT Pertamina"
                                        className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder:text-slate-600" />
                                </div>
                            </div>
                        </div>
                    )}

                </>
            )}

            {/* Tombol simpan selalu terlihat */}
            <div className="mt-6 mb-6">
                <button onClick={handleSubmit} disabled={!isValid || isSubmitting}
                    className={`w-full py-4 rounded-xl text-lg font-bold transition-all duration-300 cursor-pointer ${isValid && !isSubmitting
                        ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.01] active:scale-[0.99]'
                        : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'}`}>
                    {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            Menyimpan...
                        </span>
                    ) : 'SIMPAN SEMUA'}
                </button>
            </div>

            {showToast && (
                <Toast message={toastMsg} type="success" onClose={() => setShowToast(false)} duration={2500} />
            )}
        </div>
    );
}
