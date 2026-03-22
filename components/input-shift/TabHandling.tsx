'use client';
import React from 'react';
import { Card, InputField, CalculatedField } from './SharedComponents';

interface TabHandlingProps {
    espValues?: Record<string, number | string | null>;
    tankyardValues?: Record<string, number | string | null>;
    onEspChange?: (name: string, value: number | string | null) => void;
    onTankyardChange?: (name: string, value: number | string | null) => void;
}

export default function TabHandling({ espValues = {}, tankyardValues = {}, onEspChange, onTankyardChange }: TabHandlingProps) {
    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Loading Batubara" icon="local_shipping" color="orange">
                        <InputField label="Total Loading" unit="shovel" color="orange" name="loading" value={espValues.loading} onChange={onEspChange} />

                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">
                                Hopper Aktif
                            </label>
                            <select
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-sm font-mono transition-all"
                                value={(espValues.hopper as string) ?? 'A'}
                                onChange={e => onEspChange?.('hopper', e.target.value)}
                            >
                                <option value="A">Hopper A</option>
                                <option value="B">Hopper B</option>
                            </select>
                        </div>

                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">
                                Conveyor Status
                            </label>
                            <select
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-sm font-mono transition-all"
                                value={(espValues.conveyor as string) ?? 'AB'}
                                onChange={e => onEspChange?.('conveyor', e.target.value)}
                            >
                                <option value="AB">Conveyor AB (1&amp;2)</option>
                                <option value="A">Conveyor A (1)</option>
                                <option value="B">Conveyor B (2)</option>
                            </select>
                        </div>
                    </Card>

                    <Card title="Tankyard" icon="water_drop" color="blue">
                        <InputField label="Level RCW" unit="m" color="blue" name="tk_rcw" value={tankyardValues.tk_rcw} onChange={onTankyardChange} />
                        <InputField label="Level Demin" unit="m" color="blue" name="tk_demin" value={tankyardValues.tk_demin} onChange={onTankyardChange} />
                        <InputField label="Level Tanki Solar" unit="m" color="blue" name="tk_solar_ab" value={tankyardValues.tk_solar_ab} onChange={onTankyardChange} />
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[350px] shrink-0 h-full flex flex-col">
                <Card title="Calculated Totals" icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="TOTAL LEVEL RCW" value="0.00" unit="m" variant="secondary" size="medium" />
                    <CalculatedField label="TOTAL LEVEL DEMIN" value="0.00" unit="m" variant="secondary" size="medium" />
                    <CalculatedField label="TOTAL TANKI SOLAR" value="0.00" unit="m" variant="secondary" size="medium" />
                </Card>
            </div>
        </>
    );
}
