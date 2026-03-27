'use client';

import React, { useState, useEffect, useRef } from 'react';
import TabBoiler from '@/components/input-shift/TabBoiler';
import TabTurbin from '@/components/input-shift/TabTurbin';
import TabGenerator from '@/components/input-shift/TabGenerator';
import TabDistribusiSteam from '@/components/input-shift/TabDistribusiSteam';
import TabHandling from '@/components/input-shift/TabHandling';
import TabESP, { AshUnloadingEntry } from '@/components/input-shift/TabESP';
import TabCoalBunker from '@/components/input-shift/TabCoalBunker';
import TabLab from '@/components/input-shift/TabLab';
import { useShiftReport, usePreviousShiftData, useBunkerBerasapHistory } from '@/hooks/useShiftReport';
import { useOperator } from '@/hooks/useOperator';
import { createClient } from '@/lib/supabase/client';
import type { ShiftType } from '@/lib/supabase/types';
import { SAMPLE_MALAM_01JAN } from '@/lib/sampleData';
import InputHarianForm from '@/components/input-harian/InputHarianForm';

type TabId = 'Boiler A' | 'Boiler B' | 'Turbin' | 'Generator' | 'Distribusi Steam' | 'Handling' | 'ESP' | 'Coal Bunker' | 'Lab';

const TABS: { id: TabId; label: string; icon: string; colorClass: string }[] = [
    { id: 'Boiler A', label: 'Boiler A', icon: 'factory', colorClass: 'rose' },
    { id: 'Boiler B', label: 'Boiler B', icon: 'factory', colorClass: 'purple' },
    { id: 'Turbin', label: 'Turbin', icon: 'mode_fan', colorClass: 'cyan' },
    { id: 'Generator', label: 'Generator', icon: 'bolt', colorClass: 'amber' },
    { id: 'Distribusi Steam', label: 'Distribusi Steam', icon: 'water_drop', colorClass: 'blue' },
    { id: 'Handling', label: 'Coal Handling', icon: 'local_shipping', colorClass: 'orange' },
    { id: 'ESP', label: 'ESP', icon: 'air', colorClass: 'stone' },
    { id: 'Coal Bunker', label: 'Coal Bunker', icon: 'inventory_2', colorClass: 'indigo' },
    { id: 'Lab', label: 'Lab / QC', icon: 'science', colorClass: 'teal' },
];

const TAB_STYLES: Record<string, { active: string; inactive: string; icon: string }> = {
    'rose': { active: 'font-bold bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-inner shadow-rose-500/10', inactive: 'font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border-transparent', icon: 'text-rose-400' },
    'purple': { active: 'font-bold bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-inner shadow-purple-500/10', inactive: 'font-medium text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 border-transparent', icon: 'text-purple-400' },
    'cyan': { active: 'font-bold bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-inner shadow-cyan-500/10', inactive: 'font-medium text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border-transparent', icon: 'text-cyan-400' },
    'amber': { active: 'font-bold bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-inner shadow-amber-500/10', inactive: 'font-medium text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 border-transparent', icon: 'text-amber-400' },
    'blue': { active: 'font-bold bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-inner shadow-blue-500/10', inactive: 'font-medium text-slate-400 hover:text-blue-300 hover:bg-blue-500/10 border-transparent', icon: 'text-blue-400' },
    'orange': { active: 'font-bold bg-orange-500/20 text-orange-400 border-orange-500/30 shadow-inner shadow-orange-500/10', inactive: 'font-medium text-slate-400 hover:text-orange-300 hover:bg-orange-500/10 border-transparent', icon: 'text-orange-400' },
    'stone': { active: 'font-bold bg-stone-500/20 text-stone-400 border-stone-500/30 shadow-inner shadow-stone-500/10', inactive: 'font-medium text-slate-400 hover:text-stone-300 hover:bg-stone-500/10 border-transparent', icon: 'text-stone-400' },
    'indigo': { active: 'font-bold bg-indigo-500/20 text-indigo-400 border-indigo-500/30 shadow-inner shadow-indigo-500/10', inactive: 'font-medium text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 border-transparent', icon: 'text-indigo-400' },
    'teal': { active: 'font-bold bg-teal-500/20 text-teal-400 border-teal-500/30 shadow-inner shadow-teal-500/10', inactive: 'font-medium text-slate-400 hover:text-teal-300 hover:bg-teal-500/10 border-transparent', icon: 'text-teal-400' },
};

