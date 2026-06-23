'use client';
import React, { useState } from 'react';
import { Card, Modal, InputField, SectionLabel } from '@/components/input-shift/SharedComponents';
import type { SolarReviewProps, SolarUnloadingEntry, SolarUsageEntry } from './types';

const n = (v: number | string | null | undefined) => Number(v) || 0;
const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');
const shiftLabel: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };
type TujuanMode = 'Bengkel' | 'SA/SU 3B' | 'Lainnya';

type UnModal = { id?: string; liters: string; supplier: string } | null;
type UsModal = { id?: string; liters: string; shift: string; tujuan: string; tujuanMode: TujuanMode } | null;

/** Editor solar penuh: kedatangan + permintaan (tambah/edit/hapus), level tank (kemarin →
 *  hari ini), Pemakaian Boiler A+B manual (supervisor), dan kartu Neraca Solar sebagai
 *  panduan. Entri solar disimpan dalam Liter; level & Boiler A+B dalam m³. */
export default function TabSolarReview({
    solarUnloadings = [], solarUsages = [],
    solarLevel = null, prevSolarLevel = null,
    boilerAB = null, canEditBoilerAB = false,
    onAddUnloading, onEditUnloading, onDeleteUnloading,
    onAddUsage, onEditUsage, onDeleteUsage,
    onLevelChange, onBoilerABChange,
}: SolarReviewProps) {
    const [unModal, setUnModal] = useState<UnModal>(null);
    const [usModal, setUsModal] = useState<UsModal>(null);

    // ── Agregat m³ (entri solar disimpan dalam Liter → ÷1000) ──────────────────
    const kedatanganM3 = solarUnloadings.reduce((s, e) => s + n(e.liters), 0) / 1000;
    const permintaanM3 = solarUsages.reduce((s, e) => s + n(e.liters), 0) / 1000;
    const sumTujuanM3 = (t: string) => solarUsages.filter(e => e.tujuan === t).reduce((s, e) => s + n(e.liters), 0) / 1000;
    const bengkelM3 = sumTujuanM3('Bengkel');
    const sasuM3 = sumTujuanM3('SA/SU 3B');
    const lainnyaM3 = permintaanM3 - bengkelM3 - sasuM3;
    const boilerM3 = n(boilerAB);

    // ── Neraca: levelKemarin + kedatangan − (permintaan + boiler) ≈ levelHariIni ─
    const levelKemarin = prevSolarLevel != null ? n(prevSolarLevel) : null;
    const levelHariIni = solarLevel != null ? n(solarLevel) : null;
    const delta = levelKemarin != null && levelHariIni != null ? levelHariIni - levelKemarin : null;
    const expectedLevel = levelKemarin != null ? levelKemarin + kedatanganM3 - permintaanM3 - boilerM3 : null;
    const unexplained = expectedLevel != null && levelHariIni != null ? levelHariIni - expectedLevel : null;
    const balanced = unexplained != null && Math.abs(unexplained) < 0.5;

    // ── Modal save ─────────────────────────────────────────────────────────────
    const saveUn = async () => {
        if (!unModal) return;
        const f = { liters: Number(unModal.liters) || 0, supplier: unModal.supplier.trim() };
        if (unModal.id) await onEditUnloading?.(unModal.id, f);
        else await onAddUnloading?.(f);
        setUnModal(null);
    };
    const saveUs = async () => {
        if (!usModal) return;
        const tujuan = (usModal.tujuanMode === 'Lainnya' ? usModal.tujuan : usModal.tujuanMode).trim();
        if (!tujuan) return; // tujuan wajib
        const f = { liters: Number(usModal.liters) || 0, tujuan, shift: usModal.shift };
        if (usModal.id) await onEditUsage?.(usModal.id, f);
        else await onAddUsage?.(f);
        setUsModal(null);
    };
    const usTujuanInvalid = !!usModal && (usModal.tujuanMode === 'Lainnya' ? !usModal.tujuan.trim() : false);

    // ── Daftar entri ───────────────────────────────────────────────────────────
    const UnloadingList = ({ items }: { items: SolarUnloadingEntry[] }) => (
        <div className="space-y-2">
            {items.map((item, i) => (
                <div key={item.id ?? i} className="flex items-center justify-between gap-2 bg-[#101822]/50 border border-amber-500/30 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-amber-400 text-[15px]">local_shipping</span>
                        <span className="text-white font-medium text-sm">{n(item.liters).toLocaleString('id-ID')} <span className="text-amber-400 text-xs">L</span></span>
                        <span className="text-[10px] text-slate-400 truncate">{item.supplier}</span>
                    </div>
                    {item.id && (
                        <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => setUnModal({ id: item.id!, liters: String(item.liters), supplier: item.supplier })}
                                className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-[13px]">edit</span>
                            </button>
                            <button type="button" onClick={() => onDeleteUnloading?.(item.id!)}
                                className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-[13px]">delete</span>
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    const UsageList = ({ items }: { items: SolarUsageEntry[] }) => (
        <div className="space-y-2">
            {items.map((item, i) => (
                <div key={item.id ?? i} className="flex items-center justify-between gap-2 bg-[#101822]/50 border border-rose-500/30 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-rose-400 text-[15px]">upload</span>
                        <span className="text-white font-medium text-sm">{n(item.liters).toLocaleString('id-ID')} <span className="text-rose-400 text-xs">L</span></span>
                        <span className="text-[10px] text-slate-400 truncate">{item.tujuan} · {shiftLabel[item.shift] ?? item.shift}</span>
                    </div>
                    {item.id && (
                        <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => setUsModal({
                                id: item.id!, liters: String(item.liters), shift: item.shift, tujuan: item.tujuan,
                                tujuanMode: (['Bengkel', 'SA/SU 3B'].includes(item.tujuan) ? item.tujuan : 'Lainnya') as TujuanMode,
                            })}
                                className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-[13px]">edit</span>
                            </button>
                            <button type="button" onClick={() => onDeleteUsage?.(item.id!)}
                                className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-[13px]">delete</span>
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    const BalanceRow = ({ label, value, sign, accent }: { label: string; value: number; sign?: '+' | '−'; accent?: string }) => (
        <div className="flex items-baseline justify-between gap-2">
            <span className="text-slate-400 text-[11px]">{sign && <span className={`font-mono font-bold mr-1 ${accent ?? 'text-slate-400'}`}>{sign}</span>}{label}</span>
            <span className={`font-mono font-bold text-sm ${accent ?? 'text-slate-100'}`}>{fmt(value)} <span className="text-[10px] text-slate-500">m³</span></span>
        </div>
    );

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Level Tank Solar: Kemarin → Hari ini ═══ */}
            <Card title="Level Tank Solar" icon="water_drop" color="orange">
                <div className="grid grid-cols-2 gap-3 items-end">
                    <div className="rounded-lg border border-slate-700/40 bg-[#101822]/40 px-3 py-2.5">
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">Level Kemarin</p>
                        <p className="text-lg font-mono font-bold text-slate-300">{levelKemarin != null ? fmt(levelKemarin) : '—'} <span className="text-[10px] text-slate-500">m³</span></p>
                    </div>
                    <InputField label="Level Hari Ini" name="solar_tank_a" value={solarLevel} unit="m³" color="orange"
                        onChange={(_, v) => onLevelChange?.(v == null || v === '' ? null : Number(v))} />
                </div>
                {delta != null && (
                    <div className="mt-2 flex items-center gap-1.5 px-1">
                        <span className={`material-symbols-outlined text-[15px] ${delta < 0 ? 'text-orange-400' : delta > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {delta < 0 ? 'trending_down' : delta > 0 ? 'trending_up' : 'trending_flat'}
                        </span>
                        <span className="text-[11px] text-slate-400">Perubahan level: </span>
                        <span className={`text-sm font-mono font-bold ${delta < 0 ? 'text-orange-300' : delta > 0 ? 'text-emerald-300' : 'text-slate-300'}`}>
                            {delta > 0 ? '+' : ''}{fmt(delta)} m³
                        </span>
                    </div>
                )}

                {/* Pemakaian Boiler A+B — manual supervisor */}
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                    {canEditBoilerAB ? (
                        <>
                            <InputField label="Pemakaian Solar Boiler A+B" name="solar_boiler" value={boilerAB} unit="m³" color="rose"
                                onChange={(_, v) => onBoilerABChange?.(v == null || v === '' ? null : Number(v))} />
                            <p className="mt-1 text-[10px] text-slate-500">Diisi manual oleh supervisor — konsumsi solar boiler (penyeimbang neraca). Ditulis ke kolom Sheets CL.</p>
                        </>
                    ) : (
                        <div className="flex items-baseline justify-between gap-2 rounded-lg border border-slate-700/40 bg-[#101822]/40 px-3 py-2.5">
                            <div>
                                <p className="text-[9px] text-slate-400 uppercase tracking-wider">Pemakaian Boiler A+B</p>
                                <p className="text-[10px] text-slate-500">Diisi saat review oleh supervisor</p>
                            </div>
                            <span className="text-lg font-mono font-bold text-slate-300">{boilerAB != null ? fmt(boilerM3) : '—'} <span className="text-[10px] text-slate-500">m³</span></span>
                        </div>
                    )}
                </div>
            </Card>

            {/* ═══ Neraca Solar ═══ */}
            <Card title="Neraca Solar" icon="balance" color={balanced ? 'emerald' : 'amber'}>
                <div className="space-y-1.5">
                    <BalanceRow label="Level Kemarin" value={levelKemarin ?? 0} />
                    <BalanceRow label="Kedatangan" value={kedatanganM3} sign="+" accent="text-amber-300" />
                    <BalanceRow label="Permintaan (Bengkel/SA·SU/Lainnya)" value={permintaanM3} sign="−" accent="text-rose-300" />
                    <BalanceRow label="Pemakaian Boiler A+B" value={boilerM3} sign="−" accent="text-rose-300" />
                    <div className="border-t border-slate-700/50 my-1.5" />
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-slate-300 text-[11px] font-semibold">Perkiraan Level Hari Ini</span>
                        <span className="font-mono font-bold text-sm text-slate-100">{expectedLevel != null ? fmt(expectedLevel) : '—'} <span className="text-[10px] text-slate-500">m³</span></span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-slate-400 text-[11px]">Level Hari Ini (aktual)</span>
                        <span className="font-mono font-bold text-sm text-slate-100">{levelHariIni != null ? fmt(levelHariIni) : '—'} <span className="text-[10px] text-slate-500">m³</span></span>
                    </div>
                </div>

                {unexplained != null && (
                    <div className={`mt-3 rounded-lg border px-3 py-2.5 ${balanced ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
                        <div className="flex items-center gap-1.5">
                            <span className={`material-symbols-outlined text-[16px] ${balanced ? 'text-emerald-400' : 'text-amber-400'}`}>{balanced ? 'check_circle' : 'warning'}</span>
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${balanced ? 'text-emerald-300' : 'text-amber-300'}`}>
                                {balanced ? 'Neraca cocok' : 'Selisih tak terjelaskan'}
                            </span>
                            <span className={`ml-auto text-sm font-mono font-bold ${balanced ? 'text-emerald-300' : 'text-amber-300'}`}>{unexplained > 0 ? '+' : ''}{fmt(unexplained)} m³</span>
                        </div>
                        {!balanced && (
                            <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                                Perubahan level belum sepenuhnya terjelaskan oleh kedatangan/pemakaian. {canEditBoilerAB ? 'Setel “Pemakaian Boiler A+B” agar neraca masuk, atau cek entri.' : 'Cek entri kedatangan/permintaan & level.'}
                            </p>
                        )}
                    </div>
                )}
                {levelKemarin == null && (
                    <p className="mt-2 text-[10px] text-slate-500 italic">Level kemarin belum tersedia — neraca dihitung tanpa baseline.</p>
                )}
            </Card>

            {/* ═══ Kedatangan Solar ═══ */}
            <Card title="Kedatangan Solar" icon="local_shipping" color="amber">
                {solarUnloadings.length > 0
                    ? <UnloadingList items={solarUnloadings} />
                    : <p className="text-[11px] text-slate-500 italic">Belum ada data kedatangan solar hari ini</p>}
                <button type="button" onClick={() => setUnModal({ liters: '', supplier: '' })}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-sm font-bold transition-colors">
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Tambah Kedatangan
                </button>
            </Card>

            {/* ═══ Permintaan Solar ═══ */}
            <Card title="Permintaan Solar" icon="upload" color="rose">
                {solarUsages.length > 0
                    ? <UsageList items={solarUsages} />
                    : <p className="text-[11px] text-slate-500 italic">Belum ada data permintaan solar hari ini</p>}
                <button type="button" onClick={() => setUsModal({ liters: '', shift: 'pagi', tujuan: 'Bengkel', tujuanMode: 'Bengkel' })}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-sm font-bold transition-colors">
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Tambah Permintaan
                </button>
            </Card>

            {/* Rincian pemakaian per tujuan */}
            <Card title="Rincian Pemakaian Solar" icon="summarize" color="slate" className="lg:col-span-2">
                <SectionLabel label="Penggunaan Solar Harian (m³)" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'BOILER A+B', value: boilerM3, accent: 'text-rose-300' },
                        { label: 'BENGKEL', value: bengkelM3, accent: 'text-slate-200' },
                        { label: 'SA/SU 3B', value: sasuM3, accent: 'text-slate-200' },
                        { label: 'LAINNYA', value: lainnyaM3, accent: 'text-slate-200' },
                    ].map(c => (
                        <div key={c.label} className="rounded-lg border border-slate-700/40 bg-[#101822]/40 px-3 py-2.5 text-center">
                            <p className="text-[9px] text-slate-400 uppercase tracking-wider">{c.label}</p>
                            <p className={`text-sm font-mono font-bold ${c.accent}`}>{fmt(c.value)} <span className="text-[9px] text-slate-500">m³</span></p>
                        </div>
                    ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">Boiler A+B → CL, Bengkel → CM, SA/SU 3B → CN. “Lainnya” tercatat di neraca tapi tidak ditulis ke Sheets.</p>
            </Card>

            {/* Modal Kedatangan (tambah/edit) */}
            <Modal open={!!unModal} onClose={() => setUnModal(null)} title={unModal?.id ? 'Edit Kedatangan Solar' : 'Tambah Kedatangan Solar'} color="amber">
                {unModal && (
                    <>
                        <InputField label="Jumlah" unit="L" color="amber" name="liters" thousands
                            value={unModal.liters} onChange={(_, v) => setUnModal({ ...unModal, liters: String(v ?? '') })} />
                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Supplier</label>
                            <input type="text" value={unModal.supplier} onChange={e => setUnModal({ ...unModal, supplier: e.target.value })}
                                placeholder="Nama supplier..."
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 text-sm transition-all" />
                        </div>
                        <button type="button" onClick={saveUn} disabled={!Number(unModal.liters)}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm transition-colors mt-1">
                            <span className="material-symbols-outlined text-[18px]">save</span>Simpan
                        </button>
                    </>
                )}
            </Modal>

            {/* Modal Permintaan (tambah/edit) */}
            <Modal open={!!usModal} onClose={() => setUsModal(null)} title={usModal?.id ? 'Edit Permintaan Solar' : 'Tambah Permintaan Solar'} color="rose">
                {usModal && (
                    <>
                        <InputField label="Jumlah" unit="L" color="rose" name="liters" thousands
                            value={usModal.liters} onChange={(_, v) => setUsModal({ ...usModal, liters: String(v ?? '') })} />
                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Shift</label>
                            <select value={usModal.shift} onChange={e => setUsModal({ ...usModal, shift: e.target.value })}
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-rose-500 text-sm font-bold transition-all">
                                <option value="pagi" className="bg-[#101822]">Pagi</option>
                                <option value="siang" className="bg-[#101822]">Siang</option>
                                <option value="malam" className="bg-[#101822]">Malam</option>
                            </select>
                        </div>
                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Tujuan</label>
                            <select value={usModal.tujuanMode} onChange={e => {
                                const mode = e.target.value as TujuanMode;
                                setUsModal({ ...usModal, tujuanMode: mode, tujuan: mode !== 'Lainnya' ? mode : '' });
                            }}
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-rose-500 text-sm font-bold transition-all">
                                <option value="Bengkel" className="bg-[#101822]">Bengkel</option>
                                <option value="SA/SU 3B" className="bg-[#101822]">SA/SU 3B</option>
                                <option value="Lainnya" className="bg-[#101822]">Lainnya…</option>
                            </select>
                            {usModal.tujuanMode === 'Lainnya' && (
                                <input type="text" placeholder="Tulis tujuan..." value={usModal.tujuan}
                                    onChange={e => setUsModal({ ...usModal, tujuan: e.target.value })}
                                    className="mt-2 w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-rose-500 text-sm transition-all" />
                            )}
                            <p className="text-[10px] text-slate-500">Boiler A+B bukan permintaan — diisi terpisah oleh supervisor.</p>
                        </div>
                        <button type="button" onClick={saveUs} disabled={!Number(usModal.liters) || usTujuanInvalid}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm transition-colors mt-1">
                            <span className="material-symbols-outlined text-[18px]">save</span>Simpan
                        </button>
                    </>
                )}
            </Modal>
        </div>
    );
}
