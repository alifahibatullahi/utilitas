'use client';
import React, { useEffect } from 'react';
import { InputField, Card, CalculatedField, SelisihInfo } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

/** Status chip turbin — saat shutdown, cascade ke field operasional + gen output di harian.
 *  Pattern mirror BoilerStatusChip di TabBoiler.tsx. */
function TurbinStatusChip({ value, onChange }: {
    value: string;
    onChange: (name: string, v: string | null) => void;
}) {
    const dot = value === 'running' ? 'bg-emerald-500' : value === 'shutdown' ? 'bg-red-500' : 'bg-slate-500';
    const border = value === 'running' ? 'border-emerald-500/50' : value === 'shutdown' ? 'border-red-500/50' : 'border-slate-700/60';
    return (
        <div className={`inline-flex items-center gap-2 bg-[#101822]/60 border ${border} rounded-lg pl-3 pr-2 py-1.5 transition-colors`}>
            <span className={`w-3 h-3 rounded-full ${dot} shrink-0`} />
            <select
                className="bg-transparent appearance-none text-sm text-white font-semibold pr-4 cursor-pointer outline-none"
                value={value}
                onChange={e => onChange('status_turbin', e.target.value === '' ? null : e.target.value)}
            >
                <option value="" className="bg-[#101822] text-slate-500">Status...</option>
                <option value="running" className="bg-[#101822] text-white">Running</option>
                <option value="shutdown" className="bg-[#101822] text-white">Shutdown</option>
            </select>
        </div>
    );
}

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
    const isTurbinShutdown = turbineMisc.status_turbin === 'shutdown';

    // Auto-zero field instantaneous + parameter operasional saat turbin shutdown.
    // 24h totals tidak di-zero (harian = akumulasi 24 jam, turbin bisa running di shift lain).
    useEffect(() => {
        if (!isTurbinShutdown) return;
        if (onSteamChange && n(steam.inlet_turbine_00) !== 0) onSteamChange('inlet_turbine_00', 0);
        if (onTurbineMiscChange) {
            (['steam_inlet_press', 'steam_inlet_temp', 'thrust_bearing_temp', 'axial_displacement'] as const).forEach(k => {
                const v = turbineMisc[k];
                if (v != null && Number(v) !== 0) onTurbineMiscChange(k, 0);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTurbinShutdown]);

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

            {/* ═══ Distribusi Steam — kiri ═══ */}
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
                                    readOnly={isTurbinShutdown && flowKey === 'inlet_turbine_00'}
                                />
                            </div>
                        </div>
                    );
                })}
            </Card>

            {/* ═══ Turbine Generator — kanan (mobile: row 2) ═══ */}
            <Card
                title="Turbine Generator"
                icon="mode_fan"
                color="sky"
                headerRight={
                    <TurbinStatusChip
                        value={(turbineMisc.status_turbin as string) ?? ''}
                        onChange={onTurbineMiscChange}
                    />
                }
            >
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Steam Inlet Press"   name="steam_inlet_press"   value={turbineMisc.steam_inlet_press}   onChange={onTurbineMiscChange} unit="MPa" color="sky" readOnly={isTurbinShutdown} />
                    <InputField label="Steam Inlet Temp"    name="steam_inlet_temp"    value={turbineMisc.steam_inlet_temp}    onChange={onTurbineMiscChange} unit="°C"  color="sky" readOnly={isTurbinShutdown} />
                    <InputField label="Thrust Bearing Temp" name="thrust_bearing_temp" value={turbineMisc.thrust_bearing_temp} onChange={onTurbineMiscChange} unit="°C"  color="sky" readOnly={isTurbinShutdown} />
                    <InputField label="Axial Displacement"  name="axial_displacement"  value={turbineMisc.axial_displacement}  onChange={onTurbineMiscChange} unit="mm"  color="sky" textMode readOnly={isTurbinShutdown} />
                </div>
            </Card>

            {/* ═══ Calculated Steam — bawah (mobile: row 3, desktop: row 2 col 1 via col-span-2) ═══ */}
            <Card title="Calculated Steam" icon="calculate" color="purple" className="lg:col-span-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <CalculatedField label="Total Inlet Turbin" value={fmt(totalInlet)}     unit="Ton" variant="primary"     />
                    <CalculatedField label="Total Pabrik 1"     value={fmt(totalPabrik1)}   unit="Ton" variant="secondary"   />
                    <CalculatedField label="Total Pabrik 3"     value={fmt(totalPabrik3)}   unit="Ton" variant="secondary"   />
                    <CalculatedField label="Total Condensate"   value={fmt(totalCondensat)} unit="Ton" variant="transparent" />
                </div>
            </Card>
        </div>
    );
}
