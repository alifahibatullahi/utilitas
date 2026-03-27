'use client';
import React from 'react';
import { Card, InputField, SelisihInfo } from './SharedComponents';

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
    { key: 'revamping', label: 'Revamping' },
    { key: 'pie', label: 'PIU' },
] as const;

export default function TabGenerator({ generatorValues = {}, powerValues = {}, onGeneratorChange, onPowerChange, prevPowerDist = {}, genLoad }: TabGeneratorProps) {
    const pv = powerValues;
    const gv = generatorValues;
    const fmt = (v: number | string | null | undefined) => (Number(v) || 0).toFixed(2);

    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
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
                            <div className="space-y-4">
                                {DIST_ITEMS.map(({ key, label }) => {
                                    const mwName = `power_${key}`;
                                    const totName = `power_${key}_totalizer`;
                                    const prevTot = Number(prevPowerDist[totName]) || 0;
                                    const curTot = Number(pv[totName]) || 0;

                                    return (
                                        <div key={key} className="bg-[#101822]/40 border border-slate-700/40 rounded-lg p-3">
                                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{label}</span>
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                                <div>
                                                    <InputField label="Totalizer" unit="kWh" color="emerald" size="small" name={totName} value={pv[totName]} onChange={onPowerChange} />
                                                    <SelisihInfo prev={prevTot} current={curTot} />
                                                </div>
                                                <SignedMWInput label="MW" name={mwName} value={pv[mwName]} onChange={onPowerChange} />
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* STG UBB: totalizer only, MW = Load STG */}
                                <div className="bg-[#101822]/40 border border-slate-700/40 rounded-lg p-3">
                                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">STG UBB</span>
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        <div>
                                            <InputField label="Totalizer" unit="kWh" color="emerald" size="small" name="power_stg_ubb_totalizer" value={pv.power_stg_ubb_totalizer} onChange={onPowerChange} />
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

            <div className="w-full xl:w-[350px] shrink-0 h-full flex flex-col">
                <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-sm flex flex-col group hover:border-purple-500/30 transition-colors duration-300 h-full">
                    <div className="p-4 border-b border-slate-800/80 flex items-center gap-3 bg-gradient-to-r from-[#1f2b3e]/50 to-transparent shrink-0">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <span className="material-symbols-outlined text-purple-500">calculate</span>
                        </div>
                        <h3 className="text-white font-bold text-lg tracking-wide">Power Summary</h3>
                    </div>

                    <div className="p-4 flex flex-col gap-2.5 flex-1 justify-center overflow-y-auto scrollbar-hide">
                        <div className="flex flex-col gap-2 bg-[#2b7cee]/20 border-2 border-[#2b7cee]/50 rounded-xl p-5 mb-4 shadow-[0_0_25px_rgba(43,124,238,0.2)]">
                            <span className="text-xs font-black text-[#2b7cee] uppercase tracking-[0.2em] text-left">LOAD STG</span>
                            <div className="flex items-baseline justify-between w-full">
                                <span className="text-white text-4xl font-mono font-black tracking-tighter">{fmt(gv.gen_load)}</span>
                                <span className="text-[#2b7cee]/70 text-sm font-bold">MW</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {DIST_ITEMS.map(({ key, label }) => (
                                <GeneratorSubCalculation key={key} label={label} value={fmt(pv[`power_${key}`])} unit="MW" />
                            ))}
                            <GeneratorSubCalculation label="STG UBB" value={fmt(genLoad)} unit="MW" />
                            <div className="h-px bg-slate-700/50 my-1" />
                            <GeneratorSubCalculation label="PLN (Σ P)" value={fmt(gv.gi_sum_p)} unit="MW" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

/** MW input with +/- toggle for mobile (type=number doesn't show minus on some phones) */
const SignedMWInput = ({ label, name, value, onChange }: {
    label: string; name: string; value?: number | string | null;
    onChange?: (name: string, value: number | string | null) => void;
}) => {
    const numVal = Number(value) || 0;
    const isNeg = numVal < 0;

    const toggleSign = () => {
        if (value == null || value === '' || value === 0) return;
        onChange?.(name, -numVal);
    };

    return (
        <div className="space-y-1.5 w-full">
            <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-[10px]">{label}</label>
            <div className="flex gap-1.5">
                <button
                    type="button"
                    onClick={toggleSign}
                    className={`shrink-0 w-9 h-9 rounded-lg border text-sm font-bold transition-colors ${
                        isNeg
                            ? 'bg-red-500/20 border-red-500/50 text-red-400'
                            : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    }`}
                >
                    {isNeg ? '−' : '+'}
                </button>
                <div className="relative flex-1">
                    <input
                        className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2 pl-3 pr-10 text-white placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono transition-all text-left"
                        placeholder="0.0"
                        type="number"
                        inputMode="decimal"
                        value={value != null && value !== '' ? Math.abs(numVal) : ''}
                        onChange={e => {
                            const raw = e.target.value === '' ? null : parseFloat(e.target.value);
                            if (raw == null) { onChange?.(name, null); return; }
                            onChange?.(name, isNeg ? -Math.abs(raw) : Math.abs(raw));
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const inputs = Array.from(document.querySelectorAll('input:not([readonly]):not([disabled])'));
                                const idx = inputs.indexOf(e.target as Element);
                                if (idx >= 0 && idx < inputs.length - 1) (inputs[idx + 1] as HTMLElement).focus();
                            }
                        }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">MW</span>
                </div>
            </div>
        </div>
    );
};

const GeneratorSubCalculation = ({ label, value, unit }: { label: string, value: string, unit: string }) => (
    <div className="flex flex-col gap-1 bg-[#1f2b3e]/20 border border-slate-700/30 rounded-lg p-3">
        <span className="text-[10px] font-bold text-[#92a9c9] uppercase tracking-wider text-left">{label}</span>
        <div className="flex items-baseline justify-between w-full">
            <span className="text-white text-lg font-mono font-bold">{value}</span>
            <span className="text-slate-500 text-[10px] font-medium">{unit}</span>
        </div>
    </div>
);
