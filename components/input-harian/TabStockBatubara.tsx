'use client';
import React, { useState } from 'react';
import { Card, CalculatedField, Modal, InputField, SectionLabel } from '@/components/input-shift/SharedComponents';
import { formatDate, parseSheetNumber } from '@/lib/utils';
import type { CoalReviewProps, CoalCategory, CoalActivityInput } from './types';

const n = (v: number | string | null | undefined) => Number(v) || 0;
const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

const CAT_LABEL: Record<CoalCategory, string> = {
    darat: 'Via Darat',
    laut: 'Via Laut',
    pb2_pf1: 'Pabrik 2 · PF1',
    pb2_pf2: 'Pabrik 2 · PF2',
    pb3_calc: 'Pabrik 3 · Calsinasi',
};

const CATS_IN: CoalCategory[]  = ['darat', 'laut'];
const CATS_OUT: CoalCategory[] = ['pb2_pf1', 'pb2_pf2', 'pb3_calc'];

type ModalState = { kind: 'in' | 'out'; category: CoalCategory; rit: string; ton: string; keterangan: string } | null;

export default function TabStockBatubara({
    stockBatubaraSheet, lhubbDate,
    coalActivities = [], onAddCoalActivity, onDeleteCoalActivity,
}: CoalReviewProps) {
    const [modal, setModal] = useState<ModalState>(null);

    // Nilai read-only dari Google Sheets untuk tanggal LHUBB yang sama:
    //   - Stock Batubara = kolom DW (stock_batubara_rendal)
    const lhubbLabel = lhubbDate ? `Data dari LHUBB tanggal ${formatDate(lhubbDate)}.` : 'Data dari LHUBB.';

    // Agregat per category (default 0 bila tidak ada aktivitas)
    const sumCat = (cat: CoalCategory, field: 'rit' | 'ton') =>
        coalActivities.filter(a => a.category === cat).reduce((s, a) => s + n(a[field]), 0);
    const inActs  = coalActivities.filter(a => a.kind === 'in');
    const outActs = coalActivities.filter(a => a.kind === 'out');
    const totalIn  = inActs.reduce((s, a) => s + n(a.ton), 0);
    const totalOut = outActs.reduce((s, a) => s + n(a.ton), 0);

    // Stock batubara = stock LHUBB + kedatangan (in) − pemindahan (out).
    const stockBase = parseSheetNumber(stockBatubaraSheet);
    const stockDisplay = stockBase != null
        ? fmt(stockBase + totalIn - totalOut)
        : (stockBatubaraSheet != null && String(stockBatubaraSheet).trim() !== '' && String(stockBatubaraSheet).trim() !== '-'
            ? String(stockBatubaraSheet).trim()
            : '—');

    const openModal = (kind: 'in' | 'out') =>
        setModal({ kind, category: kind === 'in' ? 'darat' : 'pb2_pf1', rit: '', ton: '', keterangan: '' });

    const saveModal = async () => {
        if (!modal) return;
        const payload: CoalActivityInput = {
            kind: modal.kind,
            category: modal.category,
            rit: Number(modal.rit) || 0,
            ton: Number(modal.ton) || 0,
            keterangan: modal.keterangan.trim() || undefined,
        };
        await onAddCoalActivity?.(payload);
        setModal(null);
    };

    // ── Baris review per kategori (default 0) ─────────────────────────────────
    const ReviewRow = ({ label, ton, rit }: { label: string; ton: number; rit?: number }) => (
        <div className="flex flex-col gap-1 rounded-lg border bg-[#1f2b3e]/30 border-slate-700/30 p-2.5">
            <span className="text-white text-[10px] font-medium uppercase tracking-wider truncate">{label}</span>
            <div className="flex items-baseline justify-between gap-1">
                <span className="text-white font-mono font-bold text-sm">{fmt(ton)} <span className="text-slate-500 text-[10px]">Ton</span></span>
                {rit !== undefined && <span className="text-slate-400 font-mono text-[11px]">{fmt(rit)} Rit</span>}
            </div>
        </div>
    );

    // ── Daftar entri (mirip EntryList solar) ──────────────────────────────────
    const EntryList = ({ acts, accent }: { acts: typeof coalActivities; accent: 'amber' | 'rose' }) => (
        <div className="flex flex-col gap-2">
            {acts.map((a, i) => (
                <div key={a.id ?? i}
                    className={`relative flex justify-between items-center px-3 py-2 bg-[#101822] border border-${accent}-500/30 rounded-lg pr-10`}>
                    <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-mono font-bold text-${accent}-300`}>
                            {fmt(n(a.ton))} <span className={`text-[10px] text-${accent}-400`}>Ton</span>
                            {n(a.rit) ? <span className="text-slate-400 font-normal"> · {fmt(n(a.rit))} Rit</span> : null}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                            {CAT_LABEL[a.category]}{a.keterangan ? ` · ${a.keterangan}` : ''}
                        </span>
                    </div>
                    {a.id && onDeleteCoalActivity && (
                        <button type="button" onClick={() => onDeleteCoalActivity(a.id!)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                    )}
                </div>
            ))}
        </div>
    );

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Kedatangan Batubara (IN) ═══ */}
            <Card title="Kedatangan Batubara" icon="download" color="amber">
                {inActs.length > 0 && <EntryList acts={inActs} accent="amber" />}
                <button type="button" onClick={() => openModal('in')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-sm font-bold transition-colors">
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Tambah Kedatangan
                </button>
            </Card>

            {/* ═══ Pemindahan Batubara (OUT) ═══ */}
            <Card title="Pemindahan Batubara" icon="upload" color="rose">
                {outActs.length > 0 && <EntryList acts={outActs} accent="rose" />}
                <button type="button" onClick={() => openModal('out')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-sm font-bold transition-colors">
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Tambah Pemindahan
                </button>
            </Card>

            {/* ═══ Review In/Out Batubara (default 0 bila tidak ada aktivitas) ═══ */}
            <Card title={`Review In/Out Batubara${lhubbDate ? ` ${formatDate(lhubbDate)}` : ''}`} icon="fact_check" color="slate" className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    <div className="space-y-2">
                        <SectionLabel label="Kedatangan" badge="In" />
                        <div className="grid grid-cols-2 gap-2">
                            {CATS_IN.map(cat => (
                                <ReviewRow key={cat} label={CAT_LABEL[cat]} ton={sumCat(cat, 'ton')} />
                            ))}
                        </div>
                        <div className="flex justify-between items-center px-1 pt-1">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total Kedatangan hari ini</span>
                            <span className="text-sm font-mono font-bold text-amber-300">{fmt(totalIn)} Ton</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <SectionLabel label="Pemindahan" badge="Out" />
                        <div className="grid grid-cols-3 gap-2">
                            {CATS_OUT.map(cat => (
                                <ReviewRow key={cat} label={CAT_LABEL[cat]} ton={sumCat(cat, 'ton')} rit={sumCat(cat, 'rit')} />
                            ))}
                        </div>
                        <div className="flex justify-between items-center px-1 pt-1">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total Pemindahan hari ini</span>
                            <span className="text-sm font-mono font-bold text-rose-300">{fmt(totalOut)} Ton</span>
                        </div>
                    </div>
                </div>
                {/* Stock Batubara — dari Sheets LHUBB, disimpan ke Supabase saat submit */}
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <CalculatedField label="Stock Batubara" value={stockDisplay} unit="Ton" variant="primary" />
                    <p className="mt-1 text-[10px] text-slate-500">{lhubbLabel}</p>
                </div>
            </Card>

            {/* Modal — per kartu (Kedatangan / Pemindahan), pola solar */}
            <Modal open={!!modal} onClose={() => setModal(null)}
                title={modal?.kind === 'in' ? 'Kedatangan Batubara' : 'Pemindahan Batubara'}
                color={modal?.kind === 'in' ? 'amber' : 'rose'}>
                {modal && (() => {
                    const col = modal.kind === 'in' ? 'amber' : 'rose';
                    const cats = modal.kind === 'in' ? CATS_IN : CATS_OUT;
                    return (
                        <>
                            <div className="space-y-1.5 w-full">
                                <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Kategori</label>
                                <select value={modal.category}
                                    onChange={e => setModal({ ...modal, category: e.target.value as CoalCategory })}
                                    className={`w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-${col}-500 text-sm font-bold transition-all`}>
                                    {cats.map(cat => (
                                        <option key={cat} value={cat} className="bg-[#101822] text-white">{CAT_LABEL[cat]}</option>
                                    ))}
                                </select>
                            </div>
                            {modal.kind === 'out' && (
                                <InputField label="Rit" unit="Rit" color={col} name="rit"
                                    value={modal.rit} onChange={(_, v) => setModal({ ...modal, rit: String(v ?? '') })} />
                            )}
                            <InputField label="Tonase" unit="Ton" color={col} name="ton" thousands
                                value={modal.ton} onChange={(_, v) => setModal({ ...modal, ton: String(v ?? '') })} />
                            <div className="space-y-1.5 w-full">
                                <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Keterangan (opsional)</label>
                                <input type="text" value={modal.keterangan} onChange={e => setModal({ ...modal, keterangan: e.target.value })}
                                    placeholder="Catatan..."
                                    className={`w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-${col}-500 text-sm transition-all`} />
                            </div>
                            <button type="button" onClick={saveModal} disabled={!modal.ton && !modal.rit}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl ${modal.kind === 'in' ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-rose-500 hover:bg-rose-400 text-white'} disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm transition-colors mt-1`}>
                                <span className="material-symbols-outlined text-[18px]">save</span>Simpan
                            </button>
                        </>
                    );
                })()}
            </Modal>
        </div>
    );
}
