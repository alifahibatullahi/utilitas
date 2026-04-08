'use client';

import { useOperator } from '@/hooks/useOperator';
import { useTankData } from '@/hooks/useTankData';
import { TANK_IDS, TANKS, TankId, TANK_THRESHOLDS, DEFAULT_THRESHOLDS } from '@/lib/constants';
import { getAlertStatus } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import BottomTabBar from '@/components/layout/BottomTabBar';

// Per-tank color themes
const TANK_COLORS: Record<string, {
    base: string; bgClass: string; textClass: string; icon: string; borderClass: string;
}> = {
    DEMIN: { base: '#0ea5e9', bgClass: 'bg-sky-500',   textClass: 'text-sky-400',   icon: 'water_drop', borderClass: 'border-sky-500/30' },
    RCW:   { base: '#14b8a6', bgClass: 'bg-teal-500',  textClass: 'text-teal-400',  icon: 'water_pump', borderClass: 'border-teal-500/30' },
    SOLAR: { base: '#f59e0b', bgClass: 'bg-amber-500', textClass: 'text-amber-400', icon: 'oil_barrel', borderClass: 'border-amber-500/30' },
};

function TankCard({ tankId, compact = false }: { tankId: TankId; compact?: boolean }) {
    const { currentLevels, flowRates, outputFlowRates, solarUnloadings, solarUsages, pumpActiveSince, deleteSolarUnloading, updateSolarUnloading, deleteSolarUsage, updateSolarUsage } = useTankData();
    // Edit unloading state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editLiters, setEditLiters] = useState('');
    const [editSupplier, setEditSupplier] = useState('');
    
    // Edit usage state
    const [editingUsageId, setEditingUsageId] = useState<string | null>(null);
    const [editUsageDate, setEditUsageDate] = useState('');
    const [editUsageLiters, setEditUsageLiters] = useState('');
    const [editUsageTujuan, setEditUsageTujuan] = useState('');
    
    const tank = TANKS[tankId];
    const data = currentLevels[tankId];
    const level = data?.level || 0;
    const thresholds = TANK_THRESHOLDS[tankId] || DEFAULT_THRESHOLDS;
    const status = getAlertStatus(level, thresholds);
    const tc = TANK_COLORS[tankId] || TANK_COLORS.DEMIN;

    const flows    = flowRates[tankId]       || [];
    const outFlows = outputFlowRates[tankId] || [];

    const totalFlowIn  = flows.reduce((s, f) => s + f.rate, 0);
    const totalFlowOut = outFlows
        .filter(f => tank.outputDestinations.find(d => d.name === f.destinationLabel)?.hasFlow)
        .reduce((s, f) => s + f.rate, 0);

    const statusObj = status === 'normal'
        ? { label: 'Normal',  color: 'bg-emerald-500', text: 'text-emerald-400', ring: 'shadow-emerald-500/40' }
        : status === 'warning'
            ? { label: 'Warning', color: 'bg-amber-500',   text: 'text-amber-400',   ring: 'shadow-amber-500/40' }
            : { label: 'Kritis',  color: 'bg-red-500',     text: 'text-red-400',     ring: 'shadow-red-500/40' };

    const m3 = Math.round(level / 100 * (tankId === 'SOLAR' ? 200 : tank.capacityM3));

    return (
        <div className={`bg-surface-dark border ${tc.borderClass} rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300 lg:h-full`}
            style={{ boxShadow: `0 0 40px ${tc.base}15` }}>

            {/* ── Card Header ── */}
            <div className="flex-shrink-0 px-4 lg:px-6 py-3 lg:py-4 border-b border-slate-800 flex items-center justify-between"
                style={{ background: `linear-gradient(to right, ${tc.base}22, transparent 60%)` }}>
                <div className="flex items-center gap-3 lg:gap-4">
                    <div className={`p-2 lg:p-3 ${tc.bgClass} rounded-xl`}
                        style={{ boxShadow: `0 0 20px ${tc.base}80` }}>
                        <span className="material-symbols-outlined text-white text-xl lg:text-3xl">{tc.icon}</span>
                    </div>
                    <div>
                        <h3 className="text-white font-black text-xl lg:text-3xl uppercase tracking-tight leading-none">{tank.name}</h3>
                        <p className="text-slate-400 text-xs lg:text-sm font-semibold mt-0.5">{tank.capacity}</p>
                    </div>
                </div>
                {/* Status badge */}
                <div className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full border ${
                    status === 'normal' ? 'bg-emerald-500/10 border-emerald-500/30' :
                    status === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                    'bg-red-500/10 border-red-500/30'}`}>
                    <span className="relative flex h-2.5 w-2.5 lg:h-3 lg:w-3">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusObj.color} opacity-60`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 lg:h-3 lg:w-3 ${statusObj.color}`}></span>
                    </span>
                    <span className={`${statusObj.text} text-xs lg:text-sm font-black uppercase tracking-widest`}>{statusObj.label}</span>
                </div>
            </div>

            {/* ── Main Body ── */}
            <div className="flex-1 flex gap-0 lg:min-h-0 lg:overflow-hidden">

                {/* Glass Tank column — desktop only */}
                <div className="hidden lg:flex flex-shrink-0 w-48 xl:w-56 flex-col items-center justify-between py-6 px-6 border-r border-slate-800/60"
                    style={{ background: `linear-gradient(to bottom, ${tc.base}08, transparent)` }}>
                    <div className="w-full xl:w-3/4 flex-1 glass-tank rounded-3xl relative bg-slate-800/60 min-h-[300px]">
                        {/* scale marks */}
                        <div className="absolute inset-0 flex flex-col justify-between py-8 px-3 z-20 pointer-events-none">
                            <div className="border-t border-white/10 text-xs xl:text-sm text-right text-slate-500 pr-2 font-bold uppercase tracking-widest">100%</div>
                            <div className="border-t border-white/10 text-xs xl:text-sm text-right text-slate-500 pr-2 font-bold uppercase tracking-widest">75%</div>
                            <div className="border-t border-white/10 text-xs xl:text-sm text-right text-slate-500 pr-2 font-bold uppercase tracking-widest">50%</div>
                            <div className="border-t border-white/10 text-xs xl:text-sm text-right text-slate-500 pr-2 font-bold uppercase tracking-widest">25%</div>
                            <div className="border-t border-white/10 text-xs xl:text-sm text-right text-slate-500 pr-2 font-bold uppercase tracking-widest">0%</div>
                        </div>
                        {/* liquid */}
                        <div className="liquid backdrop-blur-md rounded-b-3xl"
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                                height: `${Math.min(Math.max(level, 0), 100)}%`,
                                backgroundColor: `${tc.base}CC`,
                                boxShadow: `0 -10px 40px ${tc.base}50` }}>
                            <div className="liquid-surface" style={{ backgroundColor: tc.base, filter: 'brightness(1.5)', height: '15px', top: '-7.5px' }} />
                        </div>
                    </div>
                    {/* % label below tank */}
                    <div className="mt-6 flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mb-1">Percentage</span>
                        <p className="text-4xl xl:text-5xl font-black font-mono leading-none tracking-tighter" style={{ color: tc.base, textShadow: `0 0 20px ${tc.base}40` }}>{level.toFixed(1)}%</p>
                    </div>
                </div>

                {/* Stats column */}
                <div className="flex-1 flex flex-col justify-between p-4 lg:p-6 gap-3 lg:gap-4 lg:overflow-hidden">

                    {/* Current Level — hero number */}
                    <div>
                        <p className="text-xs lg:text-sm text-slate-500 uppercase tracking-[0.2em] font-black mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">water</span>
                            Total Volume Available
                        </p>
                        <div className="flex items-baseline gap-2 xl:gap-3">
                            <span className="font-black text-white leading-none tracking-tighter"
                                style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
                                    textShadow: `0 0 40px ${tc.base}80, 0 0 80px ${tc.base}30` }}>
                                {m3.toLocaleString('id-ID')}
                            </span>
                            <span className={`font-black ${tc.textClass} tracking-tighter`} style={{ fontSize: 'clamp(1.2rem, 2vw, 2rem)' }}>m³</span>
                            {/* % on mobile (no glass tank) */}
                            <span className="lg:hidden ml-auto text-2xl font-black font-mono" style={{ color: tc.base }}>{level.toFixed(1)}%</span>
                        </div>
                        {tankId === 'SOLAR' && (
                            <div className="inline-block mt-3 bg-slate-800/50 border border-slate-700/60 px-4 py-2 rounded-xl">
                                <p className="text-sm xl:text-base text-slate-400 font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">layers</span>
                                    Total 2 tanki: <span className="text-white font-black text-lg xl:text-xl">{(m3 * 2).toLocaleString('id-ID')} m³</span>
                                </p>
                            </div>
                        )}
                        {/* Progress bar */}
                        <div className="mt-4 lg:hidden h-3 rounded-full bg-slate-700/70 overflow-hidden shadow-inner">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(level, 100)}%`, backgroundColor: tc.base,
                                    boxShadow: `0 0 15px ${tc.base}` }} />
                        </div>
                    </div>

                    {/* Flow In / Out (DEMIN & RCW) */}
                    {tankId !== 'SOLAR' && (
                        <div className="grid grid-cols-2 gap-3 xl:gap-4 mt-2">
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3 xl:px-5 xl:py-4 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                                <p className="text-[11px] xl:text-xs text-emerald-500/80 uppercase font-black tracking-widest mb-1 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">login</span> Flow In
                                </p>
                                <p className="text-2xl lg:text-3xl xl:text-4xl font-black font-mono text-emerald-400 leading-none tracking-tighter">
                                    {totalFlowIn.toFixed(1)}<span className="text-sm lg:text-base xl:text-xl ml-1 xl:ml-2 font-bold opacity-60">t/h</span>
                                </p>
                            </div>
                            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl px-4 py-3 xl:px-5 xl:py-4 shadow-[0_0_20px_rgba(244,63,94,0.05)]">
                                <p className="text-[11px] xl:text-xs text-rose-500/80 uppercase font-black tracking-widest mb-1 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">logout</span> Flow Out
                                </p>
                                <p className="text-2xl lg:text-3xl xl:text-4xl font-black font-mono text-rose-400 leading-none tracking-tighter">
                                    {totalFlowOut.toFixed(1)}<span className="text-sm lg:text-base xl:text-xl ml-1 xl:ml-2 font-bold opacity-60">t/h</span>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Details — sources / destinations / unloading */}
                    <div className="flex flex-col gap-3 lg:gap-4 mt-2 xl:mt-4 pt-4 border-t border-slate-800/60 flex-1">
                        {tankId === 'SOLAR' ? (
                            <>
                                <p className="text-[11px] xl:text-xs text-slate-500 uppercase font-black tracking-[0.15em] flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[14px] xl:text-base">local_shipping</span> 3 Unloading Terakhir
                                </p>
                                <div className={`${solarUnloadings.length > 0 ? 'flex flex-col gap-2.5 xl:gap-3' : ''}`}>
                                    {solarUnloadings.slice(0, 3).map((entry, idx) => {
                                        const lbl = new Date(entry.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                                        const isEditing = editingId === entry.id;
                                        if (isEditing) {
                                            return (
                                                <div key={entry.id ?? idx} className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/40">
                                                    <div className="flex gap-2">
                                                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                                                            className="flex-1 px-2 py-1 rounded-lg bg-slate-800 border border-slate-600 text-xs text-white outline-none focus:border-amber-500/50" />
                                                        <input type="number" inputMode="decimal" value={editLiters} onChange={e => setEditLiters(e.target.value)}
                                                            placeholder="Liter" className="w-24 px-2 py-1 rounded-lg bg-slate-800 border border-slate-600 text-xs text-white text-center outline-none focus:border-amber-500/50 appearance-none" />
                                                    </div>
                                                    <input type="text" value={editSupplier} onChange={e => setEditSupplier(e.target.value)}
                                                        placeholder="Perusahaan" className="w-full px-2 py-1 rounded-lg bg-slate-800 border border-slate-600 text-xs text-white outline-none focus:border-amber-500/50" />
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => setEditingId(null)}
                                                            className="px-3 py-1 rounded-lg bg-slate-700 text-xs text-slate-300 font-bold cursor-pointer hover:bg-slate-600 transition-colors">Batal</button>
                                                        <button onClick={async () => {
                                                            if (entry.id) await updateSolarUnloading(entry.id, { date: editDate, liters: parseFloat(editLiters) || 0, supplier: editSupplier });
                                                            setEditingId(null);
                                                        }} className="px-3 py-1 rounded-lg bg-amber-500 text-xs text-white font-bold cursor-pointer hover:bg-amber-400 transition-colors">Simpan</button>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={entry.id ?? idx} className="flex items-center justify-between px-4 py-3 xl:px-5 xl:py-4 rounded-xl xl:rounded-2xl bg-surface-highlight/40 border border-slate-700/60 hover:bg-surface-highlight/80 transition-colors group relative">
                                                <div className="w-full pr-12 relative flex flex-col justify-center">
                                                    <span className="text-sm xl:text-base font-bold text-white block truncate">{lbl}</span>
                                                    <span className="text-[11px] xl:text-xs text-slate-400 truncate block mt-0.5 group-hover:text-slate-300 transition-colors" title={entry.supplier}>{entry.supplier}</span>
                                                </div>
                                                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                                                    <span className={`text-xl xl:text-2xl font-black font-mono tracking-tighter leading-none ${tc.textClass}`}>
                                                        {entry.liters.toLocaleString('id-ID')}
                                                    </span>
                                                    <span className="text-xs xl:text-sm text-slate-500 font-bold">L</span>
                                                </div>
                                                {entry.id && (
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-dark/90 backdrop-blur-md rounded-lg p-1.5 shadow-lg border border-slate-700/50">
                                                        <button onClick={() => { setEditingId(entry.id!); setEditDate(entry.date); setEditLiters(entry.liters.toString()); setEditSupplier(entry.supplier); }}
                                                            className="text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded-md hover:bg-slate-700 cursor-pointer flex items-center justify-center" title="Edit">
                                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                                        </button>
                                                        <button onClick={() => { if (entry.id && confirm('Hapus data unloading ini?')) deleteSolarUnloading(entry.id); }}
                                                            className="text-slate-400 hover:text-rose-400 transition-colors p-1.5 rounded-md hover:bg-slate-700 cursor-pointer flex items-center justify-center" title="Hapus">
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {solarUnloadings.length === 0 && (
                                    <p className="text-sm text-slate-600 italic py-2">Belum ada riwayat unloading</p>
                                )}
                                
                                <p className="text-[11px] xl:text-xs text-slate-500 uppercase font-black tracking-[0.15em] flex items-center gap-2 mt-4 xl:mt-5 pt-4 border-t border-slate-800/60">
                                    <span className="material-symbols-outlined text-[14px] xl:text-base">upload</span> 3 Pemakaian Terakhir
                                </p>
                                <div className={`${solarUsages.length > 0 ? 'flex flex-col gap-2.5 xl:gap-3 mt-2' : 'mt-2'}`}>
                                    {solarUsages.slice(0, 3).map((entry, idx) => {
                                        const lbl = new Date(entry.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                                        const isEditing = editingUsageId === entry.id;
                                        if (isEditing) {
                                            return (
                                                <div key={entry.id ?? idx} className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40">
                                                    <div className="flex gap-2">
                                                        <input type="date" value={editUsageDate} onChange={e => setEditUsageDate(e.target.value)}
                                                            className="flex-1 px-2 py-1 rounded-lg bg-slate-800 border border-slate-600 text-xs text-white outline-none focus:border-rose-500/50" />
                                                        <input type="number" inputMode="decimal" value={editUsageLiters} onChange={e => setEditUsageLiters(e.target.value)}
                                                            placeholder="Liter" className="w-24 px-2 py-1 rounded-lg bg-slate-800 border border-slate-600 text-xs text-white text-center outline-none focus:border-rose-500/50 appearance-none" />
                                                    </div>
                                                    <input type="text" value={editUsageTujuan} onChange={e => setEditUsageTujuan(e.target.value)}
                                                        placeholder="Tujuan (e.g., Boiler)" className="w-full px-2 py-1 rounded-lg bg-slate-800 border border-slate-600 text-xs text-white outline-none focus:border-rose-500/50" />
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => setEditingUsageId(null)}
                                                            className="px-3 py-1 rounded-lg bg-slate-700 text-xs text-slate-300 font-bold cursor-pointer hover:bg-slate-600 transition-colors">Batal</button>
                                                        <button onClick={async () => {
                                                            if (entry.id) await updateSolarUsage(entry.id, { date: editUsageDate, liters: parseFloat(editUsageLiters) || 0, tujuan: editUsageTujuan });
                                                            setEditingUsageId(null);
                                                        }} className="px-3 py-1 rounded-lg bg-rose-500 text-xs text-white font-bold cursor-pointer hover:bg-rose-400 transition-colors">Simpan</button>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={entry.id ?? idx} className="flex items-center justify-between px-4 py-3 xl:px-5 xl:py-4 rounded-xl xl:rounded-2xl bg-surface-highlight/40 border border-slate-700/60 hover:bg-surface-highlight/80 transition-colors group relative">
                                                <div className="w-full pr-12 relative flex flex-col justify-center">
                                                    <span className="text-sm xl:text-base font-bold text-white block truncate">{lbl}</span>
                                                    <span className="text-[11px] xl:text-xs text-slate-400 truncate block mt-0.5 group-hover:text-slate-300 transition-colors" title={entry.tujuan}>{entry.tujuan}</span>
                                                </div>
                                                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                                                    <span className={`text-xl xl:text-2xl font-black font-mono tracking-tighter leading-none text-rose-400`}>
                                                        {entry.liters.toLocaleString('id-ID')}
                                                    </span>
                                                    <span className="text-xs xl:text-sm text-slate-500 font-bold">L</span>
                                                </div>
                                                {entry.id && (
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-dark/90 backdrop-blur-md rounded-lg p-1.5 shadow-lg border border-slate-700/50">
                                                        <button onClick={() => { setEditingUsageId(entry.id!); setEditUsageDate(entry.date); setEditUsageLiters(entry.liters.toString()); setEditUsageTujuan(entry.tujuan); }}
                                                            className="text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded-md hover:bg-slate-700 cursor-pointer flex items-center justify-center" title="Edit">
                                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                                        </button>
                                                        <button onClick={() => { if (entry.id && confirm('Hapus data pemakaian ini?')) deleteSolarUsage(entry.id); }}
                                                            className="text-slate-400 hover:text-rose-400 transition-colors p-1.5 rounded-md hover:bg-slate-700 cursor-pointer flex items-center justify-center" title="Hapus">
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {solarUsages.length === 0 && (
                                    <p className="text-sm text-slate-600 italic py-2">Belum ada riwayat pemakaian</p>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col gap-3 xl:gap-4 mt-1">
                                {tank.inputSources.length > 0 && (
                                    <div className="flex flex-col gap-3 xl:gap-4">
                                        <p className="text-[11px] xl:text-xs text-slate-500 uppercase font-black tracking-[0.1em] flex items-center gap-1.5 mb-1">
                                            <span className="material-symbols-outlined text-[16px] xl:text-[20px]">turn_left</span> {compact ? 'Input' : 'Input Sources'}
                                        </p>
                                        <div className="flex flex-col gap-2 xl:gap-3">
                                            {tank.inputSources.map(source => {
                                                const f = flows.find(f => f.sourceLabel === source);
                                                const active = f && f.rate > 0;
                                                return (
                                                    <div key={source} className={`flex items-center justify-between px-4 py-3 xl:px-5 xl:py-4 rounded-xl border ${active ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-slate-700/10 border-slate-700/40'} transition-all`}>
                                                        <div className="flex items-center gap-3">
                                                            <span className={`w-3 h-3 xl:w-3.5 xl:h-3.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`}></span>
                                                            <span className={`text-sm xl:text-base font-bold uppercase tracking-tight ${active ? 'text-emerald-400' : 'text-slate-400'}`}>{source}</span>
                                                        </div>
                                                        <span className={`text-lg xl:text-xl font-mono font-black tracking-tighter ${active ? 'text-emerald-400' : 'text-slate-600'}`}>{f ? f.rate.toFixed(1) : '0.0'} <span className="text-xs xl:text-sm font-bold opacity-60 ml-1">t/h</span></span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {tank.outputDestinations.length > 0 && (
                                    <div className="flex flex-col gap-3 xl:gap-4">
                                        <p className="text-[11px] xl:text-xs text-slate-500 uppercase font-black tracking-[0.1em] flex items-center gap-1.5 mb-1 mt-2 xl:mt-0">
                                            <span className="material-symbols-outlined text-[16px] xl:text-[20px]">turn_right</span> {compact ? 'Output' : 'Output Destinations'}
                                        </p>
                                        <div className="flex flex-col gap-2 xl:gap-3">
                                            {tank.outputDestinations.map(dest => {
                                                const outFlow = outFlows.find(f => f.destinationLabel === dest.name);
                                                const outActive = dest.hasFlow
                                                    ? !!(outFlow && outFlow.rate > 0)
                                                    : !!(outFlow?.pump);
                                                return (
                                                    <div key={dest.name} className={`flex flex-col gap-2 px-4 py-3 xl:px-5 xl:py-4 rounded-xl border ${outActive ? 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'bg-slate-700/10 border-slate-700/40'} transition-all`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`w-3 h-3 xl:w-3.5 xl:h-3.5 rounded-full ${outActive ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'bg-slate-600'}`}></span>
                                                                <span className={`text-sm xl:text-base font-bold uppercase tracking-tight ${outActive ? 'text-rose-400' : 'text-slate-400'}`}>{dest.name}</span>
                                                            </div>
                                                            {dest.hasFlow && (
                                                                <span className={`text-lg xl:text-xl font-mono font-black tracking-tighter ${outActive ? 'text-rose-400' : 'text-slate-600'}`}>{outFlow ? outFlow.rate.toFixed(1) : '0.0'} <span className="text-xs xl:text-sm font-bold opacity-60 ml-1">t/h</span></span>
                                                            )}
                                                        </div>
                                                        {dest.pumps && (
                                                            <div className="flex flex-col gap-2 pt-3 mt-1.5 border-t border-slate-600/30">
                                                                <div className="flex flex-wrap items-center gap-2.5">
                                                                    {dest.pumps.map(pump => {
                                                                        const isActive = outFlow?.pump === pump;
                                                                        return isActive ? (
                                                                            <div key={pump} className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 xl:px-3.5 xl:py-2 rounded-lg shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]">
                                                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                                                                                <span className="text-xs xl:text-sm font-bold text-emerald-400 uppercase tracking-widest">{pump}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <div key={pump} className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 px-3 py-1.5 xl:px-3.5 xl:py-2 rounded-lg opacity-60">
                                                                                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                                                                                <span className="text-xs xl:text-sm font-bold text-slate-400 uppercase tracking-widest">{pump}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                {/* Aktif sejak — tampil saat pompa aktif */}
                                                                {outActive && pumpActiveSince && (
                                                                    <div className="flex items-center gap-2 text-xs xl:text-sm text-emerald-400/70 font-semibold mt-1">
                                                                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                                                                        Aktif sejak{' '}
                                                                        <span className="font-black text-emerald-400 ml-1">
                                                                            {new Date(pumpActiveSince).toLocaleDateString('id-ID', compact
                                                                                ? { weekday: 'short', day: '2-digit', month: 'short' }
                                                                                : { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                                                                            {new Date(pumpActiveSince).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const SIDEBAR_COLLAPSED_W = 68;
const SIDEBAR_EXPANDED_W = 260;

export default function TankLevelPage() {
    const { operator, canInputTank, loading: operatorLoading } = useOperator();
    const { currentLevels } = useTankData();
    const router = useRouter();
    const [now, setNow] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

    // Live clock
    useEffect(() => {
        const tick = () => setNow(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    const lastUpdate = Object.values(currentLevels)
        .map(d => d?.timestamp).filter(Boolean).sort().reverse()[0];

    const lastUpdateTime = lastUpdate
        ? new Date(lastUpdate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '--:--';

    const lastUpdateDate = lastUpdate
        ? new Date(lastUpdate).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
        : '---';

    useEffect(() => {
        if (!operatorLoading && !operator) router.push('/');
    }, [operator, operatorLoading, router]);

    if (operatorLoading || !operator) return null;

    const bg = 'var(--color-background, #060c1a)';

    return (
        <>
            {/* ─────────────────── MOBILE layout (< lg) ─────────────────── */}
            <div className="lg:hidden flex flex-col gap-3 px-4 py-4 min-h-screen pb-20" style={{ background: bg }}>
                <header className="flex-shrink-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                            <h1 className="text-lg font-black tracking-tight text-white leading-tight">
                                Tank Level <span className="text-primary">Monitoring UBB</span>
                            </h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-bold">CCR Live Display</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {canInputTank && (
                                <button onClick={() => router.push('/input')}
                                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer">
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                    Update
                                </button>
                            )}
                            <button onClick={() => window.location.reload()}
                                className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-primary/20 cursor-pointer">
                                <span className="material-symbols-outlined text-sm">refresh</span>
                            </button>
                            <button onClick={() => router.push('/dashboard')}
                                className="flex items-center gap-1 text-slate-400 hover:text-white hover:bg-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-sm">arrow_back</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-primary/10 border border-primary/40 rounded-xl px-4 py-2.5 shadow-[0_0_15px_rgba(43,124,238,0.2)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent pointer-events-none" />
                        <span className="material-symbols-outlined text-primary text-xl drop-shadow-[0_0_10px_rgba(43,124,238,0.8)] relative z-10">schedule</span>
                        <div className="flex flex-col relative z-10">
                            <span className="text-[10px] text-primary font-black uppercase tracking-widest drop-shadow-md">Last Update</span>
                            <span className="text-xl font-black font-mono text-white leading-none drop-shadow-md">{lastUpdateTime}</span>
                            <span className="text-xs text-slate-300 font-bold">{lastUpdateDate}</span>
                        </div>
                        <div className="ml-auto flex flex-col items-end relative z-10">
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-900/50 px-2 py-0.5 rounded-md backdrop-blur-sm mb-0.5">Waktu</span>
                            <span className="text-xl font-black font-mono text-slate-200 leading-none bg-slate-900/50 px-2 py-1 rounded-md backdrop-blur-sm">{now}</span>
                        </div>
                    </div>
                </header>
                <div className="grid grid-cols-1 gap-4">
                    {TANK_IDS.map(id => <TankCard key={id} tankId={id} />)}
                </div>
            </div>

            {/* Bottom tab bar — mobile only */}
            <div className="lg:hidden">
                <BottomTabBar />
            </div>

            {/* ─────────────────── DESKTOP: Fluid Native (full display) ─────────────────── */}
            {/* Sidebar — desktop only */}
            <div className="hidden lg:block fixed top-0 left-0 bottom-0 z-30">
                <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} />
            </div>
            {/* Outer: fills viewport minus sidebar */}
            <div className="hidden lg:flex fixed top-0 bottom-0 overflow-hidden transition-all duration-300"
                style={{ left: `${sidebarCollapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W}px`, right: 0, background: bg }}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    padding: '24px 32px 32px',
                    boxSizing: 'border-box',
                }}>
                    {/* Desktop header */}
                    <header style={{ flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
                            {/* Title */}
                            <div>
                                <h1 className="text-4xl 2xl:text-[48px] font-black text-white leading-none tracking-tight m-0">
                                    Tank Level <span className="text-primary">Monitoring UBB</span>
                                </h1>
                                <p className="text-xs 2xl:text-[13px] text-primary uppercase font-black tracking-[0.3em] mt-2">CCR Live Display</p>
                            </div>

                            {/* Clocks */}
                            <div className="flex items-stretch gap-4">
                                <div className="bg-primary/10 border-2 border-primary/50 rounded-2xl md:rounded-[24px] px-6 py-3 2xl:px-7 2xl:py-3.5 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(43,124,238,0.3)] relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent pointer-events-none" />
                                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-700 animate-pulse pointer-events-none" />
                                    <span className="text-[10px] 2xl:text-[11px] uppercase font-black text-primary tracking-[0.2em] relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">Last Data Update</span>
                                    <div className="flex items-center gap-2 2xl:gap-2.5 mt-1 relative z-10">
                                        <span className="material-symbols-outlined text-primary text-3xl 2xl:text-[36px] drop-shadow-[0_0_15px_rgba(43,124,238,0.8)]">schedule</span>
                                        <span className="text-4xl 2xl:text-[56px] font-black font-mono text-white tracking-widest leading-none drop-shadow-[0_0_30px_rgba(43,124,238,0.5)]">{lastUpdateTime}</span>
                                    </div>
                                    <span className="text-xs 2xl:text-[13px] text-primary/80 font-bold mt-1 relative z-10">{lastUpdateDate}</span>
                                </div>

                                <div className="bg-surface-dark border border-white/5 rounded-2xl md:rounded-[24px] px-6 py-3 2xl:px-7 2xl:py-3.5 flex flex-col items-center justify-center shadow-xl">
                                    <span className="text-[10px] 2xl:text-[11px] uppercase font-black text-slate-500 tracking-[0.2em]">Local Time</span>
                                    <span className="text-4xl 2xl:text-[48px] font-black font-mono text-white tracking-widest leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] mt-1.5">{now}</span>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center gap-3">
                                {canInputTank && (
                                    <button onClick={() => router.push('/input')} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 2xl:px-[22px] 2xl:py-[14px] rounded-xl 2xl:rounded-[16px] text-sm 2xl:text-[14px] font-bold transition-all shadow-[0_4px_20px_rgba(5,150,105,0.3)] cursor-pointer">
                                        <span className="material-symbols-outlined text-xl">edit</span>
                                        Update Level
                                    </button>
                                )}
                                <button onClick={() => window.location.reload()} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-3 2xl:px-[22px] 2xl:py-[14px] rounded-xl 2xl:rounded-[16px] text-sm 2xl:text-[14px] font-bold transition-all shadow-[0_4px_20px_rgba(43,124,238,0.3)] cursor-pointer">
                                    <span className="material-symbols-outlined text-xl">refresh</span>
                                    Refresh
                                </button>
                                <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-5 py-3 2xl:px-[22px] 2xl:py-[14px] rounded-xl 2xl:rounded-[16px] text-sm 2xl:text-[14px] font-bold border border-white/10 transition-all cursor-pointer">
                                    <span className="material-symbols-outlined text-xl">home</span>
                                    Dashboard
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Tank cards — fill remaining height */}
                    <div className="grid grid-cols-3 gap-4 2xl:gap-6 flex-1 min-h-0 mt-2">
                        {TANK_IDS.map(id => <TankCard key={id} tankId={id} compact />)}
                    </div>
                </div>
            </div>
        </>
    );
}
