'use client';
import React from 'react';
import { InputField, Card, CalculatedField } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

export default function TabStockBatubara({
    stockTank, coalTransfer, totalizer, prevCoalTransfer,
    onStockTankChange, onCoalTransferChange, onTotalizerChange,
}: DailyTabProps) {
    const N0 = (v: any) => Number(v) || 0;
    
    // Auto calculations based on input and previous day
    const calc = {
        pb2_total_pf1_rit: N0(prevCoalTransfer?.pb2_total_pf1_rit) + N0(coalTransfer.pb2_pf1_rit),
        pb2_total_pf1_ton: N0(prevCoalTransfer?.pb2_total_pf1_ton) + N0(coalTransfer.pb2_pf1_ton),
        pb2_total_pf2_rit: N0(prevCoalTransfer?.pb2_total_pf2_rit) + N0(coalTransfer.pb2_pf2_rit),
        pb2_total_pf2_ton: N0(prevCoalTransfer?.pb2_total_pf2_ton) + N0(coalTransfer.pb2_pf2_ton),
        pb3_total_calc_rit: N0(prevCoalTransfer?.pb3_total_calc_rit) + N0(coalTransfer.pb3_calc_rit),
        pb3_total_calc_ton: N0(prevCoalTransfer?.pb3_total_calc_ton) + N0(coalTransfer.pb3_calc_ton),
        darat_total_ton: N0(prevCoalTransfer?.darat_total_ton) + N0(coalTransfer.darat_24_ton),
        laut_total_ton: N0(prevCoalTransfer?.laut_total_ton) + N0(coalTransfer.laut_24_ton),
    };

    const formatNum = (v: number) => v % 1 !== 0 ? v.toFixed(2) : v.toString();

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* ═══ Stock Batubara ═══ */}
            <Card title="Stock Batubara" icon="inventory" color="blue">
                <InputField label="Stock Batubara" name="stock_batubara" value={stockTank.stock_batubara} onChange={onStockTankChange} unit="Ton" color="blue" />
                <InputField label="Stock BB Rendal" name="stock_batubara_rendal" value={totalizer.stock_batubara_rendal as number | null} onChange={onTotalizerChange} unit="Ton" color="blue" />
            </Card>

            {/* ═══ PB II — PF1 ═══ */}
            <Card title="PB II — PF1" icon="local_shipping" color="teal">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="24 Jam (Rit)" name="pb2_pf1_rit" value={coalTransfer.pb2_pf1_rit} onChange={onCoalTransferChange} unit="Rit" color="teal" />
                    <InputField label="24 Jam (Ton)" name="pb2_pf1_ton" value={coalTransfer.pb2_pf1_ton} onChange={onCoalTransferChange} unit="Ton" color="teal" />
                    <CalculatedField label="Total (Rit)" value={formatNum(calc.pb2_total_pf1_rit)} unit="Rit" variant="small" />
                    <CalculatedField label="Total (Ton)" value={formatNum(calc.pb2_total_pf1_ton)} unit="Ton" variant="small" />
                </div>
            </Card>

            {/* ═══ PB II — PF2 ═══ */}
            <Card title="PB II — PF2" icon="local_shipping" color="cyan">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="24 Jam (Rit)" name="pb2_pf2_rit" value={coalTransfer.pb2_pf2_rit} onChange={onCoalTransferChange} unit="Rit" color="cyan" />
                    <InputField label="24 Jam (Ton)" name="pb2_pf2_ton" value={coalTransfer.pb2_pf2_ton} onChange={onCoalTransferChange} unit="Ton" color="cyan" />
                    <CalculatedField label="Total (Rit)" value={formatNum(calc.pb2_total_pf2_rit)} unit="Rit" variant="small" />
                    <CalculatedField label="Total (Ton)" value={formatNum(calc.pb2_total_pf2_ton)} unit="Ton" variant="small" />
                </div>
            </Card>

            {/* ═══ PB III — Calcinasi ═══ */}
            <Card title="PB III — Calcinasi" icon="factory" color="emerald">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="24 Jam (Rit)" name="pb3_calc_rit" value={coalTransfer.pb3_calc_rit} onChange={onCoalTransferChange} unit="Rit" color="emerald" />
                    <InputField label="24 Jam (Ton)" name="pb3_calc_ton" value={coalTransfer.pb3_calc_ton} onChange={onCoalTransferChange} unit="Ton" color="emerald" />
                    <CalculatedField label="Total (Rit)" value={formatNum(calc.pb3_total_calc_rit)} unit="Rit" variant="small" />
                    <CalculatedField label="Total (Ton)" value={formatNum(calc.pb3_total_calc_ton)} unit="Ton" variant="small" />
                </div>
            </Card>

            {/* ═══ Kedatangan Batubara ═══ */}
            <Card title="Kedatangan Batubara" icon="inventory_2" color="amber">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Darat 24 Jam" name="darat_24_ton" value={coalTransfer.darat_24_ton} onChange={onCoalTransferChange} unit="Ton" color="amber" />
                    <CalculatedField label="Darat Total" value={formatNum(calc.darat_total_ton)} unit="Ton" variant="small" />
                    <InputField label="Laut 24 Jam" name="laut_24_ton" value={coalTransfer.laut_24_ton} onChange={onCoalTransferChange} unit="Ton" color="amber" />
                    <CalculatedField label="Laut Total" value={formatNum(calc.laut_total_ton)} unit="Ton" variant="small" />
                </div>
            </Card>
        </div>
    );
}
