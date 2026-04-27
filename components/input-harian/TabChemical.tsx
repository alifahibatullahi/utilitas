'use client';
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/input-shift/SharedComponents';
import { createClient } from '@/lib/supabase/client';

interface ShiftChemical {
    shift: 'pagi' | 'sore' | 'malam';
    phosphate: number | null;  // boiler A + B
    amine: number | null;
    hydrazine: number | null;
}

interface StockChemical {
    phosphate: number | null;
    amine: number | null;
    hydrazine: number | null;
}

interface TabChemicalProps {
    date: string;
}

const SHIFT_ORDER: ShiftChemical['shift'][] = ['malam', 'pagi', 'sore'];
const SHIFT_LABEL: Record<string, string> = { malam: 'Shift Malam', pagi: 'Shift Pagi', sore: 'Shift Sore' };

function fmt(v: number | null, decimals = 1): string {
    if (v == null) return '—';
    return v.toFixed(decimals);
}

function ChemRow({ label, shifts, total, unit, color }: {
    label: string;
    shifts: (number | null)[];
    total: number | null;
    unit: string;
    color: string;
}) {
    const colorMap: Record<string, { bg: string; text: string; border: string; total: string }> = {
        purple: { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/20', total: 'text-purple-200' },
        indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-300', border: 'border-indigo-500/20', total: 'text-indigo-200' },
        orange: { bg: 'bg-orange-500/10', text: 'text-orange-300', border: 'border-orange-500/20', total: 'text-orange-200' },
    };
    const c = colorMap[color] ?? colorMap.purple;

    return (
        <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
            <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-bold uppercase tracking-wider ${c.text}`}>{label}</span>
                <span className="text-xs text-slate-400 font-mono">{unit}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
                {SHIFT_ORDER.map((s, i) => (
                    <div key={s} className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{SHIFT_LABEL[s].replace('Shift ', '')}</span>
                        <span className={`text-lg font-bold font-mono ${shifts[i] != null ? c.total : 'text-slate-600'}`}>
                            {fmt(shifts[i])}
                        </span>
                    </div>
                ))}
            </div>
            <div className={`flex items-center justify-between mt-3 p-3 rounded-lg ${c.bg} border ${c.border}`}>
                <span className={`text-sm font-bold uppercase tracking-wider ${c.total}`}>Total Hari Ini</span>
                <span className={`text-xl font-black font-mono ${c.total}`}>
                    {fmt(total)} <span className="text-sm font-normal opacity-70">{unit}</span>
                </span>
            </div>
        </div>
    );
}

export default function TabChemical({ date }: TabChemicalProps) {
    const [shiftData, setShiftData] = useState<ShiftChemical[]>([]);
    const [stock, setStock] = useState<StockChemical>({ phosphate: null, amine: null, hydrazine: null });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!date) return;
        const supabase = createClient();
        setLoading(true);

        Promise.all([
            // Fetch shift water quality for this date
            supabase
                .from('shift_reports')
                .select('shift, shift_water_quality(phosphate_penambahan_chemical, phosphate_b_penambahan_chemical, amine_penambahan_chemical, hydrazine_penambahan_chemical)')
                .eq('date', date),
            // Fetch last known stock
            supabase
                .from('shift_water_quality')
                .select('stock_phosphate, stock_amine, stock_hydrazine')
                .not('stock_phosphate', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1),
        ]).then(([shiftRes, stockRes]) => {
            // Process shift consumption
            const result: ShiftChemical[] = [];
            for (const row of (shiftRes.data ?? []) as any[]) {
                const wq = Array.isArray(row.shift_water_quality) ? row.shift_water_quality[0] : row.shift_water_quality;
                if (!wq) continue;
                const phosphate = (Number(wq.phosphate_penambahan_chemical) || 0) + (Number(wq.phosphate_b_penambahan_chemical) || 0);
                result.push({
                    shift: row.shift as ShiftChemical['shift'],
                    phosphate: phosphate || null,
                    amine: wq.amine_penambahan_chemical != null ? Number(wq.amine_penambahan_chemical) : null,
                    hydrazine: wq.hydrazine_penambahan_chemical != null ? Number(wq.hydrazine_penambahan_chemical) : null,
                });
            }
            setShiftData(result);

            // Process stock
            const s = stockRes.data?.[0] as any;
            if (s) {
                setStock({
                    phosphate: s.stock_phosphate != null ? Number(s.stock_phosphate) : null,
                    amine: s.stock_amine != null ? Number(s.stock_amine) : null,
                    hydrazine: s.stock_hydrazine != null ? Number(s.stock_hydrazine) : null,
                });
            }
            setLoading(false);
        });
    }, [date]);

    const getShiftVal = (chemical: keyof Omit<ShiftChemical, 'shift'>, shift: ShiftChemical['shift']): number | null =>
        shiftData.find(s => s.shift === shift)?.[chemical] ?? null;

    const getTotal = (chemical: keyof Omit<ShiftChemical, 'shift'>): number | null => {
        const vals = shiftData.map(s => s[chemical]).filter((v): v is number => v != null);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full overflow-y-auto pr-1 scrollbar-hide">
            {/* Konsumsi Chemical 24 Jam */}
            <div className="rounded-xl ring-1 ring-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]">
                <Card title="Konsumsi Chemical 24 Jam" icon="science" color="purple">
                    {loading ? (
                        <p className="text-sm text-slate-500 py-4 text-center">Memuat data...</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <ChemRow
                                label="Phosphate"
                                unit="Ltr"
                                color="purple"
                                shifts={SHIFT_ORDER.map(s => getShiftVal('phosphate', s))}
                                total={getTotal('phosphate')}
                            />
                            <ChemRow
                                label="Amine"
                                unit="Ltr"
                                color="indigo"
                                shifts={SHIFT_ORDER.map(s => getShiftVal('amine', s))}
                                total={getTotal('amine')}
                            />
                            <ChemRow
                                label="Hydrazine"
                                unit="Ltr"
                                color="orange"
                                shifts={SHIFT_ORDER.map(s => getShiftVal('hydrazine', s))}
                                total={getTotal('hydrazine')}
                            />
                        </div>
                    )}
                </Card>
            </div>

            {/* Stock Chemical */}
            <div className="rounded-xl ring-1 ring-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                <Card title="Stock Chemical" icon="inventory_2" color="emerald">
                    <div className="flex flex-col gap-4 h-full">
                        {[
                            { label: 'Phosphate', value: stock.phosphate, color: 'text-purple-300', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
                            { label: 'Amine', value: stock.amine, color: 'text-indigo-300', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
                            { label: 'Hydrazine', value: stock.hydrazine, color: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
                        ].map(({ label, value, color, bg, border }) => (
                            <div key={label} className={`rounded-xl ${bg} border ${border} p-5 flex flex-col items-center justify-center gap-2 flex-1`}>
                                <span className="text-sm text-slate-300 uppercase tracking-wider font-bold">{label}</span>
                                <span className={`text-4xl font-black font-mono ${value != null ? color : 'text-slate-600'}`}>
                                    {value != null ? value : '—'}
                                </span>
                                <span className="text-xs text-slate-400">pcs (terakhir tercatat)</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
