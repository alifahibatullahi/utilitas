'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';

// ─── Full Report Data Shape ───
interface BoilerData {
    pressureSteam: number;
    tempSteam: number;
    flowSteam: number;
    totalizerSteam: number;
    pressureSteamDrum: number;
    pressureBFW: number;
    flowBFW: number;
    tempBFW: number;
    tempFurnace: number;
    tempFlueGas: number;
    o2: number;
    airHeater: number;
    totalizerBatubara: number;
    penggunaanSolar: number;
}

interface ShiftReport {
    id: number;
    shift: string;
    date: string;
    operator: string;
    status: 'pending' | 'approved' | 'rejected';
    // Boiler
    boilerA: BoilerData;
    boilerB: BoilerData;
    // Coal Feeder
    coalFeeder: { id: string; flow: number; totalizer: number }[];
    // Coal Bunker
    coalBunker: { id: string; level: number }[];
    // Turbin
    turbin: {
        flowSteamInlet: number;
        flowCondensate: number;
        pressureSteamInlet: number;
        tempSteamInlet: number;
        tempExhaustSteam: number;
        vacuum: number;
        durasiHPO: number;
        tempThrustBearing: number;
        tempMetalBearing: number;
        vibrasi: number;
        tempWinding: number;
        axialDisplacement: number;
        levelCondenser: number;
        tempCWIn: number;
        tempCWOut: number;
        pressureDeaerator: number;
        tempDeaerator: number;
    };
    // Distribusi Steam
    distribusiSteam: { pabrik: string; flow: number; temp: number; totalizer: number }[];
    // Generator
    generator: {
        loadSTG: number;
        ampere: number;
        ampReact: number;
        cosTeta: number;
        tegangan: number;
        frequency: number;
    };
    // Gardu Induk
    garduInduk: { sigmaP: number; sigmaQ: number; cosTeta: number };
    // Distribusi Power
    distribusiPower: { name: string; value: number }[];
    // ESP
    esp: {
        trafoA: number[];
        trafoB: number[];
        ashSiloA: number;
        ashSiloB: number;
        unloadingRate: number;
        tujuanTruk: string;
    };
    // Handling
    handling: {
        totalLoading: number;
        hopperAktif: string;
        conveyorA: string;
        conveyorB: string;
        inBatubara: number;
        outBatubara: number;
    };
    // Tank Yard
    tankYard: { levelRCW: number; levelDemin: number; levelSolar: number };
}

