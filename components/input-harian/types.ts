export interface DailyTabProps {
    // State objects
    steam: Record<string, number | null>;
    power: Record<string, number | null>;
    coal: Record<string, number | null>;
    turbineMisc: Record<string, number | string | null>;
    stockTank: Record<string, number | null>;
    coalTransfer: Record<string, number | null>;
    totalizer: Record<string, number | string | null>;

    // Previous day values for selisih
    prevSteam?: Record<string, number | null>;
    prevPower?: Record<string, number | null>;
    prevCoal?: Record<string, number | null>;
    prevTurbineMisc?: Record<string, number | null>;
    prevTotalizer?: Record<string, number | string | null>;
    prevStockTank?: Record<string, number | null>;
    prevCoalTransfer?: Record<string, number | null>;

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

    // Solar and Ash unloadings from shift reports (deletable in daily)
    solarUnloadings?: { id?: string; date: string; liters: number; supplier: string }[];
    solarUsages?: { id?: string; date: string; shift: string; liters: number; tujuan: string }[];
    ashUnloadings?: { id?: string; date: string; shift: string; silo: string; perusahaan: string; tujuan: string; ritase: number }[];
    onDeleteSolarUnloading?: (id: string) => void;
    onDeleteSolarUsage?: (id: string) => void;
    onEditSolarUnloading?: (id: string, fields: { liters: number; supplier: string }) => void;
    onEditSolarUsage?: (id: string, fields: { liters: number; tujuan: string; shift: string }) => void;
    onDeleteAshUnloading?: (id: string) => void;
    onEditAshUnloading?: (id: string, fields: { silo: string; shift: string; perusahaan: string; tujuan: string; ritase: number }) => void;
}
