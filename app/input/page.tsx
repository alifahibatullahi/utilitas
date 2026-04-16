'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TankSelector from '@/components/input/TankSelector';
import Toast from '@/components/ui/Toast';
import { useOperator } from '@/hooks/useOperator';
import { useTankData, FlowRate, OutputFlowRate } from '@/hooks/useTankData';
import { TankId, TANKS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

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

    // Logsheet note: nilai RCW dari Google Sheets untuk jam sekarang
    const [rcwSheetNote, setRcwSheetNote] = useState<string | null>(null);

    /** Hitung jam WIB ganjil (1,3,5,...,23) dari waktu sekarang.
     *  Slot: 00:30–02:30→1, 02:30–04:30→3, ..., 22:30–00:30→23 */
    const getCurrentJamWIB = useCallback((): { jam: number; isoDate: string } => {
        const now = new Date();
        const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
        const hour = wib.getUTCHours();
        const minute = wib.getUTCMinutes();
        const totalMin = hour * 60 + minute;
        const minutesFrom0030 = (totalMin - 30 + 24 * 60) % (24 * 60);
        const slot = Math.floor(minutesFrom0030 / 120);
        const jam = slot * 2 + 1;
        const isoDate = wib.toISOString().slice(0, 10);
        return { jam, isoDate };
    }, []);

    // Ref to read current draft without stale closure issues
    const currentRef = useRef(current);
    useEffect(() => { currentRef.current = current; }, [current]);
    const selectedTankRef = useRef(selectedTank);
    useEffect(() => { selectedTankRef.current = selectedTank; }, [selectedTank]);

    useEffect(() => {
        if (!operator) router.push('/');
        else if (!isHandling) router.push('/dashboard');
    }, [operator, isHandling, router]);

    // Fetch nilai logsheet dari Supabase saat tank RCW, DEMIN, atau SOLAR dipilih
    useEffect(() => {
        if (selectedTank !== 'RCW' && selectedTank !== 'DEMIN' && selectedTank !== 'SOLAR') {
            setRcwSheetNote(null);
            return;
        }
        const { jam, isoDate } = getCurrentJamWIB();
        const jamLabel = `${String(jam).padStart(2, '0')}:00`;
        const tankLabel = selectedTank === 'RCW' ? 'RCW' : selectedTank === 'DEMIN' ? 'Demin' : 'Solar';
        setRcwSheetNote(null);

        const supabase = createClient();
        supabase
            .from('tank_logsheet')
            .select('level_m3')
            .eq('tank_id', selectedTank)
            .eq('date', isoDate)
            .eq('jam', jam)
            .maybeSingle()
            .then(({ data }: { data: { level_m3: number | null } | null }) => {
                if (data?.level_m3 != null) {
                    setRcwSheetNote(`Logsheet ${tankLabel} jam ${jamLabel} adalah ${data.level_m3} m³`);
                } else {
                    setRcwSheetNote(`Logsheet ${tankLabel} jam ${jamLabel} belum terisi`);
                }
            });
    }, [selectedTank, getCurrentJamWIB]);

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

        // Upsert ke tank_logsheet (jam ganjil WIB)
        const { jam, isoDate } = getCurrentJamWIB();
        const supabase = createClient();
        supabase.from('tank_logsheet').upsert(
            { tank_id: tankId, date: isoDate, jam, level_m3: numM3, updated_at: new Date().toISOString() },
            { onConflict: 'tank_id,date,jam' }
        ).then(({ error }: { error: unknown }) => {
            if (error) console.error('[tank_logsheet] upsert error:', error);
        });
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

        // Fire-and-forget: sync Level RCW ke Google Sheets
        if (saved.includes('RCW')) {
            const rcwDraft = allDrafts['RCW'];
            const rcwM3 = rcwDraft ? parseFloat(rcwDraft.levelM3) : NaN;
            if (!isNaN(rcwM3)) {
                const submittedAt = new Date().toISOString();
                console.log(`[input/RCW] Mengirim ke Sheets → level ${rcwM3} m³ | submitted_at ${submittedAt}`);
                void fetch('/api/sheets/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'rcw_level',
                        data: { level: rcwM3, submitted_at: submittedAt },
                    }),
                }).then(r => r.json()).then(result => {
                    if (result.warning) {
                        console.warn('[input/RCW] Sheets gagal:', result.warning);
                    } else if (!result.details || result.details.length === 0) {
                        console.warn('[input/RCW] Sheets: row tidak ditemukan di template, data tidak tersimpan');
                    } else {
                        for (const d of result.details) {
                            console.log(
                                `[input/RCW] Sheets UPDATE → row ${d.rowIndex} | jam ${String(d.jam).padStart(2,'0')}:00 | ${d.date} | level ${d.level} m³`
                            );
                        }
                    }
                }).catch(err => console.warn('[input/RCW] Sheets sync failed (non-fatal):', err));
            }
        }

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
        <div className="relative min-h-screen bg-slate-900 pb-[160px] md:pb-32">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-cyan-900/20 to-transparent pointer-events-none" />
            <div className="absolute top-[-10%] right-[-5%] w-64 h-64 rounded-full bg-blue-500/10 blur-[80px] pointer-events-none" />

            <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-xl mx-auto relative z-10">
                {/* Back button */}
                <button
                    onClick={() => router.push('/tank-level')}
                    className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-all cursor-pointer group bg-slate-800/40 hover:bg-slate-700/60 px-3 py-1.5 rounded-full w-max border border-slate-700/50"
                >
                    <span className="material-symbols-outlined text-base group-hover:-translate-x-1 transition-transform">arrow_back</span>
                    <span className="text-sm font-medium">Kembali ke Tank Level</span>
                </button>

                {/* Title */}
                <div className="mb-8 text-center sm:text-left">
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white block to-slate-400 tracking-tight">Update Level Tank</h1>
                    <p className="text-sm text-slate-400 mt-2 font-medium bg-slate-800/40 px-3 py-1 rounded-full inline-block sm:block sm:bg-transparent sm:px-0 sm:py-0 border border-slate-700/50 sm:border-none">Operator Handling — Pilih tank dan masukkan level</p>
                </div>

                {/* Tank selector */}
                <div className="mb-8">
                    <label className="block text-sm font-bold text-slate-300 mb-3 ml-1">1. Pilih Tank</label>
                    <TankSelector selected={selectedTank} onSelect={handleTankSelect} savedTanks={savedTanks} />
                </div>

                {!selectedTank && (
                    <div className="flex flex-col items-center justify-center py-12 px-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl border-dashed">
                        <span className="material-symbols-outlined text-4xl text-slate-500 mb-3">touch_app</span>
                        <p className="text-slate-400 text-sm font-medium text-center">Pilih salah satu tank di atas untuk mulai mengisi data</p>
                    </div>
                )}

                {selectedTank && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Level input */}
                        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent opacity-50 rounded-bl-full pointer-events-none" />
                            
                            <label className="block text-base font-bold text-white mb-1">
                                2. Level (m³) {selectedTank === 'SOLAR' ? <span className="text-slate-400 font-normal text-sm">— per tangki</span> : ''}
                            </label>
                            
                            {currentLevels[selectedTank]?.operator !== '-' && (
                                <div className="flex items-center gap-2 mb-4 bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-700/30 w-max">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                                        Tersimpan:{' '}
                                        <span className="text-white font-bold">{Math.round(currentLevels[selectedTank].level / 100 * capM3).toLocaleString('id-ID')} m³</span>
                                        <span className="text-slate-500"> ({currentLevels[selectedTank].level.toFixed(1)}%)</span>
                                        <span className="text-slate-500 ml-1 block sm:inline">— {currentLevels[selectedTank].operator}</span>
                                    </p>
                                </div>
                            )}
                            
                            <div className="relative mt-2">
                                <input
                                    type="number" inputMode="decimal"
                                    value={current.levelM3}
                                    onChange={e => setField('levelM3', e.target.value)}
                                    placeholder="0"
                                    min="0" max={capM3} step="1"
                                    className="w-full px-5 py-5 sm:py-6 bg-slate-900/80 border-2 rounded-xl text-4xl sm:text-5xl font-black text-white text-center focus:outline-none focus:ring-4 placeholder:text-slate-700 appearance-none transition-all duration-300 shadow-inner"
                                    style={{ 
                                        borderColor: current.levelM3 ? TANKS[selectedTank].liquidColor : `${TANKS[selectedTank].liquidColor}40`,
                                        boxShadow: current.levelM3 ? `inset 0 2px 10px rgba(0,0,0,0.5), 0 0 20px ${TANKS[selectedTank].liquidColor}20` : 'inset 0 2px 10px rgba(0,0,0,0.5)',
                                        textShadow: current.levelM3 ? `0 0 20px ${TANKS[selectedTank].liquidColor}40` : 'none'
                                    }}
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
                                    <span className="text-xl sm:text-2xl font-bold text-slate-500">m³</span>
                                </div>
                            </div>
                            
                            {current.levelM3 && (parseFloat(current.levelM3) < 0 || parseFloat(current.levelM3) > capM3) && (
                                <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">error</span>
                                    Level harus antara 0 – {capM3.toLocaleString('id-ID')} m³
                                </div>
                            )}
                            
                            {selectedTank && current.levelM3 && !isNaN(parseFloat(current.levelM3)) && parseFloat(current.levelM3) >= 0 && parseFloat(current.levelM3) <= capM3 && (
                                <div className="mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900/50 rounded-lg border border-slate-700/50 w-max mx-auto shadow-sm">
                                    <span className="material-symbols-outlined text-sm text-slate-400">percent</span>
                                    <p className="text-sm text-slate-300">
                                        Persentase: <span className="text-white font-black text-base" style={{ color: TANKS[selectedTank].liquidColor }}>{(parseFloat(current.levelM3) / capM3 * 100).toFixed(1)}%</span>
                                    </p>
                                </div>
                            )}

                            {/* Logsheet note untuk RCW, DEMIN, dan SOLAR */}
                            {(selectedTank === 'RCW' || selectedTank === 'DEMIN' || selectedTank === 'SOLAR') && (
                                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-teal-500/5 border border-teal-500/20 rounded-lg">
                                    <span className="material-symbols-outlined text-teal-400 text-[16px] shrink-0">info</span>
                                    <p className="text-xs text-teal-300/80 font-medium">
                                        {rcwSheetNote ?? 'Memuat data logsheet...'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Input flow rates */}
                        {TANKS[selectedTank].inputSources.length > 0 && (
                            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 shadow-xl">
                                <label className="block text-base font-bold text-white mb-4">Input Flow Rate (ton/h)</label>
                                <div className="space-y-4">
                                    {TANKS[selectedTank].inputSources.map(source => {
                                        const lastRate = flowRates[selectedTank]?.find(f => f.sourceLabel === source);
                                        return (
                                            <div key={source} className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/50 relative overflow-hidden group focus-within:border-cyan-500/50 transition-colors">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ color: TANKS[selectedTank].liquidColor, backgroundColor: TANKS[selectedTank].liquidColor }} />
                                                    <span className="text-sm font-bold text-slate-300">{source}</span>
                                                    {lastRate && <span className="text-[10px] sm:text-xs text-slate-500 ml-auto bg-slate-800 px-2 py-0.5 rounded-full">terakhir: {lastRate.rate.toFixed(1)} ton/h</span>}
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="number" inputMode="decimal"
                                                        value={current.flowInputs[source] || ''}
                                                        onChange={e => setField('flowInputs', { ...current.flowInputs, [source]: e.target.value })}
                                                        placeholder={lastRate ? lastRate.rate.toFixed(1) : '0.0'}
                                                        min="0" step="0.1"
                                                        className="w-full px-4 py-3 bg-slate-800 border-none rounded-lg text-xl sm:text-2xl font-black text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 placeholder:text-slate-600 appearance-none"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 select-none">ton/h</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Output flow rates */}
                        {TANKS[selectedTank].outputDestinations.some(d => d.hasFlow) && (
                            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 shadow-xl">
                                <label className="block text-base font-bold text-white mb-4">Output Flow Rate (ton/h)</label>
                                <div className="space-y-4">
                                    {TANKS[selectedTank].outputDestinations.filter(d => d.hasFlow).map(dest => {
                                        const lastRate = currentOutputFlowRates[selectedTank]?.find(f => f.destinationLabel === dest.name);
                                        return (
                                            <div key={dest.name} className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/50 relative overflow-hidden focus-within:border-rose-500/50 transition-colors">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                                                    <span className="text-sm font-bold text-slate-300">{dest.name}</span>
                                                    {lastRate && <span className="text-[10px] sm:text-xs text-slate-500 ml-auto bg-slate-800 px-2 py-0.5 rounded-full">terakhir: {lastRate.rate.toFixed(1)} ton/h</span>}
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="number" inputMode="decimal"
                                                        value={current.outputFlowInputs[dest.name] || ''}
                                                        onChange={e => setField('outputFlowInputs', { ...current.outputFlowInputs, [dest.name]: e.target.value })}
                                                        placeholder={lastRate ? lastRate.rate.toFixed(1) : '0.0'}
                                                        min="0" step="0.1"
                                                        className="w-full px-4 py-3 bg-slate-800 border-none rounded-lg text-xl sm:text-2xl font-black text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 placeholder:text-slate-600 appearance-none"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 select-none">ton/h</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Pompa aktif */}
                        {TANKS[selectedTank].outputDestinations.some(d => !d.hasFlow && d.pumps?.length) && (
                            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 shadow-xl">
                                <label className="block text-base font-bold text-white mb-4">Status Pompa</label>
                                <div className="space-y-4">
                                    {TANKS[selectedTank].outputDestinations.filter(d => !d.hasFlow && d.pumps?.length).map(dest => {
                                        const lastOut = currentOutputFlowRates[selectedTank]?.find(f => f.destinationLabel === dest.name);
                                        return (
                                            <div key={dest.name} className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <p className="text-sm font-bold text-slate-300 uppercase">{dest.name}</p>
                                                    {lastOut?.pump && (
                                                        <p className="text-[10px] bg-slate-800 px-2 py-1 rounded-md text-slate-400">Terakhir: <span className="text-white font-bold">{lastOut.pump}</span></p>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <button type="button" onClick={() => setField('selectedPump', '')}
                                                        className={`py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer border ${!current.selectedPump ? 'bg-slate-700 text-white border-slate-500 shadow-inner' : 'bg-slate-800/80 text-slate-500 border-slate-700/50 hover:bg-slate-700 hover:text-slate-300'}`}>
                                                        MATI
                                                    </button>
                                                    {dest.pumps!.map(pump => (
                                                        <button key={pump} type="button" onClick={() => setField('selectedPump', pump)}
                                                            className={`py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer border ${current.selectedPump === pump ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-800/80 text-slate-400 border-slate-700/50 hover:bg-slate-700 hover:text-slate-300 hover:border-slate-600'}`}>
                                                            {pump}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Solar unloading */}
                        {selectedTank === 'SOLAR' && (
                            <div className="bg-gradient-to-br from-amber-900/20 to-slate-900/80 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[40px] rounded-full pointer-events-none" />
                                
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-amber-500">local_shipping</span>
                                    <label className="block text-base font-bold text-white">Data Unloading Solar</label>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="bg-slate-900/60 p-1 border border-slate-700/50 rounded-xl">
                                        <div className="px-3 py-1.5 border-b border-slate-800">
                                            <label className="text-xs font-bold text-slate-400 drop-shadow-sm">Tanggal Unloading</label>
                                        </div>
                                        <input type="date" value={current.solarDate} onChange={e => setField('solarDate', e.target.value)}
                                            className="w-full px-3 py-2.5 bg-transparent border-none text-sm text-white font-medium focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                                    </div>
                                    
                                    <div className="bg-slate-900/60 p-1 border border-slate-700/50 rounded-xl focus-within:border-amber-500/50 transition-colors">
                                        <div className="px-3 py-1.5 border-b border-slate-800">
                                            <label className="text-xs font-bold text-slate-400">Jumlah Diterima</label>
                                        </div>
                                        <div className="relative">
                                            <input type="number" inputMode="decimal" value={current.solarLiters} onChange={e => setField('solarLiters', e.target.value)}
                                                placeholder="5000" min="0"
                                                className="w-full px-3 py-2.5 bg-transparent border-none text-lg font-bold text-white focus:outline-none focus:ring-0 placeholder:text-slate-600 appearance-none" />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-500/80">liter</span>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-900/60 p-1 border border-slate-700/50 rounded-xl focus-within:border-amber-500/50 transition-colors">
                                        <div className="px-3 py-1.5 border-b border-slate-800">
                                            <label className="text-xs font-bold text-slate-400">Perusahaan Pengirim</label>
                                        </div>
                                        <input type="text" value={current.solarSupplier} onChange={e => setField('solarSupplier', e.target.value)}
                                            placeholder="Cth: PT Pertamina"
                                            className="w-full px-3 py-2.5 bg-transparent border-none text-sm font-medium text-white focus:outline-none focus:ring-0 placeholder:text-slate-600" />
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </div>

            {/* Sticky Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 bg-gradient-to-t from-slate-950 via-slate-900/95 to-transparent pt-12 pb-[calc(64px+env(safe-area-inset-bottom,0px)+8px)] sm:pb-8 md:pb-8 backdrop-blur-[2px]">
                <div className="max-w-xl mx-auto">
                    <button 
                        onClick={handleSubmit} 
                        disabled={!isValid || isSubmitting}
                        className={`w-full py-4 sm:py-5 rounded-2xl text-lg sm:text-xl font-black tracking-wide transition-all duration-300 cursor-pointer flex items-center justify-center gap-3 overflow-hidden relative group
                        ${isValid && !isSubmitting
                            ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-[0_10px_40px_-10px_rgba(16,185,129,0.8)] border border-emerald-400/50 hover:scale-[1.02] active:scale-[0.98]'
                            : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed hidden sm:flex'
                        }`}
                        // on mobile only show button if valid to save space, but it's okay to keep it visible but disabled
                        style={{ display: (!isValid && !isSubmitting) ? 'none' : 'flex' }}
                    >
                        {/* Button shine effect */}
                        {isValid && !isSubmitting && (
                            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                        )}
                        
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                <span>Menyimpan Data...</span>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-2xl drop-shadow-sm">save</span>
                                <span className="drop-shadow-sm text-shadow-sm shadow-black/20">SIMPAN SEMUA DATA</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Custom animations for tailwind config if not added globally */}
            <style jsx>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}</style>

            {showToast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top fade-in duration-300">
                    <Toast message={toastMsg} type="success" onClose={() => setShowToast(false)} duration={3000} />
                </div>
            )}
        </div>
    );
}
