'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { TankId, TANK_IDS, TANKS } from '@/lib/constants';
import { generateTrendData } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { TankLevelRow, SolarUnloadingRow } from '@/lib/supabase/types';

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
    submitLevel: (tankId: TankId, level: number, operator: string, note?: string) => void;
    submitFlowRates: (tankId: TankId, rates: FlowRate[]) => void;
    submitOutputFlowRates: (tankId: TankId, rates: OutputFlowRate[]) => void;
    submitSolarUnloading: (entry: SolarUnloading) => void;
}

// Initial dummy data (fallback when Supabase not connected)
const initialLevels: Record<TankId, TankLevel> = {
    DEMIN: { tankId: 'DEMIN', level: 78.4, operator: 'Budi Santoso', timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), note: '' },
    RCW: { tankId: 'RCW', level: 65.2, operator: 'Ahmad Fauzi', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), note: '' },
    SOLAR: { tankId: 'SOLAR', level: 42.0, operator: 'Dewi Kartika', timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(), note: 'Setelah unloading truk pagi' },
};

const initialHistory: TankLevelHistory[] = [
    { id: 1, tankId: 'DEMIN', level: 78.4, operator: 'Budi Santoso', timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
    { id: 2, tankId: 'RCW', level: 65.2, operator: 'Ahmad Fauzi', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
    { id: 3, tankId: 'SOLAR', level: 42.0, operator: 'Dewi Kartika', timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(), note: 'Setelah unloading truk pagi' },
    { id: 4, tankId: 'DEMIN', level: 76.1, operator: 'Budi Santoso', timestamp: new Date(Date.now() - 65 * 60 * 1000).toISOString() },
    { id: 5, tankId: 'RCW', level: 68.5, operator: 'Ahmad Fauzi', timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString() },
    { id: 6, tankId: 'DEMIN', level: 74.2, operator: 'Dewi Kartika', timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString() },
    { id: 7, tankId: 'SOLAR', level: 38.5, operator: 'Budi Santoso', timestamp: new Date(Date.now() - 150 * 60 * 1000).toISOString() },
    { id: 8, tankId: 'RCW', level: 71.0, operator: 'Dewi Kartika', timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString() },
    { id: 9, tankId: 'DEMIN', level: 72.8, operator: 'Ahmad Fauzi', timestamp: new Date(Date.now() - 210 * 60 * 1000).toISOString() },
    { id: 10, tankId: 'SOLAR', level: 35.0, operator: 'Budi Santoso', timestamp: new Date(Date.now() - 250 * 60 * 1000).toISOString() },
    { id: 11, tankId: 'RCW', level: 73.2, operator: 'Ahmad Fauzi', timestamp: new Date(Date.now() - 290 * 60 * 1000).toISOString() },
    { id: 12, tankId: 'DEMIN', level: 70.5, operator: 'Dewi Kartika', timestamp: new Date(Date.now() - 330 * 60 * 1000).toISOString() },
];

const initialFlowRates: Record<TankId, FlowRate[]> = {
    DEMIN: [
        { sourceLabel: 'Utilitas 1', rate: 12.5 },
        { sourceLabel: 'Demin 3A', rate: 8.3 },
    ],
    RCW: [
        { sourceLabel: 'Utilitas 1', rate: 15.7 },
    ],
    SOLAR: [],
};

const initialOutputFlowRates: Record<TankId, OutputFlowRate[]> = {
    DEMIN: [
        { destinationLabel: 'Internal UBB', rate: 10.2 },
        { destinationLabel: 'Demin Revamp', rate: 6.8, pump: 'P-1000A' },
    ],
    RCW: [],
    SOLAR: [],
};

const initialSolarUnloadings: SolarUnloading[] = [
    { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], liters: 5000, supplier: 'PT Pertamina' },
    { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], liters: 8000, supplier: 'PT AKR Corporindo' },
    { date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], liters: 6500, supplier: 'PT Shell Indonesia' },
];

function isSupabaseConfigured(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return !!url && !url.includes('YOUR_PROJECT_ID');
}

const TankDataContext = createContext<TankDataContextType | null>(null);

