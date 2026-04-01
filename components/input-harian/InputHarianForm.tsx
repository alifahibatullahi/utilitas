'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDailyReport } from '@/hooks/useDailyReport';
import { createClient } from '@/lib/supabase/client';
import type { Operator } from '@/lib/constants';
import TabBoiler from './TabBoiler';
import TabTurbin from './TabTurbin';
import TabPower from './TabPower';
import TabHandling from './TabHandling';
import TabChemical from './TabChemical';
import TabStockBatubara from './TabStockBatubara';
import TabSiloFlyAsh from './TabSiloFlyAsh';
import type { DailyTabProps } from './types';

type HarianTabId = 'Boiler' | 'Turbin' | 'Power' | 'Handling' | 'Chemical' | 'Stock BB' | 'Silo & Fly Ash';

const HARIAN_TABS: { id: HarianTabId; label: string; icon: string; colorClass: string }[] = [
    { id: 'Boiler', label: 'Boiler', icon: 'factory', colorClass: 'rose' },
    { id: 'Turbin', label: 'Turbin', icon: 'mode_fan', colorClass: 'cyan' },
    { id: 'Power', label: 'Power', icon: 'bolt', colorClass: 'amber' },
    { id: 'Handling', label: 'Handling', icon: 'local_shipping', colorClass: 'orange' },
    { id: 'Chemical', label: 'Chemical', icon: 'science', colorClass: 'purple' },
    { id: 'Stock BB', label: 'Stock BB', icon: 'inventory_2', colorClass: 'indigo' },
    { id: 'Silo & Fly Ash', label: 'Silo & Fly Ash', icon: 'filter_alt', colorClass: 'teal' },
];

const TAB_STYLES: Record<string, { active: string; inactive: string; icon: string }> = {
    'rose': { active: 'font-bold bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-inner shadow-rose-500/10', inactive: 'font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border-transparent', icon: 'text-rose-400' },
    'cyan': { active: 'font-bold bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-inner shadow-cyan-500/10', inactive: 'font-medium text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border-transparent', icon: 'text-cyan-400' },
    'amber': { active: 'font-bold bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-inner shadow-amber-500/10', inactive: 'font-medium text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 border-transparent', icon: 'text-amber-400' },
    'orange': { active: 'font-bold bg-orange-500/20 text-orange-400 border-orange-500/30 shadow-inner shadow-orange-500/10', inactive: 'font-medium text-slate-400 hover:text-orange-300 hover:bg-orange-500/10 border-transparent', icon: 'text-orange-400' },
    'purple': { active: 'font-bold bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-inner shadow-purple-500/10', inactive: 'font-medium text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 border-transparent', icon: 'text-purple-400' },
    'indigo': { active: 'font-bold bg-indigo-500/20 text-indigo-400 border-indigo-500/30 shadow-inner shadow-indigo-500/10', inactive: 'font-medium text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 border-transparent', icon: 'text-indigo-400' },
    'teal': { active: 'font-bold bg-teal-500/20 text-teal-400 border-teal-500/30 shadow-inner shadow-teal-500/10', inactive: 'font-medium text-slate-400 hover:text-teal-300 hover:bg-teal-500/10 border-transparent', icon: 'text-teal-400' },
};

interface InputHarianFormProps {
    date: string;
    operator: Operator | null;
}

