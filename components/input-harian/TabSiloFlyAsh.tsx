'use client';
import React, { useState } from 'react';
import { InputField, Card, SectionLabel, Modal } from '@/components/input-shift/SharedComponents';
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

    const totalA = ashUnloadings.filter(e => e.silo === 'Silo A').reduce((s, e) => s + e.ritase, 0);
    const totalB = ashUnloadings.filter(e => e.silo === 'Silo B').reduce((s, e) => s + e.ritase, 0);

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Input Silo & Fly Ash ═══ */}
            <Card title="Silo & Fly Ash" icon="filter_alt" color="emerald">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Silo A (Data Aktual)" name="silo_a_pct" value={stockTank.silo_a_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                    <InputField label="Silo B (Data Aktual)" name="silo_b_pct" value={stockTank.silo_b_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                </div>
            </Card>

            {/* ═══ Summary Unloading Fly Ash ═══ */}
            <Card title="Summary Unloading Fly Ash" icon="local_shipping" color="teal">
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg px-3 py-2 text-center">
                        <p className="text-[10px] text-teal-400 uppercase tracking-wider font-bold">Total Silo A</p>
                        <p className="text-teal-300 font-bold text-lg">{totalA} <span className="text-xs font-normal">Rit</span></p>
                    </div>
                    <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg px-3 py-2 text-center">
                        <p className="text-[10px] text-teal-400 uppercase tracking-wider font-bold">Total Silo B</p>
                        <p className="text-teal-300 font-bold text-lg">{totalB} <span className="text-xs font-normal">Rit</span></p>
                    </div>
                </div>

                <SectionLabel label="Detail Unloading Hari Ini" badge={`${ashUnloadings.length} entri`} />

                {ashUnloadings.length > 0 ? (
                    <div className="space-y-2">
                        {ashUnloadings.map((item, i) => {
                            const id = item.id ?? String(i);
                            return (
                                <div key={id} className="flex items-center justify-between gap-2 bg-[#101822]/50 border border-teal-700/40 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.silo === 'Silo A' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-teal-500/20 text-teal-400'}`}>
                                            {item.silo}
                                        </span>
                                        <span className="text-white font-bold text-sm">{item.ritase} <span className="text-teal-400 text-xs font-normal">Rit</span></span>
                                        <span className="text-[10px] text-slate-400 capitalize">{SHIFT_LABELS[item.shift] ?? item.shift}</span>
                                        <span className="text-[10px] text-slate-500 truncate">{item.perusahaan}</span>
                                    </div>
                                    {item.id && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button type="button"
                                                onClick={() => setEditItem({ id: item.id!, silo: item.silo, shift: item.shift, perusahaan: item.perusahaan, tujuan: item.tujuan, ritase: item.ritase })}
                                                className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-[13px]">edit</span>
                                            </button>
                                            <button type="button" onClick={() => onDeleteAshUnloading?.(item.id!)}
                                                className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-[13px]">delete</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-[11px] text-slate-500 italic">Belum ada data unloading fly ash dari laporan shift hari ini</p>
                )}
            </Card>

            {/* Modal Edit Unloading Fly Ash */}
            <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Unloading Fly Ash" color="teal">
                {editItem && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="font-bold text-white uppercase tracking-wider block text-xs">Silo</label>
                                <select className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all"
                                    value={editItem.silo} onChange={e => setEditItem({ ...editItem, silo: e.target.value })}>
                                    {SILO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold text-white uppercase tracking-wider block text-xs">Shift</label>
                                <select className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all"
                                    value={editItem.shift} onChange={e => setEditItem({ ...editItem, shift: e.target.value })}>
                                    {SHIFT_OPTIONS.map(s => <option key={s} value={s}>{SHIFT_LABELS[s]}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Perusahaan</label>
                            <input type="text" className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all"
                                value={editItem.perusahaan} onChange={e => setEditItem({ ...editItem, perusahaan: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Tujuan</label>
                            <input type="text" className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all"
                                value={editItem.tujuan} onChange={e => setEditItem({ ...editItem, tujuan: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-bold text-white uppercase tracking-wider block text-xs">Ritase</label>
                            <input type="number" className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white text-lg font-mono focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all"
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
