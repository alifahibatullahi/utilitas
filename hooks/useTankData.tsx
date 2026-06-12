'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { TankId, TANK_IDS, TANKS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import type { SolarUnloadingRow, SolarUsageRow, TankLevelRow, TankFlowReadingRow } from '@/lib/supabase/types';

// Flow rate per source (ton/h)
export interface FlowRate {
    sourceLabel: string;
    rate: number; // ton/h
}

// Output flow rate (with optional pump for Demin Revamp)
export interface OutputFlowRate {
    destinationLabel: string;
    rate: number;       // ton/h
    pump?: string;      // e.g. 'P-1000A', 'P-1000B', 'Demin B'
}

export interface SolarUnloading {
    id?: string;        // Supabase UUID (tersedia setelah fetch dari DB)
    date: string;       // ISO date string (tanggal unloading)
    liters: number;     // jumlah liter
    supplier: string;   // perusahaan pengirim
}

export interface SolarUsage {
    id?: string;
    date: string;
    liters: number;
    tujuan: string;
}

export interface TankLevel {
    tankId: TankId;
    level: number;
    operator: string;
    timestamp: string;
    note?: string;
    trend?: 'naik' | 'turun' | 'tetap';
}

export interface TankLevelHistory {
    id: number;
    tankId: TankId;
    level: number;
    operator: string;
    timestamp: string;
    note?: string;
}

interface TankDataContextType {
    currentLevels: Record<TankId, TankLevel>;
    history: TankLevelHistory[];
    trendData: Record<TankId, { time: string; timestamp: string; level: number }[]>;
    flowRates: Record<TankId, FlowRate[]>;
    outputFlowRates: Record<TankId, OutputFlowRate[]>;
    solarUnloadings: SolarUnloading[];
    solarUsages: SolarUsage[];
    /** ISO timestamp kapan pompa Demin Revamp mulai aktif (null = mati) */
    pumpActiveSince: string | null;
    /** Fetch history level on-demand (modal trend / halaman detail). Hasil di-cache
     *  sebentar; pemanggilan berulang dalam waktu dekat tidak memicu fetch ulang. */
    loadHistory: () => Promise<void>;
    submitLevel: (tankId: TankId, level: number, levelM3: number, operator: string, note?: string, trend?: string) => void;
    submitFlowRates: (tankId: TankId, rates: FlowRate[], operatorName?: string) => void;
    submitOutputFlowRates: (tankId: TankId, rates: OutputFlowRate[], operatorName?: string) => void;
    submitSolarUnloading: (entry: SolarUnloading) => void;
    deleteSolarUnloading: (id: string) => Promise<void>;
    updateSolarUnloading: (id: string, updates: Pick<SolarUnloading, 'date' | 'liters' | 'supplier'>) => Promise<void>;
    submitSolarUsage: (entry: SolarUsage) => void;
    deleteSolarUsage: (id: string) => Promise<void>;
    updateSolarUsage: (id: string, updates: Pick<SolarUsage, 'date' | 'liters' | 'tujuan'>) => Promise<void>;
}

// Initial empty state
const emptyLevels: Record<TankId, TankLevel> = {
    DEMIN: { tankId: 'DEMIN', level: 0, operator: '-', timestamp: new Date().toISOString() },
    RCW: { tankId: 'RCW', level: 0, operator: '-', timestamp: new Date().toISOString() },
    SOLAR: { tankId: 'SOLAR', level: 0, operator: '-', timestamp: new Date().toISOString() },
};

const emptyFlowRates: Record<TankId, FlowRate[]> = { DEMIN: [], RCW: [], SOLAR: [] };
const emptyOutputFlowRates: Record<TankId, OutputFlowRate[]> = { DEMIN: [], RCW: [], SOLAR: [] };

function isSupabaseConfigured(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return !!url && !url.includes('YOUR_PROJECT_ID');
}

