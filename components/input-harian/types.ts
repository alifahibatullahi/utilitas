import type { LoadingShiftHarian } from '@/lib/coal-storage-query';
import type { AsalKedatangan, MetodeUnloading } from '@/lib/coal-storage';
import type { ShiftKey } from '@/lib/constants';
import type { CoalArrivalEntry, OpenArrival } from '@/components/input-shift/CoalArrivalModal';

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

    /** Stock Batubara — nilai kolom DZ (stock_batubara_rendal) dari Google Sheets pada tanggal
     *  LHUBB yang sama. Display-only di TabStockBatubara. */
    stockBatubaraSheet?: string | number | null;
    /** Tanggal LHUBB (ISO YYYY-MM-DD) — untuk label "Data dari LHUBB tanggal ...". */
    lhubbDate?: string;

    // Solar and Ash unloadings from shift reports (deletable in daily)
    solarUnloadings?: { id?: string; date: string; liters: number; supplier: string; shift?: string | null }[];
    solarUsages?: { id?: string; date: string; shift: string; liters: number; tujuan: string }[];
    ashUnloadings?: { id?: string; date: string; shift: string; silo: string; perusahaan: string; tujuan: string; ritase: number }[];
    /** Kedatangan batubara hari itu (coal_arrivals) — SATU data dengan tab Handling laporan
     *  shift. Form harian hanya menampilkannya; review supervisor (PublishReportModal) bisa
     *  mengoreksinya lewat handler CoalReviewProps. */
    coalArrivals?: CoalArrivalHarian[];
    /** Loading batubara per shift hari itu — ringkasan BACA-SAJA di tab Handling, cermin
     *  laporan shift (Total Loading + pilar asal). Urut Malam → Pagi → Sore. */
    coalLoadings?: LoadingShiftHarian[];
    onDeleteSolarUnloading?: (id: string) => void;
    onDeleteSolarUsage?: (id: string) => void;
    onEditSolarUnloading?: (id: string, fields: { liters: number; supplier: string }) => void;
    onEditSolarUsage?: (id: string, fields: { liters: number; tujuan: string; shift: string }) => void;
    onAddSolarUnloading?: (fields: { liters: number; supplier: string }) => void | Promise<void>;
    onAddSolarUsage?: (fields: { liters: number; tujuan: string; shift: string }) => void | Promise<void>;
    onDeleteAshUnloading?: (id: string) => void;
    onEditAshUnloading?: (id: string, fields: { silo: string; shift: string; perusahaan: string; tujuan: string; ritase: number }) => void;

}

/** Satu baris coal_arrivals tanggal laporan, bentuk yang dipakai laporan harian. */
export interface CoalArrivalHarian {
    id?: string;
    batch_id: string;
    shift: string;
    supplier: string;
    zona: string;
    ton: number;
    status: string;
    tanggal_masuk: string;
    asal: AsalKedatangan | null;
    metode_unloading: MetodeUnloading | null;
}

/** Kolom coal_arrivals yang dimuat laporan harian (form & review supervisor). */
export const KOLOM_COAL_ARRIVAL_HARIAN = 'id, batch_id, shift, supplier, zona, ton, status, tanggal_masuk, asal, metode_unloading';

/** Baris DB → CoalArrivalHarian. Asal/metode di luar daftar → null. */
export function keCoalArrivalHarian(r: Record<string, unknown>): CoalArrivalHarian {
    const asal = r.asal === 'tongkang' || r.asal === 'darat' ? r.asal : null;
    const metode = r.metode_unloading === 'conveyor' || r.metode_unloading === 'dump_truck' ? r.metode_unloading : null;
    return {
        id: r.id as string,
        batch_id: (r.batch_id as string) || '',
        shift: (r.shift as string) || '',
        supplier: (r.supplier as string) || '',
        zona: (r.zona as string) || '',
        ton: Number(r.ton) || 0,
        status: (r.status as string) || '',
        tanggal_masuk: (r.tanggal_masuk as string) || '',
        asal,
        metode_unloading: asal === 'tongkang' ? metode : null,
    };
}

/** Subset prop yang dipakai TabStockBatubara (form In/Out batubara per kategori) — supaya
 *  komponen bisa dipakai ulang di luar form harian (mis. panel publish) tanpa menyediakan
 *  seluruh DailyTabProps. Handler kedatangan opsional: tanpa handler → daftar baca-saja. */
export type CoalReviewProps = Pick<DailyTabProps,
    | 'coalTransfer'
    | 'onCoalTransferChange'
    | 'coalArrivals'
> & {
    /** Tanggal laporan — default "mulai masuk storage" kedatangan baru. */
    reportDate?: string;
    coalOpenArrivals?: OpenArrival[];
    coalSupplierOptions?: string[];
    onAddCoalArrival?: (entry: CoalArrivalEntry, shift: ShiftKey) => Promise<void>;
    onEditCoalArrival?: (id: string, entry: CoalArrivalEntry) => Promise<void>;
    onDeleteCoalArrival?: (id: string) => Promise<void>;
};

export interface SolarUnloadingEntry { id?: string; date: string; liters: number; supplier: string; shift?: string | null }
export interface SolarUsageEntry { id?: string; date: string; shift: string; liters: number; tujuan: string }

/** Kolom nilai solar (m³) form di daily_report_stock_tank — inilah yang tersimpan ke Sheets. */
export type SolarValueCol = 'kedatangan_solar' | 'solar_boiler' | 'solar_bengkel' | 'solar_3b';

/** Prop TabSolarReview. Nilai FORM (kedatangan/boilerAB/bengkel/sasu, m³) = yang tersimpan
 *  ke Sheets; bila null → default dari agregat entri (catatan). Entri kedatangan/permintaan
 *  bisa CRUD tapi hanya sebagai catatan & sumber default. */
export interface SolarReviewProps {
    /** Entri kedatangan (solar_unloadings) — catatan + sumber default kedatangan. CRUD. */
    solarUnloadings?: SolarUnloadingEntry[];
    /** Entri permintaan (solar_usages) — catatan + sumber default bengkel/SA·SU. CRUD. */
    solarUsages?: SolarUsageEntry[];
    /** Level tank solar sekarang (m³) — daily_report_stock_tank.solar_tank_a. */
    solarLevel?: number | null;
    /** Level tank solar kemarin (m³) — display read-only. */
    prevSolarLevel?: number | null;
    /** Nilai form (null = belum dioverride → pakai default agregat entri). */
    kedatangan?: number | null;
    boilerAB?: number | null;
    bengkel?: number | null;
    sasu?: number | null;
    onLevelChange?: (value: number | null) => void;
    /** Ubah nilai form → persist ke kolom daily_report_stock_tank terkait. */
    onValueChange?: (col: SolarValueCol, value: number | null) => void;
    onAddUnloading?: (f: { liters: number; supplier: string }) => void | Promise<void>;
    onEditUnloading?: (id: string, f: { liters: number; supplier: string }) => void | Promise<void>;
    onDeleteUnloading?: (id: string) => void | Promise<void>;
    onAddUsage?: (f: { liters: number; tujuan: string; shift: string }) => void | Promise<void>;
    onEditUsage?: (id: string, f: { liters: number; tujuan: string; shift: string }) => void | Promise<void>;
    onDeleteUsage?: (id: string) => void | Promise<void>;
}
