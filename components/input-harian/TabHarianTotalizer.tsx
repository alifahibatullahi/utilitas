'use client';
import React from 'react';
import { InputField, Card, CalculatedField } from '@/components/input-shift/SharedComponents';

interface TabHarianTotalizerProps {
    values: Record<string, number | string | null>;
    onFieldChange: (name: string, value: number | string | null) => void;
}

export default function TabHarianTotalizer({ values, onFieldChange }: TabHarianTotalizerProps) {
    const n = (v: number | string | null | undefined) => Number(v) || 0;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');

    return (
        <div className="flex flex-col xl:flex-row gap-6 w-full">
            {/* Main Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Totalizer Readings */}
                <Card title="Totalizer Readings" icon="speed" color="blue">
                    <div className="grid grid-cols-1 gap-4">
                        <InputField label="Totalizer 1" name="totalizer_1" value={values.totalizer_1 as number | null} onChange={onFieldChange} unit="" color="blue" />
                        <InputField label="Totalizer 2" name="totalizer_2" value={values.totalizer_2 as number | null} onChange={onFieldChange} unit="" color="blue" />
                        <InputField label="Totalizer 3" name="totalizer_3" value={values.totalizer_3 as number | null} onChange={onFieldChange} unit="" color="blue" />
                        <InputField label="Totalizer 4" name="totalizer_4" value={values.totalizer_4 as number | null} onChange={onFieldChange} unit="" color="blue" />
                        <InputField label="Totalizer 5" name="totalizer_5" value={values.totalizer_5 as number | null} onChange={onFieldChange} unit="" color="blue" />
                    </div>
                </Card>

                {/* Personnel */}
                <Card title="Personil" icon="group" color="cyan">
                    <div className="space-y-4">
                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">Group</label>
                            <input
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 text-sm transition-all text-left"
                                placeholder="Contoh: A, B, C, D"
                                value={values.group_name ?? ''}
                                onChange={e => onFieldChange('group_name', e.target.value || null)}
                            />
                        </div>
                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">Nama Kasi</label>
                            <input
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 text-sm transition-all text-left"
                                placeholder="Nama Kasi"
                                value={values.kasi_name ?? ''}
                                onChange={e => onFieldChange('kasi_name', e.target.value || null)}
                            />
                        </div>
                    </div>
                </Card>

                {/* Konsumsi & Penerimaan */}
                <Card title="Konsumsi & Penerimaan" icon="swap_vert" color="emerald">
                    <InputField label="Stock BB Rendal" name="stock_batubara_rendal" value={values.stock_batubara_rendal as number | null} onChange={onFieldChange} unit="Ton" color="emerald" />
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Konsumsi Demin" name="konsumsi_demin" value={values.konsumsi_demin as number | null} onChange={onFieldChange} unit="Ton" color="emerald" />
                        <InputField label="Konsumsi RCW" name="konsumsi_rcw" value={values.konsumsi_rcw as number | null} onChange={onFieldChange} unit="Ton" color="emerald" />
                        <InputField label="Penerimaan Demin 3A" name="penerimaan_demin_3a" value={values.penerimaan_demin_3a as number | null} onChange={onFieldChange} unit="Ton" color="emerald" />
                        <InputField label="Penerimaan Demin 1B" name="penerimaan_demin_1b" value={values.penerimaan_demin_1b as number | null} onChange={onFieldChange} unit="Ton" color="emerald" />
                    </div>
                    <InputField label="Penerimaan RCW 1A" name="penerimaan_rcw_1a" value={values.penerimaan_rcw_1a as number | null} onChange={onFieldChange} unit="Ton" color="emerald" />
                </Card>

                {/* Keterangan */}
                <Card title="Keterangan" icon="notes" color="orange">
                    <div className="space-y-1.5 w-full">
                        <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">Catatan</label>
                        <textarea
                            className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-500 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-sm transition-all text-left min-h-[120px] resize-y"
                            placeholder="Keterangan tambahan..."
                            value={(values.keterangan as string) ?? ''}
                            onChange={e => onFieldChange('keterangan', e.target.value || null)}
                        />
                    </div>
                </Card>
            </div>

            {/* Sidebar */}
            <div className="xl:w-72 shrink-0 space-y-4 xl:self-start">
                <Card title="Ringkasan" icon="summarize" color="purple" isSidebar>
                    <CalculatedField label="Group" value={String(values.group_name || '-')} unit="" variant="secondary" />
                    <CalculatedField label="Kasi" value={String(values.kasi_name || '-')} unit="" variant="secondary" />
                    <div className="border-t border-slate-700/50 pt-2 mt-0.5" />
                    <CalculatedField label="Konsumsi Demin" value={fmt(n(values.konsumsi_demin))} unit="Ton" variant="small" />
                    <CalculatedField label="Konsumsi RCW" value={fmt(n(values.konsumsi_rcw))} unit="Ton" variant="small" />
                </Card>
            </div>
        </div>
    );
}
