'use client';
import React, { useState } from 'react';
import { InputField, Modal } from './SharedComponents';
import {
    ASAL_KEDATANGAN, COAL_AREAS, METODE_UNLOADING, labelAsal, labelZonaPendek, zonaIds,
    type AsalKedatangan, type MetodeUnloading,
} from '@/lib/coal-storage';
import type { ShiftKey } from '@/lib/constants';

/** Satu kali kedatangan batubara → baris tabel coal_arrivals. */
export interface CoalArrivalEntry {
    id?: string;
    batch_id: string;        // sama untuk pengiriman yang berlanjut antar shift
    supplier: string;
    zona: string;
    ton: number | null;
    tanggal_masuk: string;   // 'YYYY-MM-DD' — hari batubara MULAI masuk storage
    status: 'progres' | 'selesai';
    /** Tongkang = Via Laut, darat = Via Darat di laporan harian. Kosong = baris lama. */
    asal: AsalKedatangan | null;
    /** Khusus tongkang; darat selalu null. */
    metode_unloading: MetodeUnloading | null;
}

/**
 * Pengiriman yang di shift sebelumnya ditandai masih 'progres'. Dipakai untuk
 * tombol "Lanjutkan" supaya baris lanjutannya mewarisi batch_id yang sama — kalau
 * tidak, satu pengiriman yang memakan tiga shift jadi tiga tumpukan di denah.
 */
export interface OpenArrival {
    batch_id: string;
    supplier: string;
    zona: string;
    tonSejauhIni: number;
    tanggal_masuk: string;
    asal: AsalKedatangan | null;
}

/**
 * Baris penutup = lanjutan berstatus 'selesai' tanpa tonase tambahan. Gunanya cuma
 * menandai pengiriman sudah tuntas (kalau tidak, ia nyangkut di dropdown "Pengiriman"
 * selamanya); tonasenya 0, jadi tumpukan di denah tidak berubah.
 */
export function isBarisPenutup(e: Pick<CoalArrivalEntry, 'ton' | 'status'>): boolean {
    return !e.ton && e.status === 'selesai';
}

/**
 * Aturan lengkap satu entri — dipakai modal (tombol Simpan) DAN penyaring sebelum insert
 * di app/input-laporan/page.tsx, supaya yang lolos form dan yang ditulis ke DB sama.
 * Asal wajib; metode unloading wajib untuk tongkang kecuali baris penutup (tak ada
 * batubara yang dibongkar, jadi tak ada metodenya).
 */
export function isKedatanganLengkap(e: CoalArrivalEntry): boolean {
    if (!e.supplier || !e.zona || !e.asal) return false;
    if (!((e.ton ?? 0) > 0 || isBarisPenutup(e))) return false;
    return e.asal !== 'tongkang' || !!e.metode_unloading || isBarisPenutup(e);
}

/**
 * Daftar pilihan zona untuk kedua area, memakai label pendek yang sama dengan
 * halaman /coal-storage ('Closed · pilar 4–5') supaya operator membaca istilah
 * yang persis sama di form dan di denah.
 */
export const ZONA_OPTIONS = COAL_AREAS.flatMap(area =>
    zonaIds(area).map(zona => ({ value: zona, label: labelZonaPendek(zona) })),
);

/**
 * Id pengiriman baru. Di luar komponen supaya aturan kemurnian React tidak
 * menganggap Date.now/Math.random dipanggil saat render — ini cuma dipakai di
 * dalam handler. Cadangan non-crypto untuk browser lama tanpa randomUUID.
 */
