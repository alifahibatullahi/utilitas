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
//   shift_esp_handling Total Loading yang diketik operator tiap shift — belum ada
//                      pilarnya, jadi cuma mengisi Riwayat Loading, tidak mengurangi stok
//
// TIDAK memakai realtime. Tabel nyasar di publication supabase_realtime pernah
// membuat compute Supabase jenuh sampai API balas 522 (insiden 3 Jun 2026);
// halaman ini cukup fetch saat dibuka.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoalArrivalRow, CoalLoadingRow, CoalLotKoreksiRow } from './supabase/types';
import { type ShiftKey } from './constants';
import { type CoalLoading, type CoalLot, type HopperKey, rankShift } from './coal-storage';

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
