'use client';

import { CoalLot, TOTAL_KAPASITAS_TON, formatTon } from '@/lib/coal-storage';

/** Angka sorotan halaman: penjumlahan seluruh penempatan di kedua area. */
export default function RingkasanEstimasi({ lots }: { lots: CoalLot[] }) {
    const total = lots.reduce((t, l) => t + l.ton, 0);
    const pct = (total / TOTAL_KAPASITAS_TON) * 100;

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <div>
                <p className="text-[11px] font-semibold text-orange-800">Total estimasi batubara</p>
                <p className="text-3xl font-bold text-orange-900 leading-tight">
                    {formatTon(total)} <span className="text-sm font-semibold">ton</span>
                </p>
            </div>
            <div className="flex-1 min-w-[170px]">
                <div className="flex justify-between text-[11px] font-medium text-orange-800 mb-1.5">
                    <span>{Math.round(pct)}% dari kapasitas</span>
                    <span>{formatTon(TOTAL_KAPASITAS_TON)} ton</span>
                </div>
                <div className="h-[7px] rounded-full bg-orange-200">
                    <div className="h-[7px] rounded-full bg-orange-600" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] font-medium text-orange-800 mt-1.5">
                    ruang kosong {formatTon(TOTAL_KAPASITAS_TON - total)} ton
                </p>
            </div>
        </div>
    );
}
