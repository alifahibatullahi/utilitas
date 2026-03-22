'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';

// ─── Data dari template LHUBB (09 Januari 2026), delta vs 08 Januari ───
const DAILY_DATA = {
    date: '2026-01-09',
    hari: 'Jumat',
    group: 'B',
    supervisor: 'Putra',
    // Produksi Steam 24 Jam (Ton)
    steamBoilerA: 1680, deltaStmA: 41,
    steamBoilerB: 1747, deltaStmB: 44,
    steamTotal: 3427, deltaStmTotal: 85,
    // Distribusi Steam 24 Jam (Ton)
    steamInletTurbine: 776, deltaInletTurbine: 67,
    steamCondensat: 0, deltaCondensat: 0,
    mpsTo1B: 1105, deltaMps1B: -40,
    mpsTo3A: 806, deltaMps3A: 11,
    lpsInternal: 45, deltaLps: -5,
    // Konsumsi Bahan Baku
    loading: 80,
    bfw: 3438, deltaBfw: 74,
    phosphat: 3.5, deltaPhosphat: 2.5,
    amine: 7, deltaAmine: -1.5,
    hydrazine: 0.25, deltaHydrazine: 0,
    stockPhosphat: 49, stockAmine: 26, stockHydrazine: 33,
    // Solar
    solarLoading: 0, solarBengkel: 0, solarPemakaian: 0, solarRevamp: 0,
    // Power 24 Jam (MWh) & Jam 00 (MW)
    powerTG: 214, deltaPowerTG: 21,
    powerInternalUBB: 105, deltaPowerUBB: -5,
    pieExport: -0.3, deltaPieExport: -0.1,
    powerII: 57, deltaPowerII: -3,
    powerIIIA: 38, deltaPowerIIIA: 2,
    // Totalizer (kWh)
    pieExportKwh: 10160,
    pieImportKwh: 32356,
    // Pemindahan Batubara
    totalKePF1: 0, totalKePF2: 0,
    // Stock Batubara (Ton)
    stockBatubara: 30424.77, deltaStockBatubara: -806.3,
    // RKAP
    rkapSteam: 569400, steamProduct: 221865,
    crTahunan: 0.236, crBoilerAB: 0.236,
    // Stream Days
    streamDays: 2201, streamDaysReal: 425,
    // Konsumsi Batubara (Ton) — Coal Mill A-F
    coalMillA: 165, deltaCoalA: -8,
    coalMillB: 90, deltaCoalB: 10,
    coalMillC: 155, deltaCoalC: -5,
    totalCMBoilerA: 410, deltaTotalCMA: -3,
    coalMillD: 170, deltaCoalD: 5,
    coalMillE: 78, deltaCoalE: -12,
    coalMillF: 148, deltaCoalF: -3,
    totalCMBoilerB: 396, deltaTotalCMB: -10,
    // Consumption Rate Harian
    crA: 0.249, crTarget: 0.210, crB: 0.222,
    // Totalizer Demin & RCW (m³)
    konsHarianDemin: 2419, konsHarianRCW: 3648,
    penerimaanDemin3A: 1888, penerimaanDemin1B: 401, penerimaanRCW1A: 1621,
    // Tank Level Jam 00.00 (m³ / %)
    rcwTank: 3800, rcwPct: 76,
    deminTank: 970, deminPct: 78,
    solarTank: 130, solarPct: 65,
    // Silo & Fly Ash
    unloadingSiloA: 0, unloadingSiloB: 4,
    siloALevel: 76, siloBLevel: 75,
};

function Delta({ value }: { value: number }) {
    if (value === 0) return <span className="text-[9px] font-bold text-slate-500">0</span>;
    const isUp = value > 0;
    return (
        <p className={`mt-1 text-[10px] font-bold ${isUp ? 'text-emerald-400 bg-emerald-500/15' : 'text-red-400 bg-red-500/15'} px-1.5 py-0.5 rounded-full flex items-center gap-0.5 w-fit mx-auto`}>
            <span className="text-[10px]">{isUp ? '↑' : '↓'}</span> {isUp ? '+' : ''}{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1).replace('.', ',') : value.toLocaleString('id-ID')}
        </p>
    );
}

