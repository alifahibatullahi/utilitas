'use client';
import React from 'react';
import { Card, InputField, CalculatedField, SelisihInfo } from './SharedComponents';

interface TabTurbinProps {
    values?: Record<string, number | string | null>;
    onFieldChange?: (name: string, value: number | string | null) => void;
    prevTotalizerSteamInlet?: number | null;
    prevTotalizerCondensate?: number | null;
}

export default function TabTurbin({ values = {}, onFieldChange, prevTotalizerSteamInlet, prevTotalizerCondensate }: TabTurbinProps) {
    const currentSteamInlet = Number(values.totalizer_steam_inlet) || 0;
    const prevSteamInlet = Number(prevTotalizerSteamInlet) || 0;
    const produksiSteamInlet = prevSteamInlet > 0 ? currentSteamInlet - prevSteamInlet : 0;

    const currentCondensate = Number(values.totalizer_condensate) || 0;
    const prevCondensate = Number(prevTotalizerCondensate) || 0;
    const produksiCondensate = prevCondensate > 0 ? currentCondensate - prevCondensate : 0;

    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Steam Inlet Turbin" icon="waves" color="blue">
                        <InputField label="Pressure Steam Inlet" unit="MPa" color="blue" name="press_steam" value={values.press_steam} onChange={onFieldChange} />
                        <InputField label="Temp Steam" unit="°C" color="blue" name="temp_steam" value={values.temp_steam} onChange={onFieldChange} />
                        <InputField label="Flow Steam" unit="t/h" color="blue" name="flow_steam" value={values.flow_steam} onChange={onFieldChange} />
                        <div>
                            <InputField label="Totalizer Steam Inlet" unit="ton" color="blue" name="totalizer_steam_inlet" value={values.totalizer_steam_inlet} onChange={onFieldChange} />
                            <SelisihInfo prev={prevSteamInlet} current={currentSteamInlet} />
                        </div>
                    </Card>

                    <Card title="Condenser" icon="water_drop" color="cyan">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Flow Condensate" unit="t/h" color="cyan" name="flow_cond" value={values.flow_cond} onChange={onFieldChange} />
                            <InputField label="Temp Exhaust Steam" unit="°C" color="cyan" name="exh_steam" value={values.exh_steam} onChange={onFieldChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Vacuum" unit="MPa" color="cyan" name="vacuum" value={values.vacuum} onChange={onFieldChange} negative />
                            <InputField label="Level Condenser" unit="mm" color="cyan" name="level_condenser" value={values.level_condenser} onChange={onFieldChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Durasi HPO" unit="s" color="cyan" name="hpo_durasi" value={values.hpo_durasi} onChange={onFieldChange} />
                            <div>
                                <InputField label="Totalizer Condensate" unit="ton" color="cyan" name="totalizer_condensate" value={values.totalizer_condensate} onChange={onFieldChange} />
                                <SelisihInfo prev={prevCondensate} current={currentCondensate} />
                            </div>
                        </div>
                    </Card>
                    <Card title="Bearings & Mechanical" icon="settings" color="orange">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Temp Thrust Bearing" unit="°C" color="orange" name="thrust_bearing" value={values.thrust_bearing} onChange={onFieldChange} />
                            <InputField label="Temp Metal Bearing" unit="°C" color="orange" name="metal_bearing" value={values.metal_bearing} onChange={onFieldChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Vibrasi" unit="um" color="orange" name="vibrasi" value={values.vibrasi} onChange={onFieldChange} />
                            <InputField label="Temp Winding" unit="°C" color="orange" name="winding" value={values.winding} onChange={onFieldChange} />
                        </div>
                        <InputField label="Axial Displacement" unit="mm" color="orange" name="axial_displacement" value={values.axial_displacement} onChange={onFieldChange} textMode />
                    </Card>

                    <Card title="Deaerator & Cooling Water" icon="opacity" color="emerald">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Pressure Deaerator" unit="MPa" color="emerald" name="press_deaerator" value={values.press_deaerator} onChange={onFieldChange} />
                            <InputField label="Temp Deaerator" unit="°C" color="emerald" name="temp_deaerator" value={values.temp_deaerator} onChange={onFieldChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Pressure LPS" unit="MPa" color="emerald" name="press_lps" value={values.press_lps} onChange={onFieldChange} />
                            <div></div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-700/50">
                            <InputField label="Temp CW In" unit="°C" color="emerald" name="temp_cw_in" value={values.temp_cw_in} onChange={onFieldChange} />
                            <InputField label="Temp CW Out" unit="°C" color="emerald" name="temp_cw_out" value={values.temp_cw_out} onChange={onFieldChange} />
                        </div>
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[240px] shrink-0 h-full flex flex-col">
                <Card title="Produksi Shift" icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="PRODUKSI STEAM INLET" value={produksiSteamInlet.toFixed(2)} unit="ton" variant="primary" />
                    <CalculatedField label="PRODUKSI CONDENSATE" value={produksiCondensate.toFixed(2)} unit="ton" variant="secondary" />

                    <div className="h-px bg-slate-700/80 w-full my-1"></div>

                    <CalculatedField label="TEMP THRUST BEARING" value={String(Number(values.thrust_bearing) || 0)} unit="°C" variant="transparent" />
                    <CalculatedField label="DURASI HPO" value={String(Number(values.hpo_durasi) || 0)} unit="s" variant="transparent" />
                    <CalculatedField label="AXIAL DISPLACEMENT" value={String(Number(values.axial_displacement) || 0)} unit="mm" variant="transparent" />
                </Card>
            </div>
        </>
    );
}
