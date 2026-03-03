'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { TankId, TANK_IDS, TANKS } from '@/lib/constants';
import { generateTrendData } from '@/lib/utils';

// Flow rate per source (ton/h)
export interface FlowRate {
    sourceLabel: string;
    rate: number; // ton/h
}

// Solar unloading note
export interface SolarUnloading {
    note: string; // e.g. "Unloading 5.000 liter" or empty
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
    solarUnloading: SolarUnloading;
    setSolarUnloading: (note: string) => void;
    submitLevel: (tankId: TankId, level: number, operator: string, note?: string) => void;
    submitFlowRates: (tankId: TankId, rates: FlowRate[]) => void;
}

// Initial dummy data
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

// Initial dummy flow rates
const initialFlowRates: Record<TankId, FlowRate[]> = {
    DEMIN: [
        { sourceLabel: 'Utilitas 1', rate: 12.5 },
        { sourceLabel: 'SU 3A', rate: 8.3 },
    ],
    RCW: [
        { sourceLabel: 'Utilitas 1', rate: 15.7 },
    ],
    SOLAR: [],
};

const TankDataContext = createContext<TankDataContextType | null>(null);

export function TankDataProvider({ children }: { children: ReactNode }) {
    const [currentLevels, setCurrentLevels] = useState(initialLevels);
    const [history, setHistory] = useState(initialHistory);
    const [flowRates, setFlowRates] = useState(initialFlowRates);
    const [solarUnloading, setSolarUnloadingState] = useState<SolarUnloading>({ note: 'Unloading 5.000 liter dari truk pagi' });
    const [trendData, setTrendData] = useState<Record<TankId, { time: string; level: number }[]>>(() => {
        const data: Record<string, { time: string; level: number }[]> = {};
        TANK_IDS.forEach((id) => {
            data[id] = generateTrendData(initialLevels[id].level);
        });
        return data as Record<TankId, { time: string; level: number }[]>;
    });

    const submitLevel = useCallback((tankId: TankId, level: number, operator: string, note?: string) => {
        const timestamp = new Date().toISOString();
        const newEntry: TankLevel = { tankId, level, operator, timestamp, note };

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
    }, []);

    const submitFlowRates = useCallback((tankId: TankId, rates: FlowRate[]) => {
        setFlowRates(prev => ({ ...prev, [tankId]: rates }));
    }, []);

    const setSolarUnloading = useCallback((note: string) => {
        setSolarUnloadingState({ note });
    }, []);

    return (
        <TankDataContext.Provider value={{ currentLevels, history, trendData, flowRates, solarUnloading, setSolarUnloading, submitLevel, submitFlowRates }}>
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