function DeltaSmall({ value }: { value: number }) {
    if (value === 0) return <span className="text-[9px] font-bold text-slate-500">0</span>;
    const isUp = value > 0;
    return (
        <p className={`mt-1 text-[9px] font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'} flex items-center gap-0.5 justify-center`}>
            {isUp ? '↑' : '↓'} {isUp ? '+' : ''}{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2).replace('.', ',') : value}
        </p>
    );
}

function CardHeader({ children, gradient }: { children: React.ReactNode; gradient: string }) {
    return (
        <div className={`${gradient} py-2.5 text-center`}>
            <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">{children}</h3>
        </div>
    );
}

function BarChartDark({ bars, height = 'h-32' }: { bars: { label: string; value: string | number; color: string; textColor?: string; pct: number }[]; height?: string }) {
    return (
        <div className={`${height} relative flex items-end justify-center gap-0 border-b border-slate-600 pb-1 mt-2`}>
            <div className="absolute inset-0 flex flex-col justify-between border-t border-slate-700">
                {[...Array(4)].map((_, i) => <div key={i} className="border-b border-dashed border-slate-700 flex-1" />)}
                <div className="flex-1" />
            </div>
            {bars.map((b, i) => (
                <div key={i} className={`relative w-20 ${b.color} rounded-t-sm flex items-start justify-center ${b.textColor || 'text-white'} font-bold text-[10px] pt-1.5 shadow-sm z-10`} style={{ height: `${b.pct}%` }}>
                    {b.value}
                </div>
            ))}
        </div>
    );
}

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function LaporanHarianPage() {
    const { operator } = useOperator();
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState('2026-03-15');

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    if (!operator) return null;

    const r = DAILY_DATA;

    const dateObj = new Date(selectedDate);
    const hariStr = HARI_ID[dateObj.getDay()];
    const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const prevDate = new Date(dateObj);
    prevDate.setDate(prevDate.getDate() - 1);
    const nextDate = new Date(dateObj);
    nextDate.setDate(nextDate.getDate() + 1);
    const toISO = (d: Date) => d.toISOString().split('T')[0];

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-5">
            {/* Date Navigation - Compact Week Strip */}
            <div className="flex items-center gap-2 justify-center">
                <button onClick={() => { const d = new Date(dateObj); d.setDate(d.getDate() - 7); setSelectedDate(toISO(d)); }}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-surface-highlight transition-all cursor-pointer shrink-0">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <div className="flex items-center gap-1">
                    {Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(dateObj);
                        d.setDate(d.getDate() - 3 + i);
                        const iso = toISO(d);
                        const isActive = iso === selectedDate;
                        const isToday = iso === new Date().toISOString().split('T')[0];
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
                </div>
                <button onClick={() => { const d = new Date(dateObj); d.setDate(d.getDate() + 7); setSelectedDate(toISO(d)); }}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-surface-highlight transition-all cursor-pointer shrink-0">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
                <div className="relative shrink-0 ml-1">
                    <input type="date" value={selectedDate} onChange={e => e.target.value && setSelectedDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    <div className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-surface-highlight transition-all cursor-pointer">
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                    </div>
                </div>
            </div>

            {/* Header */}
            <header className="text-center">
                <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-white">Laporan Harian</h2>
                <p className="text-primary font-bold text-sm tracking-widest uppercase mt-1">Utilitas Batubara</p>
            </header>

            {/* Info Bar - Full Width */}
            <div className="grid grid-cols-4 divide-x divide-cyan-800/60 bg-cyan-950 py-4 px-6 rounded-xl border border-cyan-900 shadow-md w-full">
                <div className="flex items-center justify-center gap-3 px-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hari</span><span className="text-sm font-black text-white">{hariStr}</span></div>
                <div className="flex items-center justify-center gap-3 px-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tanggal</span><span className="text-sm font-black text-white">{formatDate(selectedDate)}</span></div>
                <div className="flex items-center justify-center gap-3 px-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Grup</span><span className="text-sm font-black text-white">{r.group}</span></div>
                <div className="flex items-center justify-center gap-3 px-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Supervisor</span><span className="text-sm font-black text-white">{r.supervisor}</span></div>
            </div>

            {/* MAIN 3-COL GRID */}
            <div className="grid grid-cols-12 gap-3">

                {/* LEFT COLUMN (5/12) */}
                <div className="col-span-12 lg:col-span-5 flex flex-col gap-3">

                    {/* PRODUKSI STEAM */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                        <CardHeader gradient="bg-gradient-to-r from-orange-500 to-amber-500">Produksi Steam</CardHeader>
                        <div className="p-4">
                            <div className="grid grid-cols-3 divide-x divide-slate-700 text-center">
                                {[
                                    { label: 'Steam Boiler A', value: r.steamBoilerA, delta: r.deltaStmA },
                                    { label: 'Steam Boiler B', value: r.steamBoilerB, delta: r.deltaStmB },
                                    { label: 'Total Product', value: r.steamTotal, delta: r.deltaStmTotal },
                                ].map((s, i) => (
                                    <div key={i} className="flex flex-col items-center">
                                        <p className="text-[10px] uppercase tracking-wide text-text-secondary mb-1">{s.label}</p>
                                        <p className="text-2xl font-bold tracking-tight text-white">{s.value.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-500">Ton</span></p>
                                        <Delta value={s.delta} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* DISTRIBUSI STEAM */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                        <CardHeader gradient="bg-gradient-to-r from-orange-500 to-amber-500">Distribusi Steam</CardHeader>
                        <div className="p-4 flex flex-col gap-4">
                            <div className="grid grid-cols-2 text-center border-b border-slate-700 pb-3">
                                <div className="flex flex-col items-center border-r border-slate-700">
                                    <p className="text-[10px] uppercase tracking-wide text-text-secondary mb-1">Steam Inlet Turbine</p>
                                    <p className="text-2xl font-bold tracking-tight text-white">{r.steamInletTurbine.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-500">Ton</span></p>
                                    <Delta value={r.deltaInletTurbine} />
                                </div>
                                <div className="flex flex-col items-center">
                                    <p className="text-[10px] uppercase tracking-wide text-text-secondary mb-1">Steam Condensat</p>
                                    <p className="text-2xl font-bold tracking-tight text-white">{r.steamCondensat.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-500">Ton</span></p>
                                    <Delta value={r.deltaCondensat} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 divide-x divide-slate-700 text-center">
                                {[
                                    { label: 'MPS to Prod I B', value: r.mpsTo1B, delta: r.deltaMps1B },
                                    { label: 'MPS to Prod III A', value: r.mpsTo3A, delta: r.deltaMps3A },
                                    { label: 'LPS Internal', value: r.lpsInternal, delta: r.deltaLps },
                                ].map((s, i) => (
                                    <div key={i} className="flex flex-col items-center px-1">
                                        <p className="text-[9px] uppercase tracking-wide text-text-secondary mb-1">{s.label}</p>
                                        <p className="text-xl font-bold tracking-tight text-white">{s.value.toLocaleString('id-ID')} <span className="text-[9px] font-normal text-slate-500">Ton</span></p>
                                        <DeltaSmall value={s.delta} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* KONSUMSI BAHAN BAKU */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                        <CardHeader gradient="bg-gradient-to-r from-slate-700 to-slate-600">Konsumsi Bahan Baku dan Penolong</CardHeader>
                        <div className="p-4">
                            <div className="grid grid-cols-2 divide-x divide-slate-700">
                                <div className="text-center pb-3">
                                    <p className="text-[10px] uppercase tracking-wide text-text-secondary mb-1">Loading</p>
                                    <p className="text-3xl font-bold tracking-tight text-white">{r.loading} <span className="text-xs font-normal text-slate-500">Svl</span></p>
                                </div>
                                <div className="flex flex-col items-center text-center pb-3">
                                    <p className="text-[10px] uppercase tracking-wide text-text-secondary mb-1">Boiler Feed Water</p>
                                    <p className="text-3xl font-bold tracking-tight text-white">{r.bfw.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500">m³</span></p>
                                    <Delta value={r.deltaBfw} />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 mt-4 text-center border-t border-slate-700 pt-4 mb-4">
                                {[
                                    { label: 'Phosphat', value: r.phosphat, unit: 'Kg', delta: r.deltaPhosphat },
                                    { label: 'Amine', value: r.amine, unit: 'L', delta: r.deltaAmine },
                                    { label: 'Hydrazine', value: r.hydrazine, unit: 'L', delta: r.deltaHydrazine },
                                ].map((s, i) => (
                                    <div key={i} className={`flex flex-col items-center ${i === 1 ? 'border-l border-r border-slate-700' : ''}`}>
                                        <p className="text-[10px] uppercase tracking-wide text-text-secondary mb-1">{s.label}</p>
                                        <p className="text-xl font-bold tracking-tight text-white">{typeof s.value === 'number' && s.value % 1 !== 0 ? s.value.toString().replace('.', ',') : s.value} <span className="text-[10px] font-normal text-slate-500">{s.unit}</span></p>
                                        <DeltaSmall value={s.delta} />
                                    </div>
                                ))}
                            </div>

                            <div className="bg-surface-highlight rounded-lg p-2 mb-4">
                                <div className="grid grid-cols-3 text-center font-bold text-[10px] text-text-secondary uppercase tracking-wider pb-1">
                                    <div>Stock Phosphat</div>
                                    <div>Stock Amine</div>
                                    <div>Stock Hydrazine</div>
                                </div>
                                <div className="grid grid-cols-3 text-center font-bold text-lg text-white">
                                    <div>{r.stockPhosphat} <span className="text-[10px] font-normal text-slate-500">pc</span></div>
                                    <div>{r.stockAmine} <span className="text-[10px] font-normal text-slate-500">pc</span></div>
                                    <div>{r.stockHydrazine} <span className="text-[10px] font-normal text-slate-500">pc</span></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 mt-2 text-center divide-x divide-slate-700 bg-surface-dark border border-slate-700 rounded-lg py-2">
                                {[
                                    { label: 'Loading', value: r.solarLoading },
                                    { label: 'Bengkel', value: r.solarBengkel },
                                    { label: 'Pemakaian', value: r.solarPemakaian },
                                    { label: 'Revamp', value: r.solarRevamp },
                                ].map((s, i) => (
                                    <div key={i}>
                                        <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-1">{s.label}</p>
                                        <p className="text-sm font-bold text-white">{s.value} <span className="text-[9px] text-slate-500">m³</span></p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* MIDDLE COLUMN (4/12) */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">

                    {/* PRODUKSI POWER */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden flex-1 flex flex-col">
                        <CardHeader gradient="bg-gradient-to-r from-emerald-500 to-teal-500">Produksi Power</CardHeader>
                        <div className="p-4 flex-1 flex flex-col justify-center items-center">
                            <p className="text-[10px] uppercase tracking-wide text-text-secondary mb-1">Power TG</p>
                            <p className="text-5xl font-black tracking-tighter text-white">{r.powerTG} <span className="text-lg font-normal text-slate-500">MW</span></p>
                            <Delta value={r.deltaPowerTG} />
                        </div>
                    </div>

                    {/* DISTRIBUSI POWER */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                        <CardHeader gradient="bg-gradient-to-r from-emerald-500 to-teal-500">Distribusi Power</CardHeader>
                        <div className="p-4">
                            <div className="grid grid-cols-2 text-center pb-4">
                                <div className="flex flex-col items-center border-r border-slate-700">
                                    <p className="text-[9px] uppercase tracking-wide text-text-secondary mb-1">Power Internal UBB</p>
                                    <p className="text-3xl font-bold tracking-tight text-white">{r.powerInternalUBB} <span className="text-xs font-normal text-slate-500">MW</span></p>
                                    <Delta value={r.deltaPowerUBB} />
                                </div>
                                <div className="flex flex-col items-center">
                                    <p className="text-[9px] uppercase tracking-wide text-text-secondary mb-1">PIE Export</p>
                                    <p className="text-3xl font-bold tracking-tight text-white">{r.pieExport.toString().replace('.', ',')} <span className="text-xs font-normal text-slate-500">MW</span></p>
                                    <Delta value={r.deltaPieExport} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 text-center pt-4 border-t border-slate-700">
                                <div className="flex flex-col items-center border-r border-slate-700">
                                    <p className="text-[9px] uppercase tracking-wide text-text-secondary mb-1">Power II</p>
                                    <p className="text-2xl font-bold tracking-tight text-white">{r.powerII} <span className="text-[10px] font-normal text-slate-500">MW</span></p>
                                    <DeltaSmall value={r.deltaPowerII} />
                                </div>
                                <div className="flex flex-col items-center">
                                    <p className="text-[9px] uppercase tracking-wide text-text-secondary mb-1">Power III A</p>
                                    <p className="text-2xl font-bold tracking-tight text-white">{r.powerIIIA} <span className="text-[10px] font-normal text-slate-500">MW</span></p>
                                    <DeltaSmall value={r.deltaPowerIIIA} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TOTALIZER */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                        <CardHeader gradient="bg-gradient-to-r from-emerald-600 to-teal-600">Totalizer</CardHeader>
                        <div className="p-3">
                            <div className="grid grid-cols-2 text-center divide-x divide-slate-700 font-bold text-[10px] text-text-secondary uppercase tracking-widest pb-1">
                                <div>PIE EXSPORT</div>
                                <div>PIE IMPORT</div>
                            </div>
                            <div className="grid grid-cols-2 text-center divide-x divide-slate-700 font-bold text-xl tracking-tight text-white pt-1">
                                <div>{r.pieExportKwh.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-500">Kwh</span></div>
                                <div>{r.pieImportKwh.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-500">Kwh</span></div>
                            </div>
                        </div>
                    </div>

                    {/* STOCK BATUBARA */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                        <CardHeader gradient="bg-gradient-to-r from-slate-700 to-slate-600">Stock Batubara</CardHeader>
                        <div className="p-4 text-center">
                            <div className="bg-surface-highlight rounded-lg p-2 mb-4">
                                <div className="grid grid-cols-2 font-bold mb-1 text-[10px] text-text-secondary uppercase tracking-widest">
                                    <div>TOTAL ke PF 1</div>
                                    <div>TOTAL ke PF2</div>
                                </div>
                                <div className="grid grid-cols-2 font-bold tracking-tight text-2xl text-white">
                                    <div>{r.totalKePF1} <span className="text-xs font-normal text-slate-500">Ton</span></div>
                                    <div>{r.totalKePF2} <span className="text-xs font-normal text-slate-500">Ton</span></div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center">
                                <p className="text-[10px] uppercase tracking-wide text-text-secondary mb-1">STOCK BATUBARA (Jam 24.00)</p>
                                <p className="text-4xl font-black tracking-tighter text-white">{r.stockBatubara.toLocaleString('id-ID')}</p>
                                <Delta value={r.deltaStockBatubara} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN (3/12) */}
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-3">

                    {/* RKAP */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden flex-1 flex flex-col">
                        <CardHeader gradient="bg-gradient-to-r from-red-600 to-rose-600">RKAP</CardHeader>
                        <div className="p-4 flex-1 flex flex-col">
                            <p className="text-center font-bold text-xs text-text-secondary uppercase tracking-widest mb-4">PRODUK STEAM</p>
                            <BarChartDark
                                bars={[
                                    { label: 'RKAP Steam', value: r.rkapSteam.toLocaleString('id-ID'), color: 'bg-emerald-600', pct: 100 },
                                    { label: 'Steam Product', value: r.steamProduct.toLocaleString('id-ID'), color: 'bg-orange-500', pct: Math.round((r.steamProduct / r.rkapSteam) * 100) },
                                ]}
                            />
                            <div className="flex items-center justify-center gap-5 mt-4 mb-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-600" />
                                    <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">RKAP Steam</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                                    <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Steam Product</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CONSUMPTION RATE */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                        <CardHeader gradient="bg-gradient-to-r from-blue-600 to-indigo-600">CONSUMPTION RATE</CardHeader>
                        <div className="p-4 flex flex-col">
                            <BarChartDark
                                bars={[
                                    { label: 'CR Tahunan', value: r.crTahunan.toFixed(3).replace('.', ','), color: 'bg-emerald-600', pct: 90 },
                                    { label: 'CR Boiler AB', value: r.crBoilerAB.toFixed(3).replace('.', ','), color: 'bg-slate-500', pct: 92 },
                                ]}
                            />
                            <div className="flex items-center justify-center gap-5 mt-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-600" />
                                    <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">CR Tahunan</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-slate-500" />
                                    <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">CR Boiler AB</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* STREAM DAYS */}
                    <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                        <CardHeader gradient="bg-gradient-to-r from-emerald-500 to-teal-500">STREAM DAYS</CardHeader>
                        <div className="p-4 flex flex-col">
                            <BarChartDark
                                height="h-28"
                                bars={[
                                    { label: 'Stream Days', value: r.streamDays, color: 'bg-emerald-500', pct: 60 },
                                    { label: 'Real', value: r.streamDaysReal, color: 'bg-blue-600', pct: 85 },
                                ]}
                            />
                            <div className="flex items-center justify-center gap-5 mt-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                    <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Stream Days</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-600" />
                                    <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Real</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* KONSUMSI BATUBARA + CR HARIAN */}
            <div className="grid grid-cols-12 gap-3">
                {/* KONSUMSI BATUBARA */}
                <div className="col-span-12 lg:col-span-7 bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                    <CardHeader gradient="bg-gradient-to-r from-red-600 to-rose-600">Konsumsi Batubara</CardHeader>
                    <div className="p-4 flex flex-col gap-4">
                        <div className="grid grid-cols-4 divide-x divide-slate-700 text-center border-b border-slate-700 pb-3">
                            {[
                                { label: 'Coal Mill A', value: r.coalMillA, delta: r.deltaCoalA },
                                { label: 'Coal Mill B', value: r.coalMillB, delta: r.deltaCoalB },
                                { label: 'Coal Mill C', value: r.coalMillC, delta: r.deltaCoalC },
                            ].map((s, i) => (
                                <div key={i} className="px-1 flex flex-col items-center">
                                    <p className="text-[9px] uppercase tracking-wide text-text-secondary mb-1">{s.label}</p>
                                    <p className="text-2xl font-bold tracking-tight text-white">{s.value} <span className="text-[10px] font-normal text-slate-500">Ton</span></p>
                                    <DeltaSmall value={s.delta} />
                                </div>
                            ))}
                            <div className="px-1 border-l border-slate-600 flex flex-col items-center bg-surface-highlight rounded-r-lg">
                                <p className="text-[9px] uppercase tracking-wide text-text-secondary mb-1">Total CM Boiler A</p>
                                <p className="text-3xl font-black tracking-tighter text-white">{r.totalCMBoilerA.toString().replace('.', ',')} <span className="text-xs font-normal text-slate-500">Ton</span></p>
                                <DeltaSmall value={r.deltaTotalCMA} />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-slate-700 text-center">
                            {[
                                { label: 'Coal Mill D', value: r.coalMillD, delta: r.deltaCoalD },
                                { label: 'Coal Mill E', value: r.coalMillE, delta: r.deltaCoalE },
                                { label: 'Coal Mill F', value: r.coalMillF, delta: r.deltaCoalF },
                            ].map((s, i) => (
                                <div key={i} className="px-1 flex flex-col items-center">
                                    <p className="text-[9px] uppercase tracking-wide text-text-secondary mb-1">{s.label}</p>
                                    <p className="text-2xl font-bold tracking-tight text-white">{s.value} <span className="text-[10px] font-normal text-slate-500">Ton</span></p>
                                    <DeltaSmall value={s.delta} />
                                </div>
                            ))}
                            <div className="px-1 border-l border-slate-600 flex flex-col items-center bg-surface-highlight rounded-r-lg">
                                <p className="text-[9px] uppercase tracking-wide text-text-secondary mb-1">Total CM Boiler B</p>
                                <p className="text-3xl font-black tracking-tighter text-white">{r.totalCMBoilerB.toString().replace('.', ',')} <span className="text-xs font-normal text-slate-500">Ton</span></p>
                                <DeltaSmall value={r.deltaTotalCMB} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* CR HARIAN */}
                <div className="col-span-12 lg:col-span-5 bg-surface-dark rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                    <CardHeader gradient="bg-gradient-to-r from-blue-600 to-indigo-600">Consumption Rate Harian</CardHeader>
                    <div className="p-4 flex-1 flex flex-col justify-end">
                        <div className="h-32 relative flex items-end justify-center w-full gap-2 border-b border-slate-600 pb-1 mt-6 px-4">
                            <div className="absolute inset-0 flex flex-col justify-between border-t border-slate-700">
                                {[...Array(5)].map((_, i) => <div key={i} className="border-b border-dashed border-slate-700 flex-1" />)}
                            </div>
                            {[
                                { value: r.crA.toFixed(3).replace('.', ','), color: 'bg-red-500', pct: 80 },
                                { value: r.crTarget.toFixed(3).replace('.', ','), color: 'bg-emerald-500', pct: 75 },
                                { value: r.crB.toFixed(3).replace('.', ','), color: 'bg-blue-600', pct: 85 },
                            ].map((b, i) => (
                                <div key={i} className={`relative w-16 ${b.color} rounded-t-sm flex items-start justify-center text-white font-bold text-xs pt-2 shadow-sm z-10 mx-1`} style={{ height: `${b.pct}%` }}>
                                    {b.value}
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-center gap-6 mt-4">
                            {[
                                { label: 'CR A', color: 'bg-red-500' },
                                { label: 'Target CR', color: 'bg-emerald-500' },
                                { label: 'CR B', color: 'bg-blue-600' },
                            ].map((l, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${l.color}`} />
                                    <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">{l.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* TOTALIZER DEMIN & RCW */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                <CardHeader gradient="bg-gradient-to-r from-blue-600 to-indigo-600">Totalizer Konsumsi Demin dan RCW</CardHeader>
                <div className="p-4">
                    <div className="grid grid-cols-5 text-center divide-x divide-slate-700">
                        {[
                            { label: 'Konsumsi Harian Demin Water', value: r.konsHarianDemin },
                            { label: 'Konsumsi harian RCW', value: r.konsHarianRCW },
                            { label: 'Penerimaan Demin dari 3A', value: r.penerimaanDemin3A },
                            { label: 'Penerimaan Demin dari 1B', value: r.penerimaanDemin1B },
                            { label: 'Penerimaan RCW dari 1A', value: r.penerimaanRCW1A },
                        ].map((s, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <p className="text-[10px] text-text-secondary uppercase tracking-wide mb-2">{s.label}</p>
                                <p className="text-2xl font-bold tracking-tight text-white">{s.value.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-500">m³</span></p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* TANKS ROW */}
            <div className="grid grid-cols-12 gap-3">
                {/* SILO FLY ASH */}
                <div className="col-span-12 lg:col-span-6 bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                    <CardHeader gradient="bg-gradient-to-r from-yellow-600 to-amber-600">Silo Fly Ash</CardHeader>
                    <div className="flex p-4 gap-6 items-end relative min-h-[160px]">
                        <div className="text-center w-24 z-10 pb-4">
                            <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider mb-2 leading-tight">Unloading<br/>Silo A</p>
                            <p className="text-3xl font-bold text-white border-b-2 border-slate-600 w-14 mx-auto pb-1">{r.unloadingSiloA}</p>
                        </div>
                        <div className="text-center w-24 z-10 pb-4">
                            <p className="text-[10px] uppercase font-bold text-text-secondary tracking-wider mb-2 leading-tight">Unloading<br/>Silo B</p>
                            <p className="text-3xl font-bold text-white border-b-2 border-slate-600 w-14 mx-auto pb-1">{r.unloadingSiloB}</p>
                        </div>
                        <div className="flex-1 relative h-[120px] flex items-end">
                            <div className="absolute left-0 top-0 bottom-0 w-6 flex flex-col justify-between text-[9px] text-slate-500 font-bold z-20">
                                <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                            </div>
                            <div className="absolute left-6 right-0 top-0 bottom-0 flex flex-col justify-between z-10">
                                {[...Array(5)].map((_, i) => <div key={i} className={`${i < 4 ? 'border-t border-dashed' : 'border-t'} border-slate-600 w-full h-0`} />)}
                            </div>
                            <div className="ml-6 flex-1 flex justify-around items-end h-full relative z-10 pb-[1px]">
                                {[
                                    { label: 'Silo A', level: r.siloALevel, color: 'bg-yellow-600', text: 'text-white' },
                                    { label: 'Silo B', level: r.siloBLevel, color: 'bg-yellow-400', text: 'text-yellow-900' },
                                ].map((s, i) => (
                                    <div key={i} className="flex flex-col items-center">
                                        <span className="text-[10px] font-bold text-text-secondary mb-2 -mt-6">{s.label}</span>
                                        <div className={`w-16 ${s.color} rounded-t-sm flex items-center justify-center ${s.text} text-xs font-bold shadow-sm`} style={{ height: `${s.level}%` }}>
                                            {s.level}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RCW TANK */}
                <div className="col-span-4 lg:col-span-2 bg-surface-dark rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                    <CardHeader gradient="bg-gradient-to-r from-indigo-500 to-violet-500">RCW Tank</CardHeader>
                    <div className="flex-1 relative p-3 flex min-h-[160px]">
                        <div className="absolute top-2 right-3 text-sm font-black text-indigo-400 z-20 bg-surface-highlight px-2 py-0.5 rounded shadow-sm">{r.rcwPct},0%</div>
                        <div className="w-8 flex flex-col justify-between pt-5 pb-1 text-[9px] text-slate-500 font-bold z-20">
                            <span>5 rb</span><span>4 rb</span><span>3 rb</span><span>2 rb</span><span>1 rb</span>
                        </div>
                        <div className="flex-1 flex items-end justify-center relative mt-6 border-b border-slate-600">
                            <div className="w-full bg-indigo-600 rounded-t-sm text-white text-center text-xs font-bold pt-2 shadow-sm relative overflow-hidden" style={{ height: `${r.rcwPct}%` }}>
                                <div className="absolute inset-0 bg-white/10 opacity-50" />
                                {r.rcwTank.toLocaleString('id-ID')}
                            </div>
                        </div>
                    </div>
                </div>

                {/* DEMIN TANK */}
                <div className="col-span-4 lg:col-span-2 bg-surface-dark rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                    <CardHeader gradient="bg-gradient-to-r from-sky-500 to-cyan-500">Demin Tank</CardHeader>
                    <div className="flex-1 relative p-3 flex min-h-[160px]">
                        <div className="absolute top-2 right-3 text-sm font-black text-sky-400 z-20 bg-surface-highlight px-2 py-0.5 rounded shadow-sm">{r.deminPct},0%</div>
                        <div className="w-10 flex flex-col justify-between pt-5 pb-1 text-[9px] text-slate-500 font-bold z-20">
                            <span>1,25...</span><span>1 rb</span><span>750</span><span>500</span><span>250</span>
                        </div>
                        <div className="flex-1 flex items-end justify-center relative mt-6 border-b border-slate-600">
                            <div className="w-full bg-sky-500 rounded-t-sm text-white text-center text-xs font-bold pt-2 shadow-sm relative overflow-hidden" style={{ height: `${r.deminPct}%` }}>
                                <div className="absolute inset-0 bg-white/10 opacity-50" />
                                {r.deminTank.toLocaleString('id-ID')}
                            </div>
                        </div>
                    </div>
                </div>

                {/* SOLAR TANK */}
                <div className="col-span-4 lg:col-span-2 bg-surface-dark rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                    <CardHeader gradient="bg-gradient-to-r from-slate-700 to-slate-600">Solar Tank</CardHeader>
                    <div className="flex-1 relative p-3 flex min-h-[160px]">
                        <div className="absolute top-2 right-3 text-sm font-black text-slate-300 z-20 bg-surface-highlight px-2 py-0.5 rounded shadow-sm">{r.solarPct},0%</div>
                        <div className="w-8 flex flex-col justify-between pt-5 pb-1 text-[9px] text-slate-500 font-bold z-20">
                            <span>200</span><span>150</span><span>100</span><span>50</span><span>0</span>
                        </div>
                        <div className="flex-1 flex items-end justify-center relative mt-6 border-b border-slate-600">
                            <div className="w-full bg-slate-600 rounded-t-sm text-white text-center text-xs font-bold pt-2 shadow-sm relative overflow-hidden" style={{ height: `${r.solarPct}%` }}>
                                <div className="absolute inset-0 bg-white/5 opacity-50" />
                                {r.solarTank}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Print PDF Button */}
            <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-30">
                <button onClick={() => window.open('/laporan-harian/preview', '_blank')}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-[0_4px_24px_rgba(43,124,238,0.5)] hover:shadow-[0_4px_32px_rgba(43,124,238,0.7)] hover:scale-105">
                    <span className="material-symbols-outlined text-lg">print</span>
                    Print PDF
                </button>
            </div>
        </div>
    );
}
