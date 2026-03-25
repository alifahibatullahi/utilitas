'use client';
import React from 'react';
import { InputField, Card, CalculatedField, SectionLabel, SelisihInfo, TotalizerInput } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

export default function TabPower({
    power, turbineMisc,
    prevPower,
    onPowerChange, onTurbineMiscChange,
}: DailyTabProps) {
    const n = (v: number | null | undefined) => Number(v) || 0;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');
    const pn = (key: string) => prevPower ? n(prevPower[key]) : 0;

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* ═══ Produksi & Distribusi ═══ */}
            <Card title="Power — Produksi & Distribusi" icon="bolt" color="amber">
                <SectionLabel label="24 Jam" badge="Totalizer · MWh" />
                <TotalizerInput label="Generator (20EG-01.02)" name="gen_24" value={power.gen_24} prev={pn('gen_24')} onChange={onPowerChange} unit="MWh" color="amber" />
                <div className="grid grid-cols-2 gap-4">
                    <TotalizerInput label="Dist. IB" name="dist_ib_24" value={power.dist_ib_24} prev={pn('dist_ib_24')} onChange={onPowerChange} unit="MWh" color="amber" />
                    <TotalizerInput label="Dist. II" name="dist_ii_24" value={power.dist_ii_24} prev={pn('dist_ii_24')} onChange={onPowerChange} unit="MWh" color="amber" />
                    <TotalizerInput label="Dist. III A" name="dist_3a_24" value={power.dist_3a_24} prev={pn('dist_3a_24')} onChange={onPowerChange} unit="MWh" color="amber" />
                    <TotalizerInput label="Dist. III B" name="dist_3b_24" value={power.dist_3b_24} prev={pn('dist_3b_24')} onChange={onPowerChange} unit="MWh" color="amber" />
                </div>

                <SectionLabel label="Jam 00.00" badge="Flow · MW" />
                <InputField label="Generator (20EG-01.02)" name="gen_00" value={power.gen_00} onChange={onPowerChange} unit="MW" color="emerald" />
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Dist. IB" name="dist_ib_00" value={power.dist_ib_00} onChange={onPowerChange} unit="MW" color="emerald" />
                    <InputField label="Dist. II" name="dist_ii_00" value={power.dist_ii_00} onChange={onPowerChange} unit="MW" color="emerald" />
                    <InputField label="Dist. III A" name="dist_3a_00" value={power.dist_3a_00} onChange={onPowerChange} unit="MW" color="emerald" />
                    <InputField label="Dist. III B" name="dist_3b_00" value={power.dist_3b_00} onChange={onPowerChange} unit="MW" color="emerald" />
                </div>
                <CalculatedField label="Total Generator" value={`${fmt(n(power.gen_24))} MWh / ${fmt(n(power.gen_00))} MW`} unit="" variant="primary" />
            </Card>

            {/* ═══ Internal & Ekspor ═══ */}
            <Card title="Power — Internal & Ekspor" icon="electrical_services" color="sky">
                <SectionLabel label="24 Jam" badge="Totalizer · MWh" />
                <div className="grid grid-cols-2 gap-4">
                    <TotalizerInput label="Internal BUS I" name="internal_bus1_24" value={power.internal_bus1_24} prev={pn('internal_bus1_24')} onChange={onPowerChange} unit="MWh" color="sky" />
                    <TotalizerInput label="Internal BUS II" name="internal_bus2_24" value={power.internal_bus2_24} prev={pn('internal_bus2_24')} onChange={onPowerChange} unit="MWh" color="sky" />
                    <TotalizerInput label="PJA" name="pja_24" value={power.pja_24} prev={pn('pja_24')} onChange={onPowerChange} unit="MWh" color="sky" />
                    <TotalizerInput label="Revamp STG 17.5" name="revamp_stg175_24" value={power.revamp_stg175_24} prev={pn('revamp_stg175_24')} onChange={onPowerChange} unit="MWh" color="sky" />
                    <TotalizerInput label="Revamp STG 12.5" name="revamp_stg125_24" value={power.revamp_stg125_24} prev={pn('revamp_stg125_24')} onChange={onPowerChange} unit="MWh" color="sky" />
                    <TotalizerInput label="Exsport" name="exsport_24" value={power.exsport_24} prev={pn('exsport_24')} onChange={onPowerChange} unit="MWh" color="sky" />
                    <TotalizerInput label="PIE PLN" name="pie_pln_24" value={power.pie_pln_24} prev={pn('pie_pln_24')} onChange={onPowerChange} unit="MWh" color="sky" />
                    <TotalizerInput label="PIE Import" name="pie_import_24" value={power.pie_import_24} prev={pn('pie_import_24')} onChange={onPowerChange} unit="MWh" color="sky" />
                </div>

                <SectionLabel label="Jam 00.00" badge="Flow · MW" />
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Internal BUS I" name="internal_bus1_00" value={power.internal_bus1_00} onChange={onPowerChange} unit="MW" color="orange" />
                    <InputField label="Internal BUS II" name="internal_bus2_00" value={power.internal_bus2_00} onChange={onPowerChange} unit="MW" color="orange" />
                    <InputField label="PJA" name="pja_00" value={power.pja_00} onChange={onPowerChange} unit="MW" color="orange" />
                    <InputField label="Revamp STG 17.5" name="revamp_stg175_00" value={power.revamp_stg175_00} onChange={onPowerChange} unit="MW" color="orange" />
                    <InputField label="Revamp STG 12.5" name="revamp_stg125_00" value={power.revamp_stg125_00} onChange={onPowerChange} unit="MW" color="orange" />
                    <InputField label="Exsport" name="exsport_00" value={power.exsport_00} onChange={onPowerChange} unit="MW" color="orange" />
                    <InputField label="PIE PLN" name="pie_pln_00" value={power.pie_pln_00} onChange={onPowerChange} unit="MW" color="orange" />
                    <InputField label="PIE Import" name="pie_import_00" value={power.pie_import_00} onChange={onPowerChange} unit="MW" color="orange" />
                    <InputField label="PIE GI" name="pie_gi_00" value={power.pie_gi_00} onChange={onPowerChange} unit="MW" color="orange" />
                </div>
            </Card>

            {/* ═══ Totalizer Power ═══ */}
            <Card title="Totalizer Power" icon="electric_meter" color="amber">
                <div className="grid grid-cols-1 gap-4">
                    <InputField label="GI" name="totalizer_gi" value={turbineMisc.totalizer_gi} onChange={onTurbineMiscChange} unit="" color="amber" />
                    <InputField label="Exsport" name="totalizer_export" value={turbineMisc.totalizer_export} onChange={onTurbineMiscChange} unit="" color="amber" />
                    <InputField label="Import" name="totalizer_import" value={turbineMisc.totalizer_import} onChange={onTurbineMiscChange} unit="" color="amber" />
                </div>
            </Card>
        </div>
    );
}
