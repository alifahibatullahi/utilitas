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

    // Internal UBB = selisih Inlet Turbin − selisih Condensate
    const prevInlet24   = prevSteam ? n(prevSteam.inlet_turbine_24) : 0;
    const prevCondens24 = prevSteam ? n(prevSteam.fully_condens_24) : 0;
    const selInlet24    = prevInlet24   > 0 ? n(steam.inlet_turbine_24) - prevInlet24   : n(steam.inlet_turbine_24);
    const selCondens24  = prevCondens24 > 0 ? n(steam.fully_condens_24) - prevCondens24 : n(steam.fully_condens_24);
    const internalUbb24 = selInlet24 - selCondens24;
    const internalUbb00 = n(steam.inlet_turbine_00) - n(steam.fully_condens_00);

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

            {/* ═══ Calculated Steam ═══ */}
            <div className="flex flex-col gap-6">
                <Card title="Calculated Steam" icon="calculate" color="purple">
                    <CalculatedField
                        label="Internal UBB — Totalizer (Inlet − Condensate)"
                        value={fmt(internalUbb24)}
                        unit="Ton"
                        variant="primary"
                    />
                    <CalculatedField
                        label="Internal UBB — Flow (Inlet − Condensate)"
                        value={fmt(internalUbb00)}
                        unit="T/H"
                        variant="secondary"
                    />
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
