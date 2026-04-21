'use client';

import { useOperator } from '@/hooks/useOperator';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCurrentShift, SHIFTS } from '@/lib/constants';

// ─── Boiler Data ───
const BOILER_DATA = {
    A: {
        status: 'running',
        steam: { flow: 45.2, totaliser: 1200 },
        water: { flow: 48.5, totaliser: 1350 },
        coalFeeders: [
            { id: 'A', flow: 12.5, totaliser: 180 },
            { id: 'B', flow: 11.8, totaliser: 175 },
            { id: 'C', flow: 0.0, totaliser: 0 },
        ],
        tempFurnace: 850,
        vakumBoiler: -145,
        hotAir: 280,
        o2: 4.2,
        tempFeedWater: 180,
    },
    B: {
        status: 'running',
        steam: { flow: 42.0, totaliser: 1150 },
        water: { flow: 46.1, totaliser: 1300 },
        coalFeeders: [
            { id: 'D', flow: 11.8, totaliser: 165 },
            { id: 'E', flow: 12.2, totaliser: 178 },
            { id: 'F', flow: 0.0, totaliser: 0 },
        ],
        tempFurnace: 845,
        vakumBoiler: -142,
        hotAir: 278,
        o2: 4.5,
        tempFeedWater: 175,
    },
};

const STG_DATA = {
    loadMW: 12.5,
    frequency: 50.02,
    steamInlet: { flow: 88.0, totaliser: 2550 },
    condensate: { flow: 85.2, totaliser: 2480 },
    vacuum: -0.085,
    thrustBearing: 65,
    steamPabrik1: { flow: 15.0, totaliser: 450 },
    steamPabrik2: { flow: 18.5, totaliser: 520 },
    steamPabrik3: { flow: 12.5, totaliser: 380 },
};

