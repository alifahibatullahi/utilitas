'use client';
import React from 'react';
import { Card, InputField, CalculatedField, SelisihInfo } from './SharedComponents';

interface TabDistribusiSteamProps {
    values?: Record<string, number | string | null>;
    onFieldChange?: (name: string, value: number | string | null) => void;
    prevTotalizerPabrik1?: number | null;
    prevTotalizerPabrik2?: number | null;
    prevTotalizerPabrik3?: number | null;
}

export default function TabDistribusiSteam({ values = {}, onFieldChange, prevTotalizerPabrik1, prevTotalizerPabrik2, prevTotalizerPabrik3 }: TabDistribusiSteamProps) {
    const currentP1 = Number(values.pabrik1_totalizer) || 0;
    const prevP1 = Number(prevTotalizerPabrik1) || 0;
    const produksiP1 = prevP1 > 0 ? currentP1 - prevP1 : 0;

    const currentP2 = Number(values.pabrik2_totalizer) || 0;
    const prevP2 = Number(prevTotalizerPabrik2) || 0;
    const produksiP2 = prevP2 > 0 ? currentP2 - prevP2 : 0;

    const currentP3 = Number(values.pabrik3a_totalizer) || 0;
    const prevP3 = Number(prevTotalizerPabrik3) || 0;
    const produksiP3 = prevP3 > 0 ? currentP3 - prevP3 : 0;

    const grandTotal = produksiP1 + produksiP2 + produksiP3;

    return (
        <>
            <div className="flex-1 w-full overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">

                    <Card title="Pabrik 1" icon="factory" color="blue">
                        <InputField label="Flow Steam" unit="t/h" color="blue" name="pabrik1_flow" value={values.pabrik1_flow} onChange={onFieldChange} />
                        <InputField label="Temperatur" unit="°C" color="blue" name="pabrik1_temp" value={values.pabrik1_temp} onChange={onFieldChange} />
                        <div>
                            <InputField label="Totaliser" unit="ton" color="blue" name="pabrik1_totalizer" value={values.pabrik1_totalizer} onChange={onFieldChange} />
                            <SelisihInfo prev={prevP1} current={currentP1} />
                        </div>
                    </Card>

                    <Card title="Pabrik 2" icon="factory" color="cyan">
                        <InputField label="Flow Steam" unit="t/h" color="cyan" name="pabrik2_flow" value={values.pabrik2_flow} onChange={onFieldChange} />
                        <InputField label="Temperatur" unit="°C" color="cyan" name="pabrik2_temp" value={values.pabrik2_temp} onChange={onFieldChange} />
                        <div>
                            <InputField label="Totaliser" unit="ton" color="cyan" name="pabrik2_totalizer" value={values.pabrik2_totalizer} onChange={onFieldChange} />
                            <SelisihInfo prev={prevP2} current={currentP2} />
                        </div>
                    </Card>

                    <Card title="Pabrik 3" icon="factory" color="emerald">
                        <InputField label="Flow Steam" unit="t/h" color="emerald" name="pabrik3a_flow" value={values.pabrik3a_flow} onChange={onFieldChange} />
                        <InputField label="Temperatur" unit="°C" color="emerald" name="pabrik3a_temp" value={values.pabrik3a_temp} onChange={onFieldChange} />
                        <div>
                            <InputField label="Totaliser" unit="ton" color="emerald" name="pabrik3a_totalizer" value={values.pabrik3a_totalizer} onChange={onFieldChange} />
                            <SelisihInfo prev={prevP3} current={currentP3} />
                        </div>
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[240px] shrink-0 h-full flex flex-col">
                <Card title="Distribusi Shift" icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="Steam Pabrik 1" value={produksiP1.toFixed(2)} unit="ton" variant="secondary" size="medium" />
                    <CalculatedField label="Steam Pabrik 2" value={produksiP2.toFixed(2)} unit="ton" variant="secondary" size="medium" />
                    <CalculatedField label="Steam Pabrik 3" value={produksiP3.toFixed(2)} unit="ton" variant="secondary" size="medium" />

                    <div className="h-px bg-slate-700/80 w-full my-2"></div>

                    <CalculatedField label="GRAND TOTAL STEAM" value={grandTotal.toFixed(2)} unit="ton" variant="primary" size="large" />
                </Card>
            </div>
        </>
    );
}
