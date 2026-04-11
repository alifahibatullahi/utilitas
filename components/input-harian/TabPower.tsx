'use client';
import React from 'react';
import { Card, InputField, SelisihInfo, CalculatedField } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

// Sama persis dengan TabGenerator laporan shift
const DIST_ITEMS = [
    { key: 'ubb',      label: 'Internal UBB' },
    { key: 'pabrik2',  label: 'Pabrik 2'     },
    { key: 'pabrik3a', label: 'Pabrik 3A'    },
    { key: 'revamping',label: 'Pabrik 3B'    },
    { key: 'pie',      label: 'PIU'           },
] as const;

export default function TabPower({
    power, turbineMisc,
    prevPower,
    onPowerChange, onTurbineMiscChange,
}: DailyTabProps) {
    const pv = power as Record<string, number | string | null>;
    const gv = turbineMisc as Record<string, number | string | null>;
    const prevPD = prevPower as Record<string, number | null> | undefined;

    const fmt = (v: number | string | null | undefined) => (Number(v) || 0).toFixed(2);

    return (
        <div className="flex-1 flex flex-col xl:flex-row gap-6 w-full overflow-y-auto">
            <div className="flex-1 min-w-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Generator Output" icon="flash_on" color="blue">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Load STG"      unit="MW"   color="blue" name="gen_00"        value={pv.gen_00}        onChange={onPowerChange} />
                            <InputField label="Ampere"        unit="A"    color="blue" name="gen_ampere"    value={gv.gen_ampere}    onChange={onTurbineMiscChange} />
                            <InputField label="Voltage"       unit="kV"   color="blue" name="gen_tegangan"  value={gv.gen_tegangan}  onChange={onTurbineMiscChange} />
                            <InputField label="Reactive Power"unit="Mvar" color="blue" name="gen_amp_react" value={gv.gen_amp_react} onChange={onTurbineMiscChange} />
                            <InputField label="Frekuensi"     unit="Hz"   color="blue" name="gen_frequensi" value={gv.gen_frequensi} onChange={onTurbineMiscChange} />
                            <InputField label="Cos θ"                     color="blue" name="gen_cos_phi"   value={gv.gen_cos_phi}   onChange={onTurbineMiscChange} />
                        </div>
                    </Card>

                    <Card title="Gardu Induk (PLN)" icon="electrical_services" color="orange">
                        <InputField label="Σ P"   unit="MW"   color="orange" name="gi_sum_p"  value={gv.gi_sum_p}  onChange={onTurbineMiscChange} />
                        <InputField label="Σ Q"   unit="MVAR" color="orange" name="gi_sum_q"  value={gv.gi_sum_q}  onChange={onTurbineMiscChange} />
                        <InputField label="Cos θ"             color="orange" name="gi_cos_phi" value={gv.gi_cos_phi} onChange={onTurbineMiscChange} />
                    </Card>

                    <div className="md:col-span-2">
                        <Card title="Distribusi Power" icon="account_tree" color="emerald">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {DIST_ITEMS.map(({ key, label }) => {
                                    const mwName  = `power_${key}`;
                                    const totName = `power_${key}_totalizer`;
                                    const prevTot = Number(prevPD?.[totName]) || 0;
                                    const curTot  = Number(pv[totName]) || 0;

                                    return (
                                        <div key={key} className="bg-[#101822]/40 border border-slate-700/40 rounded-lg p-3">
                                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{label}</span>
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                                <div>
                                                    <InputField label="Totalizer" unit="MWh" color="emerald" size="small" name={totName} value={pv[totName]} onChange={onPowerChange} thousands />
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
                                            <InputField label="Totalizer" unit="MWh" color="emerald" size="small" name="power_stg_ubb_totalizer" value={pv.power_stg_ubb_totalizer} onChange={onPowerChange} thousands />
                                            <SelisihInfo prev={Number(prevPD?.power_stg_ubb_totalizer) || 0} current={Number(pv.power_stg_ubb_totalizer) || 0} />
                                        </div>
                                        <div>
                                            <InputField label="MW" unit="MW" color="emerald" size="small" name="_stg_mw" value={pv.gen_00} readOnly />
                                            <p className="mt-1 text-[10px] text-slate-500">= Load STG</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                </div>
            </div>

            <div className="w-full xl:w-[240px] shrink-0 flex flex-col">
                <Card title="Power Summary" icon="calculate" color="purple" isSidebar={true}>
                    {/* ── MWh totals (selisih totalizer) ── */}
                    {(() => {
                        const sel = (key: string) => {
                            const cur = Number(pv[key]) || 0;
                            const prv = Number(prevPD?.[key]) || 0;
                            return prv > 0 ? cur - prv : 0;
                        };
                        const totalUbb     = sel('power_ubb_totalizer');
                        const totalUbbInt  = Math.round(totalUbb);
                        const b1           = Math.floor(totalUbbInt / 2);
                        const b2           = totalUbbInt - b1;
                        const totalPabrik2 = sel('power_pabrik2_totalizer');
                        const totalPabrik3a= sel('power_pabrik3a_totalizer');
                        const totalStgUbb  = sel('power_stg_ubb_totalizer');

                        // MW values
                        const mwUbb = Number(pv['power_ubb']) || 0;
                        const mwB1  = mwUbb / 2;
                        const mwB2  = mwUbb / 2;

                        return (
                            <>
                                <CalculatedField label="TOTAL INTERNAL UBB" value={totalUbbInt.toString()} unit="MWh" variant="primary" />
                                <CalculatedField label="Bus Bar 1"           value={b1.toString()}          unit="MWh" variant="transparent" />
                                <CalculatedField label="Bus Bar 2"           value={b2.toString()}          unit="MWh" variant="transparent" />
                                <CalculatedField label="TOTAL PABRIK 2"      value={totalPabrik2.toFixed(2)} unit="MWh" variant="secondary"   />
                                <CalculatedField label="TOTAL PABRIK 3A"     value={totalPabrik3a.toFixed(2)}unit="MWh" variant="secondary"   />
                                <CalculatedField label="TOTAL STG UBB"       value={totalStgUbb.toFixed(2)}  unit="MWh" variant="secondary"   />

                                <div className="h-px bg-slate-700/80 w-full my-1" />

                                <CalculatedField label="INTERNAL UBB" value={fmt(pv['power_ubb'])} unit="MW" variant="primary" />
                                <CalculatedField label="Bus Bar 1"    value={mwB1.toFixed(2)}       unit="MW" variant="transparent" />
                                <CalculatedField label="Bus Bar 2"    value={mwB2.toFixed(2)}       unit="MW" variant="transparent" />
                            </>
                        );
                    })()}
                </Card>
            </div>
        </div>
    );
}
