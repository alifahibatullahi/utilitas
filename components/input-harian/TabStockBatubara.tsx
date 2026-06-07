'use client';
import React, { useState } from 'react';
import { Card, CalculatedField, Modal, InputField } from '@/components/input-shift/SharedComponents';
import { formatDate } from '@/lib/utils';
import type { DailyTabProps, CoalCategory, CoalActivityInput } from './types';

const n = (v: number | string | null | undefined) => Number(v) || 0;
const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

const CAT_LABEL: Record<CoalCategory, string> = {
    darat: 'Via Darat',
    laut: 'Via Laut',
    pb2_pf1: 'PB2 · PF1',
    pb2_pf2: 'PB2 · PF2',
    pb3_calc: 'PB3 · Calsinasi',
};

type ModalState = { kind: 'in' | 'out'; category: CoalCategory; rit: string; ton: string; keterangan: string } | null;

export default function TabStockBatubara({
    lautTotalSheet, stockBatubaraSheet, lhubbDate,
    coalActivities = [], onAddCoalActivity, onDeleteCoalActivity,
}: DailyTabProps) {
    const [modal, setModal] = useState<ModalState>(null);

    // Nilai read-only dari Google Sheets untuk tanggal LHUBB yang sama:
    //   - Total Via Laut = kolom DN (formula)
    //   - Stock Batubara = kolom DW (stock_batubara_rendal)
    const show = (v: string | number | null | undefined, fallback: string) =>
        v != null && String(v).trim() !== '' && String(v).trim() !== '-' ? String(v).trim() : fallback;
    const lautTotalDisplay = show(lautTotalSheet, '0');
    const stockDisplay = show(stockBatubaraSheet, '—');
    const lhubbLabel = lhubbDate ? `Data dari LHUBB tanggal ${formatDate(lhubbDate)}.` : 'Data dari LHUBB.';

    // Agregat per category (default 0 bila tidak ada aktivitas)
    const sumCat = (cat: CoalCategory, field: 'rit' | 'ton') =>
        coalActivities.filter(a => a.category === cat).reduce((s, a) => s + n(a[field]), 0);
    const inActs  = coalActivities.filter(a => a.kind === 'in');
    const outActs = coalActivities.filter(a => a.kind === 'out');

    const openModal = (kind: 'in' | 'out', category: CoalCategory) =>
        setModal({ kind, category, rit: '', ton: '', keterangan: '' });

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

    const ActivityRow = ({ id, label, rit, ton }: { id?: string; label: string; rit: number; ton: number }) => (
        <div className="relative flex justify-between items-center px-3 py-2 bg-[#101822]/60 border border-slate-700/50 rounded-lg pr-10">
            <div className="flex flex-col min-w-0">
                <span className="text-xs font-mono font-bold text-amber-300">
                    {fmt(ton)} <span className="text-[10px] text-amber-400">Ton</span>
                    {rit ? <span className="text-slate-400 font-normal"> · {fmt(rit)} Rit</span> : null}
                </span>
                <span className="text-[10px] text-slate-400 truncate">{label}</span>
            </div>
            {id && onDeleteCoalActivity && (
                <button type="button" onClick={() => onDeleteCoalActivity(id)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-colors">
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                </button>
            )}
        </div>
    );

    const AddBtn = ({ kind, category, label, color }: { kind: 'in' | 'out'; category: CoalCategory; label: string; color: string }) => (
        <button type="button" onClick={() => openModal(kind, category)}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-${color}-500/40 bg-${color}-500/10 text-${color}-400 hover:bg-${color}-500/20 text-xs font-bold transition-colors`}>
            <span className="material-symbols-outlined text-[16px]">add_circle</span>{label}
        </button>
    );

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Kedatangan Batubara (IN) ═══ */}
            <Card title="Kedatangan Batubara" icon="inventory_2" color="amber">
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <CalculatedField label="Total Via Darat" value={fmt(sumCat('darat', 'ton'))} unit="Ton" variant="small" />
                    <CalculatedField label="Total Via Laut (hari ini)" value={fmt(sumCat('laut', 'ton'))} unit="Ton" variant="small" />
                </div>
                {inActs.length > 0 && (
                    <div className="space-y-2 mb-3">
                        {inActs.map((a, i) => (
                            <ActivityRow key={a.id ?? i} id={a.id} label={CAT_LABEL[a.category]} rit={n(a.rit)} ton={n(a.ton)} />
                        ))}
                    </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                    <AddBtn kind="in" category="darat" label="Darat" color="amber" />
                    <AddBtn kind="in" category="laut" label="Laut" color="amber" />
                </div>
                <div className="mt-3 pt-3 border-t border-amber-500/20">
                    <CalculatedField label="Total Via Laut (kumulatif)" value={lautTotalDisplay} unit="Ton" variant="small" />
                    <p className="mt-1 text-[10px] text-slate-500">{lhubbLabel}</p>
                </div>
            </Card>

            {/* ═══ Pemindahan Batubara (OUT) ═══ */}
            <Card title="Pemindahan Batubara" icon="local_shipping" color="teal">
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <CalculatedField label="PB2 PF1" value={fmt(sumCat('pb2_pf1', 'ton'))} unit="Ton" variant="small" />
                    <CalculatedField label="PB2 PF2" value={fmt(sumCat('pb2_pf2', 'ton'))} unit="Ton" variant="small" />
                    <CalculatedField label="PB3 Calc" value={fmt(sumCat('pb3_calc', 'ton'))} unit="Ton" variant="small" />
                </div>
                {outActs.length > 0 && (
                    <div className="space-y-2 mb-3">
                        {outActs.map((a, i) => (
                            <ActivityRow key={a.id ?? i} id={a.id} label={CAT_LABEL[a.category]} rit={n(a.rit)} ton={n(a.ton)} />
                        ))}
                    </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                    <AddBtn kind="out" category="pb2_pf1" label="PF1" color="teal" />
                    <AddBtn kind="out" category="pb2_pf2" label="PF2" color="teal" />
                    <AddBtn kind="out" category="pb3_calc" label="Calc" color="teal" />
                </div>
            </Card>

            {/* ═══ Stock Batubara (kolom DW) ═══ */}
            <Card title="Stock Batubara" icon="database" color="indigo">
                <CalculatedField label="Stock Batubara" value={stockDisplay} unit="Ton" variant="primary" />
                <p className="mt-1 text-[10px] text-slate-500">{lhubbLabel}</p>
            </Card>

            {/* Modal Tambah Aktivitas */}
            <Modal open={!!modal} onClose={() => setModal(null)}
                title={modal ? `Tambah Aktivitas — ${CAT_LABEL[modal.category]}` : ''}
                color={modal?.kind === 'in' ? 'amber' : 'teal'}>
                {modal && (
                    <>
                        {modal.kind === 'out' && (
                            <InputField label="Rit" unit="Rit" color="teal" name="rit"
                                value={modal.rit} onChange={(_, v) => setModal({ ...modal, rit: String(v ?? '') })} />
                        )}
                        <InputField label="Tonase" unit="Ton" color={modal.kind === 'in' ? 'amber' : 'teal'} name="ton" thousands
                            value={modal.ton} onChange={(_, v) => setModal({ ...modal, ton: String(v ?? '') })} />
                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Keterangan (opsional)</label>
                            <input type="text" value={modal.keterangan} onChange={e => setModal({ ...modal, keterangan: e.target.value })}
                                placeholder="Catatan..."
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 text-sm transition-all" />
                        </div>
                        <button type="button" onClick={saveModal} disabled={!modal.ton && !modal.rit}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl ${modal.kind === 'in' ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-teal-500 hover:bg-teal-400 text-white'} disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm transition-colors mt-1`}>
                            <span className="material-symbols-outlined text-[18px]">save</span>Simpan
                        </button>
                    </>
                )}
            </Modal>
        </div>
    );
}
