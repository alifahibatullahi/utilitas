// Spesifikasi & helper peta storage batubara UBB.
//
// Zona = ruang penyimpanan di antara dua pilar, ditambah satu zona di tiap ujung
// (pilar pojok punya zonanya sendiri) → jumlah zona = jumlah pilar + 1.
//   Open Storage   :  6 pilar →  7 zona, 30.000 ton
//   Closed Storage : 11 pilar → 12 zona, 40.000 ton
//
// Kapasitas dibagi rata antar zona. Kalau nanti zona ujung ternyata lebih kecil,
// cukup ubah kapasitasZona() jadi lookup per zona — pemanggilnya tidak berubah.
//
// Kode zona (O1…C12) hanya id internal; di layar yang ditampilkan adalah nomor
// PILAR, dan zona dirujuk lewat posisinya terhadap pilar (lihat namaZona).

export type AreaKey = 'open' | 'closed';

export interface CoalAreaTheme {
    pita: string;      // latar pita judul (warna solid, teks putih)
    subteks: string;   // teks sekunder di atas pita
    bar: string;       // isi bar okupansi
    track: string;     // track bar okupansi
    batasAtas: string; // atap (closed) / garis putus-putus (open)
}

export interface CoalArea {
    key: AreaKey;
    prefix: string;
    nama: string;
    kapasitasTon: number;
    jumlahPilar: number;
    beratap: boolean;
    icon: string;
    /** Lebar denah relatif terhadap area terlebar, supaya terbaca satu site plan. */
    lebarPct: number;
    /** Lebar minimum sebelum denah digeser mendatar (layar sempit). */
    minWidthPx: number;
    theme: CoalAreaTheme;
}

export const COAL_AREAS: CoalArea[] = [
    {
        key: 'open', prefix: 'O', nama: 'Open Storage',
        kapasitasTon: 30000, jumlahPilar: 6, beratap: false,
        icon: 'wb_sunny', lebarPct: 78, minWidthPx: 500,
        theme: { pita: '#0d9488', subteks: '#a7f3e4', bar: '#0d9488', track: '#ccfbf1', batasAtas: '#5eead4' },
    },
    {
        // Abu-abu tua: kesan tertutup / beratap.
        key: 'closed', prefix: 'C', nama: 'Closed Storage',
        kapasitasTon: 40000, jumlahPilar: 11, beratap: true,
        icon: 'warehouse', lebarPct: 100, minWidthPx: 640,
        theme: { pita: '#334155', subteks: '#cbd5e1', bar: '#475569', track: '#e2e8f0', batasAtas: '#334155' },
    },
];

export const TOTAL_KAPASITAS_TON = COAL_AREAS.reduce((t, a) => t + a.kapasitasTon, 0);

/** Satu tumpukan batubara milik satu supplier di satu zona. */
export interface CoalLot {
    zona: string;          // 'O1' … 'C12'
    supplier: string;
    ton: number;           // estimasi
    tanggal_masuk: string; // 'YYYY-MM-DD'
}

export function jumlahZona(area: CoalArea): number {
    return area.jumlahPilar + 1;
}

export function zonaIds(area: CoalArea): string[] {
    return Array.from({ length: jumlahZona(area) }, (_, i) => `${area.prefix}${i + 1}`);
}

export function areaOfZona(zonaId: string): CoalArea {
    return COAL_AREAS.find(a => zonaId.startsWith(a.prefix)) ?? COAL_AREAS[0];
}

export function kapasitasZona(zonaId: string): number {
    const area = areaOfZona(zonaId);
    return area.kapasitasTon / jumlahZona(area);
}

export function lotsZona(lots: CoalLot[], zonaId: string): CoalLot[] {
    return lots.filter(l => l.zona === zonaId);
}

export function tonZona(lots: CoalLot[], zonaId: string): number {
    return lotsZona(lots, zonaId).reduce((t, l) => t + l.ton, 0);
}

/** Keterisian zona 0–100, sudah di-clamp & dibulatkan. */
export function persenZona(lots: CoalLot[], zonaId: string): number {
    return Math.round(Math.min(100, (tonZona(lots, zonaId) / kapasitasZona(zonaId)) * 100));
}

