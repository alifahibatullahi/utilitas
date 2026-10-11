'use client';
// Context penanda riset totalizer untuk form laporan shift & harian. Isiannya dirender
// oleh SelisihInfo (SharedComponents) lewat prop `meter`; angka sidebar tiap tab membaca
// nilai akhirnya lewat useNilaiAkhirRiset(). Rumus & penyimpanan: lib/totalizer-riset.ts.
import { createContext, useContext } from 'react';
import type { RisetState, SaranMap } from '@/lib/totalizer-riset';

export interface RisetContextValue {
    /** Kunci ada = riset ditandai; null = ditandai tapi nilai akhir belum diisi. */
    riset: RisetState;
    /** number/null = tandai (dengan/tanpa nilai akhir); undefined = batalkan penanda. */
    setRiset: (meter: string, nilaiAkhir: number | null | undefined) => void;
    /** Riset yang sudah tercatat di laporan seri lain (shift ↔ harian), per meter. */
    saran: SaranMap;
    /** Muat saran (sekali per tanggal/shift) — dipanggil baru saat dibutuhkan: angka
     *  totalizer turun atau tombol Riset ditekan. Tidak membebani tiap buka form. */
    mintaSaran: () => void;
    /** Meter yang penandanya dibatalkan operator — tidak diaktifkan otomatis lagi. */
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
