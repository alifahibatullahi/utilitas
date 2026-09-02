'use client';

import ZonaDetail from './ZonaDetail';
import {
    ambilWarna, CoalArea, CoalLot, jumlahZona, kapasitasZona, lotsZona, namaZona,
} from '@/lib/coal-storage';

// Siluet gundukan batubara: trapesium dengan bahu miring di atas, bukan kotak.
// Pakai persen supaya kemiringannya ikut proporsional saat isinya rendah.
const PILE_CLIP = 'polygon(0% 100%, 0% 20%, 13% 0%, 87% 0%, 100% 20%, 100% 100%)';

export default function ZonaBin({ area, zonaId, index, lots, warna, highlight, onSelect }: {
    area: CoalArea;
    zonaId: string;
    index: number;
    lots: CoalLot[];
    warna: Record<string, string>;
    highlight: string | null;
    onSelect: (index: number) => void;
}) {
    const zLots = lotsZona(lots, zonaId);
    const total = zLots.reduce((t, l) => t + l.ton, 0);
    const pct = Math.min(100, (total / kapasitasZona(zonaId)) * 100);
    const kosong = total === 0;
    const dim = !!highlight && !zLots.some(l => l.supplier === highlight);
    const jml = jumlahZona(area);

    // Kartu popover dirapatkan ke tepi di zona ujung supaya tidak terpotong.
    const align = index < 3 ? 'left-0'
        : index > jml - 4 ? 'right-0'
        : 'left-1/2 -translate-x-1/2';

    return (
        <div className="group relative flex-1 min-w-0 hover:z-10 focus-within:z-10">
            {/* Detail hover — hanya layar lebar; di HP dipakai kartu di bawah denah. */}
            <div
                className={`hidden lg:group-hover:block lg:group-focus-within:block absolute bottom-full mb-2
                    w-[212px] rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-left z-10 ${align}`}
            >
                <ZonaDetail area={area} zonaId={zonaId} index={index} lots={lots} warna={warna} />
            </div>

            <button
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`${namaZona(index, jml)} — ${Math.round(pct)}% terisi`}
                className={`relative block w-full h-[78px] rounded-[3px] border overflow-hidden cursor-pointer
                    transition-opacity group-hover:border-2 group-hover:border-sky-600
                    focus-visible:outline-none focus-visible:border-2 focus-visible:border-sky-600
                    ${kosong ? 'border-dashed border-slate-300 bg-slate-50' : 'border-slate-300 bg-[#eff3f8]'}
                    ${dim ? 'opacity-20' : 'opacity-100'}`}
            >
                {total > 0 && (
                    <span
                        className="absolute inset-x-0 bottom-0 flex flex-col-reverse"
                        style={{ height: `${pct}%`, clipPath: PILE_CLIP }}
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