const DUMMY_REPORTS: ShiftReport[] = [
    {
        id: 1, shift: '1', date: '2026-02-25', operator: 'Budi Santoso', status: 'pending',
        boilerA: { pressureSteam: 3.2, tempSteam: 420, flowSteam: 45.2, totalizerSteam: 1250, pressureSteamDrum: 3.5, pressureBFW: 4.2, flowBFW: 48.5, tempBFW: 165, tempFurnace: 870, tempFlueGas: 185, o2: 4.2, airHeater: 280, totalizerBatubara: 320, penggunaanSolar: 0.5 },
        boilerB: { pressureSteam: 3.1, tempSteam: 418, flowSteam: 42.8, totalizerSteam: 1180, pressureSteamDrum: 3.4, pressureBFW: 4.1, flowBFW: 46.2, tempBFW: 162, tempFurnace: 845, tempFlueGas: 180, o2: 4.5, airHeater: 278, totalizerBatubara: 305, penggunaanSolar: 0.3 },
        coalFeeder: [
            { id: 'A', flow: 12.5, totalizer: 185 }, { id: 'B', flow: 13.0, totalizer: 192 }, { id: 'C', flow: 0, totalizer: 0 },
            { id: 'D', flow: 12.2, totalizer: 178 }, { id: 'E', flow: 11.8, totalizer: 172 }, { id: 'F', flow: 0, totalizer: 0 },
        ],
        coalBunker: [
            { id: 'A', level: 72 }, { id: 'B', level: 68 }, { id: 'C', level: 55 },
            { id: 'D', level: 70 }, { id: 'E', level: 65 }, { id: 'F', level: 48 },
        ],
        turbin: { flowSteamInlet: 88.0, flowCondensate: 85.2, pressureSteamInlet: 3.0, tempSteamInlet: 415, tempExhaustSteam: 82, vacuum: -0.085, durasiHPO: 0, tempThrustBearing: 65, tempMetalBearing: 72, vibrasi: 22, tempWinding: 98, axialDisplacement: 0.15, levelCondenser: 45, tempCWIn: 28, tempCWOut: 35, pressureDeaerator: 0.12, tempDeaerator: 105 },
        distribusiSteam: [
            { pabrik: '1', flow: 15.0, temp: 380, totalizer: 450 },
            { pabrik: '2', flow: 18.5, temp: 375, totalizer: 520 },
            { pabrik: '3', flow: 12.5, temp: 370, totalizer: 380 },
        ],
        generator: { loadSTG: 12.5, ampere: 520, ampReact: 180, cosTeta: 0.85, tegangan: 11.5, frequency: 50.02 },
        garduInduk: { sigmaP: 10.2, sigmaQ: 5.8, cosTeta: 0.87 },
        distribusiPower: [
            { name: 'Internal UBB', value: 2.5 }, { name: 'Pabrik 2', value: 3.2 },
            { name: 'Pabrik 3A', value: 2.8 }, { name: 'PIU', value: 1.0 }, { name: 'Pabrik 3B', value: 0.7 },
        ],
        esp: { trafoA: [32, 34, 31], trafoB: [33, 35, 32], ashSiloA: 45, ashSiloB: 38, unloadingRate: 5.2, tujuanTruk: 'Area Disposal A' },
        handling: { totalLoading: 8, hopperAktif: 'A', conveyorA: 'aktif', conveyorB: 'standby', inBatubara: 250, outBatubara: 240 },
        tankYard: { levelRCW: 72, levelDemin: 65, levelSolar: 80 },
    },
    {
        id: 2, shift: '3', date: '2026-02-25', operator: 'Eko Prasetyo', status: 'approved',
        boilerA: { pressureSteam: 3.1, tempSteam: 418, flowSteam: 43.5, totalizerSteam: 1220, pressureSteamDrum: 3.4, pressureBFW: 4.0, flowBFW: 47.0, tempBFW: 160, tempFurnace: 850, tempFlueGas: 182, o2: 4.3, airHeater: 275, totalizerBatubara: 310, penggunaanSolar: 0.4 },
        boilerB: { pressureSteam: 3.0, tempSteam: 415, flowSteam: 42.0, totalizerSteam: 1150, pressureSteamDrum: 3.3, pressureBFW: 4.0, flowBFW: 45.0, tempBFW: 158, tempFurnace: 840, tempFlueGas: 178, o2: 4.6, airHeater: 272, totalizerBatubara: 298, penggunaanSolar: 0.2 },
        coalFeeder: [
            { id: 'A', flow: 12.0, totalizer: 180 }, { id: 'B', flow: 12.8, totalizer: 188 }, { id: 'C', flow: 0, totalizer: 0 },
            { id: 'D', flow: 11.5, totalizer: 170 }, { id: 'E', flow: 12.0, totalizer: 175 }, { id: 'F', flow: 0, totalizer: 0 },
        ],
        coalBunker: [
            { id: 'A', level: 68 }, { id: 'B', level: 64 }, { id: 'C', level: 50 },
            { id: 'D', level: 66 }, { id: 'E', level: 60 }, { id: 'F', level: 44 },
        ],
        turbin: { flowSteamInlet: 85.5, flowCondensate: 83.0, pressureSteamInlet: 2.9, tempSteamInlet: 412, tempExhaustSteam: 80, vacuum: -0.083, durasiHPO: 0, tempThrustBearing: 64, tempMetalBearing: 70, vibrasi: 20, tempWinding: 96, axialDisplacement: 0.14, levelCondenser: 44, tempCWIn: 27, tempCWOut: 34, pressureDeaerator: 0.11, tempDeaerator: 104 },
        distribusiSteam: [
            { pabrik: '1', flow: 14.5, temp: 378, totalizer: 440 },
            { pabrik: '2', flow: 17.8, temp: 372, totalizer: 510 },
            { pabrik: '3', flow: 12.0, temp: 368, totalizer: 370 },
        ],
        generator: { loadSTG: 12.3, ampere: 510, ampReact: 175, cosTeta: 0.86, tegangan: 11.4, frequency: 50.01 },
        garduInduk: { sigmaP: 10.0, sigmaQ: 5.5, cosTeta: 0.88 },
        distribusiPower: [
            { name: 'Internal UBB', value: 2.4 }, { name: 'Pabrik 2', value: 3.1 },
            { name: 'Pabrik 3A', value: 2.7 }, { name: 'PIU', value: 0.9 }, { name: 'Pabrik 3B', value: 0.6 },
        ],
        esp: { trafoA: [31, 33, 30], trafoB: [32, 34, 31], ashSiloA: 42, ashSiloB: 35, unloadingRate: 4.8, tujuanTruk: 'Area Disposal B' },
        handling: { totalLoading: 7, hopperAktif: 'A', conveyorA: 'aktif', conveyorB: 'standby', inBatubara: 240, outBatubara: 235 },
        tankYard: { levelRCW: 70, levelDemin: 62, levelSolar: 78 },
    },
];

