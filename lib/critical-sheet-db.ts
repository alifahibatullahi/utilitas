/**
 * Cermin spreadsheet Critical Maintenance di Postgres — LAPIS BACA halaman web.
 *
 * Kenapa ada. Sebelum ini tiap request memuat seluruh spreadsheet ke memori lambda:
 * 27.513 baris, 8,75 MB JSON, ±51 MB heap, ±5 detik — untuk menyajikan 20 record (6,9 KB).
 * Pada plan gratis Vercel yang memutus fungsi di 10 detik, cold start-nya rawan timeout,
 * dan tiap kunjungan membayar ongkos yang sama lagi.
 *
 * Di sini daftar, pencarian, dan halaman item menjadi query SQL biasa: yang keluar dari
 * database hanya baris yang benar-benar ditampilkan. Spreadsheet tetap sumber kebenaran;
 * cermin ini diisi oleh lib/critical-sheet-sync.ts dan boleh dibangun ulang kapan saja.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
    extractCode,
    photoCellFormula,
    photoCellLabel,
    photoPageUrl,
    recordItemKeys,
    recordKindLabel,
    rowFingerprint,
    rowItemLabel,
    updatePhotoCell,
    normSearch,
    type ArgSeparator,
    type CriticalRow,
    type ItemDetail,
    type MaintenanceRow,
    type RecentEntry,
    type RowHint,
    type RowLocation,
    type TabRef,
} from './critical-sheet';

export function createAdmin(): SupabaseClient {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

/** Kolom yang benar-benar dibaca. Sengaja bukan '*': `search` saja 163 kB untuk satu item. */
const KOLOM = [
    'kind', 'row_index', 'uid', 'legacy_id', 'no', 'tanggal', 'tanggal_raw',
    'item', 'varian', 'uraian', 'scope', 'status', 'gabungan', 'link_foto',
    'pelapor', 'notif', 'tanggal_ok', 'tanggal_ok_raw', 'peng_ok',
    'shift', 'notifikasi', 'foreman', 'code',
].join(', ');

/**
 * Kolom untuk halaman item. Lebih ramping dari KOLOM karena satu item bisa 2.564 baris:
 * `gabungan` (25 kB), `legacy_id` (31 kB), dan `link_foto` tidak dirender di mana pun —
 * ikut terkirim hanya karena dulu bentuknya mengikuti baris sheet apa adanya.
 */
const KOLOM_ITEM = [
    'kind', 'row_index', 'uid', 'no', 'tanggal', 'tanggal_raw',
    'item', 'varian', 'uraian', 'scope', 'status',
    'pelapor', 'notif', 'tanggal_ok', 'tanggal_ok_raw', 'peng_ok',
    'shift', 'notifikasi', 'foreman', 'code',
].join(', ');

interface DbRow {
    kind: 'critical' | 'maintenance';
    row_index: number;
    uid: string;
    legacy_id: string;
    no: number | null;
    tanggal: string | null;
    tanggal_raw: string;
    item: string;
    varian: string;
    uraian: string;
    scope: string;
    status: string;
    gabungan: string;
    link_foto: string;
    pelapor: string;
    notif: string;
    tanggal_ok: string | null;
    tanggal_ok_raw: string;
    peng_ok: string;
    shift: string;
    notifikasi: string;
    foreman: string;
    code: string;
}

// ─── Konversi baris DB → bentuk yang dipakai app ─────────────────────────────

function toCriticalRow(r: DbRow): CriticalRow {
    return {
        uid: r.uid, sig: rowFingerprint(r.item, r.varian, r.uraian, r.tanggal_raw),
        legacyId: r.legacy_id, rowIndex: r.row_index, no: r.no,
        tanggal: r.tanggal, tanggalRaw: r.tanggal_raw, pelapor: r.pelapor,
        item: r.item, varian: r.varian, uraian: r.uraian, notif: r.notif,
        scope: r.scope, status: r.status, tanggalOk: r.tanggal_ok,
        tanggalOkRaw: r.tanggal_ok_raw, pengOk: r.peng_ok, gabungan: r.gabungan,
        linkFoto: r.link_foto,
    };
}

