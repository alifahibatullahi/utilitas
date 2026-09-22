'use client';

import { Fragment } from 'react';
import ZonaBin from './ZonaBin';
import {
    CoalArea, CoalLot, DENAH_MIN_WIDTH_PX, formatTon, jumlahZona,
    persenZona, Sorotan, tonArea, tonZona, zonaIds,
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
 *
 * areaIndex hanya menentukan urutan animasi masuk: area kedua menyusul setelah
 * area pertama, lalu zona di dalamnya tumbuh berurutan kiri → kanan.
 *
 * Zona yang diketuk dilaporkan ke atas, bukan disimpan di sini: penyuntingnya satu
 * untuk seluruh halaman, jadi mengetuk zona di Closed harus menutup zona Open yang
 * sedang terbuka — mustahil kalau tiap area memegang pilihannya sendiri.
 */
export default function AreaDenah({ area, areaIndex, lots, warna, highlight, onPilihZona }: {
    area: CoalArea;
    areaIndex: number;
    lots: CoalLot[];
    warna: Record<string, string>;
    highlight: Sorotan | null;
    onPilihZona: (zonaId: string) => void;
}) {
    const zonas = zonaIds(area);
    const total = tonArea(lots, area);
    const pct = (total / area.kapasitasTon) * 100;
    const t = area.theme;

    // Basis penundaan area; tiap zona menambah 45ms supaya gundukannya beriring.
    const basis = 160 + areaIndex * 100;
    const delayZona = (i: number) => basis + 60 + i * 45;

    return (
        <section className="mt-6">
            {/* Pita judul — warna solid supaya identitas area langsung terbaca. */}
            <div
                className="cs-fade-up flex items-center gap-3 rounded-xl px-3.5 py-2.5 mb-3"
                style={{ background: t.pita, animationDelay: `${basis}ms` }}
            >
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

            {/* Di layar sempit denah digeser mendatar; di lg dibuat visible lagi
                supaya popover hover tidak terpotong pembungkus scroll. */}
            <div className="overflow-x-auto lg:overflow-visible pb-1">
                {/* Tanpa lebar relatif: kedua area mengisi penuh induknya supaya
                    denah Open dan Closed sama lebar. */}
                <div style={{ minWidth: DENAH_MIN_WIDTH_PX }}>
                    {area.beratap ? (
                        <div
                            className="cs-atap h-2.5 mb-1"
                            style={{
                                background: t.batasAtas,
                                clipPath: 'polygon(0% 100%, 4% 0%, 96% 0%, 100% 100%)',
                                animationDelay: `${basis + 40}ms`,
                            }}
                        />
                    ) : (
                        <div
                            className="cs-atap h-2.5 mb-1 border-t-2 border-dashed"
                            style={{ borderColor: t.batasAtas, animationDelay: `${basis + 40}ms` }}
                        />
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
                                    delayMs={delayZona(i)}
                                    lots={lots}
                                    warna={warna}
                                    highlight={highlight}
                                    onSelect={onPilihZona}
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
                                        {/* Pemusatan dan animasi dipisah ke dua span: keyframes
                                            fade-up menulis ulang transform, jadi -translate-x-1/2
                                            tidak boleh menempel di elemen yang sama. */}
                                        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
                                            <span
                                                className="cs-fade-up inline-block rounded bg-slate-100 px-[3px] text-[11px] leading-4 text-slate-500"
                                                style={{ animationDelay: `${delayZona(i)}ms` }}
                                            >
                                                {i}
                                            </span>
                                        </span>
                                    </div>
                                )}
                                {/* Persen menyusul gundukan di kolom yang sama, jadi angkanya
                                    terbaca tepat setelah tumpukannya selesai tumbuh. */}
                                <div
                                    className="cs-fade-up flex-1 min-w-0 text-center text-xs leading-4 font-semibold text-slate-900"
                                    style={{ animationDelay: `${delayZona(i) + 220}ms` }}
                                >
                                    {tonZona(lots, zonaId) > 0 ? `${persenZona(lots, zonaId)}%` : '—'}
                                </div>
                            </Fragment>
                        ))}
                    </div>
                </div>
            </div>

        </section>
    );
}
