// Kebiasaan konsumsi harian 7 totalizer air di tab Handling laporan harian —
// dipakai sebagai pembanding "biasanya berapa?" saat menyimpan laporan.
//
// Kenapa median BERJALAN (60 hari terakhir), bukan rata-rata sepanjang masa:
// pemakaian bisa pindah level berbulan-bulan (mis. Hydrant ~210/hari sampai Juli
// 2026 lalu ~950/hari sepanjang Agustus). Pembanding sepanjang masa menganggap
// seluruh level baru itu anomali — diuji ke data nyata, 25 peringatan palsu untuk
// Hydrant saja. Median berjalan ikut pindah bersama pemakaiannya.
//
// Median & max dipakai berdua, bukan salah satu: median menjawab "jauh di atas
// hari biasa", max menjawab "belum pernah setinggi ini". Median sendirian terlalu
// berisik untuk parameter yang naik-turun besar (Hydrant, Demin PB1).

import type { SupabaseClient } from '@supabase/supabase-js';

/** Jendela histori pembanding (hari). */
export const BASELINE_HARI = 60;

/** 7 totalizer kartu "Konsumsi & Penerimaan" — sumber tunggal untuk tab & validasi. */
export const KONSUMSI_TOTALIZER_ROWS = [
    { label: 'RCW 1A',    name: 'tot_rcw_1a' },
    { label: 'Demin',     name: 'tot_demin' },
    { label: 'Demin PB1', name: 'tot_demin_pb1' },
    { label: 'Demin PB3', name: 'tot_demin_pb3' },
    { label: 'Hydrant',   name: 'tot_hydrant' },
    { label: 'Basin',     name: 'tot_basin' },
    { label: 'Service',   name: 'tot_service' },
] as const;

const KOLOM: string[] = KONSUMSI_TOTALIZER_ROWS.map(r => r.name);

// ─── Selisih totalizer & konsumsi air harian ─────────────────────────────────
// Rumus tunggal konsumsi air: dipakai mapper saat menulis DP–DT ke Sheets DAN oleh
// halaman /laporan-harian saat menampilkannya. Sebelumnya rumusnya disalin — sel()
// di daily-sheets-mapper dan selD() di InputHarianForm — sementara kelima kolom
// turunannya di daily_report_totalizer tak punya satu pun penulis, jadi laporan
// terbit menampilkan 0 padahal Sheets benar. Disatukan di sini supaya layar dan
// Sheets mustahil berbeda angka.
//
// computeKonsumsiBaseline di bawah sengaja TIDAK memakai helper ini: pembanding
// median melewati (skip) pasangan hari yang tak terbaca, bukan menghitungnya, dan
// syaratnya lebih ketat (prev <= 0 ikut dibuang).

/** Pembacaan totalizer air satu hari. Longgar (string diterima) karena state form
 *  menyimpan angka sebagai teks sebelum di-submit. */
export interface TotalizerAirReadings {
    tot_rcw_1a?:    number | string | null;
    tot_demin?:     number | string | null;
    tot_demin_pb1?: number | string | null;
    tot_demin_pb3?: number | string | null;
    tot_hydrant?:   number | string | null;
    tot_basin?:     number | string | null;
    tot_service?:   number | string | null;
}

/** Lima angka turunan kartu air — namanya sama dengan kolom daily_report_totalizer. */
export interface KonsumsiAir {
    konsumsi_demin:      number | null; // Sheets DP
    konsumsi_rcw:        number | null; // DQ
    penerimaan_demin_3a: number | null; // DR
    penerimaan_demin_1b: number | null; // DS
    penerimaan_rcw_1a:   number | null; // DT
}

/**
 * Selisih: hari ini − kemarin. null = tidak ada pembanding kemarin (laporan H-1 tak
 * ada, kolomnya kosong, atau 0) — dibedakan dari "konsumsi nol" yang angkanya 0.
 *
 * Totalizer bersifat kumulatif (monoton naik), jadi selisih TIDAK MUNGKIN negatif —
 * hasil <0 selalu anomali (meter reset, salah ketik, atau unit shutdown yang raw-nya
 * belum dibawa). Di-lantai ke 0 supaya tak pernah tampil konsumsi negatif.
 */
export function selisihTotalizer(
    today:     number | string | null | undefined,
    yesterday: number | string | null | undefined,
): number | null {
    const t = today != null ? Number(today) : null;
    const y = yesterday != null ? Number(yesterday) : null;
    if (t === null || y === null || y === 0) return null;
    return Math.max(0, t - y);
}

/**
 * Lima angka kartu air dari pembacaan totalizer hari ini + H-1.
 *
 * RCW = hydrant + basin + service. Komponen yang tak punya pembanding dihitung 0,
 * TAPI kalau ketiganya sama-sama tanpa pembanding hasilnya null (bukan 0) — supaya
 * hari tanpa data sama sekali tidak menyamar jadi "pemakaian RCW nol".
 */
