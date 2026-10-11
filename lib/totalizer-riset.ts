// Riset (reset) raw totalizer — meter kembali ke 0 lalu menghitung ulang dari 0.
//
// Selisih normal = cur − prev. Kalau di antara dua pembacaan meter sempat riset, bagian
// sebelum riset hilang dari cur, jadi:
//
//     selisih = (nilai akhir sebelum riset − prev) + (cur − 0)
//
// Contoh (permintaan user 11 Okt 2026): shift terakhir 9000, harian terakhir 8000, meter
// riset di 10000. Shift berikutnya baca 1000 → (10000 − 9000) + 1000 = 2000. Harian
// berikutnya baca 5000 → (10000 − 8000) + 5000 = 7000. Satu nilai akhir dipakai dua seri.
//
// Penandanya disimpan PER LAPORAN di kolom JSONB `totalizer_riset` milik laporan induk
// (shift_reports / daily_reports), dikunci per meter. Tiap laporan membawa nilai akhirnya
// sendiri, jadi semua konsumen (form, Sheets, logbook, review publish) cukup membaca laporan
// itu + prev-nya — tak perlu jam riset. Riset hanya memengaruhi laporan yang jendelanya
// mencakup riset; laporan sesudahnya memakai raw pasca-riset sebagai prev, berjalan normal.
//
// Ditulis lewat RPC merge_{shift,daily}_totalizer_riset (merge per kunci, null = hapus) —
// pola sama dgn station_fillers: station tak saling timpa, dan hanya kunci yang disentuh
// operator yang dikirim (re-save form penuh tak pernah menghapus penanda station lain).

export type SeriLaporan = 'shift' | 'harian';
export type ShiftNama = 'malam' | 'pagi' | 'sore';

/** Isi satu kunci di kolom JSONB `totalizer_riset`. */
export interface RisetEntry {
    nilai_akhir: number;
    station?: string | null;
    oleh?: string | null;
    dicatat_pada?: string | null;
}
export type RisetMap = Record<string, RisetEntry>;

/** State form: kunci ada = riset ditandai; null = ditandai tapi nilai akhir belum diisi. */
export type RisetState = Record<string, number | null>;

/** Patch ke RPC: entry = set, null = hapus penanda. */
export type RisetPatch = Record<string, RisetEntry | null>;

/** Letak raw sebuah meter di satu seri laporan. */
export interface LokasiMeter {
    tab: string;          // id tab (STATION_SHIFT_TABS / STATION_HARIAN_TABS)
    tabel: string;        // tabel child
    kolom: string;        // kolom raw totalizer
    boiler?: 'A' | 'B';   // khusus shift_boiler (satu baris per boiler)
}

export interface MeterTotalizer {
    key: string;
    label: string;
    shift?: LokasiMeter;
    harian?: LokasiMeter;
}

const boilerMeters = (b: 'A' | 'B'): MeterTotalizer[] => {
    const x = b.toLowerCase();
    const tab = `Boiler ${b}`;
    const feeders = b === 'A' ? ['a', 'b', 'c'] : ['d', 'e', 'f'];
    return [
        {
            key: `steam_${x}`, label: `Totalizer Steam Boiler ${b}`,
            shift: { tab, tabel: 'shift_boiler', kolom: 'totalizer_steam', boiler: b },
            harian: { tab, tabel: 'daily_report_steam', kolom: `prod_boiler_${x}_24` },
        },
        {
            key: `bfw_${x}`, label: `Totalizer BFW Boiler ${b}`,
            shift: { tab, tabel: 'shift_boiler', kolom: 'totalizer_bfw', boiler: b },
            harian: { tab, tabel: 'daily_report_stock_tank', kolom: `bfw_boiler_${x}` },
        },
        ...feeders.map((f): MeterTotalizer => ({
            key: `feeder_${f}`, label: `Totalizer Coal Feeder ${f.toUpperCase()}`,
            shift: { tab, tabel: 'shift_coal_bunker', kolom: `feeder_${f}` },
            harian: { tab, tabel: 'daily_report_coal', kolom: `coal_${f}_24` },
        })),
    ];
};

const powerMeter = (k: string, label: string): MeterTotalizer => ({
    key: `power_${k}`, label: `Totalizer ${label}`,
    shift: { tab: 'Generator', tabel: 'shift_power_dist', kolom: `power_${k}_totalizer` },
    harian: { tab: 'Power', tabel: 'daily_report_power', kolom: `power_${k}_totalizer` },
});

const airMeter = (kolom: string, label: string): MeterTotalizer => ({
    key: kolom, label: `Totalizer ${label}`,
    harian: { tab: 'Handling', tabel: 'daily_report_totalizer', kolom },
});