// ─── Boiler Card ───
function BoilerCard({ name, data }: { name: string; data: typeof BOILER_DATA.A }) {
    const isA = name === 'A';
    const headerBg = isA ? 'bg-amber-500/40' : 'bg-blue-500/20';
    const bodyBg = isA ? 'bg-amber-500/10' : 'bg-blue-500/5';
    const borderHover = isA ? 'hover:border-amber-500/40' : 'hover:border-blue-500/30';
    const shadowHover = isA ? 'hover:shadow-amber-500/10' : 'hover:shadow-blue-500/5';

    return (
        <div className={`bg-surface-dark ${bodyBg} border border-slate-800 ${borderHover} rounded-xl overflow-hidden shadow-sm hover:shadow-xl ${shadowHover} hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-default relative`}>
            {/* Header */}
            <div className={`p-5 border-b border-slate-800 flex justify-between items-center ${headerBg} relative z-10`}>
                <div className="flex items-center gap-3">
                    <div>
                        <h3 className="text-white font-black text-4xl tracking-tight drop-shadow-md">BOILER {name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            <span className="text-emerald-500 text-sm font-black uppercase tracking-widest drop-shadow-sm">Running</span>
                        </div>
                    </div>
                </div>
                <div className="text-right bg-emerald-600 px-4 py-2 rounded-xl border border-emerald-500 shadow-[0_4px_15px_rgba(5,150,105,0.4)]">
                    <p className="text-4xl font-black text-white drop-shadow-md">
                        {data.steam.flow.toFixed(0)} <span className="text-base font-bold text-white/90">t/h</span>
                    </p>
                    <p className="text-[11px] font-black text-emerald-50 uppercase tracking-widest mt-0.5">Steam Flow</p>
                </div>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between gap-5 relative z-10">
                {/* Row 1: Furnace Temp + Vakum Boiler */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center justify-center space-y-1 text-center">
                        <p className="text-sm text-white uppercase font-bold tracking-wider flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-orange-400">thermometer</span>
                            Furnace Temp
                        </p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-black text-white drop-shadow-sm">{data.tempFurnace}</span>
                            <span className="text-sm text-slate-400">°C</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center space-y-1 text-center">
                        <p className="text-sm text-white uppercase font-bold tracking-wider flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-cyan-400">compress</span>
                            Vacuum
                        </p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-black text-white drop-shadow-sm">{data.vakumBoiler}</span>
                            <span className="text-sm text-slate-400">KPa</span>
                        </div>
                    </div>
                </div>

                {/* Row 2: Hot Air + O2 */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center justify-center space-y-1 text-center">
                        <p className="text-sm text-white uppercase font-bold tracking-wider flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-red-400">local_fire_department</span>
                            Hot Air
                        </p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-black text-white drop-shadow-sm">{data.hotAir}</span>
                            <span className="text-sm text-slate-400">°C</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center space-y-1 text-center">
                        <p className="text-sm text-white uppercase font-bold tracking-wider flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-green-400">science</span>
                            O2
                        </p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-black text-white drop-shadow-sm">{data.o2}</span>
                            <span className="text-sm text-slate-400">%</span>
                        </div>
                    </div>
                </div>

                {/* Coal Feeders with active highlighting */}
                <div className="border-t border-slate-700 pt-4">
                    <p className="text-xs text-text-secondary uppercase font-semibold tracking-wider mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-amber-400">local_fire_department</span>
                        Coal Feeders
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        {data.coalFeeders.map(f => {
                            const isActive = f.flow > 0;
                            return (
                                <div
                                    key={f.id}
                                    className={`p-3 rounded-lg text-center transition-all duration-300 relative overflow-hidden group hover:scale-[1.02] cursor-default
                                        ${isActive
                                            ? 'bg-emerald-500/15 border-2 border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.15)] hover:bg-emerald-500/20'
                                            : 'bg-slate-800/50 border border-dashed border-slate-600/50 hover:border-slate-500'
                                        }`}
                                >
                                    {isActive && (
                                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400 rounded-r"></div>
                                    )}
                                    <p className={`text-[11px] mb-1.5 font-bold uppercase tracking-wider ${isActive ? 'text-emerald-300' : 'text-slate-500'}`}>
                                        Feeder {f.id}
                                    </p>
                                    {isActive ? (
                                        <p className="text-2xl font-black text-white">
                                            {f.flow.toFixed(1)} <span className="text-xs font-normal text-emerald-300/70">t/h</span>
                                        </p>
                                    ) : (
                                        <p className="text-[11px] font-semibold text-slate-500 italic uppercase tracking-wider">Standby</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── STG Card ───
function STGCard() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                        <span className="material-symbols-outlined text-primary">settings_motion_mode</span>
                    </div>
                    <h3 className="text-white text-xl font-bold tracking-tight">STG Overview</h3>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-emerald-400 font-bold tracking-wider text-xs">SYNCHRONIZED</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Generator Load */}
                <div className="bg-surface-dark p-6 rounded-2xl border border-slate-700/50 hover:border-primary/50 flex flex-col justify-center relative overflow-hidden group transition-all duration-300 hover:shadow-[0_8px_30px_rgba(43,124,238,0.15)] hover:-translate-y-1 cursor-default">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '120px' }}>electric_bolt</span>
                    </div>
                    <p className="text-xs text-text-secondary font-bold uppercase tracking-widest mb-2 z-10">Generator Load</p>
                    <div className="flex items-baseline gap-2 z-10">
                        <p className="text-7xl font-black text-white tracking-tighter drop-shadow-[0_0_35px_rgba(43,124,238,0.6)]">{STG_DATA.loadMW}</p>
                        <span className="text-3xl font-bold text-primary">MW</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 z-10">
                        <span className="material-symbols-outlined text-sm text-text-secondary">show_chart</span>
                        <span className="text-sm font-mono text-text-secondary">{STG_DATA.frequency} Hz</span>
                        <span className="text-xs text-text-secondary/60 ml-1">Frequency</span>
                    </div>
                </div>

                {/* Steam Inlet & Condensate */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-surface-dark p-5 rounded-xl border border-slate-800 flex items-center justify-between hover:border-primary/40 hover:bg-surface-highlight transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-default">
                        <div>
                            <div className="flex items-center gap-2 mb-1 text-primary">
                                <span className="material-symbols-outlined text-lg">air</span>
                                <span className="text-xs font-bold uppercase tracking-wide">Steam Inlet</span>
                            </div>
                            <p className="text-3xl font-bold text-white">{STG_DATA.steamInlet.flow.toFixed(1)} <span className="text-sm font-normal text-slate-400">t/h</span></p>
                        </div>
                        <span className="text-xs text-text-secondary">T: {STG_DATA.steamInlet.totaliser.toLocaleString()} ton</span>
                    </div>
                    <div className="bg-surface-dark p-5 rounded-xl border border-slate-800 flex items-center justify-between hover:border-blue-400/40 hover:bg-surface-highlight transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-default">
                        <div>
                            <div className="flex items-center gap-2 mb-1 text-blue-400">
                                <span className="material-symbols-outlined text-lg">water_drop</span>
                                <span className="text-xs font-bold uppercase tracking-wide">Condensate</span>
                            </div>
                            <p className="text-3xl font-bold text-white">{STG_DATA.condensate.flow.toFixed(1)} <span className="text-sm font-normal text-slate-400">t/h</span></p>
                        </div>
                        <span className="text-xs text-text-secondary">T: {STG_DATA.condensate.totaliser.toLocaleString()} ton</span>
                    </div>
                </div>
            </div>

            {/* Vacuum & Thrust Bearing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface-dark p-5 rounded-xl border border-slate-800 hover:border-cyan-500/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-500/5 cursor-default">
                    <div className="flex items-center gap-2 mb-2 text-cyan-400">
                        <span className="material-symbols-outlined text-lg">speed</span>
                        <span className="text-xs font-bold uppercase tracking-wide">Vacuum</span>
                    </div>
                    <div className="flex items-end justify-between">
                        <p className="text-3xl font-bold text-white">{STG_DATA.vacuum} <span className="text-sm font-normal text-slate-400">Mpa</span></p>
                        <div className="flex flex-col items-end gap-1">
                            <div className="w-24 bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full" style={{ width: '55%' }}></div>
                            </div>
                            <span className="text-[10px] text-text-secondary">Normal Range</span>
                        </div>
                    </div>
                </div>
                <div className="bg-surface-dark p-5 rounded-xl border border-slate-800 hover:border-red-400/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-400/5 cursor-default">
                    <div className="flex items-center gap-2 mb-2 text-red-400">
                        <span className="material-symbols-outlined text-lg">precision_manufacturing</span>
                        <span className="text-xs font-bold uppercase tracking-wide">Thrust Bearing</span>
                    </div>
                    <div className="flex items-end justify-between">
                        <p className="text-3xl font-bold text-white">{STG_DATA.thrustBearing} <span className="text-sm font-normal text-slate-400">°C</span></p>
                        <div className="flex flex-col items-end gap-1">
                            <div className="w-24 bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full" style={{ width: '65%' }}></div>
                            </div>
                            <span className="text-[10px] text-text-secondary">Normal Range</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Distribusi Steam ───
function SteamDistribution() {
    const factories = [
        { name: 'Pabrik 1', data: STG_DATA.steamPabrik1, color: 'text-purple-400' },
        { name: 'Pabrik 3', data: STG_DATA.steamPabrik3, color: 'text-orange-400' },
        { name: 'Inlet Turbin', data: STG_DATA.steamInlet, color: 'text-cyan-400' },
    ];

    return (
        <div className="bg-surface-dark border border-slate-800 hover:border-purple-500/30 rounded-xl overflow-hidden shadow-md hover:shadow-xl hover:shadow-purple-500/5 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-default">
            <div className="p-5 border-b border-slate-800 bg-purple-500/20">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-purple-500/20 rounded-md">
                        <span className="material-symbols-outlined text-purple-400 text-sm">factory</span>
                    </span>
                    <h3 className="text-white text-lg font-bold tracking-tight">Distribusi Steam</h3>
                </div>
            </div>
            <div className="p-5 flex-1 flex flex-col gap-4 justify-center">
                {factories.map(f => (
                    <div key={f.name} className="bg-surface-highlight/30 hover:bg-surface-highlight p-5 rounded-lg border border-slate-700/50 hover:border-slate-500 transition-all duration-300 flex justify-between items-center hover:scale-[1.02]">
                        <div>
                            <p className={`${f.color} text-sm font-bold uppercase mb-1`}>{f.name}</p>
                            <p className="text-3xl font-black text-white">{f.data.flow.toFixed(1)} <span className="text-base font-normal text-slate-400">t/h</span></p>
                        </div>
                        <div className={`flex items-center justify-center p-2 bg-surface-dark/50 rounded-lg border border-slate-700/30`}>
                            <span className={`material-symbols-outlined ${f.color}`}>air</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Dashboard Page ───
export default function DashboardPage() {
    const { operator } = useOperator();
    const router = useRouter();
    const [currentTime, setCurrentTime] = useState(new Date());
    const currentShift = getCurrentShift();

    useEffect(() => {
        if (!operator) {
            router.push('/');
            return;
        }
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [operator, router]);

    if (!operator) return null;

    const timeStr = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
    const dateStr = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const shiftLabel = currentShift === 1 ? 'Pagi' : currentShift === 2 ? 'Sore' : 'Malam';
    const totalSteam = BOILER_DATA.A.steam.flow + BOILER_DATA.B.steam.flow;
    const totalCoal = BOILER_DATA.A.coalFeeders.reduce((s, f) => s + f.flow, 0) + BOILER_DATA.B.coalFeeders.reduce((s, f) => s + f.flow, 0);

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-8">
            {/* Header */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-white mb-2">Dashboard Operasional UBB</h2>
                    <div className="flex items-center gap-3 text-text-secondary flex-wrap">
                        <span className="px-2 py-0.5 rounded text-sm font-bold bg-primary/20 text-primary border border-primary/20 uppercase tracking-widest">
                            Grup {shiftLabel} {operator.group || ''}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        <span className="text-sm font-medium">{dateStr}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Live Update Box (Tank Level Style) */}
                    <div className="bg-primary/10 border border-primary/50 rounded-2xl px-5 py-2.5 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(43,124,238,0.2)] relative overflow-hidden group min-w-[170px]">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent pointer-events-none" />
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-700 animate-pulse pointer-events-none" />
                        <span className="text-[10px] uppercase font-black text-primary tracking-[0.2em] relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">Last Data Update</span>
                        <div className="flex items-center gap-2 mt-1 relative z-10">
                            <span className="material-symbols-outlined text-primary text-2xl drop-shadow-[0_0_15px_rgba(43,124,238,0.8)]">schedule</span>
                            <span className="text-3xl font-black font-mono text-white tracking-widest leading-none drop-shadow-[0_0_30px_rgba(43,124,238,0.5)]">{timeStr}</span>
                        </div>
                    </div>
                    
                    <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 cursor-pointer h-full">
                        <span className="material-symbols-outlined text-base">refresh</span>
                        Refresh
                    </button>
                </div>
            </header>

            {/* Boiler A & B */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BoilerCard name="A" data={BOILER_DATA.A} />
                <BoilerCard name="B" data={BOILER_DATA.B} />
            </div>

            {/* STG + Steam Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <STGCard />
                </div>
                <SteamDistribution />
            </div>

            {/* Quick Stats + Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="bg-surface-dark border border-slate-800 hover:border-emerald-500/30 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5 cursor-default">
                    <p className="text-sm font-medium text-text-secondary">Total Steam</p>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-bold text-white">{totalSteam.toFixed(1)} t/h</span>
                        <div className="flex items-center text-emerald-500 text-sm font-medium">
                            <span className="material-symbols-outlined text-base">trending_up</span>
                            <span>+2.3%</span>
                        </div>
                    </div>
                </div>
                <div className="bg-surface-dark border border-slate-800 hover:border-rose-500/30 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-rose-500/5 cursor-default">
                    <p className="text-sm font-medium text-text-secondary">Total Coal</p>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-bold text-white">{totalCoal.toFixed(1)} t/h</span>
                        <div className="flex items-center text-rose-500 text-sm font-medium">
                            <span className="material-symbols-outlined text-base">trending_down</span>
                            <span>-1.1%</span>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-2 bg-surface-dark border border-slate-800 hover:border-slate-600 rounded-xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <p className="text-sm font-medium text-text-secondary mb-3">Quick Actions</p>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => router.push('/input-shift')} className="flex-1 min-w-[140px] bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/40 hover:border-primary px-4 py-3 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5">
                            <span className="material-symbols-outlined">edit_square</span>
                            Input Laporan
                        </button>
                        <button onClick={() => router.push('/laporan-shift')} className="flex-1 min-w-[140px] bg-surface-highlight hover:bg-slate-700 text-white border border-slate-600 hover:border-slate-400 px-4 py-3 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg hover:-translate-y-0.5">
                            <span className="material-symbols-outlined">description</span>
                            Laporan Shift
                        </button>
                        <button onClick={() => router.push('/tank-level')} className="flex-1 min-w-[140px] bg-surface-highlight hover:bg-slate-700 text-white border border-slate-600 hover:border-slate-400 px-4 py-3 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg hover:-translate-y-0.5">
                            <span className="material-symbols-outlined">propane_tank</span>
                            Tank Level
                        </button>
                    </div>
                </div>
            </div>

            <footer className="text-center py-4 border-t border-slate-800 mt-8">
                <p className="text-slate-500 text-xs">© 2023 PowerOps Control Systems. All systems operational.</p>
            </footer>
        </div>
    );
}
