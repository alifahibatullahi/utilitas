'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { useDailyReport } from '@/hooks/useDailyReport';
import { createClient } from '@/lib/supabase/client';
import { todayWIB } from '@/lib/utils';
import LogbookSheet, { type LogbookData, type BoilerCol, type BottomCol, type ChemCol, type TurbinCol, type GenCol } from '@/components/logbook/LogbookSheet';
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
    shift_tankyard(tk_rcw, tk_demin, tk_solar_ab),
    shift_turbin(totalizer_steam_inlet, totalizer_condensate, flow_steam, flow_cond, hpo_durasi),
    shift_steam_dist(pabrik1_totalizer, pabrik1_flow, pabrik2_totalizer, pabrik2_flow, pabrik3a_totalizer, pabrik3a_flow, pabrik3b_flow),
    shift_generator_gi(gen_load, gen_ampere, gen_tegangan, gen_amp_react, gen_frequensi, gen_cos_phi, gi_sum_p, gi_sum_q, gi_cos_phi),
    shift_power_dist(power_ubb, power_ubb_totalizer, power_pabrik2, power_pabrik2_totalizer, power_pabrik3a, power_pabrik3a_totalizer, power_revamping, power_revamping_totalizer, power_pie, power_pie_totalizer, power_stg_ubb_totalizer),
    shift_water_quality(phosphate_level_tanki, phosphate_stroke_pompa, phosphate_penambahan_air, phosphate_penambahan_chemical, phosphate_b_level_tanki, phosphate_b_stroke_pompa, phosphate_b_penambahan_air, phosphate_b_penambahan_chemical, amine_level_tanki, amine_stroke_pompa, amine_penambahan_air, amine_penambahan_chemical, hydrazine_level_tanki, hydrazine_stroke_pompa, hydrazine_penambahan_air, hydrazine_penambahan_chemical, stock_phosphate, stock_amine, stock_hydrazine)`;

function delta(cur: number | null | undefined, prev: number | null | undefined): number | null {
    return (cur != null && prev != null) ? cur - prev : null;
}
function boilerOf(row: Row, L: 'A' | 'B') {
    return row?.shift_boiler?.find((b: Row) => b.boiler === L) ?? null;
}
function first(arr: Row): Row {
    return Array.isArray(arr) ? (arr[0] ?? null) : (arr ?? null);
}
// Unloading ash silo → "2A" (silo A 2 rit), "2B" (silo B 2 rit), "2A & 1B" (keduanya)
function formatUnloading(a: string | number | null | undefined, b: string | number | null | undefined): string | null {
    const na = Number(a) || 0;
    const nb = Number(b) || 0;
    const parts: string[] = [];
    if (na > 0) parts.push(`${na}A`);
    if (nb > 0) parts.push(`${nb}B`);
    return parts.length ? parts.join(' & ') : null;
}

export default function LogbookPage() {
    const { operator, loading: authLoading } = useOperator();
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState<string>(todayWIB());
    const [shiftMap, setShiftMap] = useState<Record<string, Row>>({});
    // Pesan error fetch shift (mis. API Supabase down/timeout) — ditampilkan sebagai
    // banner supaya gangguan tidak tampil sebagai halaman kosong tanpa keterangan.
    const [shiftError, setShiftError] = useState<string | null>(null);
    // Dibump untuk memicu refetch shift data (saat tab kembali aktif / polling).
    const [refreshKey, setRefreshKey] = useState(0);

    // Zoom-to-fit untuk HP: lembar dirancang ~1010px, di-skala agar muat lebar layar
    // (tetap bisa pinch-zoom browser untuk lihat detail).
    const fitRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    useEffect(() => {
        const el = fitRef.current;
        if (!el) return;
        // Tidak pernah mengecil (min 1×) — di HP tampil full lebar (scroll + pinch-zoom),
        // dan membesar s/d 1.3× di monitor besar.
        const calc = () => setZoom(Math.max(1, Math.min(1.3, el.clientWidth / 1010)));
        calc();
        const ro = new ResizeObserver(calc);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const { report: daily, prevReport: dailyPrev, refetch: refetchDaily, error: dailyError, loading: dailyLoading } = useDailyReport(selectedDate);
    // Loading data shift (untuk animasi loading). True saat ganti tanggal / load awal,
    // false setelah fetch selesai. Tidak ikut polling background (lihat effect di bawah).
    const [shiftLoading, setShiftLoading] = useState(true);
    // Throttle refetch (focus/visibility/polling) supaya buka logbook tidak spam query
    // berat ke DB saat user sering alt-tab — minimal jeda antar-refresh.
    const lastRefreshRef = useRef(0);

    // Error gabungan (shift + harian) untuk banner. Manual retry tersedia di banner.
    const loadError = shiftError || dailyError;
    const retry = () => { setShiftError(null); setRefreshKey(k => k + 1); refetchDaily(); };

    useEffect(() => {
        if (!authLoading && !operator) router.push('/');
    }, [authLoading, operator, router]);

    // Buka tanggal dari query param ?date=YYYY-MM-DD (mis. dari link E-Logbook di WA)
    useEffect(() => {
        const p = new URLSearchParams(window.location.search).get('date');
        if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) setSelectedDate(p);
    }, []);

    // Fetch shift data untuk hari D dan D-1 (D-1 dibutuhkan untuk delta kolom malam)
    useEffect(() => {
        if (!selectedDate) return;
        const supabase = createClient();
        let stale = false;
        const prev = new Date(selectedDate + 'T00:00:00');
        prev.setDate(prev.getDate() - 1);
        const prevISO = toISO(prev);

        (async () => {
            const { data, error } = await supabase
                .from('shift_reports')
                .select(SHIFT_SELECT)
                .in('date', [prevISO, selectedDate]);
            if (stale) return;
            if (error) {
                // Pertahankan data terakhir yang sempat tampil; cukup tandai error.
                setShiftError(error.message);
                setShiftLoading(false);
                return;
            }
            setShiftError(null);
            const map: Record<string, Row> = {};
            (data ?? []).forEach((r: Row) => { map[`${r.date}|${r.shift}`] = r; });
            setShiftMap(map);
            setShiftLoading(false);
        })();
        return () => { stale = true; };
    }, [selectedDate, refreshKey]);

    // Reset loading saat ganti tanggal → animasi loading tampil untuk tanggal baru
    // (tidak di-reset oleh refreshKey/polling, supaya tak berkedip tiap refresh).
    useEffect(() => { setShiftLoading(true); }, [selectedDate]);

    // Auto-refresh: data logbook harus ikut terbaru saat ada input/laporan baru. Refetch
    // saat tab kembali aktif/fokus, plus polling ringan tiap 60 dtk selama tab terlihat —
    // supaya laporan shift/harian yang baru disubmit langsung muncul tanpa reload manual.
    useEffect(() => {
        const MIN_REFRESH_GAP = 30_000; // jeda minimal antar-refresh (lindungi DB dari spam query)
        const refresh = () => {
            const now = Date.now();
            if (now - lastRefreshRef.current < MIN_REFRESH_GAP) return;
            lastRefreshRef.current = now;
            setRefreshKey(k => k + 1); refetchDaily();
        };
        const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', onVisible);
        const id = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60_000);
        return () => {
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', onVisible);
            clearInterval(id);
        };
    }, [refetchDaily]);

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
        const dTankPrev = first(dailyPrev?.daily_report_stock_tank);
        const dPower = first(daily?.daily_report_power);

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
                steam: [dTurb?.[`press_steam_${low}`] ?? null, dTurb?.[`temp_steam_${low}`] ?? null],
                bfw: [dTurb?.[`bfw_press_${low}`] ?? null, dTurb?.[`temp_bfw_${low}`] ?? null],
                furn: [dTurb?.[`temp_furnace_${low}`] ?? null, dTurb?.[`temp_flue_gas_${low}`] ?? null],
                hotair: [dTurb?.[`air_heater_ti113_${low}`] ?? null, dTurb?.[`o2_${low}`] ?? null],
                // Catatan: di daily_report, kolom *_24 menyimpan pembacaan totaliser akhir
                // hari (FQ), sedangkan konsumsi 24-jam (Ton) ada di kolom selisih_*.
                totSteam: {
                    fq: dSteam?.[`prod_boiler_${low}_24`] ?? null,
                    ton: dSteam?.[`selisih_prod_boiler_${low}`] ?? null,
                    flow: dSteam?.[`prod_boiler_${low}_00`] ?? null,
                },
                // Total BFW 24h per-boiler = totaliser hari ini − kemarin (mirror produksi BFW
                // di form harian; jumlah A+B = bfw_total). prevReport sudah di-fetch hook → no extra query.
                totBfw: { fq: dTank?.[`bfw_boiler_${low}`] ?? null, ton: delta(dTank?.[`bfw_boiler_${low}`], dTankPrev?.[`bfw_boiler_${low}`]), flow: dTank?.[`flow_bfw_${low}`] ?? null },
                feeders: keys.map((k) => ({
                    fq: dCoal?.[`coal_${k}_24`] ?? null,
                    ton: dCoal?.[`selisih_coal_${k}`] ?? null,
                    flow: dCoal?.[`coal_${k}_00`] ?? null,
                })),
                totalBatubara: dCoal?.[`total_boiler_${low}_24`] ?? null,
                steamDrumPress: dTurb?.[`steam_drum_press_${low}`] ?? null,
                pa: dTurb?.[`primary_air_${low}`] ?? null,
                sa: dTurb?.[`secondary_air_${low}`] ?? null,
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
                silo: [esp?.silo_a ?? null, esp?.silo_b ?? null, formatUnloading(esp?.unloading_a, esp?.unloading_b)],
                solar: tank?.tk_solar_ab ?? null,
                demin: tank?.tk_demin ?? null,
                rcw: tank?.tk_rcw ?? null,
            };
        };

        // ── Bottom daily column (24.00) ──
        const bottomDailyCol = (): BottomCol => {
            // Loading Batubara 24.00 = total Malam + Pagi + Sore
            const loadSum = [0, 1, 2].reduce((s, i) => {
                const v = Number(first(shiftAtCol(i)?.shift_esp_handling)?.loading);
                return s + (isFinite(v) ? v : 0);
            }, 0);
            // Conveyor / Hopper 24.00 = ikut shift Sore
            const espSore = first(shiftAtCol(2)?.shift_esp_handling);
            return {
                loading: loadSum || null,
                conveyor: espSore?.conveyor ?? null,
                hopper: espSore?.hopper ?? null,
                bunkerABC: [dTank?.bunker_a ?? null, dTank?.bunker_b ?? null, dTank?.bunker_c ?? null],
                bunkerDEF: [dTank?.bunker_d ?? null, dTank?.bunker_e ?? null, dTank?.bunker_f ?? null],
                trafoA: [dTank?.trafo_a1 ?? null, dTank?.trafo_a2 ?? null, dTank?.trafo_a3 ?? null],
                trafoB: [dTank?.trafo_b1 ?? null, dTank?.trafo_b2 ?? null, dTank?.trafo_b3 ?? null],
                silo: [dTank?.silo_a_pct ?? null, dTank?.silo_b_pct ?? null, formatUnloading(dTank?.unloading_fly_ash_a, dTank?.unloading_fly_ash_b)],
                // Tankyard: hanya level, tanpa total
                solar: dTank?.solar_tank_total ?? null,
                demin: dTank?.demin_level_00 ?? null,
                rcw: dTank?.rcw_level_00 ?? null,
            };
        };

        // ── Chemical Dosing shift column (i = 0..2) ──
        const emptyChemRow = { level: null, stroke: null, air: null, chem: null };
        const chemShiftCol = (i: number): ChemCol => {
            const wq = first(shiftAtCol(i)?.shift_water_quality);
            const mk = (p: string) => ({
                level: wq?.[`${p}_level_tanki`] ?? null,
                stroke: wq?.[`${p}_stroke_pompa`] ?? null,
                air: wq?.[`${p}_penambahan_air`] ?? null,
                chem: wq?.[`${p}_penambahan_chemical`] ?? null,
            });
            return { phosA: mk('phosphate'), phosB: mk('phosphate_b'), amine: mk('amine'), hydrazine: mk('hydrazine') };
        };
        // Chemical Dosing tidak ada di laporan harian → kolom 24.00 kosong
        const chemEmptyCol = (): ChemCol => ({ phosA: emptyChemRow, phosB: emptyChemRow, amine: emptyChemRow, hydrazine: emptyChemRow });
        // Stock chemical (jam 24.00) — ambil dari shift terbaru yang terisi (sore → pagi → malam)
        const pickStock = (k: string) => {
            const wqSore = first(shiftAtCol(2)?.shift_water_quality);
            const wqPagi = first(shiftAtCol(1)?.shift_water_quality);
            const wqMalam = first(shiftAtCol(0)?.shift_water_quality);
            return wqSore?.[k] ?? wqPagi?.[k] ?? wqMalam?.[k] ?? null;
        };

        // ── Turbin shift column (i = 0..2) ──
        const turbinShiftCol = (i: number): TurbinCol => {
            const row = shiftAtCol(i);
            const prevRow = prevAtCol(i);
            const t = first(row?.shift_turbin);
            const pt = first(prevRow?.shift_turbin);
            const sd = first(row?.shift_steam_dist);
            const psd = first(prevRow?.shift_steam_dist);
            return {
                steamTurbin: { fq: t?.totalizer_steam_inlet ?? null, ton: delta(t?.totalizer_steam_inlet, pt?.totalizer_steam_inlet), flow: t?.flow_steam ?? null },
                mpsPb1: { fq: sd?.pabrik1_totalizer ?? null, ton: delta(sd?.pabrik1_totalizer, psd?.pabrik1_totalizer), flow: sd?.pabrik1_flow ?? null },
                lpsPb2: { fq: sd?.pabrik2_totalizer ?? null, ton: delta(sd?.pabrik2_totalizer, psd?.pabrik2_totalizer), flow: sd?.pabrik2_flow ?? null },
                // "Pabrik 3" di tab Distribusi Steam = pabrik3a → dipetakan ke MPS ke PB-3.
                // LPS ke PB-3 tidak punya sumber shift (hanya ada di harian) → kosong.
                lpsPb3: { fq: null, ton: null, flow: null },
                mpsPb3: { fq: sd?.pabrik3a_totalizer ?? null, ton: delta(sd?.pabrik3a_totalizer, psd?.pabrik3a_totalizer), flow: sd?.pabrik3a_flow ?? null },
                mpsRevamp: { fq: null, ton: null, flow: null },
                steamCond: { fq: t?.totalizer_condensate ?? null, ton: delta(t?.totalizer_condensate, pt?.totalizer_condensate), flow: t?.flow_cond ?? null },
                hpo: t?.hpo_durasi ?? null,
            };
        };
        // ── Turbin daily column (24.00) ──
        const turbinDailyCol = (): TurbinCol => {
            const dd = (k: string) => ({ fq: dSteam?.[`${k}_24`] ?? null, ton: dSteam?.[`selisih_${k}`] ?? null, flow: dSteam?.[`${k}_00`] ?? null });
            return {
                steamTurbin: dd('inlet_turbine'),
                mpsPb1: dd('mps_i'),
                lpsPb2: dd('lps_ii'),
                lpsPb3: dd('lps_3a'),
                mpsPb3: dd('mps_3a'),
                mpsRevamp: { fq: null, ton: null, flow: null },
                steamCond: dd('fully_condens'),
                hpo: null,
            };
        };

        // ── Generator shift column (i = 0..2) ──
        const generatorShiftCol = (i: number): GenCol => {
            const row = shiftAtCol(i);
            const prevRow = prevAtCol(i);
            const g = first(row?.shift_generator_gi);
            const pd = first(row?.shift_power_dist);
            const ppd = first(prevRow?.shift_power_dist);
            const distTot = (k: string, mwKey: string) => ({
                fq: pd?.[`power_${k}_totalizer`] ?? null,
                ton: delta(pd?.[`power_${k}_totalizer`], ppd?.[`power_${k}_totalizer`]),
                flow: pd?.[mwKey] ?? null,
            });
            return {
                busBar1: distTot('ubb', 'power_ubb'),
                busBar2: { fq: null, ton: null, flow: null },
                pabrik2: distTot('pabrik2', 'power_pabrik2'),
                pabrik3: distTot('pabrik3a', 'power_pabrik3a'),
                pja: { fq: null, ton: null, flow: null },
                revamping: distTot('revamping', 'power_revamping'),
                piu: distTot('pie', 'power_pie'),
                genOut: { fq: pd?.power_stg_ubb_totalizer ?? null, ton: delta(pd?.power_stg_ubb_totalizer, ppd?.power_stg_ubb_totalizer), flow: g?.gen_load ?? null },
                current: g?.gen_ampere ?? null,
                voltage: g?.gen_tegangan ?? null,
                q: g?.gen_amp_react ?? null,
                pf: g?.gen_cos_phi ?? null,
                sumP: g?.gi_sum_p ?? null,
                sumQ: g?.gi_sum_q ?? null,
                cosO: g?.gi_cos_phi ?? null,
                pMwh: null,
                qMvarh: null,
                delivered: null,
                received: null,
                dr: null,
            };
        };
        // ── Generator daily column (24.00) ──
        // Form Power harian menyimpan ke kolom yang SAMA dengan shift
        // (power_*_totalizer / power_* / selisih_*), BUKAN kolom legacy *_24/*_00.
        // fq = totalizer, ton = selisih (MWh), flow = MW (Act).
        const generatorDailyCol = (): GenCol => {
            const dist = (k: string, mwKey: string, sel: string) => ({
                fq: dPower?.[`power_${k}_totalizer`] ?? null,
                ton: dPower?.[sel] ?? null,
                flow: dPower?.[mwKey] ?? null,
            });
            return {
                busBar1: dist('ubb', 'power_ubb', 'selisih_ubb'),
                busBar2: { fq: null, ton: null, flow: null },
                pabrik2: dist('pabrik2', 'power_pabrik2', 'selisih_pabrik2'),
                pabrik3: dist('pabrik3a', 'power_pabrik3a', 'selisih_pabrik3a'),
                pja: { fq: null, ton: null, flow: null },
                revamping: dist('revamping', 'power_revamping', 'selisih_revamping'),
                piu: dist('pie', 'power_pie', 'selisih_pie'),
                // STG UBB: totalizer + selisih, MW (Act) = Load STG (gen_00).
                genOut: { fq: dPower?.power_stg_ubb_totalizer ?? null, ton: dPower?.selisih_stg_ubb ?? null, flow: dPower?.gen_00 ?? null },
                // Output generator (Current/Voltage/Q/PF) tersimpan di daily_report_turbine_misc.
                current: dTurb?.gen_ampere ?? null,
                voltage: dTurb?.gen_tegangan ?? null,
                q: dTurb?.gen_amp_react ?? null,
                pf: dTurb?.gen_cos_phi ?? null,
                // Power GI - PKG (Σ P / Σ Q / Cos Ø) tersimpan di daily_report_turbine_misc.
                sumP: dTurb?.gi_sum_p ?? null,
                sumQ: dTurb?.gi_sum_q ?? null,
                cosO: dTurb?.gi_cos_phi ?? null,
                pMwh: null,
                qMvarh: null,
                delivered: dTurb?.totalizer_import ?? null,
                received: dTurb?.totalizer_export ?? null,
                dr: dTurb?.pie_dr ?? null,
            };
        };

        return {
            boilerA: [boilerShiftCol(0, 'A'), boilerShiftCol(1, 'A'), boilerShiftCol(2, 'A'), boilerDailyCol('A')],
            boilerB: [boilerShiftCol(0, 'B'), boilerShiftCol(1, 'B'), boilerShiftCol(2, 'B'), boilerDailyCol('B')],
            bottom: [bottomShiftCol(0), bottomShiftCol(1), bottomShiftCol(2), bottomDailyCol()],
            chemical: [chemShiftCol(0), chemShiftCol(1), chemShiftCol(2), chemEmptyCol()],
            chemicalStock: { phosphate: pickStock('stock_phosphate'), amine: pickStock('stock_amine'), hydrazine: pickStock('stock_hydrazine') },
            turbin: [turbinShiftCol(0), turbinShiftCol(1), turbinShiftCol(2), turbinDailyCol()],
            generator: [generatorShiftCol(0), generatorShiftCol(1), generatorShiftCol(2), generatorDailyCol()],
        };
    }, [shiftMap, daily, dailyPrev, selectedDate]);

    if (authLoading || !operator) return null;

    // Animasi loading: tampil saat load awal / ganti tanggal. `&& !daily` mencegah
    // overlay berkedip saat refetch polling (data lama masih ada selama fetch).
    const dataLoading = shiftLoading || (dailyLoading && !daily);

    const dateObj = new Date(selectedDate + 'T00:00:00');
    const hariStr = HARI_ID[dateObj.getDay()];
    const formatDate = (d: string) => new Date(d + 'T00:00:00+07:00').toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto">
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
                        const dayShort = d.toLocaleDateString('id-ID', { weekday: 'short' });
                        return (
                            <button key={iso} onClick={() => setSelectedDate(iso)}
                                title={isToday ? 'Hari ini' : undefined}
                                className={`relative flex flex-col items-center w-10 py-1 rounded-lg cursor-pointer transition-all
                                    ${isActive ? 'bg-primary text-white shadow-[0_0_12px_rgba(43,124,238,0.35)]'
                                        : isToday ? 'text-primary ring-1 ring-primary/50 hover:bg-surface-highlight'
                                            : 'text-text-secondary hover:text-white hover:bg-surface-highlight'}`}>
                                <span className="text-[9px] font-semibold uppercase leading-none">{dayShort}</span>
                                <span className={`text-sm font-bold leading-tight ${isActive ? 'text-white' : ''}`}>{d.getDate()}</span>
                                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${isToday ? (isActive ? 'bg-white' : 'bg-primary') : 'bg-transparent'}`} />
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

            {/* Banner error muat data (tidak ikut print) */}
            {loadError && (
                <div className="lb-no-print mt-3 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
                    <span className="material-symbols-outlined text-red-400">error</span>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-red-200">Gagal memuat data logbook</p>
                        <p className="text-red-300/80 text-xs mt-0.5 break-words">
                            Data yang tampil mungkin tidak lengkap atau belum diperbarui. ({loadError})
                        </p>
                    </div>
                    <button onClick={retry}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer">
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        Coba lagi
                    </button>
                </div>
            )}

            {/* Lembar buku — zoom-to-fit di layar kecil */}
            <div ref={fitRef} className="relative overflow-x-auto">
                {/* Animasi loading data (load awal / ganti tanggal; tidak saat polling) */}
                {dataLoading && (
                    <div className="lb-no-print absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0b1220]/70 backdrop-blur-sm rounded-lg min-h-[300px]">
                        <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin shadow-[0_0_12px_rgba(43,124,238,0.3)]"></div>
                        <div className="text-center">
                            <h3 className="text-white font-bold text-base mb-1">Memuat data logbook</h3>
                            <p className="text-slate-400 text-sm">Mengambil laporan {formatDate(selectedDate)}...</p>
                        </div>
                    </div>
                )}
                <div className="lb-fit" style={{ zoom }}>
                    <LogbookSheet data={data} tanggal={`${hariStr}, ${formatDate(selectedDate)}`} />
                </div>
            </div>
        </div>
    );
}
