'use client';
import React from 'react';
import { InputField, Card, CalculatedField, SelisihInfo } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

// Distribution items — urutan: Inlet Turbin, Pabrik 1, Pabrik 3, Condensate
const DIST_ITEMS = [
    { totKey: 'inlet_turbine_24', flowKey: 'inlet_turbine_00', label: 'Inlet Turbin', totUnit: 'Ton', flowUnit: 'T/H' },
    { totKey: 'mps_i_24',         flowKey: 'mps_i_00',         label: 'Pabrik 1',     totUnit: 'Ton', flowUnit: 'T/H' },
    { totKey: 'mps_3a_24',        flowKey: 'mps_3a_00',        label: 'Pabrik 3',     totUnit: 'Ton', flowUnit: 'T/H' },
    { totKey: 'fully_condens_24', flowKey: 'fully_condens_00', label: 'Condensate',   totUnit: 'Ton', flowUnit: 'T/H' },
] as const;

export default function TabTurbin({
    steam, turbineMisc,
    prevSteam,
    onSteamChange, onTurbineMiscChange,
}: DailyTabProps) {
    const n = (v: number | null | undefined) => Number(v) || 0;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

    // Selisih per distribusi steam item
    const selisih = (key: typeof DIST_ITEMS[number]['totKey']) => {
        const prev = prevSteam ? n(prevSteam[key]) : 0;
        return prev > 0 ? n(steam[key]) - prev : 0;
    };

    const totalInlet     = selisih('inlet_turbine_24');
    const totalPabrik1   = selisih('mps_i_24');
    const totalPabrik3   = selisih('mps_3a_24');
    const totalCondensat = selisih('fully_condens_24');

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Distribusi Steam ═══ */}
            <Card title="Distribusi Steam" icon="fork_right" color="cyan">
                {/* Header row */}
                <div className="grid grid-cols-2 gap-3 mb-1 px-1">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Totalizer</span>
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Flow (00.00)</span>
                </div>

                {DIST_ITEMS.map(({ totKey, flowKey, label, totUnit, flowUnit }) => {
                    const prev = prevSteam ? n(prevSteam[totKey]) : 0;
                    return (
                        <div key={totKey} className="bg-[#101822]/40 border border-slate-700/40 rounded-lg p-3 mb-2">
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-2">{label}</span>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <InputField
                                        label={totUnit}
                                        name={totKey}
                                        value={steam[totKey]}
                                        onChange={onSteamChange}
                                        unit={totUnit}
                                        color="cyan"
                                        size="small"
                                        thousands
                                    />
                                    {prevSteam && <SelisihInfo prev={prev} current={n(steam[totKey])} />}
                                </div>
                                <InputField
                                    label={flowUnit}
                                    name={flowKey}
                                    value={steam[flowKey]}
                                    onChange={onSteamChange}
                                    unit={flowUnit}
                                    color="orange"
                                    size="small"
                                />
                            </div>
                        </div>
                    );
                })}
            </Card>

            {/* ═══ Calculated Steam + Turbine Generator ═══ */}
            <div className="flex flex-col gap-6">
                <Card title="Calculated Steam" icon="calculate" color="purple">
                    <CalculatedField label="Total Inlet Turbin"  value={fmt(totalInlet)}     unit="Ton" variant="primary"     />
                    <CalculatedField label="Total Pabrik 1"      value={fmt(totalPabrik1)}   unit="Ton" variant="secondary"   />
                    <CalculatedField label="Total Pabrik 3"      value={fmt(totalPabrik3)}   unit="Ton" variant="secondary"   />
                    <CalculatedField label="Total Condensate"    value={fmt(totalCondensat)} unit="Ton" variant="transparent" />
                </Card>

                {/* ═══ Turbine Generator ═══ */}
                <Card title="Turbine Generator" icon="mode_fan" color="sky">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Steam Inlet Press"    name="steam_inlet_press"    value={turbineMisc.steam_inlet_press}    onChange={onTurbineMiscChange} unit="MPa" color="sky" />
                        <InputField label="Steam Inlet Temp"     name="steam_inlet_temp"     value={turbineMisc.steam_inlet_temp}     onChange={onTurbineMiscChange} unit="°C"  color="sky" />
                        <InputField label="Thrust Bearing Temp"  name="thrust_bearing_temp"  value={turbineMisc.thrust_bearing_temp}  onChange={onTurbineMiscChange} unit="°C"  color="sky" />
                        <InputField label="Axial Displacement"   name="axial_displacement"   value={turbineMisc.axial_displacement}   onChange={onTurbineMiscChange} unit="mm"  color="sky" textMode />
                    </div>
                </Card>
            </div>
        </div>
    );
}
