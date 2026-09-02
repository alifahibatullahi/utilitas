'use client';

import { CoalLot, formatTon, ringkasSupplier } from '@/lib/coal-storage';

/**
 * Chip per supplier. Hover (atau fokus keyboard) menyorot sebaran supplier itu
 * di denah — zona yang tidak memuatnya diredupkan lewat prop highlight.
 */
export default function SupplierLegend({ lots, onHighlight }: {
    lots: CoalLot[];
    onHighlight: (nama: string | null) => void;
}) {
    const data = ringkasSupplier(lots);
    if (data.length === 0) return null;

    return (
        <section className="mt-6">
            {/* Sorot sebaran jalan lewat hover, jadi ajakannya cuma tampil di layar berkursor. */}
            <p className="text-[11px] text-slate-500 mb-2">
                Supplier<span className="hidden lg:inline"> — arahkan kursor untuk melihat sebarannya</span>
            </p>
            <div className="flex flex-wrap gap-2">
                {data.map(s => (
                    <button
                        key={s.nama}
                        type="button"
                        onMouseEnter={() => onHighlight(s.nama)}
                        onMouseLeave={() => onHighlight(null)}
                        onFocus={() => onHighlight(s.nama)}
                        onBlur={() => onHighlight(null)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1
                            text-[11px] text-slate-700 hover:border-slate-400 transition-colors cursor-pointer
                            focus-visible:outline-none focus-visible:border-slate-400"
                    >
                        <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.warna }} />
                        <span className="font-semibold">{s.nama}</span>
                        <span className="text-slate-400">est. {formatTon(s.ton)} t · {s.jumlahZona} zona</span>
                    </button>
                ))}
            </div>
        </section>
    );
}
