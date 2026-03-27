'use client';
import React from 'react';
import { Card, InputField, SelectField } from './SharedComponents';
import type { BunkerBerasapInfo } from '@/hooks/useShiftReport';

interface TabCoalBunkerProps {
    values?: Record<string, number | string | null>;
    onFieldChange?: (name: string, value: number | string | null) => void;
    onStatusChange?: (name: string, value: string | null) => void;
    berasapSince?: BunkerBerasapInfo;
}

const SHIFT_LABEL: Record<string, string> = { malam: 'Shift Malam', pagi: 'Shift Pagi', sore: 'Shift Sore' };

function formatBerasapSince(info: { date: string; shift: string }): string {
    const d = new Date(info.date + 'T00:00:00');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month} ${SHIFT_LABEL[info.shift] || info.shift}`;
}

function BerasapWarning({ bunkerLabel, info }: { bunkerLabel: string; info: { date: string; shift: string } }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <span className="material-symbols-outlined text-[16px] text-amber-400">warning</span>
            <span><span className="font-bold">{bunkerLabel}</span> berasap sejak {formatBerasapSince(info)}</span>
        </div>
    );
}

export default function TabCoalBunker({ values = {}, onFieldChange, onStatusChange, berasapSince = {} }: TabCoalBunkerProps) {
    const statusOptions = [
        { value: 'Normal', label: 'Normal' },
        { value: 'Berasap', label: 'Berasap' }
    ];

    const h = onStatusChange || (onFieldChange as any);

    // Collect berasap warnings
    const bunkerWarnings: { label: string; key: string }[] = [
        { label: 'Bunker A', key: 'status_bunker_a' },
        { label: 'Bunker B', key: 'status_bunker_b' },
        { label: 'Bunker C', key: 'status_bunker_c' },
        { label: 'Bunker D', key: 'status_bunker_d' },
        { label: 'Bunker E', key: 'status_bunker_e' },
        { label: 'Bunker F', key: 'status_bunker_f' },
    ];

    const activeWarnings = bunkerWarnings.filter(b => berasapSince[b.key]);

    return (
        <div className="flex-1 w-full overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
            {/* Berasap warnings */}
            {activeWarnings.length > 0 && (
                <div className="flex flex-col gap-2 mb-4">
                    {activeWarnings.map(w => (
                        <BerasapWarning key={w.key} bunkerLabel={w.label} info={berasapSince[w.key]!} />
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">

                <Card title="Boiler A" icon="inventory_2" color="blue">
                    <div className="flex flex-col gap-5">
                        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-700/50">
                            <InputField label="Level Bunker A" unit="%" color="blue" name="bunker_a" value={values.bunker_a} onChange={onFieldChange} />
                            <SelectField label="Status Bunker A" color="blue" name="status_bunker_a" value={values.status_bunker_a as string} onChange={h} options={statusOptions} placeholder="Normal / Berasap..." />
                        </div>
                        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-700/50">
                            <InputField label="Level Bunker B" unit="%" color="blue" name="bunker_b" value={values.bunker_b} onChange={onFieldChange} />
                            <SelectField label="Status Bunker B" color="blue" name="status_bunker_b" value={values.status_bunker_b as string} onChange={h} options={statusOptions} placeholder="Normal / Berasap..." />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Level Bunker C" unit="%" color="blue" name="bunker_c" value={values.bunker_c} onChange={onFieldChange} />
                            <SelectField label="Status Bunker C" color="blue" name="status_bunker_c" value={values.status_bunker_c as string} onChange={h} options={statusOptions} placeholder="Normal / Berasap..." />
                        </div>
                    </div>
                </Card>

                <Card title="Boiler B" icon="inventory_2" color="cyan">
                    <div className="flex flex-col gap-5">
                        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-700/50">
                            <InputField label="Level Bunker D" unit="%" color="cyan" name="bunker_d" value={values.bunker_d} onChange={onFieldChange} />
                            <SelectField label="Status Bunker D" color="cyan" name="status_bunker_d" value={values.status_bunker_d as string} onChange={h} options={statusOptions} placeholder="Normal / Berasap..." />
                        </div>
                        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-700/50">
                            <InputField label="Level Bunker E" unit="%" color="cyan" name="bunker_e" value={values.bunker_e} onChange={onFieldChange} />
                            <SelectField label="Status Bunker E" color="cyan" name="status_bunker_e" value={values.status_bunker_e as string} onChange={h} options={statusOptions} placeholder="Normal / Berasap..." />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Level Bunker F" unit="%" color="cyan" name="bunker_f" value={values.bunker_f} onChange={onFieldChange} />
                            <SelectField label="Status Bunker F" color="cyan" name="status_bunker_f" value={values.status_bunker_f as string} onChange={h} options={statusOptions} placeholder="Normal / Berasap..." />
                        </div>
                    </div>
                </Card>

            </div>
        </div>
    );
}
