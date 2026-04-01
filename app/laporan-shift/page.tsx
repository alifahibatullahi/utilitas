'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { useShiftReport, ShiftReportData } from '@/hooks/useShiftReport';

// ─── Data Interfaces ───
interface BoilerData {
    flowSteam: number;
    furnace: number;
    flueGas: number;
    batubara: number;
    tempSteam: number;
    cr: number;
    lifetime: number;
}

interface CriticalEquipment {
    date: string;
    item: string;
    deskripsi: string;
    uraian: string;
    scope: string;
    foreman: string;
}

interface MaintenanceItem {
    date: string;
    item: string;
    uraian: string;
    scope: string;
    foreman: string;
    tipe: string;
    status: string;
    notif: string | null;
}

interface ShiftReport {
    id: number;
    shift: 'pagi' | 'sore' | 'malam';
    date: string;
    group: string;
    supervisor: string;
    operator: string;
    boilerA: BoilerData;
    boilerB: BoilerData;
    turbin: {
        loadTG: number;
        internalUBB: number;
        pln: number;
        durasiHPO: number;
        tempCWIn: number;
        tempCWOut: number;
        tempThrustBrg: number;
        axialDispl: number;
    };
    power: { name: string; value: number }[];
    distribusiSteam: { pabrik: string; value: number }[];
    tankYard: { rcw: number; demin: number; solarAB: number; siloA: number; siloB: number };
    lab: {
        boilerFeedWater: { tempBFW: number; pH: number; conduct: number; silica: number; nh4: number; chz: number };
        tk1250: { pH: number; conduct: number; silica: number };
        productSteam: { pH: number; conduct: number; silica: number; nh4: number };
        boilerWaterA: { pH: number; cond: number; sio2: number; po4: number };
        boilerWaterB: { pH: number; cond: number; sio2: number; po4: number };
    };
    criticalEquipment: CriticalEquipment[];
    maintenance: MaintenanceItem[];
    catatan: string;
    catatanTime: string;
    catatanAuthor: string;
    catatanRole: string;
}

const SHIFT_LABELS: Record<string, string> = { pagi: 'Pagi', sore: 'Sore', malam: 'Malam' };

