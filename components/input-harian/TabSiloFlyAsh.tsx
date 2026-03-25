'use client';
import React from 'react';
import { InputField, Card } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

export default function TabSiloFlyAsh({ stockTank, onStockTankChange }: DailyTabProps) {
    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            <Card title="Silo & Fly Ash" icon="filter_alt" color="emerald">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Silo A (Jam 00)" name="silo_a_pct" value={stockTank.silo_a_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                    <InputField label="Silo B (Jam 00)" name="silo_b_pct" value={stockTank.silo_b_pct} onChange={onStockTankChange} unit="%" color="emerald" />
                    <InputField label="Unloading Fly Ash A" name="unloading_fly_ash_a" value={stockTank.unloading_fly_ash_a} onChange={onStockTankChange} unit="Silo A" color="emerald" />
                    <InputField label="Unloading Fly Ash B" name="unloading_fly_ash_b" value={stockTank.unloading_fly_ash_b} onChange={onStockTankChange} unit="Silo B" color="emerald" />
                    <InputField label="Total PF1" name="total_pf1" value={stockTank.total_pf1} onChange={onStockTankChange} unit="" color="emerald" />
                    <InputField label="Total PF2" name="total_pf2" value={stockTank.total_pf2} onChange={onStockTankChange} unit="" color="emerald" />
                </div>
            </Card>
        </div>
    );
}
