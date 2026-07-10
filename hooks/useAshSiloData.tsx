'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShiftType } from '@/lib/supabase/types';
import { SiloId } from '@/lib/ash-silo';

function isSupabaseConfigured(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return !!url && !url.includes('YOUR_PROJECT_ID');
}

export interface SiloLevelInfo {
    pct: number;            // 0 adalah nilai valid — null berarti belum ada data
    reportDate: string;     // shift_reports.date
    reportShift: ShiftType;
}

export interface SiloTrendPoint {
    ts: number;   // epoch ms — akhir shift (konvensi ENDING)
    pct: number;
}

export interface AshUnloadingEntry {
    id: string;
    date: string;
    shift: string;
    silo: SiloId;
    perusahaan: string;
    tujuan: string;
    ritase: number;
}

interface AshData {
    siloLevels: Record<SiloId, SiloLevelInfo | null>;
    unloadings: AshUnloadingEntry[];
}

const SAFETY_POLL_MS = 5 * 60 * 1000;
const MIN_REFETCH_GAP_MS = 60 * 1000;
// Layout mobile & desktop tank-level dua-duanya mounted (beda CSS saja),
// jadi hook ini bisa hidup di 2 instance sekaligus — fetch di-dedup lewat
// cache module-level supaya tetap satu round-trip ke Supabase.
const DEDUP_WINDOW_MS = 15 * 1000;

// Konvensi ENDING: dalam satu tanggal DB, shift malam berakhir 07:00, pagi
// 15:00, sore 23:00 — jadi urutan kronologis dalam satu tanggal adalah
// malam < pagi < sore (BUKAN urutan enum DB pagi<sore<malam).
const SHIFT_RANK: Record<ShiftType, number> = { malam: 0, pagi: 1, sore: 2 };

interface EspRow {
    silo_a: number | null;
    silo_b: number | null;
    created_at: string;
    shift_reports: { date: string; shift: ShiftType };
}

async function queryAshData(): Promise<AshData> {
    const supabase = createClient();
    const [levelRes, unloadRes] = await Promise.all([
        supabase
            .from('shift_esp_handling')
            .select('silo_a, silo_b, created_at, shift_reports!inner(date, shift)')
            .or('silo_a.not.is.null,silo_b.not.is.null')
            .order('created_at', { ascending: false })
            .limit(12),
        supabase
            .from('ash_unloadings')
            .select('id, date, shift, silo, perusahaan, tujuan, ritase')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(40),
    ]);

    if (levelRes.error) throw levelRes.error;
    if (unloadRes.error) throw unloadRes.error;

    const rows = (levelRes.data ?? []) as unknown as EspRow[];
    // "Terbaru" ditentukan client-side: tanggal desc → rank shift (ENDING)
    // desc → created_at desc. created_at saja salah untuk laporan backfill;
    // urutan enum shift di DB tidak kronologis.
    rows.sort((a, b) =>
        b.shift_reports.date.localeCompare(a.shift_reports.date)
        || SHIFT_RANK[b.shift_reports.shift] - SHIFT_RANK[a.shift_reports.shift]
        || b.created_at.localeCompare(a.created_at));

    const pick = (col: 'silo_a' | 'silo_b'): SiloLevelInfo | null => {
        const row = rows.find(r => r[col] !== null);
        return row ? {
            pct: Number(row[col]),
            reportDate: row.shift_reports.date,
            reportShift: row.shift_reports.shift,
        } : null;
    };

    return {
        siloLevels: { A: pick('silo_a'), B: pick('silo_b') },
        unloadings: (unloadRes.data ?? []).map(d => ({
            id: d.id,
            date: d.date,
            shift: d.shift,
            silo: (d.silo === 'B' ? 'B' : 'A') as SiloId,
            perusahaan: d.perusahaan,
            tujuan: d.tujuan,
            ritase: Number(d.ritase),
        })),
    };
}

// Jam akhir tiap shift pada tanggal DB (konvensi ENDING): malam berakhir
// 07:00, pagi 15:00, sore 23:00 — dipakai sebagai posisi waktu titik trend.
const SHIFT_END_HOUR: Record<ShiftType, number> = { malam: 7, pagi: 15, sore: 23 };

