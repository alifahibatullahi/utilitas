'use client';
import React, { useEffect } from 'react';
import { Card, InputField, CalculatedField, TotalizerInput } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

// Pembacaan sesaat boiler jam 24.00 (di daily_report_turbine_misc) — per boiler.
// Saat boiler shutdown field-field ini di-nol-kan & dikunci (samakan dgn laporan shift).
const INSTANT_FIELDS = (x: 'a' | 'b') => [
    `press_steam_${x}`, `temp_steam_${x}`, `bfw_press_${x}`, `temp_bfw_${x}`,
    `temp_flue_gas_${x}`, `air_heater_ti113_${x}`, `o2_${x}`,
    `steam_drum_press_${x}`, `primary_air_${x}`, `secondary_air_${x}`,
];

/**
 * Tab Boiler harian — layout sama persis dengan tab Boiler di laporan shift,
 * tapi per boiler (boilerId A atau B) supaya dipisah jadi 2 tab terpisah.
 * Field totalizer (24.00) pakai selisih vs hari kemarin; pembacaan sesaat 24.00
 * disimpan di daily_report_turbine_misc. Status boiler dipilih dari header tab.
 */
export default function TabBoiler({
    steam, coal, stockTank, turbineMisc,
    prevSteam, prevCoal, prevStockTank,
    onSteamChange, onCoalChange, onStockTankChange, onTurbineMiscChange,
    crA, crB, boilerId = 'A',
}: DailyTabProps & { boilerId?: 'A' | 'B' }) {
    const x = boilerId.toLowerCase() as 'a' | 'b';
    const feeders = boilerId === 'A' ? ['a', 'b', 'c'] : ['d', 'e', 'f'];

    const n = (v: number | string | null | undefined) => Number(v) || 0;
    const isShutdown = turbineMisc[`status_boiler_${x}`] === 'shutdown';

    const prevSteam24 = prevSteam ? n(prevSteam[`prod_boiler_${x}_24`]) : 0;
    const prevBfw = prevStockTank ? n(prevStockTank[`bfw_boiler_${x}`]) : 0;

    // Auto-fill totalizer (dari kemarin) + clear flow + nol-kan pembacaan sesaat saat shutdown.
    useEffect(() => {
        if (!isShutdown) return;
        if (prevSteam24 > 0 && steam[`prod_boiler_${x}_24`] == null) onSteamChange(`prod_boiler_${x}_24`, prevSteam24);
        feeders.forEach((f) => {
            const p = prevCoal ? n(prevCoal[`coal_${f}_24`]) : 0;
            if (p > 0 && coal[`coal_${f}_24`] == null) onCoalChange(`coal_${f}_24`, p);
        });
        if (prevBfw > 0 && stockTank[`bfw_boiler_${x}`] == null) onStockTankChange(`bfw_boiler_${x}`, prevBfw);
        if (steam[`prod_boiler_${x}_00`] != null) onSteamChange(`prod_boiler_${x}_00`, null);
        feeders.forEach((f) => { if (coal[`coal_${f}_00`] != null) onCoalChange(`coal_${f}_00`, null); });
        if (stockTank[`flow_bfw_${x}`] != null) onStockTankChange(`flow_bfw_${x}`, null);
        INSTANT_FIELDS(x).forEach((k) => { if (turbineMisc[k] != null && turbineMisc[k] !== 0) onTurbineMiscChange(k, 0); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isShutdown]);

    // Kalkulasi produksi (sidebar)
    const produksiSteam = prevSteam24 > 0 ? n(steam[`prod_boiler_${x}_24`]) - prevSteam24 : 0;
    const produksiBfw = prevBfw > 0 ? n(stockTank[`bfw_boiler_${x}`]) - prevBfw : 0;
    const feederKons = feeders.map((f) => {
        const c = n(coal[`coal_${f}_24`]);
        const p = prevCoal ? n(prevCoal[`coal_${f}_24`]) : 0;
        return p > 0 ? c - p : 0;
    });
    const totalBatubara = feederKons.reduce((s, k) => s + k, 0);
    const cr = boilerId === 'A' ? crA : crB;

    return (
        <>
            <div className="w-full xl:flex-1 xl:overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                {isShutdown && (
                    <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                        <span className="material-symbols-outlined text-[16px] text-rose-400 shrink-0 mt-0.5">power_off</span>
                        <span>Boiler {boilerId} <span className="font-bold">shutdown</span> — totalizer tetap bisa diedit, parameter lain dikunci.</span>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Steam Parameters" icon="waves" color="blue">
                        <InputField label="Pressure Steam" unit="MPa" color="blue" name={`press_steam_${x}`} value={turbineMisc[`press_steam_${x}`]} onChange={onTurbineMiscChange} readOnly={isShutdown} />
                        <InputField label="Temp Steam" unit="°C" color="blue" name={`temp_steam_${x}`} value={turbineMisc[`temp_steam_${x}`]} onChange={onTurbineMiscChange} readOnly={isShutdown} />
                        <InputField label="Flow Steam" unit="t/h" color="blue" name={`prod_boiler_${x}_00`} value={steam[`prod_boiler_${x}_00`]} onChange={onSteamChange} readOnly={isShutdown} />
                        <TotalizerInput label="Steam" name={`prod_boiler_${x}_24`} value={steam[`prod_boiler_${x}_24`]} prev={prevSteam24} onChange={onSteamChange} unit="ton" color="blue" />
                    </Card>

                    <Card title="Boiler Feed Water" icon="water_drop" color="cyan">
                        <InputField label="Pressure BFW" unit="MPa" color="cyan" name={`bfw_press_${x}`} value={turbineMisc[`bfw_press_${x}`]} onChange={onTurbineMiscChange} readOnly={isShutdown} />
                        <InputField label="Temp BFW" unit="°C" color="cyan" name={`temp_bfw_${x}`} value={turbineMisc[`temp_bfw_${x}`]} onChange={onTurbineMiscChange} readOnly={isShutdown} />
                        <InputField label="Flow BFW" unit="t/h" color="cyan" name={`flow_bfw_${x}`} value={stockTank[`flow_bfw_${x}`]} onChange={onStockTankChange} readOnly={isShutdown} />
                        <TotalizerInput label="BFW" name={`bfw_boiler_${x}`} value={stockTank[`bfw_boiler_${x}`]} prev={prevBfw} onChange={onStockTankChange} unit="ton" color="cyan" />
                    </Card>

                    <Card title="Furnace & Air" icon="local_fire_department" color="orange">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Temp Furnace" unit="°C" color="orange" name={`temp_furnace_${x}`} value={turbineMisc[`temp_furnace_${x}`]} onChange={onTurbineMiscChange} />
                            <InputField label="Air Heater TI113" unit="°C" color="orange" name={`air_heater_ti113_${x}`} value={turbineMisc[`air_heater_ti113_${x}`]} onChange={onTurbineMiscChange} readOnly={isShutdown} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Temp Flue Gas" unit="°C" color="orange" name={`temp_flue_gas_${x}`} value={turbineMisc[`temp_flue_gas_${x}`]} onChange={onTurbineMiscChange} readOnly={isShutdown} />
                            <InputField label="O2" unit="%" color="orange" name={`o2_${x}`} value={turbineMisc[`o2_${x}`]} onChange={onTurbineMiscChange} readOnly={isShutdown} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Primary Air" unit="ton" color="orange" name={`primary_air_${x}`} value={turbineMisc[`primary_air_${x}`]} onChange={onTurbineMiscChange} readOnly={isShutdown} />
                            <InputField label="Secondary Air" unit="ton" color="orange" name={`secondary_air_${x}`} value={turbineMisc[`secondary_air_${x}`]} onChange={onTurbineMiscChange} readOnly={isShutdown} />
                        </div>
                        <InputField label="Pressure Drum" unit="MPa" color="orange" name={`steam_drum_press_${x}`} value={turbineMisc[`steam_drum_press_${x}`]} onChange={onTurbineMiscChange} readOnly={isShutdown} />
                    </Card>

                    <Card title={`Coal Feeder ${feeders[0].toUpperCase()}-${feeders[2].toUpperCase()}`} icon="precision_manufacturing" color="emerald">
                        {feeders.map((f) => {
                            const prevF = prevCoal ? n(prevCoal[`coal_${f}_24`]) : 0;
                            return (
                                <div key={f} className="space-y-2">
                                    <p className="text-xs font-bold text-white uppercase tracking-wider">Feeder {f.toUpperCase()}</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <TotalizerInput label={f.toUpperCase()} name={`coal_${f}_24`} value={coal[`coal_${f}_24`]} prev={prevF} onChange={onCoalChange} unit="ton" color="emerald" />
                                        <InputField label="Flow" unit="t/h" color="emerald" name={`coal_${f}_00`} value={coal[`coal_${f}_00`]} onChange={onCoalChange} readOnly={isShutdown} />
                                    </div>
                                </div>
                            );
                        })}
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[240px] shrink-0 xl:h-full flex flex-col">
                <Card title={`Produksi Boiler ${boilerId}`} icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="PRODUKSI STEAM" value={produksiSteam.toFixed(2)} unit="ton" variant="primary" />
                    <CalculatedField label="PRODUKSI BFW" value={produksiBfw.toFixed(2)} unit="ton" variant="secondary" />
                    {feeders.map((f, i) => (
                        <CalculatedField key={f} label={`Konsumsi Feeder ${f.toUpperCase()}`} value={feederKons[i].toFixed(2)} unit="ton" variant="small" />
                    ))}
                    <div className="h-px bg-slate-700/80 w-full my-1" />
                    <CalculatedField label="Total Batubara" value={totalBatubara.toFixed(2)} unit="ton" variant="primary" />
                    <div className="mt-auto">
                        <CalculatedField label="Consumption Rate" value={cr > 0 ? cr.toFixed(3) : '—'} unit="ton/ton" variant="purple" />
                    </div>
                </Card>
            </div>
        </>
    );
}
