'use client';
import React from 'react';
import { InputField, Card } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

export default function TabStockBatubara({
    stockTank, coalTransfer, totalizer,
    onStockTankChange, onCoalTransferChange, onTotalizerChange,
}: DailyTabProps) {
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
                    <InputField label="Total (Rit)" name="pb2_total_pf1_rit" value={coalTransfer.pb2_total_pf1_rit} onChange={onCoalTransferChange} unit="Rit" color="teal" />
                    <InputField label="Total (Ton)" name="pb2_total_pf1_ton" value={coalTransfer.pb2_total_pf1_ton} onChange={onCoalTransferChange} unit="Ton" color="teal" />
                </div>
            </Card>

            {/* ═══ PB II — PF2 ═══ */}
            <Card title="PB II — PF2" icon="local_shipping" color="cyan">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="24 Jam (Rit)" name="pb2_pf2_rit" value={coalTransfer.pb2_pf2_rit} onChange={onCoalTransferChange} unit="Rit" color="cyan" />
                    <InputField label="24 Jam (Ton)" name="pb2_pf2_ton" value={coalTransfer.pb2_pf2_ton} onChange={onCoalTransferChange} unit="Ton" color="cyan" />
                    <InputField label="Total (Rit)" name="pb2_total_pf2_rit" value={coalTransfer.pb2_total_pf2_rit} onChange={onCoalTransferChange} unit="Rit" color="cyan" />
                    <InputField label="Total (Ton)" name="pb2_total_pf2_ton" value={coalTransfer.pb2_total_pf2_ton} onChange={onCoalTransferChange} unit="Ton" color="cyan" />
                </div>
            </Card>

            {/* ═══ PB III — Calcinasi ═══ */}
            <Card title="PB III — Calcinasi" icon="factory" color="emerald">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="24 Jam (Rit)" name="pb3_calc_rit" value={coalTransfer.pb3_calc_rit} onChange={onCoalTransferChange} unit="Rit" color="emerald" />
                    <InputField label="24 Jam (Ton)" name="pb3_calc_ton" value={coalTransfer.pb3_calc_ton} onChange={onCoalTransferChange} unit="Ton" color="emerald" />
                    <InputField label="Total (Rit)" name="pb3_total_calc_rit" value={coalTransfer.pb3_total_calc_rit} onChange={onCoalTransferChange} unit="Rit" color="emerald" />
                    <InputField label="Total (Ton)" name="pb3_total_calc_ton" value={coalTransfer.pb3_total_calc_ton} onChange={onCoalTransferChange} unit="Ton" color="emerald" />
                </div>
            </Card>

            {/* ═══ Kedatangan Batubara ═══ */}
            <Card title="Kedatangan Batubara" icon="inventory_2" color="amber">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Darat 24 Jam" name="darat_24_ton" value={coalTransfer.darat_24_ton} onChange={onCoalTransferChange} unit="Ton" color="amber" />
                    <InputField label="Darat Total" name="darat_total_ton" value={coalTransfer.darat_total_ton} onChange={onCoalTransferChange} unit="Ton" color="amber" />
                    <InputField label="Laut 24 Jam" name="laut_24_ton" value={coalTransfer.laut_24_ton} onChange={onCoalTransferChange} unit="Ton" color="amber" />
                    <InputField label="Laut Total" name="laut_total_ton" value={coalTransfer.laut_total_ton} onChange={onCoalTransferChange} unit="Ton" color="amber" />
                </div>
            </Card>
        </div>
    );
}
