'use client';

import { useState } from 'react';
import { SHIFT_OPTIONS, type ShiftKey } from '@/lib/constants';
import {
    CoalLoading, CoalLot, HOPPER_LABEL, HopperKey, Sorotan, TON_PER_SHOVEL,
    daftarLoadingPerShift, formatTanggalPendek, formatTon,
} from '@/lib/coal-storage';

const TERCAKUP_OPNAME = 'Sudah tercakup dalam opname zona ini, jadi tidak lagi mengurangi denah';

// Per halaman, bukan "tampilkan semua": riwayatnya ratusan baris (3 shift × 60 hari),
// dan membentangkan semuanya membuat halaman memanjang jauh ke bawah.
const PER_HALAMAN = 10;

// ±40px nyata di HP supaya mudah diketuk (ditulis 44px karena body ber-zoom 90%),
// ringkas mulai `sm:`.
const tombolHalaman = `w-11 h-11 sm:w-8 sm:h-8 rounded-lg border border-slate-300 bg-white flex items-center
    justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed
    cursor-pointer transition-colors`;

const SHIFT_LABEL: Record<ShiftKey, string> = { pagi: 'Pagi', sore: 'Sore', malam: 'Malam' };

// Ikon & warna shift sama dengan tab shift di /critical-maintenance.
const SHIFT_IKON: Record<ShiftKey, { ikon: string; warna: string }> = {
    pagi: { ikon: 'light_mode', warna: 'text-amber-500' },
    sore: { ikon: 'wb_twilight', warna: 'text-orange-500' },
    malam: { ikon: 'dark_mode', warna: 'text-indigo-500' },
};

// Jam kerja tiap shift untuk tooltip — tanggal shift malam adalah hari SELESAINYA
// (23:00 hari sebelumnya → 07:00), jadi jamnya perlu bisa dilihat.
const SHIFT_JAM = Object.fromEntries(SHIFT_OPTIONS.map(s => [s.value, s.label])) as Record<ShiftKey, string>;

// Hopper darat kuning (di darat, dekat truk), hopper laut biru (di dermaga),
// keduanya abu — warna netral supaya tidak terbaca sebagai salah satu.
const HOPPER_CHIP: Record<HopperKey, string> = {
    A: 'bg-amber-100 text-amber-800',
    B: 'bg-sky-100 text-sky-800',
    AB: 'bg-slate-100 text-slate-600',
};

/**
 * Tabel riwayat pengambilan batubara, satu baris per shift: shift & grup mana,
 * mengeruk pilar mana saja (bisa lebih dari satu), berapa shovel, lewat hopper
 * darat, laut, atau keduanya.
 *
 * Tonasenya turunan dari jumlah shovel (TON_PER_SHOVEL), jadi selalu ditulis
 * dengan "±" — yang dicatat operator adalah shovel, bukan timbangan.
 */
