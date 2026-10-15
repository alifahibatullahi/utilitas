'use client';
import React, { useState } from 'react';
import { InputField, Card, Modal } from '@/components/input-shift/SharedComponents';
import { isSiloA, isSiloB, sumAshRitasePerSilo } from '@/lib/ash-silo-query';
import type { DailyTabProps } from './types';

type EditFields = { id: string; silo: string; shift: string; perusahaan: string; tujuan: string; ritase: number };

const SILO_OPTIONS = ['Silo A', 'Silo B'];
const SHIFT_OPTIONS = ['pagi', 'siang', 'malam'];
const SHIFT_LABELS: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

export default function TabSiloFlyAsh({
    stockTank, onStockTankChange,
    ashUnloadings = [],
    onDeleteAshUnloading,
    onEditAshUnloading,
}: DailyTabProps) {
    const [editItem, setEditItem] = useState<EditFields | null>(null);

    const saveEdit = async () => {
        if (!editItem) return;
        await onEditAshUnloading?.(editItem.id, {
            silo: editItem.silo, shift: editItem.shift,
            perusahaan: editItem.perusahaan, tujuan: editItem.tujuan, ritase: editItem.ritase,
        });
        setEditItem(null);
    };

    const siloLabel = (s: string) => isSiloA(s) ? 'Silo A' : isSiloB(s) ? 'Silo B' : s;
    const { A: totalA, B: totalB } = sumAshRitasePerSilo(ashUnloadings);

    return (
        <div className="flex-1 w-full">
            <Card title="Silo & Fly Ash" icon="filter_alt" color="emerald">
                {/* Level Silo */}
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Level Silo A" name="silo_a_pct" value={stockTank.silo_a_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                    <InputField label="Level Silo B" name="silo_b_pct" value={stockTank.silo_b_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                </div>

                {/* Trafo ESP (Jam 24.00) — untuk Logbook. Bunker dipindah ke tab Coal Bunker. */}
                <div className="h-px bg-slate-700/50 my-1" />
                <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider mt-1">Trafo ESP (Jam 24.00)</p>
                <div className="grid grid-cols-3 gap-3">
                    {['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((k) => (
                        <InputField key={k} label={`Trafo ${k.toUpperCase()}`} name={`trafo_${k}`} value={stockTank[`trafo_${k}`]} onChange={onStockTankChange} color="emerald" />
                    ))}
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-700/50 my-1" />

                {/* Summary Unloading */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg px-3 py-2 text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total Unloading Silo A</p>
                        <p className="text-white font-bold text-xl">{totalA} <span className="text-xs font-normal">Rit</span></p>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg px-3 py-2 text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total Unloading Silo B</p>
                        <p className="text-white font-bold text-xl">{totalB} <span className="text-xs font-normal">Rit</span></p>
                    </div>
                </div>

                {/* Detail list */}
                {ashUnloadings.length > 0 ? (
                    <div className="flex flex-col gap-2 mt-1">
                        {ashUnloadings.map((item, i) => {
                            const id = item.id ?? String(i);
                            return (
                                <div key={id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-bg-dark/60 border border-slate-700/50 rounded-xl p-3 hover:border-slate-600 transition-all hover:bg-bg-dark/80 hover:shadow-lg">
                                    {/* Shift badge */}
                                    <div className={`shrink-0 flex sm:flex-col items-center justify-center gap-2 sm:gap-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 min-w-[64px]`}>
                                        <span className={`material-symbols-outlined text-[18px] text-slate-300 sm:mb-0.5`}>
                                            {item.shift === 'pagi' ? 'wb_sunny' : item.shift === 'siang' ? 'light_mode' : 'bedtime'}
                                        </span>
                                        <span className={`text-xs font-bold uppercase tracking-wider text-slate-300`}>{SHIFT_LABELS[item.shift] ?? item.shift}</span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 flex items-center justify-between pr-2">
                                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                                            <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-md border w-max text-slate-200 bg-slate-800 border-slate-600`}>
                                                {siloLabel(item.silo)}
                                            </span>
                                            <div className="flex flex-col gap-0.5">
                                                {item.perusahaan && (
                                                    <p className="text-sm font-bold text-slate-200 truncate flex items-center">
                                                        <span className="text-[10px] text-slate-500 font-medium mr-1.5 uppercase tracking-wider">Truck Dari Perusahaan</span>
                                                        <span className="text-slate-600 mr-1.5">·</span>
                                                        {item.perusahaan}
                                                    </p>
                                                )}
                                                {item.tujuan && (
                                                    <p className="text-xs text-slate-400 truncate flex items-center">
                                                        <span className="text-[10px] text-slate-500 font-medium mr-1.5 uppercase tracking-wider">Tujuan</span>
                                                        <span className="text-slate-600 mr-1.5">·</span>
                                                        {item.tujuan}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end sm:flex-row sm:items-baseline gap-1 sm:gap-1.5 bg-surface-dark px-3 py-1.5 rounded-lg border border-slate-700/50 shadow-inner shrink-0">
                                            <span className="text-white font-black text-2xl">{item.ritase}</span>
                                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Rit</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {item.id && (
                                        <div className="flex sm:flex-col gap-1.5 shrink-0 sm:pl-3 sm:border-l border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-700/50 justify-end mt-1 sm:mt-0">
                                            <button type="button"
                                                onClick={() => setEditItem({ id: item.id!, silo: item.silo, shift: item.shift, perusahaan: item.perusahaan, tujuan: item.tujuan, ritase: item.ritase })}
                                                className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/25 flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                            </button>
                                            <button type="button" onClick={() => onDeleteAshUnloading?.(item.id!)}
                                                className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-[11px] text-slate-500 italic mt-1">Belum ada data unloading fly ash dari laporan shift hari ini</p>
                )}
            </Card>

            {/* Modal Edit */}
            <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Unloading Fly Ash" color="teal">
                {editItem && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="font-bold text-white uppercase tracking-wider block text-xs">Silo</label>
                                <select className="w-full bg-bg-dark/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-blue-500 transition-all"
                                    value={editItem.silo} onChange={e => setEditItem({ ...editItem, silo: e.target.value })}>
                                    {SILO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold text-white uppercase tracking-wider block text-xs">Shift</label>
                                <select className="w-full bg-bg-dark/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-blue-500 transition-all"
                                    value={editItem.shift} onChange={e => setEditItem({ ...editItem, shift: e.target.value })}>
                                    {SHIFT_OPTIONS.map(s => <option key={s} value={s}>{SHIFT_LABELS[s]}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Truck Dari Perusahaan</label>
                            <input type="text" className="w-full bg-bg-dark/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-blue-500 transition-all"
                                value={editItem.perusahaan} onChange={e => setEditItem({ ...editItem, perusahaan: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Tujuan</label>
                            <input type="text" className="w-full bg-bg-dark/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-blue-500 transition-all"
                                value={editItem.tujuan} onChange={e => setEditItem({ ...editItem, tujuan: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Ritase</label>
                            <input type="number" className="w-full bg-bg-dark/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-lg font-mono focus:ring-1 focus:ring-blue-500 transition-all"
                                value={editItem.ritase} onChange={e => setEditItem({ ...editItem, ritase: Number(e.target.value) || 0 })} />
                        </div>
                        <button type="button" onClick={saveEdit}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors mt-1">
                            <span className="material-symbols-outlined text-[18px]">save</span>Simpan
                        </button>
                    </>
                )}
            </Modal>
        </div>
    );
}
