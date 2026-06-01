/**
 * Validasi nilai laporan shift & harian — bersifat PERINGATAN (boleh tetap disimpan),
 * dipakai untuk mencegah salah input saat operator menyimpan laporan.
 *
 * Aturan:
 *  - Consumption Rate boiler: wajar 0,15–0,25 saat boiler running; saat shutdown ~0 (dilewati).
 *  - Nilai berunit MW (turbin/generator): maksimal 30 MW.
 */

export const CR_MIN = 0.15;
export const CR_MAX = 0.25;
export const MW_MAX = 30;

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