/** Format a Date as YYYY-MM-DD in local timezone (avoids UTC shift from toISOString) */
function toLocalDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// ─── Build Report from Supabase Data ───
function buildReportFromSupabase(sr: ShiftReportData): ShiftReport {
    const boilerA = sr.shift_boiler?.find(b => b.boiler === 'A');
    const boilerB = sr.shift_boiler?.find(b => b.boiler === 'B');
    const turbin = sr.shift_turbin?.[0];
    const gen = sr.shift_generator_gi?.[0];
    const pd = sr.shift_power_dist?.[0];
    const sd = sr.shift_steam_dist?.[0];
    const ty = sr.shift_tankyard?.[0];
    const esp = sr.shift_esp_handling?.[0];
    const wq = sr.shift_water_quality?.[0];
    const note = sr.shift_notes?.[0];

    const flowA = boilerA?.flow_steam ?? 0;
    const batubaraA = boilerA?.batubara_ton ?? 0;
    const flowB = boilerB?.flow_steam ?? 0;
    const batubaraB = boilerB?.batubara_ton ?? 0;

    return {
        id: 0,
        shift: sr.shift,
        date: sr.date,
        group: sr.group_name ?? '',
        supervisor: sr.supervisor ?? '',
        operator: sr.created_by ?? '',
        boilerA: {
            flowSteam: flowA,
            furnace: boilerA?.temp_furnace ?? 0,
            flueGas: boilerA?.temp_flue_gas ?? 0,
            batubara: batubaraA,
            tempSteam: boilerA?.temp_steam ?? 0,
            cr: flowA > 0 ? +(batubaraA / flowA).toFixed(2) : 0,
            lifetime: boilerA?.stream_days ?? 0,
        },
        boilerB: {
            flowSteam: flowB,
            furnace: boilerB?.temp_furnace ?? 0,
            flueGas: boilerB?.temp_flue_gas ?? 0,
            batubara: batubaraB,
            tempSteam: boilerB?.temp_steam ?? 0,
            cr: flowB > 0 ? +(batubaraB / flowB).toFixed(2) : 0,
            lifetime: boilerB?.stream_days ?? 0,
        },
        turbin: {
            loadTG: gen?.gen_load ?? 0,
            internalUBB: pd?.power_ubb ?? 0,
            pln: gen?.gi_sum_p ?? 0,
            durasiHPO: turbin?.hpo_durasi ?? 0,
            tempCWIn: turbin?.temp_cw_in ?? 0,
            tempCWOut: turbin?.temp_cw_out ?? 0,
            tempThrustBrg: turbin?.thrust_bearing ?? 0,
            axialDispl: turbin?.axial_displacement ?? 0,
        },
        power: [
            { name: 'Pabrik 3A', value: pd?.power_pabrik3a ?? 0 },
            { name: 'Pabrik 3B', value: pd?.power_pabrik3b ?? 0 },
            { name: 'PIU', value: pd?.power_pie ?? 0 },
            { name: 'Pabrik 2', value: pd?.power_pabrik2 ?? 0 },
        ],
        distribusiSteam: [
            { pabrik: 'Pabrik 1', value: sd?.pabrik1_flow ?? 0 },
            { pabrik: 'Pabrik 2', value: sd?.pabrik2_flow ?? 0 },
            { pabrik: 'Pabrik 3A', value: sd?.pabrik3a_flow ?? 0 },
        ],
        tankYard: {
            rcw: ty?.tk_rcw ?? 0,
            demin: ty?.tk_demin ?? 0,
            solarAB: ty?.tk_solar_ab ?? 0,
            siloA: esp?.silo_a ?? 0,
            siloB: esp?.silo_b ?? 0,
        },
        lab: {
            boilerFeedWater: {
                tempBFW: wq?.bfw_th ?? 0,
                pH: wq?.bfw_ph ?? 0,
                conduct: wq?.bfw_conduct ?? 0,
                silica: wq?.bfw_sio2 ?? 0,
                nh4: wq?.bfw_nh4 ?? 0,
                chz: wq?.bfw_chz ?? 0,
            },
            tk1250: {
                pH: wq?.demin_1250_ph ?? 0,
                conduct: wq?.demin_1250_conduct ?? 0,
                silica: wq?.demin_1250_sio2 ?? 0,
            },
            productSteam: {
                pH: wq?.product_steam_ph ?? 0,
                conduct: wq?.product_steam_conduct ?? 0,
                silica: wq?.product_steam_sio2 ?? 0,
                nh4: wq?.product_steam_nh4 ?? 0,
            },
            boilerWaterA: {
                pH: wq?.boiler_water_a_ph ?? 0,
                cond: wq?.boiler_water_a_conduct ?? 0,
                sio2: wq?.boiler_water_a_sio2 ?? 0,
                po4: wq?.boiler_water_a_po4 ?? 0,
            },
            boilerWaterB: {
                pH: wq?.boiler_water_b_ph ?? 0,
                cond: wq?.boiler_water_b_conduct ?? 0,
                sio2: wq?.boiler_water_b_sio2 ?? 0,
                po4: wq?.boiler_water_b_po4 ?? 0,
            },
        },
        criticalEquipment: (sr.critical_equipment ?? []).map(ce => ({
            date: ce.date ?? '',
            item: ce.item ?? '',
            deskripsi: ce.deskripsi ?? '',
            uraian: ce.deskripsi ?? '',
            scope: ce.scope ?? '',
            foreman: ce.foreman ?? '',
        })),
        maintenance: (sr.maintenance_logs ?? []).map(ml => ({
            date: ml.date ?? '',
            item: ml.item ?? '',
            uraian: ml.uraian ?? '',
            scope: ml.scope ?? '',
            foreman: ml.foreman ?? '',
            tipe: ml.tipe ?? 'corrective',
            status: ml.status ?? '',
            notif: ml.notif ?? null,
        })),
        catatan: note?.content ?? '',
        catatanTime: note?.timestamp ?? '',
        catatanAuthor: sr.created_by ?? '',
        catatanRole: '',
    };
}

