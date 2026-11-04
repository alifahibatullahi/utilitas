// Query data denah /coal-storage: merakit tumpukan dari tiga tabel dan menyimpan
// koreksi manual. lib/coal-storage.ts sengaja tetap murni (spesifikasi, geometri,
// dan matematika stok) supaya komponen visual tidak ikut menarik kode query; di
// sini Supabase diimpor type-only, jadi yang masuk bundle cuma logika perakitan.
//
// Empat sumber, satu hasil:
//   coal_arrivals      kedatangan per shift; satu pengiriman yang berlanjut memakai
//                      batch_id yang sama, jadi satu batch = SATU tumpukan di denah
//   coal_lot_koreksi   koreksi manual dari denah; baris TERBARU per lot_id yang berlaku
//   coal_loadings      pengerukan payloader per pilar; dikurangkan FIFO oleh lotsSisa()
//   shift_esp_handling Total Loading yang diketik operator tiap shift — kalau shift itu
//                      tak punya pilar, cuma mengisi Riwayat Loading, tidak mengurangi stok
//
// fetchLoadingHarian & fetchInfoKedatangan di bawah melayani tab Handling laporan
// harian & shift, bukan denah.
//
// TIDAK memakai realtime. Tabel nyasar di publication supabase_realtime pernah
// membuat compute Supabase jenuh sampai API balas 522 (insiden 3 Jun 2026);
// halaman ini cukup fetch saat dibuka.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoalArrivalRow, CoalLoadingRow, CoalLotKoreksiRow } from './supabase/types';
import { type ShiftKey } from './constants';
import { type AsalKedatangan, type CoalLoading, type CoalLot, type HopperKey, type MetodeUnloading, rankShift, URUT_SHIFT } from './coal-storage';

/**
 * Lantai riwayat loading yang ditarik, dalam hari.
 *
 * Batas sebenarnya dihitung dari basis tumpukan hidup paling tua (loading yang lebih
 * tua dari itu tidak bisa mengurangi apa pun, jadi percuma ditarik). Lantai ini cuma
 * memastikan tabel Riwayat Loading tetap punya isi walau seluruh storage baru saja
 * di-opname. Jangan diganti jadi fetch tanpa batas.
 */
const LANTAI_RIWAYAT_HARI = 60;

export interface DenahData {
    /** Tumpukan PENUH — belum dikurangi loading. Kurangi dengan lotsSisa(). */
    lots: CoalLot[];
    loadings: CoalLoading[];
    /** ISO timestamp perubahan terakhir di seluruh denah; null = belum ada data. */
    diubahPada: string | null;
    /** null = belum pernah dikoreksi manual (angkanya murni dari laporan shift). */
    diubahOleh: string | null;
}

export interface KoreksiInput {
    lotId: string;
    zona: string;
    supplier: string;
    tanggalMasuk: string;
    /** Tonase yang dinyatakan operator; diabaikan kalau dihapus. */
    ton: number;
    /** Basis: kedatangan & loading setelah (tanggal, shift) ini tetap dihitung. */
    sejakTanggal: string;
    sejakShift: ShiftKey;
    dihapus?: boolean;
    keterangan?: string | null;
    operatorId?: string | null;
    operatorName: string;
}

/** Baris Total Loading dari laporan shift, lengkap dengan kepala laporannya. */
interface BarisLoadingShift {
    loading: string | null;   // kolom TEXT; isinya angka shovel
    hopper: string | null;
    shift_reports: { date: string; shift: string; group_name: string | null };
}

function kunciShift(r: { date: string; shift: string }): string {
    return `${r.date}|${r.shift}`;
}

/**
 * Hopper dari laporan shift tidak selalu rapi (ada 'a' huruf kecil, ada yang kosong).
 * Yang tidak dikenali jadi null — ditampilkan "—", bukan ditebak jadi Darat.
 */
function normalHopper(nilai: string | null): HopperKey | null {
    const h = (nilai ?? '').trim().toUpperCase();
    return h === 'A' || h === 'B' || h === 'AB' ? h : null;
}

