'use client';
import React from 'react';
import { InputField, Card, CalculatedField, SectionLabel } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

const n = (v: number | string | null | undefined) => Number(v) || 0;
const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

function KonsumsiTotalizer({ label, name, value, prevValue, onChange }: {
    label: string;
    name: string;
    value: number | string | null;
    prevValue: number;
    onChange: (name: string, value: number | string | null) => void;
}) {
    const cur = n(value);
    const selisih = prevValue > 0 ? cur - prevValue : null;
    return (
        <div>
            <InputField label={label} name={name} value={value as number | null} onChange={onChange} unit="" color="emerald" />
            {prevValue > 0 && (
                <div className="mt-1 text-[10px] text-slate-500 space-y-0.5">
                    <p>Prev: <span className="text-slate-400 font-medium">{fmt(prevValue)}</span></p>
                    {selisih !== null && (
                        <p>Konsumsi: <span className={`font-bold ${selisih >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{selisih >= 0 ? '+' : ''}{fmt(selisih)}</span></p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function TabHandling({
    stockTank, totalizer,
    prevTotalizer,
    onStockTankChange, onTotalizerChange,
    solarUnloadings = [],
    solarUsages = [],
    onDeleteSolarUnloading,
    onDeleteSolarUsage,
}: DailyTabProps) {

    const konsumsiRows = [
        { label: 'RCW 1A', name: 'tot_rcw_1a' },
        { label: 'Demin', name: 'tot_demin' },
        { label: 'Demin PB1', name: 'tot_demin_pb1' },
        { label: 'Demin PB3', name: 'tot_demin_pb3' },
        { label: 'Hydrant', name: 'tot_hydrant' },
        { label: 'Basin', name: 'tot_basin' },
        { label: 'Service', name: 'tot_service' },
    ];

    const selisih = (name: string) => {
        const cur = n(totalizer[name]);
        const prev = prevTotalizer ? n(prevTotalizer[name]) : 0;
        return prev > 0 ? cur - prev : null;
    };

    const konsHydrant = selisih('tot_hydrant');
    const konsBasin = selisih('tot_basin');
    const konsService = selisih('tot_service');
    const konsHarianRCW = (konsHydrant ?? 0) + (konsBasin ?? 0) + (konsService ?? 0);
    const hasRCWKons = konsHydrant !== null || konsBasin !== null || konsService !== null;

    // Solar summary
    const totalKedatangan = solarUnloadings.reduce((s, e) => s + e.liters, 0);
    const totalPermintaan = solarUsages.reduce((s, e) => s + e.liters, 0);
    const bengkelTotal = solarUsages.filter(e => e.tujuan === 'Bengkel').reduce((s, e) => s + e.liters, 0);
    const sasuTotal = solarUsages.filter(e => e.tujuan === 'SA/SU 3B').reduce((s, e) => s + e.liters, 0);
    const boilerUsage = n(stockTank.solar_boiler);

    const shiftLabel: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Tankyard ═══ */}
            <Card title="Tankyard" icon="water_drop" color="blue">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Level RCW" name="rcw_level_00" value={stockTank.rcw_level_00} onChange={onStockTankChange} unit="m³" color="blue" />
                    <InputField label="Level Demin" name="demin_level_00" value={stockTank.demin_level_00} onChange={onStockTankChange} unit="m³" color="blue" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Tank Solar A" name="solar_tank_a" value={stockTank.solar_tank_a} onChange={onStockTankChange} unit="m³" color="orange" />
                    <InputField label="Tank Solar B" name="solar_tank_b" value={stockTank.solar_tank_b} onChange={onStockTankChange} unit="m³" color="orange" />
                </div>
                <InputField label="Pemakaian Solar Boiler A+B" name="solar_boiler" value={stockTank.solar_boiler} onChange={onStockTankChange} unit="m³" color="orange" />
            </Card>

            {/* ═══ Konsumsi & Penerimaan ═══ */}
            <Card title="Konsumsi & Penerimaan" icon="swap_vert" color="emerald">
                <p className="text-[10px] text-slate-500 -mt-1 mb-2">Input totalizer — konsumsi dihitung otomatis (selisih hari ini − kemarin)</p>

                <div className="grid grid-cols-2 gap-4">
                    <KonsumsiTotalizer label="RCW 1A" name="tot_rcw_1a" value={totalizer.tot_rcw_1a ?? null} prevValue={prevTotalizer ? n(prevTotalizer.tot_rcw_1a) : 0} onChange={onTotalizerChange} />
                    <KonsumsiTotalizer label="Demin" name="tot_demin" value={totalizer.tot_demin ?? null} prevValue={prevTotalizer ? n(prevTotalizer.tot_demin) : 0} onChange={onTotalizerChange} />
                    <KonsumsiTotalizer label="Demin PB1" name="tot_demin_pb1" value={totalizer.tot_demin_pb1 ?? null} prevValue={prevTotalizer ? n(prevTotalizer.tot_demin_pb1) : 0} onChange={onTotalizerChange} />
                    <KonsumsiTotalizer label="Demin PB3" name="tot_demin_pb3" value={totalizer.tot_demin_pb3 ?? null} prevValue={prevTotalizer ? n(prevTotalizer.tot_demin_pb3) : 0} onChange={onTotalizerChange} />
                    <KonsumsiTotalizer label="Hydrant" name="tot_hydrant" value={totalizer.tot_hydrant ?? null} prevValue={prevTotalizer ? n(prevTotalizer.tot_hydrant) : 0} onChange={onTotalizerChange} />
                    <KonsumsiTotalizer label="Basin" name="tot_basin" value={totalizer.tot_basin ?? null} prevValue={prevTotalizer ? n(prevTotalizer.tot_basin) : 0} onChange={onTotalizerChange} />
                </div>
                <KonsumsiTotalizer label="Service" name="tot_service" value={totalizer.tot_service ?? null} prevValue={prevTotalizer ? n(prevTotalizer.tot_service) : 0} onChange={onTotalizerChange} />

                <div className="mt-4">
                    <SectionLabel label="Rekap Konsumsi" badge="selisih hari ini − kemarin" />
                    <div className="rounded-lg border border-slate-700/60 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#101822]/70 text-[10px] uppercase tracking-wider text-slate-400">
                                    <th className="text-left py-2 px-3 font-medium">Parameter</th>
                                    <th className="text-right py-2 px-3 font-medium">Kemarin</th>
                                    <th className="text-right py-2 px-3 font-medium">Hari Ini</th>
                                    <th className="text-right py-2 px-3 font-medium">Konsumsi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/40">
                                {konsumsiRows.map(({ label, name }) => {
                                    const cur = n(totalizer[name]);
                                    const prev = prevTotalizer ? n(prevTotalizer[name]) : 0;
                                    const diff = prev > 0 ? cur - prev : null;
                                    return (
                                        <tr key={name} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="py-1.5 px-3 text-slate-300 font-medium">{label}</td>
                                            <td className="py-1.5 px-3 text-right font-mono text-slate-400">{prev > 0 ? fmt(prev) : '—'}</td>
                                            <td className="py-1.5 px-3 text-right font-mono text-white">{cur > 0 ? fmt(cur) : '—'}</td>
                                            <td className={`py-1.5 px-3 text-right font-mono font-bold ${diff !== null ? (diff >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'}`}>
                                                {diff !== null ? (diff >= 0 ? '+' : '') + fmt(diff) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {hasRCWKons && (
                                <tfoot>
                                    <tr className="bg-emerald-500/10 border-t border-emerald-500/30">
                                        <td colSpan={3} className="py-2 px-3 text-emerald-300 font-semibold text-xs">Konsumsi Harian RCW (Hydrant + Basin + Service)</td>
                                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">{fmt(konsHarianRCW)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </Card>

            {/* ═══ Summary Solar ═══ */}
            <Card title="Summary Solar" icon="summarize" color="amber" className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Kedatangan Solar */}
                    <div>
                        <SectionLabel label="Kedatangan Solar" badge={`${solarUnloadings.length} entri · ${totalKedatangan.toLocaleString('id-ID')} L`} />
                        {solarUnloadings.length > 0 ? (
                            <div className="space-y-2">
                                {solarUnloadings.map((item) => (
                                    <div key={item.id ?? item.supplier + item.liters} className="relative flex items-center justify-between bg-[#101822]/50 border border-amber-500/30 rounded-lg px-3 py-2 pr-9">
                                        <div className="flex items-center gap-3">
                                            <span className="material-symbols-outlined text-amber-400 text-[16px]">local_shipping</span>
                                            <div>
                                                <p className="text-white font-medium text-sm">{item.liters.toLocaleString('id-ID')} <span className="text-amber-400 text-xs">Liter</span></p>
                                                <p className="text-[10px] text-slate-400">{item.supplier}</p>
                                            </div>
                                        </div>
                                        {item.id && onDeleteSolarUnloading && (
                                            <button type="button" onClick={() => onDeleteSolarUnloading(item.id!)}
                                                className="absolute top-1/2 -translate-y-1/2 right-1.5 w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-500 italic">Belum ada data kedatangan solar hari ini</p>
                        )}
                    </div>

                    {/* Permintaan Solar */}
                    <div>
                        <SectionLabel label="Permintaan Solar" badge={`${solarUsages.length} entri · ${totalPermintaan.toLocaleString('id-ID')} L`} />
                        {solarUsages.length > 0 ? (
                            <div className="space-y-2">
                                {solarUsages.map((item) => (
                                    <div key={item.id ?? item.tujuan + item.liters} className="relative flex items-center justify-between bg-[#101822]/50 border border-rose-500/30 rounded-lg px-3 py-2 pr-9">
                                        <div className="flex items-center gap-3">
                                            <span className="material-symbols-outlined text-rose-400 text-[16px]">upload</span>
                                            <div>
                                                <p className="text-white font-medium text-sm">{item.liters.toLocaleString('id-ID')} <span className="text-rose-400 text-xs">Liter</span></p>
                                                <p className="text-[10px] text-slate-400">{item.tujuan} · {shiftLabel[item.shift] ?? item.shift}</p>
                                            </div>
                                        </div>
                                        {item.id && onDeleteSolarUsage && (
                                            <button type="button" onClick={() => onDeleteSolarUsage(item.id!)}
                                                className="absolute top-1/2 -translate-y-1/2 right-1.5 w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-500 italic">Belum ada data permintaan solar hari ini</p>
                        )}
                    </div>
                </div>

                {/* Penggunaan Solar Summary */}
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <SectionLabel label="Penggunaan Solar Harian" />
                    <div className="grid grid-cols-3 gap-3">
                        <CalculatedField label="BOILER A+B" value={fmt(boilerUsage)} unit="m³" variant="primary" />
                        <CalculatedField label="BENGKEL" value={fmt(bengkelTotal / 1000)} unit="m³" variant="secondary" />
                        <CalculatedField label="SA/SU 3B" value={fmt(sasuTotal / 1000)} unit="m³" variant="secondary" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">Bengkel & SA/SU 3B dihitung dari total permintaan solar per tujuan (Liter → m³ ÷ 1000)</p>
                </div>
            </Card>

        </div>
    );
}
