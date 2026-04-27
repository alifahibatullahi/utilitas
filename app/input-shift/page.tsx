'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import type { ShiftType, SolarUnloadingRow, SolarUsageRow } from '@/lib/supabase/types';
import { SAMPLE_MALAM_01JAN } from '@/lib/sampleData';
import InputHarianForm from '@/components/input-harian/InputHarianForm';
import { getGroupForShift, getGroupShiftOnDate } from '@/lib/constants';

function getGroupMalamOnDate(dateStr: string): string {
    for (const g of ['A', 'B', 'C', 'D'] as const) {
        if (getGroupShiftOnDate(g, dateStr) === 'M') return g;
    }
    return '';
}

type TabId = 'Boiler A' | 'Boiler B' | 'Turbin' | 'Generator' | 'Distribusi Steam' | 'Handling' | 'ESP' | 'Coal Bunker' | 'Lab';

const TABS: { id: TabId; label: string; icon: string; colorClass: string }[] = [
    { id: 'Boiler A', label: 'Boiler A', icon: 'factory', colorClass: 'rose' },
    { id: 'Boiler B', label: 'Boiler B', icon: 'factory', colorClass: 'purple' },
    { id: 'Turbin', label: 'Turbin', icon: 'mode_fan', colorClass: 'cyan' },
    { id: 'Distribusi Steam', label: 'Distribusi Steam', icon: 'water_drop', colorClass: 'blue' },
    { id: 'Generator', label: 'Generator', icon: 'bolt', colorClass: 'amber' },
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
    
    // Header specific states — persist to localStorage
    const [supervisor, setSupervisor] = useState(() => {
        if (typeof window === 'undefined') return '';
        try { return localStorage.getItem('shift_supervisor') || ''; } catch { return ''; }
    });
    const [foremanBoiler, setForemanBoiler] = useState(() => {
        if (typeof window === 'undefined') return '';
        try { return localStorage.getItem('shift_foreman_boiler') || ''; } catch { return ''; }
    });
    const [foremanTurbin, setForemanTurbin] = useState(() => {
        if (typeof window === 'undefined') return '';
        try { return localStorage.getItem('shift_foreman_turbin') || ''; } catch { return ''; }
    });

    const skipNextClear = useRef(false);
    const lastSubmittedReportId = useRef<string | null>(null);

    useEffect(() => { setMounted(true); }, []);

    // Persist supervisor/foreman ke localStorage
    useEffect(() => {
        try {
            localStorage.setItem('shift_supervisor', supervisor);
        } catch { /* ignore */ }
    }, [supervisor]);

    useEffect(() => {
        try {
            localStorage.setItem('shift_foreman_boiler', foremanBoiler);
        } catch { /* ignore */ }
    }, [foremanBoiler]);

    useEffect(() => {
        try {
            localStorage.setItem('shift_foreman_turbin', foremanTurbin);
        } catch { /* ignore */ }
    }, [foremanTurbin]);

    // NOTE: Sheets sync dihapus — alur sekarang: input form → Supabase (sumber data utama) → Sheets (fire-and-forget).
    // Data yang tampil di form selalu diambil dari Supabase melalui useShiftReport.

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
    const [outSolarEntries, setOutSolarEntries] = useState<{ tanggal: string; jumlah: number | null; tujuan: string }[]>([]);
    const [savedSolarEntries, setSavedSolarEntries] = useState<{ id?: string; tanggal: string; jumlah: number | null; perusahaan: string }[]>([]);
    const [savedOutSolarEntries, setSavedOutSolarEntries] = useState<{ id?: string; tanggal: string; jumlah: number | null; tujuan: string }[]>([]);
    const [ashEntries, setAshEntries] = useState<AshUnloadingEntry[]>([]);
    const [savedAshEntries, setSavedAshEntries] = useState<AshUnloadingEntry[]>([]);
    const [lastStock, setLastStock] = useState<{ phosphate: number | null; amine: number | null; hydrazine: number | null }>({ phosphate: null, amine: null, hydrazine: null });

    // Shift mapping: button order matches chronological report time
    // 06.00 → shift malam (night shift makes 06.00 report)
    // 14.00 → shift pagi  (morning shift makes 14.00 report)
    // 22.00 → shift sore  (afternoon shift makes 22.00 report)
    const shiftMap: Record<number, ShiftType> = { 1: 'malam', 2: 'pagi', 3: 'sore' };
    const SHIFT_LABELS: Record<number, string> = { 1: 'Shift Malam 06.00', 2: 'Shift Pagi 14.00', 3: 'Shift Sore 22.00' };
    const { report, loading, submitReport, refetch } = useShiftReport(selectedDate, shiftMap[selectedShift]);
    const { prevBoilerA, prevBoilerB, prevCoalBunker, prevTurbin, prevSteamDist, prevPowerDist } = usePreviousShiftData(selectedDate, shiftMap[selectedShift]);
    const bunkerBerasapSince = useBunkerBerasapHistory(selectedDate, shiftMap[selectedShift]);
    const { operator, operators } = useOperator();

    // Auto-kalkulasi grup dari pola jadwal shift
    const currentGroup = getGroupForShift(selectedDate, shiftMap[selectedShift]);

    // Supervisor: semua yg jabatan Supervisor atau Foreman
    const supervisorOptions = operators.filter(op =>
        op.jabatan === 'Supervisor' || op.jabatan?.startsWith('Foreman')
    );
    // Foreman Boiler: organik UBB dengan jabatan Foreman Boiler atau operator biasa (tanpa jabatan)
    const foremanBoilerOptions = operators.filter(op =>
        op.company === 'UBB' && (op.jabatan === 'Foreman Boiler' || !op.jabatan)
    );
    // Foreman Turbin: organik UBB dengan jabatan Foreman Turbin atau operator biasa (tanpa jabatan)
    const foremanTurbinOptions = operators.filter(op =>
        op.company === 'UBB' && (op.jabatan === 'Foreman Turbin' || !op.jabatan)
    );
    const router = useRouter();

    // Fetch saved ash unloadings and solar for current date+shift
    useEffect(() => {
        const supabase = createClient();
        
        supabase
            .from('ash_unloadings')
            .select('id, silo, perusahaan, tujuan, ritase')
            .eq('date', selectedDate)
            .eq('shift', shiftMap[selectedShift])
            .order('created_at', { ascending: true })
            .then(({ data }) => setSavedAshEntries((data ?? []).map((r: any) => ({ id: r.id, silo: r.silo, perusahaan: r.perusahaan, tujuan: r.tujuan, ritase: r.ritase }))));

        supabase
            .from('solar_unloadings')
            .select('id, date, supplier, liters')
            .eq('date', selectedDate)
            .eq('shift', shiftMap[selectedShift])
            .order('created_at', { ascending: true })
            .then(({ data }) => setSavedSolarEntries((data ?? []).map((r: any) => ({ id: r.id, tanggal: r.date, jumlah: r.liters, perusahaan: r.supplier }))));

        supabase
            .from('solar_usages')
            .select('id, date, tujuan, liters')
            .eq('date', selectedDate)
            .eq('shift', shiftMap[selectedShift])
            .order('created_at', { ascending: true })
            .then(({ data }) => setSavedOutSolarEntries((data ?? []).map((r: any) => ({ id: r.id, tanggal: r.date, jumlah: r.liters, tujuan: r.tujuan }))));

    }, [selectedDate, selectedShift]);

    // Fetch last known chemical stock (latest shift report with non-null stock)
    useEffect(() => {
        const supabase = createClient();
        supabase
            .from('shift_water_quality')
            .select('stock_phosphate, stock_amine, stock_hydrazine')
            .not('stock_phosphate', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .then(({ data }) => {
                if (data && data[0]) {
                    setLastStock({
                        phosphate: data[0].stock_phosphate as number | null,
                        amine: data[0].stock_amine as number | null,
                        hydrazine: data[0].stock_hydrazine as number | null,
                    });
                }
            });
    }, []);

    // ─── Delete handlers untuk entri yang sudah tersimpan di DB ───
    const handleDeleteSavedAsh = async (id: string) => {
        if (!confirm('Hapus data unloading ini?')) return;
        const supabase = createClient();
        const { error } = await supabase.from('ash_unloadings').delete().eq('id', id);
        if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }
        setSavedAshEntries(prev => prev.filter(e => e.id !== id));
    };
    const handleDeleteSavedSolar = async (id: string) => {
        if (!confirm('Hapus data kedatangan solar ini?')) return;
        const supabase = createClient();
        const { error } = await supabase.from('solar_unloadings').delete().eq('id', id);
        if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }
        setSavedSolarEntries(prev => prev.filter(e => e.id !== id));
    };
    const handleDeleteSavedOutSolar = async (id: string) => {
        if (!confirm('Hapus data permintaan solar ini?')) return;
        const supabase = createClient();
        const { error } = await supabase.from('solar_usages').delete().eq('id', id);
        if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }
        setSavedOutSolarEntries(prev => prev.filter(e => e.id !== id));
    };

    // ─── Navigation Guard ───
    const [showNavWarning, setShowNavWarning] = useState(false);
    const [userModified, setUserModified] = useState(false);
    const userModifiedRef = useRef(false);
    const bypassNavRef = useRef(false);
    const pendingNavUrl = useRef<string | null>(null);

    useEffect(() => { userModifiedRef.current = userModified; }, [userModified]);

    // Patch history.pushState once to intercept SPA navigation
    useEffect(() => {
        const originalPushState = history.pushState.bind(history);
        history.pushState = function(state: unknown, title: string, url?: string | URL | null) {
            const targetUrl = url ? String(url) : '';
            if (!userModifiedRef.current || bypassNavRef.current || !targetUrl || targetUrl.includes('/input-shift')) {
                originalPushState(state, title, url);
                return;
            }
            pendingNavUrl.current = targetUrl;
            setShowNavWarning(true);
        };
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!userModifiedRef.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            history.pushState = originalPushState;
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    // Restore supervisor/foreman dari report data jika sudah ada (setelah report loaded via useShiftReport)
    useEffect(() => {
        if (!report) return;
        if (report.supervisor) setSupervisor(report.supervisor);
        const personnel = (report as any).shift_personnel?.[0];
        if (personnel?.turbin_karu) setForemanTurbin(personnel.turbin_karu);
        if (personnel?.boiler_karu) setForemanBoiler(personnel.boiler_karu);
    }, [report]);

    const handleNavLeave = useCallback(() => {
        bypassNavRef.current = true;
        const url = pendingNavUrl.current!;
        setShowNavWarning(false);
        router.push(url);
    }, [router]);

    const handleNavStay = useCallback(() => {
        setShowNavWarning(false);
        pendingNavUrl.current = null;
    }, []);

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

    // Clear form immediately when date/shift changes
    useEffect(() => {
        if (skipNextClear.current) {
            skipNextClear.current = false;
            return;
        }
        setUserModified(false);
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
        setOutSolarEntries([]);
        setAshEntries([]);
        setSupervisor('');
        setForemanBoiler('');
        setForemanTurbin('');
    }, [selectedShift, selectedDate]);

    // Populate form when report data arrives from Supabase
    useEffect(() => {
        // Jangan overwrite input user yang sedang diketik
        if (userModifiedRef.current) return;

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
            const chemKeys = ['phosphate_', 'phosphate_b_', 'amine_', 'hydrazine_', 'stock_'];
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
            setUserModified(true);
            setter(prev => ({
                ...prev,
                [name]: typeof value === 'string'
                    ? (value === '' ? null : parseFloat(value) ?? null)
                    : value,
            }));
        };

    const makeMixedHandler = (setter: React.Dispatch<React.SetStateAction<Record<string, number | string | null>>>) =>
        (name: string, value: number | string | null) => {
            setUserModified(true);
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
            // Hitung selisih totalizer feeder (current - prev) sebagai konsumsi batubara shift ini
            const selisih = (key: string) => {
                const cur = Number(coalBunker[key]) || 0;
                const prev = Number(prevCoalBunker[key]) || 0;
                return prev > 0 ? cur - prev : 0;
            };
            const batubaraA = selisih('feeder_a') + selisih('feeder_b') + selisih('feeder_c');
            const batubaraB = selisih('feeder_d') + selisih('feeder_e') + selisih('feeder_f');

            // Total rit unloading fly ash per silo (saved + pending)
            const allAsh = [
                ...savedAshEntries,
                ...ashEntries.filter(e => e.silo && e.perusahaan && e.tujuan && e.ritase !== null),
            ];
            const totalRitA = allAsh.filter(e => e.silo === 'A').reduce((s, e) => s + (e.ritase ?? 0), 0);
            const totalRitB = allAsh.filter(e => e.silo === 'B').reduce((s, e) => s + (e.ritase ?? 0), 0);

            const result = await submitReport({
                group_name: currentGroup || operator?.group || 'A',
                supervisor: supervisor || operator?.name || 'Operator',
                created_by: operator?.supabaseId || '',
                boilerA: { ...boilerA, batubara_ton: batubaraA },
                boilerB: { ...boilerB, batubara_ton: batubaraB },
                turbin,
                steamDist,
                generatorGi,
                powerDist,
                espHandling: { hopper: 'A', conveyor: 'AB', ...espHandling, unloading_a: totalRitA, unloading_b: totalRitB },
                tankyard,
                personnel: {
                    turbin_grup: currentGroup || operator?.group || null,
                    turbin_karu: foremanTurbin || null,
                    turbin_kasi: supervisor || null,
                    boiler_grup: currentGroup || operator?.group || null,
                    boiler_karu: foremanBoiler || null,
                    boiler_kasi: supervisor || null,
                },
                coalBunker,
                waterQuality: { ...waterQuality, ...chemicalDosing },
                prevBoilerA: { totalizer_steam: prevBoilerA.totalizer_steam ?? null },
                prevBoilerB: { totalizer_steam: prevBoilerB.totalizer_steam ?? null },
            });
            // Save solar unloadings if filled
            const validSolarEntries = solarEntries.filter(e => e.tanggal && e.jumlah && e.perusahaan);
            if (validSolarEntries.length > 0) {
                const supabase = createClient();
                const inserts = validSolarEntries.map(entry => ({
                    date: selectedDate, // Store the shift date for filtering
                    shift: shiftMap[selectedShift],
                    date_time: entry.tanggal, // if table structure doesn't support multiple, we rely on the migration adding shift. Wait, 'date' is used usually for timestamp in old inserts. I'll use entry.tanggal for date because the table is date TEXT.
                    liters: entry.jumlah,
                    supplier: entry.perusahaan,
                    operator_id: operator?.supabaseId ?? null,
                }));
                // Make sure to correctly map to expected 'date' column with ISO time, but wait, if we changed it to use date as YYYY-MM-DD we'd break old code. Let's send the entry.tanggal as date, and passing shift explicitly. 
                await supabase.from('solar_unloadings').insert(inserts.map(i => ({ date: selectedDate, liters: i.liters, supplier: i.supplier, shift: i.shift, operator_id: i.operator_id })) as any[]);
            }

            // Save solar usages if filled
            const validOutSolarEntries = outSolarEntries.filter(e => e.tanggal && e.jumlah && e.tujuan);
            if (validOutSolarEntries.length > 0) {
                const supabase = createClient();
                const outInserts = validOutSolarEntries.map(entry => ({
                    date: entry.tanggal, // This saves exact time string
                    shift: shiftMap[selectedShift],
                    liters: entry.jumlah,
                    tujuan: entry.tujuan,
                    operator_id: operator?.supabaseId ?? null,
                }));
                await supabase.from('solar_usages').insert(outInserts as any[]);
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
                    operator_id: operator?.supabaseId ?? null,
                }));
                await supabase.from('ash_unloadings').insert(ashInserts as any[]);
            }

            if (result?.error) {
                showToast('Error: ' + result.error, 'error');
            } else {
                showToast('Laporan berhasil disimpan!', 'success');
                setUserModified(false);
                lastSubmittedReportId.current = result?.reportId || null;
                refetch();
                // Refresh saved data
                const spb = createClient();
                spb.from('ash_unloadings').select('id, silo, perusahaan, tujuan, ritase')
                    .eq('date', selectedDate).eq('shift', shiftMap[selectedShift])
                    .order('created_at', { ascending: true })
                    .then(({ data }) => setSavedAshEntries((data ?? []).map((r: any) => ({ id: r.id, silo: r.silo, perusahaan: r.perusahaan, tujuan: r.tujuan, ritase: r.ritase }))));

                spb.from('solar_unloadings').select('id, date, supplier, liters')
                    .eq('date', selectedDate).eq('shift', shiftMap[selectedShift])
                    .order('created_at', { ascending: true })
                    .then(({ data }) => setSavedSolarEntries((data ?? []).map((r: any) => ({ id: r.id, tanggal: r.date, jumlah: r.liters, perusahaan: r.supplier }))));

                spb.from('solar_usages').select('id, date, tujuan, liters')
                    .eq('date', selectedDate).eq('shift', shiftMap[selectedShift])
                    .order('created_at', { ascending: true })
                    .then(({ data }) => setSavedOutSolarEntries((data ?? []).map((r: any) => ({ id: r.id, tanggal: r.date, jumlah: r.liters, tujuan: r.tujuan }))));

                setAshEntries([]);
                setSolarEntries([]);
                setOutSolarEntries([]);
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

    const isTabLengkap = React.useCallback((tabId: TabId) => {
        const hasVal = (obj: Record<string, any>, keys: string[]) => keys.every(k => obj[k] !== null && obj[k] !== undefined && obj[k] !== '');
        
        switch (tabId) {
            case 'Boiler A': return hasVal(boilerA, ['press_steam', 'temp_steam', 'flow_steam', 'totalizer_steam', 'bfw_press', 'temp_bfw', 'flow_bfw', 'totalizer_bfw', 'temp_furnace', 'air_heater_ti113', 'excess_air', 'temp_flue_gas', 'primary_air', 'secondary_air', 'o2', 'steam_drum_press']) && hasVal(coalBunker, ['feeder_a', 'feeder_b', 'feeder_c']);
            case 'Boiler B': return hasVal(boilerB, ['press_steam', 'temp_steam', 'flow_steam', 'totalizer_steam', 'bfw_press', 'temp_bfw', 'flow_bfw', 'totalizer_bfw', 'temp_furnace', 'air_heater_ti113', 'excess_air', 'temp_flue_gas', 'primary_air', 'secondary_air', 'o2', 'steam_drum_press']) && hasVal(coalBunker, ['feeder_d', 'feeder_e', 'feeder_f']);
            case 'Turbin': return hasVal(turbin, ['press_steam', 'temp_steam', 'flow_steam', 'totalizer_steam_inlet', 'flow_cond', 'exh_steam', 'vacuum', 'level_condenser', 'hpo_durasi', 'totalizer_condensate', 'thrust_bearing', 'metal_bearing', 'vibrasi', 'winding', 'axial_displacement', 'press_deaerator', 'temp_deaerator', 'press_lps', 'temp_cw_in', 'temp_cw_out']);
            case 'Generator': return hasVal(generatorGi, ['gen_load', 'gen_ampere', 'gen_tegangan', 'gen_amp_react', 'gen_frequensi', 'gen_cos_phi', 'gi_sum_p', 'gi_sum_q', 'gi_cos_phi']) && hasVal(powerDist, ['power_ubb_totalizer', 'power_pabrik2_totalizer', 'power_pabrik3a_totalizer', 'power_revamping_totalizer', 'power_pie_totalizer']);
            case 'Distribusi Steam': return hasVal(steamDist, ['pabrik1_flow', 'pabrik1_temp', 'pabrik1_totalizer', 'pabrik2_flow', 'pabrik2_temp', 'pabrik2_totalizer', 'pabrik3a_flow', 'pabrik3a_temp', 'pabrik3a_totalizer']);
            case 'Handling': return hasVal(espHandling, ['loading', 'hopper', 'conveyor']) && hasVal(tankyard, ['tk_rcw', 'tk_demin', 'tk_solar_ab']);
            case 'ESP': return hasVal(espHandling, ['esp_a1', 'esp_a2', 'esp_a3', 'esp_b1', 'esp_b2', 'esp_b3', 'silo_a', 'silo_b']);
            case 'Coal Bunker': return hasVal(coalBunker, ['bunker_a', 'bunker_b', 'bunker_c', 'bunker_d', 'bunker_e', 'bunker_f']);
            case 'Lab': return hasVal(waterQuality, ['demin_1250_ph', 'demin_1250_conduct', 'bfw_ph', 'bfw_conduct', 'boiler_water_a_ph', 'boiler_water_b_ph', 'product_steam_ph']) && hasVal(chemicalDosing, ['phosphate_level_tanki', 'phosphate_stroke_pompa', 'phosphate_b_level_tanki', 'phosphate_b_stroke_pompa', 'amine_level_tanki', 'amine_stroke_pompa', 'hydrazine_level_tanki', 'hydrazine_stroke_pompa']);
            default: return false;
        }
    }, [boilerA, boilerB, turbin, generatorGi, powerDist, steamDist, tankyard, espHandling, coalBunker, waterQuality, chemicalDosing]);

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
        setSolarEntries([]);
        setOutSolarEntries([]);
        showToast('Data referensi Malam 01 Jan 2026 berhasil dimuat!', 'success');
    };

    return (
        <div className="flex-1 w-full max-w-[1366px] mx-auto p-4 lg:p-6 flex flex-col gap-4 h-full overflow-hidden">
            {/* Loading Overlay */}
            {submitting && (
                <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
                    <div className="relative flex flex-col items-center justify-center bg-[#16202e] border border-slate-700/50 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95">
                        <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-2xl pointer-events-none"></div>
                        <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                        <h3 className="text-white font-black text-xl tracking-wide mb-2 relative z-10">Menyimpan data</h3>
                        <p className="text-slate-400 text-sm font-medium animate-pulse relative z-10">Mohon tunggu sebentar...</p>
                    </div>
                </div>
            )}

            {/* Navigation Warning Modal */}
            {showNavWarning && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[#16202e] border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-400 text-[22px]">warning</span>
                            </div>
                            <h3 className="text-white font-extrabold text-base">Data Belum Dikirim</h3>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed mb-5">
                            Kamu belum mengirim laporan shift. Data yang sudah diisi akan <span className="text-rose-400 font-semibold">hilang</span> jika pindah halaman.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleNavStay}
                                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-bold hover:bg-slate-700/50 transition-colors cursor-pointer"
                            >
                                Kembali
                            </button>
                            <button
                                onClick={handleNavLeave}
                                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-colors cursor-pointer"
                            >
                                Tinggalkan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className={`px-8 py-5 rounded-2xl shadow-2xl text-white text-base font-semibold transition-all scale-100 pointer-events-auto ${
                        toast.type === 'success'
                            ? 'bg-emerald-600 border border-emerald-400/50 shadow-emerald-500/30'
                            : 'bg-red-600 border border-red-400/50 shadow-red-500/30'
                    }`}>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-[28px]">
                                {toast.type === 'success' ? 'check_circle' : 'error'}
                            </span>
                            {toast.message}
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shrink-0 mt-4 mb-2 bg-[#101822]/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 lg:p-6 shadow-xl relative overflow-hidden">
                {/* Background Glow based on shift */}
                <div className={`absolute -inset-[100px] blur-3xl opacity-20 pointer-events-none transition-colors duration-1000 ${
                    inputMode === 'harian' ? 'bg-emerald-500/30' :
                    selectedShift === 1 ? 'bg-indigo-500/30' : 
                    selectedShift === 2 ? 'bg-amber-500/30' : 'bg-orange-500/30'
                }`}></div>

                <div className="flex flex-col gap-1 z-10 w-full lg:w-auto">
                    {/* Row 1: Judul + Badge Shift + Supervisor */}
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
                            {inputMode === 'shift' ? 'LAPORAN SHIFT' : 'LAPORAN HARIAN'}
                        </h2>
                        {inputMode === 'shift' ? (
                            <span className="px-3 py-1 rounded-lg text-sm font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-widest">
                                {SHIFT_LABELS[selectedShift].toUpperCase()}
                            </span>
                        ) : (
                            <span className="px-3 py-1 rounded-lg text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
                                REPORT HARIAN
                            </span>
                        )}
                        {/* Group + Supervisor — tampil untuk shift maupun harian */}
                        {(() => {
                            const group = inputMode === 'harian'
                                ? getGroupMalamOnDate(selectedDate)
                                : currentGroup;
                            return (
                                <>
                                    <span className={`px-3 py-1 rounded-lg text-sm font-black border uppercase tracking-widest ${
                                        group === 'A' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                                        group === 'B' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                        group === 'C' ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' :
                                        group === 'D' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                        'bg-slate-700/30 text-slate-400 border-slate-600/30'
                                    }`}>
                                        {group ? `Group ${group}` : 'Off'}
                                    </span>
                                </>
                            );
                        })()}
                    </div>
                    {/* Row 2: Tanggal, Waktu, Supervisor, Foreman Boiler, Foreman Turbin */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono mt-3">
                        {(() => {
                            const today = mounted ? `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}` : '';
                            const isToday = selectedDate === today;
                            const formattedDate = mounted && selectedDate ? new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
                            return (
                                <>
                                    <div className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border ${isToday ? 'bg-blue-500/15 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-[#0f1721] border-slate-700/50'}`}>
                                        <span className={`material-symbols-outlined text-[16px] ${isToday ? 'text-blue-400' : 'text-blue-400'}`}>calendar_month</span>
                                        <input
                                            type="date"
                                            value={selectedDate}
                                            onChange={e => setSelectedDate(e.target.value)}
                                            className="bg-transparent border-none p-0 text-xs sm:text-sm md:text-base text-blue-100 font-bold focus:ring-0 cursor-pointer [color-scheme:dark]"
                                        />
                                    </div>
                                    {formattedDate && (
                                        <span className="text-sm font-bold text-slate-300 bg-[#0f1721] px-3 py-1.5 rounded-lg border border-slate-700/50 capitalize hidden sm:inline-block shadow-sm">
                                            {formattedDate}
                                        </span>
                                    )}
                                </>
                            );
                        })()}
                        <span className="text-slate-600 hidden sm:inline">|</span>

                        <span className="text-xs font-bold text-white uppercase tracking-wider">Supervisor</span>
                        <div className="flex items-center gap-1.5 bg-[#0f1721] px-2 py-1.5 rounded-lg border border-slate-700/50 shadow-sm relative pr-5">
                            <select value={supervisor} onChange={e => setSupervisor(e.target.value)} className="bg-transparent border-none p-0 text-sm font-bold text-white focus:ring-0 cursor-pointer appearance-none outline-none">
                                <option value="" className="bg-[#101822]">Pilih...</option>
                                {supervisorOptions.map(op => (
                                    <option key={op.id} value={op.name} className="bg-[#101822]">{op.name}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined text-[16px] text-slate-500 absolute right-1 pointer-events-none">arrow_drop_down</span>
                        </div>

                        {inputMode === 'shift' && (
                            <>
                                <span className="text-xs font-bold text-white uppercase tracking-wider">Foreman Boiler</span>
                                <div className="flex items-center gap-1.5 bg-[#0f1721] px-2 py-1.5 rounded-lg border border-slate-700/50 shadow-sm relative pr-5">
                                    <select value={foremanBoiler} onChange={e => setForemanBoiler(e.target.value)} className="bg-transparent border-none p-0 text-sm font-bold text-white focus:ring-0 cursor-pointer appearance-none outline-none">
                                        <option value="" className="bg-[#101822]">Pilih...</option>
                                        {foremanBoilerOptions.map(op => (
                                            <option key={op.id} value={op.name} className="bg-[#101822]">{op.name}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined text-[16px] text-slate-500 absolute right-1 pointer-events-none">arrow_drop_down</span>
                                </div>
                                <span className="text-xs font-bold text-white uppercase tracking-wider">Foreman Turbin</span>
                                <div className="flex items-center gap-1.5 bg-[#0f1721] px-2 py-1.5 rounded-lg border border-slate-700/50 shadow-sm relative pr-5">
                                    <select value={foremanTurbin} onChange={e => setForemanTurbin(e.target.value)} className="bg-transparent border-none p-0 text-sm font-bold text-white focus:ring-0 cursor-pointer appearance-none outline-none">
                                        <option value="" className="bg-[#101822]">Pilih...</option>
                                        {foremanTurbinOptions.map(op => (
                                            <option key={op.id} value={op.name} className="bg-[#101822]">{op.name}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined text-[16px] text-slate-500 absolute right-1 pointer-events-none">arrow_drop_down</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Mode & Shift Controls */}
                <div className="flex flex-col gap-3 z-10 shrink-0 w-full lg:w-auto">
                    <div className="flex bg-[#0f1721]/80 p-1.5 rounded-xl border border-slate-700/50">
                        <button
                            onClick={() => setInputMode('shift')}
                            className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${inputMode === 'shift' ? 'bg-[#2b7cee] text-white shadow-[0_0_15px_rgba(43,124,238,0.4)]' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                        >
                            Shift
                        </button>
                        <button
                            onClick={() => setInputMode('harian')}
                            className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${inputMode === 'harian' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                        >
                            Harian
                        </button>
                    </div>

                    {inputMode === 'shift' && (
                        <div className="flex bg-[#0f1721]/80 p-1.5 rounded-xl border border-slate-700/50">
                            {[
                                { id: 1, label: 'Malam (06)', color: 'indigo' },
                                { id: 2, label: 'Pagi (14)', color: 'amber' },
                                { id: 3, label: 'Sore (22)', color: 'orange' }
                            ].map(shift => (
                                <button
                                    key={shift.id}
                                    onClick={() => setSelectedShift(shift.id as 1 | 2 | 3)}
                                    className={`flex-1 lg:flex-none px-3 py-2 rounded-lg text-[13px] font-bold transition-all ${selectedShift === shift.id ? `bg-${shift.color}-500 text-white shadow-[0_0_10px_rgba(var(--color-${shift.color}-500),0.4)]` : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                                >
                                    {shift.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
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
                                    <span className="material-symbols-outlined text-[20px]">save</span>
                                    {submitting ? 'Menyimpan...' : 'SIMPAN LAPORAN'}
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
                            {activeTab === 'Handling' && <TabHandling espValues={espHandling} tankyardValues={tankyard} onEspChange={makeMixedHandler(setEspHandling)} onTankyardChange={makeNumberHandler(setTankyard)} solarEntries={solarEntries} onSolarEntriesChange={setSolarEntries} outSolarEntries={outSolarEntries} onOutSolarEntriesChange={setOutSolarEntries} savedSolarEntries={savedSolarEntries} savedOutSolarEntries={savedOutSolarEntries} onDeleteSavedSolar={handleDeleteSavedSolar} onDeleteSavedOutSolar={handleDeleteSavedOutSolar} />}
                            {activeTab === 'ESP' && <TabESP values={espHandling} onFieldChange={makeMixedHandler(setEspHandling)} ashEntries={ashEntries} onAshEntriesChange={setAshEntries} savedAshEntries={savedAshEntries} onDeleteSavedAsh={handleDeleteSavedAsh} />}
                            {activeTab === 'Coal Bunker' && <TabCoalBunker values={coalBunker} onFieldChange={makeMixedHandler(setCoalBunker)} onStatusChange={(name, value) => setCoalBunker(prev => ({ ...prev, [name]: value }))} berasapSince={bunkerBerasapSince} />}
                            {activeTab === 'Lab' && <TabLab waterQualityValues={waterQuality} chemicalDosingValues={chemicalDosing} onWaterQualityChange={makeNumberHandler(setWaterQuality)} onChemicalDosingChange={makeNumberHandler(setChemicalDosing)} lastStockPhosphate={lastStock.phosphate} lastStockAmine={lastStock.amine} lastStockHydrazine={lastStock.hydrazine} />}
                        </div>
                    </div>
                </div>
            ) : (
                <InputHarianForm date={selectedDate} operator={operator} groupName={getGroupMalamOnDate(selectedDate)} supervisorName={supervisor} />
            )}
        </div>
    );
}
