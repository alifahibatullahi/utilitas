'use client';
import React, { useEffect } from 'react';
import { InputField, Card, CalculatedField, SectionLabel, SelisihInfo, TotalizerInput } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

const BOILER_STATUS_OPTIONS = [
    { value: 'running', label: 'Running' },
    { value: 'shutdown', label: 'Shutdown' },
];
const BOILER_STATUS_DOT: Record<string, string> = {
    running: 'bg-emerald-500',
    shutdown: 'bg-red-500',
};

function BoilerStatusChip({ name, value, onChange }: {
    name: string;
    value: string;
    onChange: (name: string, v: string | null) => void;
}) {
    const dot = BOILER_STATUS_DOT[value] ?? 'bg-slate-500';
    const border = value === 'running' ? 'border-emerald-500/50' : value === 'shutdown' ? 'border-red-500/50' : 'border-slate-700/60';
    return (
        <div className={`inline-flex items-center gap-2 bg-[#101822]/60 border ${border} rounded-lg pl-3 pr-2 py-1.5 transition-colors`}>
            <span className={`w-3 h-3 rounded-full ${dot} shrink-0`} />
            <select
                className="bg-transparent appearance-none text-sm text-white font-semibold pr-4 cursor-pointer outline-none"
                value={value}
                onChange={e => onChange(name, e.target.value === '' ? null : e.target.value)}
            >
                <option value="" className="bg-[#101822] text-slate-500">Status...</option>
                {BOILER_STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[#101822] text-white">{opt.label}</option>
                ))}
            </select>
        </div>
    );
}

