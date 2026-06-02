'use client';
import React from 'react';
import { Card, InputField } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

/**
 * Tab Coal Bunker harian — layout sama dengan tab Coal Bunker shift (2 kartu
 * Boiler A / Boiler B). Hanya level bunker jam 24.00 (A–F); harian tidak menyimpan
 * status bunker. Disimpan di daily_report_stock_tank.bunker_a..f (dipakai logbook).
 */
export default function TabCoalBunker({ stockTank, onStockTankChange }: DailyTabProps) {
    return (
        <div className="flex-1 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <Card title="Boiler A" icon="inventory_2" color="blue">
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Level Bunker (Jam 24.00)</p>
                    <div className="flex flex-col gap-3">
                        {['a', 'b', 'c'].map((k) => (
                            <InputField key={k} label={`Level Bunker ${k.toUpperCase()}`} unit="%" color="blue" name={`bunker_${k}`} value={stockTank[`bunker_${k}`]} onChange={onStockTankChange} />
                        ))}
                    </div>
                </Card>

                <Card title="Boiler B" icon="inventory_2" color="cyan">
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Level Bunker (Jam 24.00)</p>
                    <div className="flex flex-col gap-3">
                        {['d', 'e', 'f'].map((k) => (
                            <InputField key={k} label={`Level Bunker ${k.toUpperCase()}`} unit="%" color="cyan" name={`bunker_${k}`} value={stockTank[`bunker_${k}`]} onChange={onStockTankChange} />
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
