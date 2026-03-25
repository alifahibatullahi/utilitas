'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { TankId, TANK_IDS, TANKS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import type { SolarUnloadingRow, TankLevelRow } from '@/lib/supabase/types';

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
    submitLevel: (tankId: TankId, level: number, levelM3: number, operator: string, note?: string) => void;
    submitFlowRates: (tankId: TankId, rates: FlowRate[]) => void;
    submitOutputFlowRates: (tankId: TankId, rates: OutputFlowRate[]) => void;
    submitSolarUnloading: (entry: SolarUnloading) => void;
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

const TankDataContext = createContext<TankDataContextType | null>(null);

export function TankDataProvider({ children }: { children: ReactNode }) {
    const [currentLevels, setCurrentLevels] = useState(emptyLevels);
    const [history, setHistory] = useState<TankLevelHistory[]>([]);
    const [flowRates, setFlowRates] = useState(emptyFlowRates);
    const [outputFlowRates, setOutputFlowRates] = useState(emptyOutputFlowRates);
    const [solarUnloadings, setSolarUnloadings] = useState<SolarUnloading[]>([]);
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

    // Fetch from Supabase on mount
    useEffect(() => {
        if (!isSupabaseConfigured()) return;

        const supabase = createClient();

        // Fetch latest tank levels + history from tank_levels table
        const fetchTankLevels = async () => {
            // Get last 100 entries for history & trend
            const { data } = await supabase
                .from('tank_levels')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (data && data.length > 0) {
                const rows = data as unknown as TankLevelRow[];

                // Set current levels (latest per tank)
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

                // Build history
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

        // Fallback: also check shift_tankyard for levels if tank_levels is empty
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
                // Only set if tank_levels didn't provide data
                setCurrentLevels(prev => {
                    const updated = { ...prev };
                    if (prev.DEMIN.operator === '-' && row.tk_demin != null) {
                        updated.DEMIN = { tankId: 'DEMIN', level: Number(row.tk_demin), operator: 'Shift Report', timestamp };
                    }
                    if (prev.RCW.operator === '-' && row.tk_rcw != null) {
                        updated.RCW = { tankId: 'RCW', level: Number(row.tk_rcw), operator: 'Shift Report', timestamp };
                    }
                    if (prev.SOLAR.operator === '-' && row.tk_solar_ab != null) {
                        updated.SOLAR = { tankId: 'SOLAR', level: Number(row.tk_solar_ab), operator: 'Shift Report', timestamp };
                    }
                    return updated;
                });
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
                    date: d.date,
                    liters: Number(d.liters),
                    supplier: d.supplier,
                })));
            }
        };

        fetchTankLevels().then(() => fetchShiftTankyard());
        fetchSolar();

        // Subscribe to realtime updates on tank_levels
        const channel = supabase
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

        return () => {
            supabase.removeChannel(channel);
        };
    }, [buildTrendData]);

    const submitLevel = useCallback((tankId: TankId, level: number, levelM3: number, operator: string, note?: string) => {
        const timestamp = new Date().toISOString();
        const newEntry: TankLevel = { tankId, level, operator, timestamp, note };

        // Update local state immediately
        setCurrentLevels(prev => ({ ...prev, [tankId]: newEntry }));
        setHistory(prev => {
            const newHistory = [{ id: prev.length + 1, ...newEntry }, ...prev];
            setTrendData(buildTrendData(newHistory));
            return newHistory;
        });

        // Persist to Supabase
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

    const submitFlowRates = useCallback((tankId: TankId, rates: FlowRate[]) => {
        setFlowRates(prev => ({ ...prev, [tankId]: rates }));
    }, []);

    const submitOutputFlowRates = useCallback((tankId: TankId, rates: OutputFlowRate[]) => {
        setOutputFlowRates(prev => ({ ...prev, [tankId]: rates }));
    }, []);

    const submitSolarUnloading = useCallback((entry: SolarUnloading) => {
        setSolarUnloadings(prev => [entry, ...prev]);

        // Insert to Supabase
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

    return (
        <TankDataContext.Provider value={{ currentLevels, history, trendData, flowRates, outputFlowRates, solarUnloadings, submitLevel, submitFlowRates, submitOutputFlowRates, submitSolarUnloading }}>
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
