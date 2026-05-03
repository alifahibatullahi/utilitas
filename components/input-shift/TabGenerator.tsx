'use client';
import React from 'react';
import { Card, InputField, SelisihInfo, CalculatedField } from './SharedComponents';

interface TabGeneratorProps {
    generatorValues?: Record<string, number | string | null>;
    powerValues?: Record<string, number | string | null>;
    onGeneratorChange?: (name: string, value: number | string | null) => void;
    onPowerChange?: (name: string, value: number | string | null) => void;
    prevPowerDist?: Record<string, number | null>;
    genLoad?: number | null;
}

// Distribution items config
const DIST_ITEMS = [
    { key: 'ubb', label: 'Internal UBB' },
    { key: 'pabrik2', label: 'Pabrik 2' },
    { key: 'pabrik3a', label: 'Pabrik 3A' },
    { key: 'revamping', label: 'Pabrik 3B' },
    { key: 'pie', label: 'PIU' },
] as const;

export default function TabGenerator({ generatorValues = {}, powerValues = {}, onGeneratorChange, onPowerChange, prevPowerDist = {}, genLoad }: TabGeneratorProps) {
    const pv = powerValues;
    const gv = generatorValues;
    const fmt = (v: number | string | null | undefined) => (Number(v) || 0).toFixed(2);

    return (
        <>
            <div className="flex-1 w-full overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Generator Output" icon="flash_on" color="blue">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Load STG" unit="MW" color="blue" name="gen_load" value={gv.gen_load} onChange={onGeneratorChange} />
                            <InputField label="Ampere" unit="A" color="blue" name="gen_ampere" value={gv.gen_ampere} onChange={onGeneratorChange} />
                            <InputField label="Voltage" unit="kV" color="blue" name="gen_tegangan" value={gv.gen_tegangan} onChange={onGeneratorChange} />
                            <InputField label="Reactive Power" unit="Mvar" color="blue" name="gen_amp_react" value={gv.gen_amp_react} onChange={onGeneratorChange} />
                            <InputField label="Frekuensi" unit="Hz" color="blue" name="gen_frequensi" value={gv.gen_frequensi} onChange={onGeneratorChange} />
                            <InputField label="Cos θ" color="blue" name="gen_cos_phi" value={gv.gen_cos_phi} onChange={onGeneratorChange} />
                        </div>
                    </Card>

                    <Card title="Gardu Induk (PLN)" icon="electrical_services" color="orange">
                        <InputField label="Σ P" unit="MW" color="orange" name="gi_sum_p" value={gv.gi_sum_p} onChange={onGeneratorChange} />
                        <InputField label="Σ Q" unit="MVAR" color="orange" name="gi_sum_q" value={gv.gi_sum_q} onChange={onGeneratorChange} />
                        <InputField label="Cos θ" color="orange" name="gi_cos_phi" value={gv.gi_cos_phi} onChange={onGeneratorChange} />
                    </Card>

                    <div className="md:col-span-2">
                        <Card title="Distribusi Power" icon="account_tree" color="emerald">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {DIST_ITEMS.map(({ key, label }) => {
                                    const mwName = `power_${key}`;
                                    const totName = `power_${key}_totalizer`;
                                    const prevTot = Number(prevPowerDist[totName]) || 0;
                                    const defaultZero = key === 'revamping' || key === 'pie';
                                    const totValue = defaultZero ? (pv[totName] ?? 0) : pv[totName];
                                    const curTot = Number(totValue) || 0;

                                    return (
                                        <div key={key} className="bg-[#101822]/40 border border-slate-700/40 rounded-lg p-3">
                                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{label}</span>
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                                <div>
                                                    <InputField label="Totalizer" unit="MWh" color="emerald" size="small" name={totName} value={totValue} onChange={onPowerChange} placeholder={prevTot > 0 ? String(prevTot) : '0'} />
                                                    <SelisihInfo prev={prevTot} current={curTot} />
                                                </div>
                                                <InputField label="MW" unit="MW" color="emerald" size="small" name={mwName} value={pv[mwName]} onChange={onPowerChange} textMode />
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* STG UBB: totalizer only, MW = Load STG */}
                                <div className="bg-[#101822]/40 border border-slate-700/40 rounded-lg p-3">
                                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">STG UBB</span>
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        <div>
                                            <InputField label="Totalizer" unit="MWh" color="emerald" size="small" name="power_stg_ubb_totalizer" value={pv.power_stg_ubb_totalizer} onChange={onPowerChange} placeholder={Number(prevPowerDist.power_stg_ubb_totalizer) > 0 ? String(Number(prevPowerDist.power_stg_ubb_totalizer)) : '0.0'} />
                                            <SelisihInfo prev={Number(prevPowerDist.power_stg_ubb_totalizer) || 0} current={Number(pv.power_stg_ubb_totalizer) || 0} />
                                        </div>
                                        <div>
                                            <InputField label="MW" unit="MW" color="emerald" size="small" name="_stg_mw" value={genLoad} readOnly />
                                            <p className="mt-1 text-[10px] text-slate-500">= Load STG</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                </div>
            </div>

            <div className="w-full xl:w-[240px] shrink-0 h-full flex flex-col">
                <Card title="Power Summary" icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="LOAD STG" value={fmt(gv.gen_load)} unit="MW" variant="primary" />

                    <div className="h-px bg-slate-700/80 w-full my-1" />

                    {DIST_ITEMS.map(({ key, label }) => (
                        <CalculatedField key={key} label={label.toUpperCase()} value={fmt(pv[`power_${key}`])} unit="MW" variant="transparent" />
                    ))}
                    <CalculatedField label="STG UBB" value={fmt(genLoad)} unit="MW" variant="transparent" />

                    <div className="h-px bg-slate-700/80 w-full my-1" />

                    <CalculatedField label="PLN (Σ P)" value={fmt(gv.gi_sum_p)} unit="MW" variant="transparent" />
                    <CalculatedField label="PLN (Σ Q)" value={fmt(gv.gi_sum_q)} unit="MVAR" variant="transparent" />
                </Card>
            </div>
        </>
    );
}