/**
 * Registri meter — satu sumber. Meter fisik yang sama di shift & harian berbagi kunci, jadi
 * riset yang dicatat di satu seri bisa ditawarkan ke seri lainnya. Pemetaan
 * pabrik1↔mps_i & pabrik3a↔mps_3a mengikuti e-Logbook (app/logbook/page.tsx).
 */
export const TOTALIZER_METERS: MeterTotalizer[] = [
    ...boilerMeters('A'),
    ...boilerMeters('B'),
    {
        key: 'turbin_inlet', label: 'Totalizer Steam Inlet Turbin',
        shift: { tab: 'Turbin', tabel: 'shift_turbin', kolom: 'totalizer_steam_inlet' },
        harian: { tab: 'Turbin', tabel: 'daily_report_steam', kolom: 'inlet_turbine_24' },
    },
    {
        key: 'turbin_kondensat', label: 'Totalizer Condensate',
        shift: { tab: 'Turbin', tabel: 'shift_turbin', kolom: 'totalizer_condensate' },
        harian: { tab: 'Turbin', tabel: 'daily_report_steam', kolom: 'fully_condens_24' },
    },
    {
        key: 'steam_pabrik1', label: 'Totalizer Steam Pabrik 1',
        shift: { tab: 'Distribusi Steam', tabel: 'shift_steam_dist', kolom: 'pabrik1_totalizer' },
        harian: { tab: 'Turbin', tabel: 'daily_report_steam', kolom: 'mps_i_24' },
    },
    {
        key: 'steam_pabrik2', label: 'Totalizer Steam Pabrik 2',
        shift: { tab: 'Distribusi Steam', tabel: 'shift_steam_dist', kolom: 'pabrik2_totalizer' },
    },
    {
        key: 'steam_pabrik3a', label: 'Totalizer Steam Pabrik 3',
        shift: { tab: 'Distribusi Steam', tabel: 'shift_steam_dist', kolom: 'pabrik3a_totalizer' },
        harian: { tab: 'Turbin', tabel: 'daily_report_steam', kolom: 'mps_3a_24' },
    },
    powerMeter('ubb', 'Internal UBB'),
    powerMeter('pabrik2', 'Power Pabrik 2'),
    powerMeter('pabrik3a', 'Power Pabrik 3A'),
    powerMeter('revamping', 'Power Pabrik 3B'),
    powerMeter('pie', 'Power PIU'),
    powerMeter('stg_ubb', 'STG UBB'),
    airMeter('tot_rcw_1a', 'RCW 1A'),
    airMeter('tot_demin', 'Demin'),
    airMeter('tot_demin_pb1', 'Demin PB1'),
    airMeter('tot_demin_pb3', 'Demin PB3'),
    airMeter('tot_hydrant', 'Hydrant'),
    airMeter('tot_basin', 'Basin'),
    airMeter('tot_service', 'Service'),
    {
        key: 'piu_import', label: 'Totalizer Delivered (Import)',
        harian: { tab: 'PIU', tabel: 'daily_report_turbine_misc', kolom: 'totalizer_import' },
    },
    {
        key: 'piu_export', label: 'Totalizer Received (Export)',
        harian: { tab: 'PIU', tabel: 'daily_report_turbine_misc', kolom: 'totalizer_export' },
    },
];

export const METER_BY_KEY: Record<string, MeterTotalizer> =
    Object.fromEntries(TOTALIZER_METERS.map(m => [m.key, m]));

/** Meter yang punya raw di seri ini (opsional: hanya di tab tertentu). */
export function meterSeri(seri: SeriLaporan, tab?: string): MeterTotalizer[] {
    return TOTALIZER_METERS.filter(m => {
        const lok = m[seri];
        return !!lok && (tab === undefined || lok.tab === tab);
    });
}

// ─── Hitungan ────────────────────────────────────────────────────────────────

/**
 * Selisih mentah dua pembacaan, memperhitungkan riset. TANPA guard/lantai — tiap pemanggil
 * tetap memakai guard-nya sendiri (prev > 0, cur > 0, lantai 0, …) supaya perilaku lama
 * tidak berubah saat tak ada riset.
 */
export function kurangiTotalizer(cur: number, prev: number, nilaiAkhir?: number | null): number {
    return nilaiAkhir != null ? (nilaiAkhir - prev) + cur : cur - prev;
}

const angka = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/** Nilai akhir riset sebuah meter dari JSONB `totalizer_riset` laporan; undefined = tak riset. */
export function nilaiAkhirRiset(map: unknown, meter: string): number | undefined {
    if (!map || typeof map !== 'object') return undefined;
    const e = (map as Record<string, unknown>)[meter];
    if (!e || typeof e !== 'object') return undefined;
    const n = angka((e as Record<string, unknown>).nilai_akhir);
    return n != null && n > 0 ? n : undefined;
}

