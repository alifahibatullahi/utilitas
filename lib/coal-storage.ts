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

import { getGroupForShift, type ShiftKey } from './constants';

export type AreaKey = 'open' | 'closed';

export interface CoalAreaTheme {
    pita: string;      // latar pita judul (warna solid, teks putih)
    subteks: string;   // teks sekunder di atas pita
    batasAtas: string; // atap (closed) / garis putus-putus (open)
}

export interface CoalArea {
    key: AreaKey;
    prefix: string;
    nama: string;
    /** Nama sesingkat mungkin untuk sel tabel — 'Open Storage' tidak muat di sana. */
    singkat: string;
    kapasitasTon: number;
    jumlahPilar: number;
    beratap: boolean;
    icon: string;
    theme: CoalAreaTheme;
}

/**
 * Lebar minimum denah sebelum digeser mendatar di layar sempit. Satu nilai
 * untuk kedua area supaya lebarnya sama persis dan perilaku scroll di HP juga
 * seragam — kedua denah lurus satu sama lain saat digeser.
 */
export const DENAH_MIN_WIDTH_PX = 640;

export const COAL_AREAS: CoalArea[] = [
    {
        key: 'open', prefix: 'O', nama: 'Open Storage', singkat: 'Open',
        kapasitasTon: 30000, jumlahPilar: 6, beratap: false,
        icon: 'wb_sunny',
        theme: { pita: '#0d9488', subteks: '#a7f3e4', batasAtas: '#5eead4' },
    },
    {
        // Abu-abu tua: kesan tertutup / beratap.
        key: 'closed', prefix: 'C', nama: 'Closed Storage', singkat: 'Closed',
        kapasitasTon: 40000, jumlahPilar: 11, beratap: true,
        icon: 'warehouse',
        theme: { pita: '#334155', subteks: '#cbd5e1', batasAtas: '#334155' },
    },
];

export const TOTAL_KAPASITAS_TON = COAL_AREAS.reduce((t, a) => t + a.kapasitasTon, 0);

/**
 * Apa yang sedang disorot di denah. Legend menyorot satu supplier (sebarannya
 * bisa lintas zona), sedangkan baris tabel di bawah denah menyorot satu zona.
 */
export interface Sorotan {
    tipe: 'supplier' | 'zona';
    nilai: string;
}

/** Satu tumpukan batubara milik satu supplier di satu zona. */
export interface CoalLot {
    zona: string;          // 'O1' … 'C12'
    supplier: string;
    ton: number;           // estimasi
    tanggal_masuk: string; // 'YYYY-MM-DD'

