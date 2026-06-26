'use client';
import React from 'react';
import { Card, InputField } from '@/components/input-shift/SharedComponents';
import { SolarOriginBadge } from './SolarOriginBadge';
import type { SolarReviewProps, SolarUnloadingEntry, SolarUsageEntry } from './types';

const n = (v: number | string | null | undefined) => Number(v) || 0;
const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');
const numOrNull = (v: number | string | null | undefined) => (v == null || v === '' ? null : Number(v));

/** Daftar entri kedatangan (read-only) dengan badge asal — mirip kartu Summary di TabHandling. */
function UnloadingList({ items }: { items: SolarUnloadingEntry[] }) {
    if (items.length === 0) return <p className="text-[11px] text-slate-500 italic">Belum ada entri kedatangan.</p>;
    return (
        <div className="space-y-2">
            {items.map((item, i) => (
                <div key={item.id ?? i} className="flex items-center gap-2 bg-[#101822]/50 border border-amber-500/30 rounded-lg px-3 py-2 min-w-0">
                    <span className="material-symbols-outlined text-amber-400 text-[15px]">local_shipping</span>
                    <span className="text-white font-medium text-sm">{n(item.liters).toLocaleString('id-ID')} <span className="text-amber-400 text-xs">L</span></span>
                    <SolarOriginBadge shift={item.shift} />
                    <span className="text-[10px] text-slate-400 truncate">{item.supplier}</span>
                </div>
            ))}
        </div>
    );
}

/** Daftar entri permintaan (read-only) dengan badge asal. */
function UsageList({ items }: { items: SolarUsageEntry[] }) {
    if (items.length === 0) return <p className="text-[11px] text-slate-500 italic">Belum ada entri permintaan.</p>;
    return (
        <div className="space-y-2">
            {items.map((item, i) => (
                <div key={item.id ?? i} className="flex items-center gap-2 bg-[#101822]/50 border border-rose-500/30 rounded-lg px-3 py-2 min-w-0">
                    <span className="material-symbols-outlined text-rose-400 text-[15px]">upload</span>
                    <span className="text-white font-medium text-sm">{n(item.liters).toLocaleString('id-ID')} <span className="text-rose-400 text-xs">L</span></span>
                    <SolarOriginBadge shift={item.shift} />
                    <span className="text-[10px] text-slate-400 truncate">{item.tujuan}</span>
                </div>
            ))}
        </div>
    );
}

/** Review Solar (supervisor) — form ringkas (m³) + detail entri:
 *  - Level sekarang (input) & level kemarin (display)
 *  - Kedatangan: total m³ (input, prefill agregat) + daftar entri detail
 *  - Pemakaian: Boiler A+B / Bengkel / SA·SU 3B (input) + daftar entri permintaan detail
 *  Nilai m³ di-prefill dari kolom daily_report_stock_tank atau agregat entri operator. */
export default function TabSolarReview({
    solarUnloadings = [], solarUsages = [],
    solarLevel = null, prevSolarLevel = null,
    kedatangan = null, boilerAB = null, bengkel = null, sasu = null,
    onLevelChange, onValueChange,
}: SolarReviewProps) {
    const levelKemarin = prevSolarLevel != null ? n(prevSolarLevel) : null;

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Level Solar ═══ */}
            <Card title="Level Solar" icon="water_drop" color="orange">
                <div className="grid grid-cols-2 gap-3 items-end">
                    <div className="rounded-lg border border-slate-700/40 bg-[#101822]/40 px-3 py-2.5">
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">Level Kemarin</p>
                        <p className="text-lg font-mono font-bold text-slate-300">{levelKemarin != null ? fmt(levelKemarin) : '—'} <span className="text-[10px] text-slate-500">m³</span></p>
                    </div>
                    <InputField label="Level Sekarang" name="solar_tank_a" value={solarLevel} unit="m³" color="orange"
                        onChange={(_, v) => onLevelChange?.(numOrNull(v))} />
                </div>
            </Card>

            {/* ═══ Kedatangan Solar (total + detail) ═══ */}
            <Card title="Kedatangan Solar" icon="local_shipping" color="amber">
                <InputField label="Total Kedatangan (m³)" name="kedatangan_solar" value={kedatangan} unit="m³" color="amber"
                    onChange={(_, v) => onValueChange?.('kedatangan_solar', numOrNull(v))} />
                <p className="-mt-1 text-[10px] text-slate-500">Otomatis dari kedatangan laporan shift/harian — bisa dikoreksi. → kolom Sheets CK.</p>
                <div className="pt-2 mt-1 border-t border-slate-700/50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Detail Entri</p>
                    <UnloadingList items={solarUnloadings} />
                </div>
            </Card>

            {/* ═══ Pemakaian Solar (total per tujuan + detail) ═══ */}
            <Card title="Pemakaian Solar" icon="local_gas_station" color="rose" className="lg:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <InputField label="Boiler A+B" name="solar_boiler" value={boilerAB} unit="m³" color="rose"
                        onChange={(_, v) => onValueChange?.('solar_boiler', numOrNull(v))} />
                    <InputField label="Bengkel" name="solar_bengkel" value={bengkel} unit="m³" color="rose"
                        onChange={(_, v) => onValueChange?.('solar_bengkel', numOrNull(v))} />
                    <InputField label="SA/SU 3B" name="solar_3b" value={sasu} unit="m³" color="rose"
                        onChange={(_, v) => onValueChange?.('solar_3b', numOrNull(v))} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">Boiler A+B → CL, Bengkel → CM, SA/SU 3B → CN. Semua m³, diisi/dikoreksi supervisor.</p>
                <div className="pt-3 mt-1 border-t border-slate-700/50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Detail Entri Permintaan</p>
                    <UsageList items={solarUsages} />
                </div>
            </Card>
        </div>
    );
}
