'use client';

// ─── Report Data ───
const REPORT = {
    shift: 'Pagi',
    date: '2026-03-14',
    group: 'C',
    supervisor: 'Bayu',
    operator: 'Budi Santoso',
    boilerA: { flowSteam: 60, furnace: 620, flueGas: 63, batubara: 117, tempSteam: 501, cr: 0.20, lifetime: 90 },
    boilerB: { flowSteam: 105, furnace: 755, flueGas: 125, batubara: 108, tempSteam: 520, cr: 0.19, lifetime: 12 },
    turbin: { loadTG: 13, internalUBB: 5.2, pln: 10.4, durasiHPO: 45, tempCWIn: 28.5, tempCWOut: 34.2, tempThrustBrg: 72.4, axialDispl: 0.32 },
    power: [{ name: 'Pabrik 3A', value: 7.2 }, { name: 'Pabrik 3B', value: 4.8 }, { name: 'PIU', value: 1.5 }, { name: 'Pabrik 2', value: 0 }],
    distribusiSteam: [{ pabrik: 'Pabrik 1', value: 65 }, { pabrik: 'Pabrik 2', value: 0 }, { pabrik: 'Pabrik 3A', value: 50 }],
    tankYard: { rcw: 4500, demin: 1000, solarAB: 154, siloA: 32, siloB: 15 },
    lab: {
        boilerFeedWater: { tempBFW: 132, pH: 8.5, conduct: 3.5, silica: 0.011, nh4: 0.06, chz: 0.838 },
        tk1250: { pH: 7.7, conduct: 1.6, silica: 0.01 },
        productSteam: { pH: 8.2, conduct: 2.5, silica: 0.012, nh4: 0.04 },
        boilerWaterA: { pH: 9, cond: 18.7, sio2: 1.01, po4: 3.12 },
        boilerWaterB: { pH: 9.1, cond: 17.4, sio2: 0.94, po4: 2.9 },
    },
    criticalEquipment: [
        { date: '14/03', item: 'BT-01A', deskripsi: 'Boiler Tube Leak', uraian: 'Boiler Tube Leak', scope: 'Mekanik', foreman: 'Foreman Boiler' },
        { date: '14/03', item: 'TG-01', deskripsi: 'High Bearing Temp', uraian: 'High Bearing Temp', scope: 'Instrumen', foreman: 'Foreman Turbin' },
        { date: '14/03', item: 'P-402', deskripsi: 'Seal Leakage', uraian: 'Seal Leakage', scope: 'Mekanik', foreman: 'Foreman Turbin' },
        { date: '14/03', item: 'BL-02', deskripsi: 'Vibration Alert', uraian: 'Vibration Alert', scope: 'Instrumen', foreman: 'Foreman Boiler' },
        { date: '14/03', item: 'CV-001', deskripsi: 'Belt Alignment', uraian: 'Belt Alignment', scope: 'Mekanik', foreman: 'Foreman Boiler' },
        { date: '14/03', item: 'ST-405', deskripsi: 'Trap Stuck Open', uraian: 'Trap Stuck Open', scope: 'Instrumen', foreman: 'Foreman Turbin' },
        { date: '13/03', item: 'P-201B', deskripsi: 'Mechanical Seal', uraian: 'Mechanical Seal', scope: 'Mekanik', foreman: 'Foreman Turbin' },
        { date: '13/03', item: 'FN-103', deskripsi: 'Overload Trip', uraian: 'Overload Trip', scope: 'Listrik', foreman: 'Foreman Boiler' },
        { date: '12/03', item: 'TK-12', deskripsi: 'Level Sensor', uraian: 'Level Sensor', scope: 'Instrumen', foreman: 'Foreman Turbin' },
        { date: '12/03', item: 'V-909', deskripsi: 'Air Leakage', uraian: 'Air Leakage', scope: 'Sipil', foreman: 'Foreman Boiler' },
    ],
    maintenance: [
        { date: '14/03', item: 'L-08.12 E', uraian: 'Cek ampere motor', scope: 'Listrik', foreman: 'Foreman Turbin', tipe: 'corrective', status: 'OK', notif: null },
        { date: '14/03', item: 'B-12.01 A', uraian: 'Pelumasan bearing', scope: 'Mekanik', foreman: 'Foreman Turbin', tipe: 'preventif', status: 'OK', notif: null },
        { date: '14/03', item: 'M-04.05', uraian: 'Pembersihan area', scope: 'Sipil', foreman: 'Foreman Boiler', tipe: 'preventif', status: 'OK', notif: null },
        { date: '14/03', item: 'P-101 C', uraian: 'Ganti oli pump', scope: 'Mekanik', foreman: 'Foreman Turbin', tipe: 'corrective', status: 'OK', notif: null },
        { date: '13/03', item: 'V-22.1', uraian: 'Kalibrasi valve', scope: 'Instrumen', foreman: 'Foreman Turbin', tipe: 'preventif', status: 'OK', notif: null },
        { date: '13/03', item: 'E-304', uraian: 'Check efficiency', scope: 'Instrumen', foreman: 'Foreman Boiler', tipe: 'corrective', status: 'IP', notif: null },
        { date: '12/03', item: 'C-12A', uraian: 'Greasing coupling', scope: 'Mekanik', foreman: 'Foreman Boiler', tipe: 'preventif', status: 'OK', notif: null },
        { date: '12/03', item: 'T-501', uraian: 'Drain condensate', scope: 'Mekanik', foreman: 'Foreman Turbin', tipe: 'corrective', status: 'OK', notif: null },
        { date: '12/03', item: 'R-102', uraian: 'Inspection lining', scope: 'Mekanik', foreman: 'Foreman Boiler', tipe: 'corrective', status: 'OK', notif: null },
    ],
    catatan: 'Kondisi operasional Boiler A dan B terpantau stabil sepanjang shift pagi. Load TG dipertahankan pada level aman. Semua parameter lab berada dalam batas normal sesuai SOP.',
};

