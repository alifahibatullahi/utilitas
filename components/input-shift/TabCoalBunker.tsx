'use client';
import React from 'react';
import { Card, InputField, CalculatedField } from './SharedComponents';

export default function TabCoalBunker() {
    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Boiler A" icon="inventory_2" color="blue">
                        <InputField label="Level Bunker A" unit="%" color="blue" />
                        <InputField label="Level Bunker B" unit="%" color="blue" />
                        <InputField label="Level Bunker C" unit="%" color="blue" />
                    </Card>

                    <Card title="Boiler B" icon="inventory_2" color="cyan">
                        <InputField label="Level Bunker D" unit="%" color="cyan" />
                        <InputField label="Level Bunker E" unit="%" color="cyan" />
                        <InputField label="Level Bunker F" unit="%" color="cyan" />
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[350px] shrink-0 h-full flex flex-col">
                <Card title="Calculated Totals" icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="AVG BUNKER A-C" value="0.00" unit="%" variant="secondary" size="medium" />
                    <CalculatedField label="AVG BUNKER D-F" value="0.00" unit="%" variant="secondary" size="medium" />

                    <div className="h-px bg-slate-700/80 w-full my-2"></div>

                    <CalculatedField label="OVERALL AVG LEVEL" value="0.00" unit="%" variant="primary" size="large" />
                </Card>
            </div>
        </>
    );
}
