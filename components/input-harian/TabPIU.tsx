'use client';
import React from 'react';
import { Card, InputField, TotalizerField } from '@/components/input-shift/SharedComponents';
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
                <p className="text-xs text-white -mt-1">Tulis tanpa koma — contoh: 32375</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TotalizerField
                        label="Delivered (Import)"
                        unit="MWh"
                        color="blue"
                        name="totalizer_import"
                        value={tm.totalizer_import}
                        onChange={onTurbineMiscChange}
                        placeholder="0"
                        plainInteger
                        plain
                        prev={Number(ptm?.totalizer_import) || 0}
                        meter="piu_import"
                    />
                    <TotalizerField
                        label="Received (Export)"
                        unit="MWh"
                        color="blue"
                        name="totalizer_export"
                        value={tm.totalizer_export}
                        onChange={onTurbineMiscChange}
                        placeholder="0"
                        plainInteger
                        plain
                        prev={Number(ptm?.totalizer_export) || 0}
                        meter="piu_export"
                    />
                    <div>
                        <InputField
                            label="D - R"
                            unit="MWh"
                            color="blue"
                            name="pie_dr"
                            value={tm.pie_dr}
                            onChange={onTurbineMiscChange}
                            textMode
                        />
                    </div>
                </div>
            </Card>
        </div>
    );
}
