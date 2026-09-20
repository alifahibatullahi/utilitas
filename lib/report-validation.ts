/**
 * Validasi nilai laporan shift & harian — bersifat PERINGATAN (boleh tetap disimpan),
 * dipakai untuk mencegah salah input saat operator menyimpan laporan.
 *
 * Aturan:
 *  - Consumption Rate boiler: wajar 0,15–0,25 saat boiler running; saat shutdown ~0 (dilewati).
 *  - Nilai berunit MW (turbin/generator): maksimal 30 MW.
 *  - Totalizer kumulatif: nilai hari ini tidak boleh lebih kecil dari kemarin.
 *  - Konsumsi harian (selisih totalizer): tidak melonjak jauh dari kebiasaannya sendiri.
 */

import { BASELINE_HARI } from './konsumsi-baseline';

export const CR_MIN = 0.15;
export const CR_MAX = 0.25;
export const MW_MAX = 30;

// Ambang lonjakan konsumsi harian. Sengaja "hemat": peringatan yang sering muncul akan
// diklik "Tetap Simpan" tanpa dibaca. Angka ini hasil kalibrasi ke data nyata — ubah
// hanya dengan menguji ulang ke histori, jangan dikira-kira.
export const SELISIH_RASIO_MEDIAN = 3;
export const SELISIH_RASIO_MAX = 1.5;
/** Di bawah ini histori dianggap belum cukup untuk menilai apa pun. */
export const SELISIH_MIN_SAMPEL = 10;

/**
 * Cek Consumption Rate (= batubara_ton / produksi_steam). Hanya divalidasi saat boiler
 * running DAN produksi steam > 0 (CR terdefinisi). Saat shutdown atau belum ada produksi,
 * tidak ada peringatan. Mengembalikan pesan peringatan atau null kalau wajar.
 */
export function checkConsumptionRate(
    label: string,
    batubaraTon: number | null | undefined,
    produksiSteam: number | null | undefined,
    isShutdown: boolean,
): string | null {
    if (isShutdown) return null;
    const prod = Number(produksiSteam) || 0;
    if (prod <= 0) return null; // CR tak terdefinisi (belum ada produksi steam)
    const coal = Number(batubaraTon) || 0;
    const cr = coal / prod;
    if (cr < CR_MIN || cr > CR_MAX) {
        return `Consumption Rate ${label} = ${cr.toFixed(3)} — di luar rentang wajar (${CR_MIN}–${CR_MAX}).`;
    }
    return null;
}

/** Cek nilai berunit MW tidak melebihi MW_MAX (30). Null = wajar / kosong. */
export function checkMaxMW(label: string, value: number | string | null | undefined): string | null {
    if (value == null || value === '') return null;
    const v = Number(value);
    if (!isFinite(v)) return null;
    if (v > MW_MAX) {
        return `${label} = ${v} MW — melebihi maksimal ${MW_MAX} MW.`;
    }
    return null;
}

/**
 * Cek totalizer kumulatif tidak turun. Totalizer hanya bergerak naik, jadi nilai hari ini
 * yang lebih kecil dari kemarin selalu anomali — meter reset, salah ketik, atau angka
 * kemarin yang keliru. Selisihnya sengaja TIDAK diklamp di mana pun; operator yang
 * memutuskan mau memperbaiki isian atau tetap menyimpan.
 * Null = wajar, kosong, atau belum ada pembanding kemarin (sama dengan sel()/selD()
 * yang memperlakukan prev 0 sebagai "tidak ada data kemarin").
 */
export function checkSelisihNegatif(
    label: string,
    today: number | string | null | undefined,
    yesterday: number | string | null | undefined,
): string | null {
    if (today == null || today === '' || yesterday == null || yesterday === '') return null;
    const t = Number(today);
    const y = Number(yesterday);
    if (!isFinite(t) || !isFinite(y) || y <= 0) return null;
    if (t >= y) return null;
    return `${label} = ${t} lebih kecil dari kemarin (${y}) — selisih ${t - y}. Totalizer seharusnya tidak turun.`;
}

/**
 * Cek konsumsi harian (selisih totalizer) yang melonjak jauh dari kebiasaan parameter itu
 * sendiri — salah ketik satu digit di totalizer tidak bikin angkanya negatif, tapi bikin
 * konsumsinya berkali lipat. Pembandingnya median & tertinggi 60 hari terakhir
 * (lihat lib/konsumsi-baseline.ts), bukan ambang tetap: tiap parameter punya skala sendiri
 * dan levelnya bisa berubah berbulan-bulan.
 *
 * Dua syarat harus terpenuhi bersamaan, dan itu yang membuatnya tidak berisik: median
 * menjawab "jauh di atas hari biasa", max menjawab "belum pernah setinggi ini". Diuji ke
 * seluruh data (735 pemeriksaan): median saja = 42 peringatan, keduanya = 1.
 *
 * Null = wajar, kosong, belum ada pembanding kemarin, sampel histori terlalu sedikit,
 * atau selisihnya <= 0 (itu urusan checkSelisihNegatif).
 */
export function checkSelisihTidakWajar(
    label: string,
    today: number | string | null | undefined,
    yesterday: number | string | null | undefined,
    baseline: { med: number; max: number; n: number } | undefined,
): string | null {
    if (today == null || today === '' || yesterday == null || yesterday === '') return null;
    const t = Number(today);
    const y = Number(yesterday);
    if (!isFinite(t) || !isFinite(y) || y <= 0) return null;
    const selisih = t - y;
    if (selisih <= 0) return null;
    if (!baseline || baseline.n < SELISIH_MIN_SAMPEL) return null;
    // max <= 0 berarti parameter ini menganggur sepanjang jendela — tak ada yang bisa
    // dijadikan pembanding, dan tiap angka pertama yang muncul akan terlihat "melonjak".
    if (baseline.max <= 0) return null;
    // med boleh 0 (parameter yang sering tak terpakai, mis. Demin PB1) — uji max yang menjaga.
    if (selisih <= SELISIH_RASIO_MEDIAN * baseline.med) return null;
    if (selisih <= SELISIH_RASIO_MAX * baseline.max) return null;

    const f = (v: number) => (v % 1 !== 0 ? v.toFixed(1) : String(v));
    return `${label}: konsumsi hari ini ${f(selisih)}, biasanya ~${f(baseline.med)}/hari `
        + `(tertinggi ${BASELINE_HARI} hari terakhir ${f(baseline.max)}). Apakah isiannya sudah benar?`;
}

/** Susun pesan konfirmasi dari daftar peringatan untuk ditampilkan via window.confirm. */
export function buildWarningPrompt(warnings: string[]): string {
    return [
        '⚠️ Beberapa nilai sepertinya tidak wajar:',
        '',
        ...warnings.map(w => `• ${w}`),
        '',
        'Periksa kembali input. Tetap simpan?',
    ].join('\n');
}
