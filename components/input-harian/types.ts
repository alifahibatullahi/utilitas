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

    /** Stock Batubara — nilai kolom DW (stock_batubara_rendal) dari Google Sheets pada tanggal
     *  LHUBB yang sama. Display-only di TabStockBatubara. */
    stockBatubaraSheet?: string | number | null;
    /** Tanggal LHUBB (ISO YYYY-MM-DD) — untuk label "Data dari LHUBB tanggal ...". */
    lhubbDate?: string;

    // Solar and Ash unloadings from shift reports (deletable in daily)
    solarUnloadings?: { id?: string; date: string; liters: number; supplier: string; shift?: string | null }[];
    solarUsages?: { id?: string; date: string; shift: string; liters: number; tujuan: string }[];
    ashUnloadings?: { id?: string; date: string; shift: string; silo: string; perusahaan: string; tujuan: string; ritase: number }[];
    onDeleteSolarUnloading?: (id: string) => void;
    onDeleteSolarUsage?: (id: string) => void;
    onEditSolarUnloading?: (id: string, fields: { liters: number; supplier: string }) => void;
    onEditSolarUsage?: (id: string, fields: { liters: number; tujuan: string; shift: string }) => void;
    onAddSolarUnloading?: (fields: { liters: number; supplier: string }) => void | Promise<void>;
    onAddSolarUsage?: (fields: { liters: number; tujuan: string; shift: string }) => void | Promise<void>;
    onDeleteAshUnloading?: (id: string) => void;
    onEditAshUnloading?: (id: string, fields: { silo: string; shift: string; perusahaan: string; tujuan: string; ritase: number }) => void;

}

/** Subset prop yang dipakai TabStockBatubara (form In/Out batubara per kategori) — supaya
 *  komponen bisa dipakai ulang di luar form harian (mis. panel publish) tanpa menyediakan
 *  seluruh DailyTabProps. */
export type CoalReviewProps = Pick<DailyTabProps,
    | 'coalTransfer'
    | 'onCoalTransferChange'
>;

export interface SolarUnloadingEntry { id?: string; date: string; liters: number; supplier: string; shift?: string | null }
export interface SolarUsageEntry { id?: string; date: string; shift: string; liters: number; tujuan: string }

/** Prop TabSolarReview — review solar gaya kartu Summary TabHandling: daftar entri
 *  kedatangan & permintaan (CRUD), total m³ turunan, + Boiler A+B & level manual. */
export interface SolarReviewProps {
    /** Detail entri kedatangan (solar_unloadings) — CRUD. */
    solarUnloadings?: SolarUnloadingEntry[];
    /** Detail entri permintaan (solar_usages) — CRUD. */
    solarUsages?: SolarUsageEntry[];
    /** Level tank solar sekarang (m³) — daily_report_stock_tank.solar_tank_a. */
    solarLevel?: number | null;
    /** Level tank solar kemarin (m³) — display read-only. */
    prevSolarLevel?: number | null;
    /** Pemakaian Boiler A+B (m³) — daily_report_stock_tank.solar_boiler, manual supervisor. */
    boilerAB?: number | null;
    onLevelChange?: (value: number | null) => void;
    onBoilerABChange?: (value: number | null) => void;
    onAddUnloading?: (f: { liters: number; supplier: string }) => void | Promise<void>;
    onEditUnloading?: (id: string, f: { liters: number; supplier: string }) => void | Promise<void>;
    onDeleteUnloading?: (id: string) => void | Promise<void>;
    onAddUsage?: (f: { liters: number; tujuan: string; shift: string }) => void | Promise<void>;
    onEditUsage?: (id: string, f: { liters: number; tujuan: string; shift: string }) => void | Promise<void>;
    onDeleteUsage?: (id: string) => void | Promise<void>;
}