// ─── Lab Table (Dark Theme) ───
function LabTable({ title, color, headers, values }: { title: string; color: string; headers: string[]; values: (string | number)[] }) {
    const colorMap: Record<string, { header: string; subhead: string; border: string }> = {
        blue: { header: 'bg-blue-600', subhead: 'bg-blue-900/40 text-blue-300', border: 'border-blue-800/50' },
        cyan: { header: 'bg-cyan-600', subhead: 'bg-cyan-900/40 text-cyan-300', border: 'border-cyan-800/50' },
        green: { header: 'bg-green-600', subhead: 'bg-green-900/40 text-green-300', border: 'border-green-800/50' },
        'blue-dark': { header: 'bg-blue-800', subhead: 'bg-blue-900/40 text-blue-300', border: 'border-blue-800/50' },
        'green-dark': { header: 'bg-green-800', subhead: 'bg-green-900/40 text-green-300', border: 'border-green-800/50' },
    };
    const c = colorMap[color] || colorMap.blue;
    return (
        <div>
            <div className={`${c.header} text-white text-[9px] font-bold uppercase text-center py-1.5 rounded-t-lg`}>{title}</div>
            <table className="w-full border-collapse">
                <thead><tr className={`${c.subhead} text-[9px] font-bold uppercase text-center`}>
                    {headers.map(h => <th key={h} className={`py-1.5 px-1 border ${c.border}`}>{h}</th>)}
                </tr></thead>
                <tbody><tr className="bg-surface-dark text-white text-xs font-bold text-center">
                    {values.map((v, i) => <td key={i} className={`py-2 px-1 border ${c.border}`}>{v}</td>)}
                </tr></tbody>
            </table>
        </div>
    );
}

// ─── Cylinder Tank (Dark Theme) ───
function CylinderTank({ label, value, unit, color, fillPercent }: {
    label: string; value: string; unit: string; color: string; fillPercent: number;
}) {
    const colorMap: Record<string, string> = {
        blue: 'bg-blue-500',
        'light-blue': 'bg-cyan-400',
        orange: 'bg-orange-500',
    };
    return (
        <div className="flex flex-col gap-1">
            <div className="text-center">
                <p className="text-[9px] text-text-secondary uppercase font-bold">{label}</p>
                <p className="text-xs text-white font-black">{value} <span className="text-[8px] font-normal text-slate-500">{unit}</span></p>
            </div>
            <div className="relative w-full h-20 bg-surface-highlight/30 rounded p-1 border border-slate-700/50">
                <div className="relative w-full h-full bg-surface-dark border border-slate-600/40 rounded-sm overflow-hidden">
                    <div className={`absolute bottom-0 left-0 w-full ${colorMap[color] || 'bg-blue-500'} opacity-80`} style={{ height: `${fillPercent}%` }} />
                    <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(0deg, rgba(45,62,86,0.5) 1px, transparent 1px)', backgroundSize: '100% 20%' }} />
                </div>
            </div>
        </div>
    );
}

