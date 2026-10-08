'use client';

import { useState } from 'react';
import {
    CoalLot, Sorotan, daftarUmurStok, formatTanggalPendek, formatTon,
} from '@/lib/coal-storage';

// Per halaman, sama dengan Riwayat Loading yang bersanding di sebelahnya — dua
// tabel itu sengaja dibuat seragam supaya tingginya sejalan dan terbaca satu pola.
const PER_HALAMAN = 10;

// ±40px nyata di HP supaya mudah diketuk (ditulis 44px karena body ber-zoom 90%),
// ringkas mulai `sm:`.
const tombolHalaman = `w-11 h-11 sm:w-8 sm:h-8 rounded-lg border border-slate-300 bg-white flex items-center
    justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed
    cursor-pointer transition-colors`;

/**
 * Tabel umur tiap tumpukan yang masih ada di lapangan.
 *
 * Denah cuma bercerita soal ruang — siapa di zona mana, seberapa penuh — jadi
 * pertanyaan "yang mana yang sudah lama mengendap?" tidak terjawab di sana.
 * Tabel ini jawabannya, dan warnanya sengaja memakai peta warna yang sama
 * dengan denah supaya mata langsung nyambung ke petaknya.
 *
 * Tampilannya mengikuti RiwayatLoading: umur jadi teks utama dengan tanggal masuk
 * sebagai keterangan kecil, nama tidak dipotong, dan dibagi per halaman.
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
    const [halaman, setHalaman] = useState(0);

    // Satu daftar untuk dua urutan: "terbaru" hanyalah kebalikannya, jadi tidak
    // perlu menghitung ulang umur tiap kali filternya ditekan.
    const data = daftarUmurStok(lots, warna);
    const terurut = urutan === 'terlama' ? data : [...data].reverse();
    const jumlahHalaman = Math.max(1, Math.ceil(terurut.length / PER_HALAMAN));
    // Di-clamp saat dibaca, bukan lewat effect: kalau data menyusut setelah refetch,
    // halaman yang tersimpan tak boleh mendarat di halaman kosong.
    const hal = Math.min(halaman, jumlahHalaman - 1);
    const awal = hal * PER_HALAMAN;
    const tampil = terurut.slice(awal, awal + PER_HALAMAN);

    return (
        <section className="cs-fade-up rounded-xl border border-slate-200 bg-white p-3.5" style={{ animationDelay: '420ms' }}>
            {/* data-sejajar: kepala, thead, lalu tiap baris — urutannya harus sama dengan
                RiwayatLoading, lihat useBarisSejajar. */}
            <div data-sejajar className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[13px] font-bold text-slate-900">Umur stok</h3>
                <span className="text-[11px] text-slate-400">{data.length} tumpukan</span>
                <div className="ml-auto inline-flex rounded-lg border border-slate-300 overflow-hidden">
                    {(['terlama', 'terbaru'] as const).map(mode => (
                        <button
                            key={mode}
                            type="button"
                            // Urutan baru dimulai dari halaman pertama, bukan halaman yang
                            // sedang dibuka di urutan sebelumnya.
                            onClick={() => { setUrutan(mode); setHalaman(0); }}
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
                            <tr data-sejajar className="text-left text-[11px] text-slate-400">
                                {/* w-px: kolom selebar isinya (semua nowrap), sisa lebar jatuh ke
                                    "Tumpukan" — supaya muat di HP tanpa gulir samping. */}
                                <th className="font-medium py-1.5 pr-2 w-px">Umur</th>
                                <th className="font-medium py-1.5 pr-2">Tumpukan</th>
                                <th className="font-medium py-1.5 text-right w-px">Sisa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tampil.map((t, i) => (
                                // Sorotan lewat zona, bukan supplier: tiap tumpukan cuma menempati
                                // satu petak, jadi yang menyala persis petak yang dimaksud baris ini.
                                <tr
                                    key={t.lot.id ?? `${t.lot.zona}-${t.lot.supplier}-${t.lot.tanggal_masuk}-${awal + i}`}
                                    data-sejajar
                                    tabIndex={0}
                                    onMouseEnter={() => onSorot({ tipe: 'zona', nilai: [t.lot.zona] })}
                                    onMouseLeave={() => onSorot(null)}
                                    onFocus={() => onSorot({ tipe: 'zona', nilai: [t.lot.zona] })}
                                    onBlur={() => onSorot(null)}
                                    className="border-t border-slate-100 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none transition-colors"
                                >
                                    {/* Umur yang disorot; tanggal masuk cuma keterangan. */}
                                    <td className="py-1.5 pr-2 align-top whitespace-nowrap">
                                        <span className="font-bold text-slate-900 tabular-nums">{t.umur}</span>
                                        <span className="text-slate-500"> hari</span>
                                        <span className="block text-[11px] text-slate-500">{formatTanggalPendek(t.lot.tanggal_masuk)}</span>
                                    </td>
                                    {/* Nama tongkang dibiarkan turun baris — tidak di-truncate. */}
                                    <td className="py-1.5 pr-2 align-top break-words">
                                        <span className="flex items-start gap-1.5">
                                            <span className="w-2 h-2 mt-1 rounded-[2px] shrink-0" style={{ background: t.warna }} />
                                            <span className="font-semibold text-slate-900">{t.lot.supplier}</span>
                                        </span>
                                        <span className="block pl-3.5 text-[11px] text-slate-500">{t.labelZona}</span>
                                    </td>
                                    <td className="py-1.5 text-right align-top whitespace-nowrap">
                                        <span className="text-slate-500">± </span>
                                        <span className="font-semibold text-slate-900 tabular-nums">{formatTon(t.lot.ton)}</span>
                                        <span className="text-slate-500"> t</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {data.length > PER_HALAMAN && (
                <nav className="flex items-center justify-center gap-3 mt-2.5" aria-label="Halaman umur stok">
                    <button
                        type="button"
                        onClick={() => setHalaman(hal - 1)}
                        disabled={hal === 0}
                        aria-label="Halaman sebelumnya"
                        className={tombolHalaman}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    <span className="text-[11px] text-slate-500 tabular-nums min-w-[96px] text-center">
                        {awal + 1}–{awal + tampil.length} dari {data.length}
                    </span>
                    <button
                        type="button"
                        onClick={() => setHalaman(hal + 1)}
                        disabled={hal >= jumlahHalaman - 1}
                        aria-label="Halaman berikutnya"
                        className={tombolHalaman}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                </nav>
            )}
        </section>
    );
}
