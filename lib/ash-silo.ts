// Spesifikasi & konversi level Ash Silo (Fly Ash) UBB — 2 silo identik (A & B).
// Sumber: tabel "Level Ash Silo (Fly Ash)" (foto lapangan): silinder Ø6700 mm 274 m³
// + kerucut bawah 58,7 m³ (puncak kerucut di level 40% / 4,80 m).

export type SiloId = 'A' | 'B';

export const SILO_IDS: SiloId[] = ['A', 'B'];

export const SILO_SPEC = {
    totalM3: 332.7,
    totalTon: 266.2,
    totalHeightM: 12.69, // tinggi pada level 100%
    coneTopPct: 40,      // baris 20–40% tabel = daerah kerucut
    coneHeightM: 4.8,
    diameterMm: 6700,
};

// [level %, tinggi m, volume m³, berat ton] — anchor [0,0,0,0] di depan agar
// daerah di bawah 20% (tak ada di tabel) diinterpolasi linear menuju nol.
// Catatan foto "1% = 3,54 ton" tidak konsisten dengan tabel (daerah linear
// ≈3,65 ton/%); tabel dipakai sebagai sumber kebenaran.
export const SILO_TABLE: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, 0, 0, 0],
    [20, 2.20, 2.30, 1.80],
    [30, 3.60, 23.55, 18.80],
    [40, 4.80, 58.70, 47.00],
    [50, 6.35, 105.70, 84.60],
    [60, 7.61, 150.00, 120.00],
    [70, 8.88, 195.70, 156.60],
    [80, 10.15, 241.40, 193.10],
    [90, 11.42, 287.00, 229.60],
    [100, 12.69, 332.70, 266.20],
];

function lerpFromTable(pct: number, col: 1 | 2 | 3): number {
    const p = Math.min(100, Math.max(0, pct));
    for (let i = 1; i < SILO_TABLE.length; i++) {
        const [x1] = SILO_TABLE[i];
        if (p <= x1) {
            const [x0] = SILO_TABLE[i - 1];
            const y0 = SILO_TABLE[i - 1][col];
            const y1 = SILO_TABLE[i][col];
            return y0 + (y1 - y0) * ((p - x0) / (x1 - x0));
        }
    }
    return SILO_TABLE[SILO_TABLE.length - 1][col];
}

export function siloHeightM(pct: number): number { return lerpFromTable(pct, 1); }
export function siloVolumeM3(pct: number): number { return lerpFromTable(pct, 2); }
export function siloWeightTon(pct: number): number { return lerpFromTable(pct, 3); }

// Tinggi isi untuk VISUAL silo: pakai tinggi fisik (bukan % mentah) supaya
// geometri kerucut akurat — level 40% jatuh tepat di sambungan kerucut-silinder.
export function siloFillHeightPct(pct: number): number {
    return (siloHeightM(pct) / SILO_SPEC.totalHeightM) * 100;
}

// Arah alarm TERBALIK dari tangki: level TINGGI = silo penuh = perlu unloading.
export const SILO_THRESHOLDS = { warning_high: 70, critical_high: 85 };

export function getSiloStatus(pct: number): 'normal' | 'warning' | 'critical' {
    if (pct >= SILO_THRESHOLDS.critical_high) return 'critical';
    if (pct >= SILO_THRESHOLDS.warning_high) return 'warning';
    return 'normal';
}
