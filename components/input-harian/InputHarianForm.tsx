'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDailyReport } from '@/hooks/useDailyReport';
import { createClient } from '@/lib/supabase/client';
import type { Operator } from '@/lib/constants';
import TabBoiler from './TabBoiler';
import TabTurbin from './TabTurbin';
import TabPower from './TabPower';
import TabPIU from './TabPIU';
import TabHandling from './TabHandling';
import TabChemical from './TabChemical';
import TabStockBatubara from './TabStockBatubara';
import TabSiloFlyAsh from './TabSiloFlyAsh';
import type { DailyTabProps } from './types';

type HarianTabId = 'Boiler' | 'Turbin' | 'Power' | 'PIU' | 'Handling' | 'Chemical' | 'Stock BB' | 'Silo & Fly Ash';

const HARIAN_TABS: { id: HarianTabId; label: string; icon: string; colorClass: string }[] = [
    { id: 'Boiler', label: 'Boiler', icon: 'factory', colorClass: 'rose' },
    { id: 'Turbin', label: 'Turbin & Distribusi Steam', icon: 'mode_fan', colorClass: 'cyan' },
    { id: 'Power', label: 'Generator', icon: 'bolt', colorClass: 'amber' },
    { id: 'PIU', label: 'PIU', icon: 'electric_meter', colorClass: 'blue' },
    { id: 'Handling', label: 'Handling', icon: 'local_shipping', colorClass: 'orange' },
    { id: 'Chemical', label: 'Chemical', icon: 'science', colorClass: 'purple' },
    { id: 'Stock BB', label: 'In/Out Batubara', icon: 'local_shipping', colorClass: 'indigo' },
    { id: 'Silo & Fly Ash', label: 'Silo & Fly Ash', icon: 'filter_alt', colorClass: 'teal' },
];

const TAB_STYLES: Record<string, { active: string; inactive: string; icon: string }> = {
    'rose': { active: 'font-bold bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-inner shadow-rose-500/10', inactive: 'font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border-transparent', icon: 'text-rose-400' },
    'cyan': { active: 'font-bold bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-inner shadow-cyan-500/10', inactive: 'font-medium text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border-transparent', icon: 'text-cyan-400' },
    'amber': { active: 'font-bold bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-inner shadow-amber-500/10', inactive: 'font-medium text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 border-transparent', icon: 'text-amber-400' },
    'blue': { active: 'font-bold bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-inner shadow-blue-500/10', inactive: 'font-medium text-slate-400 hover:text-blue-300 hover:bg-blue-500/10 border-transparent', icon: 'text-blue-400' },
    'orange': { active: 'font-bold bg-orange-500/20 text-orange-400 border-orange-500/30 shadow-inner shadow-orange-500/10', inactive: 'font-medium text-slate-400 hover:text-orange-300 hover:bg-orange-500/10 border-transparent', icon: 'text-orange-400' },
    'purple': { active: 'font-bold bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-inner shadow-purple-500/10', inactive: 'font-medium text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 border-transparent', icon: 'text-purple-400' },
    'indigo': { active: 'font-bold bg-indigo-500/20 text-indigo-400 border-indigo-500/30 shadow-inner shadow-indigo-500/10', inactive: 'font-medium text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 border-transparent', icon: 'text-indigo-400' },
    'teal': { active: 'font-bold bg-teal-500/20 text-teal-400 border-teal-500/30 shadow-inner shadow-teal-500/10', inactive: 'font-medium text-slate-400 hover:text-teal-300 hover:bg-teal-500/10 border-transparent', icon: 'text-teal-400' },
};

interface InputHarianFormProps {
    date: string;
    operator: Operator | null;
    groupName?: string | null;
    supervisorName?: string;
}

