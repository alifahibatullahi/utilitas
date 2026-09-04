'use client';

import { useState } from 'react';
import {
    CoalLot, Sorotan, daftarUmurStok, formatTanggalPendek, formatTon,
} from '@/lib/coal-storage';

const TAMPIL_AWAL = 5;

/**
 * Tabel umur tiap tumpukan yang masih ada di lapangan.
 *
 * Denah cuma bercerita soal ruang — siapa di zona mana, seberapa penuh — jadi
 * pertanyaan "yang mana yang sudah lama mengendap?" tidak terjawab di sana.
 * Tabel ini jawabannya, dan warnanya sengaja memakai peta warna yang sama
 * dengan denah supaya mata langsung nyambung ke petaknya.
 *
 * lots yang masuk ke sini harus lot SISA (setelah dikurangi loading), sehingga
 * tumpukan yang sudah habis diambil tidak ikut terdaftar sebagai yang tertua.
 */
export default function UmurStok({ lots, warna, onSorot }: {
    lots: CoalLot[];
    warna: Record<string, string>;
    onSorot: (s: Sorotan | null) => void;
}) {
    const [urutan, setUrutan] = useState<'terlama' | 'terbaru'>('terlama');
    const [semua, setSemua] = useState(false);

    // Satu daftar untuk dua urutan: "terbaru" hanyalah kebalikannya, jadi tidak
    // perlu menghitung ulang umur tiap kali filternya ditekan.
    const data = daftarUmurStok(lots, warna);
    const terurut = urutan === 'terlama' ? data : [...data].reverse();
    const tampil = semua ? terurut : terurut.slice(0, TAMPIL_AWAL);

    return (
        <section className="cs-fade-up rounded-xl border border-slate-200 bg-white p-3.5" style={{ animationDelay: '420ms' }}>
            <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[13px] font-bold text-slate-900">Umur stok</h3>
                <span className="text-[11px] text-slate-400">{data.length} tumpukan</span>
                <div className="ml-auto inline-flex rounded-lg border border-slate-300 overflow-hidden">
                    {(['terlama', 'terbaru'] as const).map(mode => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setUrutan(mode)}
                            aria-pressed={urutan === mode}
                            className={`px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors ${urutan === mode ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {mode === 'terlama' ? 'Terlama' : 'Terbaru'}
                        </button>
                    ))}
                </div>
            </div>

            {data.length === 0 ? (
                <p className="text-[11px] text-slate-500 mt-3">Belum ada tumpukan tersisa di kedua area.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full mt-2 text-xs">
                        <thead>
                            <tr className="text-left text-[11px] text-slate-400">
                                <th className="font-medium py-1.5 pr-2 w-[52px]">Umur</th>
                                <th className="font-medium py-1.5 pr-2">Tumpukan</th>
                                <th className="font-medium py-1.5 pr-2 text-right w-[78px]">Sisa</th>
                                <th className="font-medium py-1.5 text-right w-[58px]">Masuk</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tampil.map((t, i) => (
                                // Sorotan lewat zona, bukan supplier: tiap tumpukan cuma menempati
                                // satu petak, jadi yang menyala persis petak yang dimaksud baris ini.
                                <tr
                                    key={`${t.lot.zona}-${t.lot.supplier}-${t.lot.tanggal_masuk}-${i}`}
                                    tabIndex={0}
                                    onMouseEnter={() => onSorot({ tipe: 'zona', nilai: t.lot.zona })}
                                    onMouseLeave={() => onSorot(null)}
                                    onFocus={() => onSorot({ tipe: 'zona', nilai: t.lot.zona })}
                                    onBlur={() => onSorot(null)}
                                    className="border-t border-slate-100 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none transition-colors"
                                >
                                    <td className="py-1.5 pr-2 font-semibold text-slate-900 tabular-nums align-top">
                                        {t.umur}<span className="text-[11px] font-medium text-slate-500"> hr</span>
                                    </td>
                                    <td className="py-1.5 pr-2 align-top">
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: t.warna }} />
                                            <span className="font-semibold text-slate-900 truncate">{t.lot.supplier}</span>
                                        </span>
                                        <span className="block pl-3.5 text-[11px] text-slate-500 truncate">{t.labelZona}</span>
                                    </td>
                                    <td className="py-1.5 pr-2 text-right text-slate-500 tabular-nums align-top whitespace-nowrap">
                                        ± {formatTon(t.lot.ton)} t
                                    </td>
                                    <td className="py-1.5 text-right text-[11px] text-slate-400 align-top whitespace-nowrap">
                                        {formatTanggalPendek(t.lot.tanggal_masuk)}
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
