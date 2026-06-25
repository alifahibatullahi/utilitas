'use client';
import React, { useState } from 'react';
import { InputField, Card, CalculatedField, SectionLabel, SelisihInfo, Modal } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

const n = (v: number | string | null | undefined) => Number(v) || 0;
const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

// Nilai shift dari laporan shift = pagi/sore/malam. 'siang' = legacy. Lainnya/kosong = harian.
const SHIFT_LABEL: Record<string, string> = { pagi: 'Pagi', sore: 'Sore', siang: 'Siang', malam: 'Malam' };

/** Badge asal entri solar: "Shift Pagi/Sore/Malam" (dari laporan shift) vs "Harian"
 *  (ditambah langsung di laporan harian). Membantu operator hindari input dobel. */
function OriginBadge({ shift }: { shift?: string | null }) {
    const label = shift ? SHIFT_LABEL[shift] : undefined;
    return label ? (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-slate-700/40 text-slate-300 border-slate-600/50">
            <span className="material-symbols-outlined text-[11px]">schedule</span>Shift {label}
        </span>
    ) : (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-blue-500/15 text-blue-300 border-blue-500/30">
            <span className="material-symbols-outlined text-[11px]">edit_calendar</span>Harian
        </span>
    );
}

type EditUn = { id?: string; liters: number; supplier: string };
type EditUs = { id?: string; liters: number; tujuan: string; shift: string; tujuanMode: 'Bengkel' | 'SA/SU 3B' | 'Lainnya' };

