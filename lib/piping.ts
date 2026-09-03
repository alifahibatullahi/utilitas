// Spesifikasi & helper gambar isometrik jalur pipa air UBB.
//
// Halaman /piping menjawab dua pertanyaan saja: line ini DARI MANA KE MANA, dan
// ISINYA APA. Sengaja tanpa angka proses (level, flow, tekanan) dan tanpa
// sambungan ke Supabase.
//
// ─── Konvensi gambar yang diikuti ───
// · Proyeksi isometrik baku 30°: sumbu x (timur), y (utara), z (elevasi).
//   Semua ruas pipa sejajar salah satu sumbu, jadi di layar hanya muncul tiga
//   arah: 30° turun-kanan, 30° turun-kiri, dan tegak lurus.
// · Tag line: <ukuran>"-<KODE SERVICE>-<nomor>  (mis. 6"-CWS-1401).
//   Ukuran dibiarkan kosong selama belum dipastikan — tag tampil tanpa ukuran,
//   bukan diisi angka karangan.
// · Kode service memakai singkatan yang lazim dipakai di gambar pembangkit:
//   RW raw water · DMW demineralised water · CD condensate · BFW boiler feed
//   water · CWS cooling water supply · SW service water · FP fire protection.
// · Tag peralatan bergaya ISA: TK tangki, P pompa, DA deaerator, B boiler,
//   CT cooling tower, E penukar kalor, WT/DM unit pengolahan.
// · Garis penuh = rute sudah dipastikan; garis putus-putus = masih rangka yang
//   menunggu koreksi lapangan.
//
// INI BUKAN GAMBAR KONSTRUKSI: ukuran pipa, elevasi, spec, valve, dan fitting
// belum dimasukkan. Gambar ini peta rute untuk orientasi, bukan acuan fabrikasi.
//
// Koordinat ditulis dalam satuan plant (kira-kira meter) di lib/piping-data.ts,
// jadi rute bisa dikoreksi cukup dengan mengubah angka posisi — tanpa menyentuh
// kode gambar.

export type Vec3 = [number, number, number];
export interface Titik { x: number; y: number }

// ─── Proyeksi isometrik ───

/** cos 30° — separuh lebar isometrik. */
export const ISO_COS = Math.sqrt(3) / 2;
/** Piksel per satuan plant. Ukuran mutlak tidak penting: viewBox dihitung dari isi. */
export const SKALA = 10;

/** Lebar minimum sebelum gambar digeser mendatar di HP (pola DENAH_MIN_WIDTH_PX). */
export const DIAGRAM_MIN_WIDTH_PX = 1000;

/** Perbandingan sumbu elips isometrik untuk lingkaran mendatar (√3 : 1). */
export const ELIPS_RX = ISO_COS * Math.SQRT2; // 1.2247
export const ELIPS_RY = 0.5 * Math.SQRT2;     // 0.7071

export function proyeksi(p: Vec3): Titik {
    const [x, y, z] = p;
    return {
        x: (x - y) * ISO_COS * SKALA,
        y: ((x + y) * 0.5 - z) * SKALA,
    };
}

export function keD(pts: Titik[]): string {
    return pts.map((p, i) => (i === 0 ? 'M' : 'L') + ' ' + round(p.x) + ' ' + round(p.y)).join(' ');
}

function round(n: number): number {
    return Math.round(n * 100) / 100;
}

// ─── Fluida / service ───

export type FluidKey = 'raw' | 'demin' | 'kondensat' | 'feedwater' | 'rcw' | 'service' | 'fire';

export interface Fluida {
    /** Kode service yang masuk ke tag line. */
    kode: string;
    label: string;
    warna: string;
    deskripsi: string;
}

/** Satu-satunya sumber warna: dipakai garis, panah, tag, dan legend sekaligus. */
export const FLUIDA: Record<FluidKey, Fluida> = {
    raw:       { kode: 'RW',  label: 'Air baku / air olahan',  warna: '#38bdf8', deskripsi: 'Air dari sumber sampai keluar pengolahan' },
    demin:     { kode: 'DMW', label: 'Air demin',              warna: '#2563eb', deskripsi: 'Air bebas mineral untuk siklus uap' },
    kondensat: { kode: 'CD',  label: 'Kondensat',              warna: '#8b5cf6', deskripsi: 'Uap yang sudah mengembun di condenser' },
    feedwater: { kode: 'BFW', label: 'Air pengisi boiler',     warna: '#f97316', deskripsi: 'Feedwater dari deaerator ke boiler' },
    rcw:       { kode: 'CWS', label: 'Air pendingin (RCW)',    warna: '#0d9488', deskripsi: 'Air pendingin dari tangki RCW' },
    service:   { kode: 'SW',  label: 'Air service',            warna: '#64748b', deskripsi: 'Air pemakaian umum pabrik' },
    fire:      { kode: 'FP',  label: 'Air pemadam',            warna: '#dc2626', deskripsi: 'Air untuk hydrant / sistem pemadam' },
};

