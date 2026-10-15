'use client';
// Context penanda riset (reset) totalizer untuk form laporan shift & harian. Isiannya dirender
// oleh TotalizerField (SharedComponents) lewat prop `meter`; angka sidebar tiap tab membaca
// nilai akhirnya lewat useNilaiAkhirRiset(). Rumus & penyimpanan: lib/totalizer-riset.ts.
import { createContext, useContext } from 'react';
import type { RisetState, SaranMap } from '@/lib/totalizer-riset';

export interface RisetContextValue {
    /** Kunci ada = riset ditandai; null = ditandai tapi nilai akhir belum diisi. */
    riset: RisetState;
    /** Isian operator. number/null = tandai (dengan/tanpa nilai akhir); undefined = batalkan. */
    setRiset: (meter: string, nilaiAkhir: number | null | undefined) => void;
    /** Riset yang sudah dicatat laporan PASANGAN (shift ↔ harian) dan belum dipakai seri
     *  laporan ini — lihat hitungPasanganRiset. Dipakai untuk mengisi otomatis. */
    saran: SaranMap;
    /** Meter yang penandanya hasil isi otomatis dari laporan pasangan (belum diubah operator). */
    otomatis: ReadonlySet<string>;
    terapkanOtomatis: (meter: string, nilaiAkhir: number) => void;
    lepasOtomatis: (meter: string) => void;
    /** Meter yang penandanya dibatalkan operator — tidak diisi otomatis lagi di sesi ini. */
    ditolak: ReadonlySet<string>;
    tolak: (meter: string) => void;
}

const RisetContext = createContext<RisetContextValue | null>(null);

export const RisetProvider = RisetContext.Provider;

export function useRisetContext(): RisetContextValue | null {
    return useContext(RisetContext);
}

/** Nilai akhir riset yang siap dihitung untuk sebuah meter (undefined = tidak riset / belum diisi). */
export function useNilaiAkhirRiset(): (meter: string) => number | undefined {
    const ctx = useContext(RisetContext);
    return (meter: string) => {
        const v = ctx?.riset[meter];
        return v != null && v > 0 ? v : undefined;
    };
}