// Kolom eksplisit (bukan '*') untuk menekan egress Supabase
const TANK_LEVEL_COLS = 'tank_id, level_pct, operator_name, note, trend, created_at';
const TANK_LEVEL_HISTORY_COLS = 'tank_id, level_pct, operator_name, note, created_at';
const FLOW_READING_COLS = 'tank_id, direction, label, rate, pump, created_at';
const SOLAR_UNLOADING_COLS = 'id, date, liters, supplier';
const SOLAR_USAGE_COLS = 'id, date, liters, tujuan';

// Polling hanya safety-net kalau websocket realtime drop — update utama lewat
// channel realtime di bawah, jadi interval panjang tidak mengurangi kecepatan UI.
const SAFETY_POLL_MS = 5 * 60 * 1000;
// Throttle refetch dari event visibility/online supaya gonta-ganti tab tidak
// memicu full refetch terus-menerus.
const MIN_REFETCH_GAP_MS = 60 * 1000;

/** Dari history pompa Demin Revamp (desc), hitung kapan pompa aktif mulai */
function calcPumpActiveSince(rows: TankFlowReadingRow[]): string | null {
    if (!rows.length) return null;
    const currentPump = rows[0].pump;
    if (!currentPump) return null;
    // Jalan mundur — cari batas terakhir berturut-turut dengan pompa yang sama
    let since = rows[0].created_at;
    for (const row of rows) {
        if (row.pump === currentPump) {
            since = row.created_at;
        } else {
            break;
        }
    }
    return since;
}

const TankDataContext = createContext<TankDataContextType | null>(null);

