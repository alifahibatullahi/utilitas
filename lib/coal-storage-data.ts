import { CoalLot } from './coal-storage';

/**
 * Data dummy penempatan batubara per zona.
 *
 * Halaman /coal-storage masih baca-saja, jadi isinya disunting langsung di
 * berkas ini. Bentuk barisnya sengaja disamakan dengan calon baris tabel
 * (zona, supplier, ton, tanggal_masuk) supaya saat dipindah ke Supabase cukup
 * berkas ini yang diganti — komponennya menerima lots sebagai prop.
 *
 * Catatan: kolom ton adalah ESTIMASI. Di peta yang tampil hanya persentase;
 * tonase cuma muncul di kartu detail, chip supplier, dan total estimasi.
 */
export const COAL_LOTS: CoalLot[] = [
    // Open Storage — 7 zona (O1 = sebelum pilar 1, O7 = setelah pilar 6)
    { zona: 'O1', supplier: 'Bara Sejahtera', ton: 3200, tanggal_masuk: '2026-08-11' },
    { zona: 'O2', supplier: 'Bara Sejahtera', ton: 4286, tanggal_masuk: '2026-08-18' },
    { zona: 'O3', supplier: 'Mitra Energi', ton: 2500, tanggal_masuk: '2026-08-20' },
    { zona: 'O3', supplier: 'Bara Sejahtera', ton: 800, tanggal_masuk: '2026-08-24' },
    { zona: 'O5', supplier: 'Karya Tambang', ton: 4000, tanggal_masuk: '2026-08-22' },
    { zona: 'O6', supplier: 'Karya Tambang', ton: 1500, tanggal_masuk: '2026-08-23' },
    { zona: 'O6', supplier: 'Sumber Bara', ton: 900, tanggal_masuk: '2026-08-29' },

    // Closed Storage — 12 zona (C1 = sebelum pilar 1, C12 = setelah pilar 11)
    { zona: 'C1', supplier: 'Nusa Coal', ton: 3333, tanggal_masuk: '2026-08-04' },
    { zona: 'C2', supplier: 'Nusa Coal', ton: 2800, tanggal_masuk: '2026-08-06' },
    { zona: 'C3', supplier: 'Nusa Coal', ton: 1200, tanggal_masuk: '2026-08-08' },
    { zona: 'C3', supplier: 'Prima Mandiri', ton: 900, tanggal_masuk: '2026-08-27' },
    { zona: 'C4', supplier: 'Prima Mandiri', ton: 3333, tanggal_masuk: '2026-08-13' },
    { zona: 'C5', supplier: 'Prima Mandiri', ton: 2600, tanggal_masuk: '2026-08-15' },
    { zona: 'C7', supplier: 'Mitra Energi', ton: 3000, tanggal_masuk: '2026-08-17' },
    { zona: 'C8', supplier: 'Mitra Energi', ton: 1800, tanggal_masuk: '2026-08-19' },
    { zona: 'C8', supplier: 'Sumber Bara', ton: 1200, tanggal_masuk: '2026-08-26' },
    { zona: 'C9', supplier: 'Sumber Bara', ton: 3333, tanggal_masuk: '2026-08-21' },
    { zona: 'C10', supplier: 'Sumber Bara', ton: 700, tanggal_masuk: '2026-08-25' },
    { zona: 'C12', supplier: 'Bara Sejahtera', ton: 2200, tanggal_masuk: '2026-08-28' },
];

/** Tanggal data ini terakhir disesuaikan dengan kondisi lapangan. */
export const COAL_LOTS_UPDATED_AT = '2026-09-02';
