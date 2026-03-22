'use client';
import React from 'react';
import { Card, InputField } from './SharedComponents';

interface TabGeneratorProps {
    generatorValues?: Record<string, number | string | null>;
    powerValues?: Record<string, number | string | null>;
    onGeneratorChange?: (name: string, value: number | string | null) => void;
    onPowerChange?: (name: string, value: number | string | null) => void;
}

export default function TabGenerator({ generatorValues = {}, powerValues = {}, onGeneratorChange, onPowerChange }: TabGeneratorProps) {
    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Generator Output" icon="flash_on" color="blue">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Load STG UBB" unit="MW" color="blue" name="gen_load" value={generatorValues.gen_load} onChange={onGeneratorChange} />
                            <InputField label="Ampere" unit="A" color="blue" name="gen_ampere" value={generatorValues.gen_ampere} onChange={onGeneratorChange} />
                            <InputField label="AMP React" unit="kVAR" color="blue" name="gen_amp_react" value={generatorValues.gen_amp_react} onChange={onGeneratorChange} />
                            <InputField label="Cos θ" color="blue" name="gen_cos_phi" value={generatorValues.gen_cos_phi} onChange={onGeneratorChange} />
                            <InputField label="Tegangan" unit="kV" color="blue" name="gen_tegangan" value={generatorValues.gen_tegangan} onChange={onGeneratorChange} />
                            <InputField label="Frekuensi" unit="Hz" color="blue" name="gen_frequensi" value={generatorValues.gen_frequensi} onChange={onGeneratorChange} />
                        </div>
                    </Card>

                    <Card title="Gardu Induk" icon="electrical_services" color="orange">
                        <InputField label="Σ P" unit="MW" color="orange" name="gi_sum_p" value={generatorValues.gi_sum_p} onChange={onGeneratorChange} />
                        <InputField label="Σ Q" unit="MVAR" color="orange" name="gi_sum_q" value={generatorValues.gi_sum_q} onChange={onGeneratorChange} />
                        <InputField label="Cos θ" color="orange" name="gi_cos_phi" value={generatorValues.gi_cos_phi} onChange={onGeneratorChange} />
                    </Card>

                    <Card title="Distribusi Power" icon="account_tree" color="emerald">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            <InputField label="Internal UBB" unit="MW" color="emerald" size="small" name="power_ubb" value={powerValues.power_ubb} onChange={onPowerChange} />
                            <InputField label="Pabrik 2" unit="MW" color="emerald" size="small" name="power_pabrik2" value={powerValues.power_pabrik2} onChange={onPowerChange} />
                            <InputField label="Pabrik 3A" unit="MW" color="emerald" size="small" name="power_pabrik3a" value={powerValues.power_pabrik3a} onChange={onPowerChange} />
                            <InputField label="PIU" unit="MW" color="emerald" size="small" name="power_pie" value={powerValues.power_pie} onChange={onPowerChange} />
                            <div className="col-span-2 md:col-span-1">
                                <InputField label="Pabrik 3B" unit="MW" color="emerald" size="small" name="power_pabrik3b" value={powerValues.power_pabrik3b} onChange={onPowerChange} />
                            </div>
                        </div>
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[350px] shrink-0 h-full flex flex-col">
                <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-sm flex flex-col group hover:border-purple-500/30 transition-colors duration-300 h-full">
                    <div className="p-4 border-b border-slate-800/80 flex items-center gap-3 bg-gradient-to-r from-[#1f2b3e]/50 to-transparent shrink-0">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <span className="material-symbols-outlined text-purple-500">calculate</span>
                        </div>
                        <h3 className="text-white font-bold text-lg tracking-wide">Power</h3>
                    </div>

                    <div className="p-4 flex flex-col gap-2.5 flex-1 justify-center overflow-y-auto scrollbar-hide">
                        <div className="flex flex-col gap-2 bg-[#2b7cee]/20 border-2 border-[#2b7cee]/50 rounded-xl p-5 mb-4 shadow-[0_0_25px_rgba(43,124,238,0.2)]">
                            <span className="text-xs font-black text-[#2b7cee] uppercase tracking-[0.2em] text-left">LOAD STG UBB</span>
                            <div className="flex items-baseline justify-between w-full">
                                <span className="text-white text-4xl font-mono font-black tracking-tighter">0.00</span>
                                <span className="text-[#2b7cee]/70 text-sm font-bold">MW</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <GeneratorSubCalculation label="Internal UBB" value="0.00" unit="MW" />
                            <GeneratorSubCalculation label="Pabrik 2" value="0.00" unit="MW" />
                            <GeneratorSubCalculation label="Pabrik 3A" value="0.00" unit="MW" />
                            <GeneratorSubCalculation label="PIU" value="0.00" unit="MW" />
                            <GeneratorSubCalculation label="Pabrik 3B" value="0.00" unit="MW" />
                            <GeneratorSubCalculation label="PLN (Sigma P)" value="0.00" unit="MW" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

const GeneratorSubCalculation = ({ label, value, unit }: { label: string, value: string, unit: string }) => (
    <div className="flex flex-col gap-1 bg-[#1f2b3e]/20 border border-slate-700/30 rounded-lg p-3">
        <span className="text-[10px] font-bold text-[#92a9c9] uppercase tracking-wider text-left">{label}</span>
        <div className="flex items-baseline justify-between w-full">
            <span className="text-white text-lg font-mono font-bold">{value}</span>
            <span className="text-slate-500 text-[10px] font-medium">{unit}</span>
        </div>
    </div>
);