function toMaintenanceRow(r: DbRow): MaintenanceRow {
    return {
        uid: r.uid, sig: rowFingerprint(r.item, r.varian, r.uraian, r.tanggal_raw),
        legacyId: r.legacy_id, rowIndex: r.row_index, no: r.no,
        tanggal: r.tanggal, tanggalRaw: r.tanggal_raw, shift: r.shift,
        item: r.item, varian: r.varian, uraian: r.uraian, scope: r.scope,
        status: r.status, notifikasi: r.notifikasi, foreman: r.foreman,
        gabungan: r.gabungan, linkFoto: r.link_foto,
    };
}

function toRecentEntry(r: DbRow): RecentEntry {
    const critical = r.kind === 'critical';
    return {
        uid: r.uid,
        kind: r.kind,
        // Identitas untuk baris yang belum berfoto. Dihitung ulang dari isi barisnya,
        // bukan diambil dari kolom `fingerprint`, supaya tidak perlu ikut dikirim
        // database dan tidak mungkin berbeda dari isi yang sedang ditampilkan.
        rowIndex: r.row_index,
        sig: rowFingerprint(r.item, r.varian, r.uraian, r.tanggal_raw),
        tanggal: r.tanggal,
        tanggalRaw: r.tanggal_raw,
        shift: critical ? '' : r.shift,
        itemName: (r.item ?? '').replace(/\s+/g, ' ').trim(),
        variant: r.varian,
        code: r.code || extractCode(r.item),
        uraian: r.uraian,
        notifikasi: critical ? r.notif : r.notifikasi,
        scope: r.scope,
        status: r.status,
        pelapor: critical ? r.pelapor : '',
        foreman: critical ? '' : r.foreman,
        tanggalOkRaw: critical ? r.tanggal_ok_raw : '',
        itemKey: recordItemKeys(r.item, r.varian)[0],
    };
}

// ─── Query ───────────────────────────────────────────────────────────────────

/** `%` dan `_` punya arti khusus di LIKE — kata kunci operator harus diperlakukan literal. */
function escapeLike(v: string): string {
    return v.replace(/[\\%_]/g, m => `\\${m}`);
}

export interface FeedPage {
    items: RecentEntry[];
    total: number;
    page: number;
    pageSize: number;
    fetchedAt: string | null;
}

/**
 * Satu halaman daftar record. Urutannya menyamai feed in-memory yang lama: tanggal
 * terbaru dulu, yang tak bertanggal paling akhir, critical sebelum maintenance pada
 * tanggal yang sama, dan baris sheet terbawah (paling baru diketik) lebih dulu.
 *
 * Pencarian: SEMUA kata kunci harus muncul di kolom `search` (nama item + kode + uraian +
 * notifikasi), sama seperti filterRecentFeed dulu.
 */
export async function queryRecentFeed(opts: {
    kind: 'all' | 'critical' | 'maintenance';
    q: string;
    page: number;
    pageSize: number;
}): Promise<FeedPage> {
    const supabase = createAdmin();
    const start = (opts.page - 1) * opts.pageSize;

    let query = supabase
        .from('critical_sheet_rows')
        .select(KOLOM, { count: 'exact' });

    if (opts.kind !== 'all') query = query.eq('kind', opts.kind);
    for (const token of normSearch(opts.q).split(' ').filter(Boolean)) {
        query = query.ilike('search', `%${escapeLike(token)}%`);
    }

    const { data, error, count } = await query
        .order('tanggal', { ascending: false, nullsFirst: false })
        .order('kind', { ascending: true })
        .order('row_index', { ascending: false })
        .range(start, start + opts.pageSize - 1);
    if (error) throw error;

    return {
        items: ((data ?? []) as unknown as DbRow[]).map(toRecentEntry),
        total: count ?? 0,
        page: opts.page,
        pageSize: opts.pageSize,
        fetchedAt: await lastSyncedAt(supabase),
    };
}

