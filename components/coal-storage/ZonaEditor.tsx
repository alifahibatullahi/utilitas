'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { detectCurrentShift } from '@/lib/constants';
import type { CoalLotKoreksiRow } from '@/lib/supabase/types';
import { riwayatLot, simpanKoreksi } from '@/lib/coal-storage-query';
import {
    ambilWarna, areaOfZona, formatTanggal, formatTon, jumlahZona,
    indexZona, lotsZona, namaZona, umurHari, type CoalLot,
} from '@/lib/coal-storage';
import TumpukanForm, { ISI_KOSONG, type IsiTumpukan } from './TumpukanForm';

// Tombol per baris tumpukan: ±40px NYATA di HP supaya mudah diketuk jari — ditulis
// 44px karena body ber-zoom 90% (app/globals.css). Kembali ringkas mulai `sm:`
// karena di layar lebar yang dipakai kursor.
const tombolBaris = `min-h-11 sm:min-h-0 rounded-lg px-3 sm:px-2 sm:py-1 text-xs sm:text-[11px]
    font-semibold cursor-pointer transition-colors`;

/**
 * Penyunting isi satu zona, dibuka dengan mengetuk petak di denah.
 *
 * Popup terang di tengah layar, jadi bottom sheet di HP — geometrinya sengaja sama
 * dengan Modal milik form shift (components/input-shift/SharedComponents.tsx) supaya
 * operator mengenali perilakunya, hanya warnanya yang terang. Konsekuensinya denah
 * tertutup backdrop selama menyunting; setelah simpan, daftar di popup ini ikut segar
 * karena onTersimpan memanggil refetch halaman.
 *
 * Di-portal ke <body> karena AppShell memasang zoom 1.25 di monitor besar, dan
 * `position: fixed` di dalam subtree ter-zoom meleset di Chrome.
 *
 * Semua operator yang login boleh menyunting — tidak ada gerbang peran di sini. Yang
 * menjaga bukan kunci, melainkan jejak: tiap simpan menulis baris baru bernama di
 * coal_lot_koreksi, dan riwayatnya bisa dibuka siapa saja lewat tombol di tiap baris.
 */