export function TankDataProvider({ children }: { children: ReactNode }) {
    const [currentLevels, setCurrentLevels] = useState(emptyLevels);
    const [history, setHistory] = useState<TankLevelHistory[]>([]);
    const [flowRates, setFlowRates] = useState(emptyFlowRates);
    const [outputFlowRates, setOutputFlowRates] = useState(emptyOutputFlowRates);
    const [solarUnloadings, setSolarUnloadings] = useState<SolarUnloading[]>([]);
    const [solarUsages, setSolarUsages] = useState<SolarUsage[]>([]);
    const [pumpActiveSince, setPumpActiveSince] = useState<string | null>(null);
    const [trendData, setTrendData] = useState<Record<TankId, { time: string; timestamp: string; level: number }[]>>({
        DEMIN: [], RCW: [], SOLAR: [],
    });

    // Build trend data from history (full history; chart-side filters by range)
    const buildTrendData = useCallback((historyItems: TankLevelHistory[]) => {
        const result: Record<TankId, { time: string; timestamp: string; level: number }[]> = { DEMIN: [], RCW: [], SOLAR: [] };
        TANK_IDS.forEach(tankId => {
            const tankHistory = historyItems
                .filter(h => h.tankId === tankId)
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            result[tankId] = tankHistory.map(h => ({
                time: new Date(h.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                timestamp: h.timestamp,
                level: h.level,
            }));
        });
        return result;
    }, []);

    // Apply flow reading rows to state
    const applyFlowReadings = useCallback((rows: TankFlowReadingRow[]) => {
        const newFlowRates: Record<TankId, FlowRate[]> = { DEMIN: [], RCW: [], SOLAR: [] };
        const newOutputFlowRates: Record<TankId, OutputFlowRate[]> = { DEMIN: [], RCW: [], SOLAR: [] };

        // Group by tank + direction + label, take latest per group
        const latestByKey = new Map<string, TankFlowReadingRow>();
        for (const row of rows) {
            const key = `${row.tank_id}|${row.direction}|${row.label}`;
            if (!latestByKey.has(key)) latestByKey.set(key, row); // rows already sorted desc
        }

        for (const row of latestByKey.values()) {
            const tankId = row.tank_id as TankId;
            if (row.direction === 'in') {
                newFlowRates[tankId].push({ sourceLabel: row.label, rate: Number(row.rate) });
            } else {
                newOutputFlowRates[tankId].push({
                    destinationLabel: row.label,
                    rate: Number(row.rate),
                    pump: row.pump ?? undefined,
                });
            }
        }

        setFlowRates(newFlowRates);
        setOutputFlowRates(newOutputFlowRates);
    }, []);

    // History level (sampai 500 baris) hanya di-fetch on-demand — saat modal
    // trend / halaman detail tank dibuka — tidak ikut polling berkala. Setelah
    // dimuat, realtime INSERT tetap menambah history sehingga chart ikut update.
    const lastHistoryLoadAt = useRef(0);
    const loadHistory = useCallback(async () => {
        if (!isSupabaseConfigured()) return;
        if (Date.now() - lastHistoryLoadAt.current < SAFETY_POLL_MS) return;
        lastHistoryLoadAt.current = Date.now();

        const supabase = createClient();
        const { data, error } = await supabase
            .from('tank_levels')
            .select(TANK_LEVEL_HISTORY_COLS)
            .order('created_at', { ascending: false })
            .limit(500);

        if (error || !data) {
            lastHistoryLoadAt.current = 0; // gagal — boleh langsung dicoba lagi
            return;
        }

        const rows = data as unknown as TankLevelRow[];
        const historyItems: TankLevelHistory[] = rows.map((r, idx) => ({
            id: idx + 1,
            tankId: r.tank_id as TankId,
            level: Number(r.level_pct),
            operator: r.operator_name,
            timestamp: r.created_at,
            note: r.note || undefined,
        }));
        setHistory(historyItems);
        setTrendData(buildTrendData(historyItems));
    }, [buildTrendData]);

    // Fetch from Supabase on mount
    useEffect(() => {
        if (!isSupabaseConfigured()) return;

        const supabase = createClient();

        // Level terkini: cukup 1 baris terakhir per tank, bukan 500 baris history
        const fetchCurrentLevels = async () => {
            await Promise.all(TANK_IDS.map(async tankId => {
                const { data } = await supabase
                    .from('tank_levels')
                    .select(TANK_LEVEL_COLS)
                    .eq('tank_id', tankId)
                    .order('created_at', { ascending: false })
                    .limit(1);

                const latest = (data?.[0] ?? null) as TankLevelRow | null;
                if (!latest) return;

                // Trend opsional di form input — kalau baris terakhir tidak
                // menyertakan trend, pakai trend terakhir yang pernah diisi
                // supaya indikator naik/turun/stabil tidak hilang dari tampilan.
                let trend = latest.trend ?? null;
                if (!trend) {
                    const { data: prevTrend } = await supabase
                        .from('tank_levels')
                        .select('trend')
                        .eq('tank_id', tankId)
                        .not('trend', 'is', null)
                        .order('created_at', { ascending: false })
                        .limit(1);
                    trend = (prevTrend?.[0] as { trend?: string } | undefined)?.trend ?? null;
                }

                setCurrentLevels(prev => ({
                    ...prev,
                    [tankId]: {
                        tankId,
                        level: Number(latest.level_pct),
                        operator: latest.operator_name,
                        timestamp: latest.created_at,
                        note: latest.note || undefined,
                        trend: trend as 'naik' | 'turun' | 'tetap' || undefined,
                    },
                }));
            }));
        };

        // Fallback: shift_tankyard jika tank_levels kosong
        const fetchShiftTankyard = async () => {
            const { data } = await supabase
                .from('shift_tankyard')
                .select('tk_rcw, tk_rcw_trend, tk_demin, tk_demin_trend, tk_solar_ab, created_at, shift_reports!inner(date)')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data) {
                const row = data as unknown as {
                    tk_rcw: number | null;
                    tk_rcw_trend: string | null;
                    tk_demin: number | null;
                    tk_demin_trend: string | null;
                    tk_solar_ab: number | null;
                    created_at: string;
                };
                const timestamp = row.created_at;
                setCurrentLevels(prev => {
                    const updated = { ...prev };
                    
                    if (row.tk_demin_trend) {
                        updated.DEMIN = { ...updated.DEMIN, trend: row.tk_demin_trend as 'naik'|'turun'|'tetap' };
                    }
                    if (prev.DEMIN.operator === '-' && row.tk_demin != null) {
                        updated.DEMIN = { ...updated.DEMIN, tankId: 'DEMIN', level: Number(row.tk_demin), operator: 'Shift Report', timestamp };
                    }
                    
                    if (row.tk_rcw_trend) {
                        updated.RCW = { ...updated.RCW, trend: row.tk_rcw_trend as 'naik'|'turun'|'tetap' };
                    }
                    if (prev.RCW.operator === '-' && row.tk_rcw != null) {
                        updated.RCW = { ...updated.RCW, tankId: 'RCW', level: Number(row.tk_rcw), operator: 'Shift Report', timestamp };
                    }
                    
                    if (prev.SOLAR.operator === '-' && row.tk_solar_ab != null) {
                        updated.SOLAR = { ...updated.SOLAR, tankId: 'SOLAR', level: Number(row.tk_solar_ab), operator: 'Shift Report', timestamp };
                    }
                    
                    return updated;
                });
            }
        };

        // Pompa Demin Revamp terakhir yang diketahui — dipakai handler realtime
        // INSERT untuk deteksi pergantian pompa tanpa re-fetch history.
        let lastDeminPump: string | null = null;

        // Fetch flow readings (ambil 200 terakhir untuk tiap tank+direction)
        const fetchFlowReadings = async () => {
            const { data } = await supabase
                .from('tank_flow_readings')
                .select(FLOW_READING_COLS)
                .order('created_at', { ascending: false })
                .limit(200);

            if (data && data.length > 0) {
                const rows = data as unknown as TankFlowReadingRow[];
                applyFlowReadings(rows);

                // Hitung pumpActiveSince dari history Demin Revamp
                const deminRevampHistory = rows.filter(
                    r => r.tank_id === 'DEMIN' && r.direction === 'out' && r.label === 'Demin Revamp'
                );
                lastDeminPump = deminRevampHistory[0]?.pump ?? null;
                setPumpActiveSince(calcPumpActiveSince(deminRevampHistory));
            }
        };

        // Fetch solar unloadings
        const fetchSolar = async () => {
            const { data } = await supabase
                .from('solar_unloadings')
                .select(SOLAR_UNLOADING_COLS)
                .order('date', { ascending: false })
                .limit(10);

            if (data && data.length > 0) {
                const rows = data as unknown as SolarUnloadingRow[];
                setSolarUnloadings(rows.map(d => ({
                    id: d.id,
                    date: d.date,
                    liters: Number(d.liters),
                    supplier: d.supplier,
                })));
            }

            const { data: usages } = await supabase
                .from('solar_usages')
                .select(SOLAR_USAGE_COLS)
                .order('date', { ascending: false })
                .limit(10);
            
            if (usages && usages.length > 0) {
                const rows = usages as unknown as SolarUsageRow[];
                setSolarUsages(rows.map(d => ({
                    id: d.id,
                    date: d.date,
                    liters: Number(d.liters),
                    tujuan: d.tujuan,
                })));
            }
        };

        let lastRefreshAt = 0;

        const refreshAll = () => {
            lastRefreshAt = Date.now();
            fetchCurrentLevels().then(() => fetchShiftTankyard());
            fetchFlowReadings();
            fetchSolar();
        };

        refreshAll();

        // Safety-net polling — jaga-jaga kalau websocket realtime drop.
        const autoRefreshInterval = setInterval(refreshAll, SAFETY_POLL_MS);

        // Refetch saat tab kembali visible atau jaringan reconnect.
        // Menangani kasus WS drop saat device sleep / network blip — tanpa
        // ini, display harus di-refresh manual setelah idle lama.
        // Di-throttle supaya pindah-pindah tab tidak banjir full refetch.
        const refreshIfStale = () => {
            if (Date.now() - lastRefreshAt >= MIN_REFETCH_GAP_MS) refreshAll();
        };
        const handleVisibility = () => { if (!document.hidden) refreshIfStale(); };
        const handleOnline = () => refreshIfStale();
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);

        const onSubStatus = (channelName: string) => (status: string, err?: Error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                console.warn(`[useTankData] channel ${channelName} status=${status}`, err);
            }
        };

        // Realtime: tank_levels
        const levelChannel = supabase
            .channel('tank_levels_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tank_levels' }, (payload) => {
                const row = payload.new as TankLevelRow;
                const tankId = row.tank_id as TankId;
                const newLevel: TankLevel = {
                    tankId,
                    level: Number(row.level_pct),
                    operator: row.operator_name,
                    timestamp: row.created_at,
                    note: row.note || undefined,
                    trend: row.trend as 'naik' | 'turun' | 'tetap' || undefined,
                };
                setCurrentLevels(prev => ({
                    ...prev,
                    // Input tanpa trend tidak menghapus trend yang sedang tampil
                    [tankId]: { ...newLevel, trend: newLevel.trend ?? prev[tankId]?.trend },
                }));
                setHistory(prev => {
                    const newHistory = [{ id: prev.length + 1, ...newLevel }, ...prev];
                    setTrendData(buildTrendData(newHistory));
                    return newHistory;
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tank_levels' }, (payload) => {
                const row = payload.new as TankLevelRow;
                const tankId = row.tank_id as TankId;
                setCurrentLevels(prev => {
                    const existing = prev[tankId];
                    // Only update if this row is newer or same as current
                    if (existing && existing.timestamp && row.created_at < existing.timestamp) return prev;
                    return {
                        ...prev,
                        [tankId]: {
                            ...existing,
                            tankId,
                            level: Number(row.level_pct),
                            operator: row.operator_name,
                            timestamp: row.created_at,
                            note: row.note || undefined,
                            trend: (row.trend as 'naik' | 'turun' | 'tetap') || existing?.trend,
                        },
                    };
                });
            })
            .subscribe(onSubStatus('tank_levels'));

        // Realtime: tank_flow_readings.
        // INSERT (jalur umum) di-apply langsung dari payload — tanpa re-fetch
        // 200 baris yang dulu bikin egress membengkak di tiap client.
        // UPDATE/DELETE (jarang) tetap full re-fetch karena payload-nya tidak
        // cukup untuk merekonstruksi state "latest per label".
        const flowChannel = supabase
            .channel('tank_flow_readings_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tank_flow_readings' }, (payload) => {
                const row = payload.new as TankFlowReadingRow;
                const tankId = row.tank_id as TankId;
                if (!TANK_IDS.includes(tankId)) return;

                if (row.direction === 'in') {
                    setFlowRates(prev => ({
                        ...prev,
                        [tankId]: [
                            ...prev[tankId].filter(f => f.sourceLabel !== row.label),
                            { sourceLabel: row.label, rate: Number(row.rate) },
                        ],
                    }));
                } else {
                    setOutputFlowRates(prev => ({
                        ...prev,
                        [tankId]: [
                            ...prev[tankId].filter(f => f.destinationLabel !== row.label),
                            { destinationLabel: row.label, rate: Number(row.rate), pump: row.pump ?? undefined },
                        ],
                    }));

                    if (tankId === 'DEMIN' && row.label === 'Demin Revamp') {
                        if (!row.pump) {
                            setPumpActiveSince(null);
                        } else if (row.pump !== lastDeminPump) {
                            // Pompa baru aktif / ganti pompa — streak dimulai dari baris ini
                            setPumpActiveSince(row.created_at);
                        }
                        lastDeminPump = row.pump;
                    }
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tank_flow_readings' }, () => fetchFlowReadings())
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tank_flow_readings' }, () => fetchFlowReadings())
            .subscribe(onSubStatus('tank_flow_readings'));

        // Realtime: solar_unloadings (INSERT, UPDATE, DELETE)
        const solarChannel = supabase
            .channel('solar_unloadings_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solar_unloadings' }, async () => {
                // Re-fetch solar unloadings on any change
                const { data } = await supabase
                    .from('solar_unloadings')
                    .select(SOLAR_UNLOADING_COLS)
                    .order('date', { ascending: false })
                    .limit(10);

                if (data && data.length > 0) {
                    const rows = data as unknown as SolarUnloadingRow[];
                    setSolarUnloadings(rows.map(d => ({
                        id: d.id,
                        date: d.date,
                        liters: Number(d.liters),
                        supplier: d.supplier,
                    })));
                } else {
                    setSolarUnloadings([]);
                }
            })
            .subscribe(onSubStatus('solar_unloadings'));

        // Realtime: solar_usages (INSERT, UPDATE, DELETE)
        const solarUsageChannel = supabase
            .channel('solar_usages_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solar_usages' }, async () => {
                const { data } = await supabase
                    .from('solar_usages')
                    .select(SOLAR_USAGE_COLS)
                    .order('date', { ascending: false })
                    .limit(10);
                if (data && data.length > 0) {
                    const rows = data as unknown as SolarUsageRow[];
                    setSolarUsages(rows.map(d => ({
                        id: d.id,
                        date: d.date,
                        liters: Number(d.liters),
                        tujuan: d.tujuan,
                    })));
                } else {
                    setSolarUsages([]);
                }
            })
            .subscribe(onSubStatus('solar_usages'));

        return () => {
            clearInterval(autoRefreshInterval);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
            supabase.removeChannel(levelChannel);
            supabase.removeChannel(flowChannel);
            supabase.removeChannel(solarChannel);
            supabase.removeChannel(solarUsageChannel);
        };
    }, [buildTrendData, applyFlowReadings]);

    const submitLevel = useCallback((tankId: TankId, level: number, levelM3: number, operator: string, note?: string, trend?: string) => {
        const timestamp = new Date().toISOString();
        const newEntry: TankLevel = { tankId, level, operator, timestamp, note, trend: trend as any };

        setCurrentLevels(prev => ({
            ...prev,
            // Submit tanpa trend tidak menghapus trend yang sedang tampil
            [tankId]: { ...newEntry, trend: newEntry.trend ?? prev[tankId]?.trend },
        }));
        setHistory(prev => {
            const newHistory = [{ id: prev.length + 1, ...newEntry }, ...prev];
            setTrendData(buildTrendData(newHistory));
            return newHistory;
        });

        if (isSupabaseConfigured()) {
            const supabase = createClient();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabase.from('tank_levels').insert({
                tank_id: tankId,
                level_pct: level,
                level_m3: levelM3,
                operator_name: operator,
                note: note || null,
                trend: trend || null,
            } as any).then(({ error }: { error: unknown }) => {
                if (error) console.error('Failed to insert tank level:', error);
            });
        }
    }, [buildTrendData]);

    const submitFlowRates = useCallback((tankId: TankId, rates: FlowRate[], operatorName?: string) => {
        // Update local state
        setFlowRates(prev => ({ ...prev, [tankId]: rates }));

        // Persist each reading to Supabase
        if (isSupabaseConfigured() && rates.length > 0) {
            const supabase = createClient();
            const rows = rates.map(r => ({
                tank_id: tankId,
                direction: 'in',
                label: r.sourceLabel,
                rate: r.rate,
                pump: null,
                operator_name: operatorName ?? null,
            }));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabase.from('tank_flow_readings').insert(rows as any).then(({ error }: { error: unknown }) => {
                if (error) console.error('Failed to insert flow readings:', error);
            });
        }
    }, []);

    const submitOutputFlowRates = useCallback((tankId: TankId, rates: OutputFlowRate[], operatorName?: string) => {
        // Update local state
        setOutputFlowRates(prev => ({ ...prev, [tankId]: rates }));

        // Update pumpActiveSince locally for immediate feedback
        if (tankId === 'DEMIN') {
            const revamp = rates.find(r => r.destinationLabel === 'Demin Revamp');
            if (revamp?.pump) {
                setPumpActiveSince(prev => prev ?? new Date().toISOString());
            } else if (revamp && !revamp.pump) {
                setPumpActiveSince(null);
            }
        }

        // Persist each reading to Supabase
        if (isSupabaseConfigured() && rates.length > 0) {
            const supabase = createClient();
            const rows = rates.map(r => ({
                tank_id: tankId,
                direction: 'out',
                label: r.destinationLabel,
                rate: r.rate,
                pump: r.pump ?? null,
                operator_name: operatorName ?? null,
            }));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabase.from('tank_flow_readings').insert(rows as any).then(({ error }: { error: unknown }) => {
                if (error) console.error('Failed to insert output flow readings:', error);
            });
        }
    }, []);

    const submitSolarUnloading = useCallback((entry: SolarUnloading) => {
        setSolarUnloadings(prev => [entry, ...prev]);

        if (isSupabaseConfigured()) {
            const supabase = createClient();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabase.from('solar_unloadings').insert({
                date: entry.date,
                liters: entry.liters,
                supplier: entry.supplier,
            } as any).then(({ error }: { error: unknown }) => {
                if (error) console.error('Failed to insert solar unloading:', error);
            });
        }
    }, []);

    const deleteSolarUnloading = useCallback(async (id: string) => {
        setSolarUnloadings(prev => prev.filter(e => e.id !== id));
        if (isSupabaseConfigured()) {
            const supabase = createClient();
            const { error } = await supabase.from('solar_unloadings').delete().eq('id', id);
            if (error) console.error('Failed to delete solar unloading:', error);
        }
    }, []);

    const updateSolarUnloading = useCallback(async (
        id: string,
        updates: Pick<SolarUnloading, 'date' | 'liters' | 'supplier'>
    ) => {
        setSolarUnloadings(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
        if (isSupabaseConfigured()) {
            const supabase = createClient();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.from('solar_unloadings') as any)
                .update({ date: updates.date, liters: updates.liters, supplier: updates.supplier })
                .eq('id', id);
            if (error) console.error('Failed to update solar unloading:', error);
        }
    }, []);

    const submitSolarUsage = useCallback((entry: SolarUsage) => {
        setSolarUsages(prev => [entry, ...prev]);

        if (isSupabaseConfigured()) {
            const supabase = createClient();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabase.from('solar_usages').insert({
                date: entry.date,
                liters: entry.liters,
                tujuan: entry.tujuan,
            } as any).then(({ error }: { error: unknown }) => {
                if (error) console.error('Failed to insert solar usage:', error);
            });
        }
    }, []);

    const deleteSolarUsage = useCallback(async (id: string) => {
        setSolarUsages(prev => prev.filter(e => e.id !== id));
        if (isSupabaseConfigured()) {
            const supabase = createClient();
            const { error } = await supabase.from('solar_usages').delete().eq('id', id);
            if (error) console.error('Failed to delete solar usage:', error);
        }
    }, []);

    const updateSolarUsage = useCallback(async (
        id: string,
        updates: Pick<SolarUsage, 'date' | 'liters' | 'tujuan'>
    ) => {
        setSolarUsages(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
        if (isSupabaseConfigured()) {
            const supabase = createClient();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.from('solar_usages') as any)
                .update({ date: updates.date, liters: updates.liters, tujuan: updates.tujuan })
                .eq('id', id);
            if (error) console.error('Failed to update solar usage:', error);
        }
    }, []);

    return (
        <TankDataContext.Provider value={{
            currentLevels, history, trendData,
            flowRates, outputFlowRates,
            solarUnloadings, solarUsages, pumpActiveSince, loadHistory,
            submitLevel, submitFlowRates, submitOutputFlowRates, submitSolarUnloading,
            deleteSolarUnloading, updateSolarUnloading,
            submitSolarUsage, deleteSolarUsage, updateSolarUsage,
        }}>
            {children}
        </TankDataContext.Provider>
    );
}

export function useTankData() {
    const context = useContext(TankDataContext);
    if (!context) {
        throw new Error('useTankData must be used within TankDataProvider');
    }
    return context;
}
