'use client';

import { Fragment, useState } from 'react';
import ZonaBin from './ZonaBin';
import ZonaDetail from './ZonaDetail';
import {
    CoalArea, CoalLot, formatTon, jumlahZona, persenZona, tonArea, tonZona, zonaIds,
} from '@/lib/coal-storage';

/**
 * Denah tampak-atas satu area.
 *
 * Dua baris flex bertumpuk dengan struktur anak yang persis sama (sel zona
 * flex-1, sel pilar 7px) supaya setiap label jatuh tepat di kolomnya:
 *   baris 1 — petak & pilar
 *   baris 2 — nomor pilar dan persen zona, sejajar di garis yang sama
 * Semua ukuran relatif; body memakai zoom 90% dan AppShell 125% di monitor
 * besar, jadi koordinat piksel absolut akan meleset.
 */
export default function AreaDenah({ area, lots, warna, highlight }: {
    area: CoalArea;
    lots: CoalLot[];
    warna: Record<string, string>;
    highlight: string | null;
}) {
    const [selected, setSelected] = useState<number | null>(null);
    const zonas = zonaIds(area);
    const total = tonArea(lots, area);
    const pct = (total / area.kapasitasTon) * 100;
    const t = area.theme;

    return (
        <section className="mt-6">
            {/* Pita judul — warna solid supaya identitas area langsung terbaca. */}
            <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5" style={{ background: t.pita }}>
                <span className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <span aria-hidden="true" className="material-symbols-outlined text-white text-xl">{area.icon}</span>
                </span>
                <div className="min-w-0">
                    <h2 className="text-white font-bold text-lg leading-tight">{area.nama}</h2>
                    <p className="text-[11px] font-medium" style={{ color: t.subteks }}>
                        {formatTon(area.kapasitasTon)} ton · {area.jumlahPilar} pilar · {jumlahZona(area)} zona
                    </p>
                </div>
                <div className="ml-auto text-right shrink-0">
                    <p className="text-white font-bold text-xl leading-tight">{Math.round(pct)}%</p>
                    <p className="text-[11px] font-medium" style={{ color: t.subteks }}>terisi</p>
                </div>
            </div>

            <div className="h-[5px] rounded-full my-2.5" style={{ background: t.track }}>
                <div className="h-[5px] rounded-full" style={{ width: `${pct}%`, background: t.bar }} />
            </div>

            {/* Di layar sempit denah digeser mendatar; di lg dibuat visible lagi
                supaya popover hover tidak terpotong pembungkus scroll. */}
            <div className="overflow-x-auto lg:overflow-visible pb-1">
                <div style={{ width: `${area.lebarPct}%`, minWidth: area.minWidthPx }}>
                    {area.beratap ? (
                        <div
                            className="h-2.5 mb-1"
                            style={{ background: t.batasAtas, clipPath: 'polygon(0% 100%, 4% 0%, 96% 0%, 100% 100%)' }}
                        />
                    ) : (
                        <div className="h-2.5 mb-1 border-t-2 border-dashed" style={{ borderColor: t.batasAtas }} />
                    )}

                    <div className="flex items-start gap-px border-b-[3px] border-slate-600">
                        {zonas.map((zonaId, i) => (
                            <Fragment key={zonaId}>
                                {i > 0 && (
                                    <div className="w-[7px] shrink-0">
                                        <div className="w-[7px] h-[90px] -mt-3 rounded-sm bg-slate-600" />
                                    </div>
                                )}
                                <ZonaBin
                                    area={area}
                                    zonaId={zonaId}
                                    index={i}
                                    lots={lots}
                                    warna={warna}
                                    highlight={highlight}
                                    onSelect={setSelected}
                                />
                            </Fragment>
                        ))}
                    </div>

                    <div className="flex gap-px h-4 mt-1.5">
                        {zonas.map((zonaId, i) => (
                            <Fragment key={zonaId}>
                                {/* Nomor pilar meluber simetris dari sel 7px tanpa mengubah
                                    lebar kolom; chip abu membedakannya dari persen zona. */}
                                {i > 0 && (
                                    <div className="w-[7px] shrink-0 relative">
                                        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-100 px-[3px] text-[11px] leading-4 text-slate-500">
                                            {i}
                                        </span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0 text-center text-xs leading-4 font-semibold text-slate-900">
                                    {tonZona(lots, zonaId) > 0 ? `${persenZona(lots, zonaId)}%` : '—'}
                                </div>
                            </Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {selected !== null && (
                <div className="lg:hidden mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2.5 relative">
                    <button
                        type="button"
                        onClick={() => setSelected(null)}
                        aria-label="Tutup detail zona"
                        className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-base">close</span>
                    </button>
                    <ZonaDetail area={area} zonaId={zonas[selected]} index={selected} lots={lots} warna={warna} />
                </div>
            )}
        </section>
    );
}
