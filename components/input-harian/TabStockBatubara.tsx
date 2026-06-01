'use client';
import React from 'react';
import { InputField, Card, CalculatedField } from '@/components/input-shift/SharedComponents';
import type { DailyTabProps } from './types';

export default function TabStockBatubara({
    coalTransfer, onCoalTransferChange, lautTotalSheet,
}: DailyTabProps) {
    // Total Via Laut = nilai kolom DN (formula) dari Google Sheets pada tanggal LHUBB yang
    // sama. Read-only di sini; total lain (PB2/PB3/Darat) tidak ditampilkan — form hanya
    // mengumpulkan input harian (default 0).
    const lautTotalDisplay = lautTotalSheet != null && String(lautTotalSheet).trim() !== ''
        ? String(lautTotalSheet)
        : '0';

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Pemindahan ke PB II ═══ */}
            <Card title="Pemindahan Batubara ke Pabrik 2" icon="local_shipping" color="teal">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="PF1" name="pb2_pf1_rit" value={coalTransfer.pb2_pf1_rit ?? 0} onChange={onCoalTransferChange} unit="Rit" color="teal" />
                    <InputField label="PF1" name="pb2_pf1_ton" value={coalTransfer.pb2_pf1_ton ?? 0} onChange={onCoalTransferChange} unit="Ton" color="teal" />
                    <InputField label="PF2" name="pb2_pf2_rit" value={coalTransfer.pb2_pf2_rit ?? 0} onChange={onCoalTransferChange} unit="Rit" color="teal" />
                    <InputField label="PF2" name="pb2_pf2_ton" value={coalTransfer.pb2_pf2_ton ?? 0} onChange={onCoalTransferChange} unit="Ton" color="teal" />
                </div>
            </Card>

            {/* ═══ Pemindahan ke PB III ═══ */}
            <Card title="Pemindahan Batubara ke Pabrik 3" icon="factory" color="emerald">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Calsinasi" name="pb3_calc_rit" value={coalTransfer.pb3_calc_rit ?? 0} onChange={onCoalTransferChange} unit="Rit" color="emerald" />
                    <InputField label="Calsinasi" name="pb3_calc_ton" value={coalTransfer.pb3_calc_ton ?? 0} onChange={onCoalTransferChange} unit="Ton" color="emerald" />
                </div>
            </Card>

            {/* ═══ Kedatangan Batubara ═══ */}
            <Card title="Kedatangan Batubara" icon="inventory_2" color="amber">
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Via Darat" name="darat_24_ton" value={coalTransfer.darat_24_ton ?? 0} onChange={onCoalTransferChange} unit="Ton" color="amber" />
                    <InputField label="Via Laut"  name="laut_24_ton"  value={coalTransfer.laut_24_ton ?? 0}  onChange={onCoalTransferChange} unit="Ton" color="amber" />
                </div>
                <div className="mt-3 pt-3 border-t border-amber-500/20">
                    <CalculatedField label="Total Via Laut" value={lautTotalDisplay} unit="Ton" variant="small" />
                    <p className="mt-1 text-[10px] text-slate-500">Diambil dari Google Sheets (kolom DN) untuk tanggal LHUBB ini.</p>
                </div>
            </Card>

        </div>
    );
}