/** JSONB laporan → state form (hanya entri valid). */
export function risetStateDariDb(map: unknown): RisetState {
    const out: RisetState = {};
    if (!map || typeof map !== 'object') return out;
    for (const k of Object.keys(map as Record<string, unknown>)) {
        const n = nilaiAkhirRiset(map, k);
        if (n !== undefined) out[k] = n;
    }
    return out;
}

/** Nilai akhir yang SIAP dipakai hitungan dari state form (null = belum diisi → diabaikan). */
export function nilaiAkhirDariState(state: RisetState, meter: string): number | undefined {
    const v = state[meter];
    return v != null && v > 0 ? v : undefined;
}

/**
 * Susun patch RPC dari state form. Hanya kunci yang DISENTUH operator yang dikirim —
 * kunci yang cuma termuat dari DB tidak ikut, jadi re-save tak pernah menghapus penanda
 * yang tidak dilihat/diubah (anti-wipe, lihat insiden catatan 10 Jun 2026).
 */
export function susunPatchRiset(
    state: RisetState,
    disentuh: Iterable<string>,
    meta: { station?: string | null; oleh?: string | null },
): RisetPatch {
    const patch: RisetPatch = {};
    const now = new Date().toISOString();
    for (const k of disentuh) {
        if (!METER_BY_KEY[k]) continue;
        const v = state[k];
        if (v != null && v > 0) {
            patch[k] = { nilai_akhir: v, station: meta.station ?? null, oleh: meta.oleh ?? null, dicatat_pada: now };
        } else if (!(k in state)) {
            patch[k] = null; // penanda dibatalkan → hapus
        }
        // Ditandai tapi nilai akhir kosong → tidak dikirim (simpan diblokir lebih dulu).
    }
    return patch;
}

// ─── Saran lintas seri ───────────────────────────────────────────────────────

export interface SaranRiset {
    nilai: number;
    sumber: string; // mis. "Laporan Harian 10/10", "Shift Pagi 11/10"
}
export type SaranMap = Record<string, SaranRiset[]>;

/** Geser tanggal YYYY-MM-DD sekian hari (dibaca WIB, tak bergeser di mesin UTC). */
export function geserTanggal(iso: string, hari: number): string {
    const d = new Date(iso + 'T00:00:00+07:00');
    d.setDate(d.getDate() + hari);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const SHIFT_LABEL: Record<ShiftNama, string> = { malam: 'Malam', pagi: 'Pagi', sore: 'Sore' };

/**
 * Laporan harian yang jendelanya (24:00 kemarin → 24:00) beririsan dengan jendela shift ini.
 * Pembacaan shift: malam 06:00, pagi 14:00, sore 22:00 (malam D = 22:00 D−1 → 06:00 D,
 * melewati tengah malam). Riset di shift pagi/sore D pasti masuk harian D; di shift malam D
 * bisa harian D−1 (sebelum 24:00) atau D.
 */
export function jendelaHarianUntukShift(date: string, shift: ShiftNama): string[] {
    return shift === 'malam' ? [geserTanggal(date, -1), date] : [date];
}

/** Laporan shift yang jendelanya beririsan dengan harian D: malam/pagi/sore D + malam D+1. */
export function jendelaShiftUntukHarian(date: string): { date: string; shift: ShiftNama }[] {
    return [
        { date, shift: 'malam' },
        { date, shift: 'pagi' },
        { date, shift: 'sore' },
        { date: geserTanggal(date, 1), shift: 'malam' },
    ];
}

/** Kumpulkan saran per meter dari baris laporan seri lain. */
export function saranDariBaris(
    rows: { seri: SeriLaporan; date: string; shift?: ShiftNama | null; riset: unknown }[],
): SaranMap {
    const out: SaranMap = {};
    for (const r of rows) {
        const sumber = r.seri === 'harian'
            ? `Laporan Harian ${ddmm(r.date)}`
            : `Shift ${r.shift ? SHIFT_LABEL[r.shift] : ''} ${ddmm(r.date)}`;
        for (const [k, n] of Object.entries(risetStateDariDb(r.riset))) {
            if (n == null) continue;
            (out[k] ??= []).push({ nilai: n, sumber });
        }
    }
    return out;
}

/** Saran yang masuk akal untuk laporan ini: nilai akhir tak mungkin di bawah prev. */
export function pilihSaran(list: SaranRiset[] | undefined, prev: number): SaranRiset | null {
    if (!list || list.length === 0) return null;
    return list.find(s => !(prev > 0) || s.nilai >= prev) ?? null;
}