export default function TabBoiler({
    steam, coal, stockTank, turbineMisc,
    prevSteam, prevCoal, prevStockTank,
    onSteamChange, onCoalChange, onStockTankChange, onTurbineMiscChange,
    crA, crB,
}: DailyTabProps) {
    const n = (v: number | null | undefined) => Number(v) || 0;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');
    const pnSteam = (key: string) => prevSteam ? n(prevSteam[key]) : 0;
    const pnCoal = (key: string) => prevCoal ? n(prevCoal[key]) : 0;
    const pnTank = (key: string) => prevStockTank ? n(prevStockTank[key]) : 0;

    // Produksi Steam calculations
    const prevA24 = pnSteam('prod_boiler_a_24');
    const prevB24 = pnSteam('prod_boiler_b_24');
    const prodA24 = prevA24 > 0 ? n(steam.prod_boiler_a_24) - prevA24 : n(steam.prod_boiler_a_24);
    const prodB24 = prevB24 > 0 ? n(steam.prod_boiler_b_24) - prevB24 : n(steam.prod_boiler_b_24);
    const prodTotal24 = prodA24 + prodB24;

    // Coal calculations — selisih totalizer hari ini vs kemarin
    const selCoal = (key: string, val: number | null | undefined) => { const p = pnCoal(key); return p > 0 ? n(val) - p : n(val); };
    const totalA24 = selCoal('coal_a_24', coal.coal_a_24) + selCoal('coal_b_24', coal.coal_b_24) + selCoal('coal_c_24', coal.coal_c_24);
    const totalB24 = selCoal('coal_d_24', coal.coal_d_24) + selCoal('coal_e_24', coal.coal_e_24) + selCoal('coal_f_24', coal.coal_f_24);
    const grandTotal24 = totalA24 + totalB24;

    // BFW Consumption calculations
    const prevBfwA = pnTank('bfw_boiler_a');
    const prevBfwB = pnTank('bfw_boiler_b');
    const bfwConsA = prevBfwA > 0 ? n(stockTank.bfw_boiler_a) - prevBfwA : n(stockTank.bfw_boiler_a);
    const bfwConsB = prevBfwB > 0 ? n(stockTank.bfw_boiler_b) - prevBfwB : n(stockTank.bfw_boiler_b);
    const bfwTotal = bfwConsA + bfwConsB;

    // CR Total Calculation
    const crTotal = prodTotal24 > 0 ? grandTotal24 / prodTotal24 : 0;

    const isShutdownA = turbineMisc.status_boiler_a === 'shutdown';
    const isShutdownB = turbineMisc.status_boiler_b === 'shutdown';

    // Auto-fill totalizer A & clear non-totalizer saat shutdown A
    useEffect(() => {
        if (!isShutdownA) return;
        // Auto-fill totalizer hanya jika kosong (tetap bisa diedit)
        if (prevA24 > 0 && steam.prod_boiler_a_24 == null) onSteamChange('prod_boiler_a_24', prevA24);
        ['coal_a_24', 'coal_b_24', 'coal_c_24'].forEach(k => {
            const prev = pnCoal(k);
            if (prev > 0 && coal[k] == null) onCoalChange(k, prev);
        });
        if (prevBfwA > 0 && stockTank.bfw_boiler_a == null) onStockTankChange('bfw_boiler_a', prevBfwA);
        // Clear semua field non-totalizer
        if (steam.prod_boiler_a_00 != null) onSteamChange('prod_boiler_a_00', null);
        ['coal_a_00', 'coal_b_00', 'coal_c_00'].forEach(k => {
            if (coal[k] != null) onCoalChange(k, null);
        });
        if (stockTank.flow_bfw_a != null) onStockTankChange('flow_bfw_a', null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isShutdownA]);

    // Auto-fill totalizer B & clear non-totalizer saat shutdown B
    useEffect(() => {
        if (!isShutdownB) return;
        if (prevB24 > 0 && steam.prod_boiler_b_24 == null) onSteamChange('prod_boiler_b_24', prevB24);
        ['coal_d_24', 'coal_e_24', 'coal_f_24'].forEach(k => {
            const prev = pnCoal(k);
            if (prev > 0 && coal[k] == null) onCoalChange(k, prev);
        });
        if (prevBfwB > 0 && stockTank.bfw_boiler_b == null) onStockTankChange('bfw_boiler_b', prevBfwB);
        if (steam.prod_boiler_b_00 != null) onSteamChange('prod_boiler_b_00', null);
        ['coal_d_00', 'coal_e_00', 'coal_f_00'].forEach(k => {
            if (coal[k] != null) onCoalChange(k, null);
        });
        if (stockTank.flow_bfw_b != null) onStockTankChange('flow_bfw_b', null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isShutdownB]);

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
                {/* ═══ BOILER A INPUTS ═══ */}
                <Card title="Input Boiler A" icon="factory" color="rose"
                    headerRight={<BoilerStatusChip name="status_boiler_a" value={(turbineMisc.status_boiler_a as string) ?? ''} onChange={onTurbineMiscChange} />}
                >
                    {isShutdownA && (
                        <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                            <span className="material-symbols-outlined text-[16px] text-rose-400">power_off</span>
                            <span>Boiler A <span className="font-bold">shutdown</span> — hanya totalizer yang bisa diedit, parameter lain dikunci.</span>
                        </div>
                    )}
                    <SectionLabel label="Produksi Steam A" />
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-700/50 mb-4">
                        <TotalizerInput label="Steam A" name="prod_boiler_a_24" value={steam.prod_boiler_a_24} prev={prevA24} onChange={onSteamChange} unit="Ton" color="rose" />
                        <InputField label="Flow Steam A" name="prod_boiler_a_00" value={steam.prod_boiler_a_00} onChange={onSteamChange} unit="T/H" color="rose" readOnly={isShutdownA} />
                    </div>

                    <SectionLabel label="Konsumsi Batubara A" badge="Mill A,B,C" />
                    <div className="grid grid-cols-3 gap-3 pb-3 border-b border-slate-700/50 mb-3 block">
                        <TotalizerInput label="Mill A" name="coal_a_24" value={coal.coal_a_24} prev={pnCoal('coal_a_24')} onChange={onCoalChange} unit="Ton" color="rose" />
                        <TotalizerInput label="Mill B" name="coal_b_24" value={coal.coal_b_24} prev={pnCoal('coal_b_24')} onChange={onCoalChange} unit="Ton" color="rose" />
                        <TotalizerInput label="Mill C" name="coal_c_24" value={coal.coal_c_24} prev={pnCoal('coal_c_24')} onChange={onCoalChange} unit="Ton" color="rose" />
                    </div>
                    <div className="grid grid-cols-3 gap-3 pb-4 border-b border-slate-700/50 mb-4">
                        <InputField label="Flow Mill A" name="coal_a_00" value={coal.coal_a_00} onChange={onCoalChange} unit="T/Jam" color="amber" readOnly={isShutdownA} />
                        <InputField label="Flow Mill B" name="coal_b_00" value={coal.coal_b_00} onChange={onCoalChange} unit="T/Jam" color="amber" readOnly={isShutdownA} />
                        <InputField label="Flow Mill C" name="coal_c_00" value={coal.coal_c_00} onChange={onCoalChange} unit="T/Jam" color="amber" readOnly={isShutdownA} />
                    </div>

                    <SectionLabel label="Boiler Feed Water A" />
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-700/50 mb-4">
                        <TotalizerInput label="BFW A" name="bfw_boiler_a" value={stockTank.bfw_boiler_a} prev={prevBfwA} onChange={onStockTankChange} unit="Ton" color="cyan" />
                        <InputField label="Flow BFW A" name="flow_bfw_a" value={stockTank.flow_bfw_a} onChange={onStockTankChange} unit="T/H" color="cyan" readOnly={isShutdownA} />
                    </div>

                    <SectionLabel label="Temperatur Furnace A" />
                    <div className="grid grid-cols-1 gap-4">
                        <InputField label="Furnace A" name="temp_furnace_a" value={turbineMisc.temp_furnace_a as number | null} onChange={onTurbineMiscChange} unit="°C" color="orange" />
                    </div>
                </Card>

                {/* ═══ BOILER B INPUTS ═══ */}
                <Card title="Input Boiler B" icon="factory" color="purple"
                    headerRight={<BoilerStatusChip name="status_boiler_b" value={(turbineMisc.status_boiler_b as string) ?? ''} onChange={onTurbineMiscChange} />}
                >
                    {isShutdownB && (
                        <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                            <span className="material-symbols-outlined text-[16px] text-rose-400">power_off</span>
                            <span>Boiler B <span className="font-bold">shutdown</span> — hanya totalizer yang bisa diedit, parameter lain dikunci.</span>
                        </div>
                    )}
                    <SectionLabel label="Produksi Steam B" />
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-700/50 mb-4">
                        <TotalizerInput label="Steam B" name="prod_boiler_b_24" value={steam.prod_boiler_b_24} prev={prevB24} onChange={onSteamChange} unit="Ton" color="purple" />
                        <InputField label="Flow Steam B" name="prod_boiler_b_00" value={steam.prod_boiler_b_00} onChange={onSteamChange} unit="T/H" color="purple" readOnly={isShutdownB} />
                    </div>

                    <SectionLabel label="Konsumsi Batubara B" badge="Mill D,E,F" />
                    <div className="grid grid-cols-3 gap-3 pb-3 border-b border-slate-700/50 mb-3 block">
                        <TotalizerInput label="Mill D" name="coal_d_24" value={coal.coal_d_24} prev={pnCoal('coal_d_24')} onChange={onCoalChange} unit="Ton" color="purple" />
                        <TotalizerInput label="Mill E" name="coal_e_24" value={coal.coal_e_24} prev={pnCoal('coal_e_24')} onChange={onCoalChange} unit="Ton" color="purple" />
                        <TotalizerInput label="Mill F" name="coal_f_24" value={coal.coal_f_24} prev={pnCoal('coal_f_24')} onChange={onCoalChange} unit="Ton" color="purple" />
                    </div>
                    <div className="grid grid-cols-3 gap-3 pb-4 border-b border-slate-700/50 mb-4">
                        <InputField label="Flow Mill D" name="coal_d_00" value={coal.coal_d_00} onChange={onCoalChange} unit="T/Jam" color="orange" readOnly={isShutdownB} />
                        <InputField label="Flow Mill E" name="coal_e_00" value={coal.coal_e_00} onChange={onCoalChange} unit="T/Jam" color="orange" readOnly={isShutdownB} />
                        <InputField label="Flow Mill F" name="coal_f_00" value={coal.coal_f_00} onChange={onCoalChange} unit="T/Jam" color="orange" readOnly={isShutdownB} />
                    </div>

                    <SectionLabel label="Boiler Feed Water B" />
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-700/50 mb-4">
                        <TotalizerInput label="BFW B" name="bfw_boiler_b" value={stockTank.bfw_boiler_b} prev={prevBfwB} onChange={onStockTankChange} unit="Ton" color="cyan" />
                        <InputField label="Flow BFW B" name="flow_bfw_b" value={stockTank.flow_bfw_b} onChange={onStockTankChange} unit="T/H" color="cyan" readOnly={isShutdownB} />
                    </div>

                    <SectionLabel label="Temperatur Furnace B" />
                    <div className="grid grid-cols-1 gap-4">
                        <InputField label="Furnace B" name="temp_furnace_b" value={turbineMisc.temp_furnace_b as number | null} onChange={onTurbineMiscChange} unit="°C" color="orange" />
                    </div>
                </Card>
            </div>

            {/* ═══ SUMMARY CARD ═══ */}
            <Card title="Summary Operasional Boiler" icon="analytics" color="emerald">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {/* Steam Summary */}
                    <div className="bg-[#101822] p-4 rounded-xl border border-slate-800 shadow-inner flex flex-col gap-2 relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 opacity-5 text-blue-500">
                            <span className="material-symbols-outlined text-[100px]">waves</span>
                        </div>
                        <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-2 z-10">Total Steam</h4>
                        <div className="z-10"><CalculatedField label="Boiler A" value={fmt(prodA24)} unit="Ton" variant="small" /></div>
                        <div className="z-10"><CalculatedField label="Boiler B" value={fmt(prodB24)} unit="Ton" variant="small" /></div>
                        <div className="mt-2 pt-2 border-t border-slate-800 z-10">
                            <CalculatedField label="Total (A+B)" value={fmt(prodTotal24)} unit="Ton" variant="primary" />
                        </div>
                    </div>

                    {/* Coal Summary */}
                    <div className="bg-[#101822] p-4 rounded-xl border border-slate-800 shadow-inner flex flex-col gap-2 relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 opacity-5 text-amber-500">
                            <span className="material-symbols-outlined text-[100px]">precision_manufacturing</span>
                        </div>
                        <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-2 z-10">Total Batubara</h4>
                        <div className="z-10"><CalculatedField label="Boiler A" value={fmt(totalA24)} unit="Ton" variant="small" /></div>
                        <div className="z-10"><CalculatedField label="Boiler B" value={fmt(totalB24)} unit="Ton" variant="small" /></div>
                        <div className="mt-2 pt-2 border-t border-slate-800 z-10">
                            <CalculatedField label="Total (A+B)" value={fmt(grandTotal24)} unit="Ton" variant="primary" />
                        </div>
                    </div>

                    {/* BFW Summary */}
                    <div className="bg-[#101822] p-4 rounded-xl border border-slate-800 shadow-inner flex flex-col gap-2 relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 opacity-5 text-cyan-500">
                            <span className="material-symbols-outlined text-[100px]">water_drop</span>
                        </div>
                        <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-2 z-10">Total Konsumsi BFW</h4>
                        <div className="z-10"><CalculatedField label="Boiler A" value={fmt(bfwConsA)} unit="Ton" variant="small" /></div>
                        <div className="z-10"><CalculatedField label="Boiler B" value={fmt(bfwConsB)} unit="Ton" variant="small" /></div>
                        <div className="mt-2 pt-2 border-t border-slate-800 z-10">
                            <CalculatedField label="Total (A+B)" value={fmt(bfwTotal)} unit="Ton" variant="primary" />
                        </div>
                    </div>

                    {/* CR Summary */}
                    <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-900/30 shadow-inner flex flex-col gap-2 relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 opacity-10 text-emerald-500">
                            <span className="material-symbols-outlined text-[100px]">speed</span>
                        </div>
                        <h4 className="text-emerald-500/80 text-xs font-bold uppercase tracking-wider mb-2 z-10">Consumption Rate</h4>
                        <div className="z-10"><CalculatedField label="Boiler A" value={crA > 0 ? crA.toFixed(3) : '—'} unit="" variant="secondary" /></div>
                        <div className="z-10"><CalculatedField label="Boiler B" value={crB > 0 ? crB.toFixed(3) : '—'} unit="" variant="secondary" /></div>
                        <div className="mt-2 pt-2 border-t border-emerald-900/40 z-10">
                            <CalculatedField label="CR Total (AB)" value={crTotal > 0 ? crTotal.toFixed(3) : '—'} unit="" variant="primary" />
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
