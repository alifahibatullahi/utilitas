'use client';
import React, { useState } from 'react';
import { Card, InputField, Modal, SectionLabel } from '@/components/input-shift/SharedComponents';
import { SolarOriginBadge } from './SolarOriginBadge';
import type { SolarReviewProps } from './types';

const n = (v: number | string | null | undefined) => Number(v) || 0;
const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');
const numOrNull = (v: number | string | null | undefined) => (v == null || v === '' ? null : Number(v));
type TujuanMode = 'Bengkel' | 'SA/SU 3B' | 'Lainnya';
type EditUn = { id?: string; liters: number; supplier: string };
type EditUs = { id?: string; liters: number; tujuan: string; shift: string; tujuanMode: TujuanMode };

/** Review Solar (supervisor):
 *  - Level sekarang (input) & kemarin (display)
 *  - Kedatangan: input form total m³ (default = total entri) + daftar entri (catatan, CRUD)
 *  - Pemakaian: input form Boiler A+B / Bengkel / SA·SU 3B (default Bengkel/SA·SU = total entri)
 *    + daftar permintaan (catatan, CRUD)
 *  Nilai FORM = yang tersimpan ke Sheets; entri hanya catatan & sumber default. */
export default function TabSolarReview({
    solarUnloadings = [], solarUsages = [],
    solarLevel = null, prevSolarLevel = null,
    kedatangan = null, boilerAB = null, bengkel = null, sasu = null,
    onLevelChange, onValueChange,
    onAddUnloading, onEditUnloading, onDeleteUnloading,
    onAddUsage, onEditUsage, onDeleteUsage,
}: SolarReviewProps) {
    const [editUn, setEditUn] = useState<EditUn | null>(null);
    const [editUs, setEditUs] = useState<EditUs | null>(null);

    const levelKemarin = prevSolarLevel != null ? n(prevSolarLevel) : null;
    const levelSekarang = solarLevel != null ? n(solarLevel) : null;
    // Level tercantum = isi 1 tanki; total volume = selisih level × 2 tanki.
    const deltaVolume = (levelSekarang != null && levelKemarin != null)
        ? (levelSekarang - levelKemarin) * 2
        : null;
    // Default form (m³) dari agregat entri (catatan), Liter → m³.
    const aggKedatangan = solarUnloadings.reduce((s, e) => s + n(e.liters), 0) / 1000;
    const aggBengkel = solarUsages.filter(e => e.tujuan === 'Bengkel').reduce((s, e) => s + n(e.liters), 0) / 1000;
    const aggSasu = solarUsages.filter(e => e.tujuan === 'SA/SU 3B').reduce((s, e) => s + n(e.liters), 0) / 1000;
    // Nilai input = override form bila ada, else default agregat (kecuali Boiler A+B yg murni manual).
    const kedatanganVal = kedatangan != null ? kedatangan : aggKedatangan;
    const bengkelVal = bengkel != null ? bengkel : aggBengkel;
    const sasuVal = sasu != null ? sasu : aggSasu;

    const saveUn = async () => {
        if (!editUn) return;
        const f = { liters: editUn.liters, supplier: editUn.supplier.trim() };
        if (editUn.id) await onEditUnloading?.(editUn.id, f); else await onAddUnloading?.(f);
        setEditUn(null);
    };
    const saveUs = async () => {
        if (!editUs) return;
        const tujuan = (editUs.tujuanMode === 'Lainnya' ? editUs.tujuan : editUs.tujuanMode).trim();
        if (!tujuan) return;
        const f = { liters: editUs.liters, tujuan, shift: editUs.shift };
        if (editUs.id) await onEditUsage?.(editUs.id, f); else await onAddUsage?.(f);
        setEditUs(null);
    };

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
                {deltaVolume != null && levelKemarin != null && levelSekarang != null && (
                    <div className={`mt-3 rounded-lg border text-xs overflow-hidden ${
                        deltaVolume > 0
                            ? 'border-emerald-500/30'
                            : deltaVolume < 0
                                ? 'border-rose-500/30'
                                : 'border-slate-500/30'
                    }`}>
                        {/* Rincian volume — level (1 tanki) × 2 tanki */}
                        <div className="px-3 py-2 bg-[#101822]/40 border-b border-slate-700/40 space-y-1 font-mono">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400">Level kemarin</span>
                                <span className="text-slate-200"><span className="font-bold">{fmt(levelKemarin)}</span> <span className="text-slate-500">× 2 =</span> <span className="font-bold text-white">{fmt(levelKemarin * 2)} m³</span></span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400">Level hari ini</span>
                                <span className="text-slate-200"><span className="font-bold">{fmt(levelSekarang)}</span> <span className="text-slate-500">× 2 =</span> <span className="font-bold text-white">{fmt(levelSekarang * 2)} m³</span></span>
                            </div>
                        </div>
                        {/* Keterangan kenaikan/penurunan volume */}
                        <div className={`flex items-start gap-2 px-3 py-2 ${
                            deltaVolume > 0
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : deltaVolume < 0
                                    ? 'bg-rose-500/10 text-rose-300'
                                    : 'bg-slate-500/10 text-slate-300'
                        }`}>
                            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                                {deltaVolume > 0 ? 'trending_up' : deltaVolume < 0 ? 'trending_down' : 'trending_flat'}
                            </span>
                            <span>
                                {deltaVolume === 0
                                    ? 'Tidak ada perubahan volume solar.'
                                    : <>Ada <span className="font-bold">{deltaVolume > 0 ? 'kenaikan' : 'penurunan'}</span> volume solar sebesar <span className="font-bold">{fmt(Math.abs(deltaVolume))} m³</span>.</>}
                            </span>
                        </div>
                    </div>
                )}
            </Card>

            {/* ═══ Kedatangan Solar ═══ */}
            <Card title="Kedatangan Solar" icon="local_shipping" color="amber">
                <InputField label="Total Kedatangan (m³)" name="kedatangan_solar" value={kedatanganVal} unit="m³" color="amber"
                    onChange={(_, v) => onValueChange?.('kedatangan_solar', numOrNull(v))} />
                <div className="pt-2 mt-1 border-t border-slate-700/50">
                    <SectionLabel label="Detail Entri (catatan)" badge={`${solarUnloadings.length} entri`} />
                    {solarUnloadings.length > 0 ? (
                        <div className="space-y-2">
                            {solarUnloadings.map((item, i) => (
                                <div key={item.id ?? i} className="relative flex items-center gap-2 bg-[#101822]/50 border border-amber-500/30 rounded-lg px-3 py-2 pr-16 min-w-0">
                                    <span className="material-symbols-outlined text-amber-400 text-[15px]">local_shipping</span>
                                    <span className="text-white font-medium text-sm">{n(item.liters).toLocaleString('id-ID')} <span className="text-amber-400 text-xs">L</span></span>
                                    <SolarOriginBadge shift={item.shift} />
                                    <span className="text-[10px] text-slate-400 truncate">{item.supplier}</span>
                                    {item.id && (
                                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            <button type="button" onClick={() => setEditUn({ id: item.id!, liters: item.liters, supplier: item.supplier })} className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center"><span className="material-symbols-outlined text-[13px]">edit</span></button>
                                            <button type="button" onClick={() => onDeleteUnloading?.(item.id!)} className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center"><span className="material-symbols-outlined text-[13px]">delete</span></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-[11px] text-slate-500 italic">Belum ada entri kedatangan.</p>}
                    <button type="button" onClick={() => setEditUn({ liters: 0, supplier: '' })}
                        className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-sm font-bold transition-colors">
                        <span className="material-symbols-outlined text-[18px]">add_circle</span>Tambah Kedatangan
                    </button>
                </div>
            </Card>

            {/* ═══ Pemakaian Solar ═══ */}
            <Card title="Pemakaian Solar" icon="local_gas_station" color="rose" className="lg:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <InputField label="Boiler A+B" name="solar_boiler" value={boilerAB} unit="m³" color="rose"
                        onChange={(_, v) => onValueChange?.('solar_boiler', numOrNull(v))} />
                    <InputField label="Bengkel" name="solar_bengkel" value={bengkelVal} unit="m³" color="rose"
                        onChange={(_, v) => onValueChange?.('solar_bengkel', numOrNull(v))} />
                    <InputField label="SA/SU 3B" name="solar_3b" value={sasuVal} unit="m³" color="rose"
                        onChange={(_, v) => onValueChange?.('solar_3b', numOrNull(v))} />
                </div>

                <div className="pt-3 mt-1 border-t border-slate-700/50">
                    <SectionLabel label="Detail Entri Permintaan (catatan)" badge={`${solarUsages.length} entri`} />
                    {solarUsages.length > 0 ? (
                        <div className="space-y-2">
                            {solarUsages.map((item, i) => (
                                <div key={item.id ?? i} className="relative flex items-center gap-2 bg-[#101822]/50 border border-rose-500/30 rounded-lg px-3 py-2 pr-16 min-w-0">
                                    <span className="material-symbols-outlined text-rose-400 text-[15px]">upload</span>
                                    <span className="text-white font-medium text-sm">{n(item.liters).toLocaleString('id-ID')} <span className="text-rose-400 text-xs">L</span></span>
                                    <SolarOriginBadge shift={item.shift} />
                                    <span className="text-[10px] text-slate-400 truncate">{item.tujuan}</span>
                                    {item.id && (
                                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            <button type="button" onClick={() => setEditUs({ id: item.id!, liters: item.liters, tujuan: item.tujuan, shift: item.shift, tujuanMode: (['Bengkel', 'SA/SU 3B'].includes(item.tujuan) ? item.tujuan : 'Lainnya') as TujuanMode })} className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center"><span className="material-symbols-outlined text-[13px]">edit</span></button>
                                            <button type="button" onClick={() => onDeleteUsage?.(item.id!)} className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center"><span className="material-symbols-outlined text-[13px]">delete</span></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-[11px] text-slate-500 italic">Belum ada entri permintaan.</p>}
                    <button type="button" onClick={() => setEditUs({ liters: 0, tujuan: 'Bengkel', shift: 'harian', tujuanMode: 'Bengkel' })}
                        className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-sm font-bold transition-colors">
                        <span className="material-symbols-outlined text-[18px]">add_circle</span>Tambah Permintaan
                    </button>
                </div>
            </Card>

            {/* Modal Kedatangan */}
            <Modal open={!!editUn} onClose={() => setEditUn(null)} title={editUn?.id ? 'Edit Kedatangan Solar' : 'Tambah Kedatangan Solar'} color="amber">
                {editUn && (
                    <>
                        <InputField label="Jumlah" unit="L" color="amber" name="liters" thousands
                            value={editUn.liters} onChange={(_, v) => setEditUn({ ...editUn, liters: Number(v) || 0 })} />
                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Supplier</label>
                            <input type="text" value={editUn.supplier} onChange={e => setEditUn({ ...editUn, supplier: e.target.value })} placeholder="Nama supplier..."
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 text-sm transition-all" />
                        </div>
                        <button type="button" onClick={saveUn} disabled={!Number(editUn.liters)}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm transition-colors mt-1">
                            <span className="material-symbols-outlined text-[18px]">save</span>Simpan
                        </button>
                    </>
                )}
            </Modal>

            {/* Modal Permintaan */}
            <Modal open={!!editUs} onClose={() => setEditUs(null)} title={editUs?.id ? 'Edit Permintaan Solar' : 'Tambah Permintaan Solar'} color="rose">
                {editUs && (
                    <>
                        <InputField label="Jumlah" unit="L" color="rose" name="liters" thousands
                            value={editUs.liters} onChange={(_, v) => setEditUs({ ...editUs, liters: Number(v) || 0 })} />
                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Asal / Shift</label>
                            <select value={editUs.shift} onChange={e => setEditUs({ ...editUs, shift: e.target.value })}
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-rose-500 text-sm font-bold transition-all">
                                <option value="harian" className="bg-[#101822]">Harian (ditambah di laporan harian)</option>
                                <option value="pagi" className="bg-[#101822]">Shift Pagi</option>
                                <option value="sore" className="bg-[#101822]">Shift Sore</option>
                                <option value="malam" className="bg-[#101822]">Shift Malam</option>
                            </select>
                        </div>
                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Tujuan</label>
                            <select value={editUs.tujuanMode} onChange={e => {
                                const mode = e.target.value as TujuanMode;
                                setEditUs({ ...editUs, tujuanMode: mode, tujuan: mode !== 'Lainnya' ? mode : '' });
                            }} className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-rose-500 text-sm font-bold transition-all">
                                <option value="Bengkel" className="bg-[#101822]">Bengkel</option>
                                <option value="SA/SU 3B" className="bg-[#101822]">SA/SU 3B</option>
                                <option value="Lainnya" className="bg-[#101822]">Lainnya…</option>
                            </select>
                            {editUs.tujuanMode === 'Lainnya' && (
                                <input type="text" placeholder="Tulis tujuan..." value={editUs.tujuan} onChange={e => setEditUs({ ...editUs, tujuan: e.target.value })}
                                    className="mt-2 w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-rose-500 text-sm transition-all" />
                            )}
                        </div>
                        <button type="button" onClick={saveUs} disabled={!Number(editUs.liters) || (editUs.tujuanMode === 'Lainnya' && !editUs.tujuan.trim())}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm transition-colors mt-1">
                            <span className="material-symbols-outlined text-[18px]">save</span>Simpan
                        </button>
                    </>
                )}
            </Modal>
        </div>
    );
}
