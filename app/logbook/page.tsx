'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { useDailyReport } from '@/hooks/useDailyReport';
import { createClient } from '@/lib/supabase/client';
import { todayWIB } from '@/lib/utils';
import LogbookSheet, { type LogbookData, type BoilerCol, type BottomCol } from '@/components/logbook/LogbookSheet';
import './logbook.css';

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const SHIFT_BY_COL = ['malam', 'pagi', 'sore'] as const; // kolom 06.00 / 14.00 / 22.00

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const SHIFT_SELECT = `date, shift,
    shift_boiler(boiler, press_steam, temp_steam, flow_steam, totalizer_steam, flow_bfw, temp_bfw, totalizer_bfw, bfw_press, temp_furnace, temp_flue_gas, air_heater_ti113, o2, batubara_ton, steam_drum_press, primary_air, secondary_air, feeder_a_flow, feeder_b_flow, feeder_c_flow, feeder_d_flow, feeder_e_flow, feeder_f_flow),
    shift_coal_bunker(feeder_a, feeder_b, feeder_c, feeder_d, feeder_e, feeder_f, bunker_a, bunker_b, bunker_c, bunker_d, bunker_e, bunker_f),
    shift_esp_handling(esp_a1, esp_a2, esp_a3, esp_b1, esp_b2, esp_b3, silo_a, silo_b, unloading_a, unloading_b, loading, hopper, conveyor),
    shift_tankyard(tk_rcw, tk_demin, tk_solar_ab)`;

function delta(cur: number | null | undefined, prev: number | null | undefined): number | null {
    return (cur != null && prev != null) ? cur - prev : null;
}
function boilerOf(row: Row, L: 'A' | 'B') {
    return row?.shift_boiler?.find((b: Row) => b.boiler === L) ?? null;
}
function first(arr: Row): Row {
    return Array.isArray(arr) ? (arr[0] ?? null) : (arr ?? null);
}