export default function InputHarianForm({ date, operator, groupName, supervisorName }: InputHarianFormProps) {
    const [activeTab, setActiveTab] = useState<HarianTabId>('Boiler');
    const [visitedTabs, setVisitedTabs] = useState<Set<HarianTabId>>(new Set());
    const [submitting, setSubmitting] = useState(false);
    const [saveProgress, setSaveProgress] = useState<number | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const lastSubmittedReportId = useRef<string | null>(null);
    const skipNextClear = useRef(false);

    // 7 state objects — satu per child table
    const [steam, setSteam] = useState<Record<string, number | null>>({});
    const [power, setPower] = useState<Record<string, number | null>>({});
    const [coal, setCoal] = useState<Record<string, number | null>>({});
    const [turbineMisc, setTurbineMisc] = useState<Record<string, number | string | null>>({});
    const [stockTank, setStockTank] = useState<Record<string, number | null>>({});
    const [coalTransfer, setCoalTransfer] = useState<Record<string, number | null>>({});
    const [totalizer, setTotalizer] = useState<Record<string, number | string | null>>({});

    const [solarUnloadings, setSolarUnloadings] = useState<{ id?: string; date: string; liters: number; supplier: string }[]>([]);
    const [solarUsages, setSolarUsages] = useState<{ id?: string; date: string; shift: string; liters: number; tujuan: string }[]>([]);
    const [ashUnloadings, setAshUnloadings] = useState<{ id?: string; date: string; shift: string; silo: string; perusahaan: string; tujuan: string; ritase: number }[]>([]);

    const { report, prevReport, loading, submitReport, refetch } = useDailyReport(date);

        // Fetch solar & ash unloadings for the selected date
        useEffect(() => {
            const supabase = createClient();
            
            supabase
                .from('solar_unloadings')
                .select('id, date, liters, supplier')
                .eq('date', date)
                .order('created_at', { ascending: false })
                .then(({ data }) => {
                    setSolarUnloadings(
                        (data ?? []).map(r => ({
                            id: r.id as string,
                            date: r.date as string,
                            liters: Number(r.liters) || 0,
                            supplier: (r.supplier as string) || '',
                        }))
                    );
                });

            supabase
                .from('solar_usages')
                .select('id, date, shift, liters, tujuan')
                .eq('date', date)
                .order('created_at', { ascending: false })
                .then(({ data }) => {
                    setSolarUsages(
                        (data ?? []).map(r => ({
                            id: r.id as string,
                            date: r.date as string,
                            shift: (r.shift as string) || '',
                            liters: Number(r.liters) || 0,
                            tujuan: (r.tujuan as string) || '',
                        }))
                    );
                });

            supabase
                .from('ash_unloadings')
                .select('id, date, shift, silo, perusahaan, tujuan, ritase')
                .eq('date', date)
                .order('created_at', { ascending: false })
                .then(({ data }) => {
                    setAshUnloadings(
                        (data ?? []).map(r => ({
                            id: r.id as string,
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

    // ─── Solar delete handlers ───
    const handleEditSolarUnloading = async (id: string, fields: { liters: number; supplier: string }) => {
        const supabase = createClient();
        const { error } = await supabase.from('solar_unloadings').update(fields).eq('id', id);
        if (error) { alert('Gagal simpan: ' + error.message); return; }
        setSolarUnloadings(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e));
    };

    const handleEditSolarUsage = async (id: string, fields: { liters: number; tujuan: string; shift: string }) => {
        const supabase = createClient();
        const { error } = await supabase.from('solar_usages').update(fields).eq('id', id);
        if (error) { alert('Gagal simpan: ' + error.message); return; }
        setSolarUsages(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e));
    };

    const handleDeleteSolarUnloading = async (id: string) => {
        if (!confirm('Hapus data kedatangan solar ini?')) return;
        const supabase = createClient();
        const { error } = await supabase.from('solar_unloadings').delete().eq('id', id);
        if (error) { alert('Gagal hapus: ' + error.message); return; }
        setSolarUnloadings(prev => prev.filter(e => e.id !== id));
    };

    const handleDeleteSolarUsage = async (id: string) => {
        if (!confirm('Hapus data permintaan solar ini?')) return;
        const supabase = createClient();
        const { error } = await supabase.from('solar_usages').delete().eq('id', id);
        if (error) { alert('Gagal hapus: ' + error.message); return; }
        setSolarUsages(prev => prev.filter(e => e.id !== id));
    };

    const handleDeleteAshUnloading = async (id: string) => {
        if (!confirm('Hapus data unloading fly ash ini?')) return;
        const supabase = createClient();
        const { error } = await supabase.from('ash_unloadings').delete().eq('id', id);
        if (error) { alert('Gagal hapus: ' + error.message); return; }
        setAshUnloadings(prev => prev.filter(e => e.id !== id));
    };

    const handleEditAshUnloading = async (id: string, fields: { silo: string; shift: string; perusahaan: string; tujuan: string; ritase: number }) => {
        const supabase = createClient();
        const { error } = await supabase.from('ash_unloadings').update(fields).eq('id', id);
        if (error) { alert('Gagal simpan: ' + error.message); return; }
        setAshUnloadings(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e));
    };

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

        if (!report) {
            // Pre-fill totalizer fields dari data kemarin (default = totalizer kemarin)
            if (prevReport) {
                const STEAM_TOT = ['prod_boiler_a_24','prod_boiler_b_24','inlet_turbine_24','mps_i_24','mps_3a_24','fully_condens_24'];
                const COAL_TOT  = ['coal_a_24','coal_b_24','coal_c_24','coal_d_24','coal_e_24','coal_f_24'];
                const POWER_TOT = ['power_ubb_totalizer','power_pabrik2_totalizer','power_pabrik3a_totalizer','power_revamping_totalizer','power_pie_totalizer','power_stg_ubb_totalizer'];
                const TURB_TOT  = ['totalizer_gi','totalizer_export','totalizer_import'];
                const TANK_TOT  = ['bfw_boiler_a','bfw_boiler_b'];

                const pickKeys = (obj: Record<string, number | string | null>, keys: string[]): Record<string, number | null> => {
                    const result: Record<string, number | null> = {};
                    for (const k of keys) if (obj[k] != null) result[k] = obj[k] as number;
                    return result;
                };

                const ps = prevReport.daily_report_steam?.[0];
                const pp = prevReport.daily_report_power?.[0];
                const pc = prevReport.daily_report_coal?.[0];
                const pt = prevReport.daily_report_turbine_misc?.[0];
                const pk = prevReport.daily_report_stock_tank?.[0];

                if (ps) setSteam(pickKeys(extractFields(ps as unknown as Record<string, unknown>), STEAM_TOT));
                if (pp) setPower(pickKeys(extractFields(pp as unknown as Record<string, unknown>), POWER_TOT));
                if (pc) setCoal(pickKeys(extractFields(pc as unknown as Record<string, unknown>), COAL_TOT));
                if (pt) setTurbineMisc(pickKeys(extractFields(pt as unknown as Record<string, unknown>), TURB_TOT));
                if (pk) setStockTank(pickKeys(extractFields(pk as unknown as Record<string, unknown>), TANK_TOT));
            }
            return;
        }

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
        if (turbData) setTurbineMisc(extractFields(turbData as unknown as Record<string, unknown>) as Record<string, number | string | null>);
        if (tankData) setStockTank(extractFields(tankData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (transferData) setCoalTransfer(extractFields(transferData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (totalizerData) setTotalizer(extractFields(totalizerData as unknown as Record<string, unknown>));
    }, [report, prevReport]);

    // Inherit status boiler dari laporan harian sebelumnya apabila laporan hari ini belum ada
    useEffect(() => {
        if (report) return;
        const prevTurb = prevReport?.daily_report_turbine_misc?.[0] as Record<string, unknown> | undefined;
        if (!prevTurb) return;
        const statusA = prevTurb.status_boiler_a as string | null | undefined;
        const statusB = prevTurb.status_boiler_b as string | null | undefined;
        setTurbineMisc(prev => {
            const next = { ...prev };
            if (statusA && !prev.status_boiler_a) next.status_boiler_a = statusA;
            if (statusB && !prev.status_boiler_b) next.status_boiler_b = statusB;
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prevReport, report]);

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
    const prevTurbineMisc = prevReport?.daily_report_turbine_misc?.[0]
        ? extractFields(prevReport.daily_report_turbine_misc[0] as unknown as Record<string, unknown>) as Record<string, number | null>
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
    const selCoalCR = (key: string) => { const p = prevCoal ? N0(prevCoal[key]) : 0; return p > 0 ? N0(coal[key]) - p : N0(coal[key]); };
    const coalTotalA = selCoalCR('coal_a_24') + selCoalCR('coal_b_24') + selCoalCR('coal_c_24');
    const coalTotalB = selCoalCR('coal_d_24') + selCoalCR('coal_e_24') + selCoalCR('coal_f_24');
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
        setSaveProgress(5);
        const progressInterval = setInterval(() => {
            setSaveProgress(p => (p !== null && p < 85) ? p + 8 : p);
        }, 400);
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

            const selC = (key: string) => { const p = prevCoal ? N(prevCoal[key]) : 0; return p > 0 ? N(coal[key]) - p : N(coal[key]); };
            const totalA24 = selC('coal_a_24') + selC('coal_b_24') + selC('coal_c_24');
            const totalB24 = selC('coal_d_24') + selC('coal_e_24') + selC('coal_f_24');
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

            // Boiler shutdown → semua flow/furnace = 0 sebelum disimpan
            const isShutdownA = turbineMisc.status_boiler_a === 'shutdown';
            const isShutdownB = turbineMisc.status_boiler_b === 'shutdown';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sw = steamWithCalcs as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cw = coalWithCalcs as any;
            if (isShutdownA) {
                sw.prod_boiler_a_00 = 0;
                cw.coal_a_00 = 0; cw.coal_b_00 = 0; cw.coal_c_00 = 0;
                cw.total_boiler_a_00 = 0;
                (tankWithCalcs as Record<string, unknown>).flow_bfw_a = 0;
            }
            if (isShutdownB) {
                sw.prod_boiler_b_00 = 0;
                cw.coal_d_00 = 0; cw.coal_e_00 = 0; cw.coal_f_00 = 0;
                cw.total_boiler_b_00 = 0;
                (tankWithCalcs as Record<string, unknown>).flow_bfw_b = 0;
            }
            if (isShutdownA || isShutdownB) {
                sw.prod_total_00 = N(sw.prod_boiler_a_00) + N(sw.prod_boiler_b_00);
                cw.grand_total_00 = N(cw.total_boiler_a_00) + N(cw.total_boiler_b_00);
            }

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
                totalizer: {
                    ...totalizer,
                    group_name: groupName || totalizer.group_name || null,
                    kasi_name: supervisorName || totalizer.kasi_name || null,
                },
            });

            if (result?.error) {
                showToast('Error: ' + result.error, 'error');
            } else {
                if (result?.sheetsWarning) {
                    showToast('Tersimpan, tapi Sheets gagal: ' + result.sheetsWarning, 'error');
                } else {
                    showToast('Laporan harian berhasil disimpan!', 'success');
                }
                lastSubmittedReportId.current = result?.reportId || null;
                refetch();
            }
            clearInterval(progressInterval);
            setSaveProgress(100);
            setTimeout(() => setSaveProgress(null), 800);
        } catch {
            clearInterval(progressInterval);
            setSaveProgress(null);
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
                return hasVal(power, ['gen_00']) || hasVal(turbineMisc, ['gen_ampere']);
            case 'PIU':
                return hasVal(turbineMisc, ['totalizer_export', 'totalizer_import']);
            case 'Handling':
                return hasVal(stockTank, ['rcw_level_00', 'demin_level_00', 'solar_tank_a', 'solar_boiler']);
            case 'Chemical':
                return visitedTabs.has('Chemical');
            case 'Stock BB':
                return hasVal(coalTransfer, ['pb2_pf1_rit', 'pb2_pf1_ton', 'pb2_pf2_rit', 'pb2_pf2_ton', 'pb3_calc_rit', 'pb3_calc_ton', 'darat_24_ton', 'laut_24_ton']);
            case 'Silo & Fly Ash': 
                return hasVal(stockTank, ['silo_a_pct', 'silo_b_pct']);
            default: return false;
        }
    }, [steam, power, coal, turbineMisc, stockTank, coalTransfer, visitedTabs]);

    return (
        <>
            {/* Toast */}
            {toast && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className={`px-8 py-5 rounded-2xl shadow-2xl text-white text-base font-semibold transition-all scale-100 pointer-events-auto ${
                        toast.type === 'success'
                            ? 'bg-emerald-600 border border-emerald-400/50 shadow-emerald-500/30'
                            : 'bg-red-600 border border-red-400/50 shadow-red-500/30'
                    }`}>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-[28px]">
                                {toast.type === 'success' ? 'check_circle' : 'error'}
                            </span>
                            {toast.message}
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {submitting && (
                <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
                    <div className="relative flex flex-col items-center justify-center bg-[#16202e] border border-slate-700/50 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 w-72">
                        <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-2xl pointer-events-none"></div>
                        <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                        <h3 className="text-white font-black text-xl tracking-wide mb-1 relative z-10">Menyimpan data</h3>
                        <p className="text-slate-400 text-sm font-medium mb-5 relative z-10">Mohon tunggu sebentar...</p>
                        {saveProgress !== null && (
                            <div className="w-full relative z-10">
                                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                                    <span>Progress</span>
                                    <span className="font-bold text-emerald-400">{saveProgress}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-700/60 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                                        style={{ width: `${saveProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
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
                            {submitting ? 'Menyimpan...' : 'SIMPAN LAPORAN'}
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
                                    onClick={() => { setActiveTab(tab.id); setVisitedTabs(prev => new Set(prev).add(tab.id)); }}
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
                                        onClick={() => { setActiveTab(tab.id); setVisitedTabs(prev => new Set(prev).add(tab.id)); }}
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
                    <div className={`pb-6${activeTab === 'Power' ? ' flex flex-row gap-4 items-start' : ''}`}>
                        {(() => {
                            const tabProps: DailyTabProps = {
                                steam, power, coal, turbineMisc, stockTank, coalTransfer, totalizer,
                                prevSteam, prevPower, prevCoal, prevTurbineMisc, prevTotalizer: prevTotalizerData, prevStockTank, prevCoalTransfer,
                                onSteamChange: makeNumberHandler(setSteam),
                                onPowerChange: makeNumberHandler(setPower),
                                onCoalChange: makeNumberHandler(setCoal),
                                onTurbineMiscChange: makeMixedHandler(setTurbineMisc),
                                onStockTankChange: makeNumberHandler(setStockTank),
                                onCoalTransferChange: makeNumberHandler(setCoalTransfer),
                                onTotalizerChange: makeMixedHandler(setTotalizer),
                                crA, crB,
                                solarUnloadings,
                                solarUsages,
                                onDeleteSolarUnloading: handleDeleteSolarUnloading,
                                onDeleteSolarUsage: handleDeleteSolarUsage,
                                onEditSolarUnloading: handleEditSolarUnloading,
                                onEditSolarUsage: handleEditSolarUsage,
                                ashUnloadings,
                                onDeleteAshUnloading: handleDeleteAshUnloading,
                                onEditAshUnloading: handleEditAshUnloading,
                            };
                            return (
                                <>
                                    {activeTab === 'Boiler' && <TabBoiler {...tabProps} />}
                                    {activeTab === 'Turbin' && <TabTurbin {...tabProps} />}
                                    {activeTab === 'Power' && <TabPower {...tabProps} />}
                                    {activeTab === 'PIU' && <TabPIU {...tabProps} />}
                                    {activeTab === 'Handling' && <TabHandling {...tabProps} />}
                                    {activeTab === 'Chemical' && <TabChemical date={date} />}
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
