'use client';

// ─── Daily Report Data ───
const REPORT = {
    date: '2026-03-15',
    hari: 'Minggu',
    group: 'D',
    supervisor: 'Ade',
    // Produksi Steam
    steamBoilerA: 1580, deltaStmA: -98,
    steamBoilerB: 1605, deltaStmB: -513,
    steamTotal: 3185, deltaStmTotal: -611,
    // Distribusi Steam
    steamInletTurbine: 525, deltaInletTurbine: -397,
    steamCondensat: 513, deltaCondensat: -336,
    mpsTo1B: 1365, deltaMps1B: -182,
    mpsTo3A: 1172, deltaMps3A: -9,
    lpsInternal: 12, deltaLps: -61,
    // Konsumsi Bahan Baku
    loading: 233,
    bfw: 3236, deltaBfw: -603,
    phosphat: 3, deltaPhosphat: -2,
    amine: 8, deltaAmine: 2,
    hydrazine: 0.5, deltaHydrazine: 0.25,
    stockPhosphat: 49, stockAmine: 26, stockHydrazine: 33,
    solarLoading: 0, solarBengkel: 0, solarPemakaian: 0, solarRevamp: 0,
    // Produksi Power
    powerTG: 142, deltaPowerTG: -127,
    // Distribusi Power
    powerInternalUBB: 105, deltaPowerUBB: -17,
    pieExport: -0.3, deltaPieExport: -0.39,
    powerII: 187, deltaPowerII: -38,
    powerIIIA: 38, deltaPowerIIIA: 2,
    // Totalizer
    pieExportKwh: 111300,
    pieImportKwh: 32374,
    // Stock Batubara
    totalKePF1: 0, totalKePF2: 0,
    stockBatubara: 8411.46, deltaStockBatubara: -712.8,
    // RKAP
    rkapSteam: 569400, steamProduct: 221865,
    // Consumption Rate
    crTahunan: 0.220, crBoilerAB: 0.224,
    // Stream Days
    streamDays: 307, streamDaysReal: 425,
    // Konsumsi Batubara
    coalMillA: 171, deltaCoalA: -13,
    coalMillB: 0, deltaCoalB: 0,
    coalMillC: 145, deltaCoalC: -12,
    totalCMBoilerA: 347.6, deltaTotalCMA: -27.5,
    coalMillD: 164, deltaCoalD: -1,
    coalMillE: 0, deltaCoalE: -89,
    coalMillF: 168, deltaCoalF: 7,
    totalCMBoilerB: 365.2, deltaTotalCMB: -91.3,
    // CR Harian
    crA: 0.220, crTarget: 0.210, crB: 0.228,
    // Totalizer Demin & RCW
    konsHarianDemin: 2668, konsHarianRCW: 2410,
    penerimaanDemin3A: 2356, penerimaanDemin1B: 521, penerimaanRCW1A: 1915,
    // Tanks
    rcwTank: 4650, rcwPct: 93,
    deminTank: 1000, deminPct: 80,
    solarTank: 152, solarPct: 76,
    // Silo Fly Ash
    unloadingSiloA: 5, unloadingSiloB: 0,
    siloALevel: 34, siloBLevel: 15,
};

function Delta({ value, unit }: { value: number; unit?: string }) {
    if (value === 0) return <span className="text-[9px] font-bold text-slate-400">0</span>;
    const isUp = value > 0;
    return (
        <p className={`mt-1 text-[10px] font-bold ${isUp ? 'text-emerald-500 bg-emerald-50' : 'text-red-500 bg-red-50'} px-1.5 py-0.5 rounded-full flex items-center gap-0.5 w-fit mx-auto`}>
            <span className="text-[10px]">{isUp ? '↑' : '↓'}</span> {isUp ? '+' : ''}{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1).replace('.', ',') : value.toLocaleString('id-ID')}{unit ? ` ${unit}` : ''}
        </p>
    );
}

function DeltaSmall({ value }: { value: number }) {
    if (value === 0) return <span className="text-[9px] font-bold text-slate-400">0</span>;
    const isUp = value > 0;
    return (
        <p className={`mt-1 text-[9px] font-bold ${isUp ? 'text-emerald-500' : 'text-red-500'} flex items-center gap-0.5 justify-center`}>
            {isUp ? '↑' : '↓'} {isUp ? '+' : ''}{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2).replace('.', ',') : value}
        </p>
    );
}