/**
 * Semua record satu halaman item. Record multi-varian ("DEF") sudah dipecah menjadi
 * beberapa item key saat sync, jadi di sini cukup pencocokan array.
 */
export async function queryItemDetail(key: string): Promise<ItemDetail | null> {
    const supabase = createAdmin();

    // PostgREST membatasi 1.000 baris per response — dan batas itu tidak bisa ditembus
    // lewat header Range — sedangkan item tersibuk ("BOILER A/B" varian B) punya 2.564
    // record. Tanpa penjemputan bertahap, riwayatnya terpotong diam-diam.
    //
    // Halaman berikutnya diambil PARALEL, bukan berurutan: jaraknya ke Supabase
    // (ap-northeast-1) beberapa ratus milidetik, jadi 3 round-trip berderet itulah yang
    // membuat halaman item terbesar sempat 12,4 detik — di atas batas fungsi Vercel.
    const PAGE = 1000;
    const ambil = async (from: number): Promise<DbRow[]> => {
        const { data, error } = await supabase
            .from('critical_sheet_rows')
            .select(KOLOM_ITEM)
            .contains('item_keys', [key])
            .order('tanggal', { ascending: false, nullsFirst: false })
            .order('row_index', { ascending: false })
            .range(from, from + PAGE - 1);
        if (error) throw error;
        return (data ?? []) as unknown as DbRow[];
    };

    const pertama = await supabase
        .from('critical_sheet_rows')
        .select(KOLOM_ITEM, { count: 'exact' })
        .contains('item_keys', [key])
        .order('tanggal', { ascending: false, nullsFirst: false })
        .order('row_index', { ascending: false })
        .range(0, PAGE - 1);
    if (pertama.error) throw pertama.error;

    const rows = (pertama.data ?? []) as unknown as DbRow[];
    const total = pertama.count ?? rows.length;
    if (total > PAGE) {
        const sisa = await Promise.all(
            Array.from({ length: Math.ceil(total / PAGE) - 1 }, (_, i) => ambil((i + 1) * PAGE)),
        );
        for (const s of sisa) rows.push(...s);
    }
    if (rows.length === 0) return null;

    const criticals = rows.filter(r => r.kind === 'critical').map(toCriticalRow);
    const maintenances = rows.filter(r => r.kind === 'maintenance').map(toMaintenanceRow);
    const contoh = rows[0];
    const barIdx = key.lastIndexOf('|');
    return {
        key,
        itemName: (contoh.item ?? '').replace(/\s+/g, ' ').trim(),
        variant: barIdx >= 0 ? key.slice(barIdx + 1) : '',
        code: contoh.code || extractCode(contoh.item),
        criticals,
        maintenances,
    };
}

async function lastSyncedAt(supabase: SupabaseClient): Promise<string | null> {
    const { data } = await supabase
        .from('critical_sheet_sync')
        .select('tail_synced_at, full_synced_at')
        .eq('id', 1)
        .maybeSingle();
    if (!data) return null;
    return (data.tail_synced_at as string | null) ?? (data.full_synced_at as string | null);
}

/** Metadata tab + pemisah formula, disimpan sync supaya penulisan sel tak perlu baca sheet. */
export interface TabsMeta {
    tabs: { critical: TabRef; maintenance: TabRef };
    argSeparator: ArgSeparator;
}

export async function queryTabsMeta(): Promise<TabsMeta | null> {
    const supabase = createAdmin();
    const { data, error } = await supabase
        .from('critical_sheet_sync')
        .select('tabs')
        .eq('id', 1)
        .maybeSingle();
    if (error) throw error;
    const tabs = data?.tabs as TabsMeta | null | undefined;
    return tabs?.tabs ? tabs : null;
}

