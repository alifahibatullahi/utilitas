'use client';
import React from 'react';
import { Card, InputField, CalculatedField } from './SharedComponents';

export default function TabTurbin() {
    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Steam Inlet Turbin" icon="waves" color="blue">
                        <InputField label="Pressure Steam Inlet" unit="MPa" color="blue" />
                        <InputField label="Flow Steam" unit="t/h" color="blue" />
                        <InputField label="Temp Steam" unit="°C" color="blue" />
                        <InputField label="Totalizer Steam Inlet" unit="ton" color="blue" />
                    </Card>

                    <Card title="Condenser" icon="water_drop" color="cyan">
                        <InputField label="Flow Condensate" unit="t/h" color="cyan" />
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Temp Exhaust Steam" unit="°C" color="cyan" />
                            <InputField label="Level Condenser" unit="%" color="cyan" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Vacuum" unit="MPa" color="cyan" />
                            <InputField label="Durasi HPO" unit="s" color="cyan" />
                        </div>
                        <InputField label="Totalizer Condensate" unit="ton" color="cyan" />
                    </Card>

                    <Card title="Bearings & Mechanical" icon="settings" color="orange">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Temp Thrust Bearing" unit="°C" color="orange" />
                            <InputField label="Temp Metal Bearing" unit="°C" color="orange" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Vibrasi" unit="µm" color="orange" />
                            <InputField label="Temp Winding" unit="°C" color="orange" />
                        </div>
                        <InputField label="Axial Displacement" unit="mm" color="orange" />
                    </Card>

                    <Card title="Deaerator & Cooling Water" icon="opacity" color="emerald">
                        <InputField label="Pressure Deaerator" unit="MPa" color="emerald" />
                        <InputField label="Temp Deaerator" unit="°C" color="emerald" />
                        <InputField label="Pressure LPS" unit="MPa" color="emerald" />

                        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-700/50">
                            <InputField label="Temp CW In" unit="°C" color="emerald" />
                            <InputField label="Temp CW Out" unit="°C" color="emerald" />
                        </div>
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[350px] shrink-0 h-full flex flex-col">
                <Card title="Calculated Totals" icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="TOTAL STEAM INLET TURBIN" value="0.00" unit="ton" variant="primary" />
                    <CalculatedField label="TOTAL CONDENSATE" value="0.00" unit="ton" variant="primary" />

                    <CalculatedField label="TEMP THRUST BEARING" value="0.0" unit="°C" variant="transparent" />
                    <CalculatedField label="DURASI HPO (s)" value="0" unit="s" variant="transparent" />
                    <CalculatedField label="AXIAL DISPLACEMENT" value="0.0" unit="mm" variant="transparent" />

                    <div className="h-px bg-slate-700/80 w-full my-1"></div>

                    <CalculatedField label="TOTAL LOAD MW" value="0.00" unit="MW" variant="transparent" />
                </Card>
            </div>
        </>
    );
}