function BarChart({ bars, height = 'h-32' }: { bars: { label: string; value: string | number; color: string; textColor?: string; pct: number }[]; height?: string }) {
    return (
        <div className={`${height} relative flex items-end justify-center gap-0 border-b border-slate-300 pb-1 mt-2`}>
            <div className="absolute inset-0 flex flex-col justify-between border-t border-slate-200">
                {[...Array(4)].map((_, i) => <div key={i} className="border-b border-dashed border-slate-200 flex-1" />)}
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

export default function PreviewPdfLaporanHarian() {
    const r = REPORT;

    return (
        <>
            <style jsx global>{`
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
                @media print {
                    @page { size: 320mm 450mm; margin: 0; }
                    body { background: white !important; }
                    .no-print { display: none !important; }
                    .pdf-container {
                        width: 100% !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        border: none !important;
                        padding: 10px !important;
                    }
                    * {
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                }
            `}</style>

            <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8 font-[Inter]">
                <div className="pdf-container w-[320mm] bg-white rounded-xl shadow-2xl border border-slate-200 mx-auto p-[30px] text-slate-800">

                    {/* HEADER */}
                    <header className="flex justify-between mb-4 pb-4 border-b-2 border-blue-600 items-center">
                        <div className="flex items-center gap-4">
                            <img alt="Danantara" className="h-12 w-auto object-contain" src="/logo/Danantara_Indonesia_(no_SW).png" />
                            <img alt="Pupuk Indonesia" className="h-12 w-auto object-contain" src="/logo/Logo_Pupuk_Indonesia__Persero_-removebg-preview.png" />
                            <img alt="Petrokimia Gresik" className="h-12 w-auto object-contain" src="/logo/logo-PG-agro-trans-small-removebg-preview.png" />
                        </div>
                        <div className="text-right">
                            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-800 leading-tight">Laporan Harian</h1>
                            <h2 className="text-xl font-bold uppercase tracking-tight text-blue-600">Utilitas Batubara</h2>
                        </div>
                    </header>

                    {/* INFO BAR */}
                    <section className="grid grid-cols-4 divide-x divide-cyan-800/60 mb-5 bg-cyan-950 py-3.5 rounded-lg border border-cyan-900 shadow-md w-full">
                        {[
                            { label: 'Hari', value: r.hari },
                            { label: 'Tanggal', value: new Date(r.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) },
                            { label: 'Grup', value: r.group },
                            { label: 'Supervisor', value: r.supervisor },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-center gap-3">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.label}</span>
                                <span className="text-sm font-black text-white uppercase">{item.value}</span>
                            </div>
                        ))}
                    </section>

                    {/* MAIN 3-COL GRID */}
                    <div className="grid grid-cols-12 gap-3 mb-3">

                        {/* LEFT COLUMN (5/12) */}
                        <div className="col-span-5 flex flex-col gap-3">

                            {/* PRODUKSI STEAM */}
                            <div className="report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-center">
                                    <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Produksi Steam</h3>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-3 divide-x divide-slate-200 text-center">
                                        {[
                                            { label: 'Steam Boiler A', value: r.steamBoilerA, delta: r.deltaStmA },
                                            { label: 'Steam Boiler B', value: r.steamBoilerB, delta: r.deltaStmB },
                                            { label: 'Total Product', value: r.steamTotal, delta: r.deltaStmTotal },
                                        ].map((s, i) => (
                                            <div key={i} className="flex flex-col items-center">
                                                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{s.label}</p>
                                                <p className="text-2xl font-bold tracking-tight text-slate-800">{s.value.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">Ton</span></p>
                                                <Delta value={s.delta} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* DISTRIBUSI STEAM */}
                            <div className="report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-center">
                                    <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Distribusi Steam</h3>
                                </div>
                                <div className="p-4 flex flex-col gap-4">
                                    <div className="grid grid-cols-2 text-center border-b border-slate-100 pb-3">
                                        <div className="flex flex-col items-center border-r border-slate-100">
                                            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Steam Inlet Turbine</p>
                                            <p className="text-2xl font-bold tracking-tight text-slate-800">{r.steamInletTurbine.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">Ton</span></p>
                                            <Delta value={r.deltaInletTurbine} />
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Steam Condensat</p>
                                            <p className="text-2xl font-bold tracking-tight text-slate-800">{r.steamCondensat.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">Ton</span></p>
                                            <Delta value={r.deltaCondensat} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
                                        {[
                                            { label: 'MPS to Prod I B', value: r.mpsTo1B, delta: r.deltaMps1B },
                                            { label: 'MPS to Prod III A', value: r.mpsTo3A, delta: r.deltaMps3A },
                                            { label: 'LPS Internal', value: r.lpsInternal, delta: r.deltaLps },
                                        ].map((s, i) => (
                                            <div key={i} className="flex flex-col items-center px-1">
                                                <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">{s.label}</p>
                                                <p className="text-xl font-bold tracking-tight text-slate-800">{s.value.toLocaleString('id-ID')} <span className="text-[9px] font-normal text-slate-400">Ton</span></p>
                                                <DeltaSmall value={s.delta} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* KONSUMSI BAHAN BAKU */}
                            <div className="report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-slate-800 to-slate-700 py-2.5 text-center">
                                    <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Konsumsi Bahan Baku dan Penolong</h3>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-2 divide-x divide-slate-100">
                                        <div className="text-center pb-3">
                                            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Loading</p>
                                            <p className="text-3xl font-bold tracking-tight text-slate-800">{r.loading} <span className="text-xs font-normal text-slate-400">Svl</span></p>
                                        </div>
                                        <div className="flex flex-col items-center text-center pb-3">
                                            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Boiler Feed Water</p>
                                            <p className="text-3xl font-bold tracking-tight text-slate-800">{r.bfw.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-400">m³</span></p>
                                            <Delta value={r.deltaBfw} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 mt-4 text-center border-t border-slate-100 pt-4 mb-4">
                                        {[
                                            { label: 'Phosphat', value: r.phosphat, unit: 'Kg', delta: r.deltaPhosphat },
                                            { label: 'Amine', value: r.amine, unit: 'L', delta: r.deltaAmine },
                                            { label: 'Hydrazine', value: r.hydrazine, unit: 'L', delta: r.deltaHydrazine },
                                        ].map((s, i) => (
                                            <div key={i} className={`flex flex-col items-center ${i === 1 ? 'border-l border-r border-slate-100' : ''}`}>
                                                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{s.label}</p>
                                                <p className="text-xl font-bold tracking-tight text-slate-800">{typeof s.value === 'number' && s.value % 1 !== 0 ? s.value.toString().replace('.', ',') : s.value} <span className="text-[10px] font-normal text-slate-400">{s.unit}</span></p>
                                                <DeltaSmall value={s.delta} />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="bg-slate-50 rounded-lg p-2 mb-4">
                                        <div className="grid grid-cols-3 text-center font-bold text-[10px] text-slate-500 uppercase tracking-wider pb-1">
                                            <div>Stock Phosphat</div>
                                            <div>Stock Amine</div>
                                            <div>Stock Hydrazine</div>
                                        </div>
                                        <div className="grid grid-cols-3 text-center font-bold text-lg text-slate-800">
                                            <div>{r.stockPhosphat} <span className="text-[10px] font-normal text-slate-400">pc</span></div>
                                            <div>{r.stockAmine} <span className="text-[10px] font-normal text-slate-400">pc</span></div>
                                            <div>{r.stockHydrazine} <span className="text-[10px] font-normal text-slate-400">pc</span></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 mt-2 text-center divide-x divide-slate-100 bg-white border border-slate-200 rounded-lg py-2">
                                        {[
                                            { label: 'Loading', value: r.solarLoading },
                                            { label: 'Bengkel', value: r.solarBengkel },
                                            { label: 'Pemakaian', value: r.solarPemakaian },
                                            { label: 'Revamp', value: r.solarRevamp },
                                        ].map((s, i) => (
                                            <div key={i}>
                                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                                                <p className="text-sm font-bold text-slate-800">{s.value} <span className="text-[9px] text-slate-400">m³</span></p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* MIDDLE COLUMN (4/12) */}
                        <div className="col-span-4 flex flex-col gap-3">

                            {/* PRODUKSI POWER */}
                            <div className="report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden flex-1 flex flex-col">
                                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-center">
                                    <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Produksi Power</h3>
                                </div>
                                <div className="p-4 flex-1 flex flex-col justify-center items-center">
                                    <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Power TG</p>
                                    <p className="text-5xl font-black tracking-tighter text-slate-800">{r.powerTG} <span className="text-lg font-normal text-slate-400">MW</span></p>
                                    <Delta value={r.deltaPowerTG} />
                                </div>
                            </div>

                            {/* DISTRIBUSI POWER */}
                            <div className="report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-center">
                                    <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Distribusi Power</h3>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-2 text-center pb-4">
                                        <div className="flex flex-col items-center border-r border-slate-100">
                                            <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">Power Internal UBB</p>
                                            <p className="text-3xl font-bold tracking-tight text-slate-800">{r.powerInternalUBB} <span className="text-xs font-normal text-slate-400">MW</span></p>
                                            <Delta value={r.deltaPowerUBB} />
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">PIE Export</p>
                                            <p className="text-3xl font-bold tracking-tight text-slate-800">{r.pieExport.toString().replace('.', ',')} <span className="text-xs font-normal text-slate-400">MW</span></p>
                                            <Delta value={r.deltaPieExport} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 text-center pt-4 border-t border-slate-100">
                                        <div className="flex flex-col items-center border-r border-slate-100">
                                            <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">Power II</p>
                                            <p className="text-2xl font-bold tracking-tight text-slate-800">{r.powerII} <span className="text-[10px] font-normal text-slate-400">MW</span></p>
                                            <DeltaSmall value={r.deltaPowerII} />
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">Power III A</p>
                                            <p className="text-2xl font-bold tracking-tight text-slate-800">{r.powerIIIA} <span className="text-[10px] font-normal text-slate-400">MW</span></p>
                                            <DeltaSmall value={r.deltaPowerIIIA} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* TOTALIZER */}
                            <div className="report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-center">
                                    <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Totalizer</h3>
                                </div>
                                <div className="p-3">
                                    <div className="grid grid-cols-2 text-center divide-x divide-slate-100 font-bold text-[10px] text-slate-500 uppercase tracking-widest pb-1">
                                        <div>PIE EXSPORT</div>
                                        <div>PIE IMPORT</div>
                                    </div>
                                    <div className="grid grid-cols-2 text-center divide-x divide-slate-100 font-bold text-xl tracking-tight text-slate-800 pt-1">
                                        <div>{r.pieExportKwh.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">Kwh</span></div>
                                        <div>{r.pieImportKwh.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">Kwh</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* STOCK BATUBARA */}
                            <div className="report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-slate-800 to-slate-700 py-2.5 text-center">
                                    <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Stock Batubara</h3>
                                </div>
                                <div className="p-4 text-center">
                                    <div className="bg-slate-50 rounded-lg p-2 mb-4">
                                        <div className="grid grid-cols-2 font-bold mb-1 text-[10px] text-slate-500 uppercase tracking-widest">
                                            <div>TOTAL ke PF 1</div>
                                            <div>TOTAL ke PF2</div>
                                        </div>
                                        <div className="grid grid-cols-2 font-bold tracking-tight text-2xl text-slate-800">
                                            <div>{r.totalKePF1} <span className="text-xs font-normal text-slate-400">Ton</span></div>
                                            <div>{r.totalKePF2} <span className="text-xs font-normal text-slate-400">Ton</span></div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">STOCK BATUBARA (Jam 24.00)</p>
                                        <p className="text-4xl font-black tracking-tighter text-slate-800">{r.stockBatubara.toLocaleString('id-ID')}</p>
                                        <Delta value={r.deltaStockBatubara} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN (3/12) */}
                        <div className="col-span-3 flex flex-col gap-3">

                            {/* RKAP */}
                            <div className="report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden flex-1 flex flex-col">
                                <div className="bg-gradient-to-r from-red-600 to-rose-600 py-2.5 text-center mb-2">
                                    <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">RKAP</h3>
                                </div>
                                <div className="p-4 flex-1 flex flex-col">
                                    <p className="text-center font-bold text-xs text-slate-500 uppercase tracking-widest mb-4">PRODUK STEAM</p>
                                    <BarChart
                                        bars={[
                                            { label: 'RKAP Steam', value: r.rkapSteam.toLocaleString('id-ID'), color: 'bg-emerald-600', pct: 100 },
                                            { label: 'Steam Product', value: r.steamProduct.toLocaleString('id-ID'), color: 'bg-orange-500', pct: Math.round((r.steamProduct / r.rkapSteam) * 100) },
                                        ]}
                                    />
                                    <div className="flex items-center justify-center gap-5 mt-4 mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-emerald-600" />
                                            <p className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">RKAP Steam</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-orange-500" />
                                            <p className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Steam Product</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CONSUMPTION RATE */}
                            <div className="report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-center">
                                    <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">CONSUMPTION RATE</h3>
                                </div>
                                <div className="p-4 flex flex-col">
                                    <BarChart
                                        bars={[
                                            { label: 'CR Tahunan', value: r.crTahunan.toFixed(3).replace('.', ','), color: 'bg-emerald-600', pct: 90 },
                                            { label: 'CR Boiler AB', value: r.crBoilerAB.toFixed(3).replace('.', ','), color: 'bg-slate-700', pct: 92 },
                                        ]}
                                    />
                                    <div className="flex items-center justify-center gap-5 mt-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-emerald-600" />
                                            <p className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">CR Tahunan</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-slate-700" />
                                            <p className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">CR Boiler AB</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* STREAM DAYS */}
                            <div className="report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-center">
                                    <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">STREAM DAYS</h3>
                                </div>
                                <div className="p-4 flex flex-col">
                                    <BarChart
                                        height="h-28"
                                        bars={[
                                            { label: 'Stream Days', value: r.streamDays, color: 'bg-emerald-500', pct: 60 },
                                            { label: 'Real', value: r.streamDaysReal, color: 'bg-blue-600', pct: 85 },
                                        ]}
                                    />
                                    <div className="flex items-center justify-center gap-5 mt-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                            <p className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Stream Days</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-blue-600" />
                                            <p className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Real</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MIDDLE ROW: Konsumsi Batubara + CR Harian */}
                    <div className="grid grid-cols-12 gap-3 mb-3">
                        {/* KONSUMSI BATUBARA */}
                        <div className="col-span-7 report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden">
                            <div className="bg-gradient-to-r from-red-600 to-rose-600 py-2.5 text-center">
                                <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Konsumsi Batubara</h3>
                            </div>
                            <div className="p-4 flex flex-col gap-4">
                                {/* Boiler A row */}
                                <div className="grid grid-cols-4 divide-x divide-slate-100 text-center border-b border-slate-100 pb-3">
                                    {[
                                        { label: 'Coal Mill A', value: r.coalMillA, delta: r.deltaCoalA },
                                        { label: 'Coal Mill B', value: r.coalMillB, delta: r.deltaCoalB },
                                        { label: 'Coal Mill C', value: r.coalMillC, delta: r.deltaCoalC },
                                    ].map((s, i) => (
                                        <div key={i} className="px-1 flex flex-col items-center">
                                            <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">{s.label}</p>
                                            <p className="text-2xl font-bold tracking-tight text-slate-800">{s.value} <span className="text-[10px] font-normal text-slate-400">Ton</span></p>
                                            <DeltaSmall value={s.delta} />
                                        </div>
                                    ))}
                                    <div className="px-1 border-l border-slate-300 flex flex-col items-center bg-slate-50 rounded-r-lg">
                                        <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">Total CM Boiler A</p>
                                        <p className="text-3xl font-black tracking-tighter text-slate-800">{r.totalCMBoilerA.toString().replace('.', ',')} <span className="text-xs font-normal text-slate-400">Ton</span></p>
                                        <DeltaSmall value={r.deltaTotalCMA} />
                                    </div>
                                </div>
                                {/* Boiler B row */}
                                <div className="grid grid-cols-4 divide-x divide-slate-100 text-center">
                                    {[
                                        { label: 'Coal Mill D', value: r.coalMillD, delta: r.deltaCoalD },
                                        { label: 'Coal Mill E', value: r.coalMillE, delta: r.deltaCoalE },
                                        { label: 'Coal Mill F', value: r.coalMillF, delta: r.deltaCoalF },
                                    ].map((s, i) => (
                                        <div key={i} className="px-1 flex flex-col items-center">
                                            <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">{s.label}</p>
                                            <p className="text-2xl font-bold tracking-tight text-slate-800">{s.value} <span className="text-[10px] font-normal text-slate-400">Ton</span></p>
                                            <DeltaSmall value={s.delta} />
                                        </div>
                                    ))}
                                    <div className="px-1 border-l border-slate-300 flex flex-col items-center bg-slate-50 rounded-r-lg">
                                        <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">Total CM Boiler B</p>
                                        <p className="text-3xl font-black tracking-tighter text-slate-800">{r.totalCMBoilerB.toString().replace('.', ',')} <span className="text-xs font-normal text-slate-400">Ton</span></p>
                                        <DeltaSmall value={r.deltaTotalCMB} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CR HARIAN */}
                        <div className="col-span-5 report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden flex flex-col">
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-center">
                                <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Consumption Rate Harian</h3>
                            </div>
                            <div className="p-4 flex-1 flex flex-col justify-end">
                                <div className="h-32 relative flex items-end justify-center w-full gap-2 border-b border-slate-300 pb-1 mt-6 px-4">
                                    <div className="absolute inset-0 flex flex-col justify-between border-t border-slate-200">
                                        {[...Array(5)].map((_, i) => <div key={i} className="border-b border-dashed border-slate-200 flex-1" />)}
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
                                            <p className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">{l.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TOTALIZER KONSUMSI DEMIN & RCW */}
                    <div className="report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden mb-3">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-center">
                            <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Totalizer Konsumsi Demin dan RCW</h3>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-5 text-center divide-x divide-slate-100">
                                {[
                                    { label: 'Konsumsi Harian Demin Water', value: r.konsHarianDemin },
                                    { label: 'Konsumsi harian RCW', value: r.konsHarianRCW },
                                    { label: 'Penerimaan Demin dari 3A', value: r.penerimaanDemin3A },
                                    { label: 'Penerimaan Demin dari 1B', value: r.penerimaanDemin1B },
                                    { label: 'Penerimaan RCW dari 1A', value: r.penerimaanRCW1A },
                                ].map((s, i) => (
                                    <div key={i} className="flex flex-col items-center">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">{s.label}</p>
                                        <p className="text-2xl font-bold tracking-tight text-slate-800">{s.value.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">m³</span></p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* TANKS ROW */}
                    <div className="grid grid-cols-12 gap-3 pb-4">
                        {/* SILO FLY ASH */}
                        <div className="col-span-6 report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden bg-orange-50/50">
                            <div className="bg-gradient-to-r from-yellow-600 to-amber-600 py-2.5 text-center">
                                <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Silo Fly Ash</h3>
                            </div>
                            <div className="flex p-4 gap-6 items-end relative min-h-[160px]">
                                <div className="text-center w-24 z-10 pb-4">
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 leading-tight">Unloading<br/>Silo A</p>
                                    <p className="text-3xl font-bold text-slate-800 border-b-2 border-slate-200 w-14 mx-auto pb-1">{r.unloadingSiloA}</p>
                                </div>
                                <div className="text-center w-24 z-10 pb-4">
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 leading-tight">Unloading<br/>Silo B</p>
                                    <p className="text-3xl font-bold text-slate-800 border-b-2 border-slate-200 w-14 mx-auto pb-1">{r.unloadingSiloB}</p>
                                </div>
                                <div className="flex-1 relative h-[120px] flex items-end">
                                    <div className="absolute left-0 top-0 bottom-0 w-6 flex flex-col justify-between text-[9px] text-slate-400 font-bold z-20">
                                        <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                                    </div>
                                    <div className="absolute left-6 right-0 top-0 bottom-0 flex flex-col justify-between z-10">
                                        {[...Array(5)].map((_, i) => <div key={i} className={`${i < 4 ? 'border-t border-dashed' : 'border-t'} border-slate-300 w-full h-0`} />)}
                                    </div>
                                    <div className="ml-6 flex-1 flex justify-around items-end h-full relative z-10 pb-[1px]">
                                        {[
                                            { label: 'Silo A', level: r.siloALevel, color: 'bg-yellow-600', text: 'text-white' },
                                            { label: 'Silo B', level: r.siloBLevel, color: 'bg-yellow-400', text: 'text-yellow-900' },
                                        ].map((s, i) => (
                                            <div key={i} className="flex flex-col items-center">
                                                <span className="text-[10px] font-bold text-slate-600 mb-2 -mt-6">{s.label}</span>
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
                        <div className="col-span-2 report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden bg-indigo-50/50 flex flex-col">
                            <div className="bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-center">
                                <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">RCW Tank</h3>
                            </div>
                            <div className="flex-1 relative p-3 flex">
                                <div className="absolute top-2 right-3 text-sm font-black text-indigo-700 z-20 bg-white/80 px-2 py-0.5 rounded shadow-sm">{r.rcwPct},0%</div>
                                <div className="w-8 flex flex-col justify-between pt-5 pb-1 text-[9px] text-slate-400 font-bold z-20">
                                    <span>5 rb</span><span>4 rb</span><span>3 rb</span><span>2 rb</span><span>1 rb</span>
                                </div>
                                <div className="flex-1 flex items-end justify-center relative mt-6 border-b border-slate-300">
                                    <div className="w-full bg-indigo-600 rounded-t-sm text-white text-center text-xs font-bold pt-2 shadow-sm relative overflow-hidden" style={{ height: `${r.rcwPct}%` }}>
                                        <div className="absolute inset-0 bg-white/10 opacity-50" />
                                        {r.rcwTank.toLocaleString('id-ID')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* DEMIN TANK */}
                        <div className="col-span-2 report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden bg-sky-50/50 flex flex-col">
                            <div className="bg-gradient-to-r from-sky-500 to-cyan-500 py-2.5 text-center">
                                <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Demin Tank</h3>
                            </div>
                            <div className="flex-1 relative p-3 flex">
                                <div className="absolute top-2 right-3 text-sm font-black text-sky-700 z-20 bg-white/80 px-2 py-0.5 rounded shadow-sm">{r.deminPct},0%</div>
                                <div className="w-10 flex flex-col justify-between pt-5 pb-1 text-[9px] text-slate-400 font-bold z-20">
                                    <span>1,25...</span><span>1 rb</span><span>750</span><span>500</span><span>250</span>
                                </div>
                                <div className="flex-1 flex items-end justify-center relative mt-6 border-b border-slate-300">
                                    <div className="w-full bg-sky-500 rounded-t-sm text-white text-center text-xs font-bold pt-2 shadow-sm relative overflow-hidden" style={{ height: `${r.deminPct}%` }}>
                                        <div className="absolute inset-0 bg-white/10 opacity-50" />
                                        {r.deminTank.toLocaleString('id-ID')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SOLAR TANK */}
                        <div className="col-span-2 report-card rounded-[10px] shadow-lg border border-slate-100 overflow-hidden bg-slate-50 flex flex-col">
                            <div className="bg-gradient-to-r from-slate-800 to-slate-700 py-2.5 text-center">
                                <h3 className="text-white font-bold uppercase text-xs tracking-wider drop-shadow-md">Solar Tank</h3>
                            </div>
                            <div className="flex-1 relative p-3 flex">
                                <div className="absolute top-2 right-3 text-sm font-black text-slate-800 z-20 bg-white/80 px-2 py-0.5 rounded shadow-sm">{r.solarPct},0%</div>
                                <div className="w-8 flex flex-col justify-between pt-5 pb-1 text-[9px] text-slate-400 font-bold z-20">
                                    <span>200</span><span>150</span><span>100</span><span>50</span><span>0</span>
                                </div>
                                <div className="flex-1 flex items-end justify-center relative mt-6 border-b border-slate-300">
                                    <div className="w-full bg-slate-700 rounded-t-sm text-white text-center text-xs font-bold pt-2 shadow-sm relative overflow-hidden" style={{ height: `${r.solarPct}%` }}>
                                        <div className="absolute inset-0 bg-white/5 opacity-50" />
                                        {r.solarTank}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* FLOATING ACTION BAR */}
                <div className="no-print fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-50">
                    <button
                        onClick={() => window.print()}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-xl flex items-center gap-2 transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-lg">print</span>
                        Cetak Laporan (PDF)
                    </button>
                    <button
                        onClick={() => window.close()}
                        className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-full shadow-xl flex items-center gap-2 transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-lg">arrow_back</span>
                        Kembali
                    </button>
                </div>
            </div>
        </>
    );
}
