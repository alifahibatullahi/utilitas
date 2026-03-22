'use client';
import React from 'react';
import { Card, InputField, CalculatedField } from './SharedComponents';

interface TabESPProps {
    values?: Record<string, number | string | null>;
    onFieldChange?: (name: string, value: number | string | null) => void;
}

export default function TabESP({ values = {}, onFieldChange }: TabESPProps) {
    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Trafo A" icon="electrical_services" color="blue">
                        <InputField label="A1" unit="kV" color="blue" name="esp_a1" value={values.esp_a1} onChange={onFieldChange} />
                        <InputField label="A2" unit="kV" color="blue" name="esp_a2" value={values.esp_a2} onChange={onFieldChange} />
                        <InputField label="A3" unit="kV" color="blue" name="esp_a3" value={values.esp_a3} onChange={onFieldChange} />
                    </Card>

                    <Card title="Trafo B" icon="electrical_services" color="cyan">
                        <InputField label="B1" unit="kV" color="cyan" name="esp_b1" value={values.esp_b1} onChange={onFieldChange} />
                        <InputField label="B2" unit="kV" color="cyan" name="esp_b2" value={values.esp_b2} onChange={onFieldChange} />
                        <InputField label="B3" unit="kV" color="cyan" name="esp_b3" value={values.esp_b3} onChange={onFieldChange} />
                    </Card>

                    <Card title="Ash Silo" icon="inventory_2" color="emerald">
                        <InputField label="Level Silo A" unit="%" color="emerald" name="silo_a" value={values.silo_a} onChange={onFieldChange} />
                        <InputField label="Level Silo B" unit="%" color="emerald" name="silo_b" value={values.silo_b} onChange={onFieldChange} />
                    </Card>

                    <Card title="Unloading Fly Ash" icon="local_shipping" color="orange">
                        <InputField label="Silo A" unit="rate" color="orange" name="unloading_a" value={values.unloading_a} onChange={onFieldChange} />
                        <InputField label="Silo B" unit="rate" color="orange" name="unloading_b" value={values.unloading_b} onChange={onFieldChange} />
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[350px] shrink-0 h-full flex flex-col">
                <Card title="Calculated Totals" icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="TOTAL LEVEL ASH SILO" value="0.00" unit="%" variant="secondary" size="medium" />
                    <CalculatedField label="TOTAL UNLOADING ASH SILO" value="0.00" unit="rate" variant="secondary" size="medium" />
                </Card>
            </div>
        </>
    );
}
