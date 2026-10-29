'use client';

import { useOperator } from '@/hooks/useOperator';
import FeatureDisabled from '@/components/ui/FeatureDisabled';
import { DISABLED_FEATURES } from '@/lib/feature-flags';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getCurrentShift } from '@/lib/constants';
import type { ApmDashboardData } from '@/lib/apm/dashboard';

// ─── Data E-Logsheet APM ───
// Sumber: /api/dashboard/apm (cermin `apm_readings`, diisi cron tiap ±1 jam dari APM).
// Pemetaan field → tag APM ada di lib/apm/tags.ts.

const POLL_MS = 5 * 60_000;
/** Cron sync tiap ±1 jam; lebih dari ini tanpa sync berhasil = ada yang macet. */
const SYNC_STALE_MS = 2 * 60 * 60_000;
/** Logsheet diisi tiap 2 jam dan sering telat ±1,5 jam; lebih dari ini patut dicurigai. */
const SLOT_STALE_MS = 5 * 60 * 60_000;

type Fields = ApmDashboardData['fields'];

const val = (fields: Fields | undefined, key: string): number | null => fields?.[key]?.value ?? null;

function fmt(v: number | null, digits = 1): string {
    return v === null ? '—' : v.toFixed(digits);
}

function jamWIB(iso: string): string {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
}

function tanggalPendekWIB(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
}

/** Jumlah beberapa field + selisihnya terhadap slot sebelumnya (null bila tak lengkap). */
function total(fields: Fields | undefined, keys: string[]): { value: number | null; delta: number | null } {
    const items = keys.map(k => fields?.[k]);
    const ada = items.filter(i => i?.value !== null && i?.value !== undefined);
    if (ada.length === 0) return { value: null, delta: null };
    const value = ada.reduce((s, i) => s + (i!.value as number), 0);
    const lengkap = items.every(i => i && i.value !== null && i.prev !== null);
    const delta = lengkap ? items.reduce((s, i) => s + (i!.value as number) - (i!.prev as number), 0) : null;
    return { value, delta };
}

interface BoilerView {
    steamFlow: number | null;
    furnaceTemp: number | null;
    furnacePressure: number | null;
    hotAir: number | null;
    o2: number | null;
    feeders: { id: string; flow: number | null }[];
}

function boilerView(fields: Fields | undefined, name: 'A' | 'B'): BoilerView {
    const ids = name === 'A' ? ['A', 'B', 'C'] : ['D', 'E', 'F'];
    return {
        steamFlow: val(fields, `${name}.steamFlow`),
        furnaceTemp: val(fields, `${name}.furnaceTemp`),
        furnacePressure: val(fields, `${name}.furnacePressure`),
        hotAir: val(fields, `${name}.hotAir`),
        o2: val(fields, `${name}.o2`),
        feeders: ids.map((id, i) => ({ id, flow: val(fields, `${name}.feeder${i + 1}`) })),
    };
}

