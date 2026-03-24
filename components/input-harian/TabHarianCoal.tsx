'use client';
import React from 'react';
import { InputField, Card, CalculatedField } from '@/components/input-shift/SharedComponents';

interface TabHarianCoalProps {
    values: Record<string, number | null>;
    onFieldChange: (name: string, value: number | string | null) => void;
}

export default function TabHarianCoal({ values, onFieldChange }: TabHarianCoalProps) {
    const n = (v: number | null | undefined) => Number(v) || 0;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

    const totalA24 = n(values.coal_a_24) + n(values.coal_b_24) + n(values.coal_c_24);
    const totalB24 = n(values.coal_d_24) + n(values.coal_e_24) + n(values.coal_f_24);
    const grandTotal24 = totalA24 + totalB24;

    const totalA00 = n(values.coal_a_00) + n(values.coal_b_00) + n(values.coal_c_00);
    const totalB00 = n(values.coal_d_00) + n(values.coal_e_00) + n(values.coal_f_00);
    const grandTotal00 = totalA00 + totalB00;

    return (
        <div className="flex flex-col xl:flex-row gap-6 w-full">
            {/* Main Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Boiler A - 24 Jam */}
                <Card title="Boiler A — 24 Jam" icon="precision_manufacturing" color="blue">
                    <div className="grid grid-cols-3 gap-4">
                        <InputField label="Coal Mill A" name="coal_a_24" value={values.coal_a_24} onChange={onFieldChange} unit="Ton" color="blue" />
                        <InputField label="Coal Mill B" name="coal_b_24" value={values.coal_b_24} onChange={onFieldChange} unit="Ton" color="blue" />
                        <InputField label="Coal Mill C" name="coal_c_24" value={values.coal_c_24} onChange={onFieldChange} unit="Ton" color="blue" />
                    </div>
                    <CalculatedField label="Total Boiler A" value={fmt(totalA24)} unit="Ton" variant="primary" />
                </Card>

                {/* Boiler B - 24 Jam */}
                <Card title="Boiler B — 24 Jam" icon="precision_manufacturing" color="cyan">
                    <div className="grid grid-cols-3 gap-4">
                        <InputField label="Coal Mill D" name="coal_d_24" value={values.coal_d_24} onChange={onFieldChange} unit="Ton" color="cyan" />
                        <InputField label="Coal Mill E" name="coal_e_24" value={values.coal_e_24} onChange={onFieldChange} unit="Ton" color="cyan" />
                        <InputField label="Coal Mill F" name="coal_f_24" value={values.coal_f_24} onChange={onFieldChange} unit="Ton" color="cyan" />
                    </div>
                    <CalculatedField label="Total Boiler B" value={fmt(totalB24)} unit="Ton" variant="primary" />
                </Card>

                {/* Boiler A - Jam 00.00 */}
                <Card title="Boiler A — Jam 00.00" icon="schedule" color="emerald">
                    <div className="grid grid-cols-3 gap-4">
                        <InputField label="Coal Mill A" name="coal_a_00" value={values.coal_a_00} onChange={onFieldChange} unit="T/Jam" color="emerald" />
                        <InputField label="Coal Mill B" name="coal_b_00" value={values.coal_b_00} onChange={onFieldChange} unit="T/Jam" color="emerald" />
                        <InputField label="Coal Mill C" name="coal_c_00" value={values.coal_c_00} onChange={onFieldChange} unit="T/Jam" color="emerald" />
                    </div>
                    <CalculatedField label="Total Boiler A" value={fmt(totalA00)} unit="T/Jam" variant="secondary" />
                </Card>

                {/* Boiler B - Jam 00.00 */}
                <Card title="Boiler B — Jam 00.00" icon="schedule" color="orange">
                    <div className="grid grid-cols-3 gap-4">
                        <InputField label="Coal Mill D" name="coal_d_00" value={values.coal_d_00} onChange={onFieldChange} unit="T/Jam" color="orange" />
                        <InputField label="Coal Mill E" name="coal_e_00" value={values.coal_e_00} onChange={onFieldChange} unit="T/Jam" color="orange" />
                        <InputField label="Coal Mill F" name="coal_f_00" value={values.coal_f_00} onChange={onFieldChange} unit="T/Jam" color="orange" />
                    </div>
                    <CalculatedField label="Total Boiler B" value={fmt(totalB00)} unit="T/Jam" variant="secondary" />
                </Card>
            </div>

            {/* Sidebar */}
            <div className="xl:w-72 shrink-0 space-y-4 xl:self-start">
                <Card title="Ringkasan Batubara" icon="summarize" color="purple" isSidebar>
                    <CalculatedField label="Grand Total 24 Jam" value={fmt(grandTotal24)} unit="Ton" variant="purple" />
                    <CalculatedField label="Boiler A (24H)" value={fmt(totalA24)} unit="Ton" variant="small" />
                    <CalculatedField label="Boiler B (24H)" value={fmt(totalB24)} unit="Ton" variant="small" />
                    <div className="border-t border-slate-700/50 pt-2 mt-0.5" />
                    <CalculatedField label="Grand Total Jam 00" value={fmt(grandTotal00)} unit="T/Jam" variant="secondary" />
                    <CalculatedField label="Boiler A (00)" value={fmt(totalA00)} unit="T/Jam" variant="small" />
                    <CalculatedField label="Boiler B (00)" value={fmt(totalB00)} unit="T/Jam" variant="small" />
                </Card>
            </div>
        </div>
    );
}