export default function RiwayatLoading({ lots, loadings, warna, onSorot }: {
    lots: CoalLot[];
    loadings: CoalLoading[];
    warna: Record<string, string>;
    onSorot: (s: Sorotan | null) => void;
}) {
    const [halaman, setHalaman] = useState(0);

    const data = daftarLoadingPerShift(lots, loadings, warna);
    const jumlahHalaman = Math.max(1, Math.ceil(data.length / PER_HALAMAN));
    // Di-clamp saat dibaca, bukan lewat effect: kalau data menyusut setelah refetch,
    // halaman yang tersimpan tak boleh mendarat di halaman kosong.
    const hal = Math.min(halaman, jumlahHalaman - 1);
    const awal = hal * PER_HALAMAN;
    const tampil = data.slice(awal, awal + PER_HALAMAN);

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
                                {/* w-px: kolom selebar isinya (semua nowrap), sisa lebar jatuh ke
                                    "Diambil dari" — supaya muat di HP tanpa gulir samping. */}
                                <th className="font-medium py-1.5 pr-2 w-px">Shift</th>
                                <th className="font-medium py-1.5 pr-2">Diambil dari</th>
                                <th className="font-medium py-1.5 pr-2 text-right w-px">Shovel</th>
                                <th className="font-medium py-1.5 w-px">Hopper</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tampil.map(r => {
                                // Baris tanpa pilar tidak punya petak untuk disorot di denah.
                                const zonas = r.pilar.flatMap(p => (p.loading.zona ? [p.loading.zona] : []));
                                const sorot = zonas.length > 0 ? () => onSorot({ tipe: 'zona', nilai: zonas }) : undefined;
                                const lepas = zonas.length > 0 ? () => onSorot(null) : undefined;
                                // Loading yang lebih tua dari opname terakhir di zonanya sudah tidak
                                // mengurangi denah. Tetap ditampilkan — itu kejadian nyata yang
                                // dilaporkan shift — hanya diredupkan: per pilar, dan seluruh baris
                                // baru redup kalau semua pilarnya tercakup.
                                const tercakup = r.pilar.length > 0 && r.pilar.every(p => !p.berlaku);
                                return (
                                <tr
                                    key={`${r.tanggal}-${r.shift}`}
                                    tabIndex={0}
                                    onMouseEnter={sorot}
                                    onMouseLeave={lepas}
                                    onFocus={sorot}
                                    onBlur={lepas}
                                    title={tercakup ? TERCAKUP_OPNAME : undefined}
                                    className={`border-t border-slate-100 hover:bg-slate-50 focus-visible:bg-slate-50
                                        focus-visible:outline-none transition-colors ${tercakup ? 'opacity-45' : ''}`}
                                >
                                    {/* Shift & grup yang disorot; tanggal cuma keterangan. */}
                                    <td className="py-1.5 pr-2 align-top whitespace-nowrap" title={SHIFT_JAM[r.shift]}>
                                        <span className="flex items-center gap-1">
                                            <span
                                                aria-hidden="true"
                                                className={`material-symbols-outlined text-[15px] ${SHIFT_IKON[r.shift].warna}`}
                                            >
                                                {SHIFT_IKON[r.shift].ikon}
                                            </span>
                                            <span className="font-bold text-slate-900">{SHIFT_LABEL[r.shift]}</span>
                                            {r.grup && (
                                                <span className="rounded bg-slate-100 px-1 text-[11px] font-bold text-slate-700">
                                                    Grup {r.grup}
                                                </span>
                                            )}
                                        </span>
                                        <span className="block pl-5 text-[11px] text-slate-500">{formatTanggalPendek(r.tanggal)}</span>
                                    </td>
                                    {/* Semua pilar shift itu didaftar ke bawah dan dibiarkan turun
                                        baris — tidak di-truncate, supaya tak ada yang terpotong. */}
                                    <td className="py-1.5 pr-2 align-top break-words">
                                        {r.pilar.length > 0 ? (
                                            <ul className="space-y-1">
                                                {r.pilar.map((p, j) => (
                                                    <li
                                                        key={`${p.loading.zona}-${j}`}
                                                        title={!tercakup && !p.berlaku ? TERCAKUP_OPNAME : undefined}
                                                        className={!tercakup && !p.berlaku ? 'opacity-45' : undefined}
                                                    >
                                                        <span className="flex items-start gap-1.5">
                                                            {p.warna && <span className="w-2 h-2 mt-1 rounded-[2px] shrink-0" style={{ background: p.warna }} />}
                                                            <span className="font-semibold text-slate-900">{p.supplier ?? p.area?.singkat}</span>
                                                        </span>
                                                        <span className="block pl-3.5 text-[11px] text-slate-500">{p.labelZona}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            // Total Loading dari laporan shift: form shift belum
                                            // menanyakan pilarnya, jadi jujur dikosongkan.
                                            <span className="text-[11px] text-slate-400">Pilar belum dicatat</span>
                                        )}
                                    </td>
                                    <td className="py-1.5 pr-2 text-right align-top whitespace-nowrap">
                                        {/* Jumlah pecahan per pilar bisa menyisakan koma (95 ÷ 3 × 3), jadi dibatasi. */}
                                        <span className="font-semibold text-slate-900 tabular-nums">
                                            {r.shovel.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                                        </span>
                                        <span className="text-slate-500"> shovel</span>
                                        <span className="block text-[11px] text-slate-500 tabular-nums">± {formatTon(r.ton)} t</span>
                                    </td>
                                    <td className="py-1.5 align-top whitespace-nowrap">
                                        {r.hopper ? (
                                            // Di HP "Hopper:" ditumpuk di atas lokasinya supaya kolomnya sempit.
                                            <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] ${HOPPER_CHIP[r.hopper]}`}>
                                                <span className="block sm:inline">Hopper:</span>{' '}
                                                <span className="font-bold">{HOPPER_LABEL[r.hopper]}</span>
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-slate-400">—</span>
                                        )}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {data.length > PER_HALAMAN && (
                <nav className="flex items-center justify-center gap-3 mt-2.5" aria-label="Halaman riwayat loading">
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
