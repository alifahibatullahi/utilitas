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
    solarUnloadings?: { id?: string; date: string; liters: number; supplier: string }[];
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

    // In/Out batubara — model "tambah aktivitas" (tabel coal_activities)
    coalActivities?: CoalActivity[];
    onAddCoalActivity?: (a: CoalActivityInput) => void | Promise<void>;
    onDeleteCoalActivity?: (id: string) => void | Promise<void>;
}

/** Kategori aktivitas batubara. In = kedatangan, Out = pemindahan. */
export type CoalCategory = 'darat' | 'laut' | 'pb2_pf1' | 'pb2_pf2' | 'pb3_calc';
export interface CoalActivityInput {
    kind: 'in' | 'out';
    category: CoalCategory;
    rit: number;
    ton: number;
    keterangan?: string;
}
export interface CoalActivity extends CoalActivityInput {
    id?: string;
    date: string;
}

/** Subset prop yang dipakai TabStockBatubara — supaya komponen bisa dipakai ulang di
 *  luar form harian (mis. panel publish) tanpa harus menyediakan seluruh DailyTabProps. */
export type CoalReviewProps = Pick<DailyTabProps,
    | 'stockBatubaraSheet'
    | 'lhubbDate'
    | 'coalActivities'
    | 'onAddCoalActivity'
    | 'onDeleteCoalActivity'
>;

export interface SolarUnloadingEntry { id?: string; date: string; liters: number; supplier: string }
export interface SolarUsageEntry { id?: string; date: string; shift: string; liters: number; tujuan: string }

/** Prop TabSolarReview — ringkasan review solar (m³): level sekarang/kemarin, kedatangan,
 *  pemakaian (Boiler A+B manual + Bengkel + SA/SU 3B agregat). Boiler A+B & level bisa
 *  diisi supervisor saat `canEditBoilerAB`; selebihnya display agregat dari entri operator. */
export interface SolarReviewProps {
    /** Entri kedatangan operator (Liter) — untuk agregat m³. */
    solarUnloadings?: SolarUnloadingEntry[];
    /** Entri permintaan operator (Liter) — untuk agregat Bengkel/SA·SU 3B m³. */
    solarUsages?: SolarUsageEntry[];
    /** Level tank solar sekarang (m³) — daily_report_stock_tank.solar_tank_a. */
    solarLevel?: number | null;
    /** Level tank solar kemarin (m³) — display read-only. */
    prevSolarLevel?: number | null;
    /** Pemakaian solar Boiler A+B (m³) — daily_report_stock_tank.solar_boiler, manual supervisor. */
    boilerAB?: number | null;
    /** True di panel review supervisor → input Boiler A+B & level aktif. */
    canEditBoilerAB?: boolean;
    onLevelChange?: (value: number | null) => void;
    onBoilerABChange?: (value: number | null) => void;
}
