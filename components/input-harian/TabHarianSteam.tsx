'use client';
import React from 'react';
import { InputField, Card, CalculatedField } from '@/components/input-shift/SharedComponents';

interface TabHarianSteamProps {
    values: Record<string, number | null>;
    onFieldChange: (name: string, value: number | string | null) => void;
}

export default function TabHarianSteam({ values, onFieldChange }: TabHarianSteamProps) {
    const n = (v: number | null | undefined) => Number(v) || 0;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

    const prodTotal24 = n(values.prod_boiler_a_24) + n(values.prod_boiler_b_24);
    const prodTotal00 = n(values.prod_boiler_a_00) + n(values.prod_boiler_b_00);

    return (
        <div className="flex flex-col xl:flex-row gap-6 w-full">
            {/* Main Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Produksi Steam 24 Jam */}
                <Card title="Produksi Steam 24 Jam" icon="waves" color="blue">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Boiler A" name="prod_boiler_a_24" value={values.prod_boiler_a_24} onChange={onFieldChange} unit="Ton" color="blue" />
                        <InputField label="Boiler B" name="prod_boiler_b_24" value={values.prod_boiler_b_24} onChange={onFieldChange} unit="Ton" color="blue" />
                    </div>
                    <CalculatedField label="Total Produksi" value={fmt(prodTotal24)} unit="Ton" variant="primary" />
                </Card>

                {/* Distribusi Steam 24 Jam */}
                <Card title="Distribusi Steam 24 Jam" icon="fork_right" color="cyan">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Inlet Turbine" name="inlet_turbine_24" value={values.inlet_turbine_24} onChange={onFieldChange} unit="Ton" color="cyan" />
                        <InputField label="MPS I" name="mps_i_24" value={values.mps_i_24} onChange={onFieldChange} unit="Ton" color="cyan" />
                        <InputField label="MPS III A" name="mps_3a_24" value={values.mps_3a_24} onChange={onFieldChange} unit="Ton" color="cyan" />
                        <InputField label="LPS II" name="lps_ii_24" value={values.lps_ii_24} onChange={onFieldChange} unit="Ton" color="cyan" />
                        <InputField label="LPS III A" name="lps_3a_24" value={values.lps_3a_24} onChange={onFieldChange} unit="Ton" color="cyan" />
                        <InputField label="Fully Condens" name="fully_condens_24" value={values.fully_condens_24} onChange={onFieldChange} unit="Ton" color="cyan" />
                    </div>
                    <InputField label="Internal UBB" name="internal_ubb_24" value={values.internal_ubb_24} onChange={onFieldChange} unit="Ton" color="cyan" />
                </Card>

                {/* Produksi Steam Jam 00.00 */}
                <Card title="Produksi Steam Jam 00.00" icon="schedule" color="emerald">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Boiler A" name="prod_boiler_a_00" value={values.prod_boiler_a_00} onChange={onFieldChange} unit="T/H" color="emerald" />
                        <InputField label="Boiler B" name="prod_boiler_b_00" value={values.prod_boiler_b_00} onChange={onFieldChange} unit="T/H" color="emerald" />
                    </div>
                    <CalculatedField label="Total Produksi" value={fmt(prodTotal00)} unit="T/H" variant="secondary" />
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Inlet Turbine" name="inlet_turbine_00" value={values.inlet_turbine_00} onChange={onFieldChange} unit="T/H" color="emerald" />
                        <InputField label="Co Gen" name="co_gen_00" value={values.co_gen_00} onChange={onFieldChange} unit="T/H" color="emerald" />
                    </div>
                </Card>

                {/* Distribusi Steam Jam 00.00 */}
                <Card title="Distribusi Steam Jam 00.00" icon="fork_right" color="orange">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="MPS I" name="mps_i_00" value={values.mps_i_00} onChange={onFieldChange} unit="T/H" color="orange" />
                        <InputField label="MPS III A" name="mps_3a_00" value={values.mps_3a_00} onChange={onFieldChange} unit="T/H" color="orange" />
                        <InputField label="LPS II" name="lps_ii_00" value={values.lps_ii_00} onChange={onFieldChange} unit="T/H" color="orange" />
                        <InputField label="LPS III A" name="lps_3a_00" value={values.lps_3a_00} onChange={onFieldChange} unit="T/H" color="orange" />
                        <InputField label="Fully Condens" name="fully_condens_00" value={values.fully_condens_00} onChange={onFieldChange} unit="T/H" color="orange" />
                        <InputField label="Internal UBB" name="internal_ubb_00" value={values.internal_ubb_00} onChange={onFieldChange} unit="T/H" color="orange" />
                    </div>
                </Card>
            </div>

            {/* Sidebar */}
            <div className="xl:w-72 shrink-0 space-y-4 xl:self-start">
                <Card title="Ringkasan Steam" icon="summarize" color="purple" isSidebar>
                    <CalculatedField label="Total 24 Jam" value={fmt(prodTotal24)} unit="Ton" variant="purple" />
                    <CalculatedField label="Total Jam 00" value={fmt(prodTotal00)} unit="T/H" variant="secondary" />
                    <CalculatedField label="Inlet Turbine 24H" value={fmt(n(values.inlet_turbine_24))} unit="Ton" variant="small" />
                    <CalculatedField label="MPS I + III A (24H)" value={fmt(n(values.mps_i_24) + n(values.mps_3a_24))} unit="Ton" variant="small" />
                    <CalculatedField label="LPS II + III A (24H)" value={fmt(n(values.lps_ii_24) + n(values.lps_3a_24))} unit="Ton" variant="small" />
                </Card>
            </div>
        </div>
    );
}
