'use client';

import { CoalLot, formatTon, ringkasSupplier, Sorotan } from '@/lib/coal-storage';

/**
 * Chip per supplier. Hover (atau fokus keyboard) menyorot sebaran supplier itu
 * di denah — zona yang tidak memuatnya diredupkan lewat prop highlight.
 *
 * Peta warna dititipkan dari halaman (bukan dihitung ulang di sini) karena lots
 * yang masuk adalah lot sisa: supplier yang stoknya habis tidak ada di daftar,
 * dan palet yang dihitung ulang akan menggeser warna supplier lainnya.
 */
export default function SupplierLegend({ lots, warna, onSorot }: {
    lots: CoalLot[];
    warna: Record<string, string>;
    onSorot: (s: Sorotan | null) => void;
}) {
    const data = ringkasSupplier(lots, warna);
    if (data.length === 0) return null;

    return (
        <section className="cs-fade-up mt-6" style={{ animationDelay: '420ms' }}>
            {/* Sorot sebaran jalan lewat hover, jadi ajakannya cuma tampil di layar berkursor. */}
            <p className="text-[11px] text-slate-500 mb-2">
                Supplier<span className="hidden lg:inline"> — arahkan kursor untuk melihat sebarannya</span>
            </p>
            <div className="flex flex-wrap gap-2">
                {data.map(s => (
                    <button
                        key={s.nama}
                        type="button"
                        onMouseEnter={() => onSorot({ tipe: 'supplier', nilai: s.nama })}
                        onMouseLeave={() => onSorot(null)}
                        onFocus={() => onSorot({ tipe: 'supplier', nilai: s.nama })}
                        onBlur={() => onSorot(null)}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1
                            text-[11px] text-slate-700 hover:border-slate-400 hover:shadow-sm hover:-translate-y-px
                            transition-[border-color,box-shadow,translate] duration-200 cursor-pointer
                            focus-visible:outline-none focus-visible:border-slate-400"
                    >
                        <span
                            className="w-2.5 h-2.5 rounded-[3px] transition-transform duration-200 group-hover:scale-125"
                            style={{ background: s.warna }}
                        />
                        <span className="font-semibold">{s.nama}</span>
                        <span className="text-slate-400">est. {formatTon(s.ton)} t · {s.jumlahZona} zona</span>
                    </button>
                ))}
            </div>
        </section>
    );
}