async function queryTrendHistory(): Promise<Record<SiloId, SiloTrendPoint[]>> {
    const supabase = createClient();
    const res = await supabase
        .from('shift_esp_handling')
        .select('silo_a, silo_b, created_at, shift_reports!inner(date, shift)')
        .or('silo_a.not.is.null,silo_b.not.is.null')
        .order('created_at', { ascending: false })
        .limit(400);
    if (res.error) throw res.error;

    const rows = (res.data ?? []) as unknown as EspRow[];
    const toTs = (r: EspRow) => new Date(
        `${r.shift_reports.date}T${String(SHIFT_END_HOUR[r.shift_reports.shift]).padStart(2, '0')}:00:00`
    ).getTime();
    const build = (col: 'silo_a' | 'silo_b'): SiloTrendPoint[] => rows
        .filter(r => r[col] !== null)
        .map(r => ({ ts: toTs(r), pct: Number(r[col]) }))
        .sort((a, b) => a.ts - b.ts);

    return { A: build('silo_a'), B: build('silo_b') };
}

let cachedData: AshData | null = null;
let inflight: Promise<AshData> | null = null;
let lastFetchAt = 0;

// History trend di-fetch lazy saat modal trend dibuka (hemat egress),
// cache module-level dengan pola dedup yang sama seperti data utama.
let cachedTrend: Record<SiloId, SiloTrendPoint[]> | null = null;
let trendInflight: Promise<Record<SiloId, SiloTrendPoint[]>> | null = null;
let trendFetchAt = 0;
const TREND_STALE_MS = 5 * 60 * 1000;

function sharedFetch(): Promise<AshData> {
    if (inflight) return inflight;
    if (cachedData && Date.now() - lastFetchAt < DEDUP_WINDOW_MS) return Promise.resolve(cachedData);
    inflight = queryAshData()
        .then(d => { cachedData = d; lastFetchAt = Date.now(); return d; })
        .finally(() => { inflight = null; });
    return inflight;
}

// Data monitor ash silo: level dari laporan shift ESP + unloading fly ash.
// Sengaja TANPA realtime channel — publication supabase_realtime dibatasi
// 4 tabel tank/solar (insiden 522 Jun 2026); cukup poll ringan.
export function useAshSiloData() {
    const [siloLevels, setSiloLevels] = useState<Record<SiloId, SiloLevelInfo | null>>(
        cachedData?.siloLevels ?? { A: null, B: null });
    const [unloadings, setUnloadings] = useState<AshUnloadingEntry[]>(cachedData?.unloadings ?? []);
    const [trendData, setTrendData] = useState<Record<SiloId, SiloTrendPoint[]>>(
        cachedTrend ?? { A: [], B: [] });
    const [loading, setLoading] = useState(!cachedData);
    const [error, setError] = useState<string | null>(null);

    const loadHistory = useCallback(async () => {
        if (!isSupabaseConfigured()) return;
        try {
            if (!cachedTrend || Date.now() - trendFetchAt >= TREND_STALE_MS) {
                if (!trendInflight) {
                    trendInflight = queryTrendHistory()
                        .then(d => { cachedTrend = d; trendFetchAt = Date.now(); return d; })
                        .finally(() => { trendInflight = null; });
                }
                await trendInflight;
            }
            if (cachedTrend) setTrendData(cachedTrend);
        } catch (e) {
            console.warn('[useAshSiloData] fetch history trend gagal', e);
        }
    }, []);

    const fetchAll = useCallback(async () => {
        if (!isSupabaseConfigured()) { setLoading(false); return; }
        try {
            const data = await sharedFetch();
            setSiloLevels(data.siloLevels);
            setUnloadings(data.unloadings);
            setError(null);
        } catch (e) {
            console.warn('[useAshSiloData] fetch gagal', e);
            setError('Gagal memuat data ash silo');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();

        const interval = setInterval(fetchAll, SAFETY_POLL_MS);

        // Refetch saat tab kembali visible / jaringan reconnect, di-throttle
        // supaya pindah-pindah tab tidak banjir refetch (pola useTankData).
        const refreshIfStale = () => {
            if (Date.now() - lastFetchAt >= MIN_REFETCH_GAP_MS) fetchAll();
        };
        const handleVisibility = () => { if (!document.hidden) refreshIfStale(); };
        const handleOnline = () => refreshIfStale();
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
        };
    }, [fetchAll]);

    return { siloLevels, unloadings, trendData, loadHistory, loading, error, refetch: fetchAll };
}
