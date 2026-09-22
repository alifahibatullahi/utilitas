'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import {
    CoalLot, TOTAL_KAPASITAS_TON, formatHari, formatTon, hariCadangan, statusCadangan,
    type PemakaianHarian, type StatusCadangan,
} from '@/lib/coal-storage';

const WARNA_CADANGAN: Record<StatusCadangan, { titik: string; teks: string }> = {
    kritis: { titik: 'bg-red-500', teks: 'text-red-700' },
    waspada: { titik: 'bg-amber-500', teks: 'text-amber-700' },
    aman: { titik: 'bg-emerald-500', teks: 'text-emerald-700' },
};

/**
 * Menghitung naik isi satu elemen dari 0 ke target, sekali saat kartu muncul.
 *
 * Angkanya ditulis langsung ke DOM, bukan lewat state: menaikkannya lewat
 * setState akan me-render ulang seluruh kartu puluhan kali per animasi. Elemen
 * yang dirujuk sudah berisi nilai akhir sejak render pertama, jadi kalau
 * animasinya tidak jalan — gerak dikurangi, atau JS belum sempat hidup —
 * angka yang terbaca tetap benar.
 */
function useCountUp(target: number, durasiMs = 900) {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let raf = 0;
        const mulai = performance.now();
        const tick = (t: number) => {
            const p = Math.min(1, (t - mulai) / durasiMs);
            const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic — cepat di awal, mendarat halus
            el.textContent = formatTon(target * eased);
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(raf);
    }, [target, durasiMs]);

    return ref;
}

/**
 * Angka sorotan halaman: stok yang masih ada di kedua area — seluruh penempatan
 * yang sudah dikurangi loading (pemanggilnya mengirim lot sisa) — dan cukup untuk
 * berapa hari pada laju pemakaian boiler sekarang.
 */
export default function RingkasanEstimasi({ lots, pemakaian }: {
    lots: CoalLot[];
    pemakaian: PemakaianHarian | null;
}) {
    const total = lots.reduce((t, l) => t + l.ton, 0);
    const pct = (total / TOTAL_KAPASITAS_TON) * 100;
    // Hanya angka utama yang dihitung naik; persen dan kapasitas dibiarkan diam
    // supaya kartunya tidak riuh oleh angka yang bergerak semua.
    const angkaRef = useCountUp(total);

    const hari = pemakaian ? hariCadangan(total, pemakaian.tonPerHari) : null;
    // Stok nol tidak diwarnai merah: denah yang belum diisi operator bukan berarti
    // batubaranya habis, dan "0 hari" merah untuk itu cuma bikin panik.
    const warna = hari !== null && total > 0 ? WARNA_CADANGAN[statusCadangan(hari)] : null;

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <div>
                <p className="text-[11px] font-semibold text-orange-800">Stok batubara saat ini</p>
                <p className="text-3xl font-bold text-orange-900 leading-tight tabular-nums">
                    <span ref={angkaRef}>{formatTon(total)}</span> <span className="text-sm font-semibold">ton</span>
                </p>
            </div>
            <div className="flex-1 min-w-[170px]">
                <div className="flex justify-between text-[11px] font-medium text-orange-800 mb-1.5">
                    <span>{Math.round(pct)}% dari kapasitas</span>
                    <span>{formatTon(TOTAL_KAPASITAS_TON)} ton</span>
                </div>
                <div className="h-[7px] rounded-full bg-orange-200">
                    <div
                        className="cs-bar h-[7px] rounded-full bg-orange-600"
                        style={{ '--cs-w': `${pct}%`, width: `${pct}%` } as CSSProperties}
                    />
                </div>
                <p className="text-[11px] font-medium text-orange-800 mt-1.5">
                    ruang kosong {formatTon(TOTAL_KAPASITAS_TON - total)} ton
                </p>
            </div>

            {/* basis-full memaksa baris baru di dalam flex-wrap: status cadangan selalu
                sebaris sendiri di bawah, baik di HP maupun layar lebar. */}
            <div className="basis-full border-t border-orange-200 pt-2.5 flex items-start gap-2">
                <span
                    aria-hidden="true"
                    className={`w-2.5 h-2.5 rounded-full shrink-0 mt-[5px] ${warna?.titik ?? 'bg-slate-300'}`}
                />
                <div className="min-w-0">
                    <p className={`text-sm font-bold leading-snug ${warna?.teks ?? 'text-slate-500'}`}>
                        {!pemakaian
                            ? 'Pemakaian boiler belum tercatat 14 hari terakhir'
                            : total <= 0
                                ? 'Belum ada stok tercatat di denah'
                                : `Cukup ± ${formatHari(hari ?? 0)} hari`}
                    </p>
                    {pemakaian && (
                        <p className="text-[11px] text-orange-800/80 leading-relaxed">
                            pemakaian boiler {formatTon(pemakaian.tonPerHari)} t/hari
                            {' · '}rata-rata {pemakaian.jumlahHari} hari (A + B)
                            {total > 0 && ' · dari stok yang tercatat di denah'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
