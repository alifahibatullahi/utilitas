'use client';
import React from 'react';
import { InputField, Card, CalculatedField } from '@/components/input-shift/SharedComponents';

interface TabHarianCoalTransferProps {
    values: Record<string, number | null>;
    onFieldChange: (name: string, value: number | string | null) => void;
}

export default function TabHarianCoalTransfer({ values, onFieldChange }: TabHarianCoalTransferProps) {
    const n = (v: number | null | undefined) => Number(v) || 0;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

    return (
        <div className="flex flex-col xl:flex-row gap-6 w-full">
            {/* Main Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pemindahan ke PB II - PF1 */}
                <Card title="PB II — PF1" icon="local_shipping" color="blue">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="24 Jam (Rit)" name="pb2_pf1_rit" value={values.pb2_pf1_rit} onChange={onFieldChange} unit="Rit" color="blue" />
                        <InputField label="24 Jam (Ton)" name="pb2_pf1_ton" value={values.pb2_pf1_ton} onChange={onFieldChange} unit="Ton" color="blue" />
                        <InputField label="Total (Rit)" name="pb2_total_pf1_rit" value={values.pb2_total_pf1_rit} onChange={onFieldChange} unit="Rit" color="blue" />
                        <InputField label="Total (Ton)" name="pb2_total_pf1_ton" value={values.pb2_total_pf1_ton} onChange={onFieldChange} unit="Ton" color="blue" />
                    </div>
                </Card>

                {/* Pemindahan ke PB II - PF2 */}
                <Card title="PB II — PF2" icon="local_shipping" color="cyan">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="24 Jam (Rit)" name="pb2_pf2_rit" value={values.pb2_pf2_rit} onChange={onFieldChange} unit="Rit" color="cyan" />
                        <InputField label="24 Jam (Ton)" name="pb2_pf2_ton" value={values.pb2_pf2_ton} onChange={onFieldChange} unit="Ton" color="cyan" />
                        <InputField label="Total (Rit)" name="pb2_total_pf2_rit" value={values.pb2_total_pf2_rit} onChange={onFieldChange} unit="Rit" color="cyan" />
                        <InputField label="Total (Ton)" name="pb2_total_pf2_ton" value={values.pb2_total_pf2_ton} onChange={onFieldChange} unit="Ton" color="cyan" />
                    </div>
                </Card>

                {/* PB III Calcinasi */}
                <Card title="PB III — Calcinasi" icon="factory" color="emerald">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="24 Jam (Rit)" name="pb3_calc_rit" value={values.pb3_calc_rit} onChange={onFieldChange} unit="Rit" color="emerald" />
                        <InputField label="24 Jam (Ton)" name="pb3_calc_ton" value={values.pb3_calc_ton} onChange={onFieldChange} unit="Ton" color="emerald" />
                        <InputField label="Total (Rit)" name="pb3_total_calc_rit" value={values.pb3_total_calc_rit} onChange={onFieldChange} unit="Rit" color="emerald" />
                        <InputField label="Total (Ton)" name="pb3_total_calc_ton" value={values.pb3_total_calc_ton} onChange={onFieldChange} unit="Ton" color="emerald" />
                    </div>
                </Card>

                {/* Kedatangan Batubara */}
                <Card title="Kedatangan Batubara" icon="inventory_2" color="orange">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Darat 24 Jam" name="darat_24_ton" value={values.darat_24_ton} onChange={onFieldChange} unit="Ton" color="orange" />
                        <InputField label="Darat Total" name="darat_total_ton" value={values.darat_total_ton} onChange={onFieldChange} unit="Ton" color="orange" />
                        <InputField label="Laut 24 Jam" name="laut_24_ton" value={values.laut_24_ton} onChange={onFieldChange} unit="Ton" color="orange" />
                        <InputField label="Laut Total" name="laut_total_ton" value={values.laut_total_ton} onChange={onFieldChange} unit="Ton" color="orange" />
                    </div>
                </Card>
            </div>

            {/* Sidebar */}
            <div className="xl:w-72 shrink-0 space-y-4 xl:self-start">
                <Card title="Ringkasan Transfer" icon="summarize" color="purple" isSidebar>
                    <CalculatedField label="PB II PF1 (Total)" value={fmt(n(values.pb2_total_pf1_ton))} unit="Ton" variant="secondary" />
                    <CalculatedField label="PB II PF2 (Total)" value={fmt(n(values.pb2_total_pf2_ton))} unit="Ton" variant="secondary" />
                    <CalculatedField label="PB III Calc (Total)" value={fmt(n(values.pb3_total_calc_ton))} unit="Ton" variant="secondary" />
                    <div className="border-t border-slate-700/50 pt-2 mt-0.5" />
                    <CalculatedField label="Kedatangan Darat" value={fmt(n(values.darat_24_ton))} unit="Ton" variant="small" />
                    <CalculatedField label="Kedatangan Laut" value={fmt(n(values.laut_24_ton))} unit="Ton" variant="small" />
                </Card>
            </div>
        </div>
    );
}
