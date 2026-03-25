'use client';
import React from 'react';
import { InputField, Card } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

export default function TabChemical({ stockTank, onStockTankChange }: DailyTabProps) {
    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            <Card title="Chemical Boiler 24 Jam" icon="science" color="purple">
                <div className="grid grid-cols-3 gap-4">
                    <InputField label="Phosphat" name="chemical_phosphat" value={stockTank.chemical_phosphat} onChange={onStockTankChange} unit="Kg" color="purple" />
                    <InputField label="Amin" name="chemical_amin" value={stockTank.chemical_amin} onChange={onStockTankChange} unit="Ltr" color="purple" />
                    <InputField label="Hydrasin" name="chemical_hydrasin" value={stockTank.chemical_hydrasin} onChange={onStockTankChange} unit="Ltr" color="purple" />
                </div>
            </Card>
        </div>
    );
}