export function TankDataProvider({ children }: { children: ReactNode }) {
    const [currentLevels, setCurrentLevels] = useState(initialLevels);
    const [history, setHistory] = useState(initialHistory);
    const [flowRates, setFlowRates] = useState(initialFlowRates);
    const [outputFlowRates, setOutputFlowRates] = useState(initialOutputFlowRates);
    const [solarUnloadings, setSolarUnloadings] = useState<SolarUnloading[]>(initialSolarUnloadings);
    const [trendData, setTrendData] = useState<Record<TankId, { time: string; level: number }[]>>(() => {
        const data: Record<string, { time: string; level: number }[]> = {};
        TANK_IDS.forEach((id) => {
            data[id] = generateTrendData(initialLevels[id].level);
        });
        return data as Record<TankId, { time: string; level: number }[]>;
    });

    // Fetch from Supabase on mount
    useEffect(() => {
        if (!isSupabaseConfigured()) return;

        const supabase = createClient();

        // Fetch latest tank levels
        const fetchLevels = async () => {
            for (const tankId of TANK_IDS) {
                const { data } = await supabase
                    .from('tank_levels')
                    .select('*, operators(name)')
                    .eq('tank_id', tankId)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .single();

                if (data) {
                    const row = data as unknown as TankLevelRow & { operators: { name: string } | null };
                    const operatorName = row.operators?.name || 'Unknown';
                    setCurrentLevels(prev => ({
                        ...prev,
                        [tankId]: {
                            tankId,
                            level: Number(row.level_percent),
                            operator: operatorName,
                            timestamp: row.timestamp,
                            note: row.note || '',
                        }
                    }));
                }
            }
        };

        // Fetch history (last 20 entries)
        const fetchHistory = async () => {
            const { data } = await supabase
                .from('tank_levels')
                .select('*, operators(name)')
                .order('timestamp', { ascending: false })
                .limit(20);

            if (data && data.length > 0) {
                const rows = data as unknown as (TankLevelRow & { operators: { name: string } | null })[];
                setHistory(rows.map((d, idx) => ({
                    id: idx + 1,
                    tankId: d.tank_id as TankId,
                    level: Number(d.level_percent),
                    operator: d.operators?.name || 'Unknown',
                    timestamp: d.timestamp,
                    note: d.note || undefined,
                })));
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

        fetchLevels();
        fetchHistory();
        fetchSolar();

        // Realtime subscription for tank levels
        const channel = supabase
            .channel('tank_levels_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tank_levels' }, (payload: { new: Record<string, unknown> }) => {
                const d = payload.new as { tank_id: string; level_percent: number; timestamp: string; note: string | null };
                const tankId = d.tank_id as TankId;
                setCurrentLevels(prev => ({
                    ...prev,
                    [tankId]: {
                        tankId,
                        level: Number(d.level_percent),
                        operator: 'Realtime',
                        timestamp: d.timestamp,
                        note: d.note || '',
                    }
                }));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const submitLevel = useCallback((tankId: TankId, level: number, operator: string, note?: string) => {
        const timestamp = new Date().toISOString();
        const newEntry: TankLevel = { tankId, level, operator, timestamp, note };

        // Update local state immediately
        setCurrentLevels(prev => ({ ...prev, [tankId]: newEntry }));
        setHistory(prev => [
            { id: prev.length + 1, ...newEntry },
            ...prev,
        ]);
        setTrendData(prev => {
            const existing = prev[tankId] || [];
            const now = new Date();
            const newPoint = {
                time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                level,
            };
            return {
                ...prev,
                [tankId]: [...existing.slice(-11), newPoint],
            };
        });

        // Insert to Supabase
        if (isSupabaseConfigured()) {
            const supabase = createClient();
            const levelM3 = (level / 100) * (TANKS[tankId]?.capacityM3 || 0);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabase.from('tank_levels').insert({
                tank_id: tankId,
                level_percent: level,
                level_m3: levelM3,
                note: note || null,
            } as any).then(({ error }: { error: unknown }) => {
                if (error) console.error('Failed to insert tank level:', error);
            });
        }
    }, []);

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
