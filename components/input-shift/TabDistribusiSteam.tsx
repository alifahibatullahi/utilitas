'use client';
import React from 'react';
import { Card, InputField, CalculatedField } from './SharedComponents';

export default function TabDistribusiSteam() {
    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Pabrik 1" icon="factory" color="blue">
                        <InputField label="Flow Steam" unit="t/h" color="blue" />
                        <InputField label="Temperatur" unit="°C" color="blue" />
                        <InputField label="Totaliser" unit="ton" color="blue" />
                    </Card>

                    <Card title="Pabrik 2" icon="factory" color="cyan">
                        <InputField label="Flow Steam" unit="t/h" color="cyan" />
                        <InputField label="Temperatur" unit="°C" color="cyan" />
                        <InputField label="Totaliser" unit="ton" color="cyan" />
                    </Card>

                    <Card title="Pabrik 3" icon="factory" color="emerald">
                        <InputField label="Flow Steam" unit="t/h" color="emerald" />
                        <InputField label="Temperatur" unit="°C" color="emerald" />
                        <InputField label="Totaliser" unit="ton" color="emerald" />
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[350px] shrink-0 h-full flex flex-col">
                <Card title="Calculated Totals" icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="Total Steam Pabrik 1" value="0.00" unit="ton" variant="secondary" size="medium" />
                    <CalculatedField label="Total Steam Pabrik 2" value="0.00" unit="ton" variant="secondary" size="medium" />
                    <CalculatedField label="Total Steam Pabrik 3" value="0.00" unit="ton" variant="secondary" size="medium" />

                    <div className="h-px bg-slate-700/80 w-full my-2"></div>

                    <CalculatedField label="GRAND TOTAL STEAM" value="0.00" unit="ton" variant="primary" size="large" />
                </Card>
            </div>
        </>
    );
}