export const FLUIDA_KEYS = Object.keys(FLUIDA) as FluidKey[];

// ─── Peralatan ───

export type NodeTipe = 'sumber' | 'olah' | 'tangki' | 'pompa' | 'alat' | 'konsumen';

export const TIPE_LABEL: Record<NodeTipe, string> = {
    sumber: 'Sumber',
    olah: 'Pengolahan',
    tangki: 'Tangki',
    pompa: 'Pompa',
    alat: 'Peralatan',
    konsumen: 'Pemakai',
};

/** Tiga muka isometrik: atas paling terang, sisi kiri paling gelap. */
export interface TipeStyle { atas: string; kanan: string; kiri: string; garis: string; teks: string }

export const TIPE_STYLE: Record<NodeTipe, TipeStyle> = {
    sumber:   { atas: '#f1f5f9', kanan: '#e2e8f0', kiri: '#cbd5e1', garis: '#94a3b8', teks: '#334155' },
    olah:     { atas: '#e0f2fe', kanan: '#bae6fd', kiri: '#7dd3fc', garis: '#0284c7', teks: '#0c4a6e' },
    tangki:   { atas: '#dbeafe', kanan: '#bfdbfe', kiri: '#93c5fd', garis: '#2563eb', teks: '#1e3a8a' },
    pompa:    { atas: '#f8fafc', kanan: '#e2e8f0', kiri: '#cbd5e1', garis: '#475569', teks: '#0f172a' },
    alat:     { atas: '#e0e7ff', kanan: '#c7d2fe', kiri: '#a5b4fc', garis: '#4f46e5', teks: '#312e81' },
    konsumen: { atas: '#ccfbf1', kanan: '#99f6e4', kiri: '#5eead4', garis: '#0d9488', teks: '#134e4a' },
};

export type Arah = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

interface NodeDasar {
    id: string;
    /** Tag peralatan bergaya ISA; kosongkan untuk objek yang bukan peralatan bertag. */
    tag?: string;
    nama: string;
    tipe: NodeTipe;
    /** Sudut acuan (x, y, z) — untuk silinder ini titik pusat alasnya. */
    pos: Vec3;
    /** true = nama/keberadaannya masih tebakan, digambar bergaris putus-putus. */
    perluKonfirmasi?: boolean;
    /** Kaki penyangga digambar sampai lantai (untuk bejana yang terangkat). */
    penyangga?: boolean;
    /** Geser label supaya tidak bertabrakan dengan tetangganya. */
    labelGeser?: Titik;
}

export interface NodeKotak extends NodeDasar {
    bentuk: 'kotak';
    /** Panjang (x), lebar (y), tinggi (z) dalam satuan plant. */
    ukuran: Vec3;
}

export interface NodeSilinder extends NodeDasar {
    bentuk: 'silinder';
    jari: number;
    tinggi: number;
}

export type PipingNode = NodeKotak | NodeSilinder;

export function petaNode(nodes: PipingNode[]): Record<string, PipingNode> {
    return Object.fromEntries(nodes.map(n => [n.id, n]));
}

/** Titik pusat massa peralatan — dipakai untuk urutan gambar dan letak label. */
export function pusatNode(n: PipingNode): Vec3 {
    if (n.bentuk === 'silinder') {
        return [n.pos[0], n.pos[1], n.pos[2] + n.tinggi / 2];
    }
    const [x, y, z] = n.pos;
    const [w, d, h] = n.ukuran;
    return [x + w / 2, y + d / 2, z + h / 2];
}

/** Kedalaman terhadap mata: makin besar makin dekat, dipakai untuk urutan gambar. */
export function kedalaman(p: Vec3): number {
    return p[0] + p[1];
}

/**
 * Titik sambungan (nozzle) di muka peralatan.
 * tinggi = 0 di dasar, 1 di puncak.
 */
