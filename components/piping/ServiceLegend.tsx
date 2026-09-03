'use client';

import { FLUIDA, FluidKey, PipingLine, fluidaDipakai } from '@/lib/piping';

/**
 * Kunci gambar: warna garis = isi pipa. Arahkan kursor pada satu service untuk
 * menyorot jalurnya saja — pola yang sama dipakai SupplierLegend di
 * /coal-storage.
 *
 * Sorot lewat kursor (onHover) dan sorot terkunci (onPin) dipisah: di HP tidak
 * ada hover, jadi ketukan harus mengunci. Kalau dijadikan satu state, hover
 * sudah menyalakan sorot lebih dulu sehingga ketukan malah mematikannya.
 */
export default function ServiceLegend({ lines, highlight, pin, onHover, onPin }: {
    lines: PipingLine[];
    highlight: FluidKey | null;
    pin: FluidKey | null;
    onHover: (k: FluidKey | null) => void;
    onPin: (k: FluidKey | null) => void;
}) {
    const dipakai = fluidaDipakai(lines);

    return (
        <section className="pp-fade-up mt-5" style={{ animationDelay: '520ms' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Isi jalur (service)
                <span className="hidden lg:inline font-medium normal-case tracking-normal text-slate-400">
                    {' '}— arahkan kursor untuk menyorot satu jalur
                </span>
            </p>
            <div className="flex flex-wrap gap-2">
                {dipakai.map(k => {
                    const f = FLUIDA[k];
                    const aktif = highlight === k;
                    return (
                        <button
                            key={k}
                            type="button"
                            onMouseEnter={() => onHover(k)}
                            onMouseLeave={() => onHover(null)}
                            onFocus={() => onHover(k)}
                            onBlur={() => onHover(null)}
                            onClick={() => onPin(pin === k ? null : k)}
                            aria-pressed={pin === k}
                            className={`group inline-flex items-center gap-2 rounded-full border bg-white px-2.5 py-1 text-[11px]
                                text-slate-700 hover:shadow-sm hover:-translate-y-px cursor-pointer
                                transition-[border-color,box-shadow,translate] duration-200
                                focus-visible:outline-none focus-visible:border-slate-400
                                ${aktif ? 'border-slate-400 shadow-sm' : 'border-slate-200 hover:border-slate-400'}`}
                        >
                            <span
                                className="w-5 h-[3px] rounded-full transition-transform duration-200 group-hover:scale-x-125"
                                style={{ background: f.warna }}
                            />
                            <span className="font-bold" style={{ color: f.warna }}>{f.kode}</span>
                            <span className="font-semibold">{f.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Keterangan konvensi gambar — tanpa ini tag line & garis putus-putus
                tidak bisa dibaca orang yang baru pertama membuka halaman ini. */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-[11px] leading-relaxed text-slate-600">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <p className="font-bold text-slate-700 mb-1.5">Cara membaca gambar</p>
                    <ul className="space-y-1">
                        <li>· Proyeksi isometrik 30°; <span className="font-semibold">N</span> di pojok kanan atas menunjukkan arah utara.</li>
                        <li>· Garis <span className="font-semibold">penuh</span> = rute sudah dipastikan.</li>
                        <li>· Garis <span className="font-semibold">putus-putus</span> = masih rangka, menunggu koreksi lapangan.</li>
                        <li>· Panah menunjukkan arah aliran.</li>
                    </ul>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <p className="font-bold text-slate-700 mb-1.5">Penomoran</p>
                    <ul className="space-y-1">
                        <li>· Tag line: <span className="font-semibold">ukuran&quot;-SERVICE-nomor</span> (mis. 6&quot;-CWS-1401). Ukuran belum ditulis selama belum dipastikan.</li>
                        <li>· Tag peralatan: TK tangki · P pompa · DA deaerator · B boiler · CT cooling tower · E penukar kalor · WT/DM unit pengolahan.</li>
                    </ul>
                </div>
            </div>
        </section>
    );
}
