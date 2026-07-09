'use client';
import React from 'react';
import { Card, InputField, SectionLabel } from '@/components/input-shift/SharedComponents';
import type { CoalReviewProps } from './types';

// Kedatangan (IN) hanya ton; Pemindahan (OUT) rit + ton. Tiap field default 0 & editable.
const IN_CATS = [
    { label: 'Via Darat', ton: 'darat_24_ton' },
    { label: 'Via Laut', ton: 'laut_24_ton' },
] as const;
const OUT_CATS = [
    { label: 'Pabrik 2 · PF1', rit: 'pb2_pf1_rit', ton: 'pb2_pf1_ton' },
    { label: 'Pabrik 2 · PF2', rit: 'pb2_pf2_rit', ton: 'pb2_pf2_ton' },
    { label: 'Pabrik 3 · Calsinasi', rit: 'pb3_calc_rit', ton: 'pb3_calc_ton' },
] as const;

/** Form In/Out batubara — input langsung per kategori (bukan modal). Tiap field default 0,
 *  bisa diedit; nilai 0 yang tak diubah tetap tersimpan 0 ke Google Sheets (mapper setNum0). */
export default function TabStockBatubara({ coalTransfer = {}, onCoalTransferChange }: CoalReviewProps) {
    const val = (name: string) => coalTransfer[name] ?? 0;
    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Kedatangan Batubara (IN) ═══ */}
            <Card title="Kedatangan Batubara" icon="download" color="amber">
                <p className="text-[10px] text-slate-500 -mt-1">Default 0 — isi bila ada kedatangan. Nilai 0 tetap tersimpan ke Sheets.</p>
                <div className="grid grid-cols-2 gap-3">
                    {IN_CATS.map(c => (
                        <InputField key={c.ton} label={c.label} unit="Ton" color="amber" name={c.ton} thousands
                            value={val(c.ton)} onChange={onCoalTransferChange} />
                    ))}
                </div>
            </Card>

            {/* ═══ Pemindahan Batubara (OUT) ═══ */}
            <Card title="Pemindahan Batubara" icon="upload" color="rose">
                <p className="text-[10px] text-slate-500 -mt-1">Default 0 — isi bila ada pemindahan. Nilai 0 tetap tersimpan ke Sheets.</p>
                <div className="space-y-3">
                    {OUT_CATS.map(c => (
                        <div key={c.ton}>
                            <SectionLabel label={c.label} />
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Rit" unit="Rit" color="rose" name={c.rit}
                                    value={val(c.rit)} onChange={onCoalTransferChange} />
                                <InputField label="Tonase" unit="Ton" color="rose" name={c.ton} thousands
                                    value={val(c.ton)} onChange={onCoalTransferChange} />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