export default function PreviewPdfPage() {
    const r = REPORT;
    const dateObj = new Date(r.date + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <>
            <style jsx global>{`
                @page { size: 320mm 450mm; margin: 0; }
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
                .text-xxs { font-size: 0.65rem; }
                .text-tiny { font-size: 0.5rem; }
                .cylinder-bg {
                    background-image: linear-gradient(0deg, #f3f4f6 1px, transparent 1px);
                    background-size: 100% 20%;
                }
                @media print {
                    * {
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    html, body {
                        background-color: white !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    .preview-bg {
                        background: white !important;
                        padding: 0 !important;
                        min-height: auto !important;
                        height: auto !important;
                    }
                    .pdf-container {
                        width: 100% !important;
                        min-height: auto !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 10px !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        border: none !important;
                    }
                }
            `}</style>

            <div className="preview-bg min-h-screen bg-[#0f172a] flex justify-center py-10 px-4 print:p-0 print:bg-white">
                {/* PDF Container */}
                <div className="pdf-container w-[320mm] min-h-[297mm] bg-white rounded-lg shadow-xl p-10 print:shadow-none print:rounded-none text-slate-900 flex flex-col border border-slate-200" style={{ fontFamily: "'Inter', sans-serif" }}>

                    {/* Header */}
                    <header className="flex justify-between mb-4 pb-4 border-b-2 border-blue-600 items-center">
                        <div className="flex items-center gap-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo/Danantara_Indonesia_(no_SW).png" alt="Danantara" className="h-14 w-auto object-contain" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo/Logo_Pupuk_Indonesia__Persero_-removebg-preview.png" alt="Pupuk Indonesia" className="h-14 w-auto object-contain" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo/logo-PG-agro-trans-small-removebg-preview.png" alt="PG" className="h-14 w-auto object-contain" />
                        </div>
                        <div className="text-right flex flex-col items-end gap-1.5">
                            <h1 className="font-black text-blue-900 tracking-tight leading-tight uppercase text-3xl">Laporan Akhir Shift</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-blue-600 font-bold text-xs tracking-widest uppercase">Utilitas Batubara</span>
                                <span className="bg-blue-600 text-white px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider">{r.shift}</span>
                            </div>
                        </div>
                    </header>

                    {/* Info Bar */}
                    <section className="grid grid-cols-4 divide-x divide-cyan-800/60 mb-6 bg-cyan-950 py-3.5 rounded-lg border border-cyan-900 shadow-md w-full">
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hari</span>
                            <span className="text-sm font-black text-white">{dayName}</span>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tanggal</span>
                            <span className="text-sm font-black text-white">{dateFormatted}</span>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Grup</span>
                            <span className="text-sm font-black text-white">{r.group}</span>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Supervisor</span>
                            <span className="text-sm font-black text-white">{r.supervisor}</span>
                        </div>
                    </section>

                    {/* Main Content Grid */}
                    <div className="flex gap-6 flex-grow">
                        {/* Left Column */}
                        <main className="w-[48%] flex flex-col gap-5">
                            {/* Parameter Operasional */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                                    <h3 className="text-xxs font-bold text-slate-800 uppercase tracking-widest">Parameter Operasional</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Boiler A */}
                                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 shadow-sm">
                                        <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-blue-100">
                                            <span className="text-blue-800 font-black text-xxs tracking-tighter">BOILER A</span>
                                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-tiny font-bold">Lifetime: <strong className="text-blue-950">{r.boilerA.lifetime}</strong> hari</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-y-2 gap-x-2 text-center">
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">Flow Steam</p><p className="text-xs font-black text-blue-950">{r.boilerA.flowSteam} <span className="text-tiny font-semibold text-slate-500">T/j</span></p></div>
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">Furnace</p><p className="text-xs font-black text-blue-950">{r.boilerA.furnace} <span className="text-tiny font-semibold text-slate-500">°C</span></p></div>
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">Flue Gas</p><p className="text-xs font-black text-blue-950">{r.boilerA.flueGas} <span className="text-tiny font-semibold text-slate-500">°C</span></p></div>
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">Batubara</p><p className="text-xs font-black text-blue-950">{r.boilerA.batubara} <span className="text-tiny font-semibold text-slate-500">Ton</span></p></div>
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">Temp Steam</p><p className="text-xs font-black text-blue-950">{r.boilerA.tempSteam} <span className="text-tiny font-semibold text-slate-500">°C</span></p></div>
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">CR A</p><p className="text-xs font-black text-blue-950">{r.boilerA.cr}</p></div>
                                        </div>
                                    </div>
                                    {/* Boiler B */}
                                    <div className="bg-green-50/50 p-3 rounded-lg border border-green-100 shadow-sm">
                                        <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-green-100">
                                            <span className="text-green-800 font-black text-xxs tracking-tighter">BOILER B</span>
                                            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-tiny font-bold">Lifetime: <strong className="text-green-950">{r.boilerB.lifetime}</strong> hari</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-y-2 gap-x-2 text-center">
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">Flow Steam</p><p className="text-xs font-black text-green-950">{r.boilerB.flowSteam} <span className="text-tiny font-semibold text-slate-500">T/j</span></p></div>
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">Furnace</p><p className="text-xs font-black text-green-950">{r.boilerB.furnace} <span className="text-tiny font-semibold text-slate-500">°C</span></p></div>
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">Flue Gas</p><p className="text-xs font-black text-green-950">{r.boilerB.flueGas} <span className="text-tiny font-semibold text-slate-500">°C</span></p></div>
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">Batubara</p><p className="text-xs font-black text-green-950">{r.boilerB.batubara} <span className="text-tiny font-semibold text-slate-500">Ton</span></p></div>
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">Temp Steam</p><p className="text-xs font-black text-green-950">{r.boilerB.tempSteam} <span className="text-tiny font-semibold text-slate-500">°C</span></p></div>
                                            <div><p className="text-tiny text-slate-700 uppercase font-bold">CR B</p><p className="text-xs font-black text-green-950">{r.boilerB.cr}</p></div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Turbin + Power + Distribusi Steam */}
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-9 space-y-4">
                                    {/* Turbin Generator */}
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm">
                                        <p className="text-tiny font-bold text-blue-600 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1">Turbin Generator</p>
                                        <div className="grid grid-cols-4 gap-y-3 gap-x-2 text-center">
                                            <div><p className="text-tiny text-slate-600 uppercase font-bold">Load TG</p><p className="text-xs font-black text-slate-900">{r.turbin.loadTG} <span className="text-tiny font-semibold text-slate-500">MW</span></p></div>
                                            <div><p className="text-tiny text-slate-600 uppercase font-bold">Internal UBB</p><p className="text-xs font-black text-slate-900">{r.turbin.internalUBB} <span className="text-tiny font-semibold text-slate-500">MW</span></p></div>
                                            <div><p className="text-tiny text-slate-600 uppercase font-bold">PLN</p><p className="text-xs font-black text-slate-900">{r.turbin.pln} <span className="text-tiny font-semibold text-slate-500">MW</span></p></div>
                                            <div><p className="text-tiny text-slate-600 uppercase font-bold">Durasi HPO</p><p className="text-xs font-black text-slate-900">{r.turbin.durasiHPO} <span className="text-tiny font-semibold text-slate-500">S</span></p></div>
                                            <div><p className="text-tiny text-slate-600 uppercase font-bold">Temp CW In</p><p className="text-xs font-black text-slate-900">{r.turbin.tempCWIn} <span className="text-tiny font-semibold text-slate-500">°C</span></p></div>
                                            <div><p className="text-tiny text-slate-600 uppercase font-bold">Temp CW Out</p><p className="text-xs font-black text-slate-900">{r.turbin.tempCWOut} <span className="text-tiny font-semibold text-slate-500">°C</span></p></div>
                                            <div><p className="text-tiny text-slate-600 uppercase font-bold">Thrust Brg</p><p className="text-xs font-black text-slate-900">{r.turbin.tempThrustBrg} <span className="text-tiny font-semibold text-slate-500">°C</span></p></div>
                                            <div><p className="text-tiny text-slate-600 uppercase font-bold">Axial Displ</p><p className="text-xs font-black text-slate-900">{r.turbin.axialDispl} <span className="text-tiny font-semibold text-slate-500">mm</span></p></div>
                                        </div>
                                    </div>
                                    {/* Power Distribution */}
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm">
                                        <p className="text-tiny font-bold text-green-700 mb-3 uppercase tracking-widest border-b border-slate-200 pb-1">Power Distribution</p>
                                        <div className="grid grid-cols-4 gap-y-2 gap-x-2 text-center">
                                            {r.power.map(p => (
                                                <div key={p.name}><p className="text-tiny text-slate-600 uppercase font-bold">{p.name}</p><p className="text-xs font-black text-slate-900">{p.value} <span className="text-tiny font-semibold text-slate-500">MW</span></p></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {/* Distribusi Steam */}
                                <div className="col-span-3 bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                                    <p className="text-tiny font-bold text-blue-700 mb-4 uppercase tracking-widest">Distribusi Steam</p>
                                    <div className="space-y-4 flex-1 flex flex-col justify-center">
                                        {r.distribusiSteam.map((d, i) => (
                                            <div key={d.pabrik} className={`flex items-center justify-between ${i < r.distribusiSteam.length - 1 ? 'border-b border-slate-200 pb-2' : ''}`}>
                                                <p className="text-tiny text-slate-700 uppercase font-bold">{d.pabrik}</p>
                                                <p className="text-sm font-black text-blue-950">{d.value} <span className="text-tiny font-semibold text-slate-500">T/j</span></p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Tank Yard & Silo */}
                            <section className="bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-tiny font-bold text-orange-600 uppercase tracking-widest mb-3">Tank Yard &amp; Silo</p>
                                <div className="flex gap-4">
                                    <div className="grid grid-cols-3 gap-4 flex-1">
                                        {/* TK RCW */}
                                        <div className="flex flex-col gap-1">
                                            <div className="text-center">
                                                <p className="text-tiny text-slate-700 uppercase font-bold">TK RCW</p>
                                                <p className="text-xs text-blue-800 font-black">{r.tankYard.rcw.toLocaleString()} <span className="text-tiny font-semibold text-slate-500">m³</span></p>
                                            </div>
                                            <div className="relative w-full h-16 bg-white rounded p-1 border border-slate-200">
                                                <div className="relative w-full h-full bg-slate-50 border border-slate-100 rounded-sm overflow-hidden cylinder-bg">
                                                    <div className="absolute bottom-0 left-0 w-full bg-blue-400/80" style={{ height: '93%' }} />
                                                </div>
                                            </div>
                                        </div>
                                        {/* TK Demin */}
                                        <div className="flex flex-col gap-1">
                                            <div className="text-center">
                                                <p className="text-tiny text-slate-700 uppercase font-bold">TK Demin</p>
                                                <p className="text-xs text-cyan-800 font-black">{r.tankYard.demin.toLocaleString()} <span className="text-tiny font-semibold text-slate-500">m³</span></p>
                                            </div>
                                            <div className="relative w-full h-16 bg-white rounded p-1 border border-slate-200">
                                                <div className="relative w-full h-full bg-slate-50 border border-slate-100 rounded-sm overflow-hidden cylinder-bg">
                                                    <div className="absolute bottom-0 left-0 w-full bg-cyan-400/80" style={{ height: '83%' }} />
                                                </div>
                                            </div>
                                        </div>
                                        {/* TK Solar AB */}
                                        <div className="flex flex-col gap-1">
                                            <div className="text-center">
                                                <p className="text-tiny text-slate-700 uppercase font-bold">TK Solar AB</p>
                                                <p className="text-xs text-orange-800 font-black">{r.tankYard.solarAB} <span className="text-tiny font-semibold text-slate-500">m³</span></p>
                                            </div>
                                            <div className="relative w-full h-16 bg-white rounded p-1 border border-slate-200">
                                                <div className="relative w-full h-full bg-slate-50 border border-slate-100 rounded-sm overflow-hidden cylinder-bg">
                                                    <div className="absolute bottom-0 left-0 w-full bg-orange-400/60" style={{ height: '77%' }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Silo */}
                                    <div className="flex flex-col gap-2 w-24">
                                        <div className="flex-1 flex flex-col justify-center items-center bg-white rounded p-1.5 border border-slate-200 drop-shadow-sm">
                                            <p className="text-tiny text-slate-700 uppercase font-bold">Silo A</p>
                                            <p className="text-xl font-black text-slate-900">{r.tankYard.siloA}<span className="text-xs font-bold text-slate-500">%</span></p>
                                        </div>
                                        <div className="flex-1 flex flex-col justify-center items-center bg-white rounded p-1.5 border border-slate-200 drop-shadow-sm">
                                            <p className="text-tiny text-slate-700 uppercase font-bold">Silo B</p>
                                            <p className="text-xl font-black text-slate-900">{r.tankYard.siloB}<span className="text-xs font-bold text-slate-500">%</span></p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Parameter Lab / QC */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                                    <h3 className="text-xxs font-bold text-slate-800 uppercase tracking-widest">Parameter Lab / QC</h3>
                                </div>
                                <div className="space-y-4">
                                    {/* Boiler Feed Water */}
                                    <div>
                                        <div className="bg-blue-600 text-white text-[9px] font-bold uppercase text-center py-1.5 rounded-t-lg">Boiler Feed Water</div>
                                        <table className="w-full border-collapse">
                                            <thead><tr className="bg-blue-50 text-blue-700 text-tiny font-bold uppercase text-center">
                                                <th className="py-1.5 border border-blue-100">pH</th><th className="py-1.5 border border-blue-100">Conduct</th><th className="py-1.5 border border-blue-100">Silica</th><th className="py-1.5 border border-blue-100">NH4</th><th className="py-1.5 border border-blue-100">CHZ</th>
                                            </tr></thead>
                                            <tbody className="bg-white text-slate-900 text-xs font-black text-center"><tr>
                                                <td className="py-2 border border-blue-100">{r.lab.boilerFeedWater.pH}</td><td className="py-2 border border-blue-100">{r.lab.boilerFeedWater.conduct}</td><td className="py-2 border border-blue-100">{r.lab.boilerFeedWater.silica}</td><td className="py-2 border border-blue-100">{r.lab.boilerFeedWater.nh4}</td><td className="py-2 border border-blue-100">{r.lab.boilerFeedWater.chz}</td>
                                            </tr></tbody>
                                        </table>
                                    </div>
                                    {/* TK-1250 & Product Steam */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="bg-cyan-600 text-white text-[9px] font-bold uppercase text-center py-1.5 rounded-t-lg">TK-1250</div>
                                            <table className="w-full border-collapse">
                                                <thead><tr className="bg-cyan-50 text-cyan-700 text-tiny font-bold uppercase text-center">
                                                    <th className="py-1.5 border border-cyan-100">pH</th><th className="py-1.5 border border-cyan-100">Conduct</th><th className="py-1.5 border border-cyan-100">Silica</th>
                                                </tr></thead>
                                                <tbody className="bg-white text-slate-900 text-xs font-black text-center"><tr>
                                                    <td className="py-2 border border-cyan-100">{r.lab.tk1250.pH}</td><td className="py-2 border border-cyan-100">{r.lab.tk1250.conduct}</td><td className="py-2 border border-cyan-100">{r.lab.tk1250.silica}</td>
                                                </tr></tbody>
                                            </table>
                                        </div>
                                        <div>
                                            <div className="bg-green-600 text-white text-[9px] font-bold uppercase text-center py-1.5 rounded-t-lg">Product Steam</div>
                                            <table className="w-full border-collapse">
                                                <thead><tr className="bg-green-50 text-green-700 text-tiny font-bold uppercase text-center">
                                                    <th className="py-1.5 border border-green-100">pH</th><th className="py-1.5 border border-green-100">Conduct</th><th className="py-1.5 border border-green-100">Silica</th><th className="py-1.5 border border-green-100">NH4</th>
                                                </tr></thead>
                                                <tbody className="bg-white text-slate-900 text-xs font-black text-center"><tr>
                                                    <td className="py-2 border border-green-100">{r.lab.productSteam.pH}</td><td className="py-2 border border-green-100">{r.lab.productSteam.conduct}</td><td className="py-2 border border-green-100">{r.lab.productSteam.silica}</td><td className="py-2 border border-green-100">{r.lab.productSteam.nh4}</td>
                                                </tr></tbody>
                                            </table>
                                        </div>
                                    </div>
                                    {/* Boiler Water A & B */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="bg-blue-800 text-white text-[9px] font-bold uppercase text-center py-1.5 rounded-t-lg">Boiler Water A</div>
                                            <table className="w-full border-collapse">
                                                <thead><tr className="bg-blue-50 text-blue-800 text-tiny font-bold uppercase text-center">
                                                    <th className="py-1.5 border border-blue-100">pH</th><th className="py-1.5 border border-blue-100">Cond</th><th className="py-1.5 border border-blue-100">SiO2</th><th className="py-1.5 border border-blue-100">PO4</th>
                                                </tr></thead>
                                                <tbody className="bg-white text-slate-900 text-xs font-black text-center"><tr>
                                                    <td className="py-2 border border-blue-100">{r.lab.boilerWaterA.pH}</td><td className="py-2 border border-blue-100">{r.lab.boilerWaterA.cond}</td><td className="py-2 border border-blue-100">{r.lab.boilerWaterA.sio2}</td><td className="py-2 border border-blue-100">{r.lab.boilerWaterA.po4}</td>
                                                </tr></tbody>
                                            </table>
                                        </div>
                                        <div>
                                            <div className="bg-green-800 text-white text-[9px] font-bold uppercase text-center py-1.5 rounded-t-lg">Boiler Water B</div>
                                            <table className="w-full border-collapse">
                                                <thead><tr className="bg-green-50 text-green-800 text-tiny font-bold uppercase text-center">
                                                    <th className="py-1.5 border border-green-100">pH</th><th className="py-1.5 border border-green-100">Cond</th><th className="py-1.5 border border-green-100">SiO2</th><th className="py-1.5 border border-green-100">PO4</th>
                                                </tr></thead>
                                                <tbody className="bg-white text-slate-900 text-xs font-black text-center"><tr>
                                                    <td className="py-2 border border-green-100">{r.lab.boilerWaterB.pH}</td><td className="py-2 border border-green-100">{r.lab.boilerWaterB.cond}</td><td className="py-2 border border-green-100">{r.lab.boilerWaterB.sio2}</td><td className="py-2 border border-green-100">{r.lab.boilerWaterB.po4}</td>
                                                </tr></tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Catatan Shift */}
                            <section className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
                                    <h3 className="text-xxs font-bold text-slate-800 uppercase tracking-widest">Catatan Shift</h3>
                                </div>
                                <p className="text-xxs text-slate-600 leading-relaxed italic font-medium">
                                    &ldquo;{r.catatan}&rdquo;
                                </p>
                            </section>
                        </main>

                        {/* Right Column */}
                        <aside className="flex-1 flex flex-col gap-6 h-full">
                            {/* Maintenance Logs */}
                            <section className="flex-grow flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1.5 h-4 bg-green-600 rounded-full"></div>
                                    <h3 className="text-xxs font-bold text-slate-800 uppercase tracking-widest">Maintenance Logs</h3>
                                </div>
                                <div className="bg-green-50/30 rounded-lg border border-green-100 overflow-hidden flex-grow shadow-sm">
                                    <div className="bg-green-600 p-2.5">
                                        <p className="text-tiny font-bold text-white uppercase tracking-widest text-center">Maintenance Activities</p>
                                    </div>
                                    <table className="w-full border-collapse text-left">
                                        <thead>
                                            <tr className="text-xs text-green-900 font-bold uppercase bg-green-100 tracking-tighter">
                                                <th className="py-2 px-1 w-[10%] border-b border-green-200 text-center">Tgl</th>
                                                <th className="py-2 px-3 w-[15%] border-b border-green-200">Item</th>
                                                <th className="py-2 px-1 w-[45%] border-b border-green-200">Uraian</th>
                                                <th className="py-2 px-1 w-[15%] border-b border-green-200 text-center">Scope</th>
                                                <th className="py-2 px-3 w-[15%] border-b border-green-200 text-center">Ket</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-800">
                                            {r.maintenance.map((m, i) => (
                                                <tr key={i} className="border-b border-slate-200">
                                                    <td className="text-xs py-2 text-center font-medium">{m.date}</td>
                                                    <td className="text-xs py-2 px-3 font-mono font-bold">{m.item}</td>
                                                    <td className="text-xs py-2 whitespace-normal break-words font-medium">{m.uraian}</td>
                                                    <td className="text-xs py-2 font-bold text-slate-600 text-center">{m.scope}</td>
                                                    <td className="text-center py-2">
                                                        <span className={`px-2 py-1 rounded font-black text-[9px] shadow-sm ${m.status === 'OK' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-yellow-900'}`}>{m.status}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            {/* Critical Equipment */}
                            <section className="flex-grow flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1.5 h-4 bg-red-600 rounded-full"></div>
                                    <h3 className="text-xxs font-bold text-slate-800 uppercase tracking-widest">Critical Equipment</h3>
                                </div>
                                <div className="bg-red-50/30 rounded-lg border border-red-100 overflow-hidden flex-grow shadow-sm">
                                    <div className="bg-red-600 p-2.5">
                                        <p className="text-tiny font-bold text-white uppercase tracking-widest text-center">Equipment Watchlist</p>
                                    </div>
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="text-xs text-red-900 font-bold uppercase tracking-tighter text-center bg-red-100">
                                                <th className="py-2 px-1 w-[10%] border-b border-red-200">Tgl</th>
                                                <th className="py-2 px-1 w-[15%] border-b border-red-200">Item</th>
                                                <th className="py-2 px-1 w-[40%] border-b border-red-200">Uraian</th>
                                                <th className="py-2 px-3 w-[35%] border-b border-red-200 text-center">Scope</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-center text-slate-800">
                                            {r.criticalEquipment.map((eq, i) => (
                                                <tr key={i} className="border-b border-slate-200">
                                                    <td className="text-xs py-2 font-medium">{eq.date}</td>
                                                    <td className="text-xs py-2 font-mono font-bold">{eq.item}</td>
                                                    <td className="text-xs py-2 text-left px-2 whitespace-normal break-words font-medium">{eq.uraian}</td>
                                                    <td className="text-xs py-2 font-bold text-slate-600 text-center">{eq.scope}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </aside>
                    </div>

                    {/* Footer */}
                    <footer className="mt-8 pt-4 border-t-2 border-blue-100 flex justify-between items-center">
                        <p className="text-[8px] text-blue-400 font-bold uppercase tracking-wider">&copy; 2026 PowerOps Control Systems &bull; Shift {r.group} Terminal</p>
                        <div className="flex items-center gap-4">
                            <p className="text-[8px] text-slate-400 font-medium">Digital Signature ID: PO-{r.group}-140326-X99</p>
                            <p className="text-[8px] text-slate-400 font-medium tracking-tight">Generated: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date().toLocaleTimeString('id-ID')}</p>
                        </div>
                    </footer>
                </div>

                {/* Floating Action Bar */}
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 no-print flex gap-4 z-50">
                    <button
                        onClick={() => window.print()}
                        className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-3 rounded-full font-black text-sm shadow-2xl transition-all flex items-center gap-2 cursor-pointer active:scale-95 border-2 border-blue-900"
                    >
                        <span className="material-symbols-outlined text-lg">print</span>
                        Cetak Laporan (PDF)
                    </button>
                    <button
                        onClick={() => window.close()}
                        className="bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-300 px-8 py-3 rounded-full font-black text-sm shadow-2xl transition-all cursor-pointer active:scale-95"
                    >
                        Kembali
                    </button>
                </div>
            </div>
        </>
    );
}
