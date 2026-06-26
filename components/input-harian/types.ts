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

/** Kolom nilai solar (m³) di daily_report_stock_tank yang bisa diisi supervisor di review. */
export type SolarValueCol = 'kedatangan_solar' | 'solar_boiler' | 'solar_bengkel' | 'solar_3b';

/** Prop TabSolarReview — form ringkas review solar (semua m³): level sekarang/kemarin,
 *  kedatangan, pemakaian (Boiler A+B / Bengkel / SA·SU 3B). Nilai di-prefill dari kolom
 *  daily_report_stock_tank atau agregat entri operator; supervisor bisa edit & override. */
export interface SolarReviewProps {
    /** Detail entri kedatangan operator (laporan shift/harian) — ditampilkan read-only. */
    solarUnloadings?: SolarUnloadingEntry[];
    /** Detail entri permintaan operator — ditampilkan read-only. */
    solarUsages?: SolarUsageEntry[];
    /** Level tank solar sekarang (m³) — daily_report_stock_tank.solar_tank_a. */
    solarLevel?: number | null;
    /** Level tank solar kemarin (m³) — display read-only. */
    prevSolarLevel?: number | null;
    /** Kedatangan solar (m³) — prefilled dari kolom/agregat, editable. */
    kedatangan?: number | null;
    /** Pemakaian Boiler A+B (m³). */
    boilerAB?: number | null;
    /** Pemakaian Bengkel (m³). */
    bengkel?: number | null;
    /** Pemakaian SA/SU 3B (m³). */
    sasu?: number | null;
    onLevelChange?: (value: number | null) => void;
    /** Ubah salah satu nilai solar (m³) → persist ke kolom daily_report_stock_tank terkait. */
    onValueChange?: (col: SolarValueCol, value: number | null) => void;
}
