'use client';
import React, { useEffect } from 'react';
import { Card, InputField, CalculatedField, SelisihInfo } from './SharedComponents';

interface TabBoilerProps {
    boilerId: 'A' | 'B';
    values?: Record<string, number | string | null>;
    onFieldChange?: (name: string, value: number | string | null) => void;
    coalBunkerValues?: Record<string, number | string | null>;
    onCoalBunkerChange?: (name: string, value: number | string | null) => void;
    prevTotalizerSteam?: number | null;
    prevTotalizerBfw?: number | null;
    prevCoalBunkerValues?: Record<string, number | null>;
    shutdownSince?: { date: string; shift: string } | null;
    currentDate?: string;
}

function formatShutdownSince(sinceDate: string, currentDate: string): string {
    const d1 = new Date(sinceDate + 'T00:00:00');
    const d2 = new Date(currentDate + 'T00:00:00');
    const days = Math.round((d2.getTime() - d1.getTime()) / 86400000);
    const hari = d1.toLocaleDateString('id-ID', { weekday: 'long' });
    const tgl = d1.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
    const durasi = days === 0 ? 'hari ini' : `${days} hari`;
    return `sejak ${hari}, ${tgl} (${durasi})`;
}

const FEEDER_STATUS_OPTIONS = [
    { value: 'running', label: 'Running' },
    { value: 'standby', label: 'Standby' },
    { value: 'emergency standby', label: 'Emergency Standby' },
    { value: 'not standby', label: 'Not Standby' },
];

const FEEDER_STATUS_BORDER: Record<string, string> = {
    'running': 'border-emerald-500/50',
    'standby': 'border-amber-500/50',
    'emergency standby': 'border-orange-500/50',
    'not standby': 'border-red-500/50',
};

function FeederStatusChip({ feeder, sk, value, onChange }: {
    feeder: string;
    sk: string;
    value: string;
    onChange?: (name: string, v: number | string | null) => void;
}) {
    const border = FEEDER_STATUS_BORDER[value] ?? 'border-slate-700/60';
    return (
        <select
            className={`bg-[#101822]/60 border ${border} rounded-lg px-2 py-1 text-sm text-white font-semibold cursor-pointer outline-none appearance-none transition-colors`}
            value={value}
            onChange={e => onChange?.(sk, e.target.value === '' ? null : e.target.value)}
        >
            <option value="" className="bg-[#101822] text-slate-500">Status...</option>
            {FEEDER_STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-[#101822] text-white">{opt.label}</option>
            ))}
        </select>
    );
}

const NON_TOTALIZER_BOILER_FIELDS = [
    'press_steam', 'temp_steam', 'flow_steam',
    'bfw_press', 'temp_bfw', 'flow_bfw',
    'temp_furnace', 'air_heater_ti113', 'excess_air', 'temp_flue_gas',
    'primary_air', 'secondary_air', 'o2', 'steam_drum_press', 'solar_m3',
    'feeder_a_flow', 'feeder_b_flow', 'feeder_c_flow',
    'feeder_d_flow', 'feeder_e_flow', 'feeder_f_flow',
];

