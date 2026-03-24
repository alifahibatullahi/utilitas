'use client';
import React from 'react';
import { InputField, Card, CalculatedField } from '@/components/input-shift/SharedComponents';

interface TabHarianStockTankProps {
    values: Record<string, number | null>;
    onFieldChange: (name: string, value: number | string | null) => void;
}

export default function TabHarianStockTank({ values, onFieldChange }: TabHarianStockTankProps) {
    const n = (v: number | null | undefined) => Number(v) || 0;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

    const solarTotal = n(values.solar_tank_a) + n(values.solar_tank_b);
    const bfwTotal = n(values.bfw_boiler_a) + n(values.bfw_boiler_b);

    return (
        <div className="flex flex-col xl:flex-row gap-6 w-full">
            {/* Main Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stock & Levels */}
                <Card title="Stock & Level (Jam 00.00)" icon="inventory" color="blue">
                    <InputField label="Stock Batubara" name="stock_batubara" value={values.stock_batubara} onChange={onFieldChange} unit="Ton" color="blue" />
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="RCW Level" name="rcw_level_00" value={values.rcw_level_00} onChange={onFieldChange} unit="m³" color="blue" />
                        <InputField label="DEMIN Level" name="demin_level_00" value={values.demin_level_00} onChange={onFieldChange} unit="m³" color="blue" />
                    </div>
                </Card>

                {/* Solar */}
                <Card title="Solar" icon="local_gas_station" color="orange">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Tank A (200 M³)" name="solar_tank_a" value={values.solar_tank_a} onChange={onFieldChange} unit="m³" color="orange" />
                        <InputField label="Tank B (200 M³)" name="solar_tank_b" value={values.solar_tank_b} onChange={onFieldChange} unit="m³" color="orange" />
                    </div>
                    <CalculatedField label="Total A+B" value={fmt(solarTotal)} unit="m³" variant="secondary" />
                    <InputField label="Kedatangan Solar" name="kedatangan_solar" value={values.kedatangan_solar} onChange={onFieldChange} unit="m³" color="orange" />
                    <div className="grid grid-cols-3 gap-4">
                        <InputField label="Boiler A+B" name="solar_boiler" value={values.solar_boiler} onChange={onFieldChange} unit="m³" color="orange" size="small" />
                        <InputField label="Bengkel" name="solar_bengkel" value={values.solar_bengkel} onChange={onFieldChange} unit="m³" color="orange" size="small" />
                        <InputField label="SA/SU 3B" name="solar_3b" value={values.solar_3b} onChange={onFieldChange} unit="m³" color="orange" size="small" />
                    </div>
                </Card>

                {/* BFW */}
                <Card title="BFW (Konsumsi 24 Jam)" icon="water_drop" color="cyan">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Boiler A" name="bfw_boiler_a" value={values.bfw_boiler_a} onChange={onFieldChange} unit="Ton" color="cyan" />
                        <InputField label="Boiler B" name="bfw_boiler_b" value={values.bfw_boiler_b} onChange={onFieldChange} unit="Ton" color="cyan" />
                    </div>
                    <CalculatedField label="Total BFW" value={fmt(bfwTotal)} unit="Ton" variant="primary" />
                </Card>

                {/* Chemical */}
                <Card title="Chemical Boiler 24 Jam" icon="science" color="purple">
                    <div className="grid grid-cols-3 gap-4">
                        <InputField label="Phosphat" name="chemical_phosphat" value={values.chemical_phosphat} onChange={onFieldChange} unit="Kg" color="purple" />
                        <InputField label="Amin" name="chemical_amin" value={values.chemical_amin} onChange={onFieldChange} unit="Ltr" color="purple" />
                        <InputField label="Hydrasin" name="chemical_hydrasin" value={values.chemical_hydrasin} onChange={onFieldChange} unit="Ltr" color="purple" />
                    </div>
                </Card>

                {/* Silo & Fly Ash */}
                <Card title="Silo & Fly Ash" icon="filter_alt" color="emerald">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Silo A (Jam 00)" name="silo_a_pct" value={values.silo_a_pct} onChange={onFieldChange} unit="%" color="emerald" />
                        <InputField label="Silo B (Jam 00)" name="silo_b_pct" value={values.silo_b_pct} onChange={onFieldChange} unit="%" color="emerald" />
                        <InputField label="Unloading Fly Ash A" name="unloading_fly_ash_a" value={values.unloading_fly_ash_a} onChange={onFieldChange} unit="Silo A" color="emerald" />
                        <InputField label="Unloading Fly Ash B" name="unloading_fly_ash_b" value={values.unloading_fly_ash_b} onChange={onFieldChange} unit="Silo B" color="emerald" />
                        <InputField label="Total PF1" name="total_pf1" value={values.total_pf1} onChange={onFieldChange} unit="" color="emerald" />
                        <InputField label="Total PF2" name="total_pf2" value={values.total_pf2} onChange={onFieldChange} unit="" color="emerald" />
                    </div>
                </Card>
            </div>

            {/* Sidebar */}
            <div className="xl:w-72 shrink-0 space-y-4 xl:self-start">
                <Card title="Ringkasan" icon="summarize" color="purple" isSidebar>
                    <CalculatedField label="Stock Batubara" value={fmt(n(values.stock_batubara))} unit="Ton" variant="purple" />
                    <CalculatedField label="Solar Total" value={fmt(solarTotal)} unit="m³" variant="secondary" />
                    <CalculatedField label="BFW Total" value={fmt(bfwTotal)} unit="Ton" variant="secondary" />
                    <CalculatedField label="RCW" value={fmt(n(values.rcw_level_00))} unit="m³" variant="small" />
                    <CalculatedField label="DEMIN" value={fmt(n(values.demin_level_00))} unit="m³" variant="small" />
                </Card>
            </div>
        </div>
    );
}