export default function InputHarianForm({ date, operator }: InputHarianFormProps) {
    const [activeTab, setActiveTab] = useState<HarianTabId>('Boiler');
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

    const [solarUnloadings, setSolarUnloadings] = useState<{ date: string; liters: number; supplier: string }[]>([]);
    const [ashUnloadings, setAshUnloadings] = useState<{ date: string; shift: string; silo: string; perusahaan: string; tujuan: string; ritase: number }[]>([]);

    const { report, prevReport, loading, submitReport, refetch } = useDailyReport(date);

        // Fetch solar & ash unloadings for the selected date
        useEffect(() => {
            const supabase = createClient();
            
            supabase
                .from('solar_unloadings')
                .select('date, liters, supplier')
                .eq('date', date)
                .order('created_at', { ascending: false })
                .then(({ data }) => {
                    setSolarUnloadings(
                        (data ?? []).map(r => ({
                            date: r.date as string,
                            liters: Number(r.liters) || 0,
                            supplier: (r.supplier as string) || '',
                        }))
                    );
                });

            supabase
                .from('ash_unloadings')
                .select('date, shift, silo, perusahaan, tujuan, ritase')
                .eq('date', date)
                .order('created_at', { ascending: false })
                .then(({ data }) => {
                    setAshUnloadings(
                        (data ?? []).map(r => ({
                            date: r.date as string,
                            shift: r.shift as string,
                            silo: r.silo as string,
                            perusahaan: r.perusahaan as string,
                            tujuan: r.tujuan as string,
                            ritase: Number(r.ritase) || 0,
                        }))
                    );
                });
        }, [date]);

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

    // ─── Previous report data for selisih calculations ───
    const prevSteam = prevReport?.daily_report_steam?.[0]
        ? extractFields(prevReport.daily_report_steam[0] as unknown as Record<string, unknown>) as Record<string, number | null>
        : undefined;
    const prevPower = prevReport?.daily_report_power?.[0]
        ? extractFields(prevReport.daily_report_power[0] as unknown as Record<string, unknown>) as Record<string, number | null>
        : undefined;
    const prevCoal = prevReport?.daily_report_coal?.[0]
        ? extractFields(prevReport.daily_report_coal[0] as unknown as Record<string, unknown>) as Record<string, number | null>
        : undefined;
    const prevTotalizerData = prevReport?.daily_report_totalizer?.[0]
        ? extractFields(prevReport.daily_report_totalizer[0] as unknown as Record<string, unknown>) as Record<string, number | string | null>
        : undefined;
    const prevStockTank = prevReport?.daily_report_stock_tank?.[0]
        ? extractFields(prevReport.daily_report_stock_tank[0] as unknown as Record<string, unknown>) as Record<string, number | null>
        : undefined;
    const prevCoalTransfer = prevReport?.daily_report_coal_transfer?.[0]
        ? extractFields(prevReport.daily_report_coal_transfer[0] as unknown as Record<string, unknown>) as Record<string, number | null>
        : undefined;

    // ─── CR Calculation (Total Batubara ÷ Total Produksi Steam) ───
    const N0 = (v: number | null | undefined) => Number(v) || 0;
    const coalTotalA = N0(coal.coal_a_24) + N0(coal.coal_b_24) + N0(coal.coal_c_24);
    const coalTotalB = N0(coal.coal_d_24) + N0(coal.coal_e_24) + N0(coal.coal_f_24);
    const prevSteamA24 = prevSteam ? N0(prevSteam.prod_boiler_a_24) : 0;
    const prevSteamB24 = prevSteam ? N0(prevSteam.prod_boiler_b_24) : 0;
    const steamProdA = prevSteamA24 > 0 ? N0(steam.prod_boiler_a_24) - prevSteamA24 : N0(steam.prod_boiler_a_24);
    const steamProdB = prevSteamB24 > 0 ? N0(steam.prod_boiler_b_24) - prevSteamB24 : N0(steam.prod_boiler_b_24);
    const crA = steamProdA > 0 ? coalTotalA / steamProdA : 0;
    const crB = steamProdB > 0 ? coalTotalB / steamProdB : 0;

    // ─── Submit handler ───
    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const N = (v: number | null | undefined) => Number(v) || 0;

            // Auto-kalkulasi: produksi = selisih totalizer, Internal UBB, LPS = 0
            const prevA24 = prevSteam ? N(prevSteam.prod_boiler_a_24) : 0;
            const prevB24 = prevSteam ? N(prevSteam.prod_boiler_b_24) : 0;
            const prodA24 = prevA24 > 0 ? N(steam.prod_boiler_a_24) - prevA24 : N(steam.prod_boiler_a_24);
            const prodB24 = prevB24 > 0 ? N(steam.prod_boiler_b_24) - prevB24 : N(steam.prod_boiler_b_24);

            const steamWithCalcs = {
                ...steam,
                prod_total_24: prodA24 + prodB24,
                prod_total_00: N(steam.prod_boiler_a_00) + N(steam.prod_boiler_b_00),
                internal_ubb_24: N(steam.inlet_turbine_24) - N(steam.fully_condens_24),
                internal_ubb_00: N(steam.inlet_turbine_00) - N(steam.co_gen_00),
                lps_ii_24: 0,
                lps_3a_24: 0,
                lps_ii_00: 0,
                lps_3a_00: 0,
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

            const calcCrA = steamProdA > 0 ? coalTotalA / steamProdA : 0;
            const calcCrB = steamProdB > 0 ? coalTotalB / steamProdB : 0;
            const turbWithCalcs = {
                ...turbineMisc,
                consumption_rate_a: calcCrA,
                consumption_rate_b: calcCrB,
                consumption_rate_avg: (calcCrA + calcCrB) / 2,
            };

            const prevBfwA = prevStockTank ? N(prevStockTank.bfw_boiler_a) : 0;
            const prevBfwB = prevStockTank ? N(prevStockTank.bfw_boiler_b) : 0;
            const bfwConsA = prevBfwA > 0 ? N(stockTank.bfw_boiler_a) - prevBfwA : N(stockTank.bfw_boiler_a);
            const bfwConsB = prevBfwB > 0 ? N(stockTank.bfw_boiler_b) - prevBfwB : N(stockTank.bfw_boiler_b);

            const tankWithCalcs = {
                ...stockTank,
                solar_tank_total: N(stockTank.solar_tank_a) + N(stockTank.solar_tank_b),
                bfw_total: bfwConsA + bfwConsB,
            };

            const prevCT = prevCoalTransfer || {};
            const calcTransfer = {
                ...coalTransfer,
                pb2_total_pf1_rit: N(prevCT.pb2_total_pf1_rit) + N(coalTransfer.pb2_pf1_rit),
                pb2_total_pf1_ton: N(prevCT.pb2_total_pf1_ton) + N(coalTransfer.pb2_pf1_ton),
                pb2_total_pf2_rit: N(prevCT.pb2_total_pf2_rit) + N(coalTransfer.pb2_pf2_rit),
                pb2_total_pf2_ton: N(prevCT.pb2_total_pf2_ton) + N(coalTransfer.pb2_pf2_ton),
                pb3_total_calc_rit: N(prevCT.pb3_total_calc_rit) + N(coalTransfer.pb3_calc_rit),
                pb3_total_calc_ton: N(prevCT.pb3_total_calc_ton) + N(coalTransfer.pb3_calc_ton),
                darat_total_ton: N(prevCT.darat_total_ton) + N(coalTransfer.darat_24_ton),
                laut_total_ton: N(prevCT.laut_total_ton) + N(coalTransfer.laut_24_ton),
            };

            const result = await submitReport({
                created_by: operator?.supabaseId ?? undefined,
                notes: undefined,
                produksi_steam_a: prodA24 || null,
                produksi_steam_b: prodB24 || null,
                konsumsi_batubara: coalWithCalcs.grand_total_24 ?? null,
                load_mw: power.gen_00 ?? null,
                steam: steamWithCalcs,
                power,
                coal: coalWithCalcs,
                turbineMisc: turbWithCalcs,
                stockTank: tankWithCalcs,
                coalTransfer: calcTransfer,
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

    // ─── Tab Completeness Checker ───
    const isTabLengkap = useCallback((tabId: HarianTabId) => {
        const hasVal = (obj: Record<string, any>, keys: string[]) => keys.every(k => obj[k] !== null && obj[k] !== undefined && obj[k] !== '');
        
        switch (tabId) {
            case 'Boiler': 
                return hasVal(steam, ['prod_boiler_a_24', 'prod_boiler_b_24']) && hasVal(stockTank, ['bfw_boiler_a', 'bfw_boiler_b']);
            case 'Turbin': 
                return hasVal(steam, ['inlet_turbine_24', 'fully_condens_24']);
            case 'Power': 
                return hasVal(power, ['gen_24', 'exsport_24', 'internal_bus1_24']);
            case 'Handling': 
                return hasVal(coalTransfer, ['darat_24_ton', 'laut_24_ton']);
            case 'Chemical': 
                return hasVal(stockTank, ['chemical_phosphat', 'chemical_amin', 'chemical_hydrasin']);
            case 'Stock BB': 
                return hasVal(stockTank, ['stock_batubara']);
            case 'Silo & Fly Ash': 
                return hasVal(stockTank, ['silo_a_pct', 'silo_b_pct']);
            default: return false;
        }
    }, [steam, power, coal, stockTank, coalTransfer]);

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

            <div className="flex flex-col lg:flex-row gap-6 w-full max-w-full">
                {/* Left Sidebar */}
                <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
                    {/* Action Buttons */}
                    <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
                        <div>
                            <h3 className="text-white font-bold text-sm mb-1">Menu Laporan</h3>
                            <p className="text-[11px] text-slate-400 leading-tight">Pilih kategori area untuk mulai input data harian.</p>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className={`flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-emerald-500/50 w-full ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">save</span>
                            {submitting ? 'Menyimpan...' : 'Simpan Laporan'}
                        </button>
                    </div>

                    {/* Desktop Tab List */}
                    <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-2 shadow-lg hidden lg:flex flex-col gap-1">
                        {HARIAN_TABS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            const isComplete = isTabLengkap(tab.id);
                            const styles = TAB_STYLES[tab.colorClass];
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm flex items-center gap-3 transition-all border relative overflow-hidden group ${isActive ? styles.active : styles.inactive}`}
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${isActive ? styles.icon : 'opacity-70 group-hover:opacity-100 transition-opacity'}`}>
                                        {tab.icon}
                                    </span>
                                    <span className="flex-1">{tab.label}</span>
                                    {isComplete && (
                                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 mr-1 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                                            <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                        </div>
                                    )}
                                    {isActive && <span className="material-symbols-outlined text-[16px] opacity-70">chevron_right</span>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Mobile Tab List */}
                    <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-2 shadow-lg lg:hidden overflow-x-auto">
                        <div className="flex gap-2 w-max pb-1">
                            {HARIAN_TABS.map((tab) => {
                                const isActive = activeTab === tab.id;
                                const isComplete = isTabLengkap(tab.id);
                                const styles = TAB_STYLES[tab.colorClass];
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-all whitespace-nowrap border relative overflow-hidden ${isActive ? styles.active : styles.inactive}`}
                                    >
                                        <span className={`material-symbols-outlined text-[18px] ${isActive ? styles.icon : 'opacity-70'}`}>
                                            {tab.icon}
                                        </span>
                                        <span>{tab.label}</span>
                                        {isComplete && (
                                            <div className="flex items-center justify-center w-4 h-4 ml-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400">
                                                <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Tab Content Area */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                    {/* Active Tab Header */}
                    <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl px-5 py-4 flex items-center gap-4 shadow-lg">
                        {(() => {
                            const tab = HARIAN_TABS.find(t => t.id === activeTab);
                            const styles = tab ? TAB_STYLES[tab.colorClass] : TAB_STYLES['rose'];
                            return (
                                <>
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-[#101822] border border-slate-700/50 shadow-inner`}>
                                        <span className={`material-symbols-outlined text-[26px] ${styles.icon}`}>{tab?.icon}</span>
                                    </div>
                                    <div>
                                        <h2 className="text-white font-bold text-xl leading-tight">{tab?.label}</h2>
                                        <p className="text-slate-400 text-xs mt-0.5">Input data operasional harian {tab?.label}</p>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-4 bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl">
                            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                            Memuat data harian...
                        </div>
                    )}

                    {/* Tab Content */}
                    <div className="pb-6">
                        {(() => {
                            const tabProps: DailyTabProps = {
                                steam, power, coal, turbineMisc, stockTank, coalTransfer, totalizer,
                                prevSteam, prevPower, prevCoal, prevTotalizer: prevTotalizerData, prevStockTank, prevCoalTransfer,
                                onSteamChange: makeNumberHandler(setSteam),
                                onPowerChange: makeNumberHandler(setPower),
                                onCoalChange: makeNumberHandler(setCoal),
                                onTurbineMiscChange: makeNumberHandler(setTurbineMisc),
                                onStockTankChange: makeNumberHandler(setStockTank),
                                onCoalTransferChange: makeNumberHandler(setCoalTransfer),
                                onTotalizerChange: makeMixedHandler(setTotalizer),
                                crA, crB,
                                solarUnloadings,
                                ashUnloadings,
                            };
                            return (
                                <>
                                    {activeTab === 'Boiler' && <TabBoiler {...tabProps} />}
                                    {activeTab === 'Turbin' && <TabTurbin {...tabProps} />}
                                    {activeTab === 'Power' && <TabPower {...tabProps} />}
                                    {activeTab === 'Handling' && <TabHandling {...tabProps} />}
                                    {activeTab === 'Chemical' && <TabChemical {...tabProps} />}
                                    {activeTab === 'Stock BB' && <TabStockBatubara {...tabProps} />}
                                    {activeTab === 'Silo & Fly Ash' && <TabSiloFlyAsh {...tabProps} />}
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </>
    );
}
