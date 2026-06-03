'use client';
import React from 'react';
import { InputField, Card, CalculatedField } from '@/components/input-shift/SharedComponents';
import { formatDate } from '@/lib/utils';
import type { DailyTabProps } from './types';

export default function TabStockBatubara({
    coalTransfer, onCoalTransferChange, lautTotalSheet, stockBatubaraSheet, lhubbDate,
}: DailyTabProps) {
    // Nilai read-only dari Google Sheets untuk tanggal LHUBB yang sama:
    //   - Total Via Laut = kolom DN (formula)
    //   - Stock Batubara = kolom DW (stock_batubara_rendal)
    const show = (v: string | number | null | undefined, fallback: string) =>
        v != null && String(v).trim() !== '' && String(v).trim() !== '-' ? String(v).trim() : fallback;
    const lautTotalDisplay = show(lautTotalSheet, '0');
    const stockDisplay = show(stockBatubaraSheet, '—');
    const lhubbLabel = lhubbDate ? `Data dari LHUBB tanggal ${formatDate(lhubbDate)}.` : 'Data dari LHUBB.';

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Pemindahan ke PB II ═══ */}
            <Card title="Pemindahan Batubara ke Pabrik 2" icon="local_shipping" color="teal">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="PF1 Rit"    name="pb2_pf1_rit" value={coalTransfer.pb2_pf1_rit ?? ''} onChange={onCoalTransferChange} unit="Rit" color="teal" />
                    <InputField label="PF1 Tonase" name="pb2_pf1_ton" value={coalTransfer.pb2_pf1_ton ?? ''} onChange={onCoalTransferChange} unit="Ton" color="teal" />
                    <InputField label="PF2 Rit"    name="pb2_pf2_rit" value={coalTransfer.pb2_pf2_rit ?? ''} onChange={onCoalTransferChange} unit="Rit" color="teal" />
                    <InputField label="PF2 Tonase" name="pb2_pf2_ton" value={coalTransfer.pb2_pf2_ton ?? ''} onChange={onCoalTransferChange} unit="Ton" color="teal" />
                </div>
            </Card>

            {/* ═══ Pemindahan ke PB III ═══ */}
            <Card title="Pemindahan Batubara ke Pabrik 3" icon="factory" color="emerald">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Calsinasi Rit"    name="pb3_calc_rit" value={coalTransfer.pb3_calc_rit ?? ''} onChange={onCoalTransferChange} unit="Rit" color="emerald" />
                    <InputField label="Calsinasi Tonase" name="pb3_calc_ton" value={coalTransfer.pb3_calc_ton ?? ''} onChange={onCoalTransferChange} unit="Ton" color="emerald" />
                </div>
            </Card>

            {/* ═══ Kedatangan Batubara ═══ */}
            <Card title="Kedatangan Batubara" icon="inventory_2" color="amber">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Via Darat" name="darat_24_ton" value={coalTransfer.darat_24_ton ?? ''} onChange={onCoalTransferChange} unit="Ton" color="amber" />
                    <InputField label="Via Laut"  name="laut_24_ton"  value={coalTransfer.laut_24_ton ?? ''}  onChange={onCoalTransferChange} unit="Ton" color="amber" />
                </div>
                <div className="mt-3 pt-3 border-t border-amber-500/20">
                    <CalculatedField label="Total Via Laut" value={lautTotalDisplay} unit="Ton" variant="small" />
                    <p className="mt-1 text-[10px] text-slate-500">{lhubbLabel}</p>
                </div>
            </Card>

            {/* ═══ Stock Batubara (kolom DW) ═══ */}
            <Card title="Stock Batubara" icon="database" color="indigo">
                <CalculatedField label="Stock Batubara" value={stockDisplay} unit="Ton" variant="primary" />
                <p className="mt-1 text-[10px] text-slate-500">{lhubbLabel}</p>
            </Card>

        </div>
    );
}
