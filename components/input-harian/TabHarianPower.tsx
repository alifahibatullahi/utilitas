'use client';
import React from 'react';
import { InputField, Card, CalculatedField } from '@/components/input-shift/SharedComponents';

interface TabHarianPowerProps {
    values: Record<string, number | null>;
    onFieldChange: (name: string, value: number | string | null) => void;
}

export default function TabHarianPower({ values, onFieldChange }: TabHarianPowerProps) {
    const n = (v: number | null | undefined) => Number(v) || 0;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

    return (
        <div className="flex flex-col xl:flex-row gap-6 w-full">
            {/* Main Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Power 24 Jam - Produksi & Distribusi */}
                <Card title="Power 24 Jam — Produksi" icon="bolt" color="blue">
                    <InputField label="Generator (20EG-01.02)" name="gen_24" value={values.gen_24} onChange={onFieldChange} unit="MWh" color="blue" />
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Dist. IB" name="dist_ib_24" value={values.dist_ib_24} onChange={onFieldChange} unit="MWh" color="blue" />
                        <InputField label="Dist. II" name="dist_ii_24" value={values.dist_ii_24} onChange={onFieldChange} unit="MWh" color="blue" />
                        <InputField label="Dist. III A" name="dist_3a_24" value={values.dist_3a_24} onChange={onFieldChange} unit="MWh" color="blue" />
                        <InputField label="Dist. III B" name="dist_3b_24" value={values.dist_3b_24} onChange={onFieldChange} unit="MWh" color="blue" />
                    </div>
                </Card>

                <Card title="Power 24 Jam — Internal & Ekspor" icon="electrical_services" color="cyan">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Internal BUS I" name="internal_bus1_24" value={values.internal_bus1_24} onChange={onFieldChange} unit="MWh" color="cyan" />
                        <InputField label="Internal BUS II" name="internal_bus2_24" value={values.internal_bus2_24} onChange={onFieldChange} unit="MWh" color="cyan" />
                        <InputField label="PJA" name="pja_24" value={values.pja_24} onChange={onFieldChange} unit="MWh" color="cyan" />
                        <InputField label="Revamp STG 17.5" name="revamp_stg175_24" value={values.revamp_stg175_24} onChange={onFieldChange} unit="MWh" color="cyan" />
                        <InputField label="Revamp STG 12.5" name="revamp_stg125_24" value={values.revamp_stg125_24} onChange={onFieldChange} unit="MWh" color="cyan" />
                        <InputField label="Exsport" name="exsport_24" value={values.exsport_24} onChange={onFieldChange} unit="MWh" color="cyan" />
                        <InputField label="PIE PLN" name="pie_pln_24" value={values.pie_pln_24} onChange={onFieldChange} unit="MWh" color="cyan" />
                        <InputField label="PIE Import" name="pie_import_24" value={values.pie_import_24} onChange={onFieldChange} unit="MWh" color="cyan" />
                    </div>
                </Card>

                {/* Power Jam 00.00 - Produksi & Distribusi */}
                <Card title="Power Jam 00.00 — Produksi" icon="schedule" color="emerald">
                    <InputField label="Generator (20EG-01.02)" name="gen_00" value={values.gen_00} onChange={onFieldChange} unit="MW" color="emerald" />
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Dist. IB" name="dist_ib_00" value={values.dist_ib_00} onChange={onFieldChange} unit="MW" color="emerald" />
                        <InputField label="Dist. II" name="dist_ii_00" value={values.dist_ii_00} onChange={onFieldChange} unit="MW" color="emerald" />
                        <InputField label="Dist. III A" name="dist_3a_00" value={values.dist_3a_00} onChange={onFieldChange} unit="MW" color="emerald" />
                        <InputField label="Dist. III B" name="dist_3b_00" value={values.dist_3b_00} onChange={onFieldChange} unit="MW" color="emerald" />
                    </div>
                </Card>

                <Card title="Power Jam 00.00 — Internal & Ekspor" icon="electrical_services" color="orange">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Internal BUS I" name="internal_bus1_00" value={values.internal_bus1_00} onChange={onFieldChange} unit="MW" color="orange" />
                        <InputField label="Internal BUS II" name="internal_bus2_00" value={values.internal_bus2_00} onChange={onFieldChange} unit="MW" color="orange" />
                        <InputField label="PJA" name="pja_00" value={values.pja_00} onChange={onFieldChange} unit="MW" color="orange" />
                        <InputField label="Revamp STG 17.5" name="revamp_stg175_00" value={values.revamp_stg175_00} onChange={onFieldChange} unit="MW" color="orange" />
                        <InputField label="Revamp STG 12.5" name="revamp_stg125_00" value={values.revamp_stg125_00} onChange={onFieldChange} unit="MW" color="orange" />
                        <InputField label="Exsport" name="exsport_00" value={values.exsport_00} onChange={onFieldChange} unit="MW" color="orange" />
                        <InputField label="PIE PLN" name="pie_pln_00" value={values.pie_pln_00} onChange={onFieldChange} unit="MW" color="orange" />
                        <InputField label="PIE Import" name="pie_import_00" value={values.pie_import_00} onChange={onFieldChange} unit="MW" color="orange" />
                        <InputField label="PIE GI" name="pie_gi_00" value={values.pie_gi_00} onChange={onFieldChange} unit="MW" color="orange" />
                    </div>
                </Card>
            </div>

            {/* Sidebar */}
            <div className="xl:w-72 shrink-0 space-y-4 xl:self-start">
                <Card title="Ringkasan Power" icon="summarize" color="purple" isSidebar>
                    <CalculatedField label="Generator 24 Jam" value={fmt(n(values.gen_24))} unit="MWh" variant="purple" />
                    <CalculatedField label="Generator Jam 00" value={fmt(n(values.gen_00))} unit="MW" variant="secondary" />
                    <CalculatedField label="Exsport 24 Jam" value={fmt(n(values.exsport_24))} unit="MWh" variant="small" />
                    <CalculatedField label="PIE PLN 24 Jam" value={fmt(n(values.pie_pln_24))} unit="MWh" variant="small" />
                    <CalculatedField label="PIE Import 24 Jam" value={fmt(n(values.pie_import_24))} unit="MWh" variant="small" />
                </Card>
            </div>
        </div>
    );
}