// ─── Boiler Card ───
function BoilerCard({ name, data }: { name: 'A' | 'B'; data: BoilerView }) {
    const isA = name === 'A';
    const headerBg = isA ? 'bg-teal-500/20' : 'bg-blue-500/20';
    const bodyBg = isA ? 'bg-teal-500/5' : 'bg-blue-500/5';
    const borderHover = isA ? 'hover:border-teal-500/30' : 'hover:border-blue-500/30';
    const shadowHover = isA ? 'hover:shadow-teal-500/5' : 'hover:shadow-blue-500/5';
    // Konvensi yang sama dengan stream_days: boiler jalan = steam flow > 0.
    const status = data.steamFlow === null ? 'nodata' : data.steamFlow > 0 ? 'running' : 'stop';

    return (
        <div className={`bg-surface-dark ${bodyBg} border border-slate-800 ${borderHover} rounded-xl overflow-hidden shadow-sm hover:shadow-xl ${shadowHover} hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-default relative`}>
            {/* Header */}
            <div className={`p-5 border-b border-slate-800 flex justify-between items-center ${headerBg} relative z-10`}>
                <div className="flex items-center gap-3">
                    <div>
                        <h3 className="text-white font-black text-4xl tracking-tight drop-shadow-md">BOILER {name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            {status === 'running' ? (
                                <>
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-emerald-500 text-sm font-black uppercase tracking-widest drop-shadow-sm">Running</span>
                                </>
                            ) : (
                                <>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-500"></span>
                                    <span className="text-slate-400 text-sm font-black uppercase tracking-widest drop-shadow-sm">
                                        {status === 'stop' ? 'Stop' : 'No Data'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="text-right bg-emerald-600 px-4 py-2 rounded-xl border border-emerald-500 shadow-[0_4px_15px_rgba(5,150,105,0.4)]">
                    <p className="text-4xl font-black text-white drop-shadow-md">
                        {fmt(data.steamFlow, 0)} <span className="text-base font-bold text-white/90">t/h</span>
                    </p>
                    <p className="text-[11px] font-black text-emerald-50 uppercase tracking-widest mt-0.5">Steam Flow</p>
                </div>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between gap-5 relative z-10">
                {/* Row 1: Furnace Temp + Furnace Pressure */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center justify-center space-y-1 text-center">
                        <p className="text-sm text-white uppercase font-bold tracking-wider flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-orange-400">thermometer</span>
                            Furnace Temp
                        </p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-black text-white drop-shadow-sm">{fmt(data.furnaceTemp, 0)}</span>
                            <span className="text-sm text-slate-400">°C</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center space-y-1 text-center">
                        <p className="text-sm text-white uppercase font-bold tracking-wider flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-cyan-400">compress</span>
                            Vacuum
                        </p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-black text-white drop-shadow-sm">{fmt(data.furnacePressure, 0)}</span>
                            <span className="text-sm text-slate-400">Pa</span>
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
                            <span className="text-3xl font-black text-white drop-shadow-sm">{fmt(data.hotAir, 0)}</span>
                            <span className="text-sm text-slate-400">°C</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center space-y-1 text-center">
                        <p className="text-sm text-white uppercase font-bold tracking-wider flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-green-400">science</span>
                            O2
                        </p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-black text-white drop-shadow-sm">{fmt(data.o2, 1)}</span>
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
                        {data.feeders.map(f => {
                            const isActive = f.flow !== null && f.flow > 0;
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
                                            {fmt(f.flow, 1)} <span className="text-xs font-normal text-emerald-300/70">t/h</span>
                                        </p>
                                    ) : (
                                        <p className="text-[11px] font-semibold text-slate-500 italic uppercase tracking-wider">
                                            {f.flow === null ? 'No Data' : 'Standby'}
                                        </p>
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
function STGCard({ fields }: { fields: Fields | undefined }) {
    const loadMW = val(fields, 'stg.loadMW');
    const internalMW = val(fields, 'stg.internalMW');
    // Ekspor bersih = beban generator dikurangi pemakaian internal UBB.
    const exportMW = loadMW !== null && internalMW !== null ? loadMW - internalMW : null;
    const vacuum = val(fields, 'stg.vacuum');
    const thrust = val(fields, 'stg.thrustBearing');
    // Rentang normal mengikuti keterangan parameter di logsheet APM (Panel Turbin).
    const vacuumNormal = vacuum === null || (vacuum >= -0.09 && vacuum <= -0.06);
    const thrustNormal = thrust === null || thrust <= 100;
    const lebar = (v: number | null, maks: number) => `${v === null ? 0 : Math.min(100, Math.max(0, (Math.abs(v) / maks) * 100))}%`;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                        <span className="material-symbols-outlined text-primary">settings_motion_mode</span>
                    </div>
                    <h3 className="text-white text-xl font-bold tracking-tight">STG Overview</h3>
                </div>
                {loadMW !== null && loadMW > 0 ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-emerald-400 font-bold tracking-wider text-xs">SYNCHRONIZED</span>
                    </div>
                ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-500/10 border border-slate-500/20 rounded-full">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
                        <span className="text-slate-400 font-bold tracking-wider text-xs">{loadMW === null ? 'NO DATA' : 'OFFLINE'}</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Generator Load */}
                <div className="bg-surface-dark p-6 rounded-2xl border border-slate-700/50 hover:border-primary/50 flex flex-col justify-center relative overflow-hidden group transition-all duration-300 hover:shadow-[0_8px_30px_rgba(43,124,238,0.15)] hover:-translate-y-1 cursor-default">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '120px' }}>electric_bolt</span>
                    </div>
                    <p className="text-xs text-text-secondary font-bold uppercase tracking-widest mb-2 z-10">Generator Load</p>
                    <div className="flex items-baseline gap-2 z-10">
                        <p className="text-7xl font-black text-white tracking-tighter drop-shadow-[0_0_35px_rgba(43,124,238,0.6)]">{fmt(loadMW, 1)}</p>
                        <span className="text-3xl font-bold text-primary">MW</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 z-10">
                        <span className="material-symbols-outlined text-sm text-text-secondary">show_chart</span>
                        <span className="text-sm font-mono text-text-secondary">{fmt(val(fields, 'stg.frequency'), 2)} Hz</span>
                        <span className="text-xs text-text-secondary/60 ml-1">Frequency</span>
                    </div>
                </div>

                {/* Internal Power & Export Power */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-surface-dark p-5 rounded-xl border border-slate-800 flex items-center justify-between hover:border-primary/40 hover:bg-surface-highlight transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-default">
                        <div>
                            <div className="flex items-center gap-2 mb-1 text-primary">
                                <span className="material-symbols-outlined text-lg">factory</span>
                                <span className="text-xs font-bold uppercase tracking-wide">Power Internal UBB</span>
                            </div>
                            <p className="text-3xl font-bold text-white">{fmt(internalMW, 1)} <span className="text-sm font-normal text-slate-400">MW</span></p>
                        </div>
                    </div>
                    <div className="bg-surface-dark p-5 rounded-xl border border-slate-800 flex items-center justify-between hover:border-blue-400/40 hover:bg-surface-highlight transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-default">
                        <div>
                            <div className="flex items-center gap-2 mb-1 text-blue-400">
                                <span className="material-symbols-outlined text-lg">electric_bolt</span>
                                <span className="text-xs font-bold uppercase tracking-wide">Export UBB</span>
                            </div>
                            <p className="text-3xl font-bold text-white">{fmt(exportMW, 1)} <span className="text-sm font-normal text-slate-400">MW</span></p>
                        </div>
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
                        <p className="text-3xl font-bold text-white">{fmt(vacuum, 3)} <span className="text-sm font-normal text-slate-400">Mpa</span></p>
                        <div className="flex flex-col items-end gap-1">
                            <div className="w-24 bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full" style={{ width: lebar(vacuum, 0.1) }}></div>
                            </div>
                            <span className={`text-[10px] ${vacuumNormal ? 'text-text-secondary' : 'text-red-400 font-bold'}`}>
                                {vacuumNormal ? 'Normal −0.06 s/d −0.09' : 'Di Luar Normal'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="bg-surface-dark p-5 rounded-xl border border-slate-800 hover:border-red-400/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-400/5 cursor-default">
                    <div className="flex items-center gap-2 mb-2 text-red-400">
                        <span className="material-symbols-outlined text-lg">precision_manufacturing</span>
                        <span className="text-xs font-bold uppercase tracking-wide">Thrust Bearing</span>
                    </div>
                    <div className="flex items-end justify-between">
                        <p className="text-3xl font-bold text-white">{fmt(thrust, 0)} <span className="text-sm font-normal text-slate-400">°C</span></p>
                        <div className="flex flex-col items-end gap-1">
                            <div className="w-24 bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full" style={{ width: lebar(thrust, 100) }}></div>
                            </div>
                            <span className={`text-[10px] ${thrustNormal ? 'text-text-secondary' : 'text-red-400 font-bold'}`}>
                                {thrustNormal ? 'Maks 100 °C' : 'Di Atas Batas'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Distribusi Steam ───
function SteamDistribution({ fields }: { fields: Fields | undefined }) {
    const factories = [
        { name: 'Pabrik 1', flow: val(fields, 'stg.pabrik1Flow'), color: 'text-purple-400' },
        { name: 'Pabrik 3', flow: val(fields, 'stg.pabrik3Flow'), color: 'text-orange-400' },
        { name: 'Inlet Turbin', flow: val(fields, 'stg.steamInletFlow'), color: 'text-cyan-400' },
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
                            <p className="text-3xl font-black text-white">{fmt(f.flow, 1)} <span className="text-base font-normal text-slate-400">t/h</span></p>
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

// ─── Quick Stat ───
function Trend({ delta, unit }: { delta: number | null; unit: string }) {
    if (delta === null) return null;
    const naik = delta >= 0;
    return (
        <div className={`flex items-center text-sm font-medium ${naik ? 'text-emerald-500' : 'text-rose-500'}`}>
            <span className="material-symbols-outlined text-base">{naik ? 'trending_up' : 'trending_down'}</span>
            <span>{naik ? '+' : ''}{delta.toFixed(1)} {unit}</span>
        </div>
    );
}

// ─── Dashboard Page ───
export default function DashboardPage() {
    // Fitur nonaktif sementara — komponen asli tidak di-mount (0 query DB).
    if (DISABLED_FEATURES.dashboard) return <FeatureDisabled name="Dashboard" />;
    return <DashboardPageInner />;
}

function DashboardPageInner() {
    const { operator, loading } = useOperator();
    const router = useRouter();
    const currentShift = getCurrentShift();
    const [data, setData] = useState<ApmDashboardData | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/dashboard/apm', { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            setData(json as ApmDashboardData);
            setLoadError(null);
        } catch (e) {
            setLoadError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    useEffect(() => {
        // Operator dibaca dari localStorage setelah mount — jangan mengusir ke login
        // sebelum itu selesai (dulu halaman ini selalu terpental ke /home).
        if (loading) return;
        if (!operator) {
            router.replace('/?next=/dashboard');
            return;
        }
        load();
        const timer = setInterval(load, POLL_MS);
        return () => clearInterval(timer);
    }, [loading, operator, router, load]);

    const refresh = async () => {
        setRefreshing(true);
        setRefreshError(null);
        try {
            const res = await fetch('/api/dashboard/apm', { method: 'POST' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) setRefreshError(json.error ?? `HTTP ${res.status}`);
            await load();
        } catch (e) {
            setRefreshError(e instanceof Error ? e.message : String(e));
        } finally {
            setRefreshing(false);
        }
    };

    if (!operator) return null;

    const now = Date.now();
    const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
    const shiftLabel = currentShift === 1 ? 'Pagi' : currentShift === 2 ? 'Sore' : 'Malam';
    const fields = data?.fields;
    const steam = total(fields, ['A.steamFlow', 'B.steamFlow']);
    const coal = total(fields, ['A.feeder1', 'A.feeder2', 'A.feeder3', 'B.feeder1', 'B.feeder2', 'B.feeder3']);

    const peringatan: string[] = [];
    if (loadError) peringatan.push(`Gagal memuat data dashboard: ${loadError}`);
    if (refreshError) peringatan.push(`Refresh gagal: ${refreshError}`);
    if (data) {
        if (data.lastError) peringatan.push(`Sync APM terakhir gagal: ${data.lastError}`);
        if (!data.syncedAt) peringatan.push('Data belum pernah diambil dari APM.');
        else if (now - Date.parse(data.syncedAt) > SYNC_STALE_MS) {
            peringatan.push(`Sync APM terakhir berhasil ${tanggalPendekWIB(data.syncedAt)} ${jamWIB(data.syncedAt)} — lebih dari 2 jam lalu.`);
        }
        if (data.lastSlot && now - Date.parse(data.lastSlot) > SLOT_STALE_MS) {
            peringatan.push(`Slot logsheet terbaru ${tanggalPendekWIB(data.lastSlot)} ${jamWIB(data.lastSlot)} — logsheet APM mungkin belum diisi.`);
        }
    }

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
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        <span className="text-sm font-medium">Sumber: E-Logsheet APM</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Last Data Update (Tank Level Style) */}
                    <div className="bg-primary/10 border border-primary/50 rounded-2xl px-5 py-2.5 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(43,124,238,0.2)] relative overflow-hidden group min-w-[170px]">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent pointer-events-none" />
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-700 animate-pulse pointer-events-none" />
                        <span className="text-[10px] uppercase font-black text-primary tracking-[0.2em] relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">Last Data Update</span>
                        <div className="flex items-center gap-2 mt-1 relative z-10">
                            <span className="material-symbols-outlined text-primary text-2xl drop-shadow-[0_0_15px_rgba(43,124,238,0.8)]">schedule</span>
                            <span className="text-3xl font-black font-mono text-white tracking-widest leading-none drop-shadow-[0_0_30px_rgba(43,124,238,0.5)]">
                                {data?.lastSlot ? jamWIB(data.lastSlot) : '--:--'}
                            </span>
                        </div>
                        <span className="text-[10px] text-text-secondary mt-1 relative z-10">
                            {data?.lastSlot ? `Slot ${tanggalPendekWIB(data.lastSlot)}` : 'Belum ada data'}
                            {data?.syncedAt ? ` · sync ${jamWIB(data.syncedAt)}` : ''}
                        </span>
                    </div>

                    <button
                        onClick={refresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-wait text-white px-5 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 cursor-pointer h-full"
                    >
                        <span className={`material-symbols-outlined text-base ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
                        {refreshing ? 'Mengambil…' : 'Refresh'}
                    </button>
                </div>
            </header>

            {peringatan.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl px-5 py-3 flex gap-3 text-amber-200 text-sm">
                    <span className="material-symbols-outlined text-amber-400">warning</span>
                    <ul className="space-y-1">
                        {peringatan.map(p => <li key={p}>{p}</li>)}
                    </ul>
                </div>
            )}

            {/* Boiler A & B */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BoilerCard name="A" data={boilerView(fields, 'A')} />
                <BoilerCard name="B" data={boilerView(fields, 'B')} />
            </div>

            {/* STG + Steam Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <STGCard fields={fields} />
                </div>
                <SteamDistribution fields={fields} />
            </div>

            {/* Quick Stats + Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="bg-surface-dark border border-slate-800 hover:border-emerald-500/30 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5 cursor-default">
                    <p className="text-sm font-medium text-text-secondary">Total Steam Flow</p>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-bold text-white">{fmt(steam.value, 1)} t/h</span>
                        <Trend delta={steam.delta} unit="t/h" />
                    </div>
                </div>
                <div className="bg-surface-dark border border-slate-800 hover:border-rose-500/30 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-rose-500/5 cursor-default">
                    <p className="text-sm font-medium text-text-secondary">Consumption Rate</p>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-bold text-white">{fmt(coal.value, 1)} t/h</span>
                        <Trend delta={coal.delta} unit="t/h" />
                    </div>
                </div>
                <div className="lg:col-span-2 bg-surface-dark border border-slate-800 hover:border-slate-600 rounded-xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <p className="text-sm font-medium text-text-secondary mb-3">Quick Actions</p>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => router.push('/input-laporan')} className="flex-1 min-w-[140px] bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/40 hover:border-primary px-4 py-3 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5">
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
                <p className="text-slate-500 text-xs">© 2023 Web Utilitas Batubara. All systems operational.</p>
            </footer>
        </div>
    );
}
