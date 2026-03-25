export interface DailyTabProps {
    // State objects
    steam: Record<string, number | null>;
    power: Record<string, number | null>;
    coal: Record<string, number | null>;
    turbineMisc: Record<string, number | null>;
    stockTank: Record<string, number | null>;
    coalTransfer: Record<string, number | null>;
    totalizer: Record<string, number | string | null>;

    // Previous day values for selisih
    prevSteam?: Record<string, number | null>;
    prevPower?: Record<string, number | null>;
    prevCoal?: Record<string, number | null>;
    prevTotalizer?: Record<string, number | string | null>;
    prevStockTank?: Record<string, number | null>;

    // Change handlers
    onSteamChange: (name: string, value: number | string | null) => void;
    onPowerChange: (name: string, value: number | string | null) => void;
    onCoalChange: (name: string, value: number | string | null) => void;
    onTurbineMiscChange: (name: string, value: number | string | null) => void;
    onStockTankChange: (name: string, value: number | string | null) => void;
    onCoalTransferChange: (name: string, value: number | string | null) => void;
    onTotalizerChange: (name: string, value: number | string | null) => void;

    // Calculated values
    crA: number;
    crB: number;

    // Solar unloadings from shift reports (read-only in daily)
    solarUnloadings?: { date: string; liters: number; supplier: string }[];
}
