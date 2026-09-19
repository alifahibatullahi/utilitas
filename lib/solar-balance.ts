/**
 * Neraca tanki solar harian — satu rumus untuk semua pemakai (Review Solar di
 * Publish Laporan Harian, TabHandling, halaman Laporan Harian, dan mapper LHUBB).
 *
 * Pemakaian Boiler A+B (kolom CL) tidak punya sumber catatan sendiri: tidak ada
 * entri permintaan untuk boiler, yang ada hanya level tanki. Jadi nilainya
 * diturunkan dari neraca — sisa penurunan volume yang tidak terjelaskan oleh
 * kedatangan (CK) dan pemakaian lain (CM bengkel, CN SA/SU 3B):
 *
 *   CL = (level kemarin − level hari ini) × 2 + kedatangan − bengkel − SA/SU 3B
 *
 * Level dicatat per tanki dan tankinya ada dua dengan isi sama (mapper menulis
 * nilai yang sama ke CH & CI), makanya dikali 2.
 */

export const JUMLAH_TANKI = 2;

export interface NeracaSolarInput {
    prevLevel: number | null;   // m³ per tanki, level kemarin (CH hari sebelumnya)
    level: number | null;       // m³ per tanki, level hari ini (CH)
    kedatangan: number;         // m³ — CK
    bengkel: number;            // m³ — CM
    sasu: number;               // m³ — CN
}

export interface NeracaSolar {
    turun: number;      // m³ volume berkurang (negatif = level naik)
    kedatangan: number; // m³ masuk
    keluarLain: number; // m³ bengkel + SA/SU 3B
    boiler: number;     // m³ sisa neraca → Pemakaian Boiler A+B (CL), tak pernah negatif
}

const bulat2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: number | string | null | undefined) => Number(v) || 0;

/**
 * Rincian neraca. `null` bila level kemarin atau hari ini belum ada — pemanggil
 * yang memutuskan fallback (mapper: 0; UI: tampilkan tanda strip).
 */
export function hitungNeracaSolar(i: NeracaSolarInput): NeracaSolar | null {
    if (i.prevLevel == null || i.level == null) return null;

    const turun = bulat2((Number(i.prevLevel) - Number(i.level)) * JUMLAH_TANKI);
    const kedatangan = bulat2(num(i.kedatangan));
    const keluarLain = bulat2(num(i.bengkel) + num(i.sasu));
    // Dilantai 0: level naik atau kedatangan lebih besar dari pemakaian bukan
    // berarti boiler "menghasilkan" solar. Sejalan dgn sel() di daily-sheets-mapper.
    const boiler = Math.max(0, bulat2(turun + kedatangan - keluarLain));

    return { turun, kedatangan, keluarLain, boiler };
}

/** Pemakaian Boiler A+B (m³) hasil neraca, atau null bila level belum lengkap. */
export function defaultSolarBoiler(i: NeracaSolarInput): number | null {
    return hitungNeracaSolar(i)?.boiler ?? null;
}
