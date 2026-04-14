'use client';
import React, { useState } from 'react';
import { InputField, Card, CalculatedField, SectionLabel, SelisihInfo } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

const n = (v: number | string | null | undefined) => Number(v) || 0;
const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

type EditUnloading = { open: boolean; liters: number; supplier: string };
type EditUsage = { open: boolean; liters: number; tujuan: string; shift: string; tujuanMode: 'Bengkel' | 'SA/SU 3B' | 'Lainnya' };

export default function TabHandling({
    stockTank, totalizer,
    prevTotalizer,
    onStockTankChange, onTotalizerChange,
    solarUnloadings = [],
    solarUsages = [],
    onDeleteSolarUnloading,
    onDeleteSolarUsage,
    onEditSolarUnloading,
    onEditSolarUsage,
}: DailyTabProps) {
    const [editUn, setEditUn] = useState<Record<string, EditUnloading>>({});
    const [editUs, setEditUs] = useState<Record<string, EditUsage>>({});

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
                <InputField label="Level Tank Solar" name="solar_tank_a" value={stockTank.solar_tank_a} onChange={onStockTankChange} unit="m³" color="orange" />
                <InputField label="Pemakaian Solar Boiler A+B" name="solar_boiler" value={stockTank.solar_boiler} onChange={onStockTankChange} unit="m³" color="orange" />
            </Card>

            {/* ═══ Konsumsi & Penerimaan ═══ */}
            <Card title="Konsumsi & Penerimaan" icon="swap_vert" color="emerald">
                <p className="text-[10px] text-slate-500 -mt-1 mb-2">Input totalizer — konsumsi dihitung otomatis (selisih hari ini − kemarin)</p>

                <div className="grid grid-cols-2 gap-4">
                    {konsumsiRows.slice(0, 6).map(({ label, name }) => (
                        <div key={name}>
                            <InputField label={label} name={name} value={totalizer[name] as number | null} onChange={onTotalizerChange} unit="" color="emerald" thousands placeholder={prevTotalizer?.[name] != null ? String(n(prevTotalizer[name])) : '0.0'} />
                            <SelisihInfo prev={prevTotalizer ? n(prevTotalizer[name]) : 0} current={n(totalizer[name])} />
                        </div>
                    ))}
                </div>
                <div>
                    <InputField label="Service" name="tot_service" value={totalizer.tot_service as number | null} onChange={onTotalizerChange} unit="" color="emerald" thousands placeholder={prevTotalizer?.tot_service != null ? String(n(prevTotalizer.tot_service)) : '0.0'} />
                    <SelisihInfo prev={prevTotalizer ? n(prevTotalizer.tot_service) : 0} current={n(totalizer.tot_service)} />
                </div>
            </Card>

            {/* ═══ Summary ═══ */}
            <Card title="Summary" icon="summarize" color="amber" className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Rekap Konsumsi */}
                    <div>
                        <SectionLabel label="Rekap Konsumsi" badge="selisih hari ini − kemarin" />
                        <div className="rounded-lg border border-slate-700/60 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[#101822]/70 text-[10px] uppercase tracking-wider text-slate-400">
                                        <th className="text-left py-2 px-3 font-medium">Parameter</th>
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
                                                <td className={`py-1.5 px-3 text-right font-mono font-bold ${diff !== null ? (diff >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'}`}>
                                                    {diff !== null ? fmt(diff) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {hasRCWKons && (
                                    <tfoot>
                                        <tr className="bg-emerald-500/10 border-t border-emerald-500/30">
                                            <td className="py-2 px-3 text-emerald-300 font-semibold text-xs">RCW (Hydrant + Basin + Service)</td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">{fmt(konsHarianRCW)}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    {/* Kedatangan & Permintaan Solar */}
                    <div className="space-y-4">
                        {/* ─ Kedatangan ─ */}
                        <div>
                            <SectionLabel label="Kedatangan Solar" badge={`${solarUnloadings.length} entri · ${totalKedatangan.toLocaleString('id-ID')} L`} />
                            {solarUnloadings.length > 0 ? (
                                <div className="space-y-2">
                                    {solarUnloadings.map((item) => {
                                        const id = item.id ?? (item.supplier + item.liters);
                                        const es = editUn[id];
                                        const isEditing = es?.open ?? false;
                                        return (
                                            <div key={id} className="bg-[#101822]/50 border border-amber-500/30 rounded-lg px-3 py-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="material-symbols-outlined text-amber-400 text-[15px]">local_shipping</span>
                                                        <span className="text-white font-medium text-sm">{item.liters.toLocaleString('id-ID')} <span className="text-amber-400 text-xs">L</span></span>
                                                        <span className="text-[10px] text-slate-400 truncate">{item.supplier}</span>
                                                    </div>
                                                    {item.id && !isEditing && (
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button type="button" onClick={() => setEditUn(p => ({ ...p, [id]: { open: true, liters: item.liters, supplier: item.supplier } }))}
                                                                className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center transition-colors">
                                                                <span className="material-symbols-outlined text-[13px]">edit</span>
                                                            </button>
                                                            <button type="button" onClick={() => onDeleteSolarUnloading?.(item.id!)}
                                                                className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                                                <span className="material-symbols-outlined text-[13px]">delete</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {isEditing && (
                                                    <div className="mt-2 space-y-2">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="text-[10px] text-slate-400 block mb-1">Jumlah (Liter)</label>
                                                                <input type="number" className="w-full bg-[#101822] border border-blue-500/50 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-400"
                                                                    value={es.liters} onChange={e => setEditUn(p => ({ ...p, [id]: { ...p[id], liters: Number(e.target.value) || 0 } }))} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] text-slate-400 block mb-1">Supplier</label>
                                                                <input type="text" className="w-full bg-[#101822] border border-blue-500/50 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400"
                                                                    value={es.supplier} onChange={e => setEditUn(p => ({ ...p, [id]: { ...p[id], supplier: e.target.value } }))} />
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 justify-end">
                                                            <button type="button" onClick={() => setEditUn(p => ({ ...p, [id]: { ...p[id], open: false } }))}
                                                                className="px-3 py-1 rounded bg-slate-500/20 text-slate-400 hover:bg-slate-500/40 text-xs transition-colors">Batal</button>
                                                            <button type="button" onClick={async () => {
                                                                await onEditSolarUnloading?.(item.id!, { liters: es.liters, supplier: es.supplier });
                                                                setEditUn(p => ({ ...p, [id]: { ...p[id], open: false } }));
                                                            }} className="px-3 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 text-xs font-bold transition-colors">Simpan</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-500 italic">Belum ada data kedatangan solar hari ini</p>
                            )}
                        </div>

                        {/* ─ Permintaan ─ */}
                        <div>
                            <SectionLabel label="Permintaan Solar" badge={`${solarUsages.length} entri · ${totalPermintaan.toLocaleString('id-ID')} L`} />
                            {solarUsages.length > 0 ? (
                                <div className="space-y-2">
                                    {solarUsages.map((item) => {
                                        const id = item.id ?? (item.tujuan + item.liters);
                                        const es = editUs[id];
                                        const isEditing = es?.open ?? false;
                                        return (
                                            <div key={id} className="bg-[#101822]/50 border border-rose-500/30 rounded-lg px-3 py-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="material-symbols-outlined text-rose-400 text-[15px]">upload</span>
                                                        <span className="text-white font-medium text-sm">{item.liters.toLocaleString('id-ID')} <span className="text-rose-400 text-xs">L</span></span>
                                                        <span className="text-[10px] text-slate-400 truncate">{item.tujuan} · {shiftLabel[item.shift] ?? item.shift}</span>
                                                    </div>
                                                    {item.id && !isEditing && (
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button type="button" onClick={() => setEditUs(p => ({ ...p, [id]: { open: true, liters: item.liters, tujuan: item.tujuan, shift: item.shift, tujuanMode: (['Bengkel','SA/SU 3B'].includes(item.tujuan) ? item.tujuan : 'Lainnya') as 'Bengkel'|'SA/SU 3B'|'Lainnya' } }))}
                                                                className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center transition-colors">
                                                                <span className="material-symbols-outlined text-[13px]">edit</span>
                                                            </button>
                                                            <button type="button" onClick={() => onDeleteSolarUsage?.(item.id!)}
                                                                className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                                                <span className="material-symbols-outlined text-[13px]">delete</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {isEditing && (
                                                    <div className="mt-2 space-y-2">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="text-[10px] text-slate-400 block mb-1">Jumlah (Liter)</label>
                                                                <input type="number" className="w-full bg-[#101822] border border-blue-500/50 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-400"
                                                                    value={es.liters} onChange={e => setEditUs(p => ({ ...p, [id]: { ...p[id], liters: Number(e.target.value) || 0 } }))} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] text-slate-400 block mb-1">Shift</label>
                                                                <select className="w-full bg-[#101822] border border-blue-500/50 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400"
                                                                    value={es.shift} onChange={e => setEditUs(p => ({ ...p, [id]: { ...p[id], shift: e.target.value } }))}>
                                                                    <option value="pagi">Pagi</option>
                                                                    <option value="siang">Siang</option>
                                                                    <option value="malam">Malam</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-slate-400 block mb-1">Tujuan</label>
                                                            <select className="w-full bg-[#101822] border border-blue-500/50 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400"
                                                                value={es.tujuanMode} onChange={e => {
                                                                    const mode = e.target.value as typeof es.tujuanMode;
                                                                    setEditUs(p => ({ ...p, [id]: { ...p[id], tujuanMode: mode, tujuan: mode !== 'Lainnya' ? mode : '' } }));
                                                                }}>
                                                                <option value="Bengkel">Bengkel</option>
                                                                <option value="SA/SU 3B">SA/SU 3B</option>
                                                                <option value="Lainnya">Lainnya…</option>
                                                            </select>
                                                            {es.tujuanMode === 'Lainnya' && (
                                                                <input type="text" placeholder="Tulis tujuan..." className="w-full mt-1 bg-[#101822] border border-blue-500/50 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400"
                                                                    value={es.tujuan} onChange={e => setEditUs(p => ({ ...p, [id]: { ...p[id], tujuan: e.target.value } }))} />
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2 justify-end">
                                                            <button type="button" onClick={() => setEditUs(p => ({ ...p, [id]: { ...p[id], open: false } }))}
                                                                className="px-3 py-1 rounded bg-slate-500/20 text-slate-400 hover:bg-slate-500/40 text-xs transition-colors">Batal</button>
                                                            <button type="button" onClick={async () => {
                                                                await onEditSolarUsage?.(item.id!, { liters: es.liters, tujuan: es.tujuan, shift: es.shift });
                                                                setEditUs(p => ({ ...p, [id]: { ...p[id], open: false } }));
                                                            }} className="px-3 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 text-xs font-bold transition-colors">Simpan</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-500 italic">Belum ada data permintaan solar hari ini</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Penggunaan Solar Harian */}
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
