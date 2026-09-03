'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { CoalLot, TOTAL_KAPASITAS_TON, formatTon } from '@/lib/coal-storage';

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

/** Angka sorotan halaman: penjumlahan seluruh penempatan di kedua area. */
export default function RingkasanEstimasi({ lots }: { lots: CoalLot[] }) {
    const total = lots.reduce((t, l) => t + l.ton, 0);
    const pct = (total / TOTAL_KAPASITAS_TON) * 100;
    // Hanya angka utama yang dihitung naik; persen dan kapasitas dibiarkan diam
    // supaya kartunya tidak riuh oleh angka yang bergerak semua.
    const angkaRef = useCountUp(total);

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <div>
                <p className="text-[11px] font-semibold text-orange-800">Total estimasi batubara</p>
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
        </div>
    );
}
