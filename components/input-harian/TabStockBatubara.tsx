'use client';
import React from 'react';
import { InputField, Card, CalculatedField } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

export default function TabStockBatubara({
    coalTransfer, prevCoalTransfer, onCoalTransferChange,
}: DailyTabProps) {
    const N0 = (v: any) => Number(v) || 0;

    const calc = {
        pb2_total_pf1_rit:  N0(prevCoalTransfer?.pb2_total_pf1_rit)  + N0(coalTransfer.pb2_pf1_rit),
        pb2_total_pf1_ton:  N0(prevCoalTransfer?.pb2_total_pf1_ton)  + N0(coalTransfer.pb2_pf1_ton),
        pb2_total_pf2_rit:  N0(prevCoalTransfer?.pb2_total_pf2_rit)  + N0(coalTransfer.pb2_pf2_rit),
        pb2_total_pf2_ton:  N0(prevCoalTransfer?.pb2_total_pf2_ton)  + N0(coalTransfer.pb2_pf2_ton),
        pb3_total_calc_rit: N0(prevCoalTransfer?.pb3_total_calc_rit) + N0(coalTransfer.pb3_calc_rit),
        pb3_total_calc_ton: N0(prevCoalTransfer?.pb3_total_calc_ton) + N0(coalTransfer.pb3_calc_ton),
        darat_total_ton:    N0(prevCoalTransfer?.darat_total_ton)    + N0(coalTransfer.darat_24_ton),
        laut_total_ton:     N0(prevCoalTransfer?.laut_total_ton)     + N0(coalTransfer.laut_24_ton),
    };

    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(2) : v.toString();

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Pemindahan ke PB II ═══ */}
            <Card title="Pemindahan Batubara ke Pabrik 2" icon="local_shipping" color="teal">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="PF1" name="pb2_pf1_rit" value={coalTransfer.pb2_pf1_rit} onChange={onCoalTransferChange} unit="Rit" color="teal" />
                    <InputField label="PF1" name="pb2_pf1_ton" value={coalTransfer.pb2_pf1_ton} onChange={onCoalTransferChange} unit="Ton" color="teal" />
                    <InputField label="PF2" name="pb2_pf2_rit" value={coalTransfer.pb2_pf2_rit} onChange={onCoalTransferChange} unit="Rit" color="teal" />
                    <InputField label="PF2" name="pb2_pf2_ton" value={coalTransfer.pb2_pf2_ton} onChange={onCoalTransferChange} unit="Ton" color="teal" />
                </div>
                <div className="mt-3 pt-3 border-t border-teal-500/20 grid grid-cols-2 gap-3">
                    <CalculatedField label="Total PF1 (Rit)" value={fmt(calc.pb2_total_pf1_rit)} unit="Rit" variant="small" />
                    <CalculatedField label="Total PF1 (Ton)" value={fmt(calc.pb2_total_pf1_ton)} unit="Ton" variant="small" />
                    <CalculatedField label="Total PF2 (Rit)" value={fmt(calc.pb2_total_pf2_rit)} unit="Rit" variant="small" />
                    <CalculatedField label="Total PF2 (Ton)" value={fmt(calc.pb2_total_pf2_ton)} unit="Ton" variant="small" />
                </div>
            </Card>

            {/* ═══ Pemindahan ke PB III ═══ */}
            <Card title="Pemindahan Batubara ke Pabrik 3" icon="factory" color="emerald">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Calsinasi" name="pb3_calc_rit" value={coalTransfer.pb3_calc_rit} onChange={onCoalTransferChange} unit="Rit" color="emerald" />
                    <InputField label="Calsinasi" name="pb3_calc_ton" value={coalTransfer.pb3_calc_ton} onChange={onCoalTransferChange} unit="Ton" color="emerald" />
                </div>
                <div className="mt-3 pt-3 border-t border-emerald-500/20 grid grid-cols-2 gap-3">
                    <CalculatedField label="Total Calsinasi (Rit)" value={fmt(calc.pb3_total_calc_rit)} unit="Rit" variant="small" />
                    <CalculatedField label="Total Calsinasi (Ton)" value={fmt(calc.pb3_total_calc_ton)} unit="Ton" variant="small" />
                </div>
            </Card>

            {/* ═══ Kedatangan Batubara ═══ */}
            <Card title="Kedatangan Batubara" icon="inventory_2" color="amber">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Via Darat" name="darat_24_ton" value={coalTransfer.darat_24_ton} onChange={onCoalTransferChange} unit="Ton" color="amber" />
                    <InputField label="Via Laut"  name="laut_24_ton"  value={coalTransfer.laut_24_ton}  onChange={onCoalTransferChange} unit="Ton" color="amber" />
                </div>
                <div className="mt-3 pt-3 border-t border-amber-500/20 grid grid-cols-2 gap-3">
                    <CalculatedField label="Total Darat" value={fmt(calc.darat_total_ton)} unit="Ton" variant="small" />
                    <CalculatedField label="Total Laut"  value={fmt(calc.laut_total_ton)}  unit="Ton" variant="small" />
                </div>
            </Card>

        </div>
    );
}
