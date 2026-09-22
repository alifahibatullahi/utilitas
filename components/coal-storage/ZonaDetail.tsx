'use client';

import {
    ambilWarna, CoalArea, CoalLot, formatTanggal, formatTon, jumlahZona,
    kapasitasZona, lotsZona, namaZona, persenZona,
} from '@/lib/coal-storage';

/**
 * Isi kartu detail satu zona — popover hover di layar lebar, baca-saja.
 *
 * Penyuntingan tidak di sini: popover hilang begitu kursor keluar, jadi form di
 * dalamnya mustahil dipakai. Petak yang diketuk membuka ZonaEditor.
 */
export default function ZonaDetail({ area, zonaId, index, lots, warna }: {
    area: CoalArea;
    zonaId: string;
    index: number;
    lots: CoalLot[];
    warna: Record<string, string>;
}) {
    const zLots = lotsZona(lots, zonaId);
    const pct = persenZona(lots, zonaId);
    const kapasitas = kapasitasZona(zonaId);

    return (
        <>
            <p className="text-xs font-semibold text-slate-900">{namaZona(index, jumlahZona(area))}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
                {area.nama} · terisi {pct}% · ruang kosong {100 - pct}%
            </p>

            {zLots.length === 0 ? (
                <p className="text-[11px] text-slate-500 mt-2 pt-1.5 border-t border-slate-100">
                    Kosong — belum ada penempatan.
                </p>
            ) : zLots.map((lot, i) => (
                <div key={`${lot.supplier}-${i}`} className="flex items-start gap-2 mt-2 pt-1.5 border-t border-slate-100">
                    <span
                        className="w-2.5 h-2.5 rounded-[3px] shrink-0 mt-[3px]"
                        style={{ background: ambilWarna(warna, lot.supplier) }}
                    />
                    <div className="min-w-0">
                        {/* Persen tiap supplier dihitung terhadap kapasitas zona, jadi
                            totalnya sama persis dengan persen zona di denah. */}
                        <p className="text-[11px] font-semibold text-slate-900">
                            {lot.supplier} — {Math.round((lot.ton / kapasitas) * 100)}%
                        </p>
                        <p className="text-[11px] text-slate-500">
                            {formatTon(lot.ton)} t · masuk {formatTanggal(lot.tanggal_masuk)}
                        </p>
                    </div>
                </div>
            ))}

            <p className="text-[10px] text-slate-400 mt-2 pt-1.5 border-t border-slate-100">
                Klik petak untuk mengubah isi
            </p>
        </>
    );
}
