'use client';
import React from 'react';
import { Card, InputField, SelectField } from './SharedComponents';

interface TabCoalBunkerProps {
    values?: Record<string, number | string | null>;
    onFieldChange?: (name: string, value: number | string | null) => void;
}

export default function TabCoalBunker({ values = {}, onFieldChange }: TabCoalBunkerProps) {
    const statusOptions = [
        { value: 'Normal', label: 'Normal' },
        { value: 'Berasap', label: 'Berasap' }
    ];

    const h = onFieldChange as any;

    return (
        <div className="flex-1 w-full overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">

                <Card title="Boiler A" icon="inventory_2" color="blue">
                    <div className="flex flex-col gap-5">
                        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-700/50">
                            <InputField label="Level Bunker A" unit="%" color="blue" name="bunker_a" value={values.bunker_a} onChange={onFieldChange} />
                            <SelectField label="Status Bunker A" color="blue" name="status_bunker_a" value={values.status_bunker_a as string} onChange={h} options={statusOptions} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-700/50">
                            <InputField label="Level Bunker B" unit="%" color="blue" name="bunker_b" value={values.bunker_b} onChange={onFieldChange} />
                            <SelectField label="Status Bunker B" color="blue" name="status_bunker_b" value={values.status_bunker_b as string} onChange={h} options={statusOptions} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Level Bunker C" unit="%" color="blue" name="bunker_c" value={values.bunker_c} onChange={onFieldChange} />
                            <SelectField label="Status Bunker C" color="blue" name="status_bunker_c" value={values.status_bunker_c as string} onChange={h} options={statusOptions} />
                        </div>
                    </div>
                </Card>

                <Card title="Boiler B" icon="inventory_2" color="cyan">
                    <div className="flex flex-col gap-5">
                        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-700/50">
                            <InputField label="Level Bunker D" unit="%" color="cyan" name="bunker_d" value={values.bunker_d} onChange={onFieldChange} />
                            <SelectField label="Status Bunker D" color="cyan" name="status_bunker_d" value={values.status_bunker_d as string} onChange={h} options={statusOptions} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-700/50">
                            <InputField label="Level Bunker E" unit="%" color="cyan" name="bunker_e" value={values.bunker_e} onChange={onFieldChange} />
                            <SelectField label="Status Bunker E" color="cyan" name="status_bunker_e" value={values.status_bunker_e as string} onChange={h} options={statusOptions} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Level Bunker F" unit="%" color="cyan" name="bunker_f" value={values.bunker_f} onChange={onFieldChange} />
                            <SelectField label="Status Bunker F" color="cyan" name="status_bunker_f" value={values.status_bunker_f as string} onChange={h} options={statusOptions} />
                        </div>
                    </div>
                </Card>

            </div>
        </div>
    );
}
