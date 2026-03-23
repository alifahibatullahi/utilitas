'use client';

import React, { useState, useEffect, useRef } from 'react';
import TabBoiler from '@/components/input-shift/TabBoiler';
import TabTurbin from '@/components/input-shift/TabTurbin';
import TabGenerator from '@/components/input-shift/TabGenerator';
import TabDistribusiSteam from '@/components/input-shift/TabDistribusiSteam';
import TabHandling from '@/components/input-shift/TabHandling';
import TabESP from '@/components/input-shift/TabESP';
import TabCoalBunker from '@/components/input-shift/TabCoalBunker';
import TabLab from '@/components/input-shift/TabLab';
import { useShiftReport } from '@/hooks/useShiftReport';
import { useOperator } from '@/hooks/useOperator';
import type { ShiftType } from '@/lib/supabase/types';
import { SAMPLE_MALAM_01JAN } from '@/lib/sampleData';

type TabId = 'Boiler A' | 'Boiler B' | 'Turbin' | 'Generator' | 'Distribusi Steam' | 'Handling' | 'ESP' | 'Coal Bunker' | 'Lab';

const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'Boiler A', label: 'Boiler A', icon: 'factory' },
    { id: 'Boiler B', label: 'Boiler B', icon: 'factory' },
    { id: 'Turbin', label: 'Turbin', icon: 'mode_fan' },
    { id: 'Generator', label: 'Generator', icon: 'bolt' },
    { id: 'Distribusi Steam', label: 'Distribusi Steam', icon: 'water_drop' },
    { id: 'Handling', label: 'Coal Handling', icon: 'local_shipping' },
    { id: 'ESP', label: 'ESP', icon: 'air' },
    { id: 'Coal Bunker', label: 'Coal Bunker', icon: 'inventory_2' },
    { id: 'Lab', label: 'Lab / QC', icon: 'science' },
];

