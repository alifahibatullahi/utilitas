import { PipingLine, PipingNode } from './piping';

/**
 * Isi gambar isometrik jalur pipa air — HANYA BERKAS INI yang perlu disunting
 * saat rute di lapangan berbeda. Kode gambar tidak perlu disentuh.
 *
 * Koordinat dalam satuan plant (kira-kira meter):
 *   x = ke timur   y = ke utara   z = elevasi dari lantai
 * Untuk 'kotak', pos = pojok terdekat titik nol; untuk 'silinder', pos = titik
 * pusat alas. Menggeser satu peralatan cukup dengan mengubah pos-nya; semua
 * pipa yang menempel ikut pindah karena rutenya dihitung dari nozzle.
 *
 * ─── STATUS ISI ───
 * Yang SUDAH DIPASTIKAN (digambar garis penuh):
 *   · Tangki RCW menyuplai Cooling Tower, air service, dan jaringan pemadam.
 *   · Tangki Demin menyuplai Deaerator lewat pompa demin.
 * Sisanya masih RANGKA (perluKonfirmasi: true → digambar putus-putus): rute,
 * elevasi, tag peralatan, dan nomor line di bawah ini penomoran sementara yang
 * menunggu koreksi. Ukuran pipa sengaja dikosongkan, bukan dikarang — begitu
 * ukuran sebenarnya diketahui, isi ukuranInci dan tag line langsung lengkap.
 */

export const PIPING_NODES: PipingNode[] = [
    // ── Jalur air baku → demin (sisi utara gambar) ──
    {
        id: 'air-baku', nama: 'Air Baku', tipe: 'sumber', bentuk: 'kotak',
        pos: [0, 1, 0], ukuran: [10, 8, 3], perluKonfirmasi: true,
    },
    {
        id: 'wtp', tag: 'WT-101', nama: 'WTP', tipe: 'olah', bentuk: 'kotak',
        pos: [18, 0, 0], ukuran: [12, 10, 6], perluKonfirmasi: true,
    },
    {
        id: 'demin-plant', tag: 'DM-101', nama: 'Demin Plant', tipe: 'olah', bentuk: 'kotak',
        pos: [36, 0, 0], ukuran: [12, 10, 6], perluKonfirmasi: true,
    },
    {
        id: 'tangki-demin', tag: 'TK-101', nama: 'Tangki Demin', tipe: 'tangki', bentuk: 'silinder',
        pos: [60, 5, 0], jari: 6, tinggi: 10,
    },
    {
        id: 'pompa-demin', tag: 'P-101 A/B', nama: 'Pompa Demin', tipe: 'pompa', bentuk: 'kotak',
        pos: [72, 3, 0], ukuran: [6, 4, 2.5],
        // Digeser supaya tidak bertumpuk dengan tag line DMW-1102 di atasnya.
        labelGeser: { x: 24, y: 10 },
    },
    {
        // Bejana terangkat: kaki penyangga digambar sampai lantai.
        id: 'deaerator', tag: 'DA-101', nama: 'Deaerator', tipe: 'alat', bentuk: 'kotak',
        pos: [90, 0, 12], ukuran: [12, 6, 5], penyangga: true,
    },
    {
        id: 'pompa-bfw', tag: 'P-102 A/B', nama: 'Pompa BFW', tipe: 'pompa', bentuk: 'kotak',
        pos: [86, 8, 0], ukuran: [6, 4, 2.5], perluKonfirmasi: true,
    },
    {
        id: 'boiler', tag: 'B-101 / B-102', nama: 'Boiler A / B', tipe: 'konsumen', bentuk: 'kotak',
        pos: [112, 4, 0], ukuran: [10, 8, 18],
    },

    // ── Sistem RCW & konsumennya (sisi selatan gambar) ──
    {
        id: 'tangki-rcw', tag: 'TK-102', nama: 'Tangki RCW', tipe: 'tangki', bentuk: 'silinder',
        pos: [34, 34, 0], jari: 7, tinggi: 11,
    },
    {
        id: 'cooling-tower', tag: 'CT-101', nama: 'Cooling Tower', tipe: 'konsumen', bentuk: 'kotak',
        pos: [56, 27, 0], ukuran: [14, 14, 12],
    },
    {
        id: 'air-service', nama: 'Jaringan Air Service', tipe: 'konsumen', bentuk: 'kotak',
        pos: [56, 48, 0], ukuran: [10, 6, 4],
    },
    {
        id: 'pemadam', nama: 'Jaringan Pemadam', tipe: 'konsumen', bentuk: 'kotak',
        pos: [30, 52, 0], ukuran: [10, 6, 4],
    },
    {
        id: 'condenser', tag: 'E-101', nama: 'Condenser', tipe: 'alat', bentuk: 'kotak',
        pos: [100, 34, 4], ukuran: [12, 6, 5], penyangga: true, perluKonfirmasi: true,
    },
    {
        id: 'pompa-cep', tag: 'P-103 A/B', nama: 'Pompa Kondensat', tipe: 'pompa', bentuk: 'kotak',
        pos: [96, 46, 0], ukuran: [6, 4, 2.5], perluKonfirmasi: true,
    },
];

