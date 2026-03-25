'use client';
import React from 'react';
import { InputField, Card, SectionLabel } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

export default function TabSiloFlyAsh({ stockTank, onStockTankChange, ashUnloadings }: DailyTabProps) {
    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            <Card title="Silo & Fly Ash" icon="filter_alt" color="emerald">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Silo A (Data Aktual)" name="silo_a_pct" value={stockTank.silo_a_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                    <InputField label="Silo B (Data Aktual)" name="silo_b_pct" value={stockTank.silo_b_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                    <InputField label="Unloading Fly Ash A" name="unloading_fly_ash_a" value={stockTank.unloading_fly_ash_a} onChange={onStockTankChange} unit="Silo A" color="emerald" />
                    <InputField label="Unloading Fly Ash B" name="unloading_fly_ash_b" value={stockTank.unloading_fly_ash_b} onChange={onStockTankChange} unit="Silo B" color="emerald" />
                </div>

                <SectionLabel label="Aktivitas Unloading Fly Ash (Data Shift)" badge="Auto Rekap" />
                {ashUnloadings && ashUnloadings.length > 0 ? (
                    <div className="space-y-2">
                        {ashUnloadings.map((item, i) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#101822]/50 border border-slate-700/60 rounded-lg px-3 py-2 text-sm gap-2">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-emerald-400 text-[18px]">local_shipping</span>
                                    <div>
                                        <p className="text-white font-medium capitalize">Shift {item.shift} — {item.silo}</p>
                                        <p className="text-[11px] text-slate-400">{item.perusahaan} (Tujuan: {item.tujuan})</p>
                                    </div>
                                </div>
                                <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded text-emerald-400 font-bold whitespace-nowrap self-start sm:self-auto text-xs">
                                    {item.ritase} Rit
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[11px] text-slate-500 italic">Belum ada data unloading fly ash dari laporan shift hari ini</p>
                )}
            </Card>
        </div>
    );
}