export function nozzle(n: PipingNode, arah: Arah, tinggi = 0.5): Vec3 {
    if (n.bentuk === 'silinder') {
        const [cx, cy, cz] = n.pos;
        const z = cz + n.tinggi * tinggi;
        switch (arah) {
            case '+x': return [cx + n.jari, cy, z];
            case '-x': return [cx - n.jari, cy, z];
            case '+y': return [cx, cy + n.jari, z];
            case '-y': return [cx, cy - n.jari, z];
            case '+z': return [cx, cy, cz + n.tinggi];
            case '-z': return [cx, cy, cz];
        }
    }
    const [x, y, z] = n.pos;
    const [w, d, h] = n.ukuran;
    const zt = z + h * tinggi;
    switch (arah) {
        case '+x': return [x + w, y + d / 2, zt];
        case '-x': return [x, y + d / 2, zt];
        case '+y': return [x + w / 2, y + d, zt];
        case '-y': return [x + w / 2, y, zt];
        case '+z': return [x + w / 2, y + d / 2, z + h];
        case '-z': return [x + w / 2, y + d / 2, z];
    }
}

const VEKTOR: Record<Arah, Vec3> = {
    '+x': [1, 0, 0], '-x': [-1, 0, 0],
    '+y': [0, 1, 0], '-y': [0, -1, 0],
    '+z': [0, 0, 1], '-z': [0, 0, -1],
};

function geser(p: Vec3, arah: Arah, jarak: number): Vec3 {
    const v = VEKTOR[arah];
    return [p[0] + v[0] * jarak, p[1] + v[1] * jarak, p[2] + v[2] * jarak];
}

// ─── Jalur pipa ───

export interface Sambungan {
    node: string;
    arah: Arah;
    /** 0 = dasar peralatan, 1 = puncak. */
    tinggi?: number;
    /** Panjang ruas lurus keluar dari nozzle sebelum pipa berbelok. */
    keluar?: number;
}

export interface PipingLine {
    id: string;
    /** Nomor urut line di dalam tag (mis. 1401). */
    nomor: number;
    /** Ukuran nominal dalam inci — biarkan kosong selama belum dipastikan. */
    ukuranInci?: number;
    dari: Sambungan;
    ke: Sambungan;
    fluida: FluidKey;
    /**
     * Urutan sumbu saat pipa berpindah dari ujung keluar ke ujung masuk,
     * mis. 'xzy' = geser timur dulu, lalu naik/turun, baru ke utara.
     */
    urutan?: string;
    /** Rute manual (satuan plant) kalau rute otomatis kurang rapi. */
    titik?: Vec3[];
    catatan?: string;
    /** true = rutenya masih rangka menunggu koreksi. */
    perluKonfirmasi?: boolean;
}

/** Tag line sesuai konvensi: ukuran"-SERVICE-nomor. Ukuran dilewati bila kosong. */
export function tagLine(line: PipingLine): string {
    const kode = FLUIDA[line.fluida].kode;
    const inti = kode + '-' + line.nomor;
    return line.ukuranInci ? line.ukuranInci + '"-' + inti : inti;
}

const KIRIM_SUMBU: Record<string, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

/**
 * Rute siku-siku 3D: keluar tegak lurus dari nozzle asal, pindah sumbu satu per
 * satu sesuai urutan, lalu masuk tegak lurus ke nozzle tujuan. Semua ruas
 * sejajar sumbu — syarat gambar isometrik yang benar.
 */
export function ruteLine(line: PipingLine, nodes: Record<string, PipingNode>): Vec3[] {
    if (line.titik && line.titik.length >= 2) return line.titik;

    const a = nodes[line.dari.node];
    const b = nodes[line.ke.node];
    if (!a || !b) return [];

    const p0 = nozzle(a, line.dari.arah, line.dari.tinggi ?? 0.5);
    const p1 = nozzle(b, line.ke.arah, line.ke.tinggi ?? 0.5);
    const q0 = geser(p0, line.dari.arah, line.dari.keluar ?? 3);
    const q1 = geser(p1, line.ke.arah, line.ke.keluar ?? 3);

    const pts: Vec3[] = [p0, q0];
    let kini: Vec3 = [...q0];
    for (const huruf of line.urutan ?? 'xzy') {
        const i = KIRIM_SUMBU[huruf];
        if (i === undefined || Math.abs(kini[i] - q1[i]) < 0.01) continue;
        kini = [...kini];
        kini[i] = q1[i];
        pts.push(kini);
    }
    pts.push(q1, p1);
    return rapikan(pts);
}

/** Buang titik kembar dan titik yang segaris supaya panah & tag tidak menumpuk. */
function rapikan(pts: Vec3[]): Vec3[] {
    const out: Vec3[] = [];
    for (const p of pts) {
        const t = out[out.length - 1];
        if (t && Math.abs(t[0] - p[0]) < 0.01 && Math.abs(t[1] - p[1]) < 0.01 && Math.abs(t[2] - p[2]) < 0.01) continue;
        out.push(p);
    }
    return out;
}

export interface Ruas { a: Titik; b: Titik; panjang: number; sudut: number }

