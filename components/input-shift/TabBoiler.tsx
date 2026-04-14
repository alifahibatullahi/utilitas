'use client';
import React from 'react';
import { Card, InputField, CalculatedField, SelisihInfo } from './SharedComponents';

interface TabBoilerProps {
    boilerId: 'A' | 'B';
    values?: Record<string, number | string | null>;
    onFieldChange?: (name: string, value: number | string | null) => void;
    coalBunkerValues?: Record<string, number | null>;
    onCoalBunkerChange?: (name: string, value: number | string | null) => void;
    prevTotalizerSteam?: number | null;
    prevTotalizerBfw?: number | null;
    prevCoalBunkerValues?: Record<string, number | null>;
}

export default function TabBoiler({ boilerId, values = {}, onFieldChange, coalBunkerValues = {}, onCoalBunkerChange, prevTotalizerSteam, prevTotalizerBfw, prevCoalBunkerValues = {} }: TabBoilerProps) {
    const feeders = boilerId === 'A' ? ['A', 'B', 'C'] : ['D', 'E', 'F'];
    const feederKeys = boilerId === 'A' ? ['feeder_a', 'feeder_b', 'feeder_c'] : ['feeder_d', 'feeder_e', 'feeder_f'];

    // Calculate produksi (selisih) from totalizer
    const currentSteam = Number(values.totalizer_steam) || 0;
    const prevSteam = Number(prevTotalizerSteam) || 0;
    const produksiSteam = prevSteam > 0 ? currentSteam - prevSteam : 0;

    // Calculate produksi BFW (selisih) from totalizer
    const currentBfw = Number(values.totalizer_bfw) || 0;
    const prevBfw = Number(prevTotalizerBfw) || 0;
    const produksiBfw = prevBfw > 0 ? currentBfw - prevBfw : 0;

    // Calculate konsumsi batubara (selisih) from feeder totalizers
    const feederKonsumsi = feederKeys.map(key => {
        const current = Number(coalBunkerValues[key]) || 0;
        const prev = Number(prevCoalBunkerValues[key]) || 0;
        return prev > 0 ? current - prev : 0;
    });
    const totalBatubara = feederKonsumsi.reduce((sum, k) => sum + k, 0);
    const cr = produksiSteam > 0 ? (totalBatubara / produksiSteam) : 0;

    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Steam Parameters" icon="waves" color="blue">
                        <InputField label="Pressure Steam" unit="MPa" color="blue" name="press_steam" value={values.press_steam} onChange={onFieldChange} />
                        <InputField label="Temp Steam" unit="°C" color="blue" name="temp_steam" value={values.temp_steam} onChange={onFieldChange} />
                        <InputField label="Flow Steam" unit="t/h" color="blue" name="flow_steam" value={values.flow_steam} onChange={onFieldChange} />
                        <div>
                            <InputField label="Totalizer Steam" unit="ton" color="blue" name="totalizer_steam" value={values.totalizer_steam} onChange={onFieldChange} placeholder={prevSteam > 0 ? String(prevSteam) : '0.0'} />
                            <SelisihInfo prev={prevSteam} current={currentSteam} />
                        </div>
                    </Card>

                    <Card title="Boiler Feed Water" icon="water_drop" color="cyan">
                        <InputField label="Pressure BFW" unit="MPa" color="cyan" name="bfw_press" value={values.bfw_press} onChange={onFieldChange} />
                        <InputField label="Temp BFW" unit="°C" color="cyan" name="temp_bfw" value={values.temp_bfw} onChange={onFieldChange} />
                        <InputField label="Flow BFW" unit="t/h" color="cyan" name="flow_bfw" value={values.flow_bfw} onChange={onFieldChange} />
                        <div>
                            <InputField label="Totalizer BFW" unit="ton" color="cyan" name="totalizer_bfw" value={values.totalizer_bfw} onChange={onFieldChange} placeholder={Number(prevTotalizerBfw) > 0 ? String(Number(prevTotalizerBfw)) : '0.0'} />
                            <SelisihInfo prev={Number(prevTotalizerBfw) || 0} current={Number(values.totalizer_bfw) || 0} />
                        </div>
                    </Card>

                    <Card title="Furnace & Air" icon="local_fire_department" color="orange">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Temp Furnace" unit="°C" color="orange" name="temp_furnace" value={values.temp_furnace} onChange={onFieldChange} />
                            <InputField label="Air Heater TI113" unit="°C" color="orange" name="air_heater_ti113" value={values.air_heater_ti113} onChange={onFieldChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Vacuum" unit="Pa" color="orange" name="excess_air" value={values.excess_air} onChange={onFieldChange} negative />
                            <InputField label="Temp Flue Gas" unit="°C" color="orange" name="temp_flue_gas" value={values.temp_flue_gas} onChange={onFieldChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Primary Air" unit="ton" color="orange" name="primary_air" value={values.primary_air} onChange={onFieldChange} />
                            <InputField label="Secondary Air" unit="ton" color="orange" name="secondary_air" value={values.secondary_air} onChange={onFieldChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="O2" unit="%" color="orange" name="o2" value={values.o2} onChange={onFieldChange} />
                            <InputField label="Pressure Drum" unit="MPa" color="orange" name="steam_drum_press" value={values.steam_drum_press} onChange={onFieldChange} />
                        </div>
                    </Card>

                    <Card title={`Coal Feeder ${feeders.join('-')}`} icon="precision_manufacturing" color="emerald">
                        {feeders.map((feeder, idx) => (
                            <div key={feeder} className="space-y-2">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Feeder {feeder}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <InputField placeholder={Number(prevCoalBunkerValues[feederKeys[idx]]) > 0 ? String(Number(prevCoalBunkerValues[feederKeys[idx]])) : 'Totalizer'} unit="ton" color="emerald" size="small" name={feederKeys[idx]} value={coalBunkerValues[feederKeys[idx]]} onChange={onCoalBunkerChange} />
                                        <SelisihInfo prev={Number(prevCoalBunkerValues[feederKeys[idx]]) || 0} current={Number(coalBunkerValues[feederKeys[idx]]) || 0} />
                                    </div>
                                    <InputField placeholder="Flow" unit="t/h" color="emerald" size="small" name={`${feederKeys[idx]}_flow`} value={values[`${feederKeys[idx]}_flow`]} onChange={onFieldChange} />
                                </div>
                            </div>
                        ))}
                        <div className="space-y-2 mt-2 pt-3 border-t border-slate-700/50">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Solar Usage</p>
                            <InputField placeholder="0.00" unit="m³" color="emerald" size="small" name="solar_m3" value={values.solar_m3} onChange={onFieldChange} />
                        </div>
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[240px] shrink-0 h-full flex flex-col">
                <Card title="Produksi Shift" icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="PRODUKSI STEAM" value={produksiSteam.toFixed(2)} unit="ton" variant="primary" size="large" />
                    <CalculatedField label="PRODUKSI BFW" value={produksiBfw.toFixed(2)} unit="ton" variant="secondary" size="medium" />

                    {feeders.map((feeder, idx) => (
                        <CalculatedField key={feeder} label={`Konsumsi Feeder ${feeder}`} value={feederKonsumsi[idx].toFixed(2)} unit="ton" variant="small" size="small" />
                    ))}

                    <div className="h-px bg-slate-700/80 w-full my-1"></div>

                    <CalculatedField label="Total Batubara" value={totalBatubara.toFixed(2)} unit="ton" variant="primary" size="large" />

                    <div className="mt-auto">
                        <CalculatedField label="Consumption Rate" value={cr.toFixed(3)} unit="ton/ton" variant="purple" size="large" />
                    </div>
                </Card>
            </div>
        </>
    );
}