// ─── Menemukan baris pemilik sebuah foto ─────────────────────────────────────

/**
 * Cari baris pemilik `uid`, berlapis dari yang paling dapat dipercaya:
 *
 *   1. sel Dokumentasi (kolom `uid`) — satu-satunya penanda yang ikut berpindah bersama
 *      barisnya saat operator menyortir;
 *   2. sidik jari isi baris — WAJIB ada jalur ini: foto PERTAMA sebuah baris justru
 *      ditulis saat selnya masih kosong, jadi tanpa ini sel tak akan pernah terisi;
 *   3. kolom ID di AA (`legacy_id`) — arsip dari sebelum identitas pindah.
 *
 * Sidik jari yang cocok di lebih dari satu baris dianggap tidak menentukan: menebak di
 * situ berarti menempelkan foto ke baris yang mungkin salah.
 */
export async function findRowForUid(uid: string, hint?: RowHint | null): Promise<RowLocation | null> {
    if (!uid) return null;
    const supabase = createAdmin();
    const meta = await queryTabsMeta();
    if (!meta) return null;

    const lokasi = (r: DbRow): RowLocation => {
        const tab = r.kind === 'critical' ? meta.tabs.critical : meta.tabs.maintenance;
        return {
            kind: r.kind,
            tabTitle: tab.title,
            rowIndex: r.row_index,
            photoColIndex: tab.photoColIndex,
            itemKey: recordItemKeys(r.item, r.varian)[0],
            itemLabel: rowItemLabel(r.item, r.varian),
        };
    };

    // 1. Sel Dokumentasi.
    const { data: byUid } = await supabase
        .from('critical_sheet_rows').select(KOLOM).eq('uid', uid).limit(1);
    const hitUid = (byUid ?? []) as unknown as DbRow[];
    if (hitUid.length) return lokasi(hitUid[0]);

    // 2. Sidik jari.
    if (hint) {
        const sidik = rowFingerprint(hint.item, hint.varian, hint.uraian, hint.tanggalRaw);
        const { data: bySig } = await supabase
            .from('critical_sheet_rows').select(KOLOM)
            .eq('kind', hint.kind).eq('fingerprint', sidik).limit(5);
        const kandidat = (bySig ?? []) as unknown as DbRow[];
        if (kandidat.length === 1) return lokasi(kandidat[0]);
        if (kandidat.length > 1) {
            const tepat = kandidat.find(k => k.row_index === hint.rowIndex);
            if (tepat) return lokasi(tepat);
            console.warn(
                `[critical-sheet-db] uid ${uid}: ${kandidat.length} baris ${hint.kind} bersidik jari sama ` +
                `(baris ${kandidat.map(k => k.row_index).join(', ')}) — tidak ditebak.`,
            );
            return null;
        }
    }

    // 3. Arsip kolom ID.
    const { data: byLegacy } = await supabase
        .from('critical_sheet_rows').select(KOLOM).eq('legacy_id', uid).limit(1);
    const hitLegacy = (byLegacy ?? []) as unknown as DbRow[];
    if (hitLegacy.length) return lokasi(hitLegacy[0]);

    return null;
}

/**
 * Baris yang dituju upload PERTAMA sebuah record, ketika belum ada uid sama sekali.
 * Diidentifikasi dari nomor baris + sidik jari isinya; sidik jari yang diverifikasi ulang
 * di sini adalah yang membuat nomor baris basi tidak berujung menempelkan foto ke baris
 * yang salah — nomor baris bisa bergeser kapan saja oleh penyisipan di atasnya.
 *
 * `{ ambigu: true }` = sidik jari yang sama muncul di beberapa baris (record kembar
 * betulan, mis. dua entri identik di hari yang sama). Pemanggil harus meminta operator
 * memilih, bukan menebak.
 */