export default function InputShiftPage() {
    const [activeTab, setActiveTab] = useState<TabId>('Boiler A');
    const [inputMode, setInputMode] = useState<'shift' | 'harian'>('shift');
    const [selectedShift, setSelectedShift] = useState<1 | 2 | 3>(() => {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 14) return 1;   // 06.00 Malam
        if (hour >= 14 && hour < 22) return 2;   // 14.00 Pagi
        return 3;                                 // 22.00 Sore
    });
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
    const [coalBunker, setCoalBunker] = useState<Record<string, number | string | null>>({});
    const [waterQuality, setWaterQuality] = useState<Record<string, number | null>>({});
    const [chemicalDosing, setChemicalDosing] = useState<Record<string, number | null>>({});
    const [solarEntries, setSolarEntries] = useState<{ tanggal: string; jumlah: number | null; perusahaan: string }[]>([]);
    const [ashEntries, setAshEntries] = useState<AshUnloadingEntry[]>([]);

    // Shift mapping: button order matches chronological report time
    // 06.00 → shift malam (night shift makes 06.00 report)
    // 14.00 → shift pagi  (morning shift makes 14.00 report)
    // 22.00 → shift sore  (afternoon shift makes 22.00 report)
    const shiftMap: Record<number, ShiftType> = { 1: 'malam', 2: 'pagi', 3: 'sore' };
    const SHIFT_LABELS: Record<number, string> = { 1: 'Shift Malam 06.00', 2: 'Shift Pagi 14.00', 3: 'Shift Sore 22.00' };
    const { report, loading, submitReport, refetch } = useShiftReport(selectedDate, shiftMap[selectedShift]);
    const { prevBoilerA, prevBoilerB, prevCoalBunker, prevTurbin, prevSteamDist, prevPowerDist } = usePreviousShiftData(selectedDate, shiftMap[selectedShift]);
    const bunkerBerasapSince = useBunkerBerasapHistory(selectedDate, shiftMap[selectedShift]);
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
        setSolarEntries([]);
        setAshEntries([]);
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
        if (coalData) setCoalBunker(extractFields(coalData as unknown as Record<string, unknown>) as Record<string, number | string | null>);

        // Load water quality & chemical dosing from shift_water_quality
        const wqData = report.shift_water_quality?.[0];
        if (wqData) {
            const allFields = extractFields(wqData as unknown as Record<string, unknown>) as Record<string, number | null>;
            const chemKeys = ['phosphate_', 'phosphate_b_', 'amine_', 'hydrazine_'];
            const wqFields: Record<string, number | null> = {};
            const cdFields: Record<string, number | null> = {};
            for (const [k, v] of Object.entries(allFields)) {
                if (chemKeys.some(prefix => k.startsWith(prefix))) {
                    cdFields[k] = v;
                } else {
                    wqFields[k] = v;
                }
            }
            setWaterQuality(wqFields);
            setChemicalDosing(cdFields);
        }
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
                waterQuality: { ...waterQuality, ...chemicalDosing },
            });
            // Save solar unloadings if filled
            const validSolarEntries = solarEntries.filter(e => e.tanggal && e.jumlah && e.perusahaan);
            if (validSolarEntries.length > 0) {
                const supabase = createClient();
                const inserts = validSolarEntries.map(entry => ({
                    date: entry.tanggal,
                    liters: entry.jumlah,
                    supplier: entry.perusahaan,
                    operator_id: operator?.id != null ? String(operator.id) : null,
                }));
                await supabase.from('solar_unloadings').insert(inserts as any[]);
            }

            // Save ash unloadings if filled
            const validAshEntries = ashEntries.filter(e => e.silo && e.perusahaan && e.tujuan && e.ritase !== null);
            if (validAshEntries.length > 0) {
                const supabase = createClient();
                const ashInserts = validAshEntries.map(entry => ({
                    date: selectedDate,
                    shift: shiftMap[selectedShift],
                    silo: entry.silo,
                    perusahaan: entry.perusahaan,
                    tujuan: entry.tujuan,
                    ritase: entry.ritase,
                    operator_id: operator?.id != null ? String(operator.id) : null,
                }));
                await supabase.from('ash_unloadings').insert(ashInserts as any[]);
            }

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

    // ─── Tab Completeness Checker ───
    const isTabLengkap = React.useCallback((tabId: TabId) => {
        const hasVal = (obj: Record<string, any>, keys: string[]) => keys.every(k => obj[k] !== null && obj[k] !== undefined && obj[k] !== '');
        
        switch (tabId) {
            case 'Boiler A': return hasVal(boilerA, ['press_steam', 'flow_steam']);
            case 'Boiler B': return hasVal(boilerB, ['press_steam', 'flow_steam']);
            case 'Turbin': return hasVal(turbin, ['flow_steam', 'vacuum']);
            case 'Generator': return hasVal(generatorGi, ['gen_load']);
            case 'Distribusi Steam': return hasVal(steamDist, ['pabrik1_flow']);
            case 'Handling': return hasVal(tankyard, ['tk_rcw', 'tk_demin']);
            case 'ESP': return hasVal(espHandling, ['esp_a1']);
            case 'Coal Bunker': return hasVal(coalBunker, ['feeder_a', 'bunker_a']);
            case 'Lab': return hasVal(waterQuality, ['demin_1250_ph', 'demin_750_ph']);
            default: return false;
        }
    }, [boilerA, boilerB, turbin, generatorGi, steamDist, tankyard, espHandling, coalBunker, waterQuality]);

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
        setAshEntries([]);
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
                                { id: 1, label: 'Shift Malam 06.00' },
                                { id: 2, label: 'Shift Pagi 14.00' },
                                { id: 3, label: 'Shift Sore 22.00' }
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
                                {SHIFT_LABELS[selectedShift].toUpperCase()}
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
                {/* Intentionally removed buttons from header, moving them to sidebar */}
            </header>

            {inputMode === 'shift' ? (
                <div className="flex flex-col lg:flex-row gap-6 w-full max-w-full">
                    {/* Left Sidebar */}
                    <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
                        {/* Action Buttons */}
                        <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
                            <div>
                                <h3 className="text-white font-bold text-sm mb-1">Menu Laporan</h3>
                                <p className="text-[11px] text-slate-400 leading-tight">Pilih kategori area untuk mulai input data shift.</p>
                            </div>
                            <div className="flex flex-col gap-2 mt-1">
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className={`flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-lg text-sm font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-emerald-500/50 w-full ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className="material-symbols-outlined text-[20px]">send</span>
                                    {submitting ? 'Mengirim...' : 'Kirim Laporan'}
                                </button>
                            </div>
                        </div>

                        {/* Desktop Tab List */}
                        <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-2 shadow-lg hidden lg:flex flex-col gap-1">
                            {TABS.map((tab) => {
                                const isActive = activeTab === tab.id;
                                const isComplete = isTabLengkap(tab.id);
                                const styles = TAB_STYLES[tab.colorClass];
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as TabId)}
                                        className={`w-full text-left px-4 py-3 rounded-lg text-sm flex items-center gap-3 transition-all border relative overflow-hidden group ${isActive ? styles.active : styles.inactive}`}
                                    >
                                        <span className={`material-symbols-outlined text-[20px] ${isActive ? styles.icon : 'opacity-70 group-hover:opacity-100 transition-opacity'}`}>
                                            {tab.icon}
                                        </span>
                                        <span className="flex-1">{tab.label}</span>
                                        {isComplete && (
                                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 mr-1 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                                                <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                            </div>
                                        )}
                                        {isActive && <span className="material-symbols-outlined text-[16px] opacity-70">chevron_right</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Mobile Tab List */}
                        <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-2 shadow-lg lg:hidden overflow-x-auto">
                            <div className="flex gap-2 w-max pb-1">
                                {TABS.map((tab) => {
                                    const isActive = activeTab === tab.id;
                                    const isComplete = isTabLengkap(tab.id);
                                    const styles = TAB_STYLES[tab.colorClass];
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as TabId)}
                                            className={`px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-all whitespace-nowrap border relative overflow-hidden ${isActive ? styles.active : styles.inactive}`}
                                        >
                                            <span className={`material-symbols-outlined text-[18px] ${isActive ? styles.icon : 'opacity-70'}`}>
                                                {tab.icon}
                                            </span>
                                            <span>{tab.label}</span>
                                            {isComplete && (
                                                <div className="flex items-center justify-center w-4 h-4 ml-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400">
                                                    <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Tab Content Area */}
                    <div className="flex-1 min-w-0 flex flex-col gap-4">
                        {/* Active Tab Header */}
                        <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl px-5 py-4 flex items-center gap-4 shadow-lg">
                            {(() => {
                                const tab = TABS.find(t => t.id === activeTab);
                                const styles = tab ? TAB_STYLES[tab.colorClass] : TAB_STYLES['rose'];
                                return (
                                    <>
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-[#101822] border border-slate-700/50 shadow-inner`}>
                                            <span className={`material-symbols-outlined text-[26px] ${styles.icon}`}>{tab?.icon}</span>
                                        </div>
                                        <div>
                                            <h2 className="text-white font-bold text-xl leading-tight">{tab?.label}</h2>
                                            <p className="text-slate-400 text-xs mt-0.5">Input data operasional shift {tab?.label}</p>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Loading */}
                        {loading && (
                            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-4 bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl">
                                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                                Memuat data shift...
                            </div>
                        )}

                        {/* Shift Tab Content */}
                        <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0 pb-6 w-full max-w-full">
                            {activeTab === 'Boiler A' && <TabBoiler boilerId="A" values={boilerA} onFieldChange={makeNumberHandler(setBoilerA)} coalBunkerValues={coalBunker as Record<string, number | null>} onCoalBunkerChange={makeMixedHandler(setCoalBunker)} prevTotalizerSteam={prevBoilerA.totalizer_steam} prevTotalizerBfw={prevBoilerA.totalizer_bfw} prevCoalBunkerValues={prevCoalBunker} />}
                            {activeTab === 'Boiler B' && <TabBoiler boilerId="B" values={boilerB} onFieldChange={makeNumberHandler(setBoilerB)} coalBunkerValues={coalBunker as Record<string, number | null>} onCoalBunkerChange={makeMixedHandler(setCoalBunker)} prevTotalizerSteam={prevBoilerB.totalizer_steam} prevTotalizerBfw={prevBoilerB.totalizer_bfw} prevCoalBunkerValues={prevCoalBunker} />}
                            {activeTab === 'Turbin' && <TabTurbin values={turbin} onFieldChange={makeNumberHandler(setTurbin)} prevTotalizerSteamInlet={prevTurbin.totalizer_steam_inlet} prevTotalizerCondensate={prevTurbin.totalizer_condensate} />}
                            {activeTab === 'Generator' && <TabGenerator generatorValues={generatorGi} powerValues={powerDist} onGeneratorChange={makeNumberHandler(setGeneratorGi)} onPowerChange={makeNumberHandler(setPowerDist)} prevPowerDist={prevPowerDist} genLoad={Number(generatorGi.gen_load) || null} />}
                            {activeTab === 'Distribusi Steam' && <TabDistribusiSteam values={steamDist} onFieldChange={makeNumberHandler(setSteamDist)} prevTotalizerPabrik1={prevSteamDist.pabrik1_totalizer} prevTotalizerPabrik2={prevSteamDist.pabrik2_totalizer} prevTotalizerPabrik3={prevSteamDist.pabrik3a_totalizer} />}
                            {activeTab === 'Handling' && <TabHandling espValues={espHandling} tankyardValues={tankyard} onEspChange={makeMixedHandler(setEspHandling)} onTankyardChange={makeNumberHandler(setTankyard)} solarEntries={solarEntries} onSolarEntriesChange={setSolarEntries} />}
                            {activeTab === 'ESP' && <TabESP values={espHandling} onFieldChange={makeMixedHandler(setEspHandling)} ashEntries={ashEntries} onAshEntriesChange={setAshEntries} />}
                            {activeTab === 'Coal Bunker' && <TabCoalBunker values={coalBunker} onFieldChange={makeMixedHandler(setCoalBunker)} onStatusChange={(name, value) => setCoalBunker(prev => ({ ...prev, [name]: value }))} berasapSince={bunkerBerasapSince} />}
                            {activeTab === 'Lab' && <TabLab waterQualityValues={waterQuality} chemicalDosingValues={chemicalDosing} onWaterQualityChange={makeNumberHandler(setWaterQuality)} onChemicalDosingChange={makeNumberHandler(setChemicalDosing)} />}
                        </div>
                    </div>
                </div>
            ) : (
                <InputHarianForm date={selectedDate} operator={operator} />
            )}
        </div>
    );
}
