'use client';
import React from 'react';
import { Card, InputField } from '@/components/input-shift/SharedComponents';
import type { SolarReviewProps } from './types';

const n = (v: number | string | null | undefined) => Number(v) || 0;
const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');
const numOrNull = (v: number | string | null | undefined) => (v == null || v === '' ? null : Number(v));

/** Review Solar (supervisor) — form ringkas, semua dalam m³:
 *  - Level sekarang (input) & level kemarin (display)
 *  - Kedatangan solar (input)
 *  - Pemakaian: Boiler A+B / Bengkel / SA/SU 3B (input)
 *  Nilai di-prefill dari kolom daily_report_stock_tank atau agregat entri operator
 *  (laporan shift / harian); supervisor bisa meninjau & mengoreksi. */
export default function TabSolarReview({
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

            {/* ═══ Kedatangan Solar ═══ */}
            <Card title="Kedatangan Solar" icon="local_shipping" color="amber">
                <InputField label="Kedatangan Hari Ini" name="kedatangan_solar" value={kedatangan} unit="m³" color="amber"
                    onChange={(_, v) => onValueChange?.('kedatangan_solar', numOrNull(v))} />
                <p className="-mt-1 text-[10px] text-slate-500">Otomatis dari kedatangan solar laporan shift/harian — bisa dikoreksi. → kolom Sheets CK.</p>
            </Card>

            {/* ═══ Pemakaian Solar ═══ */}
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
            </Card>
        </div>
    );
}