    // ── Semua di bawah OPSIONAL: diisi lib/coal-storage-query.ts saat merakit
    // tumpukan dari DB. Komponen lama yang cuma butuh empat field di atas tetap
    // jalan apa adanya.
    /** lot_id — sama dengan coal_arrivals.batch_id, atau UUID baru untuk tumpukan manual. */
    id?: string;
    /**
     * Basis waktu: loading yang rank-nya di bawah ini TIDAK boleh mengurangi tumpukan
     * ini, karena sudah tercermin pada angka yang dinyatakan operator saat opname.
     * Kosong = tanpa batas, yaitu perilaku murni-kejadian seperti sebelum ada koreksi.
     */
    minRank?: number;
    /** 'opname' = tonasenya pernyataan operator; 'kedatangan' = murni dari laporan shift. */
    sumber?: 'kedatangan' | 'opname';
    diubahOleh?: string;
    diubahPada?: string;   // ISO timestamp
    /** Batch terakhirnya masih 'progres' — kedatangan berikutnya akan menambah tumpukan ini. */
    adaPengirimanBerjalan?: boolean;
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

/** Index zona 0-based dari kodenya: 'C3' -> 2, 'O1' -> 0. */
export function indexZona(zonaId: string): number {
    const area = areaOfZona(zonaId);
    const n = Number(zonaId.slice(area.prefix.length));
    return Number.isFinite(n) ? Math.max(0, n - 1) : 0;
}

/**
 * Versi paling ringkas namaZona() untuk sel tabel: tanpa kata "Zona" di depan
 * dan tanpa "antara … dan …", jadi muat di kolom sempit.
 */
export function labelPilar(index: number, jml: number): string {
    if (index === 0) return 'sebelum pilar 1';
    if (index === jml - 1) return `setelah pilar ${jml - 1}`;
    return `pilar ${index}–${index + 1}`;
}

/** Label pendek zona lengkap dengan areanya: 'Closed · pilar 4–5'. */
export function labelZonaPendek(zonaId: string): string {
    const area = areaOfZona(zonaId);
    return `${area.singkat} · ${labelPilar(indexZona(zonaId), jumlahZona(area))}`;
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

/**
 * petaWarna sengaja bisa dititipkan dari luar: pemanggilnya biasanya meringkas
 * lot SISA, sedangkan paletnya harus tetap dihitung dari daftar lot penuh —
 * kalau tidak, supplier yang stoknya habis menghilang dari daftar dan warna
 * supplier lain ikut bergeser, jadi legend beda warna dengan denah.
 */
export function ringkasSupplier(lots: CoalLot[], petaWarna?: Record<string, string>): RingkasSupplier[] {
    const peta = petaWarna ?? petaWarnaSupplier(lots);
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

/** Tanggal tanpa tahun untuk kolom tabel yang sempit: '04 Agt'. */
export function formatTanggalPendek(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

/**
 * Terima tanggal 'YYYY-MM-DD' maupun timestamp ISO utuh, ditampilkan di zona waktu
 * lokal. Timestamp JANGAN dipotong .slice(0, 10) dulu: potongannya tanggal UTC, jadi
 * yang disimpan 00:00–07:00 WIB tampil mundur sehari.
 */
export function formatTanggal(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Awal hari (dalam skala UTC) dari sebuah tanggal — dasar hitung selisih hari. */
function awalHariUTC(d: Date): number {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Umur tumpukan dalam hari kalender.
 *
 * Dihitung dari tanggal, bukan dari jam: tumpukan yang masuk kemarin sore
 * tetap terbaca "1 hari", bukan "0 hari". Nilainya bisa negatif kalau tanggal
 * masuknya ada di depan hari ini — biar salah ketik tanggal kelihatan, bukan
 * diam-diam dibulatkan jadi nol.
 */
export function umurHari(iso: string, acuan: Date = new Date()): number {
    const [y, m, d] = iso.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0;
    return Math.round((awalHariUTC(acuan) - Date.UTC(y, m - 1, d)) / 86_400_000);
}

export interface TumpukanInfo {
    lot: CoalLot;
    area: CoalArea;
    labelZona: string; // 'Closed · sebelum pilar 1'
    umur: number;      // hari sejak tanggal masuk
    warna: string;     // warna supplier, sama dengan yang dipakai denah
}

/**
 * Seluruh tumpukan diurutkan dari yang paling lama menunggu di lapangan.
 *
 * Yang dikirim ke sini sebaiknya lot SISA (lihat lotsSisa) supaya tumpukan yang
 * sudah habis diambil tidak ikut terdaftar sebagai "paling lama". Seri tanggal
 * dimenangkan tumpukan yang lebih besar — sisa kecil di sebelahnya bukan yang
 * perlu diketahui operator lebih dulu.
 */
export function daftarUmurStok(
    lots: CoalLot[],
    petaWarna?: Record<string, string>,
    acuan?: Date,
): TumpukanInfo[] {
    const peta = petaWarna ?? petaWarnaSupplier(lots);
    return [...lots]
        .sort((a, b) => a.tanggal_masuk.localeCompare(b.tanggal_masuk) || b.ton - a.ton)
        .map(lot => ({
            lot,
            area: areaOfZona(lot.zona),
            labelZona: labelZonaPendek(lot.zona),
            umur: umurHari(lot.tanggal_masuk, acuan),
            warna: ambilWarna(peta, lot.supplier),
        }));
}

// ── Loading: pengambilan batubara dari storage ke hopper ────────────────────

/**
 * Satu kali pengambilan oleh payloader. Dua sumber (dirakit lib/coal-storage-query.ts):
 *   - coal_loadings: loading yang sudah dipecah per pilar lewat chip di form Handling;
 *   - shift_esp_handling: Total Loading yang diketik operator tiap shift. Belum ada
 *     pilarnya, jadi zona = null — tampil di riwayat tapi tidak mengurangi tumpukan
 *     mana pun, karena tak ada yang tahu tumpukan mana yang dikeruk.
 */
export interface CoalLoading {
    tanggal: string;           // 'YYYY-MM-DD'
    shift: ShiftKey;
    grup?: string;             // 'A'…'D'; kalau kosong diturunkan dari jadwal regu
    zona: string | null;       // 'O3' | 'C7' — pilar asal; null = pilar belum dicatat
    shovel: number;            // jumlah shovel payloader
    hopper: HopperKey | null;  // A = darat, B = laut, AB = keduanya; null = tak diisi
}

export type HopperKey = 'A' | 'B' | 'AB';

/** Kapasitas satu shovel payloader — ESTIMASI, makanya tonasenya selalu ditulis "±". */
export const TON_PER_SHOVEL = 3;

/** Hopper disimpan sebagai A/B/AB (ikut kolom laporan shift), ditampilkan sebagai lokasinya. */
export const HOPPER_LABEL: Record<HopperKey, string> = { A: 'Darat', B: 'Laut', AB: 'Darat + Laut' };

export function tonKeluarZona(loadings: CoalLoading[], zonaId: string): number {
    return loadings
        .filter(l => l.zona === zonaId)
        .reduce((t, l) => t + l.shovel * TON_PER_SHOVEL, 0);
}

/**
 * Lot yang benar-benar masih ada di lapangan: penempatan masuk dikurangi loading.
 *
 * Pengurangannya FIFO per zona — tumpukan tertua di zona itu habis lebih dulu,
 * sesuai cara payloader mengeruk. Lot yang tersisa nol dibuang dari hasil, dan
 * loading yang melebihi isi zona di-clamp (tidak pernah membuat sisa negatif).
 *
 * Jalannya KRONOLOGIS, bukan sekadar menjumlahkan seluruh loading per zona: satu
 * loading cuma boleh memakan tumpukan yang sudah ada saat itu (rank >= minRank-nya).
 * Tanpa ini, tumpukan yang baru masuk hari ini ikut dikurangi loading bulan lalu —
 * tak kelihatan pada data contoh yang rapi, tapi salah begitu datanya mengalir terus.
 */
export function lotsSisa(lots: CoalLot[], loadings: CoalLoading[]): CoalLot[] {
    // Satu salinan per lot supaya sisanya bisa dikurangi tanpa menyentuh masukan.
    const salinan = lots.map(lot => ({ ...lot }));

    const perZona = new Map<string, typeof salinan>();
    for (const lot of salinan) {
        const daftar = perZona.get(lot.zona) ?? [];
        daftar.push(lot);
        perZona.set(lot.zona, daftar);
    }
    // FIFO: di dalam satu zona, tumpukan tertua dikeruk lebih dulu.
    for (const daftar of perZona.values()) {
        daftar.sort((a, b) => a.tanggal_masuk.localeCompare(b.tanggal_masuk));
    }

    const urut = [...loadings].sort(
        (a, b) => rankShift(a.tanggal, a.shift) - rankShift(b.tanggal, b.shift));

    for (const l of urut) {
        // Loading tanpa pilar tidak boleh memakan tumpukan mana pun: menebak zonanya
        // berarti mengarang stok.
        if (!l.zona) continue;
        const daftar = perZona.get(l.zona);
        if (!daftar) continue;
        const rank = rankShift(l.tanggal, l.shift);
        let jatah = l.shovel * TON_PER_SHOVEL;
        for (const lot of daftar) {
            if (jatah <= 0) break;
            // Tumpukan yang basisnya lebih baru dari loading ini dilewati: tonasenya
            // dinyatakan operator SETELAH loading itu terjadi, jadi sudah memperhitungkannya.
            if (lot.minRank !== undefined && rank < lot.minRank) continue;
            const diambil = Math.min(jatah, lot.ton);
            lot.ton -= diambil;
            jatah -= diambil;
        }
        // Sisa jatah sengaja dibuang: loading yang melebihi isi zona tidak boleh negatif.
    }

    return salinan.filter(lot => lot.ton > 0);
}

export interface LoadingInfo {
    loading: CoalLoading;
    area: CoalArea | null;    // null = pilar belum dicatat
    labelZona: string;        // 'Closed · pilar 4–5' | 'pilar belum dicatat'
    grup: string;             // 'A'…'D'
    ton: number;              // shovel × TON_PER_SHOVEL
    supplier: string | null;  // batubara siapa yang terkeruk di sana
    warna: string | null;
    /**
     * false = loading ini lebih tua dari opname terakhir di zonanya, jadi sudah tertutup
     * opname itu. Barisnya tetap ditampilkan (itu kejadian nyata yang dilaporkan shift),
     * hanya diredupkan supaya tidak dikira masih berpengaruh.
     *
     * Loading tanpa pilar selalu true: tidak ada opname yang bisa menutupnya. Ia memang
     * tidak mengurangi denah, tapi karena tak ada pilarnya, bukan karena tertutup opname —
     * dan meredupkannya akan meredupkan hampir seluruh isi tabel.
     */
    berlaku: boolean;
}

// Urutan kronologis dalam satu tanggal laporan: malam (23:00 D-1 → 07:00 D) lalu pagi, lalu sore.
export const URUT_SHIFT: Record<ShiftKey, number> = { malam: 0, pagi: 1, sore: 2 };

/**
 * Urutan kronologis MUTLAK sebuah (tanggal, shift) dalam satu skala angka, supaya
 * kedatangan, loading, dan basis opname bisa dibandingkan langsung tanpa memisah
 * perbandingan tanggal dan shift. Tanggal jadi nomor hari dikali 3, shift jadi
 * offset 0–2 di dalam hari itu.
 */
export function rankShift(tanggal: string, shift: ShiftKey): number {
    const [y, m, d] = tanggal.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0;
    const hari = Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
    return hari * 3 + (URUT_SHIFT[shift] ?? 0);
}

/**
 * Riwayat loading, terbaru di atas.
 *
 * Supplier per baris ditebak dari lot TERTUA di zona itu — sama dengan urutan
 * FIFO yang dipakai lotsSisa, jadi titik warnanya sejalan dengan gundukan yang
 * memang berkurang di denah. Zona yang tak punya penempatan sama sekali
 * dibiarkan tanpa supplier (titik warnanya tidak digambar), begitu juga loading
 * yang pilarnya belum dicatat.
 */
export function daftarLoading(
    lots: CoalLot[],
    loadings: CoalLoading[],
    petaWarna?: Record<string, string>,
): LoadingInfo[] {
    const peta = petaWarna ?? petaWarnaSupplier(lots);
    const tertua = new Map<string, string>();
    for (const lot of [...lots].sort((a, b) => a.tanggal_masuk.localeCompare(b.tanggal_masuk))) {
        if (!tertua.has(lot.zona)) tertua.set(lot.zona, lot.supplier);
    }

    // Basis paling longgar di tiap zona: kalau SATU tumpukan pun masih bisa dikeruk
    // oleh loading serank itu, loadingnya masih berlaku. Zona tanpa tumpukan hidup
    // tidak punya batas, jadi barisnya tidak diredupkan tanpa alasan.
    const basisZona = new Map<string, number>();
    for (const lot of lots) {
        if (lot.minRank === undefined) { basisZona.set(lot.zona, -Infinity); continue; }
        const kini = basisZona.get(lot.zona);
        if (kini === undefined || lot.minRank < kini) basisZona.set(lot.zona, lot.minRank);
    }

    return [...loadings]
        .sort((a, b) =>
            b.tanggal.localeCompare(a.tanggal) || URUT_SHIFT[b.shift] - URUT_SHIFT[a.shift])
        .map(loading => {
            const zona = loading.zona;
            const supplier = zona ? tertua.get(zona) ?? null : null;
            const basis = zona ? basisZona.get(zona) : undefined;
            return {
                loading,
                area: zona ? areaOfZona(zona) : null,
                labelZona: zona ? labelZonaPendek(zona) : 'pilar belum dicatat',
                grup: loading.grup ?? getGroupForShift(loading.tanggal, loading.shift),
                ton: loading.shovel * TON_PER_SHOVEL,
                supplier,
                warna: supplier ? ambilWarna(peta, supplier) : null,
                berlaku: basis === undefined
                    || rankShift(loading.tanggal, loading.shift) >= basis,
            };
        });
}

// ── Penyuntingan isi zona dari denah ────────────────────────────────────────

/**
 * Ruang yang masih kosong di sebuah zona, dalam ton.
 *
 * `kecualiLotId` dipakai saat MENGUBAH satu tumpukan: tumpukan yang sedang disunting
 * harus dikeluarkan dulu dari hitungan, kalau tidak tonasenya sendiri terhitung dua
 * kali dan operator dapat peringatan kapasitas palsu.
 */
export function sisaRuangZona(lots: CoalLot[], zonaId: string, kecualiLotId?: string): number {
    const terpakai = lotsZona(lots, zonaId)
        .filter(l => kecualiLotId === undefined || l.id !== kecualiLotId)
        .reduce((t, l) => t + l.ton, 0);
    return kapasitasZona(zonaId) - terpakai;
}

export interface PeriksaTumpukan {
    /** Memblokir simpan. */
    galat: string[];
    /** Boleh dilanjutkan operator — cuma diminta memastikan. */
    peringatan: string[];
}

/**
 * Aturan validasi satu tumpukan sebelum disimpan.
 *
 * Kapasitas zona SENGAJA cuma jadi peringatan, bukan galat: kapasitasZona() membagi
 * rata kapasitas area (lihat catatan di kepala berkas ini), sedangkan zona ujung di
 * lapangan kemungkinan lebih kecil — memblokir di angka yang kita sendiri belum yakin
 * berarti melarang operator mencatat kenyataan.
 */
export function periksaTumpukan(
    input: { supplier: string; ton: number; tanggal_masuk: string; zona: string; lotId?: string },
    lots: CoalLot[],
    acuan?: Date,
): PeriksaTumpukan {
    const galat: string[] = [];
    const peringatan: string[] = [];

    if (!input.supplier.trim()) galat.push('Nama supplier belum diisi.');
    if (!Number.isFinite(input.ton) || input.ton <= 0) galat.push('Tonase harus lebih dari 0.');
    if (!input.tanggal_masuk) galat.push('Tanggal masuk belum diisi.');

    const kapasitas = kapasitasZona(input.zona);
    if (Number.isFinite(input.ton) && input.ton > kapasitas * 2) {
        galat.push(`Tonase ${formatTon(input.ton)} t lebih dari dua kali kapasitas zona `
            + `(${formatTon(kapasitas)} t) — sepertinya salah ketik.`);
    }

    const umur = input.tanggal_masuk ? umurHari(input.tanggal_masuk, acuan) : 0;
    if (umur < 0) galat.push('Tanggal masuk ada di masa depan.');
    else if (umur > 365) peringatan.push(`Tanggal masuk ${umur} hari lalu — yakin?`);

    const ruang = sisaRuangZona(lots, input.zona, input.lotId);
    if (Number.isFinite(input.ton) && input.ton > ruang) {
        const total = kapasitas - ruang + input.ton;
        peringatan.push(`Zona ini jadi ${Math.round((total / kapasitas) * 100)}% dari kapasitas `
            + `(${formatTon(total)} t dari ${formatTon(kapasitas)} t).`);
    }

    const lot = input.lotId ? lots.find(l => l.id === input.lotId) : undefined;
    if (lot?.adaPengirimanBerjalan) {
        peringatan.push('Pengiriman ini masih berjalan; kedatangan berikutnya akan '
            + 'DITAMBAHKAN ke angka yang kamu tulis.');
    }

    return { galat, peringatan };
}
