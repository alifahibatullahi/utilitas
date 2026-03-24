'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDailyReport } from '@/hooks/useDailyReport';
import type { Operator } from '@/lib/constants';
import TabHarianSteam from './TabHarianSteam';
import TabHarianPower from './TabHarianPower';
import TabHarianCoal from './TabHarianCoal';
import TabHarianTurbineMisc from './TabHarianTurbineMisc';
import TabHarianStockTank from './TabHarianStockTank';
import TabHarianCoalTransfer from './TabHarianCoalTransfer';
import TabHarianTotalizer from './TabHarianTotalizer';

type HarianTabId = 'Steam' | 'Power' | 'Batubara' | 'Turbin & Misc' | 'Stock & Tank' | 'Transfer BB' | 'Totalizer';

const HARIAN_TABS: { id: HarianTabId; label: string; icon: string }[] = [
    { id: 'Steam', label: 'Steam', icon: 'waves' },
    { id: 'Power', label: 'Power', icon: 'bolt' },
    { id: 'Batubara', label: 'Batubara', icon: 'precision_manufacturing' },
    { id: 'Turbin & Misc', label: 'Turbin & Misc', icon: 'mode_fan' },
    { id: 'Stock & Tank', label: 'Stock & Tank', icon: 'water_drop' },
    { id: 'Transfer BB', label: 'Transfer BB', icon: 'local_shipping' },
    { id: 'Totalizer', label: 'Totalizer', icon: 'speed' },
];

interface InputHarianFormProps {
    date: string;
    operator: Operator | null;
}