export default function TabBoiler({ boilerId, values = {}, onFieldChange, coalBunkerValues = {}, onCoalBunkerChange, prevTotalizerSteam, prevTotalizerBfw, prevCoalBunkerValues = {}, shutdownSince, currentDate = '' }: TabBoilerProps) {
    const feeders = boilerId === 'A' ? ['A', 'B', 'C'] : ['D', 'E', 'F'];
    const feederKeys = boilerId === 'A' ? ['feeder_a', 'feeder_b', 'feeder_c'] : ['feeder_d', 'feeder_e', 'feeder_f'];

    const isBoilerShutdown = values.status_boiler === 'shutdown';
    const feederStatusKey = (fk: string) => `status_${fk}`;
    const isFeederLocked = (fk: string) => {
        const s = coalBunkerValues[feederStatusKey(fk)];
        return typeof s === 'string' && s !== '' && s !== 'running';
    };

    // Auto-fill totalizer saat boiler shutdown (hanya jika masih kosong, tetap bisa diedit)
    // Auto-set semua feeder ke standby & flow ke 0 saat shutdown
    useEffect(() => {
        if (!isBoilerShutdown || !onFieldChange) return;
        if (prevTotalizerSteam != null && values.totalizer_steam == null)
            onFieldChange('totalizer_steam', prevTotalizerSteam);
        if (prevTotalizerBfw != null && values.totalizer_bfw == null)
            onFieldChange('totalizer_bfw', prevTotalizerBfw);
        NON_TOTALIZER_BOILER_FIELDS.forEach(k => {
            if (values[k] != null && values[k] !== 0) onFieldChange(k, 0);
        });
        if (onCoalBunkerChange) {
            feederKeys.forEach(fk => {
                const prev = prevCoalBunkerValues[fk];
                if (prev != null && coalBunkerValues[fk] == null) onCoalBunkerChange(fk, prev);
                // Auto-set feeder status ke standby jika belum standby/non-running
                const sk = feederStatusKey(fk);
                const curStatus = coalBunkerValues[sk];
                if (curStatus === 'running' || curStatus == null || curStatus === '') {
                    onCoalBunkerChange(sk, 'standby');
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isBoilerShutdown]);

    // Auto-fill totalizer feeder saat non-running (hanya jika kosong, tetap bisa diedit)
    // Auto-set flow feeder ke 0 saat non-running
    const feederStatusSig = feederKeys.map(fk => coalBunkerValues[feederStatusKey(fk)] ?? '').join('|');
    useEffect(() => {
        if (!onCoalBunkerChange || !onFieldChange) return;
        feederKeys.forEach(fk => {
            if (!isFeederLocked(fk)) return;
            const prev = prevCoalBunkerValues[fk];
            if (prev != null && coalBunkerValues[fk] == null) onCoalBunkerChange(fk, prev);
            if (values[`${fk}_flow`] !== 0) onFieldChange(`${fk}_flow`, 0);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feederStatusSig]);

    // Calculate produksi (selisih) from totalizer
    const currentSteam = Number(values.totalizer_steam) || 0;
    const prevSteam = Number(prevTotalizerSteam) || 0;
    const produksiSteam = prevSteam > 0 ? currentSteam - prevSteam : 0;

    // Calculate produksi BFW (selisih) from totalizer
    const currentBfw = Number(values.totalizer_bfw) || 0;
    const prevBfw = Number(prevTotalizerBfw) || 0;
    const produksiBfw = prevBfw > 0 ? currentBfw - prevBfw : 0;

    // Calculate konsumsi batubara (selisih) from feeder totalizers
    const feederKonsumsi = feederKeys.map(key => {
        const current = Number(coalBunkerValues[key]) || 0;
        const prev = Number(prevCoalBunkerValues[key]) || 0;
        return prev > 0 ? current - prev : 0;
    });
    const totalBatubara = feederKonsumsi.reduce((sum, k) => sum + k, 0);
    const cr = produksiSteam > 0 ? (totalBatubara / produksiSteam) : 0;

    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide w-full">
                {isBoilerShutdown && (
                    <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                        <span className="material-symbols-outlined text-[16px] text-rose-400 shrink-0 mt-0.5">power_off</span>
                        <span>
                            Boiler {boilerId} <span className="font-bold">shutdown</span>
                            {shutdownSince && currentDate
                                ? ` ${formatShutdownSince(shutdownSince.date, currentDate)}`
                                : ''
                            }
                            {' '}— totalizer tetap bisa diedit, parameter lain dikunci.
                        </span>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Steam Parameters" icon="waves" color="blue">
                        <InputField label="Pressure Steam" unit="MPa" color="blue" name="press_steam" value={values.press_steam} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                        <InputField label="Temp Steam" unit="°C" color="blue" name="temp_steam" value={values.temp_steam} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                        <InputField label="Flow Steam" unit="t/h" color="blue" name="flow_steam" value={values.flow_steam} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                        <div>
                            <InputField label="Totalizer Steam" unit="ton" color="blue" name="totalizer_steam" value={values.totalizer_steam} onChange={onFieldChange} placeholder={prevSteam > 0 ? String(prevSteam) : '0.0'} />
                            <SelisihInfo prev={prevSteam} current={currentSteam} />
                        </div>
                    </Card>

                    <Card title="Boiler Feed Water" icon="water_drop" color="cyan">
                        <InputField label="Pressure BFW" unit="MPa" color="cyan" name="bfw_press" value={values.bfw_press} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                        <InputField label="Temp BFW" unit="°C" color="cyan" name="temp_bfw" value={values.temp_bfw} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                        <InputField label="Flow BFW" unit="t/h" color="cyan" name="flow_bfw" value={values.flow_bfw} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                        <div>
                            <InputField label="Totalizer BFW" unit="ton" color="cyan" name="totalizer_bfw" value={values.totalizer_bfw} onChange={onFieldChange} placeholder={Number(prevTotalizerBfw) > 0 ? String(Number(prevTotalizerBfw)) : '0.0'} />
                            <SelisihInfo prev={Number(prevTotalizerBfw) || 0} current={Number(values.totalizer_bfw) || 0} />
                        </div>
                    </Card>

                    <Card title="Furnace & Air" icon="local_fire_department" color="orange">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Temp Furnace" unit="°C" color="orange" name="temp_furnace" value={values.temp_furnace} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                            <InputField label="Air Heater TI113" unit="°C" color="orange" name="air_heater_ti113" value={values.air_heater_ti113} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Vacuum" unit="Pa" color="orange" name="excess_air" value={values.excess_air} onChange={onFieldChange} negative readOnly={isBoilerShutdown} />
                            <InputField label="Temp Flue Gas" unit="°C" color="orange" name="temp_flue_gas" value={values.temp_flue_gas} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Primary Air" unit="ton" color="orange" name="primary_air" value={values.primary_air} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                            <InputField label="Secondary Air" unit="ton" color="orange" name="secondary_air" value={values.secondary_air} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="O2" unit="%" color="orange" name="o2" value={values.o2} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                            <InputField label="Pressure Drum" unit="MPa" color="orange" name="steam_drum_press" value={values.steam_drum_press} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                        </div>
                    </Card>

                    <Card title={`Coal Feeder ${feeders[0]}-${feeders[feeders.length - 1]}`} icon="precision_manufacturing" color="emerald">
                        {feeders.map((feeder, idx) => {
                            const fk = feederKeys[idx];
                            const sk = feederStatusKey(fk);
                            const flowLocked = isBoilerShutdown || isFeederLocked(fk);
                            return (
                                <div key={feeder} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold text-white uppercase tracking-wider">Feeder {feeder}</p>
                                        <FeederStatusChip
                                            feeder=""
                                            sk={sk}
                                            value={(coalBunkerValues[sk] as string) ?? ''}
                                            onChange={onCoalBunkerChange}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <InputField placeholder={Number(prevCoalBunkerValues[fk]) > 0 ? String(Number(prevCoalBunkerValues[fk])) : 'Totalizer'} unit="ton" color="emerald" name={fk} value={coalBunkerValues[fk]} onChange={onCoalBunkerChange} />
                                            <SelisihInfo prev={Number(prevCoalBunkerValues[fk]) || 0} current={Number(coalBunkerValues[fk]) || 0} />
                                        </div>
                                        <InputField placeholder="Flow" unit="t/h" color="emerald" name={`${fk}_flow`} value={values[`${fk}_flow`]} onChange={onFieldChange} readOnly={flowLocked} />
                                    </div>
                                </div>
                            );
                        })}
                        <div className="space-y-2 mt-2 pt-3 border-t border-slate-700/50">
                            <p className="text-xs font-bold text-white uppercase tracking-wider text-left">Solar Usage</p>
                            <InputField placeholder="0.00" unit="m³" color="emerald" name="solar_m3" value={values.solar_m3} onChange={onFieldChange} readOnly={isBoilerShutdown} />
                        </div>
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[240px] shrink-0 h-full flex flex-col">
                <Card title="Produksi Shift" icon="calculate" color="purple" isSidebar={true}>
                    <CalculatedField label="PRODUKSI STEAM" value={produksiSteam.toFixed(2)} unit="ton" variant="primary" size="large" />
                    <CalculatedField label="PRODUKSI BFW" value={produksiBfw.toFixed(2)} unit="ton" variant="secondary" size="medium" />

                    {feeders.map((feeder, idx) => (
                        <CalculatedField key={feeder} label={`Konsumsi Feeder ${feeder}`} value={feederKonsumsi[idx].toFixed(2)} unit="ton" variant="small" />
                    ))}

                    <div className="h-px bg-slate-700/80 w-full my-1"></div>

                    <CalculatedField label="Total Batubara" value={totalBatubara.toFixed(2)} unit="ton" variant="primary" size="large" />

                    <div className="mt-auto">
                        <CalculatedField label="Consumption Rate" value={cr.toFixed(3)} unit="ton/ton" variant="purple" size="large" />
                    </div>
                </Card>
            </div>
        </>
    );
}