export default function LaporanShiftPage() {
    const { operator } = useOperator();
    const router = useRouter();
    const [activeShift, setActiveShift] = useState<'pagi' | 'sore' | 'malam'>('pagi');
    const [selectedDate, setSelectedDate] = useState(() => toLocalDateStr(new Date()));

    const { report: supaReport, activeMaintenance, openCriticals, loading, error } = useShiftReport(selectedDate, activeShift);

    const report = useMemo(() => {
        if (supaReport) return buildReportFromSupabase(supaReport);
        return null;
    }, [supaReport]);

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    if (!operator) return null;
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div className="flex-1 p-4 lg:p-6 flex flex-col max-w-[1400px] mx-auto w-full space-y-4">
            {/* Week Strip - Centered */}
            <div className="flex items-center gap-1 justify-center">
                <button onClick={() => { const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() - 7); setSelectedDate(toLocalDateStr(d)); }}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-surface-highlight transition-all cursor-pointer">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(selectedDate + 'T00:00:00');
                    d.setDate(d.getDate() - 3 + i);
                    const iso = toLocalDateStr(d);
                    const isActive = iso === selectedDate;
                    const isToday = iso === toLocalDateStr(new Date());
                    const dayShort = d.toLocaleDateString('id-ID', { weekday: 'short' }).charAt(0);
                    const dayNum = d.getDate();
                    return (
                        <button key={iso} onClick={() => setSelectedDate(iso)}
                            className={`flex flex-col items-center w-10 py-1 rounded-lg cursor-pointer transition-all
                                ${isActive
                                    ? 'bg-primary text-white shadow-[0_0_12px_rgba(43,124,238,0.35)]'
                                    : isToday
                                        ? 'text-primary hover:bg-surface-highlight'
                                        : 'text-text-secondary hover:text-white hover:bg-surface-highlight'
                                }`}>
                            <span className="text-[9px] font-semibold uppercase leading-none">{dayShort}</span>
                            <span className={`text-sm font-bold leading-tight ${isActive ? 'text-white' : ''}`}>{dayNum}</span>
                        </button>
                    );
                })}
                <button onClick={() => { const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 7); setSelectedDate(toLocalDateStr(d)); }}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-surface-highlight transition-all cursor-pointer">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
                <div className="relative ml-1">
                    <input type="date" value={selectedDate} onChange={e => e.target.value && setSelectedDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    <div className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-surface-highlight transition-all cursor-pointer">
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                    </div>
                </div>
            </div>

            {/* Shift Selector - Centered */}
            <div className="flex items-center gap-2 justify-center">
                {(['pagi', 'sore', 'malam'] as const).map(s => {
                    const icons: Record<string, string> = { pagi: 'wb_sunny', sore: 'wb_twilight', malam: 'dark_mode' };
                    const activeColors: Record<string, string> = {
                        pagi: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]',
                        sore: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]',
                        malam: 'bg-gradient-to-r from-indigo-600 to-blue-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]',
                    };
                    return (
                        <button key={s} onClick={() => setActiveShift(s)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5
                                ${activeShift === s ? activeColors[s] : 'bg-surface-dark text-text-secondary border border-slate-800 hover:text-white hover:bg-surface-highlight'}`}
                        >
                            <span className="material-symbols-outlined text-sm">{icons[s]}</span>
                            {SHIFT_LABELS[s]}
                        </button>
                    );
                })}
            </div>

            {/* Header */}
            <header className="text-center">
                <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-white">Laporan Akhir Shift {SHIFT_LABELS[activeShift]}</h2>
                <p className="text-primary font-bold text-sm tracking-widest uppercase mt-1">Utilitas Batubara</p>
            </header>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                    <span className="ml-3 text-sm text-slate-400">Memuat data shift...</span>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-4 text-center">
                    <p className="text-red-400 text-sm font-semibold">Gagal memuat data</p>
                    <p className="text-red-500/70 text-xs mt-1">{error}</p>
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && !report && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <span className="material-symbols-outlined text-6xl text-slate-600">description_off</span>
                    <h3 className="text-xl font-bold text-slate-400">Belum Ada Data</h3>
                    <p className="text-sm text-slate-500 text-center max-w-md">
                        Belum ada laporan shift {SHIFT_LABELS[activeShift]} untuk tanggal {dateFormatted}.
                        <br />Silakan input laporan terlebih dahulu di menu <strong>Input Laporan</strong>.
                    </p>
                    <button onClick={() => router.push('/input-shift')}
                        className="mt-2 px-5 py-2.5 bg-primary hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(43,124,238,0.3)]">
                        <span className="material-symbols-outlined text-lg">edit_note</span>
                        Input Laporan
                    </button>
                </div>
            )}

            {/* Info Bar - Full Width */}
            {report && (<div className="grid grid-cols-4 divide-x divide-cyan-800/60 bg-cyan-950 py-4 px-6 rounded-xl border border-cyan-900 shadow-md w-full">
                <div className="flex items-center justify-center gap-3 px-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hari</span><span className="text-sm font-black text-white">{dayName}</span></div>
                <div className="flex items-center justify-center gap-3 px-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tanggal</span><span className="text-sm font-black text-white">{dateFormatted}</span></div>
                <div className="flex items-center justify-center gap-3 px-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Grup</span><span className="text-sm font-black text-white">{report.group}</span></div>
                <div className="flex items-center justify-center gap-3 px-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Supervisor</span><span className="text-sm font-black text-white">{report.supervisor}</span></div>
            </div>)}

            {/* Main 2-Column Grid (matching PDF preview layout) */}
            {report && (<div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

                {/* Left Column (48%) */}
                <div className="lg:w-[48%] flex flex-col gap-4 overflow-y-auto min-h-0">

                    {/* Parameter Operasional */}
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Parameter Operasional</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Boiler A */}
                            <div className="bg-blue-950/30 p-4 rounded-xl border border-blue-900/40">
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-blue-800/40">
                                    <span className="text-blue-400 font-black text-xs tracking-tighter">BOILER A</span>
                                    <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full text-[10px] font-bold">Lifetime: <strong className="text-white">{report.boilerA.lifetime}</strong> hari</span>
                                </div>
                                <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-center">
                                    <div><p className="text-[9px] text-blue-300/60 uppercase font-bold">Flow Steam</p><p className="text-sm font-black text-white">{report.boilerA.flowSteam} <span className="text-[10px] font-normal text-slate-500">T/j</span></p></div>
                                    <div><p className="text-[9px] text-blue-300/60 uppercase font-bold">Furnace</p><p className="text-sm font-black text-white">{report.boilerA.furnace} <span className="text-[10px] font-normal text-slate-500">°C</span></p></div>
                                    <div><p className="text-[9px] text-blue-300/60 uppercase font-bold">Flue Gas</p><p className="text-sm font-black text-white">{report.boilerA.flueGas} <span className="text-[10px] font-normal text-slate-500">°C</span></p></div>
                                    <div><p className="text-[9px] text-blue-300/60 uppercase font-bold">Batubara</p><p className="text-sm font-black text-white">{report.boilerA.batubara} <span className="text-[10px] font-normal text-slate-500">Ton</span></p></div>
                                    <div><p className="text-[9px] text-blue-300/60 uppercase font-bold">Temp Steam</p><p className="text-sm font-black text-white">{report.boilerA.tempSteam} <span className="text-[10px] font-normal text-slate-500">°C</span></p></div>
                                    <div><p className="text-[9px] text-blue-300/60 uppercase font-bold">CR A</p><p className="text-sm font-black text-white">{report.boilerA.cr}</p></div>
                                </div>
                            </div>
                            {/* Boiler B */}
                            <div className="bg-green-950/30 p-4 rounded-xl border border-green-900/40">
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-green-800/40">
                                    <span className="text-green-400 font-black text-xs tracking-tighter">BOILER B</span>
                                    <span className="bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full text-[10px] font-bold">Lifetime: <strong className="text-white">{report.boilerB.lifetime}</strong> hari</span>
                                </div>
                                <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-center">
                                    <div><p className="text-[9px] text-green-300/60 uppercase font-bold">Flow Steam</p><p className="text-sm font-black text-white">{report.boilerB.flowSteam} <span className="text-[10px] font-normal text-slate-500">T/j</span></p></div>
                                    <div><p className="text-[9px] text-green-300/60 uppercase font-bold">Furnace</p><p className="text-sm font-black text-white">{report.boilerB.furnace} <span className="text-[10px] font-normal text-slate-500">°C</span></p></div>
                                    <div><p className="text-[9px] text-green-300/60 uppercase font-bold">Flue Gas</p><p className="text-sm font-black text-white">{report.boilerB.flueGas} <span className="text-[10px] font-normal text-slate-500">°C</span></p></div>
                                    <div><p className="text-[9px] text-green-300/60 uppercase font-bold">Batubara</p><p className="text-sm font-black text-white">{report.boilerB.batubara} <span className="text-[10px] font-normal text-slate-500">Ton</span></p></div>
                                    <div><p className="text-[9px] text-green-300/60 uppercase font-bold">Temp Steam</p><p className="text-sm font-black text-white">{report.boilerB.tempSteam} <span className="text-[10px] font-normal text-slate-500">°C</span></p></div>
                                    <div><p className="text-[9px] text-green-300/60 uppercase font-bold">CR B</p><p className="text-sm font-black text-white">{report.boilerB.cr}</p></div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Turbin + Power + Distribusi Steam */}
                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 lg:col-span-9 space-y-4">
                            {/* Turbin Generator */}
                            <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-2 px-4">
                                    <p className="text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-md">Turbin Generator</p>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
                                        <div><p className="text-[9px] text-text-secondary uppercase font-bold">Load TG</p><p className="text-sm font-black text-white">{report.turbin.loadTG} <span className="text-[10px] font-normal text-slate-500">MW</span></p></div>
                                        <div><p className="text-[9px] text-text-secondary uppercase font-bold">Internal UBB</p><p className="text-sm font-black text-white">{report.turbin.internalUBB} <span className="text-[10px] font-normal text-slate-500">MW</span></p></div>
                                        <div><p className="text-[9px] text-text-secondary uppercase font-bold">PLN</p><p className="text-sm font-black text-white">{report.turbin.pln} <span className="text-[10px] font-normal text-slate-500">MW</span></p></div>
                                        <div><p className="text-[9px] text-text-secondary uppercase font-bold">Durasi HPO</p><p className="text-sm font-black text-white">{report.turbin.durasiHPO} <span className="text-[10px] font-normal text-slate-500">S</span></p></div>
                                        <div><p className="text-[9px] text-text-secondary uppercase font-bold">Temp CW In</p><p className="text-sm font-black text-white">{report.turbin.tempCWIn} <span className="text-[10px] font-normal text-slate-500">°C</span></p></div>
                                        <div><p className="text-[9px] text-text-secondary uppercase font-bold">Temp CW Out</p><p className="text-sm font-black text-white">{report.turbin.tempCWOut} <span className="text-[10px] font-normal text-slate-500">°C</span></p></div>
                                        <div><p className="text-[9px] text-text-secondary uppercase font-bold">Thrust Brg</p><p className="text-sm font-black text-white">{report.turbin.tempThrustBrg} <span className="text-[10px] font-normal text-slate-500">°C</span></p></div>
                                        <div><p className="text-[9px] text-text-secondary uppercase font-bold">Axial Displ</p><p className="text-sm font-black text-white">{report.turbin.axialDispl} <span className="text-[10px] font-normal text-slate-500">mm</span></p></div>
                                    </div>
                                </div>
                            </div>
                            {/* Power */}
                            <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 py-2 px-4">
                                    <p className="text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-md">Power Distribution</p>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-4 gap-y-3 gap-x-2 text-center">
                                        {report.power.map(p => (
                                            <div key={p.name}><p className="text-[9px] text-text-secondary uppercase font-bold">{p.name}</p><p className="text-sm font-black text-white">{p.value} <span className="text-[10px] font-normal text-slate-500">MW</span></p></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Distribusi Steam */}
                        <div className="col-span-12 lg:col-span-3">
                            <div className="bg-surface-dark rounded-xl border border-slate-800 h-full flex flex-col overflow-hidden">
                                <div className="bg-gradient-to-r from-orange-500 to-amber-500 py-2 px-4">
                                    <p className="text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-md">Distribusi Steam</p>
                                </div>
                                <div className="p-4 space-y-4 flex-1 flex flex-col justify-center">
                                    {report.distribusiSteam.map((d, i) => (
                                        <div key={d.pabrik} className={`flex items-center justify-between ${i < report.distribusiSteam.length - 1 ? 'border-b border-slate-700/50 pb-3' : ''}`}>
                                            <p className="text-[10px] text-text-secondary uppercase font-bold">{d.pabrik}</p>
                                            <p className="text-lg font-black text-white">{d.value} <span className="text-xs font-normal text-slate-500">T/j</span></p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tank Yard & Silo */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                        <div className="bg-gradient-to-r from-yellow-600 to-amber-600 py-2 px-4">
                            <p className="text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-md">Tank Yard &amp; Silo</p>
                        </div>
                        <div className="p-4">
                        <div className="flex gap-4">
                            <div className="grid grid-cols-3 gap-4 flex-1">
                                <CylinderTank label="TK RCW" value={report.tankYard.rcw.toLocaleString()} unit="m³" color="blue" fillPercent={93} />
                                <CylinderTank label="TK Demin" value={report.tankYard.demin.toLocaleString()} unit="m³" color="light-blue" fillPercent={83} />
                                <CylinderTank label="TK Solar AB" value={report.tankYard.solarAB.toString()} unit="m³" color="orange" fillPercent={77} />
                            </div>
                            <div className="flex flex-col gap-2 w-24">
                                <div className="flex-1 flex flex-col justify-center items-center bg-surface-highlight/30 rounded-lg p-2 border border-slate-700/50">
                                    <p className="text-[9px] text-text-secondary uppercase font-bold mb-1">Silo A</p>
                                    <p className="text-2xl font-black text-white">{report.tankYard.siloA}<span className="text-xs font-normal text-slate-500 ml-0.5">%</span></p>
                                </div>
                                <div className="flex-1 flex flex-col justify-center items-center bg-surface-highlight/30 rounded-lg p-2 border border-slate-700/50">
                                    <p className="text-[9px] text-text-secondary uppercase font-bold mb-1">Silo B</p>
                                    <p className="text-2xl font-black text-white">{report.tankYard.siloB}<span className="text-xs font-normal text-slate-500 ml-0.5">%</span></p>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>

                    {/* Parameter Lab / QC */}
                    <section className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-600 to-violet-600 py-2 px-4">
                            <p className="text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-md">Parameter Lab / QC</p>
                        </div>
                        <div className="p-4 space-y-4">
                            <LabTable title="Boiler Feed Water" color="blue"
                                headers={['pH', 'Conduct', 'Silica', 'NH4', 'CHZ']}
                                values={[report.lab.boilerFeedWater.pH, report.lab.boilerFeedWater.conduct, report.lab.boilerFeedWater.silica, report.lab.boilerFeedWater.nh4, report.lab.boilerFeedWater.chz]} />
                            <div className="grid grid-cols-2 gap-4">
                                <LabTable title="TK-1250" color="cyan"
                                    headers={['pH', 'Conduct', 'Silica']}
                                    values={[report.lab.tk1250.pH, report.lab.tk1250.conduct, report.lab.tk1250.silica]} />
                                <LabTable title="Product Steam" color="green"
                                    headers={['pH', 'Conduct', 'Silica', 'NH4']}
                                    values={[report.lab.productSteam.pH, report.lab.productSteam.conduct, report.lab.productSteam.silica, report.lab.productSteam.nh4]} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <LabTable title="Boiler Water A" color="blue-dark"
                                    headers={['pH', 'Cond', 'SiO2', 'PO4']}
                                    values={[report.lab.boilerWaterA.pH, report.lab.boilerWaterA.cond, report.lab.boilerWaterA.sio2, report.lab.boilerWaterA.po4]} />
                                <LabTable title="Boiler Water B" color="green-dark"
                                    headers={['pH', 'Cond', 'SiO2', 'PO4']}
                                    values={[report.lab.boilerWaterB.pH, report.lab.boilerWaterB.cond, report.lab.boilerWaterB.sio2, report.lab.boilerWaterB.po4]} />
                            </div>
                        </div>
                    </section>

                    {/* Catatan Shift */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-600 to-orange-600 py-2 px-4">
                            <p className="text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-md">Catatan Shift</p>
                        </div>
                        <div className="p-4">
                            <div className="text-sm text-slate-300 leading-relaxed space-y-3 italic">
                                {report.catatan.split('\n\n').map((p, i) => <p key={i}>&ldquo;{p}&rdquo;</p>)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column (flex-1) */}
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0">

                    {/* Maintenance Logs */}
                    <section className="flex-1 flex flex-col">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-4 bg-green-500 rounded-full" />
                            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Maintenance Logs</h3>
                        </div>
                        <div className="bg-surface-dark rounded-xl border border-slate-800 flex flex-col flex-1 overflow-hidden">
                            <div className="bg-green-600 p-2.5">
                                <p className="text-[10px] font-bold text-white uppercase tracking-widest text-center">Maintenance Activities</p>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="text-[10px] text-green-300 font-bold uppercase bg-green-900/30 tracking-tighter">
                                            <th className="py-2 px-1 w-[8%] border-b border-green-800/40 text-center">Tgl</th>
                                            <th className="py-2 px-2 w-[14%] border-b border-green-800/40 text-left">Item</th>
                                            <th className="py-2 px-1 w-[43%] border-b border-green-800/40 text-left">Uraian</th>
                                            <th className="py-2 px-1 w-[18%] border-b border-green-800/40 text-center">Scope</th>
                                            <th className="py-2 px-2 w-[12%] border-b border-green-800/40 text-center">Ket</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeMaintenance.map((m, i) => (
                                            <tr key={i} className="border-b border-slate-800/50 hover:bg-surface-highlight/20 transition-colors">
                                                <td className="text-[10px] py-2 px-1 text-center text-slate-400">{m.date}</td>
                                                <td className="text-[10px] py-2 px-2 font-mono font-bold text-primary">{m.item}</td>
                                                <td className="text-[10px] py-2 px-1 text-slate-300">{m.uraian}</td>
                                                <td className="text-[10px] py-2 px-1 text-center text-slate-400">{m.scope}</td>
                                                <td className="text-center py-2 px-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${m.status === 'OK' ? 'bg-emerald-500/20 text-emerald-400' : m.status === 'IP' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{m.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                        {activeMaintenance.length === 0 && (
                                            <tr><td colSpan={5} className="text-center text-[10px] text-slate-500 italic py-4">Tidak ada maintenance aktif</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    {/* Critical Equipment */}
                    <section className="flex-1 flex flex-col">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-4 bg-red-500 rounded-full" />
                            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Critical Equipment</h3>
                        </div>
                        <div className="bg-surface-dark rounded-xl border border-slate-800 flex flex-col flex-1 overflow-hidden">
                            <div className="bg-red-600 p-2.5">
                                <p className="text-[10px] font-bold text-white uppercase tracking-widest text-center">Equipment Watchlist</p>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="text-[10px] text-red-300 font-bold uppercase bg-red-900/30 tracking-tighter text-center">
                                            <th className="py-2 px-1 w-[10%] border-b border-red-800/40">Tgl</th>
                                            <th className="py-2 px-1 w-[15%] border-b border-red-800/40">Item</th>
                                            <th className="py-2 px-1 w-[45%] border-b border-red-800/40">Uraian</th>
                                            <th className="py-2 px-2 w-[30%] border-b border-red-800/40">Scope</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-center">
                                        {openCriticals.map((eq, i) => (
                                            <tr key={i} className="border-b border-slate-800/50 hover:bg-surface-highlight/20 transition-colors">
                                                <td className="text-[10px] py-2 px-1 text-slate-400">{eq.date}</td>
                                                <td className="text-[10px] py-2 px-1 font-mono font-bold text-rose-400">{eq.item}</td>
                                                <td className="text-[10px] py-2 px-1 text-left text-slate-300">{eq.deskripsi}</td>
                                                <td className="text-[10px] py-2 px-2 text-slate-400">{eq.scope}</td>
                                            </tr>
                                        ))}
                                        {openCriticals.length === 0 && (
                                            <tr><td colSpan={4} className="text-center text-[10px] text-slate-500 italic py-4">Tidak ada critical aktif</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </div>
            </div>)}

            {report && (<>
            {/* Footer */}
            <footer className="flex justify-center items-center py-3 border-t border-slate-800 flex-shrink-0 pb-20">
                <p className="text-slate-500 text-[10px]">&copy; 2026 PowerOps Control Systems. Generated from Shift {report.group} Terminal.</p>
            </footer>

            {/* Floating Print PDF Button */}
            <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-30">
                <button onClick={() => window.open('/laporan-shift/preview', '_blank')}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-[0_4px_24px_rgba(43,124,238,0.5)] hover:shadow-[0_4px_32px_rgba(43,124,238,0.7)] hover:scale-105">
                    <span className="material-symbols-outlined text-lg">print</span>
                    Print PDF
                </button>
            </div>
            </>)}
        </div>
    );
}