export default function InputShiftPage() {
    const [activeTab, setActiveTab] = useState<TabId>('Boiler A');
    const [inputMode, setInputMode] = useState<'shift' | 'harian'>('shift');
    const [selectedShift, setSelectedShift] = useState<1 | 2 | 3>(2);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [mounted, setMounted] = useState(false);
    const skipNextClear = useRef(false);
    const lastSubmittedReportId = useRef<string | null>(null);

    useEffect(() => { setMounted(true); }, []);

    // Form state
    const [boilerA, setBoilerA] = useState<Record<string, number | null>>({});
    const [boilerB, setBoilerB] = useState<Record<string, number | null>>({});
    const [turbin, setTurbin] = useState<Record<string, number | null>>({});
    const [steamDist, setSteamDist] = useState<Record<string, number | null>>({});
    const [generatorGi, setGeneratorGi] = useState<Record<string, number | null>>({});
    const [powerDist, setPowerDist] = useState<Record<string, number | null>>({});
    const [espHandling, setEspHandling] = useState<Record<string, number | string | null>>({});
    const [tankyard, setTankyard] = useState<Record<string, number | null>>({});
    const [coalBunker, setCoalBunker] = useState<Record<string, number | null>>({});
    const [waterQuality, setWaterQuality] = useState<Record<string, number | null>>({});
    const [chemicalDosing, setChemicalDosing] = useState<Record<string, number | null>>({});

    const shiftMap: Record<number, ShiftType> = { 1: 'pagi', 2: 'sore', 3: 'malam' };
    const { report, loading, submitReport, refetch } = useShiftReport(selectedDate, shiftMap[selectedShift]);
    const { operator } = useOperator();

    // Helper: extract non-null numeric fields from a record, skip id/FK fields
    const extractFields = (obj: Record<string, unknown> | undefined, skipKeys: string[] = []) => {
        if (!obj) return {};
        const skip = new Set(['id', 'shift_report_id', 'created_at', 'updated_at', ...skipKeys]);
        const result: Record<string, number | string | null> = {};
        for (const [k, v] of Object.entries(obj)) {
            if (skip.has(k)) continue;
            if (v !== null && v !== undefined) result[k] = v as number | string | null;
        }
        return result;
    };

    // Clear form when date/shift changes, then populate from fetched report
    useEffect(() => {
        if (skipNextClear.current) {
            skipNextClear.current = false;
            return;
        }
        // After submit+refetch, report matches what we just saved — skip clearing
        if (lastSubmittedReportId.current && report && (report as unknown as Record<string, unknown>).id === lastSubmittedReportId.current) {
            lastSubmittedReportId.current = null;
            return;
        }
        lastSubmittedReportId.current = null;

        setBoilerA({});
        setBoilerB({});
        setTurbin({});
        setSteamDist({});
        setGeneratorGi({});
        setPowerDist({});
        setEspHandling({});
        setTankyard({});
        setCoalBunker({});
        setWaterQuality({});
        setChemicalDosing({});
        if (!report) return;

        const boilerAData = report.shift_boiler?.find((b: { boiler: string }) => b.boiler === 'A');
        const boilerBData = report.shift_boiler?.find((b: { boiler: string }) => b.boiler === 'B');
        const turbinData = report.shift_turbin?.[0];
        const steamDistData = report.shift_steam_dist?.[0];
        const genData = report.shift_generator_gi?.[0];
        const powerData = report.shift_power_dist?.[0];
        const espData = report.shift_esp_handling?.[0];
        const tankyardData = report.shift_tankyard?.[0];
        const coalData = report.shift_coal_bunker?.[0];

        if (boilerAData) setBoilerA(extractFields(boilerAData as unknown as Record<string, unknown>, ['boiler', 'batubara_ton']) as Record<string, number | null>);
        if (boilerBData) setBoilerB(extractFields(boilerBData as unknown as Record<string, unknown>, ['boiler', 'batubara_ton']) as Record<string, number | null>);
        if (turbinData) setTurbin(extractFields(turbinData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (steamDistData) setSteamDist(extractFields(steamDistData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (genData) setGeneratorGi(extractFields(genData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (powerData) setPowerDist(extractFields(powerData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (espData) setEspHandling(extractFields(espData as unknown as Record<string, unknown>));
        if (tankyardData) setTankyard(extractFields(tankyardData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (coalData) setCoalBunker(extractFields(coalData as unknown as Record<string, unknown>) as Record<string, number | null>);
    }, [report]);

    // Generic change handlers
    const makeNumberHandler = (setter: React.Dispatch<React.SetStateAction<Record<string, number | null>>>) =>
        (name: string, value: number | string | null) => {
            setter(prev => ({
                ...prev,
                [name]: typeof value === 'string'
                    ? (value === '' ? null : parseFloat(value) ?? null)
                    : value,
            }));
        };

    const makeMixedHandler = (setter: React.Dispatch<React.SetStateAction<Record<string, number | string | null>>>) =>
        (name: string, value: number | string | null) => {
            setter(prev => ({ ...prev, [name]: value }));
        };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            // Auto-calculate batubara_ton from feeders
            const batubaraA = (Number(coalBunker.feeder_a) || 0) + (Number(coalBunker.feeder_b) || 0) + (Number(coalBunker.feeder_c) || 0);
            const batubaraB = (Number(coalBunker.feeder_d) || 0) + (Number(coalBunker.feeder_e) || 0) + (Number(coalBunker.feeder_f) || 0);

            const result = await submitReport({
                group_name: operator?.group || 'A',
                supervisor: operator?.name || 'Operator',
                created_by: '',
                boilerA: { ...boilerA, batubara_ton: batubaraA },
                boilerB: { ...boilerB, batubara_ton: batubaraB },
                turbin,
                steamDist,
                generatorGi,
                powerDist,
                espHandling,
                tankyard,
                coalBunker,
            });
            if (result?.error) {
                showToast('Error: ' + result.error, 'error');
            } else {
                showToast('Laporan berhasil disimpan!', 'success');
                lastSubmittedReportId.current = result?.reportId || null;
                refetch();
            }
        } catch (err) {
            showToast('Terjadi kesalahan saat menyimpan laporan.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveDraft = async () => {
        await handleSubmit();
    };

    const loadSampleData = () => {
        const d = SAMPLE_MALAM_01JAN;
        skipNextClear.current = true;
        setSelectedDate(d.date);
        setSelectedShift(d.shift);
        setBoilerA(d.boilerA);
        setBoilerB(d.boilerB);
        setTurbin(d.turbin);
        setSteamDist(d.steamDist);
        setGeneratorGi(d.generatorGi);
        setPowerDist(d.powerDist);
        setEspHandling(d.espHandling);
        setTankyard(d.tankyard);
        setCoalBunker(d.coalBunker);
        showToast('Data referensi Malam 01 Jan 2026 berhasil dimuat!', 'success');
    };

    return (
        <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 flex flex-col gap-6 h-full overflow-hidden">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
                    toast.type === 'success'
                        ? 'bg-emerald-600 border border-emerald-400/50 shadow-emerald-500/20'
                        : 'bg-red-600 border border-red-400/50 shadow-red-500/20'
                }`}>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">
                            {toast.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        {toast.message}
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="flex flex-col items-center justify-center gap-4 shrink-0 mt-4 mb-2">

                {/* Mode & Shift Controls */}
                <div className="flex items-center gap-3">
                    <div className="flex bg-[#16202e]/80 border border-slate-700/50 rounded-lg p-1">
                        <button
                            onClick={() => setInputMode('shift')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${inputMode === 'shift' ? 'bg-[#2b7cee] text-white shadow-[0_0_10px_rgba(43,124,238,0.3)]' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Shift
                        </button>
                        <button
                            onClick={() => setInputMode('harian')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${inputMode === 'harian' ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Harian
                        </button>
                    </div>

                    {inputMode === 'shift' && (
                        <div className="flex bg-[#16202e]/80 border border-slate-700/50 rounded-lg p-1">
                            {[
                                { id: 1, label: 'Pagi' },
                                { id: 2, label: 'Sore' },
                                { id: 3, label: 'Malam' }
                            ].map(shift => (
                                <button
                                    key={shift.id}
                                    onClick={() => setSelectedShift(shift.id as 1 | 2 | 3)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${selectedShift === shift.id ? 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    {shift.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="text-center flex flex-col items-center justify-center -mt-2">
                    <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-white dark:text-white mb-3">
                        {inputMode === 'shift' ? 'Input Laporan Shift' : 'Input Laporan Harian'}
                    </h2>
                    <div className="flex items-center justify-center gap-2 text-[#92a9c9]">
                        {inputMode === 'shift' ? (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#2b7cee]/20 text-[#2b7cee] border border-[#2b7cee]/20 uppercase">
                                SHIFT {selectedShift} ({selectedShift === 1 ? 'PAGI' : selectedShift === 2 ? 'SORE' : 'MALAM'})
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 uppercase">
                                REPORT HARIAN
                            </span>
                        )}
                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="bg-[#16202e]/80 border border-slate-700/50 rounded-md px-2 py-0.5 text-sm text-white font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer [color-scheme:dark]"
                        />
                        {mounted && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                <span className="text-sm font-mono text-slate-300">
                                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex gap-3 shrink-0 mt-2">
                    <button
                        onClick={loadSampleData}
                        className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-[0_0_10px_rgba(217,119,6,0.3)] border border-amber-500/50"
                    >
                        <span className="material-symbols-outlined text-[14px]">database</span>
                        Load Data Referensi
                    </button>
                    <button
                        onClick={handleSaveDraft}
                        disabled={submitting}
                        className={`flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-[0_0_10px_rgba(37,99,235,0.3)] border border-blue-500/50 ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <span className="material-symbols-outlined text-[14px]">drafts</span>
                        {submitting ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={`flex justify-center items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-[0_0_10px_rgba(16,185,129,0.3)] border border-emerald-400/50 ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <span className="material-symbols-outlined text-[14px]">send</span>
                        {submitting ? 'Submitting...' : 'Submit Report'}
                    </button>
                </div>
            </header>

            {/* Tab Bar */}
            <div className="shrink-0">
                <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-1">
                    <div className="flex flex-wrap gap-1">
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabId)}
                                    className={`px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${isActive
                                        ? 'font-bold bg-[#2b7cee]/20 text-[#2b7cee] border border-[#2b7cee]/30 shadow-inner shadow-[#2b7cee]/10'
                                        : 'font-medium text-[#92a9c9] hover:text-white hover:bg-[#1f2b3e] border border-transparent'
                                        }`}
                                >
                                    <span className={`material-symbols-outlined text-[16px] ${isActive ? 'text-[#2b7cee]' : ''}`}>
                                        {tab.icon}
                                    </span>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            {loading && (
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-4">
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Memuat data...
                </div>
            )}
            <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0 pb-6 w-full max-w-full">
                {activeTab === 'Boiler A' && <TabBoiler boilerId="A" values={boilerA} onFieldChange={makeNumberHandler(setBoilerA)} coalBunkerValues={coalBunker} onCoalBunkerChange={makeNumberHandler(setCoalBunker)} />}
                {activeTab === 'Boiler B' && <TabBoiler boilerId="B" values={boilerB} onFieldChange={makeNumberHandler(setBoilerB)} coalBunkerValues={coalBunker} onCoalBunkerChange={makeNumberHandler(setCoalBunker)} />}
                {activeTab === 'Turbin' && <TabTurbin values={turbin} onFieldChange={makeNumberHandler(setTurbin)} />}
                {activeTab === 'Generator' && <TabGenerator generatorValues={generatorGi} powerValues={powerDist} onGeneratorChange={makeNumberHandler(setGeneratorGi)} onPowerChange={makeNumberHandler(setPowerDist)} />}
                {activeTab === 'Distribusi Steam' && <TabDistribusiSteam values={steamDist} onFieldChange={makeNumberHandler(setSteamDist)} />}
                {activeTab === 'Handling' && <TabHandling espValues={espHandling} tankyardValues={tankyard} onEspChange={makeMixedHandler(setEspHandling)} onTankyardChange={makeNumberHandler(setTankyard)} />}
                {activeTab === 'ESP' && <TabESP values={espHandling} onFieldChange={makeMixedHandler(setEspHandling)} />}
                {activeTab === 'Coal Bunker' && <TabCoalBunker values={coalBunker} onFieldChange={makeNumberHandler(setCoalBunker)} />}
                {activeTab === 'Lab' && <TabLab waterQualityValues={waterQuality} chemicalDosingValues={chemicalDosing} onWaterQualityChange={makeNumberHandler(setWaterQuality)} onChemicalDosingChange={makeNumberHandler(setChemicalDosing)} />}
            </div>
        </div>
    );
}
