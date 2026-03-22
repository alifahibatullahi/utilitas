'use client';
import React from 'react';
import { Card, InputField, CalculatedField } from './SharedComponents';

interface TabBoilerProps {
    boilerId: 'A' | 'B';
    values?: Record<string, number | string | null>;
    onFieldChange?: (name: string, value: number | string | null) => void;
}

export default function TabBoiler({ boilerId, values = {}, onFieldChange }: TabBoilerProps) {
    const feeders = boilerId === 'A' ? ['A', 'B', 'C'] : ['D', 'E', 'F'];

    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Steam Parameters" icon="waves" color="blue">
                        <InputField label="Pressure Steam" unit="MPa" color="blue" name="press_steam" value={values.press_steam} onChange={onFieldChange} />
                        <InputField label="Flow Steam" unit="t/h" color="blue" name="flow_steam" value={values.flow_steam} onChange={onFieldChange} />
                        <InputField label="Temp Steam" unit="°C" color="blue" name="temp_steam" value={values.temp_steam} onChange={onFieldChange} />
                        <InputField label="Totalizer Steam" unit="ton" color="blue" name="totalizer_steam" value={values.totalizer_steam} onChange={onFieldChange} />
                    </Card>

                    <Card title="Boiler Feed Water" icon="water_drop" color="cyan">
                        <InputField label="Pressure BFW" unit="MPa" color="cyan" name="bfw_press" value={values.bfw_press} onChange={onFieldChange} />
                        <InputField label="Flow BFW" unit="t/h" color="cyan" name="flow_bfw" value={values.flow_bfw} onChange={onFieldChange} />
                        <InputField label="Temp BFW" unit="°C" color="cyan" name="temp_bfw" value={values.temp_bfw} onChange={onFieldChange} />
                        <InputField label="Totalizer BFW" unit="ton" color="cyan" />
                    </Card>

                    <Card title="Furnace & Air" icon="local_fire_department" color="orange">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Temp Furnace" unit="°C" color="orange" name="temp_furnace" value={values.temp_furnace} onChange={onFieldChange} />
                            <InputField label="Air Heater" unit="°C" color="orange" name="air_heater_ti113" value={values.air_heater_ti113} onChange={onFieldChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Vacuum" unit="Pa" color="orange" name="excess_air" value={values.excess_air} onChange={onFieldChange} />
                            <InputField label="Temp Flue Gas" unit="°C" color="orange" name="temp_flue_gas" value={values.temp_flue_gas} onChange={onFieldChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Primary Air" unit="ton" color="orange" />
                            <InputField label="Secondary Air" unit="ton" color="orange" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="O2" unit="%" color="orange" />
                            <InputField label="Pressure Drum" unit="MPa" color="orange" name="steam_drum_press" value={values.steam_drum_press} onChange={onFieldChange} />
                        </div>
                    </Card>

                    <Card title={`Coal Feeder ${feeders.join('-')}`} icon="precision_manufacturing" color="emerald">
                        {feeders.map(feeder => (
                            <div key={feeder} className="space-y-2">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Feeder {feeder}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <InputField placeholder="Total" unit="ton" color="emerald" size="small" />
                                    <InputField placeholder="Flow" unit="t/h" color="emerald" size="small" />
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

            <div className="w-full xl:w-[350px] shrink-0 h-full flex flex-col">
                <Card title="Calculated Totals" icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="TOTAL STEAM" value="0.00" unit="ton" variant="primary" size="large" />
                    <CalculatedField label="TOTAL BOILER FEED WATER" value="0.00" unit="ton" variant="secondary" size="medium" />

                    {feeders.map(feeder => (
                        <CalculatedField key={feeder} label={`Total Coal Feeder ${feeder}`} value="0.00" unit="ton" variant="small" size="small" />
                    ))}

                    <div className="h-px bg-slate-700/80 w-full my-1"></div>

                    <CalculatedField label="Total Batubara" value="0.00" unit="ton" variant="primary" size="large" />

                    <div className="mt-auto">
                        <CalculatedField label="Consumption Rate" value="0.00" unit="kg/ton" variant="purple" size="large" />
                    </div>
                </Card>
            </div>
        </>
    );
}
