'use client';

import { useMemo } from 'react';
import { formatTon, kapasitasZona, periksaTumpukan, type CoalLot } from '@/lib/coal-storage';

export interface IsiTumpukan {
    supplier: string;
    ton: string;          // string, bukan number: operator boleh mengosongkan kolomnya
    tanggal_masuk: string;
    keterangan: string;
}

export const ISI_KOSONG: IsiTumpukan = { supplier: '', ton: '', tanggal_masuk: '', keterangan: '' };

const label = 'block text-[11px] font-semibold text-slate-600 mb-1';
const field = `w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900
    placeholder-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors`;

/**
 * Form satu tumpukan — dipakai untuk menambah maupun mengubah.
 *
 * Validasinya dipinjam dari periksaTumpukan() supaya aturan yang sama berlaku di
 * mana pun tumpukan disunting; komponen ini cuma menggambar hasilnya.
 */
export default function TumpukanForm({
    zonaId, isi, onChange, lots, lotId, suppliers, onSimpan, onBatal, menyimpan,
}: {
    zonaId: string;
    isi: IsiTumpukan;
    onChange: (isi: IsiTumpukan) => void;
    /** Tumpukan SISA di seluruh denah — dipakai menghitung sisa ruang zona. */
    lots: CoalLot[];
    /** Diisi saat mengubah; kosong saat menambah. */
    lotId?: string;
    suppliers: string[];
    onSimpan: () => void;
    onBatal: () => void;
    menyimpan: boolean;
}) {
    const ton = parseFloat(isi.ton.replace(',', '.'));
    const { galat, peringatan } = useMemo(
        () => periksaTumpukan(
            { supplier: isi.supplier, ton, tanggal_masuk: isi.tanggal_masuk, zona: zonaId, lotId },
            lots,
        ),
        [isi.supplier, ton, isi.tanggal_masuk, zonaId, lotId, lots],
    );

    // Galat baru ditampilkan setelah operator mengetik, supaya form yang baru dibuka
    // tidak langsung merah. Tanggal SENGAJA tidak ikut dihitung: form tambah membukanya
    // sudah terisi hari ini, jadi kalau ikut, "supplier belum diisi" nongol seketika.
    // Tombol simpan tetap mati sampai benar-benar valid, jadi tak ada yang lolos.
    const tersentuh = isi.supplier !== '' || isi.ton !== '';
    const bisaSimpan = galat.length === 0 && !menyimpan;

    return (
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
            <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                    <label className={label} htmlFor="tf-supplier">Supplier</label>
                    <input
                        id="tf-supplier" type="text" list="coal-supplier-denah" className={field}
                        placeholder="Nama PT…" autoComplete="off"
                        value={isi.supplier}
                        onChange={e => onChange({ ...isi, supplier: e.target.value })}
                    />
                    <datalist id="coal-supplier-denah">
                        {suppliers.map(s => <option key={s} value={s} />)}
                    </datalist>
                </div>
                <div>
                    <label className={label} htmlFor="tf-ton">Tonase (ton)</label>
                    <input
                        id="tf-ton" type="number" inputMode="decimal" min="0" step="any" className={field}
                        placeholder="0"
                        value={isi.ton}
                        onChange={e => onChange({ ...isi, ton: e.target.value })}
                    />
                </div>
                <div>
                    <label className={label} htmlFor="tf-tanggal">Tanggal masuk</label>
                    <input
                        id="tf-tanggal" type="date" className={field}
                        value={isi.tanggal_masuk}
                        onChange={e => onChange({ ...isi, tanggal_masuk: e.target.value })}
                    />
                </div>
                <div className="col-span-2">
                    <label className={label} htmlFor="tf-ket">Catatan <span className="font-normal text-slate-400">(opsional)</span></label>
                    <input
                        id="tf-ket" type="text" className={field}
                        placeholder="mis. hasil opname bersama pengawas"
                        value={isi.keterangan}
                        onChange={e => onChange({ ...isi, keterangan: e.target.value })}
                    />
                </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Kapasitas zona ± {formatTon(kapasitasZona(zonaId))} t. Angka yang kamu tulis berlaku
                mulai shift ini — kedatangan dan loading setelahnya tetap dihitung otomatis.
            </p>

            {tersentuh && galat.map(g => (
                <p key={g} className="flex items-start gap-1.5 text-[11px] text-red-700 mt-1.5">
                    <span aria-hidden="true" className="material-symbols-outlined text-[14px] leading-4">error</span>
                    <span>{g}</span>
                </p>
            ))}
            {galat.length === 0 && peringatan.map(p => (
                <p key={p} className="flex items-start gap-1.5 text-[11px] text-amber-700 mt-1.5">
                    <span aria-hidden="true" className="material-symbols-outlined text-[14px] leading-4">warning</span>
                    <span>{p}</span>
                </p>
            ))}

            <div className="flex gap-2 mt-3">
                <button
                    type="button" onClick={onSimpan} disabled={!bisaSimpan}
                    className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white
                        hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                    {menyimpan ? 'Menyimpan…' : 'Simpan'}
                </button>
                <button
                    type="button" onClick={onBatal} disabled={menyimpan}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold
                        text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer transition-colors"
                >
                    Batal
                </button>
            </div>
        </div>
    );
}
