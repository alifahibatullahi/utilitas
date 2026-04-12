'use client';
import React, { useState } from 'react';
import { InputField, Card, SectionLabel } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

const SILO_LABELS: Record<string, string> = { 'Silo A': 'Silo A', 'Silo B': 'Silo B' };

export default function TabSiloFlyAsh({
    stockTank, onStockTankChange,
    ashUnloadings = [],
    onDeleteAshUnloading,
    onEditAshUnloading,
}: DailyTabProps) {
    // Edit state: { [id]: { open: boolean; ritase: number } }
    const [editState, setEditState] = useState<Record<string, { open: boolean; ritase: number }>>({});

    const startEdit = (id: string, ritase: number) => {
        setEditState(prev => ({ ...prev, [id]: { open: true, ritase } }));
    };
    const cancelEdit = (id: string) => {
        setEditState(prev => ({ ...prev, [id]: { ...prev[id], open: false } }));
    };
    const saveEdit = async (id: string) => {
        const s = editState[id];
        if (!s) return;
        await onEditAshUnloading?.(id, s.ritase);
        setEditState(prev => ({ ...prev, [id]: { ...prev[id], open: false } }));
    };

    // Totals per silo
    const totalA = ashUnloadings.filter(e => e.silo === 'Silo A').reduce((s, e) => s + e.ritase, 0);
    const totalB = ashUnloadings.filter(e => e.silo === 'Silo B').reduce((s, e) => s + e.ritase, 0);

    const shiftLabel: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* ═══ Input Silo & Fly Ash ═══ */}
            <Card title="Silo & Fly Ash" icon="filter_alt" color="emerald">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Silo A (Data Aktual)" name="silo_a_pct" value={stockTank.silo_a_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                    <InputField label="Silo B (Data Aktual)" name="silo_b_pct" value={stockTank.silo_b_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                    <InputField label="Unloading Fly Ash A" name="unloading_fly_ash_a" value={stockTank.unloading_fly_ash_a} onChange={onStockTankChange} unit="Silo A" color="emerald" />
                    <InputField label="Unloading Fly Ash B" name="unloading_fly_ash_b" value={stockTank.unloading_fly_ash_b} onChange={onStockTankChange} unit="Silo B" color="emerald" />
                </div>
            </Card>

            {/* ═══ Summary Unloading Fly Ash ═══ */}
            <Card title="Summary Unloading Fly Ash" icon="local_shipping" color="teal">
                {/* Totals per silo */}
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

                <SectionLabel
                    label="Detail Unloading Hari Ini"
                    badge={`${ashUnloadings.length} entri`}
                />

                {ashUnloadings.length > 0 ? (
                    <div className="space-y-2">
                        {ashUnloadings.map((item, i) => {
                            const id = item.id ?? String(i);
                            const es = editState[id];
                            const isEditing = es?.open ?? false;

                            return (
                                <div key={id} className="bg-[#101822]/50 border border-teal-700/40 rounded-lg px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.silo === 'Silo A' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-teal-500/20 text-teal-400'}`}>
                                                {SILO_LABELS[item.silo] ?? item.silo}
                                            </span>
                                            <span className="text-[10px] text-slate-400 capitalize">{shiftLabel[item.shift] ?? item.shift}</span>
                                            <span className="text-[10px] text-slate-500 truncate">{item.perusahaan}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {item.id && !isEditing && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(id, item.ritase)}
                                                        className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[13px]">edit</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteAshUnloading?.(item.id!)}
                                                        className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[13px]">delete</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {isEditing ? (
                                        <div className="mt-2 flex items-center gap-2">
                                            <label className="text-[10px] text-slate-400 shrink-0">Ritase</label>
                                            <input
                                                type="number"
                                                className="flex-1 bg-[#101822] border border-blue-500/50 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-400"
                                                value={es?.ritase ?? item.ritase}
                                                onChange={e => setEditState(prev => ({ ...prev, [id]: { ...prev[id], ritase: Number(e.target.value) || 0 } }))}
                                            />
                                            <button type="button" onClick={() => saveEdit(id)}
                                                className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 text-xs font-bold transition-colors">
                                                Simpan
                                            </button>
                                            <button type="button" onClick={() => cancelEdit(id)}
                                                className="px-2 py-1 rounded bg-slate-500/20 text-slate-400 hover:bg-slate-500/40 text-xs transition-colors">
                                                Batal
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="text-white font-bold text-sm">{item.ritase} <span className="text-teal-400 text-xs font-normal">Rit</span></span>
                                            <span className="text-[10px] text-slate-500">· Tujuan: {item.tujuan}</span>
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
        </div>
    );
}
