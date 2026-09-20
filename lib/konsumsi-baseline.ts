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
