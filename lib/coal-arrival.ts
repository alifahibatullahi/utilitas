// Tipe & aturan satu kedatangan batubara (tabel coal_arrivals). Dipisah dari
// components/input-shift/CoalArrivalModal.tsx karena modul itu 'use client' — fungsinya
// tidak bisa dipanggil dari route handler. Sekarang dipakai TIGA jalur yang menulis tabel
// yang sama: tab Handling laporan shift, review harian supervisor, dan menu Kedatangan
// Batubara di spreadsheet (/api/sheets/kedatangan-batubara). Aturannya harus satu.

import {
    COAL_AREAS, labelZonaPendek, zonaIds,
    type AsalKedatangan, type MetodeUnloading,
} from './coal-storage';

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
 * Aturan lengkap satu entri — dipakai modal (tombol Simpan), penyaring sebelum insert
 * di app/input-laporan/page.tsx, DAN route menu spreadsheet, supaya yang lolos form dan
 * yang ditulis ke DB sama. Asal wajib; metode unloading wajib untuk tongkang kecuali
 * baris penutup (tak ada batubara yang dibongkar, jadi tak ada metodenya).
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