function iso(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Seluruh isi denah.
 *
 * Dua fase disengaja: kedatangan & koreksi ditarik penuh (keduanya kecil, dan
 * identitas tumpukan cuma bisa direkonstruksi dari riwayat utuh), baru setelah tahu
 * tumpukan mana yang hidup kita tahu sejauh mana loading perlu ditarik.
 */
export async function fetchDenah(supabase: SupabaseClient): Promise<DenahData> {
    const [kedatangan, koreksi] = await Promise.all([
        supabase.from('coal_arrivals').select('*').order('created_at', { ascending: true }),
        supabase.from('coal_lot_koreksi').select('*').order('created_at', { ascending: true }),
    ]);
    if (kedatangan.error) throw kedatangan.error;
    if (koreksi.error) throw koreksi.error;

    const barisKedatangan = (kedatangan.data ?? []) as CoalArrivalRow[];
    const barisKoreksi = (koreksi.data ?? []) as CoalLotKoreksiRow[];

    // ── Kelompokkan kedatangan per batch; itulah satuan "tumpukan" ──────────
    const perBatch = new Map<string, CoalArrivalRow[]>();
    for (const r of barisKedatangan) {
        const daftar = perBatch.get(r.batch_id) ?? [];
        daftar.push(r);
        perBatch.set(r.batch_id, daftar);
    }

    // ── Koreksi yang berlaku = baris TERBARU per lot_id ─────────────────────
    // Datanya sudah urut created_at menaik, jadi penulisan terakhir yang menang.
    const berlaku = new Map<string, CoalLotKoreksiRow>();
    for (const r of barisKoreksi) berlaku.set(r.lot_id, r);

    const lots: CoalLot[] = [];
    for (const lotId of new Set([...perBatch.keys(), ...berlaku.keys()])) {
        const k = berlaku.get(lotId);
        if (k?.dihapus) continue;   // tumpukan dinyatakan sudah tidak ada di lapangan

        // Baris kedatangan paling awal memegang identitas: form Handling mengunci
        // supplier/zona/tanggal_masuk pada baris lanjutan, jadi yang pertama akurat.
        const batch = (perBatch.get(lotId) ?? [])
            .slice()
            .sort((a, b) => rankShift(a.date, a.shift as ShiftKey) - rankShift(b.date, b.shift as ShiftKey));
        const awal = batch[0];
        if (!k && !awal) continue;  // tidak mungkin, tapi jangan bikin tumpukan hantu

        let minRank: number;
        let ton: number;
        if (k) {
            // Basis TEGAS SESUDAH: operator menghitung tumpukan SELAMA shift itu, jadi
            // kejadian di shift yang sama sudah tercermin pada angka yang dia lihat.
            minRank = rankShift(k.sejak_tanggal, k.sejak_shift as ShiftKey) + 1;
            ton = Number(k.ton_dasar) + batch
                .filter(r => rankShift(r.date, r.shift as ShiftKey) >= minRank)
                .reduce((t, r) => t + Number(r.ton ?? 0), 0);
        } else {
            // Tanpa koreksi: basis INKLUSIF di kedatangan pertama — loading sebelum
            // batubaranya ada tidak boleh menguranginya.
            minRank = rankShift(awal.date, awal.shift as ShiftKey);
            ton = batch.reduce((t, r) => t + Number(r.ton ?? 0), 0);
        }

        if (ton <= 0) continue;

        const akhir = batch[batch.length - 1];
        lots.push({
            id: lotId,
            zona: k?.zona ?? awal.zona,
            supplier: k?.supplier ?? awal.supplier,
            ton,
            tanggal_masuk: k?.tanggal_masuk ?? awal.tanggal_masuk,
            minRank,
            sumber: k ? 'opname' : 'kedatangan',
            diubahOleh: k?.operator_name,
            diubahPada: k?.created_at,
            adaPengirimanBerjalan: akhir?.status === 'progres',
        });
    }

    // ── Fase 2: loading secukupnya ──────────────────────────────────────────
    // Loading yang lebih tua dari basis SEMUA tumpukan hidup tidak bisa mengurangi
    // apa pun, jadi tidak perlu ditarik — kecuali sebagai riwayat untuk ditampilkan.
    const lantai = new Date();
    lantai.setDate(lantai.getDate() - LANTAI_RIWAYAT_HARI);
    const tanggalTumpukanTertua = lots.reduce<string | null>(
        (min, l) => (min === null || l.tanggal_masuk < min ? l.tanggal_masuk : min), null);
    const batas = tanggalTumpukanTertua && tanggalTumpukanTertua < iso(lantai)
        ? tanggalTumpukanTertua
        : iso(lantai);

    // Dua sumber sekaligus: coal_loadings (sudah dipecah per pilar) dan Total Loading
    // yang diketik operator di laporan shift. Yang kedua cuma untuk riwayat — tanpa
    // pilar ia tidak ikut FIFO — jadi jendelanya cukup lantai tampilan, bukan `batas`.
    const [hasilLoading, hasilShift] = await Promise.all([
        supabase
            .from('coal_loadings')
            .select('*')
            .gte('date', batas)
            .order('date', { ascending: true }),
        supabase
            .from('shift_esp_handling')
            .select('loading, hopper, shift_reports!inner(date, shift, group_name)')
            .gte('shift_reports.date', iso(lantai))
            .not('loading', 'is', null),
    ]);
    if (hasilLoading.error) throw hasilLoading.error;
    if (hasilShift.error) throw hasilShift.error;

    const barisShift = (hasilShift.data ?? []) as unknown as BarisLoadingShift[];
    // Grup asli per shift — dipinjamkan juga ke baris coal_loadings, yang tidak punya
    // kolom grup, supaya tidak perlu ditebak dari jadwal regu.
    const grupShift = new Map<string, string>();
    for (const r of barisShift) {
        if (r.shift_reports.group_name) grupShift.set(kunciShift(r.shift_reports), r.shift_reports.group_name);
    }

    const barisPilar = (hasilLoading.data ?? []) as CoalLoadingRow[];
    const loadings: CoalLoading[] = barisPilar.map(r => ({
        tanggal: r.date,
        shift: r.shift as ShiftKey,
        grup: grupShift.get(kunciShift(r)),
        zona: r.zona,
        shovel: Number(r.shovel ?? 0),
        hopper: normalHopper(r.hopper),
    }));

    // JANGAN hitung dobel: baris coal_loadings sebuah shift adalah PECAHAN dari Total
    // Loading shift yang sama (dibagi rata ke pilar terpilih saat simpan, lihat
    // app/input-laporan/page.tsx). Shift yang sudah dipecah per pilar diwakili pecahannya;
    // Total Loading-nya hanya dipakai untuk shift yang belum dipecah.
    const sudahDipecah = new Set(barisPilar.map(kunciShift));
    for (const r of barisShift) {
        const sr = r.shift_reports;
        if (sudahDipecah.has(kunciShift(sr))) continue;
        const shovel = Number(String(r.loading).replace(',', '.'));
        if (!Number.isFinite(shovel) || shovel <= 0) continue;
        loadings.push({
            tanggal: sr.date,
            shift: sr.shift as ShiftKey,
            grup: sr.group_name ?? undefined,
            zona: null,
            shovel,
            hopper: normalHopper(r.hopper),
        });
    }

    // ── "Terakhir diubah" ───────────────────────────────────────────────────
    // Koreksi manual menang karena itu pernyataan seseorang; kalau belum pernah ada,
    // jatuh ke kedatangan terakhir tanpa nama (itu hasil laporan shift, bukan opname).
    const koreksiTerakhir = barisKoreksi[barisKoreksi.length - 1];
    const kedatanganTerakhir = barisKedatangan
        .reduce<string | null>((max, r) => (max === null || r.created_at > max ? r.created_at : max), null);

    let diubahPada: string | null = null;
    let diubahOleh: string | null = null;
    if (koreksiTerakhir && (!kedatanganTerakhir || koreksiTerakhir.created_at >= kedatanganTerakhir)) {
        diubahPada = koreksiTerakhir.created_at;
        diubahOleh = koreksiTerakhir.operator_name;
    } else if (kedatanganTerakhir) {
        diubahPada = kedatanganTerakhir;
    }

    return { lots, loadings, diubahPada, diubahOleh };
}

/**
 * Simpan satu pernyataan operator tentang satu tumpukan.
 *
 * Selalu INSERT, tidak pernah UPDATE/DELETE: baris lama adalah jejak audit, dan
 * append-only berarti dua operator yang menyimpan bersamaan tidak bisa merusak apa
 * pun — yang kalah tetap tersimpan di riwayat.
 */
export async function simpanKoreksi(supabase: SupabaseClient, input: KoreksiInput): Promise<void> {
    const { error } = await supabase.from('coal_lot_koreksi').insert({
        lot_id: input.lotId,
        zona: input.zona,
        supplier: input.supplier.trim(),
        tanggal_masuk: input.tanggalMasuk,
        ton_dasar: input.dihapus ? 0 : input.ton,
        sejak_tanggal: input.sejakTanggal,
        sejak_shift: input.sejakShift,
        dihapus: input.dihapus ?? false,
        keterangan: input.keterangan?.trim() || null,
        operator_id: input.operatorId ?? null,
        operator_name: input.operatorName,
    });
    if (error) throw error;
}

/** Loading batubara satu shift untuk kartu ringkasan tab Handling laporan harian. */
export interface LoadingShiftHarian {
    shift: ShiftKey;
    /** Total Loading yang diketik operator (shift_esp_handling.loading); null = kosong. */
    shovel: number | null;
    hopper: HopperKey | null;
    /** Pilar asal dari coal_loadings; kosong = pilar belum dicatat. */
    zonas: string[];
}

/**
 * Loading batubara per shift pada satu tanggal laporan (konvensi ENDING: malam =
 * hari submit), urut Malam → Pagi → Sore. Totalnya dari yang diketik operator —
 * sumber yang sama dengan Sheets & /logbook — bukan jumlah pecahan coal_loadings;
 * coal_loadings cuma menyumbang daftar pilarnya. Shift tanpa Total Loading dan tanpa
 * pilar tidak dikembalikan.
 */
export async function fetchLoadingHarian(supabase: SupabaseClient, tanggal: string): Promise<LoadingShiftHarian[]> {
    const [pilar, total] = await Promise.all([
        supabase
            .from('coal_loadings')
            .select('shift, zona, hopper')
            .eq('date', tanggal)
            .order('created_at', { ascending: true }),
        supabase
            .from('shift_esp_handling')
            .select('loading, hopper, shift_reports!inner(date, shift)')
            .eq('shift_reports.date', tanggal),
    ]);
    if (pilar.error) throw pilar.error;
    if (total.error) throw total.error;

    const perShift = new Map<string, LoadingShiftHarian>();
    const ambil = (shift: string): LoadingShiftHarian => {
        let baris = perShift.get(shift);
        if (!baris) {
            baris = { shift: shift as ShiftKey, shovel: null, hopper: null, zonas: [] };
            perShift.set(shift, baris);
        }
        return baris;
    };

    for (const r of (total.data ?? []) as unknown as BarisLoadingShift[]) {
        const baris = ambil(r.shift_reports.shift);
        const teks = String(r.loading ?? '').trim();
        const shovel = Number(teks.replace(',', '.'));
        if (teks !== '' && Number.isFinite(shovel)) baris.shovel = shovel;
        baris.hopper = normalHopper(r.hopper);
    }
    for (const r of (pilar.data ?? []) as Pick<CoalLoadingRow, 'shift' | 'zona' | 'hopper'>[]) {
        const baris = ambil(r.shift);
        if (!baris.zonas.includes(r.zona)) baris.zonas.push(r.zona);
        baris.hopper ??= normalHopper(r.hopper);
    }

    return [...perShift.values()]
        .filter(b => b.shovel !== null || b.zonas.length > 0)
        .sort((a, b) => (URUT_SHIFT[a.shift] ?? 0) - (URUT_SHIFT[b.shift] ?? 0));
}

/** Pengiriman yang baris TERAKHIRnya masih 'progres' — bentuknya sama dengan OpenArrival di form Handling. */
export interface PengirimanBerjalan {
    batch_id: string;
    supplier: string;
    zona: string;
    tonSejauhIni: number;
    tanggal_masuk: string;
    /** Asal milik pengiriman — lanjutan mewarisinya. null = baris lama tanpa asal. */
    asal: AsalKedatangan | null;
}

const normalAsal = (v: string | null | undefined): AsalKedatangan | null =>
    v === 'tongkang' || v === 'darat' ? v : null;

/** Jendela kedatangan terbaru yang ditarik modal Kedatangan Batubara. */
const JENDELA_KEDATANGAN = 200;

/**
 * Bahan modal Kedatangan Batubara di form Handling: pengiriman yang masih berjalan
 * (dropdown "Pengiriman") dan nama supplier yang pernah dipakai (chip saran).
 *
 * Kedatangan ditarik 200 baris TERBARU lalu diproses kronologis. Pengiriman yang
 * awalnya jatuh di luar jendela hanya kurang di `tonSejauhIni`; tanggal masuknya
 * tetap benar karena baris lanjutan mewarisi tanggal induknya.
 *
 * Batch yang tumpukannya sudah DIHAPUS di denah dibuang dari daftar berjalan:
 * fetchDenah melewati lot `dihapus`, jadi lanjutan ke sana akan lenyap tanpa jejak.
 */
export async function fetchInfoKedatangan(
    supabase: SupabaseClient,
): Promise<{ berjalan: PengirimanBerjalan[]; suppliers: string[] }> {
    const [kedatangan, koreksi] = await Promise.all([
        supabase
            .from('coal_arrivals')
            .select('batch_id, supplier, zona, ton, tanggal_masuk, status, asal, created_at')
            .order('created_at', { ascending: false })
            .limit(JENDELA_KEDATANGAN),
        supabase
            .from('coal_lot_koreksi')
            .select('lot_id, supplier, dihapus, created_at')
            .order('created_at', { ascending: true }),
    ]);
    if (kedatangan.error) throw kedatangan.error;
    if (koreksi.error) throw koreksi.error;

    // Koreksi yang berlaku = baris terbaru per lot (data urut menaik).
    const koreksiBerlaku = new Map<string, Pick<CoalLotKoreksiRow, 'supplier' | 'dihapus'>>();
    for (const k of (koreksi.data ?? []) as CoalLotKoreksiRow[]) koreksiBerlaku.set(k.lot_id, k);

    const perBatch = new Map<string, PengirimanBerjalan & { status: string }>();
    const barisUrut = ((kedatangan.data ?? []) as CoalArrivalRow[]).slice().reverse();
    for (const r of barisUrut) {
        const prev = perBatch.get(r.batch_id);
        perBatch.set(r.batch_id, {
            batch_id: r.batch_id,
            supplier: r.supplier,
            zona: r.zona,
            // tanggal masuk = kedatangan pertama, supaya umur tumpukan benar
            tanggal_masuk: prev?.tanggal_masuk ?? r.tanggal_masuk,
            tonSejauhIni: (prev?.tonSejauhIni ?? 0) + Number(r.ton ?? 0),
            status: r.status,
            // Asal pengiriman dari baris pertamanya yang punya asal.
            asal: prev?.asal ?? normalAsal(r.asal),
        });
    }

    const berjalan = [...perBatch.values()]
        .filter(b => b.status === 'progres' && !koreksiBerlaku.get(b.batch_id)?.dihapus)
        .map(b => ({
            batch_id: b.batch_id, supplier: b.supplier, zona: b.zona,
            tonSejauhIni: b.tonSejauhIni, tanggal_masuk: b.tanggal_masuk, asal: b.asal,
        }));

    const suppliers = [...new Set([
        ...barisUrut.map(r => r.supplier),
        ...[...koreksiBerlaku.values()].filter(k => !k.dihapus).map(k => k.supplier),
    ].map(s => (s ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));

    return { berjalan, suppliers };
}

/** Satu pengiriman di layar daftar menu Kedatangan Batubara (dialog spreadsheet). */
export interface RingkasanPengiriman {
    /** batch_id coal_arrivals; null untuk tongkang hasil impor (tak punya baris kedatangan). */
    batch_id: string | null;
    supplier: string;
    asal: AsalKedatangan | null;
    metode: MetodeUnloading[];
    /** Zona yang pernah diisi pengiriman ini, urut pertama kali dipakai. */
    zona: string[];
    /** Tanggal mulai masuk storage. */
    mulai: string;
    /** Tanggal pengiriman ditutup; null = masih berjalan, atau catatan impor tak menyebutnya. */
    selesai: string | null;
    /** Laporan shift terakhir yang mencatatnya; null untuk impor. */
    terakhir: { date: string; shift: ShiftKey } | null;
    /** Total tonase; null bila catatan impor tak bisa diurai. */
    ton: number | null;
    status: 'progres' | 'selesai';
    sumber: 'form' | 'impor';
}

const normalMetode = (v: string | null | undefined): MetodeUnloading | null =>
    v === 'conveyor' || v === 'dump_truck' ? v : null;

/**
 * Angka format Indonesia di catatan impor: '7.510,414', '7518,073', '7.562', juga salah
 * ketik rekap '8.541.69' (titik terakhir yang tidak diikuti 3 digit = desimal).
 */
function angkaCatatan(s: string): number | null {
    const t = s.trim();
    let n: number;
    if (t.includes(',')) {
        n = Number(t.replace(/\./g, '').replace(',', '.'));
    } else {
        const bagian = t.split('.');
        const ekor = bagian[bagian.length - 1];
        n = bagian.length > 1 && ekor.length !== 3
            ? Number(`${bagian.slice(0, -1).join('')}.${ekor}`)
            : Number(bagian.join(''));
    }
    return Number.isFinite(n) && n > 0 ? n : null;
}

const tanggalCatatan = (dmy: string): string => {
    const [d, m, y] = dmy.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

/**
 * Total & tanggal selesai dari `keterangan` baris impor. Dua format yang pernah ditulis:
 *   kolom H Catatan  'mulai 22/10/2026 11.31, finish 25/10/2026 20.45 total 7.562 Ton'
 *                    'mulai 05/10/2026 17.34, final draught 7.513,306 Ton'
 *   rekap bongkar    'Import rekap bongkar BatuBara.xlsx (No 4): 30/08/2026 (02.13), 7.510,523 Ton, …'
 */
function uraiCatatanImpor(ket: string): { ton: number | null; selesai: string | null } {
    const total = ket.match(/(?:total|final draught)\s+([\d.,]+)\s*Ton/i)
        ?? ket.match(/\(No \d+\):\s*\d{1,2}\/\d{1,2}\/\d{4}[^,]*,\s*([\d.,]+)\s*Ton/i);
    const selesai = ket.match(/(?:finish|stop)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    return { ton: total ? angkaCatatan(total[1]) : null, selesai: selesai ? tanggalCatatan(selesai[1]) : null };
}

/**
 * Layar daftar menu Kedatangan Batubara: pengiriman yang masih berjalan dan beberapa yang
 * sudah selesai, terbaru dulu.
 *
 * Yang selesai digabung dari dua sumber, karena kedatangan sebelum menu & tab Handling dipakai
 * hanya ada sebagai opname hasil impor (kolom H Catatan, rekap bongkar) di coal_lot_koreksi —
 * total & tanggal selesainya diurai dari `keterangan` baris impor itu. Impor yang supplier &
 * tanggal masuknya sudah ada sebagai batch form dilewati supaya tidak dobel.
 */
export async function fetchRingkasanKedatangan(
    supabase: SupabaseClient,
    { maksSelesai }: { maksSelesai: number },
): Promise<{ berjalan: RingkasanPengiriman[]; selesai: RingkasanPengiriman[] }> {
    const [kedatangan, koreksi] = await Promise.all([
        supabase
            .from('coal_arrivals')
            .select('batch_id, date, shift, supplier, zona, ton, tanggal_masuk, status, asal, metode_unloading, created_at')
            .order('created_at', { ascending: false })
            .limit(JENDELA_KEDATANGAN),
        supabase
            .from('coal_lot_koreksi')
            .select('lot_id, zona, supplier, tanggal_masuk, dihapus, operator_name, keterangan, created_at')
            .order('created_at', { ascending: true }),
    ]);
    if (kedatangan.error) throw kedatangan.error;
    if (koreksi.error) throw koreksi.error;
    const barisKoreksi = (koreksi.data ?? []) as CoalLotKoreksiRow[];

    // ── Dari form: satu ringkasan per batch, baris diurutkan kronologis ──────
    const perBatch = new Map<string, CoalArrivalRow[]>();
    for (const r of (kedatangan.data ?? []) as CoalArrivalRow[]) {
        const daftar = perBatch.get(r.batch_id) ?? [];
        daftar.push(r);
        perBatch.set(r.batch_id, daftar);
    }
    const dariForm: RingkasanPengiriman[] = [...perBatch.entries()].map(([batchId, daftar]) => {
        const urut = daftar.slice().sort((a, b) =>
            rankShift(a.date, a.shift as ShiftKey) - rankShift(b.date, b.shift as ShiftKey)
            || a.created_at.localeCompare(b.created_at));
        const awal = urut[0];
        const akhir = urut[urut.length - 1];
        const selesai = akhir.status === 'selesai';
        return {
            batch_id: batchId,
            supplier: awal.supplier,
            asal: normalAsal(urut.find(r => r.asal)?.asal),
            metode: [...new Set(urut.map(r => normalMetode(r.metode_unloading)).filter((m): m is MetodeUnloading => !!m))],
            zona: [...new Set(urut.map(r => r.zona))],
            mulai: awal.tanggal_masuk,
            selesai: selesai ? akhir.date : null,
            terakhir: { date: akhir.date, shift: akhir.shift as ShiftKey },
            ton: urut.reduce((t, r) => t + Number(r.ton ?? 0), 0),
            status: selesai ? 'selesai' : 'progres',
            sumber: 'form',
        };
    });

    // Lot yang dihapus di denah = pengirimannya tak bisa dilanjutkan (sama dgn fetchInfoKedatangan).
    const dihapus = new Map<string, boolean>();
    for (const k of barisKoreksi) dihapus.set(k.lot_id, k.dihapus);
    const berjalan = dariForm
        .filter(p => p.status === 'progres' && !dihapus.get(p.batch_id!))
        .sort((a, b) => rankShift(b.terakhir!.date, b.terakhir!.shift) - rankShift(a.terakhir!.date, a.terakhir!.shift));

    // ── Dari impor: satu ringkasan per (supplier, tanggal masuk) ─────────────
    const kunci = (supplier: string, tanggal: string) => `${supplier.trim().toUpperCase()}|${tanggal}`;
    const sudahDiForm = new Set(dariForm.map(p => kunci(p.supplier, p.mulai)));
    const perImpor = new Map<string, CoalLotKoreksiRow[]>();
    for (const k of barisKoreksi) {
        const id = kunci(k.supplier, k.tanggal_masuk);
        const daftar = perImpor.get(id) ?? [];
        daftar.push(k);
        perImpor.set(id, daftar);
    }
    const dariImpor: RingkasanPengiriman[] = [];
    for (const [id, daftar] of perImpor) {
        if (sudahDiForm.has(id) || !daftar.some(k => k.operator_name.startsWith('Import'))) continue;
        const urai = daftar
            .filter(k => k.operator_name.startsWith('Import') && k.keterangan)
            .map(k => uraiCatatanImpor(k.keterangan!))
            .find(u => u.ton !== null) ?? { ton: null, selesai: null };
        dariImpor.push({
            batch_id: null,
            supplier: daftar[0].supplier,
            asal: null,
            metode: [],
            zona: [...new Set(daftar.map(k => k.zona))],
            mulai: daftar[0].tanggal_masuk,
            selesai: urai.selesai,
            terakhir: null,
            ton: urai.ton,
            status: 'selesai',
            sumber: 'impor',
        });
    }

    const selesai = [...dariForm.filter(p => p.status === 'selesai'), ...dariImpor]
        .sort((a, b) => (b.selesai ?? b.mulai).localeCompare(a.selesai ?? a.mulai) || b.mulai.localeCompare(a.mulai))
        .slice(0, maksSelesai);

    return { berjalan, selesai };
}

/** Seluruh riwayat perubahan satu tumpukan, terbaru di atas. */
export async function riwayatLot(
    supabase: SupabaseClient,
    lotId: string,
): Promise<CoalLotKoreksiRow[]> {
    const { data, error } = await supabase
        .from('coal_lot_koreksi')
        .select('*')
        .eq('lot_id', lotId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as CoalLotKoreksiRow[];
}
