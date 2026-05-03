'use client';
import React from 'react';
import { Card, InputField, SelisihInfo } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

export default function TabPIU({
    turbineMisc,
    prevTurbineMisc,
    onTurbineMiscChange,
}: DailyTabProps) {
    const tm = turbineMisc as Record<string, number | string | null>;
    const ptm = prevTurbineMisc as Record<string, number | null> | undefined;

    return (
        <div className="flex-1 flex flex-col gap-6 w-full overflow-y-auto">
            <Card title="Totalizer Power PIU" icon="electric_meter" color="blue">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <InputField
                            label="Delivered (Import)"
                            unit="Kwh"
                            color="blue"
                            name="totalizer_import"
                            value={tm.totalizer_import}
                            onChange={onTurbineMiscChange}
                            thousands
                        />
                        {prevTurbineMisc && (
                            <SelisihInfo
                                prev={Number(ptm?.totalizer_import) || 0}
                                current={Number(tm.totalizer_import) || 0}
                            />
                        )}
                    </div>
                    <div>
                        <InputField
                            label="Received (Export)"
                            unit="Kwh"
                            color="blue"
                            name="totalizer_export"
                            value={tm.totalizer_export}
                            onChange={onTurbineMiscChange}
                            thousands
                        />
                        {prevTurbineMisc && (
                            <SelisihInfo
                                prev={Number(ptm?.totalizer_export) || 0}
                                current={Number(tm.totalizer_export) || 0}
                            />
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
