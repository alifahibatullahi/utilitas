'use client';

import { useMemo } from 'react';
import { periksaTumpukan, type CoalLot } from '@/lib/coal-storage';

export interface IsiTumpukan {
    supplier: string;
    ton: string;          // string, bukan number: operator boleh mengosongkan kolomnya
    tanggal_masuk: string;
}

export const ISI_KOSONG: IsiTumpukan = { supplier: '', ton: '', tanggal_masuk: '' };

/** Batas chip supplier yang ditampilkan sekaligus — sisanya tetap lewat datalist/ketik. */
const MAKS_SARAN = 8;

const label = 'block text-xs sm:text-[11px] font-semibold text-slate-600 mb-1';
// 16px di HP, bukan 14px: iPhone memperbesar halaman otomatis begitu input bertulisan
// di bawah 16px disentuh, dan tidak mengecilkannya lagi. Mulai `sm:` kembali ringkas.
const field = `w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2.5 sm:py-2 text-base sm:text-sm
    text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors`;

/**
 * Di HP keyboard muncul menutupi separuh bawah layar — tepat di mana bottom sheet ini
 * berada. Setelah keyboard selesai muncul, geser input yang sedang diisi ke tengah area
 * yang masih terlihat. Di layar lebar tidak ada keyboard layar, jadi dilewati.
 */
function gulirKeTengah(e: React.FocusEvent<HTMLInputElement>) {
    if (!window.matchMedia('(max-width: 639px)').matches) return;
    const el = e.currentTarget;
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
}

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

    // Nama supplier yang pernah dipakai, disaring dengan apa yang sudah diketik. Chip
    // ini ada karena <datalist> tidak andal di browser HP (iOS hanya menampilkannya
    // samar di atas keyboard) — mengetik nama PT di keyboard HP itu lambat.
    const cari = isi.supplier.trim().toLowerCase();
    const saran = suppliers.filter(s => s.toLowerCase().includes(cari)).slice(0, MAKS_SARAN);

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
                        onFocus={gulirKeTengah}
                    />
                    <datalist id="coal-supplier-denah">
                        {suppliers.map(s => <option key={s} value={s} />)}
                    </datalist>
                    {saran.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {saran.map(s => {
                                const dipilih = s === isi.supplier;
                                return (
                                    <button
                                        key={s} type="button"
                                        onClick={() => onChange({ ...isi, supplier: s })}
                                        aria-pressed={dipilih}
                                        className={`min-h-10 sm:min-h-0 rounded-full border px-3 sm:px-2.5 sm:py-1
                                            text-xs sm:text-[11px] font-semibold cursor-pointer transition-colors
                                            ${dipilih
                                                ? 'border-sky-500 bg-sky-600 text-white'
                                                : 'border-slate-300 bg-white text-slate-600 hover:border-sky-400 hover:text-sky-700'}`}
                                    >
                                        {s}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div>
                    <label className={label} htmlFor="tf-ton">Tonase (ton)</label>
                    <input
                        id="tf-ton" type="number" inputMode="decimal" min="0" step="any" className={field}
                        placeholder="0"
                        value={isi.ton}
                        onChange={e => onChange({ ...isi, ton: e.target.value })}
                        onFocus={gulirKeTengah}
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
            </div>

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
                    className="flex-1 rounded-lg bg-sky-600 px-3 py-3 sm:py-2 text-sm font-bold text-white
                        hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                    {menyimpan ? 'Menyimpan…' : 'Simpan'}
                </button>
                <button
                    type="button" onClick={onBatal} disabled={menyimpan}
                    className="rounded-lg border border-slate-300 bg-white px-4 sm:px-3 py-3 sm:py-2 text-sm font-semibold
                        text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer transition-colors"
                >
                    Batal
                </button>
            </div>
        </div>
    );
}
