'use client';

import { useState } from 'react';
import type { ShiftKey } from '@/lib/constants';
import {
    CoalLoading, CoalLot, HOPPER_LABEL, HopperKey, Sorotan, TON_PER_SHOVEL,
    daftarLoading, formatTanggalPendek, formatTon,
} from '@/lib/coal-storage';

const TAMPIL_AWAL = 5;

const SHIFT_LABEL: Record<ShiftKey, string> = { pagi: 'Pagi', sore: 'Sore', malam: 'Malam' };

// Hopper darat kuning (di darat, dekat truk), hopper laut biru (di dermaga),
// keduanya abu — warna netral supaya tidak terbaca sebagai salah satu.
const HOPPER_CHIP: Record<HopperKey, string> = {
    A: 'bg-amber-100 text-amber-800',
    B: 'bg-sky-100 text-sky-800',
    AB: 'bg-slate-100 text-slate-600',
};

/**
 * Tabel riwayat pengambilan batubara: shift mana mengeruk pilar berapa, berapa
 * shovel, lewat hopper darat atau laut.
 *
 * Tonasenya turunan dari jumlah shovel (1 shovel ± 10 ton), jadi selalu ditulis
 * dengan "±" — yang dicatat operator adalah shovel, bukan timbangan.
 */
export default function RiwayatLoading({ lots, loadings, warna, onSorot }: {
    lots: CoalLot[];
    loadings: CoalLoading[];
    warna: Record<string, string>;
    onSorot: (s: Sorotan | null) => void;
}) {
    const [semua, setSemua] = useState(false);

    const data = daftarLoading(lots, loadings, warna);
    const tampil = semua ? data : data.slice(0, TAMPIL_AWAL);

    return (
        <section className="cs-fade-up rounded-xl border border-slate-200 bg-white p-3.5" style={{ animationDelay: '480ms' }}>
            <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[13px] font-bold text-slate-900">Riwayat loading</h3>
                <span className="ml-auto text-[11px] text-slate-400">1 shovel ± {TON_PER_SHOVEL} ton</span>
            </div>

            {data.length === 0 ? (
                <p className="text-[11px] text-slate-500 mt-3">Belum ada pengambilan yang tercatat.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full mt-2 text-xs">
                        <thead>
                            <tr className="text-left text-[11px] text-slate-400">
                                <th className="font-medium py-1.5 pr-2 w-[92px]">Shift</th>
                                <th className="font-medium py-1.5 pr-2">Diambil dari</th>
                                <th className="font-medium py-1.5 pr-2 text-right w-[62px]">Shovel</th>
                                <th className="font-medium py-1.5 w-[54px]">Hopper</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Index ikut jadi kunci: satu shift bisa saja tercatat dua kali
                                di zona yang sama, dan urutannya sudah deterministik. */}
                            {tampil.map((r, i) => (
                                <tr
                                    key={`${r.loading.tanggal}-${r.loading.shift}-${r.loading.zona}-${i}`}
                                    tabIndex={0}
                                    onMouseEnter={() => onSorot({ tipe: 'zona', nilai: r.loading.zona })}
                                    onMouseLeave={() => onSorot(null)}
                                    onFocus={() => onSorot({ tipe: 'zona', nilai: r.loading.zona })}
                                    onBlur={() => onSorot(null)}
                                    className="border-t border-slate-100 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none transition-colors"
                                >
                                    <td className="py-1.5 pr-2 align-top whitespace-nowrap">
                                        <span className="font-semibold text-slate-900">{formatTanggalPendek(r.loading.tanggal)}</span>
                                        <span className="block text-[11px] text-slate-500">
                                            {SHIFT_LABEL[r.loading.shift]}{r.grup && ` · Grup ${r.grup}`}
                                        </span>
                                    </td>
                                    <td className="py-1.5 pr-2 align-top">
                                        <span className="flex items-center gap-1.5">
                                            {r.warna && <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: r.warna }} />}
                                            <span className="font-semibold text-slate-900 truncate">{r.supplier ?? r.area.singkat}</span>
                                        </span>
                                        <span className="block pl-3.5 text-[11px] text-slate-500 truncate">{r.labelZona}</span>
                                    </td>
                                    <td className="py-1.5 pr-2 text-right align-top whitespace-nowrap">
                                        <span className="font-semibold text-slate-900 tabular-nums">{r.loading.shovel}</span>
                                        <span className="block text-[11px] text-slate-500 tabular-nums">± {formatTon(r.ton)} t</span>
                                    </td>
                                    <td className="py-1.5 align-top">
                                        <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${HOPPER_CHIP[r.loading.hopper]}`}>
                                            {HOPPER_LABEL[r.loading.hopper]}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {data.length > TAMPIL_AWAL && (
                <button
                    type="button"
                    onClick={() => setSemua(s => !s)}
                    className="mt-2.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold
                        text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                    {semua ? 'Ringkas lagi' : `Tampilkan semua (${data.length})`}
                </button>
            )}
        </section>
    );
}