export default function InputHarianForm({ date, operator }: InputHarianFormProps) {
    const [activeTab, setActiveTab] = useState<HarianTabId>('Steam');
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const lastSubmittedReportId = useRef<string | null>(null);
    const skipNextClear = useRef(false);

    // 7 state objects — satu per child table
    const [steam, setSteam] = useState<Record<string, number | null>>({});
    const [power, setPower] = useState<Record<string, number | null>>({});
    const [coal, setCoal] = useState<Record<string, number | null>>({});
    const [turbineMisc, setTurbineMisc] = useState<Record<string, number | null>>({});
    const [stockTank, setStockTank] = useState<Record<string, number | null>>({});
    const [coalTransfer, setCoalTransfer] = useState<Record<string, number | null>>({});
    const [totalizer, setTotalizer] = useState<Record<string, number | string | null>>({});

    const { report, loading, submitReport, refetch } = useDailyReport(date);

    // ─── Helpers ───
    const extractFields = (obj: Record<string, unknown> | undefined, skipKeys: string[] = []) => {
        if (!obj) return {};
        const skip = new Set(['id', 'daily_report_id', 'created_at', 'updated_at', ...skipKeys]);
        const result: Record<string, number | string | null> = {};
        for (const [k, v] of Object.entries(obj)) {
            if (skip.has(k)) continue;
            if (v !== null && v !== undefined) result[k] = v as number | string | null;
        }
        return result;
    };

    const makeNumberHandler = (setter: React.Dispatch<React.SetStateAction<Record<string, number | null>>>) =>
        (name: string, value: number | string | null) => {
            setter(prev => ({
                ...prev,
                [name]: typeof value === 'string'
                    ? (value === '' ? null : parseFloat(value) ?? null)
                    : value,
            }));
        };

    const makeMixedHandler = (setter: React.Dispatch<React.SetStateAction<Record<string, number | string | null>>>) =>
        (name: string, value: number | string | null) => {
            setter(prev => ({ ...prev, [name]: value }));
        };

    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ─── Populate form dari data yang di-fetch ───
    useEffect(() => {
        if (skipNextClear.current) {
            skipNextClear.current = false;
            return;
        }
        if (lastSubmittedReportId.current && report && (report as unknown as Record<string, unknown>).id === lastSubmittedReportId.current) {
            lastSubmittedReportId.current = null;
            return;
        }
        lastSubmittedReportId.current = null;

        // Clear semua state
        setSteam({});
        setPower({});
        setCoal({});
        setTurbineMisc({});
        setStockTank({});
        setCoalTransfer({});
        setTotalizer({});

        if (!report) return;

        const steamData = report.daily_report_steam?.[0];
        const powerData = report.daily_report_power?.[0];
        const coalData = report.daily_report_coal?.[0];
        const turbData = report.daily_report_turbine_misc?.[0];
        const tankData = report.daily_report_stock_tank?.[0];
        const transferData = report.daily_report_coal_transfer?.[0];
        const totalizerData = report.daily_report_totalizer?.[0];

        if (steamData) setSteam(extractFields(steamData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (powerData) setPower(extractFields(powerData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (coalData) setCoal(extractFields(coalData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (turbData) setTurbineMisc(extractFields(turbData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (tankData) setStockTank(extractFields(tankData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (transferData) setCoalTransfer(extractFields(transferData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (totalizerData) setTotalizer(extractFields(totalizerData as unknown as Record<string, unknown>));
    }, [report]);

    // ─── Submit handler ───
    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const N = (v: number | null | undefined) => Number(v) || 0;

            // Auto-kalkulasi total
            const steamWithCalcs = {
                ...steam,
                prod_total_24: N(steam.prod_boiler_a_24) + N(steam.prod_boiler_b_24),
                prod_total_00: N(steam.prod_boiler_a_00) + N(steam.prod_boiler_b_00),
            };

            const totalA24 = N(coal.coal_a_24) + N(coal.coal_b_24) + N(coal.coal_c_24);
            const totalB24 = N(coal.coal_d_24) + N(coal.coal_e_24) + N(coal.coal_f_24);
            const totalA00 = N(coal.coal_a_00) + N(coal.coal_b_00) + N(coal.coal_c_00);
            const totalB00 = N(coal.coal_d_00) + N(coal.coal_e_00) + N(coal.coal_f_00);
            const coalWithCalcs = {
                ...coal,
                total_boiler_a_24: totalA24,
                total_boiler_b_24: totalB24,
                grand_total_24: totalA24 + totalB24,
                total_boiler_a_00: totalA00,
                total_boiler_b_00: totalB00,
                grand_total_00: totalA00 + totalB00,
            };

            const crA = N(turbineMisc.consumption_rate_a);
            const crB = N(turbineMisc.consumption_rate_b);
            const turbWithCalcs = {
                ...turbineMisc,
                consumption_rate_avg: (crA + crB) / 2,
            };

            const tankWithCalcs = {
                ...stockTank,
                solar_tank_total: N(stockTank.solar_tank_a) + N(stockTank.solar_tank_b),
                bfw_total: N(stockTank.bfw_boiler_a) + N(stockTank.bfw_boiler_b),
            };

            const result = await submitReport({
                created_by: operator?.id != null ? String(operator.id) : undefined,
                notes: typeof totalizer.keterangan === 'string' ? totalizer.keterangan : undefined,
                produksi_steam_a: steam.prod_boiler_a_24 ?? null,
                produksi_steam_b: steam.prod_boiler_b_24 ?? null,
                konsumsi_batubara: coalWithCalcs.grand_total_24 ?? null,
                load_mw: power.gen_00 ?? null,
                steam: steamWithCalcs,
                power,
                coal: coalWithCalcs,
                turbineMisc: turbWithCalcs,
                stockTank: tankWithCalcs,
                coalTransfer,
                totalizer,
            });

            if (result?.error) {
                showToast('Error: ' + result.error, 'error');
            } else {
                showToast('Laporan harian berhasil disimpan!', 'success');
                lastSubmittedReportId.current = result?.reportId || null;
                refetch();
            }
        } catch {
            showToast('Terjadi kesalahan saat menyimpan laporan.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
                    toast.type === 'success'
                        ? 'bg-emerald-600 border border-emerald-400/50 shadow-emerald-500/20'
                        : 'bg-red-600 border border-red-400/50 shadow-red-500/20'
                }`}>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">
                            {toast.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        {toast.message}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center shrink-0">
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-[0_0_10px_rgba(16,185,129,0.3)] border border-emerald-500/50 ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    {submitting ? 'Menyimpan...' : 'Simpan Laporan Harian'}
                </button>
            </div>

            {/* Tab Bar */}
            <div className="shrink-0">
                <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-1">
                    <div className="flex flex-wrap gap-1">
                        {HARIAN_TABS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${isActive
                                        ? 'font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-inner shadow-emerald-500/10'
                                        : 'font-medium text-[#92a9c9] hover:text-white hover:bg-[#1f2b3e] border border-transparent'
                                    }`}
                                >
                                    <span className={`material-symbols-outlined text-[16px] ${isActive ? 'text-emerald-400' : ''}`}>
                                        {tab.icon}
                                    </span>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-4">
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Memuat data harian...
                </div>
            )}

            {/* Tab Content */}
            <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0 pb-6 w-full max-w-full">
                {activeTab === 'Steam' && <TabHarianSteam values={steam} onFieldChange={makeNumberHandler(setSteam)} />}
                {activeTab === 'Power' && <TabHarianPower values={power} onFieldChange={makeNumberHandler(setPower)} />}
                {activeTab === 'Batubara' && <TabHarianCoal values={coal} onFieldChange={makeNumberHandler(setCoal)} />}
                {activeTab === 'Turbin & Misc' && <TabHarianTurbineMisc values={turbineMisc} onFieldChange={makeNumberHandler(setTurbineMisc)} />}
                {activeTab === 'Stock & Tank' && <TabHarianStockTank values={stockTank} onFieldChange={makeNumberHandler(setStockTank)} />}
                {activeTab === 'Transfer BB' && <TabHarianCoalTransfer values={coalTransfer} onFieldChange={makeNumberHandler(setCoalTransfer)} />}
                {activeTab === 'Totalizer' && <TabHarianTotalizer values={totalizer} onFieldChange={makeMixedHandler(setTotalizer)} />}
            </div>
        </>
    );
}