export const PIPING_LINES: PipingLine[] = [
    // ── Air baku & air olahan ──
    {
        id: 'rw-1001', nomor: 1001, fluida: 'raw', perluKonfirmasi: true,
        dari: { node: 'air-baku', arah: '+x' },
        ke: { node: 'wtp', arah: '-x', tinggi: 0.25 },
        catatan: 'Air baku masuk pengolahan',
    },
    {
        id: 'rw-1002', nomor: 1002, fluida: 'raw', perluKonfirmasi: true,
        dari: { node: 'wtp', arah: '+x' },
        ke: { node: 'demin-plant', arah: '-x' },
        catatan: 'Air olahan WTP ke demin plant',
    },
    {
        id: 'rw-1003', nomor: 1003, fluida: 'raw', perluKonfirmasi: true,
        dari: { node: 'wtp', arah: '+y', tinggi: 0.3 },
        ke: { node: 'tangki-rcw', arah: '-y', tinggi: 0.8 },
        catatan: 'Air penambah (make-up) tangki RCW',
    },

    // ── Air demin ──
    {
        id: 'dmw-1101', nomor: 1101, fluida: 'demin', perluKonfirmasi: true,
        dari: { node: 'demin-plant', arah: '+x', tinggi: 0.7 },
        ke: { node: 'tangki-demin', arah: '-x', tinggi: 0.85 },
        catatan: 'Produk demin plant ke tangki',
    },
    {
        id: 'dmw-1102', nomor: 1102, fluida: 'demin',
        dari: { node: 'tangki-demin', arah: '+x', tinggi: 0.125 },
        ke: { node: 'pompa-demin', arah: '-x' },
        catatan: 'Sisi isap pompa demin',
    },
    {
        id: 'dmw-1103', nomor: 1103, fluida: 'demin',
        dari: { node: 'pompa-demin', arah: '+x', tinggi: 0.6, keluar: 4 },
        ke: { node: 'deaerator', arah: '-x', tinggi: 0.4, keluar: 4 },
        catatan: 'Suplai demin ke deaerator',
    },

    // ── Feedwater ──
    {
        id: 'bfw-1201', nomor: 1201, fluida: 'feedwater', urutan: 'zxy', perluKonfirmasi: true,
        dari: { node: 'deaerator', arah: '-z' },
        ke: { node: 'pompa-bfw', arah: '-y' },
        catatan: 'Turun ke sisi isap pompa BFW',
    },
    {
        id: 'bfw-1202', nomor: 1202, fluida: 'feedwater', perluKonfirmasi: true,
        dari: { node: 'pompa-bfw', arah: '+x', tinggi: 0.6 },
        ke: { node: 'boiler', arah: '-x', tinggi: 0.55 },
        catatan: 'Air pengisi ke boiler',
    },

    // ── Kondensat ──
    {
        id: 'cd-1301', nomor: 1301, fluida: 'kondensat', perluKonfirmasi: true,
        dari: { node: 'condenser', arah: '+y' },
        ke: { node: 'pompa-cep', arah: '-y' },
        catatan: 'Kondensat ke sisi isap CEP',
    },
    {
        id: 'cd-1302', nomor: 1302, fluida: 'kondensat', urutan: 'zxy', perluKonfirmasi: true,
        dari: { node: 'pompa-cep', arah: '+x', tinggi: 0.6 },
        ke: { node: 'deaerator', arah: '+y', tinggi: 0.5, keluar: 4 },
        catatan: 'Kondensat kembali ke deaerator',
    },

    // ── Sistem RCW (rute yang sudah dipastikan) ──
    {
        id: 'cws-1401', nomor: 1401, fluida: 'rcw',
        dari: { node: 'tangki-rcw', arah: '+x', tinggi: 0.2 },
        ke: { node: 'cooling-tower', arah: '-x', tinggi: 0.6 },
        catatan: 'RCW ke cooling tower',
    },
    {
        id: 'sw-1501', nomor: 1501, fluida: 'service',
        dari: { node: 'tangki-rcw', arah: '+y', tinggi: 0.2 },
        ke: { node: 'air-service', arah: '-x', tinggi: 0.55 },
        catatan: 'RCW ke jaringan air service',
    },
    {
        id: 'fp-1601', nomor: 1601, fluida: 'fire', urutan: 'yxz',
        dari: { node: 'tangki-rcw', arah: '-x', tinggi: 0.2 },
        ke: { node: 'pemadam', arah: '-y', tinggi: 0.55 },
        catatan: 'RCW ke jaringan pemadam',
    },
];

/** Tanggal isi gambar ini terakhir disesuaikan dengan kondisi lapangan. */
export const PIPING_UPDATED_AT = '2026-09-03';