export async function resolveRowForUpload(
    kind: 'critical' | 'maintenance',
    rowIndex: number,
    sig: string,
): Promise<{ row: DbRow } | { ambigu: true; kandidat: DbRow[] } | null> {
    const supabase = createAdmin();

    const { data: tepat } = await supabase
        .from('critical_sheet_rows').select(KOLOM)
        .eq('kind', kind).eq('row_index', rowIndex).limit(1);
    const baris = ((tepat ?? []) as unknown as DbRow[])[0];
    if (baris && rowFingerprint(baris.item, baris.varian, baris.uraian, baris.tanggal_raw) === sig) {
        return { row: baris };
    }

    // Nomor barisnya sudah tidak cocok → barisnya bergeser. Cari lewat isinya.
    const { data: bySig } = await supabase
        .from('critical_sheet_rows').select(KOLOM)
        .eq('kind', kind).eq('fingerprint', sig).limit(5);
    const kandidat = (bySig ?? []) as unknown as DbRow[];
    if (kandidat.length === 1) return { row: kandidat[0] };
    if (kandidat.length > 1) return { ambigu: true, kandidat };
    return null;
}

/** uid yang sudah terpakai di cermin — penjaga agar uid baru tidak kembar. */
export async function uidsTerpakai(): Promise<Set<string>> {
    const supabase = createAdmin();
    const { data } = await supabase
        .from('critical_sheet_rows').select('uid').neq('uid', '');
    return new Set((data ?? []).map(r => r.uid as string));
}

/** Ringkasan baris untuk ditampilkan saat operator harus memilih di antara kembaran. */
export function ringkasBaris(r: DbRow) {
    return {
        kind: r.kind, rowIndex: r.row_index, item: r.item, varian: r.varian,
        uraian: r.uraian, tanggalRaw: r.tanggal_raw,
    };
}

/**
 * Tulis ulang sel "Dokumentasi" setelah jumlah foto satu baris berubah, lalu cerminkan
 * perubahannya ke Postgres supaya halaman langsung menampilkannya — tanpa menunggu sync
 * berikutnya dan tanpa menyentuh spreadsheet lebih dari satu sel.
 *
 * Best-effort: pemanggil (lib/sheet-photo-sync.ts) menelan errornya, karena foto sudah
 * tersimpan di R2 + Supabase dan spreadsheet hanyalah cermin.
 * Return false bila baris atau kolom Dokumentasi tidak ditemukan.
 */
export async function writePhotoCell(uid: string, count: number, hint?: RowHint | null): Promise<boolean> {
    const meta = await queryTabsMeta();
    if (!meta) {
        console.warn('[critical-sheet-db] metadata tab belum ada — jalankan sync penuh dulu');
        return false;
    }
    const loc = await findRowForUid(uid, hint);
    if (!loc || loc.photoColIndex === null) return false;

    const kindLabel = recordKindLabel(loc.kind);
    const value = photoCellFormula(
        count, photoPageUrl(loc.itemKey, uid), meta.argSeparator, loc.itemLabel, kindLabel,
    );
    await updatePhotoCell(loc.tabTitle, loc.photoColIndex, loc.rowIndex, value);

    // Sel di sheet sudah berubah; samakan cerminnya sekarang juga. Tanpa ini foto pertama
    // sebuah baris terlihat "belum tersimpan" sampai sync berikutnya berjalan.
    // Yang disimpan TAMPILANNYA, bukan formulanya — itu yang terbaca saat sync dari sheet.
    await createAdmin()
        .from('critical_sheet_rows')
        .update({
            uid: count > 0 ? uid : '',
            link_foto: count > 0 ? photoCellLabel(count, loc.itemLabel, kindLabel) : '',
        })
        .eq('kind', loc.kind)
        .eq('row_index', loc.rowIndex);

    return true;
}
