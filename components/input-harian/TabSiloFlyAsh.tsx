'use client';
import React, { useState } from 'react';
import { InputField, Card, Modal } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

type EditFields = { id: string; silo: string; shift: string; perusahaan: string; tujuan: string; ritase: number };

const SILO_OPTIONS = ['Silo A', 'Silo B'];
const SHIFT_OPTIONS = ['pagi', 'siang', 'malam'];
const SHIFT_LABELS: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };
const SHIFT_COLOR: Record<string, { bg: string; text: string }> = {
    pagi:  { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
    siang: { bg: 'bg-orange-500/15',  text: 'text-orange-400' },
    malam: { bg: 'bg-indigo-500/15',  text: 'text-indigo-400' },
};

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

    const totalA = ashUnloadings.filter(e => e.silo === 'Silo A').reduce((s, e) => s + e.ritase, 0);
    const totalB = ashUnloadings.filter(e => e.silo === 'Silo B').reduce((s, e) => s + e.ritase, 0);

    return (
        <div className="flex-1 w-full">
            <Card title="Silo & Fly Ash" icon="filter_alt" color="emerald">
                {/* Level Silo */}
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Level Silo A" name="silo_a_pct" value={stockTank.silo_a_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                    <InputField label="Level Silo B" name="silo_b_pct" value={stockTank.silo_b_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-700/50 my-1" />

                {/* Summary Unloading */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-center">
                        <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Total Silo A</p>
                        <p className="text-emerald-300 font-bold text-xl">{totalA} <span className="text-xs font-normal">Rit</span></p>
                    </div>
                    <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg px-3 py-2 text-center">
                        <p className="text-[10px] text-teal-400 uppercase tracking-wider font-bold">Total Silo B</p>
                        <p className="text-teal-300 font-bold text-xl">{totalB} <span className="text-xs font-normal">Rit</span></p>
                    </div>
                </div>

                {/* Detail list */}
                {ashUnloadings.length > 0 ? (
                    <div className="flex flex-col gap-2 mt-1">
                        {ashUnloadings.map((item, i) => {
                            const id = item.id ?? String(i);
                            const shiftStyle = SHIFT_COLOR[item.shift] ?? { bg: 'bg-slate-500/15', text: 'text-slate-400' };
                            const siloColor = item.silo === 'Silo A' ? 'text-emerald-400 bg-emerald-500/15' : 'text-teal-400 bg-teal-500/15';
                            return (
                                <div key={id} className="flex items-center gap-3 bg-[#101822]/60 border border-slate-700/50 rounded-xl px-3 py-2.5 hover:border-teal-500/30 transition-colors">
                                    {/* Shift badge */}
                                    <div className={`shrink-0 flex flex-col items-center justify-center ${shiftStyle.bg} rounded-lg px-2 py-1.5 min-w-[52px]`}>
                                        <span className="material-symbols-outlined text-[14px] text-slate-400 mb-0.5">
                                            {item.shift === 'pagi' ? 'wb_sunny' : item.shift === 'siang' ? 'light_mode' : 'bedtime'}
                                        </span>
                                        <span className={`text-[10px] font-bold uppercase ${shiftStyle.text}`}>{SHIFT_LABELS[item.shift] ?? item.shift}</span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${siloColor}`}>{item.silo}</span>
                                            <span className="text-white font-bold text-sm">{item.ritase} <span className="text-teal-400 text-xs font-normal">Rit</span></span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                            {item.perusahaan}
                                            {item.tujuan ? <span className="text-slate-600"> · </span> : null}
                                            {item.tujuan && <span className="text-slate-500">{item.tujuan}</span>}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    {item.id && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button type="button"
                                                onClick={() => setEditItem({ id: item.id!, silo: item.silo, shift: item.shift, perusahaan: item.perusahaan, tujuan: item.tujuan, ritase: item.ritase })}
                                                className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/25 flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-[15px]">edit</span>
                                            </button>
                                            <button type="button" onClick={() => onDeleteAshUnloading?.(item.id!)}
                                                className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-[15px]">delete</span>
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
                                <select className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-teal-500 transition-all"
                                    value={editItem.silo} onChange={e => setEditItem({ ...editItem, silo: e.target.value })}>
                                    {SILO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold text-white uppercase tracking-wider block text-xs">Shift</label>
                                <select className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-teal-500 transition-all"
                                    value={editItem.shift} onChange={e => setEditItem({ ...editItem, shift: e.target.value })}>
                                    {SHIFT_OPTIONS.map(s => <option key={s} value={s}>{SHIFT_LABELS[s]}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Perusahaan</label>
                            <input type="text" className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-teal-500 transition-all"
                                value={editItem.perusahaan} onChange={e => setEditItem({ ...editItem, perusahaan: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Tujuan</label>
                            <input type="text" className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-teal-500 transition-all"
                                value={editItem.tujuan} onChange={e => setEditItem({ ...editItem, tujuan: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Ritase</label>
                            <input type="number" className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-lg font-mono focus:ring-1 focus:ring-teal-500 transition-all"
                                value={editItem.ritase} onChange={e => setEditItem({ ...editItem, ritase: Number(e.target.value) || 0 })} />
                        </div>
                        <button type="button" onClick={saveEdit}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-bold text-sm transition-colors mt-1">
                            <span className="material-symbols-outlined text-[18px]">save</span>Simpan
                        </button>
                    </>
                )}
            </Modal>
        </div>
    );
}