export default function LogbookPage() {
    const { operator, loading: authLoading } = useOperator();
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState<string>(todayWIB());
    const [shiftMap, setShiftMap] = useState<Record<string, Row>>({});

    const { report: daily } = useDailyReport(selectedDate);

    useEffect(() => {
        if (!authLoading && !operator) router.push('/');
    }, [authLoading, operator, router]);

    // Fetch shift data untuk hari D dan D-1 (D-1 dibutuhkan untuk delta kolom malam)
    useEffect(() => {
        if (!selectedDate) return;
        const supabase = createClient();
        let stale = false;
        const prev = new Date(selectedDate + 'T00:00:00');
        prev.setDate(prev.getDate() - 1);
        const prevISO = toISO(prev);

        (async () => {
            const { data } = await supabase
                .from('shift_reports')
                .select(SHIFT_SELECT)
                .in('date', [prevISO, selectedDate]);
            if (stale) return;
            const map: Record<string, Row> = {};
            (data ?? []).forEach((r: Row) => { map[`${r.date}|${r.shift}`] = r; });
            setShiftMap(map);
        })();
        return () => { stale = true; };
    }, [selectedDate]);

    const data: LogbookData = useMemo(() => {
        const prev = new Date(selectedDate + 'T00:00:00');
        prev.setDate(prev.getDate() - 1);
        const prevISO = toISO(prev);

        const shiftAtCol = (i: number): Row => shiftMap[`${selectedDate}|${SHIFT_BY_COL[i]}`] ?? null;
        const prevAtCol = (i: number): Row => {
            if (i === 0) return shiftMap[`${prevISO}|sore`] ?? null;
            if (i === 1) return shiftMap[`${selectedDate}|malam`] ?? null;
            return shiftMap[`${selectedDate}|pagi`] ?? null;
        };

        const dSteam = first(daily?.daily_report_steam);
        const dCoal = first(daily?.daily_report_coal);
        const dTurb = first(daily?.daily_report_turbine_misc);
        const dTank = first(daily?.daily_report_stock_tank);
        const dTot = first(daily?.daily_report_totalizer);

        // ── Boiler shift column (i = 0..2) ──
        const boilerShiftCol = (i: number, L: 'A' | 'B'): BoilerCol => {
            const row = shiftAtCol(i);
            const prevRow = prevAtCol(i);
            const sb = boilerOf(row, L);
            const psb = boilerOf(prevRow, L);
            const cb = first(row?.shift_coal_bunker);
            const pcb = first(prevRow?.shift_coal_bunker);
            const keys = L === 'A' ? ['a', 'b', 'c'] : ['d', 'e', 'f'];
            return {
                steam: [sb?.press_steam ?? null, sb?.temp_steam ?? null],
                bfw: [sb?.bfw_press ?? null, sb?.temp_bfw ?? null],
                furn: [sb?.temp_furnace ?? null, sb?.temp_flue_gas ?? null],
                hotair: [sb?.air_heater_ti113 ?? null, sb?.o2 ?? null],
                totSteam: { fq: sb?.totalizer_steam ?? null, ton: delta(sb?.totalizer_steam, psb?.totalizer_steam), flow: sb?.flow_steam ?? null },
                totBfw: { fq: sb?.totalizer_bfw ?? null, ton: delta(sb?.totalizer_bfw, psb?.totalizer_bfw), flow: sb?.flow_bfw ?? null },
                feeders: keys.map((k) => ({
                    fq: cb?.[`feeder_${k}`] ?? null,
                    ton: delta(cb?.[`feeder_${k}`], pcb?.[`feeder_${k}`]),
                    flow: sb?.[`feeder_${k}_flow`] ?? null,
                })),
                totalBatubara: sb?.batubara_ton ?? null,
                steamDrumPress: sb?.steam_drum_press ?? null,
                pa: sb?.primary_air ?? null,
                sa: sb?.secondary_air ?? null,
            };
        };

        // ── Boiler daily column (24.00) ──
        const boilerDailyCol = (L: 'A' | 'B'): BoilerCol => {
            const low = L.toLowerCase();
            const keys = L === 'A' ? ['a', 'b', 'c'] : ['d', 'e', 'f'];
            return {
                steam: [null, null],
                bfw: [null, null],
                furn: [dTurb?.[`temp_furnace_${low}`] ?? null, null],
                hotair: [null, null],
                // Catatan: di daily_report, kolom *_24 menyimpan pembacaan totaliser akhir
                // hari (FQ), sedangkan konsumsi 24-jam (Ton) ada di kolom selisih_*.
                totSteam: {
                    fq: dSteam?.[`prod_boiler_${low}_24`] ?? null,
                    ton: dSteam?.[`selisih_prod_boiler_${low}`] ?? null,
                    flow: dSteam?.[`prod_boiler_${low}_00`] ?? null,
                },
                totBfw: { fq: dTank?.[`bfw_boiler_${low}`] ?? null, ton: null, flow: dTank?.[`flow_bfw_${low}`] ?? null },
                feeders: keys.map((k) => ({
                    fq: dCoal?.[`coal_${k}_24`] ?? null,
                    ton: dCoal?.[`selisih_coal_${k}`] ?? null,
                    flow: dCoal?.[`coal_${k}_00`] ?? null,
                })),
                totalBatubara: dCoal?.[`total_boiler_${low}_24`] ?? null,
                steamDrumPress: null,
                pa: null,
                sa: null,
            };
        };

        // ── Bottom shift column (i = 0..2) ──
        const bottomShiftCol = (i: number): BottomCol => {
            const row = shiftAtCol(i);
            const esp = first(row?.shift_esp_handling);
            const cb = first(row?.shift_coal_bunker);
            const tank = first(row?.shift_tankyard);
            return {
                loading: esp?.loading ?? null,
                conveyor: esp?.conveyor ?? null,
                hopper: esp?.hopper ?? null,
                bunkerABC: [cb?.bunker_a ?? null, cb?.bunker_b ?? null, cb?.bunker_c ?? null],
                bunkerDEF: [cb?.bunker_d ?? null, cb?.bunker_e ?? null, cb?.bunker_f ?? null],
                trafoA: [esp?.esp_a1 ?? null, esp?.esp_a2 ?? null, esp?.esp_a3 ?? null],
                trafoB: [esp?.esp_b1 ?? null, esp?.esp_b2 ?? null, esp?.esp_b3 ?? null],
                silo: [esp?.silo_a ?? null, esp?.silo_b ?? null, esp?.unloading_a ?? null],
                solar: tank?.tk_solar_ab ?? null,
                demin: tank?.tk_demin ?? null,
                rcw: tank?.tk_rcw ?? null,
            };
        };

        // ── Bottom daily column (24.00) ──
        const bottomDailyCol = (): BottomCol => {
            const unl = (dTank?.unloading_fly_ash_a ?? 0) + (dTank?.unloading_fly_ash_b ?? 0);
            return {
                loading: null,
                conveyor: null,
                hopper: null,
                bunkerABC: [null, null, null],
                bunkerDEF: [null, null, null],
                trafoA: [null, null, null],
                trafoB: [null, null, null],
                silo: [dTank?.silo_a_pct ?? null, dTank?.silo_b_pct ?? null, unl || null],
                solar: dTank?.solar_tank_total ?? null,
                demin: dTank?.demin_level_00 ?? null,
                rcw: dTank?.rcw_level_00 ?? null,
                solarTot: null,
                deminTot: dTot?.konsumsi_demin ?? null,
                rcwTot: dTot?.konsumsi_rcw ?? null,
            };
        };

        return {
            boilerA: [boilerShiftCol(0, 'A'), boilerShiftCol(1, 'A'), boilerShiftCol(2, 'A'), boilerDailyCol('A')],
            boilerB: [boilerShiftCol(0, 'B'), boilerShiftCol(1, 'B'), boilerShiftCol(2, 'B'), boilerDailyCol('B')],
            bottom: [bottomShiftCol(0), bottomShiftCol(1), bottomShiftCol(2), bottomDailyCol()],
        };
    }, [shiftMap, daily, selectedDate]);

    if (authLoading || !operator) return null;

    const dateObj = new Date(selectedDate + 'T00:00:00');
    const hariStr = HARI_ID[dateObj.getDay()];
    const formatDate = (d: string) => new Date(d + 'T00:00:00+07:00').toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1100px] mx-auto">
            {/* Toolbar (tidak ikut print) */}
            <div className="lb-toolbar lb-no-print">
                <button onClick={() => { const d = new Date(dateObj); d.setDate(d.getDate() - 7); setSelectedDate(toISO(d)); }}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-surface-highlight transition-all cursor-pointer">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <div className="flex items-center gap-1">
                    {Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(dateObj);
                        d.setDate(d.getDate() - 3 + i);
                        const iso = toISO(d);
                        const isActive = iso === selectedDate;
                        const isToday = iso === todayWIB();
                        const dayShort = d.toLocaleDateString('id-ID', { weekday: 'short' }).charAt(0);
                        return (
                            <button key={iso} onClick={() => setSelectedDate(iso)}
                                className={`flex flex-col items-center w-10 py-1 rounded-lg cursor-pointer transition-all
                                    ${isActive ? 'bg-primary text-white shadow-[0_0_12px_rgba(43,124,238,0.35)]'
                                        : isToday ? 'text-primary hover:bg-surface-highlight'
                                            : 'text-text-secondary hover:text-white hover:bg-surface-highlight'}`}>
                                <span className="text-[9px] font-semibold uppercase leading-none">{dayShort}</span>
                                <span className={`text-sm font-bold leading-tight ${isActive ? 'text-white' : ''}`}>{d.getDate()}</span>
                            </button>
                        );
                    })}
                </div>
                <button onClick={() => { const d = new Date(dateObj); d.setDate(d.getDate() + 7); setSelectedDate(toISO(d)); }}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-surface-highlight transition-all cursor-pointer">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
                <div className="relative ml-1">
                    <input type="date" value={selectedDate} onChange={e => e.target.value && setSelectedDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    <div className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-surface-highlight transition-all cursor-pointer">
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                    </div>
                </div>
                <button onClick={() => window.print()}
                    className="ml-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer">
                    <span className="material-symbols-outlined text-base">print</span>
                    Print / PDF
                </button>
            </div>

            {/* Lembar buku */}
            <div className="overflow-x-auto">
                <LogbookSheet data={data} tanggal={`${hariStr}, ${formatDate(selectedDate)}`} />
            </div>
        </div>
    );
}