/** Ruas layar dari rute 3D, lengkap dengan sudut untuk memutar panah & tag. */
export function ruasLayar(rute: Vec3[]): Ruas[] {
    const layar = rute.map(proyeksi);
    const out: Ruas[] = [];
    for (let i = 0; i < layar.length - 1; i++) {
        const a = layar[i];
        const b = layar[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        out.push({ a, b, panjang: Math.hypot(dx, dy), sudut: (Math.atan2(dy, dx) * 180) / Math.PI });
    }
    return out;
}

export function ruasTerpanjang(ruas: Ruas[]): Ruas | null {
    if (ruas.length === 0) return null;
    return ruas.reduce((t, r) => (r.panjang > t.panjang ? r : t), ruas[0]);
}

/** Titik tengah sebuah ruas — tempat panah arah aliran dan tag line. */
export function tengah(r: Ruas): Titik {
    return { x: (r.a.x + r.b.x) / 2, y: (r.a.y + r.b.y) / 2 };
}

/** Sudut teks: teks tidak pernah dibaca terbalik, jadi dibatasi -90°..90°. */
export function sudutTeks(sudut: number): number {
    if (sudut > 90) return sudut - 180;
    if (sudut < -90) return sudut + 180;
    return sudut;
}

// ─── Bingkai gambar ───

export interface Batas { minX: number; minY: number; maxX: number; maxY: number }

export function batasKosong(): Batas {
    return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

export function tambahBatas(b: Batas, t: Titik): Batas {
    return {
        minX: Math.min(b.minX, t.x),
        minY: Math.min(b.minY, t.y),
        maxX: Math.max(b.maxX, t.x),
        maxY: Math.max(b.maxY, t.y),
    };
}

/** Semua titik pojok peralatan — dipakai menghitung viewBox. */
export function titikNode(n: PipingNode): Titik[] {
    if (n.bentuk === 'silinder') {
        const atas = proyeksi([n.pos[0], n.pos[1], n.pos[2] + n.tinggi]);
        const bawah = proyeksi([n.pos[0], n.pos[1], n.pos[2]]);
        const rx = n.jari * ELIPS_RX * SKALA;
        const ry = n.jari * ELIPS_RY * SKALA;
        return [
            { x: atas.x - rx, y: atas.y - ry }, { x: atas.x + rx, y: atas.y + ry },
            { x: bawah.x - rx, y: bawah.y - ry }, { x: bawah.x + rx, y: bawah.y + ry },
        ];
    }
    const [x, y, z] = n.pos;
    const [w, d, h] = n.ukuran;
    const out: Titik[] = [];
    for (const a of [0, 1]) for (const b of [0, 1]) for (const c of [0, 1]) {
        out.push(proyeksi([x + a * w, y + b * d, z + c * h]));
    }
    return out;
}

/** Delapan pojok kotak sebagai muka isometrik: atas, kanan (+x), kiri (+y). */
export function mukaKotak(n: NodeKotak): { atas: Titik[]; kanan: Titik[]; kiri: Titik[] } {
    const [x, y, z] = n.pos;
    const [w, d, h] = n.ukuran;
    const P = (a: number, b: number, c: number) => proyeksi([x + a * w, y + b * d, z + c * h]);
    return {
        atas: [P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)],
        kanan: [P(1, 0, 1), P(1, 1, 1), P(1, 1, 0), P(1, 0, 0)],
        kiri: [P(0, 1, 1), P(1, 1, 1), P(1, 1, 0), P(0, 1, 0)],
    };
}

export function keTitikPoly(pts: Titik[]): string {
    return pts.map(p => round(p.x) + ',' + round(p.y)).join(' ');
}

// ─── Utilitas kecil ───

/** Hanya fluida yang benar-benar dipakai yang muncul di legend. */
export function fluidaDipakai(lines: PipingLine[]): FluidKey[] {
    const ada = new Set(lines.map(l => l.fluida));
    return FLUIDA_KEYS.filter(k => ada.has(k));
}

/** Pemenggal nama peralatan jadi maksimal dua baris. */
export function pecahNama(nama: string, maks = 18): string[] {
    if (nama.length <= maks) return [nama];
    const kata = nama.split(' ');
    const baris: string[] = [];
    let kini = '';
    for (const k of kata) {
        const calon = kini ? kini + ' ' + k : k;
        if (calon.length > maks && kini) { baris.push(kini); kini = k; } else { kini = calon; }
    }
    if (kini) baris.push(kini);
    return baris.length <= 2 ? baris : [baris[0], baris.slice(1).join(' ')];
}

export function formatTanggal(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return d + ' ' + bulan[m - 1] + ' ' + y;
}