export function hitungKonsumsiAir(
    tot:     TotalizerAirReadings | null | undefined,
    prevTot: TotalizerAirReadings | null | undefined,
): KonsumsiAir {
    const sel = (k: keyof TotalizerAirReadings) => selisihTotalizer(tot?.[k], prevTot?.[k]);

    const hydrant = sel('tot_hydrant');
    const basin   = sel('tot_basin');
    const service = sel('tot_service');

    return {
        konsumsi_demin: sel('tot_demin'),
        konsumsi_rcw: (hydrant !== null || basin !== null || service !== null)
            ? (hydrant ?? 0) + (basin ?? 0) + (service ?? 0)
            : null,
        penerimaan_demin_3a: sel('tot_demin_pb3'),
        penerimaan_demin_1b: sel('tot_demin_pb1'),
        penerimaan_rcw_1a:   sel('tot_rcw_1a'),
    };
}

export interface KonsumsiBaseline {
    med: number;  // median konsumsi harian
    max: number;  // konsumsi harian tertinggi
    n: number;    // jumlah hari pembanding (sampel)
}

export type KonsumsiBaselineMap = Record<string, KonsumsiBaseline>;

/** Satu hari histori: tanggal + pembacaan totalizer-nya. */
export interface BaselineRow {
    date: string; // YYYY-MM-DD
    tot: Record<string, number | null | undefined>;
}

const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Angka yang benar-benar terbaca. null/''/NaN = tidak ada pembacaan — BUKAN nol:
 *  Number(null) = 0, dan kalau itu dibiarkan lolos, hari yang totalizernya kosong
 *  terhitung sebagai "konsumsi 0" dan menyeret median turun. */
const angka = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
};

/** Beda hari kalender antara dua tanggal YYYY-MM-DD (dibaca WIB, jadi tak bergeser di mesin UTC). */
const bedaHari = (a: string, b: string): number =>
    Math.round((Date.parse(b + 'T00:00:00+07:00') - Date.parse(a + 'T00:00:00+07:00')) / 86400000);

/**
 * Bentuk pembanding per kolom dari histori laporan.
 *
 * Hanya pasangan HARI BERURUTAN yang dipakai. Kalau laporan suatu hari tidak ada,
 * selisih ke hari berikutnya mencakup 2+ hari dan otomatis berlipat — 4 Jun 2026
 * terlihat seperti anomali raksasa di ketujuh parameter semata-mata karena harinya
 * bolong. Form membandingkan tepat ke H-1, jadi pembandingnya harus setara.
 *
 * Selisih dilantai 0 persis seperti sel() di daily-sheets-mapper: totalizer kumulatif,
 * hasil negatif selalu salah data dan tidak boleh menyeret median ke bawah.
 */
export function computeKonsumsiBaseline(rows: BaselineRow[]): KonsumsiBaselineMap {
    const urut = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const out: KonsumsiBaselineMap = {};

    for (const kolom of KOLOM) {
        const diffs: number[] = [];
        for (let i = 1; i < urut.length; i++) {
            if (bedaHari(urut[i - 1].date, urut[i].date) !== 1) continue;
            const prev = angka(urut[i - 1].tot[kolom]);
            const cur = angka(urut[i].tot[kolom]);
            // prev <= 0 = belum ada pembanding, sama dengan perlakuan sel().
            if (prev === null || cur === null || prev <= 0) continue;
            diffs.push(Math.max(0, cur - prev));
        }
        out[kolom] = diffs.length > 0
            ? { med: median(diffs), max: Math.max(...diffs), n: diffs.length }
            : { med: 0, max: 0, n: 0 };
    }
    return out;
}

/**
 * Tarik histori totalizer sebelum tanggal laporan lalu bentuk pembandingnya.
 * Akar query = daily_reports supaya .order('date') bekerja di level akar
 * (mengurutkan lewat tabel relasi butuh referencedTable dan lebih rapuh).
 */
export async function fetchKonsumsiBaseline(
    supabase: SupabaseClient,
    opts: { date: string; days?: number },
): Promise<KonsumsiBaselineMap> {
    const days = opts.days ?? BASELINE_HARI;
    // Tanggal dibaca sebagai WIB supaya tidak bergeser sehari di mesin UTC.
    const dari = new Date(opts.date + 'T00:00:00+07:00');
    dari.setDate(dari.getDate() - days);
    const dariStr = [
        dari.getFullYear(),
        String(dari.getMonth() + 1).padStart(2, '0'),
        String(dari.getDate()).padStart(2, '0'),
    ].join('-');

    const { data, error } = await supabase
        .from('daily_reports')
        .select('date, daily_report_totalizer(' + KOLOM.join(', ') + ')')
        .gte('date', dariStr)
        .lt('date', opts.date)
        .order('date', { ascending: true });
    if (error) throw error;

    const rows: BaselineRow[] = [];
    for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
        // Relasi one-to-one: PostgREST mengembalikan objek, bukan array.
        const rel = r.daily_report_totalizer;
        const tot = (Array.isArray(rel) ? rel[0] : rel) as Record<string, number | null> | null | undefined;
        if (tot) rows.push({ date: String(r.date), tot });
    }
    return computeKonsumsiBaseline(rows);
}
