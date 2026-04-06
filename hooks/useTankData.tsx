'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { TankId, TANK_IDS, TANKS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import type { SolarUnloadingRow, TankLevelRow, TankFlowReadingRow } from '@/lib/supabase/types';

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

// Solar unloading entry
export interface SolarUnloading {
    id?: string;        // Supabase UUID (tersedia setelah fetch dari DB)
    date: string;       // ISO date string (tanggal unloading)
    liters: number;     // jumlah liter
    supplier: string;   // perusahaan pengirim
}

export interface TankLevel {
    tankId: TankId;
    level: number;
    operator: string;
    timestamp: string;
    note?: string;
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
    trendData: Record<TankId, { time: string; level: number }[]>;
    flowRates: Record<TankId, FlowRate[]>;
    outputFlowRates: Record<TankId, OutputFlowRate[]>;
    solarUnloadings: SolarUnloading[];
    /** ISO timestamp kapan pompa Demin Revamp mulai aktif (null = mati) */
    pumpActiveSince: string | null;
    submitLevel: (tankId: TankId, level: number, levelM3: number, operator: string, note?: string) => void;
    submitFlowRates: (tankId: TankId, rates: FlowRate[], operatorName?: string) => void;
    submitOutputFlowRates: (tankId: TankId, rates: OutputFlowRate[], operatorName?: string) => void;
    submitSolarUnloading: (entry: SolarUnloading) => void;
    deleteSolarUnloading: (id: string) => Promise<void>;
    updateSolarUnloading: (id: string, updates: Pick<SolarUnloading, 'date' | 'liters' | 'supplier'>) => Promise<void>;
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
    const [pumpActiveSince, setPumpActiveSince] = useState<string | null>(null);
    const [trendData, setTrendData] = useState<Record<TankId, { time: string; level: number }[]>>({
        DEMIN: [], RCW: [], SOLAR: [],
    });