export function tonArea(lots: CoalLot[], area: CoalArea): number {
    return zonaIds(area).reduce((t, z) => t + tonZona(lots, z), 0);
}

/**
 * Label zona berbasis pilar — dipakai sebagai judul kartu detail, menggantikan
 * kode internal (`C3`). Zona ke-0 ada sebelum pilar 1, zona terakhir setelah
 * pilar terakhir, sisanya di antara dua pilar berurutan.
 */
export function namaZona(index: number, jml: number): string {
    if (index === 0) return 'Zona sebelum pilar 1';
    if (index === jml - 1) return `Zona setelah pilar ${jml - 1}`;
    return `Zona antara pilar ${index} dan ${index + 1}`;
}

// Delapan hue yang berjarak di roda warna, semuanya kontras di atas kartu putih.
// Sengaja tidak memakai teal/abu-abu karena dipakai pita judul area & pilar.
export const COAL_PALETTE = [
    '#e11d48', // merah
    '#ea580c', // oranye
    '#ca8a04', // kuning tua
    '#16a34a', // hijau
    '#0891b2', // cyan
    '#2563eb', // biru
    '#7c3aed', // ungu
    '#be185d', // magenta
];

function hashNama(nama: string): number {
    let h = 0;
    for (let i = 0; i < nama.length; i++) h = (h * 31 + nama.charCodeAt(i)) >>> 0;
    return h;
}

/** Warna dasar satu supplier — dipakai sebagai cadangan kalau namanya tak ada di peta. */
export function warnaSupplier(nama: string): string {
    return COAL_PALETTE[hashNama(nama) % COAL_PALETTE.length];
}

/**
 * Peta warna untuk seluruh supplier yang ada di data.
 *
 * Hash nama saja tidak cukup: dengan 8 warna, 6 supplier sudah bisa bentrok
 * (mis. "Nusa Coal" dan "Sumber Bara" jatuh di indeks yang sama) sehingga dua
 * supplier tampil sewarna dan petanya jadi salah baca. Di sini hash cuma jadi
 * titik awal; kalau slotnya sudah terpakai, digeser ke slot bebas berikutnya —
 * jadi warna tetap unik selama jumlah supplier <= panjang palet.
 */
export function petaWarnaSupplier(lots: CoalLot[]): Record<string, string> {
    const nama = [...new Set(lots.map(l => l.supplier))].sort((a, b) => a.localeCompare(b, 'id'));
    const terpakai = new Set<number>();
    const peta: Record<string, string> = {};
    for (const n of nama) {
        let idx = hashNama(n) % COAL_PALETTE.length;
        for (let i = 0; i < COAL_PALETTE.length && terpakai.has(idx); i++) {
            idx = (idx + 1) % COAL_PALETTE.length;
        }
        terpakai.add(idx);
        peta[n] = COAL_PALETTE[idx];
    }
    return peta;
}

/** Ambil warna dari peta, jatuh ke hash kalau namanya belum terdaftar. */
export function ambilWarna(peta: Record<string, string>, nama: string): string {
    return peta[nama] ?? warnaSupplier(nama);
}

export interface RingkasSupplier {
    nama: string;
    ton: number;
    jumlahZona: number;
    warna: string;
}

export function ringkasSupplier(lots: CoalLot[]): RingkasSupplier[] {
    const peta = petaWarnaSupplier(lots);
    const map = new Map<string, { ton: number; zona: Set<string> }>();
    for (const lot of lots) {
        const entry = map.get(lot.supplier) ?? { ton: 0, zona: new Set<string>() };
        entry.ton += lot.ton;
        entry.zona.add(lot.zona);
        map.set(lot.supplier, entry);
    }
    return [...map.entries()]
        .map(([nama, v]) => ({ nama, ton: v.ton, jumlahZona: v.zona.size, warna: ambilWarna(peta, nama) }))
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
}

export function formatTon(n: number): string {
    return Math.round(n).toLocaleString('id-ID');
}

export function formatTanggal(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