function newBatchId(): string {
    return globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Batas chip supplier yang ditampilkan sekaligus — sisanya tetap lewat datalist/ketik. */
const MAKS_SARAN_SUPPLIER = 8;

const ASAL_ICON: Record<AsalKedatangan, string> = { tongkang: 'directions_boat', darat: 'local_shipping' };
const METODE_ICON: Record<MetodeUnloading, string> = { conveyor: 'conveyor_belt', dump_truck: 'front_loader' };

const SHIFT_OPTIONS: { value: ShiftKey; label: string }[] = [
    { value: 'malam', label: 'Malam' },
    { value: 'pagi', label: 'Pagi' },
    { value: 'sore', label: 'Sore' },
];

const selectClass = (filled: boolean) =>
    `w-full bg-[#101822] border border-slate-700/80 rounded-lg py-2.5 px-3 focus:ring-1 focus:ring-emerald-500 text-sm font-bold transition-all ${filled ? 'text-white' : 'text-slate-400'}`;

const labelClass = 'font-medium text-white uppercase tracking-wider block text-left text-[10px]';

/** Tombol pilihan besar (asal / metode / shift) — dua-tiga per baris, mudah diketuk di HP. */
function PilihanTombol<T extends string>({ opsi, nilai, onPilih, terkunci, icon }: {
    opsi: { value: T; label: string }[];
    nilai: T | null;
    onPilih: (v: T) => void;
    terkunci?: boolean;
    icon?: Record<T, string>;
}) {
    return (
        <div className={`grid gap-2 ${opsi.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {opsi.map(o => {
                const aktif = o.value === nilai;
                return (
                    <button
                        key={o.value} type="button" aria-pressed={aktif} disabled={terkunci}
                        onClick={() => onPilih(o.value)}
                        className={`flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-lg border text-sm font-bold transition-colors
                            ${aktif
                                ? 'border-emerald-500 bg-emerald-500/25 text-emerald-200'
                                : 'border-slate-700/80 bg-[#101822] text-slate-400 hover:border-emerald-500/50 hover:text-emerald-300'}
                            ${terkunci ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    >
                        {icon && <span className="material-symbols-outlined text-[18px]">{icon[o.value]}</span>}
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

interface CoalArrivalModalProps {
    onClose: () => void;
    /**
     * `shift` hanya terisi bila `pilihShift` aktif (tambah dari laporan harian) —
     * laporan shift sudah tahu shift-nya sendiri.
     */
    onSave: (entry: CoalArrivalEntry, shift: ShiftKey | null) => void | Promise<void>;
    /** Tanggal laporan — default "mulai masuk storage" untuk pengiriman baru. */
    reportDate: string;
    /** Pengiriman berstatus 'progres' dari shift sebelumnya. */
    openArrivals?: OpenArrival[];
    /** Nama supplier yang pernah dipakai, untuk datalist & chip. */
    supplierOptions?: string[];
    /**
     * Mode edit (review harian): baris yang sudah tersimpan. Supplier, pilar, dan tanggal
     * masuk dikunci — ketiganya identitas tumpukan di denah dan dikoreksi di /coal-storage;
     * yang bisa dibetulkan di sini tonase, asal, metode, dan status.
     */
    edit?: CoalArrivalEntry | null;
    /** Shift baris yang sedang diedit — cuma ditampilkan. */
    editShift?: string | null;
    /** Tampilkan pemilih shift (tambah dari laporan harian). */
    pilihShift?: boolean;
}

/**
 * Form satu kedatangan batubara. SATU form untuk tab Handling laporan shift dan review
 * harian supervisor — keduanya menulis tabel coal_arrivals yang sama, jadi isiannya pun
 * harus sama persis. Dirender hanya saat terbuka (pemanggil memasangnya bersyarat),
 * jadi state-nya selalu mulai bersih.
 */
export default function CoalArrivalModal({
    onClose, onSave, reportDate,
    openArrivals = [], supplierOptions = [],
    edit = null, editShift = null, pilihShift = false,
}: CoalArrivalModalProps) {
    const [form, setForm] = useState<CoalArrivalEntry>(() => edit ?? {
        batch_id: newBatchId(), supplier: '', zona: '', ton: null,
        tanggal_masuk: reportDate, status: 'progres', asal: null, metode_unloading: null,
    });
    // Terisi saat dropdown "Pengiriman" dipakai untuk melanjutkan: supplier, pilar,
    // tanggal, dan asal dikunci mengikuti induknya supaya tumpukan di denah tidak terbelah.
    const [lanjutanDari, setLanjutanDari] = useState<OpenArrival | null>(null);
    const [shift, setShift] = useState<ShiftKey | null>(null);
    const [menyimpan, setMenyimpan] = useState(false);

    const modeEdit = !!edit;
    const identitasTerkunci = modeEdit || !!lanjutanDari;

    /**
     * Isi ulang form. Tanpa induk = pengiriman baru; dengan induk = lanjutan yang
     * mewarisi batch_id, tanggal masuk, DAN asalnya, supaya tumpukannya tetap satu dan
     * umurnya dihitung sejak batubara pertama kali menyentuh lapangan. Metode unloading
     * TIDAK diwarisi: conveyor bisa berhenti di tengah bongkar lalu pindah dump truck.
     */
    const setMode = (induk: OpenArrival | null) => {
        setLanjutanDari(induk);
        setForm({
            batch_id: induk?.batch_id ?? newBatchId(),
            supplier: induk?.supplier ?? '',
            zona: induk?.zona ?? '',
            ton: null,
            tanggal_masuk: induk?.tanggal_masuk ?? reportDate,
            status: 'progres',
            asal: induk?.asal ?? null,
            metode_unloading: null,
        });
    };

    // Tonase wajib, KECUALI lanjutan (atau baris tersimpan) yang ditandai selesai: itu
    // baris penutup dan boleh tanpa tonase tambahan.
    const tonaseBolehKosong = (!!lanjutanDari || modeEdit) && form.status === 'selesai';
    const butuhMetode = form.asal === 'tongkang';
    const valid = isKedatanganLengkap(form) && (!pilihShift || !!shift);

    const simpan = async () => {
        if (!valid || menyimpan) return;
        setMenyimpan(true);
        try {
            await onSave({
                ...form,
                ton: form.ton ?? 0,
                metode_unloading: form.asal === 'tongkang' ? form.metode_unloading : null,
            }, pilihShift ? shift : null);
        } finally {
            setMenyimpan(false);
        }
    };

    const daftarSupplier = [...new Set(supplierOptions.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
    const cariSupplier = form.supplier.trim().toLowerCase();
    const saranSupplier = daftarSupplier
        .filter(s => s.toLowerCase().includes(cariSupplier))
        .slice(0, MAKS_SARAN_SUPPLIER);

    const judul = modeEdit ? 'Edit Kedatangan Batubara' : lanjutanDari ? 'Lanjutan Kedatangan' : 'Kedatangan Batubara';

    return (
        <Modal open onClose={onClose} title={judul} color="emerald">
            {/* Field pertama: pengiriman baru atau lanjutan. Memilih lanjutan
                mewarisi batch_id + tanggal masuk + asal induknya, jadi pengiriman yang
                memakan beberapa shift tetap terbaca sebagai SATU tumpukan. */}
            {!modeEdit && openArrivals.length > 0 && (
                <div className="space-y-1.5 w-full">
                    <label className={labelClass}>Pengiriman</label>
                    <select
                        value={lanjutanDari?.batch_id ?? ''}
                        onChange={e => setMode(openArrivals.find(o => o.batch_id === e.target.value) ?? null)}
                        className={selectClass(true)}
                    >
                        <option value="" className="text-white bg-[#101822] font-bold">Baru</option>
                        {openArrivals.map(o => (
                            <option key={o.batch_id} value={o.batch_id} className="text-white bg-[#101822] font-bold">
                                Lanjutan — {o.asal ? `${labelAsal(o.asal)} · ` : ''}{o.supplier} · {labelZonaPendek(o.zona)} · {o.tonSejauhIni.toLocaleString('id-ID')} t sejauh ini
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {lanjutanDari && (
                <p className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 leading-relaxed">
                    Melanjutkan pengiriman {lanjutanDari.supplier} di {labelZonaPendek(lanjutanDari.zona)}.
                    Supplier, pilar, tanggal masuk, dan asal dikunci supaya tetap terhitung satu tumpukan.
                </p>
            )}
            {modeEdit && (
                <p className="text-[10px] text-slate-300 bg-slate-500/10 border border-slate-600/40 rounded-lg px-3 py-2 leading-relaxed">
                    {form.supplier} · {labelZonaPendek(form.zona)}{editShift ? ` · shift ${editShift}` : ''}.
                    Supplier &amp; pilar dikoreksi dari denah /coal-storage.
                </p>
            )}

            {pilihShift && (
                <div className="space-y-1.5 w-full">
                    <label className={labelClass}>Shift</label>
                    <PilihanTombol opsi={SHIFT_OPTIONS} nilai={shift} onPilih={setShift} />
                </div>
            )}

            <div className="space-y-1.5 w-full">
                <label className={labelClass}>Asal</label>
                <PilihanTombol
                    opsi={ASAL_KEDATANGAN} nilai={form.asal} icon={ASAL_ICON}
                    terkunci={!!lanjutanDari && !!lanjutanDari.asal}
                    onPilih={asal => setForm({ ...form, asal, metode_unloading: asal === 'tongkang' ? form.metode_unloading : null })}
                />
            </div>
            {butuhMetode && (
                <div className="space-y-1.5 w-full">
                    <label className={labelClass}>
                        Unloading via{isBarisPenutup(form) && <span className="text-slate-500 normal-case"> (boleh kosong)</span>}
                    </label>
                    <PilihanTombol
                        opsi={METODE_UNLOADING} nilai={form.metode_unloading} icon={METODE_ICON}
                        onPilih={metode_unloading => setForm({ ...form, metode_unloading })}
                    />
                </div>
            )}

            <div className="space-y-1.5 w-full">
                <label className={labelClass}>{form.asal === 'tongkang' ? 'Nama tongkang / supplier' : 'Supplier / PT'}</label>
                <input type="text" list="coal-supplier-list" value={form.supplier} disabled={identitasTerkunci}
                    onChange={e => setForm({ ...form, supplier: e.target.value })}
                    placeholder={form.asal === 'tongkang' ? 'Nama tongkang...' : 'Nama PT...'}
                    className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-emerald-500 text-sm transition-all disabled:opacity-60" />
                <datalist id="coal-supplier-list">
                    {daftarSupplier.map(s => <option key={s} value={s} />)}
                </datalist>
                {/* Chip nama yang sudah dipakai (dari laporan shift & denah), sebab
                    <datalist> tidak andal di browser HP. Nama yang konsisten itu
                    penting: warna & pengelompokan di /coal-storage per nama supplier. */}
                {!identitasTerkunci && saranSupplier.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {saranSupplier.map(s => {
                            const dipilih = s === form.supplier;
                            return (
                                <button
                                    key={s} type="button" aria-pressed={dipilih}
                                    onClick={() => setForm({ ...form, supplier: s })}
                                    className={`px-2.5 py-1 rounded-full border text-[10px] font-bold transition-colors cursor-pointer
                                        ${dipilih
                                            ? 'border-emerald-500 bg-emerald-500/25 text-emerald-200'
                                            : 'border-slate-700/80 bg-[#101822] text-slate-400 hover:border-emerald-500/50 hover:text-emerald-300'}`}
                                >
                                    {s}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
            <InputField label={tonaseBolehKosong ? 'Tonase (boleh kosong)' : 'Tonase'} unit="ton" color="emerald" name="coal_ton" value={form.ton} thousands
                onChange={(_, v) => setForm({ ...form, ton: typeof v === 'string' ? parseFloat(v) || null : v as number | null })} />
            {tonaseBolehKosong && !form.ton && (
                <p className="-mt-1 text-[10px] text-slate-400 leading-relaxed">
                    Tanpa tonase = sekadar menandai pengiriman ini sudah selesai; tumpukan di denah tidak berubah.
                </p>
            )}
            <div className="space-y-1.5 w-full">
                <label className={labelClass}>Ditaruh di pilar</label>
                <select value={form.zona} disabled={identitasTerkunci}
                    onChange={e => setForm({ ...form, zona: e.target.value })}
                    className={`${selectClass(!!form.zona)} disabled:opacity-60`}>
                    <option value="" className="text-slate-400 bg-[#101822]">Pilih pilar...</option>
                    {ZONA_OPTIONS.map(z => (
                        <option key={z.value} value={z.value} className="text-white bg-[#101822] font-bold">{z.label}</option>
                    ))}
                </select>
            </div>
            {/* Tanggal batubara MULAI masuk storage — tanpa jam. Untuk lanjutan
                ia mewarisi tanggal kedatangan pertama, jadi umur tumpukan di denah
                dihitung sejak batubara pertama kali menyentuh lapangan. */}
            <div className="space-y-1.5 w-full">
                <label className={labelClass}>Mulai masuk storage</label>
                <input type="date" value={form.tanggal_masuk} disabled={identitasTerkunci}
                    onChange={e => setForm({ ...form, tanggal_masuk: e.target.value })}
                    className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-emerald-500 text-sm transition-all disabled:opacity-60" />
            </div>
            <div className="space-y-1.5 w-full">
                <label className={labelClass}>Status</label>
                <select value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as 'progres' | 'selesai' })}
                    className={selectClass(true)}>
                    <option value="progres" className="text-white bg-[#101822] font-bold">Masih progres — lanjut shift berikutnya</option>
                    <option value="selesai" className="text-white bg-[#101822] font-bold">Selesai</option>
                </select>
            </div>
            <button type="button" onClick={simpan} disabled={!valid || menyimpan}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm transition-colors mt-1">
                <span className="material-symbols-outlined text-[18px]">save</span>
                {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </button>
        </Modal>
    );
}