    // Build trend data from history
    const buildTrendData = useCallback((historyItems: TankLevelHistory[]) => {
        const result: Record<TankId, { time: string; level: number }[]> = { DEMIN: [], RCW: [], SOLAR: [] };
        TANK_IDS.forEach(tankId => {
            const tankHistory = historyItems
                .filter(h => h.tankId === tankId)
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .slice(-24); // Last 24 data points
            result[tankId] = tankHistory.map(h => ({
                time: new Date(h.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
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

    // Fetch from Supabase on mount
    useEffect(() => {
        if (!isSupabaseConfigured()) return;

        const supabase = createClient();

        // Fetch latest tank levels + history from tank_levels table
        const fetchTankLevels = async () => {
            const { data } = await supabase
                .from('tank_levels')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (data && data.length > 0) {
                const rows = data as unknown as TankLevelRow[];

                TANK_IDS.forEach(tankId => {
                    const latest = rows.find(r => r.tank_id === tankId);
                    if (latest) {
                        setCurrentLevels(prev => ({
                            ...prev,
                            [tankId]: {
                                tankId,
                                level: Number(latest.level_pct),
                                operator: latest.operator_name,
                                timestamp: latest.created_at,
                                note: latest.note || undefined,
                            },
                        }));
                    }
                });

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
            }
        };

        // Fallback: shift_tankyard jika tank_levels kosong
        const fetchShiftTankyard = async () => {
            const { data } = await supabase
                .from('shift_tankyard')
                .select('*, shift_reports!inner(date, shift, group_name)')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data) {
                const row = data as unknown as {
                    tk_rcw: number | null;
                    tk_demin: number | null;
                    tk_solar_ab: number | null;
                    created_at: string;
                };
                const timestamp = row.created_at;
                setCurrentLevels(prev => {
                    const updated = { ...prev };
                    if (prev.DEMIN.operator === '-' && row.tk_demin != null)
                        updated.DEMIN = { tankId: 'DEMIN', level: Number(row.tk_demin), operator: 'Shift Report', timestamp };
                    if (prev.RCW.operator === '-' && row.tk_rcw != null)
                        updated.RCW = { tankId: 'RCW', level: Number(row.tk_rcw), operator: 'Shift Report', timestamp };
                    if (prev.SOLAR.operator === '-' && row.tk_solar_ab != null)
                        updated.SOLAR = { tankId: 'SOLAR', level: Number(row.tk_solar_ab), operator: 'Shift Report', timestamp };
                    return updated;
                });
            }
        };

        // Fetch flow readings (ambil 200 terakhir untuk tiap tank+direction)
        const fetchFlowReadings = async () => {
            const { data } = await supabase
                .from('tank_flow_readings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);

            if (data && data.length > 0) {
                const rows = data as unknown as TankFlowReadingRow[];
                applyFlowReadings(rows);

                // Hitung pumpActiveSince dari history Demin Revamp
                const deminRevampHistory = rows.filter(
                    r => r.tank_id === 'DEMIN' && r.direction === 'out' && r.label === 'Demin Revamp'
                );
                setPumpActiveSince(calcPumpActiveSince(deminRevampHistory));
            }
        };

        // Fetch solar unloadings
        const fetchSolar = async () => {
            const { data } = await supabase
                .from('solar_unloadings')
                .select('*')
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
        };

        fetchTankLevels().then(() => fetchShiftTankyard());
        fetchFlowReadings();
        fetchSolar();

        // Auto-refresh setiap 30 menit sebagai fallback dari realtime subscription
        const autoRefreshInterval = setInterval(() => {
            fetchTankLevels().then(() => fetchShiftTankyard());
            fetchFlowReadings();
            fetchSolar();
        }, 15 * 60 * 1000);

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
                };
                setCurrentLevels(prev => ({ ...prev, [tankId]: newLevel }));
                setHistory(prev => {
                    const newHistory = [{ id: prev.length + 1, ...newLevel }, ...prev];
                    setTrendData(buildTrendData(newHistory));
                    return newHistory;
                });
            })
            .subscribe();

        // Realtime: tank_flow_readings (INSERT, UPDATE, DELETE)
        const flowChannel = supabase
            .channel('tank_flow_readings_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tank_flow_readings' }, async () => {
                // Re-fetch all flow readings untuk update state lengkap
                const { data } = await supabase
                    .from('tank_flow_readings')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(200);

                if (data && data.length > 0) {
                    const rows = data as unknown as TankFlowReadingRow[];
                    applyFlowReadings(rows);
                    const deminRevampHistory = rows.filter(
                        r => r.tank_id === 'DEMIN' && r.direction === 'out' && r.label === 'Demin Revamp'
                    );
                    setPumpActiveSince(calcPumpActiveSince(deminRevampHistory));
                }
            })
            .subscribe();

        // Realtime: solar_unloadings (INSERT, UPDATE, DELETE)
        const solarChannel = supabase
            .channel('solar_unloadings_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solar_unloadings' }, async () => {
                // Re-fetch solar unloadings on any change
                const { data } = await supabase
                    .from('solar_unloadings')
                    .select('*')
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
            .subscribe();

        return () => {
            clearInterval(autoRefreshInterval);
            supabase.removeChannel(levelChannel);
            supabase.removeChannel(flowChannel);
            supabase.removeChannel(solarChannel);
        };
    }, [buildTrendData, applyFlowReadings]);

    const submitLevel = useCallback((tankId: TankId, level: number, levelM3: number, operator: string, note?: string) => {
        const timestamp = new Date().toISOString();
        const newEntry: TankLevel = { tankId, level, operator, timestamp, note };

        setCurrentLevels(prev => ({ ...prev, [tankId]: newEntry }));
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

    return (
        <TankDataContext.Provider value={{
            currentLevels, history, trendData,
            flowRates, outputFlowRates,
            solarUnloadings, pumpActiveSince,
            submitLevel, submitFlowRates, submitOutputFlowRates, submitSolarUnloading,
            deleteSolarUnloading, updateSolarUnloading,
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
