'use client';
import React from 'react';
import { InputField, Card, CalculatedField, SectionLabel, SelisihInfo } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

export default function TabTurbin({
    steam, turbineMisc,
    prevSteam,
    onSteamChange, onTurbineMiscChange,
}: DailyTabProps) {
    const n = (v: number | null | undefined) => Number(v) || 0;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

    // Internal UBB = Inlet Turbin - Condensate
    const internalUbb24 = n(steam.inlet_turbine_24) - n(steam.fully_condens_24);
    const internalUbb00 = n(steam.inlet_turbine_00) - n(steam.co_gen_00);

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* ═══ Distribusi Steam ═══ */}
            <Card title="Distribusi Steam" icon="fork_right" color="cyan">
                <SectionLabel label="24 Jam" badge="Totalizer" />
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <InputField label="Totalizer Inlet Turbin" name="inlet_turbine_24" value={steam.inlet_turbine_24} onChange={onSteamChange} unit="Ton" color="cyan" />
                        {prevSteam && <SelisihInfo prev={n(prevSteam.inlet_turbine_24)} current={n(steam.inlet_turbine_24)} />}
                    </div>
                    <div>
                        <InputField label="Totalizer Pabrik 1" name="mps_i_24" value={steam.mps_i_24} onChange={onSteamChange} unit="Ton" color="cyan" />
                        {prevSteam && <SelisihInfo prev={n(prevSteam.mps_i_24)} current={n(steam.mps_i_24)} />}
                    </div>
                    <div>
                        <InputField label="Totalizer Pabrik 3" name="mps_3a_24" value={steam.mps_3a_24} onChange={onSteamChange} unit="Ton" color="cyan" />
                        {prevSteam && <SelisihInfo prev={n(prevSteam.mps_3a_24)} current={n(steam.mps_3a_24)} />}
                    </div>
                    <div>
                        <InputField label="Totalizer Condensate" name="fully_condens_24" value={steam.fully_condens_24} onChange={onSteamChange} unit="Ton" color="cyan" />
                        {prevSteam && <SelisihInfo prev={n(prevSteam.fully_condens_24)} current={n(steam.fully_condens_24)} />}
                    </div>
                </div>
                <CalculatedField label="LPS II" value="0" unit="Ton" variant="small" />
                <CalculatedField label="LPS III A" value="0" unit="Ton" variant="small" />
                <CalculatedField label="Internal UBB (Inlet Turbin − Condensate)" value={fmt(internalUbb24)} unit="Ton" variant="primary" />

                <SectionLabel label="Jam 00.00" badge="Flow" />
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Flow Inlet Turbin" name="inlet_turbine_00" value={steam.inlet_turbine_00} onChange={onSteamChange} unit="T/H" color="orange" />
                    <InputField label="Flow Pabrik 1" name="mps_i_00" value={steam.mps_i_00} onChange={onSteamChange} unit="T/H" color="orange" />
                    <InputField label="Flow Pabrik 3" name="mps_3a_00" value={steam.mps_3a_00} onChange={onSteamChange} unit="T/H" color="orange" />
                    <InputField label="Flow Condensate" name="fully_condens_00" value={steam.fully_condens_00} onChange={onSteamChange} unit="T/H" color="orange" />
                    <InputField label="Flow Condensate (Co Gen)" name="co_gen_00" value={steam.co_gen_00} onChange={onSteamChange} unit="T/H" color="orange" />
                </div>
                <CalculatedField label="LPS II" value="0" unit="T/H" variant="small" />
                <CalculatedField label="LPS III A" value="0" unit="T/H" variant="small" />
                <CalculatedField label="Internal UBB (Inlet Turbin − Condensate)" value={fmt(internalUbb00)} unit="T/H" variant="secondary" />
            </Card>

            {/* ═══ Turbine Generator ═══ */}
            <Card title="Turbine Generator (Jam 00.00)" icon="mode_fan" color="sky">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Axial Displacement" name="axial_displacement" value={turbineMisc.axial_displacement} onChange={onTurbineMiscChange} unit="mm" color="sky" />
                    <InputField label="Thrust Bearing Temp" name="thrust_bearing_temp" value={turbineMisc.thrust_bearing_temp} onChange={onTurbineMiscChange} unit="°C" color="sky" />
                    <InputField label="Steam Inlet Press" name="steam_inlet_press" value={turbineMisc.steam_inlet_press} onChange={onTurbineMiscChange} unit="MPa" color="sky" />
                    <InputField label="Steam Inlet Temp" name="steam_inlet_temp" value={turbineMisc.steam_inlet_temp} onChange={onTurbineMiscChange} unit="°C" color="sky" />
                </div>
            </Card>
        </div>
    );
}