export default function ZonaEditor({ zonaId, lots, warna, operator, onTutup, onTersimpan }: {
    zonaId: string | null;
    /** Tumpukan SISA (sudah dikurangi loading) di seluruh denah. */
    lots: CoalLot[];
    warna: Record<string, string>;
    operator: { name: string; supabaseId?: string };
    onTutup: () => void;
    onTersimpan: (pesan: string) => void;
}) {
    const [mode, setMode] = useState<{ jenis: 'daftar' } | { jenis: 'tambah' } | { jenis: 'ubah'; lot: CoalLot }>({ jenis: 'daftar' });
    const [isi, setIsi] = useState<IsiTumpukan>(ISI_KOSONG);
    const [menyimpan, setMenyimpan] = useState(false);
    const [galatSimpan, setGalatSimpan] = useState<string | null>(null);
    const [riwayatUntuk, setRiwayatUntuk] = useState<string | null>(null);
    const [riwayat, setRiwayat] = useState<CoalLotKoreksiRow[] | null>(null);

    // Tiap kali zona berganti, kembali ke daftar — jangan bawa form zona sebelumnya.
    useEffect(() => {
        setMode({ jenis: 'daftar' });
        setIsi(ISI_KOSONG);
        setGalatSimpan(null);
        setRiwayatUntuk(null);
        setRiwayat(null);
    }, [zonaId]);

    // Escape menutup, dan body dikunci supaya latar tidak ikut menggulir di HP.
    useEffect(() => {
        if (!zonaId) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup(); };
        document.addEventListener('keydown', onKey);
        const semula = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = semula;
        };
    }, [zonaId, onTutup]);

    const zLots = useMemo(() => (zonaId ? lotsZona(lots, zonaId) : []), [lots, zonaId]);
    const suppliers = useMemo(
        () => [...new Set(lots.map(l => l.supplier))].sort((a, b) => a.localeCompare(b, 'id')),
        [lots],
    );

    const bukaRiwayat = useCallback(async (lotId: string) => {
        if (riwayatUntuk === lotId) { setRiwayatUntuk(null); return; }
        setRiwayatUntuk(lotId);
        setRiwayat(null);
        try {
            setRiwayat(await riwayatLot(createClient(), lotId));
        } catch {
            setRiwayat([]);
        }
    }, [riwayatUntuk]);

    if (!zonaId) return null;

    const area = areaOfZona(zonaId);
    const index = indexZona(zonaId);
    const jml = jumlahZona(area);

    async function simpan(input: {
        lotId: string; supplier: string; ton: number; tanggalMasuk: string; dihapus?: boolean;
    }) {
        setMenyimpan(true);
        setGalatSimpan(null);
        // Basis = shift yang sedang berjalan: angka yang ditulis operator adalah apa
        // yang dia lihat SEKARANG, jadi kejadian sebelum ini sudah tercermin di sana.
        const kini = detectCurrentShift();
        try {
            await simpanKoreksi(createClient(), {
                lotId: input.lotId,
                zona: zonaId!,
                supplier: input.supplier,
                tanggalMasuk: input.tanggalMasuk,
                ton: input.ton,
                sejakTanggal: kini.date,
                sejakShift: kini.shift,
                dihapus: input.dihapus,
                operatorId: operator.supabaseId ?? null,
                operatorName: operator.name,
            });
            setMode({ jenis: 'daftar' });
            setIsi(ISI_KOSONG);
            onTersimpan(input.dihapus ? 'Tumpukan dihapus' : 'Tersimpan');
        } catch (e) {
            setGalatSimpan(e instanceof Error ? e.message : 'Gagal menyimpan.');
        } finally {
            setMenyimpan(false);
        }
    }

    function simpanForm() {
        const ton = parseFloat(isi.ton.replace(',', '.'));
        simpan({
            lotId: mode.jenis === 'ubah' ? (mode.lot.id ?? crypto.randomUUID()) : crypto.randomUUID(),
            supplier: isi.supplier,
            ton,
            tanggalMasuk: isi.tanggal_masuk,
        });
    }

    function hapus(lot: CoalLot) {
        if (!lot.id) return;
        if (!confirm(`Hapus tumpukan ${lot.supplier} (${formatTon(lot.ton)} t) dari zona ini?\n\n`
            + 'Catatan kedatangan di laporan shift tidak ikut terhapus — yang hilang hanya '
            + 'tumpukannya di denah.')) return;
        simpan({
            lotId: lot.id, supplier: lot.supplier, ton: 0,
            tanggalMasuk: lot.tanggal_masuk, dihapus: true,
        });
    }

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={onTutup}
                aria-hidden="true"
            />

            <div
                role="dialog" aria-modal="true" aria-label={`Isi ${namaZona(index, jml)}`}
                className="relative w-full sm:max-w-md max-h-[88dvh] rounded-t-2xl sm:rounded-2xl
                    bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
            >
                {/* Pegangan — di HP popup ini panel bawah, garis ini isyaratnya. */}
                <div className="sm:hidden flex justify-center pt-2 shrink-0" aria-hidden="true">
                    <span className="h-1 w-10 rounded-full bg-slate-300" />
                </div>

                {/* Kepala: areanya dulu (Open/Closed), baru zonanya. Ikon & warnanya sama
                    dengan pita judul area di denah, jadi keduanya terbaca sekilas. */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 shrink-0">
                    <span
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: area.theme.pita }}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-white text-xl">{area.icon}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-bold text-slate-900 leading-tight">{area.nama}</h2>
                        <p className="text-[12px] text-slate-500 mt-0.5">{namaZona(index, jml)}</p>
                    </div>
                    <button
                        type="button" onClick={onTutup} aria-label="Tutup"
                        className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400
                            hover:bg-slate-100 cursor-pointer transition-colors shrink-0"
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                {/* Isi */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                    {zLots.length === 0 && mode.jenis === 'daftar' && (
                        <p className="text-[12px] text-slate-500 py-6 text-center">
                            Zona ini kosong — belum ada penempatan.
                        </p>
                    )}

                    {zLots.map(lot => (
                        <div key={lot.id ?? `${lot.supplier}-${lot.tanggal_masuk}`}
                            className="rounded-xl border border-slate-200 p-2.5">
                            <div className="flex items-start gap-2">
                                <span className="w-2.5 h-2.5 rounded-[3px] shrink-0 mt-1"
                                    style={{ background: ambilWarna(warna, lot.supplier) }} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-semibold text-slate-900 truncate">{lot.supplier}</p>
                                    <p className="text-[11px] text-slate-500">
                                        est. {formatTon(lot.ton)} t · masuk {formatTanggal(lot.tanggal_masuk)}
                                        {' '}· {umurHari(lot.tanggal_masuk)} hari
                                    </p>
                                    {lot.sumber === 'opname' && lot.diubahOleh && (
                                        <p className="text-[10px] text-sky-700 mt-0.5">
                                            opname · {lot.diubahOleh}
                                            {lot.diubahPada && ` · ${formatTanggal(lot.diubahPada)}`}
                                        </p>
                                    )}
                                    {lot.adaPengirimanBerjalan && (
                                        <span className="inline-block mt-1 rounded px-1.5 py-0.5 text-[10px]
                                            font-semibold bg-emerald-100 text-emerald-800">
                                            pengiriman masih berjalan
                                        </span>
                                    )}
                                </div>
                            </div>

                            {mode.jenis === 'ubah' && mode.lot.id === lot.id ? (
                                <div className="mt-2.5">
                                    <TumpukanForm
                                        zonaId={zonaId} isi={isi} onChange={setIsi} lots={lots}
                                        lotId={lot.id} suppliers={suppliers}
                                        onSimpan={simpanForm} menyimpan={menyimpan}
                                        onBatal={() => { setMode({ jenis: 'daftar' }); setIsi(ISI_KOSONG); }}
                                    />
                                </div>
                            ) : (
                                <div className="flex gap-1.5 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMode({ jenis: 'ubah', lot });
                                            setIsi({
                                                supplier: lot.supplier,
                                                ton: String(Math.round(lot.ton)),
                                                tanggal_masuk: lot.tanggal_masuk,
                                            });
                                        }}
                                        className={`${tombolBaris} border border-slate-300 bg-white text-slate-600 hover:bg-slate-50`}
                                    >
                                        Ubah
                                    </button>
                                    <button
                                        type="button" onClick={() => hapus(lot)} disabled={menyimpan}
                                        className={`${tombolBaris} border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-40`}
                                    >
                                        Hapus
                                    </button>
                                    {lot.id && (
                                        <button
                                            type="button" onClick={() => bukaRiwayat(lot.id!)}
                                            className={`${tombolBaris} ml-auto text-slate-400 hover:text-slate-600 hover:bg-slate-50`}
                                        >
                                            {riwayatUntuk === lot.id ? 'Tutup riwayat' : 'Riwayat'}
                                        </button>
                                    )}
                                </div>
                            )}

                            {riwayatUntuk === lot.id && (
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                    {riwayat === null ? (
                                        <p className="text-[11px] text-slate-400">Memuat riwayat…</p>
                                    ) : riwayat.length === 0 ? (
                                        <p className="text-[11px] text-slate-400">
                                            Belum pernah dikoreksi manual — angkanya murni dari laporan shift.
                                        </p>
                                    ) : riwayat.map(r => (
                                        <p key={r.id} className="text-[11px] text-slate-500 leading-relaxed">
                                            <span className="font-semibold text-slate-700">{r.operator_name}</span>
                                            {' · '}{formatTanggal(r.created_at)}
                                            {' · '}{r.dihapus ? 'menghapus' : `${formatTon(Number(r.ton_dasar))} t`}
                                            {r.keterangan && <span className="block text-slate-400">“{r.keterangan}”</span>}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {mode.jenis === 'tambah' && (
                        <TumpukanForm
                            zonaId={zonaId} isi={isi} onChange={setIsi} lots={lots}
                            suppliers={suppliers} onSimpan={simpanForm} menyimpan={menyimpan}
                            onBatal={() => { setMode({ jenis: 'daftar' }); setIsi(ISI_KOSONG); }}
                        />
                    )}

                    {galatSimpan && (
                        <p className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-2 text-[11px] text-red-700">
                            {galatSimpan}
                        </p>
                    )}
                </div>

                {/* Kaki */}
                {mode.jenis === 'daftar' && (
                    <div className="px-4 py-3 border-t border-slate-200 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                setMode({ jenis: 'tambah' });
                                setIsi({ ...ISI_KOSONG, tanggal_masuk: detectCurrentShift().date });
                            }}
                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-300
                                bg-sky-50 py-2.5 text-sm font-bold text-sky-700 hover:bg-sky-100
                                cursor-pointer transition-colors"
                        >
                            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add_circle</span>
                            Tambah Batubara
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
