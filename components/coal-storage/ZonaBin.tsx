'use client';

import type { CSSProperties } from 'react';
import ZonaDetail from './ZonaDetail';
import {
    ambilWarna, CoalArea, CoalLot, jumlahZona, kapasitasZona, lotsZona, namaZona, Sorotan,
} from '@/lib/coal-storage';

// Siluet gundukan batubara: trapesium dengan bahu miring di atas, bukan kotak.
// Pakai persen supaya kemiringannya ikut proporsional saat isinya rendah.
const PILE_CLIP = 'polygon(0% 100%, 0% 20%, 13% 0%, 87% 0%, 100% 20%, 100% 100%)';

export default function ZonaBin({ area, zonaId, index, delayMs, lots, warna, highlight, onSelect, onHover, melebar }: {
    area: CoalArea;
    zonaId: string;
    index: number;
    delayMs: number;
    lots: CoalLot[];
    warna: Record<string, string>;
    highlight: Sorotan | null;
    onSelect: (index: number) => void;
    /** Petak yang sedang disentuh kursor/fokus. Dilaporkan ke AreaDenah, bukan
     *  disimpan sendiri, karena sel persen di baris bawah harus melebar SINKRON
     *  dengan petak ini — dan sel itu sibling, bukan anak. */
    onHover: (index: number | null) => void;
    melebar: boolean;
}) {
    const zLots = lotsZona(lots, zonaId);
    const total = zLots.reduce((t, l) => t + l.ton, 0);
    const pct = Math.min(100, (total / kapasitasZona(zonaId)) * 100);
    const kosong = total === 0;
    // Sorotan supplier menyalakan semua petak yang memuatnya; sorotan zona
    // (dari tabel di bawah denah) cuma menyalakan satu petak.
    const dim = !!highlight && (highlight.tipe === 'zona'
        ? highlight.nilai !== zonaId
        : !zLots.some(l => l.supplier === highlight.nilai));
    const jml = jumlahZona(area);

    // Kartu popover dirapatkan ke tepi di zona ujung supaya tidak terpotong.
    const align = index < 3 ? 'left-0'
        : index > jml - 4 ? 'right-0'
        : 'left-1/2 -translate-x-1/2';

    return (
        // Petak yang disentuh kursor melebar dan mendorong tetangganya menyempit.
        // Digerbangi lg: layar sentuh tidak pernah melebar — di HP onMouseEnter ikut
        // menyala saat diketuk dan petaknya akan tersangkut lebar; HP tetap memakai
        // kartu detail di bawah denah. Transisinya ditulis eksplisit karena aturan
        // global `*` hanya mencakup background/border/shadow.
        <div
            className={`cs-lebar group relative flex-1 min-w-0 hover:z-10 focus-within:z-10
                transition-[flex-grow] duration-200 ease-out ${melebar ? 'lg:flex-[3]' : ''}`}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(null)}
            // onFocus/onBlur di React ikut menggelembung dari tombol di dalamnya,
            // jadi petak juga melebar saat dicapai lewat keyboard.
            onFocus={() => onHover(index)}
            onBlur={() => onHover(null)}
        >
            {/* Detail hover — hanya layar lebar; di HP dipakai kartu di bawah denah. */}
            {/* Selalu ter-render di layar lebar tapi transparan, supaya munculnya bisa
                dianimasikan (display tidak bisa ditransisikan). Posisinya absolute,
                jadi tidak menyentuh layout; pointer-events dimatikan saat tersembunyi.
                Transisinya ditulis eksplisit karena aturan `*` global hanya mencakup
                background/border/shadow. Geseran vertikalnya aman berdampingan dengan
                -translate-x-1/2 milik align: di Tailwind v4 keduanya menulis properti
                `translate` lewat variabel terpisah. */}
            <div
                className={`hidden lg:block absolute bottom-full mb-2 w-[212px] rounded-lg border border-slate-400
                    bg-white px-3 py-2.5 text-left z-10 shadow-sm opacity-0 translate-y-1 pointer-events-none
                    transition-[opacity,translate] duration-200 ease-out
                    lg:group-hover:opacity-100 lg:group-hover:translate-y-0 lg:group-hover:pointer-events-auto
                    lg:group-focus-within:opacity-100 lg:group-focus-within:translate-y-0 lg:group-focus-within:pointer-events-auto ${align}`}
            >
                <ZonaDetail area={area} zonaId={zonaId} index={index} lots={lots} warna={warna} />
            </div>

            <button
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`${namaZona(index, jml)} — ${Math.round(pct)}% terisi`}
                // Sorotan hover pakai ring, bukan border-2: menebalkan border menggeser
                // isi petak 1px tiap kali kursor lewat, sedangkan ring tidak menyentuh layout.
                className={`relative block w-full h-[78px] rounded-[3px] border overflow-hidden cursor-pointer
                    ring-2 ring-transparent transition-[opacity,box-shadow] duration-300
                    group-hover:ring-sky-600 focus-visible:outline-none focus-visible:ring-sky-600
                    ${kosong ? 'border-dashed border-slate-300 bg-slate-50' : 'border-slate-300 bg-[#eff3f8]'}
                    ${dim ? 'opacity-20' : 'opacity-100'}`}
            >
                {total > 0 && (
                    <span
                        className="cs-pile absolute inset-x-0 bottom-0 flex flex-col-reverse"
                        style={{
                            '--cs-tinggi': `${pct}%`,
                            height: `${pct}%`,
                            clipPath: PILE_CLIP,
                            animationDelay: `${delayMs}ms`,
                        } as CSSProperties}
                    >
                        {zLots.map((lot, i) => (
                            <span
                                key={`${lot.supplier}-${i}`}
                                className="block w-full"
                                style={{ height: `${(lot.ton / total) * 100}%`, background: ambilWarna(warna, lot.supplier) }}
                            />
                        ))}
                    </span>
                )}
            </button>
        </div>
    );
}
