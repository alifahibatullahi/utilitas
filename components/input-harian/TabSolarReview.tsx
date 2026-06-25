'use client';
import React from 'react';
import { Card, InputField } from '@/components/input-shift/SharedComponents';
import type { SolarReviewProps } from './types';

const n = (v: number | string | null | undefined) => Number(v) || 0;
const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

/** Tile angka m³ (display read-only). Di module scope agar tidak dibuat ulang tiap render. */
function Tile({ label, value, accent }: { label: string; value: number | null; accent?: string }) {
    return (
        <div className="rounded-lg border border-slate-700/40 bg-[#101822]/40 px-3 py-2.5">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">{label}</p>
            <p className={`text-lg font-mono font-bold ${accent ?? 'text-slate-200'}`}>
                {value != null ? fmt(value) : '—'} <span className="text-[10px] text-slate-500">m³</span>
            </p>
        </div>
    );
}

/** Review Solar (supervisor) — ringkas, semua dalam m³:
 *  - Level sekarang (input) & level kemarin (display)
 *  - Kedatangan solar (agregat operator)
 *  - Pemakaian: Boiler A+B (manual supervisor), Bengkel, SA/SU 3B (agregat operator)
 *  Entri solar disimpan dalam Liter → ditampilkan m³ (÷1000). */
export default function TabSolarReview({
    solarUnloadings = [], solarUsages = [],
    solarLevel = null, prevSolarLevel = null,
    boilerAB = null, canEditBoilerAB = false,
    onLevelChange, onBoilerABChange,
}: SolarReviewProps) {
    const kedatanganM3 = solarUnloadings.reduce((s, e) => s + n(e.liters), 0) / 1000;
    const bengkelM3 = solarUsages.filter(e => e.tujuan === 'Bengkel').reduce((s, e) => s + n(e.liters), 0) / 1000;
    const sasuM3 = solarUsages.filter(e => e.tujuan === 'SA/SU 3B').reduce((s, e) => s + n(e.liters), 0) / 1000;
    const levelKemarin = prevSolarLevel != null ? n(prevSolarLevel) : null;

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Level Solar ═══ */}
            <Card title="Level Solar" icon="water_drop" color="orange">
                <div className="grid grid-cols-2 gap-3 items-end">
                    <Tile label="Level Kemarin" value={levelKemarin} accent="text-slate-300" />
                    <InputField label="Level Sekarang" name="solar_tank_a" value={solarLevel} unit="m³" color="orange"
                        onChange={(_, v) => onLevelChange?.(v == null || v === '' ? null : Number(v))} />
                </div>
            </Card>

            {/* ═══ Kedatangan Solar ═══ */}
            <Card title="Kedatangan Solar" icon="local_shipping" color="amber">
                <Tile label="Kedatangan Hari Ini" value={kedatanganM3} accent="text-amber-300" />
            </Card>

            {/* ═══ Pemakaian Solar ═══ */}
            <Card title="Pemakaian Solar" icon="local_gas_station" color="rose" className="lg:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {canEditBoilerAB ? (
                        <div>
                            <InputField label="Boiler A+B" name="solar_boiler" value={boilerAB} unit="m³" color="rose"
                                onChange={(_, v) => onBoilerABChange?.(v == null || v === '' ? null : Number(v))} />
                            <p className="mt-1 text-[10px] text-slate-500">Diisi manual oleh supervisor → kolom Sheets CL.</p>
                        </div>
                    ) : (
                        <Tile label="Boiler A+B" value={boilerAB != null ? n(boilerAB) : null} accent="text-rose-300" />
                    )}
                    <Tile label="Bengkel" value={bengkelM3} accent="text-slate-200" />
                    <Tile label="SA/SU 3B" value={sasuM3} accent="text-slate-200" />
                </div>
            </Card>
        </div>
    );
}