export default function TabHandling({
    stockTank, totalizer,
    prevTotalizer, prevStockTank,
    onStockTankChange, onTotalizerChange,
    solarUnloadings = [],
    solarUsages = [],
    onDeleteSolarUnloading,
    onDeleteSolarUsage,
    onEditSolarUnloading,
    onEditSolarUsage,
    onAddSolarUnloading,
    onAddSolarUsage,
}: DailyTabProps) {
    const [editUn, setEditUn] = useState<EditUn | null>(null);
    const [editUs, setEditUs] = useState<EditUs | null>(null);

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

    const totalKedatangan = solarUnloadings.reduce((s, e) => s + e.liters, 0);
    const totalPermintaan = solarUsages.reduce((s, e) => s + e.liters, 0);
    const bengkelTotal = solarUsages.filter(e => e.tujuan === 'Bengkel').reduce((s, e) => s + e.liters, 0);
    const sasuTotal = solarUsages.filter(e => e.tujuan === 'SA/SU 3B').reduce((s, e) => s + e.liters, 0);
    // Pemakaian Boiler A+B (m³) = nilai reviewed supervisor (daily_report_stock_tank.solar_boiler).
    // Read-only di form operator — operator tak mengisi konsumsi boiler.
    const boilerUsage = n(stockTank.solar_boiler);

    // Review pengurangan level solar: bandingkan level kemarin (LHUBB hari sebelumnya) vs hari ini.
    const levelKemarin = prevStockTank?.solar_tank_a != null ? n(prevStockTank.solar_tank_a) : null;
    const levelHariIni = stockTank.solar_tank_a != null ? n(stockTank.solar_tank_a) : null;
    const adaPengurangan = levelKemarin != null && levelHariIni != null && levelKemarin > levelHariIni;

    const saveEditUn = async () => {
        if (!editUn) return;
        const fields = { liters: editUn.liters, supplier: editUn.supplier };
        if (editUn.id) await onEditSolarUnloading?.(editUn.id, fields);
        else await onAddSolarUnloading?.(fields);
        setEditUn(null);
    };
    const saveEditUs = async () => {
        if (!editUs) return;
        const tujuan = editUs.tujuan.trim();
        if (!tujuan) return; // tujuan wajib
        const fields = { liters: editUs.liters, tujuan, shift: editUs.shift };
        if (editUs.id) await onEditSolarUsage?.(editUs.id, fields);
        else await onAddSolarUsage?.(fields);
        setEditUs(null);
    };

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Tankyard ═══ */}
            <Card title="Tankyard" icon="water_drop" color="blue">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Level RCW" name="rcw_level_00" value={stockTank.rcw_level_00} onChange={onStockTankChange} unit="m³" color="blue" />
                    <InputField label="Level Demin" name="demin_level_00" value={stockTank.demin_level_00} onChange={onStockTankChange} unit="m³" color="blue" />
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                    <div className="rounded-lg border border-slate-700/40 bg-[#101822]/40 px-3 py-2.5">
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">Level Solar Kemarin</p>
                        <p className="text-lg font-mono font-bold text-slate-300">{levelKemarin != null ? fmt(levelKemarin) : '—'} <span className="text-[10px] text-slate-500">m³</span></p>
                    </div>
                    <InputField label="Level Tank Solar (Hari Ini)" name="solar_tank_a" value={stockTank.solar_tank_a} onChange={onStockTankChange} unit="m³" color="orange" />
                </div>
                <CalculatedField label="Pemakaian Solar Boiler A+B" value={stockTank.solar_boiler != null ? fmt(boilerUsage) : '—'} unit="m³" variant="small" />
                <p className="-mt-1 text-[10px] text-slate-500">Diisi saat review oleh supervisor (kolom Sheets CL). Read-only di sini.</p>

                {/* Review pengurangan level solar — cuma konfirmasi (tanpa validasi angka) */}
                {adaPengurangan && (
                    <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="material-symbols-outlined text-orange-400 text-[15px]">trending_down</span>
                            <span className="text-[11px] font-bold text-orange-300 uppercase tracking-wider">Konfirmasi Pengurangan Solar</span>
                        </div>
                        <p className="text-[12px] text-slate-200 leading-relaxed">
                            Level solar berkurang dari <b className="text-white">{fmt(levelKemarin!)} m³</b> ke <b className="text-white">{fmt(levelHariIni!)} m³</b> untuk:
                        </p>
                        <div className="mt-1.5 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-md bg-[#101822]/60 py-1.5">
                                <p className="text-[9px] text-slate-400 uppercase">Boiler AB</p>
                                <p className="text-sm font-mono font-bold text-orange-300">{fmt(boilerUsage)} <span className="text-[9px]">m³</span></p>
                            </div>
                            <div className="rounded-md bg-[#101822]/60 py-1.5">
                                <p className="text-[9px] text-slate-400 uppercase">Bengkel</p>
                                <p className="text-sm font-mono font-bold text-orange-300">{fmt(bengkelTotal / 1000)} <span className="text-[9px]">m³</span></p>
                            </div>
                            <div className="rounded-md bg-[#101822]/60 py-1.5">
                                <p className="text-[9px] text-slate-400 uppercase">SA/SU 3B</p>
                                <p className="text-sm font-mono font-bold text-orange-300">{fmt(sasuTotal / 1000)} <span className="text-[9px]">m³</span></p>
                            </div>
                        </div>
                    </div>
                )}
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
                                    {solarUnloadings.map((item) => (
                                        <div key={item.id ?? item.supplier} className="flex items-center justify-between gap-2 bg-[#101822]/50 border border-amber-500/30 rounded-lg px-3 py-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="material-symbols-outlined text-amber-400 text-[15px]">local_shipping</span>
                                                <span className="text-white font-medium text-sm">{item.liters.toLocaleString('id-ID')} <span className="text-amber-400 text-xs">L</span></span>
                                                <OriginBadge shift={item.shift} />
                                                <span className="text-[10px] text-slate-400 truncate">{item.supplier}</span>
                                            </div>
                                            {item.id && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button type="button" onClick={() => setEditUn({ id: item.id!, liters: item.liters, supplier: item.supplier })}
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
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-500 italic">Belum ada data kedatangan solar hari ini</p>
                            )}
                            <button type="button" onClick={() => setEditUn({ liters: 0, supplier: '' })}
                                className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-colors">
                                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                Tambah Kedatangan
                            </button>
                        </div>

                        {/* ─ Permintaan ─ */}
                        <div>
                            <SectionLabel label="Permintaan Solar" badge={`${solarUsages.length} entri · ${totalPermintaan.toLocaleString('id-ID')} L`} />
                            {solarUsages.length > 0 ? (
                                <div className="space-y-2">
                                    {solarUsages.map((item) => (
                                        <div key={item.id ?? item.tujuan} className="flex items-center justify-between gap-2 bg-[#101822]/50 border border-rose-500/30 rounded-lg px-3 py-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="material-symbols-outlined text-rose-400 text-[15px]">upload</span>
                                                <span className="text-white font-medium text-sm">{item.liters.toLocaleString('id-ID')} <span className="text-rose-400 text-xs">L</span></span>
                                                <OriginBadge shift={item.shift} />
                                                <span className="text-[10px] text-slate-400 truncate">{item.tujuan}</span>
                                            </div>
                                            {item.id && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button type="button" onClick={() => setEditUs({
                                                        id: item.id!, liters: item.liters, tujuan: item.tujuan, shift: item.shift,
                                                        tujuanMode: (['Bengkel', 'SA/SU 3B'].includes(item.tujuan) ? item.tujuan : 'Lainnya') as EditUs['tujuanMode'],
                                                    })}
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
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-500 italic">Belum ada data permintaan solar hari ini</p>
                            )}
                            <button type="button" onClick={() => setEditUs({ liters: 0, tujuan: 'Bengkel', shift: 'harian', tujuanMode: 'Bengkel' })}
                                className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-colors">
                                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                Tambah Permintaan
                            </button>
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

            {/* Modal Edit Kedatangan Solar */}
            <Modal open={!!editUn} onClose={() => setEditUn(null)} title={editUn?.id ? 'Edit Kedatangan Solar' : 'Tambah Kedatangan Solar'} color="amber">
                {editUn && (
                    <>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Jumlah (Liter)</label>
                            <input type="number" className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-lg font-mono focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                value={editUn.liters} onChange={e => setEditUn({ ...editUn, liters: Number(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Supplier</label>
                            <input type="text" className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                value={editUn.supplier} onChange={e => setEditUn({ ...editUn, supplier: e.target.value })} />
                        </div>
                        <button type="button" onClick={saveEditUn}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors mt-1">
                            <span className="material-symbols-outlined text-[18px]">save</span>Simpan
                        </button>
                    </>
                )}
            </Modal>

            {/* Modal Edit Permintaan Solar */}
            <Modal open={!!editUs} onClose={() => setEditUs(null)} title={editUs?.id ? 'Edit Permintaan Solar' : 'Tambah Permintaan Solar'} color="rose">
                {editUs && (
                    <>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Jumlah (Liter)</label>
                            <input type="number" className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-lg font-mono focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all"
                                value={editUs.liters} onChange={e => setEditUs({ ...editUs, liters: Number(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Asal / Shift</label>
                            <select className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all"
                                value={editUs.shift} onChange={e => setEditUs({ ...editUs, shift: e.target.value })}>
                                <option value="harian">Harian (ditambah di laporan harian)</option>
                                <option value="pagi">Shift Pagi</option>
                                <option value="sore">Shift Sore</option>
                                <option value="malam">Shift Malam</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Tujuan</label>
                            <select className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all"
                                value={editUs.tujuanMode} onChange={e => {
                                    const mode = e.target.value as EditUs['tujuanMode'];
                                    setEditUs({ ...editUs, tujuanMode: mode, tujuan: mode !== 'Lainnya' ? mode : '' });
                                }}>
                                <option value="Bengkel">Bengkel</option>
                                <option value="SA/SU 3B">SA/SU 3B</option>
                                <option value="Lainnya">Lainnya…</option>
                            </select>
                            {editUs.tujuanMode === 'Lainnya' && (
                                <input type="text" placeholder="Tulis tujuan..." className="mt-2 w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all"
                                    value={editUs.tujuan} onChange={e => setEditUs({ ...editUs, tujuan: e.target.value })} />
                            )}
                        </div>
                        <button type="button" onClick={saveEditUs}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm transition-colors mt-1">
                            <span className="material-symbols-outlined text-[18px]">save</span>Simpan
                        </button>
                    </>
                )}
            </Modal>
        </div>
    );
}