type ReportStatus = 'pending' | 'approved' | 'rejected';

const STATUS_CONFIG: Record<ReportStatus, { label: string; icon: string; className: string }> = {
    pending: { label: 'Menunggu', icon: 'schedule', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    approved: { label: 'Approved', icon: 'check_circle', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    rejected: { label: 'Rejected', icon: 'cancel', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

// ─── Collapsible Section ───
function Section({ title, icon, iconColor, defaultOpen, children }: {
    title: string; icon: string; iconColor: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen ?? false);
    return (
        <div className="border border-slate-700/40 rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-highlight/30 hover:bg-surface-highlight/50 transition-colors cursor-pointer"
            >
                <span className="flex items-center gap-2 text-xs font-semibold text-white">
                    <span className={`material-symbols-outlined text-sm ${iconColor}`}>{icon}</span>
                    {title}
                </span>
                <span className={`material-symbols-outlined text-sm text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </button>
            {open && <div className="px-4 py-3 bg-surface-dark/50">{children}</div>}
        </div>
    );
}

// ─── Data Display Grid ───
function DataRow({ label, value, unit }: { label: string; value: string | number; unit: string }) {
    return (
        <div className="flex items-baseline justify-between py-1 border-b border-slate-800/50 last:border-0">
            <span className="text-[10px] text-text-secondary">{label}</span>
            <span className="text-xs font-bold text-white tabular-nums">
                {value} <span className="text-[9px] text-slate-400 font-normal">{unit}</span>
            </span>
        </div>
    );
}

// ─── Boiler Detail ───
function BoilerDetail({ name, data }: { name: string; data: BoilerData }) {
    return (
        <div className="grid grid-cols-2 gap-x-6">
            <div>
                <p className="text-[9px] uppercase text-primary font-bold mb-1">Steam</p>
                <DataRow label="Pressure Steam" value={data.pressureSteam} unit="MPa" />
                <DataRow label="Temp Steam" value={data.tempSteam} unit="°C" />
                <DataRow label="Flow Steam" value={data.flowSteam} unit="t/h" />
                <DataRow label="Totalizer Steam" value={data.totalizerSteam} unit="ton" />
                <DataRow label="Pressure Drum" value={data.pressureSteamDrum} unit="MPa" />
            </div>
            <div>
                <p className="text-[9px] uppercase text-blue-400 font-bold mb-1">BFW</p>
                <DataRow label="Pressure BFW" value={data.pressureBFW} unit="MPa" />
                <DataRow label="Flow BFW" value={data.flowBFW} unit="t/h" />
                <DataRow label="Temp BFW" value={data.tempBFW} unit="°C" />
            </div>
            <div className="col-span-2 mt-2">
                <p className="text-[9px] uppercase text-orange-400 font-bold mb-1">Temperatur & Parameter</p>
                <div className="grid grid-cols-2 gap-x-6">
                    <DataRow label="Temp Furnace" value={data.tempFurnace} unit="°C" />
                    <DataRow label="Temp Flue Gas" value={data.tempFlueGas} unit="°C" />
                    <DataRow label="O₂" value={data.o2} unit="%" />
                    <DataRow label="Air Heater" value={data.airHeater} unit="°C" />
                    <DataRow label="Tot. Batubara" value={data.totalizerBatubara} unit="ton" />
                    <DataRow label="Solar" value={data.penggunaanSolar} unit="m³" />
                </div>
            </div>
        </div>
    );
}

export default function LaporanShiftPage() {
    const { operator, canApprove } = useOperator();
    const router = useRouter();
    const [filterStatus, setFilterStatus] = useState<ReportStatus | 'all'>('all');
    const [selectedReport, setSelectedReport] = useState<ShiftReport | null>(null);
    const [approvalNote, setApprovalNote] = useState('');

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    if (!operator) return null;

    const filtered = filterStatus === 'all' ? DUMMY_REPORTS : DUMMY_REPORTS.filter(r => r.status === filterStatus);
    const r = selectedReport;

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-4">
            {/* Header */}
            <header className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-xl">
                    <span className="material-symbols-outlined text-primary text-2xl">description</span>
                </div>
                <div>
                    <h2 className="text-xl font-black tracking-tight text-white">Laporan Shift</h2>
                    <p className="text-text-secondary text-xs mt-1">Daftar laporan shift dan proses approval</p>
                </div>
            </header>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer border
                            ${filterStatus === s
                                ? 'bg-primary/20 text-primary border-primary/30'
                                : 'bg-surface-dark text-text-secondary border-slate-800 hover:bg-surface-highlight'
                            }`}
                    >
                        {s === 'all' ? 'Semua' : (
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">{STATUS_CONFIG[s].icon}</span>
                                {STATUS_CONFIG[s].label}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Report list */}
                <div className="lg:col-span-2 space-y-2">
                    {filtered.map(report => (
                        <button
                            key={report.id}
                            onClick={() => setSelectedReport(report)}
                            className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer
                                ${selectedReport?.id === report.id
                                    ? 'bg-primary/10 border-primary/30'
                                    : 'bg-surface-dark border-slate-800 hover:bg-surface-highlight hover:border-slate-700'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-white">Shift {report.shift}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border flex items-center gap-1 ${STATUS_CONFIG[report.status].className}`}>
                                    <span className="material-symbols-outlined text-[10px]">{STATUS_CONFIG[report.status].icon}</span>
                                    {STATUS_CONFIG[report.status].label}
                                </span>
                            </div>
                            <p className="text-[10px] text-text-secondary">{new Date(report.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            <p className="text-[10px] text-text-secondary/60 mt-0.5">{report.operator}</p>
                            {/* Quick summary */}
                            <div className="flex gap-3 mt-2 pt-2 border-t border-slate-700/30">
                                <span className="text-[9px] text-text-secondary">Steam A: <b className="text-white">{report.boilerA.flowSteam}</b> t/h</span>
                                <span className="text-[9px] text-text-secondary">Steam B: <b className="text-white">{report.boilerB.flowSteam}</b> t/h</span>
                                <span className="text-[9px] text-text-secondary">Load: <b className="text-primary">{report.generator.loadSTG}</b> MW</span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Detail panel */}
                <div className="lg:col-span-3">
                    {r ? (
                        <div className="space-y-3">
                            {/* Header */}
                            <div className="bg-surface-dark rounded-xl border border-slate-800 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="text-base font-bold text-white">Shift {r.shift} — {new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</h3>
                                        <p className="text-xs text-text-secondary">Operator: {r.operator}</p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${STATUS_CONFIG[r.status].className}`}>
                                        <span className="material-symbols-outlined text-xs">{STATUS_CONFIG[r.status].icon}</span>
                                        {STATUS_CONFIG[r.status].label}
                                    </span>
                                </div>

                                {/* Summary cards */}
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="bg-surface-highlight/30 rounded-lg p-2.5 border border-slate-700/30">
                                        <p className="text-[9px] text-text-secondary uppercase tracking-wider">Steam A</p>
                                        <p className="text-lg font-bold text-white tabular-nums">{r.boilerA.flowSteam} <span className="text-[9px] text-slate-400 font-normal">t/h</span></p>
                                    </div>
                                    <div className="bg-surface-highlight/30 rounded-lg p-2.5 border border-slate-700/30">
                                        <p className="text-[9px] text-text-secondary uppercase tracking-wider">Steam B</p>
                                        <p className="text-lg font-bold text-white tabular-nums">{r.boilerB.flowSteam} <span className="text-[9px] text-slate-400 font-normal">t/h</span></p>
                                    </div>
                                    <div className="bg-surface-highlight/30 rounded-lg p-2.5 border border-slate-700/30">
                                        <p className="text-[9px] text-text-secondary uppercase tracking-wider">Load STG</p>
                                        <p className="text-lg font-bold text-primary tabular-nums">{r.generator.loadSTG} <span className="text-[9px] text-primary/60 font-normal">MW</span></p>
                                    </div>
                                    <div className="bg-surface-highlight/30 rounded-lg p-2.5 border border-slate-700/30">
                                        <p className="text-[9px] text-text-secondary uppercase tracking-wider">Freq</p>
                                        <p className="text-lg font-bold text-emerald-400 tabular-nums">{r.generator.frequency} <span className="text-[9px] text-emerald-400/60 font-normal">Hz</span></p>
                                    </div>
                                </div>
                            </div>

                            {/* Foreman Boiler Sections */}
                            <div>
                                <p className="text-[9px] uppercase tracking-widest font-bold text-orange-400 mb-2 px-1">Foreman Boiler</p>
                                <div className="space-y-2">
                                    <Section title="Boiler A" icon="local_fire_department" iconColor="text-orange-400" defaultOpen>
                                        <BoilerDetail name="A" data={r.boilerA} />
                                    </Section>
                                    <Section title="Boiler B" icon="local_fire_department" iconColor="text-orange-400">
                                        <BoilerDetail name="B" data={r.boilerB} />
                                    </Section>
                                    <Section title="Coal Feeder" icon="local_fire_department" iconColor="text-amber-400">
                                        <div className="grid grid-cols-2 gap-x-6">
                                            <div>
                                                <p className="text-[9px] uppercase text-orange-400 font-bold mb-1">Boiler A (A/B/C)</p>
                                                {r.coalFeeder.slice(0, 3).map(f => (
                                                    <div key={f.id} className={`${f.flow > 0 ? '' : 'opacity-40'}`}>
                                                        <DataRow label={`Feeder ${f.id} Flow`} value={f.flow} unit="t/h" />
                                                        <DataRow label={`Feeder ${f.id} Tot.`} value={f.totalizer} unit="ton" />
                                                    </div>
                                                ))}
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase text-teal-400 font-bold mb-1">Boiler B (D/E/F)</p>
                                                {r.coalFeeder.slice(3).map(f => (
                                                    <div key={f.id} className={`${f.flow > 0 ? '' : 'opacity-40'}`}>
                                                        <DataRow label={`Feeder ${f.id} Flow`} value={f.flow} unit="t/h" />
                                                        <DataRow label={`Feeder ${f.id} Tot.`} value={f.totalizer} unit="ton" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="Coal Bunker" icon="inventory_2" iconColor="text-amber-400">
                                        <div className="grid grid-cols-2 gap-x-6">
                                            <div>
                                                <p className="text-[9px] uppercase text-orange-400 font-bold mb-1">Boiler A</p>
                                                {r.coalBunker.slice(0, 3).map(b => (
                                                    <DataRow key={b.id} label={`Bunker ${b.id}`} value={b.level} unit="%" />
                                                ))}
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase text-teal-400 font-bold mb-1">Boiler B</p>
                                                {r.coalBunker.slice(3).map(b => (
                                                    <DataRow key={b.id} label={`Bunker ${b.id}`} value={b.level} unit="%" />
                                                ))}
                                            </div>
                                        </div>
                                    </Section>
                                </div>
                            </div>

                            {/* Foreman Turbin Sections */}
                            <div>
                                <p className="text-[9px] uppercase tracking-widest font-bold text-teal-400 mb-2 px-1">Foreman Turbin</p>
                                <div className="space-y-2">
                                    <Section title="Turbin" icon="settings" iconColor="text-cyan-400">
                                        <div className="grid grid-cols-2 gap-x-6">
                                            <div>
                                                <p className="text-[9px] uppercase text-primary font-bold mb-1">Steam & Condensate</p>
                                                <DataRow label="Flow Steam Inlet" value={r.turbin.flowSteamInlet} unit="t/h" />
                                                <DataRow label="Flow Condensate" value={r.turbin.flowCondensate} unit="t/h" />
                                                <DataRow label="Press. Steam Inlet" value={r.turbin.pressureSteamInlet} unit="MPa" />
                                                <DataRow label="Temp Steam Inlet" value={r.turbin.tempSteamInlet} unit="°C" />
                                                <DataRow label="Temp Exhaust" value={r.turbin.tempExhaustSteam} unit="°C" />
                                                <DataRow label="Vacuum" value={r.turbin.vacuum} unit="MPa" />
                                                <DataRow label="Durasi HPO" value={r.turbin.durasiHPO} unit="jam" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase text-orange-400 font-bold mb-1">Bearing & Vibrasi</p>
                                                <DataRow label="Temp Thrust Bearing" value={r.turbin.tempThrustBearing} unit="°C" />
                                                <DataRow label="Temp Metal Bearing" value={r.turbin.tempMetalBearing} unit="°C" />
                                                <DataRow label="Vibrasi" value={r.turbin.vibrasi} unit="µm" />
                                                <DataRow label="Temp Winding" value={r.turbin.tempWinding} unit="°C" />
                                                <DataRow label="Axial Displ." value={r.turbin.axialDisplacement} unit="mm" />
                                                <p className="text-[9px] uppercase text-blue-400 font-bold mt-2 mb-1">Condenser & CW</p>
                                                <DataRow label="Level Condenser" value={r.turbin.levelCondenser} unit="%" />
                                                <DataRow label="Temp CW In" value={r.turbin.tempCWIn} unit="°C" />
                                                <DataRow label="Temp CW Out" value={r.turbin.tempCWOut} unit="°C" />
                                                <DataRow label="Press. Deaerator" value={r.turbin.pressureDeaerator} unit="MPa" />
                                                <DataRow label="Temp Deaerator" value={r.turbin.tempDeaerator} unit="°C" />
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="Distribusi Steam" icon="factory" iconColor="text-purple-400">
                                        <div className="grid grid-cols-3 gap-x-4">
                                            {r.distribusiSteam.map(d => (
                                                <div key={d.pabrik}>
                                                    <p className="text-[9px] uppercase text-purple-400 font-bold mb-1">Pabrik {d.pabrik}</p>
                                                    <DataRow label="Flow" value={d.flow} unit="t/h" />
                                                    <DataRow label="Temp" value={d.temp} unit="°C" />
                                                    <DataRow label="Totalizer" value={d.totalizer} unit="ton" />
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                    <Section title="Generator" icon="electric_bolt" iconColor="text-primary">
                                        <div className="grid grid-cols-2 gap-x-6">
                                            <DataRow label="Load STG" value={r.generator.loadSTG} unit="MW" />
                                            <DataRow label="Ampere" value={r.generator.ampere} unit="A" />
                                            <DataRow label="Amp Reactive" value={r.generator.ampReact} unit="kVAR" />
                                            <DataRow label="Cos θ" value={r.generator.cosTeta} unit="" />
                                            <DataRow label="Tegangan" value={r.generator.tegangan} unit="kV" />
                                            <DataRow label="Frequency" value={r.generator.frequency} unit="Hz" />
                                        </div>
                                    </Section>
                                    <Section title="Gardu Induk" icon="electrical_services" iconColor="text-yellow-400">
                                        <div className="grid grid-cols-3 gap-x-4">
                                            <DataRow label="Σ P" value={r.garduInduk.sigmaP} unit="MW" />
                                            <DataRow label="Σ Q" value={r.garduInduk.sigmaQ} unit="MVAR" />
                                            <DataRow label="Cos θ" value={r.garduInduk.cosTeta} unit="" />
                                        </div>
                                    </Section>
                                    <Section title="Distribusi Power" icon="bolt" iconColor="text-cyan-400">
                                        <div className="grid grid-cols-2 gap-x-6">
                                            {r.distribusiPower.map(d => (
                                                <DataRow key={d.name} label={d.name} value={d.value} unit="MW" />
                                            ))}
                                        </div>
                                    </Section>
                                    <Section title="ESP (Electrostatic Precipitator)" icon="air" iconColor="text-orange-400">
                                        <div className="grid grid-cols-2 gap-x-6">
                                            <div>
                                                <p className="text-[9px] uppercase text-orange-400 font-bold mb-1">ESP A</p>
                                                {r.esp.trafoA.map((v, i) => (
                                                    <DataRow key={i} label={`Trafo A${i + 1}`} value={v} unit="kV" />
                                                ))}
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase text-teal-400 font-bold mb-1">ESP B</p>
                                                {r.esp.trafoB.map((v, i) => (
                                                    <DataRow key={i} label={`Trafo B${i + 1}`} value={v} unit="kV" />
                                                ))}
                                            </div>
                                            <div className="col-span-2 mt-2">
                                                <p className="text-[9px] uppercase text-amber-400 font-bold mb-1">Ash Silo & Unloading</p>
                                                <div className="grid grid-cols-2 gap-x-6">
                                                    <DataRow label="Ash Silo A" value={r.esp.ashSiloA} unit="%" />
                                                    <DataRow label="Ash Silo B" value={r.esp.ashSiloB} unit="%" />
                                                    <DataRow label="Unloading Rate" value={r.esp.unloadingRate} unit="ton/h" />
                                                    <div className="flex items-baseline justify-between py-1">
                                                        <span className="text-[10px] text-text-secondary">Tujuan Truk</span>
                                                        <span className="text-xs font-bold text-white">{r.esp.tujuanTruk}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Section>
                                </div>
                            </div>

                            {/* Shared Sections */}
                            <div>
                                <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2 px-1">Umum</p>
                                <div className="space-y-2">
                                    <Section title="Handling Batubara" icon="local_shipping" iconColor="text-amber-400">
                                        <div className="grid grid-cols-2 gap-x-6">
                                            <DataRow label="Total Loading" value={r.handling.totalLoading} unit="shovel" />
                                            <DataRow label="Hopper Aktif" value={r.handling.hopperAktif} unit="" />
                                            <DataRow label="Conveyor A" value={r.handling.conveyorA} unit="" />
                                            <DataRow label="Conveyor B" value={r.handling.conveyorB} unit="" />
                                            <DataRow label="In Batubara" value={r.handling.inBatubara} unit="ton" />
                                            <DataRow label="Out Batubara" value={r.handling.outBatubara} unit="ton" />
                                        </div>
                                    </Section>
                                    <Section title="Tank Yard" icon="water_drop" iconColor="text-teal-400">
                                        <div className="grid grid-cols-3 gap-x-4">
                                            <DataRow label="RCW" value={r.tankYard.levelRCW} unit="%" />
                                            <DataRow label="Demin" value={r.tankYard.levelDemin} unit="%" />
                                            <DataRow label="Solar" value={r.tankYard.levelSolar} unit="%" />
                                        </div>
                                    </Section>
                                </div>
                            </div>

                            {/* Approval */}
                            {canApprove && r.status === 'pending' && (
                                <div className="bg-surface-dark rounded-xl border border-slate-800 p-4">
                                    <p className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold mb-3 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">approval</span>
                                        Approval
                                    </p>
                                    <textarea
                                        value={approvalNote}
                                        onChange={e => setApprovalNote(e.target.value)}
                                        placeholder="Catatan approval (opsional)..."
                                        rows={2}
                                        className="w-full px-3 py-2.5 bg-surface-highlight border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-slate-600 resize-none mb-3"
                                    />
                                    <div className="flex gap-3">
                                        <button className="flex-1 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1">
                                            <span className="material-symbols-outlined text-sm">check_circle</span>
                                            Approve
                                        </button>
                                        <button className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all cursor-pointer flex items-center justify-center gap-1">
                                            <span className="material-symbols-outlined text-sm">cancel</span>
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-surface-dark rounded-xl border border-slate-800 h-64 flex items-center justify-center">
                            <p className="text-xs text-text-secondary/40">Pilih laporan untuk melihat detail</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
