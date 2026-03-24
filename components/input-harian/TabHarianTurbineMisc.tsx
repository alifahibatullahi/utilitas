'use client';
import React from 'react';
import { InputField, Card, CalculatedField } from '@/components/input-shift/SharedComponents';

interface TabHarianTurbineMiscProps {
    values: Record<string, number | null>;
    onFieldChange: (name: string, value: number | string | null) => void;
}

export default function TabHarianTurbineMisc({ values, onFieldChange }: TabHarianTurbineMiscProps) {
    const n = (v: number | null | undefined) => Number(v) || 0;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(3) : v.toLocaleString('id-ID');

    const crAvg = (n(values.consumption_rate_a) + n(values.consumption_rate_b)) / 2;

    return (
        <div className="flex flex-col xl:flex-row gap-6 w-full">
            {/* Main Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Temperatur Furnace */}
                <Card title="Temperatur Furnace (Jam 00.00)" icon="thermostat" color="orange">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Boiler A" name="temp_furnace_a" value={values.temp_furnace_a} onChange={onFieldChange} unit="°C" color="orange" />
                        <InputField label="Boiler B" name="temp_furnace_b" value={values.temp_furnace_b} onChange={onFieldChange} unit="°C" color="orange" />
                    </div>
                </Card>

                {/* Turbine Generator */}
                <Card title="Turbine Generator (Jam 00.00)" icon="mode_fan" color="blue">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Axial Displacement" name="axial_displacement" value={values.axial_displacement} onChange={onFieldChange} unit="mm" color="blue" />
                        <InputField label="Thrust Bearing Temp" name="thrust_bearing_temp" value={values.thrust_bearing_temp} onChange={onFieldChange} unit="°C" color="blue" />
                        <InputField label="Steam Inlet Press" name="steam_inlet_press" value={values.steam_inlet_press} onChange={onFieldChange} unit="MPa" color="blue" />
                        <InputField label="Steam Inlet Temp" name="steam_inlet_temp" value={values.steam_inlet_temp} onChange={onFieldChange} unit="°C" color="blue" />
                    </div>
                </Card>

                {/* Consumption Rate */}
                <Card title="Consumption Rate Harian" icon="speed" color="emerald">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Boiler A" name="consumption_rate_a" value={values.consumption_rate_a} onChange={onFieldChange} unit="" color="emerald" placeholder="0.000" />
                        <InputField label="Boiler B" name="consumption_rate_b" value={values.consumption_rate_b} onChange={onFieldChange} unit="" color="emerald" placeholder="0.000" />
                    </div>
                    <CalculatedField label="Rata-rata (CR AB)" value={crAvg.toFixed(3)} unit="" variant="primary" />
                </Card>

                {/* Totalizer Power */}
                <Card title="Totalizer Power" icon="electric_meter" color="cyan">
                    <div className="grid grid-cols-1 gap-4">
                        <InputField label="GI" name="totalizer_gi" value={values.totalizer_gi} onChange={onFieldChange} unit="" color="cyan" />
                        <InputField label="Exsport" name="totalizer_export" value={values.totalizer_export} onChange={onFieldChange} unit="" color="cyan" />
                        <InputField label="Import" name="totalizer_import" value={values.totalizer_import} onChange={onFieldChange} unit="" color="cyan" />
                    </div>
                </Card>
            </div>

            {/* Sidebar */}
            <div className="xl:w-72 shrink-0 space-y-4 xl:self-start">
                <Card title="Ringkasan" icon="summarize" color="purple" isSidebar>
                    <CalculatedField label="CR Average" value={crAvg.toFixed(3)} unit="" variant="purple" />
                    <CalculatedField label="Furnace A" value={fmt(n(values.temp_furnace_a))} unit="°C" variant="small" />
                    <CalculatedField label="Furnace B" value={fmt(n(values.temp_furnace_b))} unit="°C" variant="small" />
                    <CalculatedField label="Axial Disp." value={n(values.axial_displacement).toFixed(3)} unit="mm" variant="small" />
                    <CalculatedField label="Thrust Bearing" value={fmt(n(values.thrust_bearing_temp))} unit="°C" variant="small" />
                </Card>
            </div>
        </div>
    );
}
