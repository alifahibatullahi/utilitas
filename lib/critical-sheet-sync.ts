/**
 * Isi cermin `critical_sheet_rows` dari spreadsheet.
 *
 * Satu-satunya tempat spreadsheet dibaca berat, dan sengaja hanya dipanggil dari cron,
 * tombol "Perbarui data", dan script — TIDAK PERNAH dari jalur render halaman. Pembacaan
 * penuh butuh ±5 detik dan ±51 MB heap; plan gratis Vercel memutus fungsi di 10 detik.
 *
 * Dua tingkat, mengikuti kebiasaan operator:
 *   syncTail  — murah, sering. Hanya ujung sheet (baris hari-hari terakhir, satu-satunya
 *               bagian yang urutannya masih bergerak) + kolom Dokumentasi penuh.
 *   syncFull  — mahal, jarang. Seluruh A1:AE. Perlu karena isi baris LAMA masih berubah
 *               (Status / "Tanggal di OK" sering diisi belakangan) dan karena hanya
 *               pembacaan penuh yang bisa mengetahui baris terhapus.
 *
 * Keduanya hanya MENULIS BARIS YANG BERUBAH (dibandingkan lewat content_hash), jadi
 * pembaruan rutin menyentuh segelintir baris, bukan 27rb.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    extractCode,
    loadCriticalSheetFull,
    loadCriticalSheetTailFrom,
    loadSingleSheetRow,
    normSearch,
    recordItemKeys,
    rowFingerprint,
    type CriticalRow,
    type CriticalSheetData,
    type MaintenanceRow,
    type TabsSnapshot,
} from './critical-sheet';
import { createAdmin, queryTabsMeta, resolveRowForUpload } from './critical-sheet-db';

/** Berapa baris terakhir yang ikut dibaca ulang saat syncTail. */
const TAIL_ROWS = 400;

/**
 * Ekor untuk jalur INTERAKTIF (tombol "Perbarui data", `?refresh=1` dari menu spreadsheet).
 * Yang dicari operator di situ hanya baris yang baru saja ia ketik, jadi jendelanya tidak
 * perlu selebar cron — dan `hashEkor` ikut menyusut dari 4 permintaan Supabase jadi 2.
 */
export const TAIL_ROWS_INTERAKTIF = 100;

/** Sekali tulis maksimal sekian baris — menjaga payload request Supabase tetap wajar. */
const CHUNK = 500;

/** Sekali tanya maksimal sekian nomor baris — menjaga panjang URL PostgREST tetap wajar. */
const HASH_CHUNK = 300;

interface RowRecord {
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
    item_keys: string[];
    code: string;
    search: string;
    fingerprint: string;
    content_hash: string;
}

function baseRecord(kind: 'critical' | 'maintenance', r: CriticalRow | MaintenanceRow): RowRecord {
    const c = r as CriticalRow;
    const m = r as MaintenanceRow;
    const critical = kind === 'critical';
    const rec: RowRecord = {
        kind,
        row_index: r.rowIndex,
        uid: r.uid,
        legacy_id: r.legacyId,
        no: r.no,
        tanggal: r.tanggal,
        tanggal_raw: r.tanggalRaw,
        item: r.item,
        varian: r.varian,
        uraian: r.uraian,
        scope: r.scope,
        status: r.status,
        gabungan: r.gabungan,
        link_foto: r.linkFoto,
        pelapor: critical ? c.pelapor : '',
        notif: critical ? c.notif : '',
        tanggal_ok: critical ? c.tanggalOk : null,
        tanggal_ok_raw: critical ? c.tanggalOkRaw : '',
        peng_ok: critical ? c.pengOk : '',
        shift: critical ? '' : m.shift,
        notifikasi: critical ? '' : m.notifikasi,
        foreman: critical ? '' : m.foreman,
        // Turunan dihitung dengan fungsi yang sama persis dengan app, supaya hasil query
        // SQL identik dengan hasil filter in-memory yang lama.
        item_keys: recordItemKeys(r.item, r.varian),
        code: extractCode(r.item),
        search: normSearch(`${r.item} ${extractCode(r.item)} ${r.uraian} ${critical ? c.notif : m.notifikasi}`),
        fingerprint: rowFingerprint(r.item, r.varian, r.uraian, r.tanggalRaw),
        content_hash: '',
    };
    rec.content_hash = hashRecord(rec);
    return rec;
}

/**
 * Baris INTI: hanya yang dibutuhkan supaya foto bisa menempel dan pop up bisa menyebut
 * recordnya. Ditulis saat foto pertama sebuah baris diunggah — jalur itu tidak boleh ikut
 * memperbarui data critical/maintenance; itu urusan tombol "Perbarui data" dan cron.
 *
 * Yang ikut ditulis di luar item & uraian: `varian` + `tanggal_raw`, karena `rowFingerprint`
 * dihitung dari item|varian|uraian|tanggalRaw — tanpa keduanya `resolveRowForUpload` tidak
 * akan mengenali baris ini lagi pada upload berikutnya.
 *
 * `content_hash` sengaja dihitung dari baris inti ini, BUKAN dari baris penuh: hasilnya pasti
 * berbeda dari hash baris aslinya, jadi sync berikutnya melihatnya sebagai berubah dan
 * menimpanya dengan isi lengkap. Kalau hash penuh yang ditulis, baris ini akan dianggap
 * mutakhir selamanya dan kolom kosongnya tidak pernah terisi.
 */
function recordInti(kind: 'critical' | 'maintenance', r: CriticalRow | MaintenanceRow): RowRecord {
    const rec: RowRecord = {
        kind,
        row_index: r.rowIndex,
        uid: r.uid,
        item: r.item,
        varian: r.varian,
        uraian: r.uraian,
        tanggal: r.tanggal,
        tanggal_raw: r.tanggalRaw,
        item_keys: recordItemKeys(r.item, r.varian),
        code: extractCode(r.item),
        search: normSearch(`${r.item} ${extractCode(r.item)} ${r.uraian}`),
        fingerprint: rowFingerprint(r.item, r.varian, r.uraian, r.tanggalRaw),
        // Menyusul pada pembaruan berikutnya.
        legacy_id: '',
        no: null,
        scope: '',
        status: '',
        gabungan: '',
        link_foto: '',
        pelapor: '',
        notif: '',
        tanggal_ok: null,
        tanggal_ok_raw: '',
        peng_ok: '',
        shift: '',
        notifikasi: '',
        foreman: '',
        content_hash: '',
    };
    rec.content_hash = hashRecord(rec);
    return rec;
}

/** Hash seluruh isi baris — penentu "perlu ditulis ulang atau tidak". */
function hashRecord(rec: RowRecord): string {
    const bahan = [
        rec.uid, rec.legacy_id, rec.no ?? '', rec.tanggal ?? '', rec.tanggal_raw,
        rec.item, rec.varian, rec.uraian, rec.scope, rec.status, rec.gabungan, rec.link_foto,
        rec.pelapor, rec.notif, rec.tanggal_ok ?? '', rec.tanggal_ok_raw, rec.peng_ok,
        rec.shift, rec.notifikasi, rec.foreman,
    ].join('');
    return createHash('sha1').update(bahan).digest('hex').slice(0, 16);
}

function toRecords(data: CriticalSheetData): RowRecord[] {
    return [
        ...data.criticals.map(r => baseRecord('critical', r)),
        ...data.maintenances.map(r => baseRecord('maintenance', r)),
    ];
}

/**
 * Tulis hanya baris yang berubah. Hash lama diambil sekali untuk seluruh tabel (27rb
 * baris × ~30 byte ≈ 1 MB, sekali per sync di cron — bukan per kunjungan halaman).
 *
 * `maxWrites` membatasi berapa baris boleh ditulis dalam satu panggilan. Pengisian
 * pertama berarti 27.513 baris = ±111 detik, sedangkan fungsi serverless dipotong jauh
 * sebelum itu. Dengan batas ini cron menulis sebagian tiap tick dan cermin menyusul
 * sendiri, alih-alih gagal berulang tanpa pernah maju.
 */
async function upsertChanged(
    supabase: SupabaseClient,
    records: RowRecord[],
    maxWrites?: number,
    hanyaEkor = false,
): Promise<{ ditulis: number; tersisa: number }> {
    const lama = hanyaEkor ? await hashEkor(supabase, records) : await hashSeluruhnya(supabase);

    const berubah = records.filter(r => lama.get(`${r.kind}:${r.row_index}`) !== r.content_hash);
    const ditulis = maxWrites === undefined ? berubah : berubah.slice(0, maxWrites);
    for (let i = 0; i < ditulis.length; i += CHUNK) {
        const { error } = await supabase
            .from('critical_sheet_rows')
            .upsert(ditulis.slice(i, i + CHUNK).map(r => ({ ...r, synced_at: new Date().toISOString() })), {
                onConflict: 'kind,row_index',
            });
        if (error) throw error;
    }
    return { ditulis: ditulis.length, tersisa: berubah.length - ditulis.length };
}

/** Hash SELURUH cermin — hanya masuk akal untuk syncFull, yang memang membandingkan semua
 *  baris. 27 rb baris = 28 permintaan berurutan; jangan dipakai di jalur yang sering. */
async function hashSeluruhnya(supabase: SupabaseClient): Promise<Map<string, string>> {
    const lama = new Map<string, string>();
    // Supabase membatasi jumlah baris per response (default 1000), jadi diambil bertahap.
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
            .from('critical_sheet_rows')
            .select('kind, row_index, content_hash')
            .range(from, from + 999);
        if (error) throw error;
        const batch = data ?? [];
        for (const r of batch) lama.set(`${r.kind}:${r.row_index}`, r.content_hash as string);
        if (batch.length < 1000) break;
    }
    return lama;
}

/**
 * Hash untuk baris yang BENAR-BENAR dibandingkan saja. syncTail hanya membaca ekor sheet,
 * jadi menarik hash 27 rb baris untuk membandingkan ~800 adalah 28 perjalanan ke database
 * yang seluruhnya sia-sia — dan itu ongkos yang ditanggung tiap kali operator membuka menu
 * di spreadsheet.
 *
 * Nomor barisnya disebut satu per satu, BUKAN sebagai rentang `row_index >= terkecil`:
 * pembacaan ekor selalu ikut membawa blok header (30 baris pertama), jadi batas bawahnya
 * jatuh di baris ~6 dan rentangnya mencakup seluruh tabel — lalu dipotong diam-diam oleh
 * batas 1000 baris per respons, sehingga ekornya tidak pernah ketemu dan SELURUH ekor
 * ditulis ulang tiap sync.
 */
async function hashEkor(supabase: SupabaseClient, records: RowRecord[]): Promise<Map<string, string>> {
    const lama = new Map<string, string>();
    for (const kind of ['critical', 'maintenance'] as const) {
        const barisan = records.filter(r => r.kind === kind).map(r => r.row_index);
        for (let i = 0; i < barisan.length; i += HASH_CHUNK) {
            const { data, error } = await supabase
                .from('critical_sheet_rows')
                .select('row_index, content_hash')
                .eq('kind', kind)
                .in('row_index', barisan.slice(i, i + HASH_CHUNK));
            if (error) throw error;
            for (const r of data ?? []) lama.set(`${kind}:${r.row_index}`, r.content_hash as string);
        }
    }
    return lama;
}

async function tulisMeta(supabase: SupabaseClient, patch: Record<string, unknown>): Promise<void> {
    const { error } = await supabase
        .from('critical_sheet_sync')
        .upsert({ id: 1, ...patch }, { onConflict: 'id' });
    if (error) throw error;
}

export interface SyncResult {
    mode: 'full' | 'tail';
    dibaca: number;
    ditulis: number;
    dihapus: number;
    /** >0 = pengisian belum tuntas, sisanya menyusul di panggilan berikutnya. */
    tersisa: number;
    ms: number;
}

/**
 * Bangun ulang cermin dari SELURUH isi sheet. Mahal (±5 detik) — cron dan tombol
 * "Perbarui data" saja. Sekaligus satu-satunya yang bisa mengetahui baris yang DIHAPUS
 * operator, karena hanya di sini seluruh daftar baris terlihat.
 */
export async function syncFull(maxWrites?: number): Promise<SyncResult> {
    const t0 = Date.now();
    const supabase = createAdmin();
    try {
        const data = await loadCriticalSheetFull();
        const records = toRecords(data);
        const { ditulis, tersisa } = await upsertChanged(supabase, records, maxWrites);

        // Belum selesai (pengisian bertahap): jangan menghapus apa pun dan jangan menandai
        // full_synced_at, supaya tick berikutnya melanjutkan alih-alih menganggap beres.
        if (tersisa > 0) {
            console.warn(`[critical-sheet-sync] full: ${ditulis} ditulis, ${tersisa} menyusul tick berikutnya`);
            await tulisMeta(supabase, {
                tail_synced_at: new Date().toISOString(),
                tabs: { tabs: data.tabs, argSeparator: data.argSeparator },
                last_error: null,
            });
            return { mode: 'full', dibaca: records.length, ditulis, dihapus: 0, tersisa, ms: Date.now() - t0 };
        }

        // Baris yang hilang dari sheet harus hilang dari cermin, kalau tidak record hantu
        // akan terus muncul di daftar selamanya.
        const ada = new Set(records.map(r => `${r.kind}:${r.row_index}`));
        let dihapus = 0;
        for (const kind of ['critical', 'maintenance'] as const) {
            const maks = Math.max(0, ...records.filter(r => r.kind === kind).map(r => r.row_index));
            const { data: adaDb, error } = await supabase
                .from('critical_sheet_rows').select('row_index').eq('kind', kind);
            if (error) throw error;
            const basi = (adaDb ?? [])
                .map(r => r.row_index as number)
                .filter(idx => !ada.has(`${kind}:${idx}`) || idx > maks);
            for (let i = 0; i < basi.length; i += CHUNK) {
                const { error: delErr } = await supabase
                    .from('critical_sheet_rows').delete()
                    .eq('kind', kind).in('row_index', basi.slice(i, i + CHUNK));
                if (delErr) throw delErr;
            }
            dihapus += basi.length;
        }

        await tulisMeta(supabase, {
            full_synced_at: new Date().toISOString(),
            tail_synced_at: new Date().toISOString(),
            rows_critical: data.criticals.length,
            rows_maintenance: data.maintenances.length,
            tabs: { tabs: data.tabs, argSeparator: data.argSeparator },
            last_error: null,
        });

        return { mode: 'full', dibaca: records.length, ditulis, dihapus, tersisa: 0, ms: Date.now() - t0 };
    } catch (err) {
        await catatError(supabase, 'full', err);
        throw err;
    }
}

/**
 * Perbarui ujung sheet saja — termasuk kolom Dokumentasi sepanjang ekor itu. Inilah yang
 * dijalankan sering: baris baru yang diketik operator muncul di daftar.
 *
 * TIDAK melihat perubahan isi baris lama dan tidak bisa mendeteksi baris terhapus — itu
 * bagian syncFull. Uid baris di luar ekor juga bukan urusannya: writePhotoCell sudah
 * mencerminkannya seketika saat foto diunggah.
 */
export async function syncTail(tailRows: number = TAIL_ROWS): Promise<SyncResult> {
    const t0 = Date.now();
    const supabase = createAdmin();
    try {
        const { data: meta, error: metaErr } = await supabase
            .from('critical_sheet_sync')
            .select('rows_critical, rows_maintenance, tabs')
            .eq('id', 1)
            .maybeSingle();
        if (metaErr) throw metaErr;
        // Belum pernah sync penuh → tidak ada titik mulai yang bisa dipercaya.
        if (!meta?.tabs) return syncFull();

        const batasC = await maxRowIndex(supabase, 'critical');
        const batasM = await maxRowIndex(supabase, 'maintenance');
        const mulaiC = Math.max(1, batasC - tailRows);
        const mulaiM = Math.max(1, batasM - tailRows);

        // Judul tab diambil dari cermin supaya `spreadsheets.get` tidak perlu dipanggil.
        // Kalau tabnya ternyata sudah di-rename, batchGet-nya gagal — ulangi sekali dengan
        // metadata segar, jadi sheet yang berubah tetap pulih sendiri alih-alih macet.
        const tersimpan = meta.tabs as TabsSnapshot;
        let data: CriticalSheetData;
        try {
            data = await loadCriticalSheetTailFrom(mulaiC, mulaiM, tersimpan);
        } catch (err) {
            console.warn(
                '[critical-sheet-sync] ekor gagal dengan metadata tersimpan, baca ulang metadata:',
                err instanceof Error ? err.message : err,
            );
            data = await loadCriticalSheetTailFrom(mulaiC, mulaiM);
        }

        const records = toRecords(data);
        const hasil = await upsertChanged(supabase, records, undefined, true);
        const ditulis = hasil.ditulis + await syncUidsSaja(supabase, data, records);

        await tulisMeta(supabase, {
            tail_synced_at: new Date().toISOString(),
            tabs: { tabs: data.tabs, argSeparator: data.argSeparator },
            last_error: null,
        });

        return { mode: 'tail', dibaca: records.length, ditulis, dihapus: 0, tersisa: 0, ms: Date.now() - t0 };
    } catch (err) {
        await catatError(supabase, 'tail', err);
        throw err;
    }
}

/**
 * Samakan kolom `uid` untuk baris yang petanya ikut terbaca tapi isinya tidak ditulis ulang.
 * Sejak kolom Dokumentasi hanya dibaca sepanjang ekor, cakupannya tinggal baris ekor yang
 * lolos saringan parser — pada syncFull ia tetap mencakup seluruh sheet.
 */
async function syncUidsSaja(
    supabase: SupabaseClient,
    data: CriticalSheetData,
    sudahDitulis: RowRecord[],
): Promise<number> {
    const dilewati = new Set(sudahDitulis.map(r => `${r.kind}:${r.row_index}`));
    let n = 0;
    for (const kind of ['critical', 'maintenance'] as const) {
        const peta = kind === 'critical' ? data.uidMaps.critical : data.uidMaps.maintenance;
        const perlu = [...peta].filter(([rowIndex]) => !dilewati.has(`${kind}:${rowIndex}`));
        if (perlu.length === 0) continue;

        // Dulu di sini ada satu UPDATE per baris berfoto — `neq('uid', …)` membuatnya jadi
        // no-op di server, tapi perjalanannya tetap dibayar. Padahal uid sebuah baris nyaris
        // tidak pernah berubah: sekali dibaca, biasanya tidak ada yang perlu ditulis sama
        // sekali. Jadi bacanya diborong dulu, menulisnya hanya yang benar-benar beda.
        const sekarang = new Map<number, string>();
        for (let i = 0; i < perlu.length; i += CHUNK) {
            const { data: adaDb, error } = await supabase
                .from('critical_sheet_rows')
                .select('row_index, uid')
                .eq('kind', kind)
                .in('row_index', perlu.slice(i, i + CHUNK).map(([rowIndex]) => rowIndex));
            if (error) throw error;
            for (const r of adaDb ?? []) sekarang.set(r.row_index as number, r.uid as string);
        }

        for (const [rowIndex, uid] of perlu) {
            // Baris yang belum ada di cermin dilewati: UPDATE-nya tidak akan kena apa pun,
            // dan isinya akan datang lengkap lewat sync berikutnya.
            if (!sekarang.has(rowIndex) || sekarang.get(rowIndex) === uid) continue;
            const { error } = await supabase
                .from('critical_sheet_rows')
                .update({ uid })
                .eq('kind', kind).eq('row_index', rowIndex);
            if (error) throw error;
            n++;
        }
    }
    return n;
}

/**
 * Cari baris tujuan upload; kalau belum tercermin, PERBAIKI SATU BARIS ITU SAJA.
 *
 * Kebiasaan operator: foto hampir selalu untuk record yang ia ketik di shift yang sama, jadi
 * barisnya baru — belum tersentuh sync mana pun. Dulu keadaan itu berarti menunggu syncTail
 * seluruhnya selesai (3 panggilan Sheets berurutan) hanya untuk menemukan satu baris; di sini
 * cukup satu panggilan yang langsung menuju nomor barisnya.
 *
 * Penjaganya sidik jari: baris hasil pembacaan HARUS cocok dengan `sig` yang dibawa tautan.
 * Tidak cocok = tautannya basi (barisnya bergeser atau isinya diubah), dan tidak ada apa pun
 * yang ditulis. Sidik jari kembar tetap dikembalikan sebagai `ambigu`, tidak pernah ditebak.
 *
 * Pembacaan ke spreadsheet di sini SENGAJA dipertahankan meski pop up sudah mendapat isinya
 * dari URL: di sinilah foto menempel permanen, jadi di sini pula isinya diverifikasi ulang ke
 * sumber kebenaran. Isi dari URL cukup untuk MENAMPILKAN, tidak cukup untuk MENGIKAT.
 *
 * Yang ditulis hanya baris INTI (lihat recordInti) — kolom selebihnya menyusul lewat tombol
 * "Perbarui data" atau cron.
 */
export async function resolveRowOrRepair(
    kind: 'critical' | 'maintenance',
    rowIndex: number,
    sig: string,
    uid?: string,
): Promise<Awaited<ReturnType<typeof resolveRowForUpload>>> {
    const awal = await resolveRowForUpload(kind, rowIndex, sig);
    if (awal) return awal;

    const meta = await queryTabsMeta();
    if (!meta) return null;
    const tab = kind === 'critical' ? meta.tabs.critical : meta.tabs.maintenance;

    let baris: Awaited<ReturnType<typeof loadSingleSheetRow>>;
    try {
        baris = await loadSingleSheetRow(kind, tab.title, rowIndex);
    } catch (err) {
        console.warn(
            `[critical-sheet-sync] gagal membaca ${tab.title}!${rowIndex}:`,
            err instanceof Error ? err.message : err,
        );
        return null;
    }
    if (!baris) return null;
    if (rowFingerprint(baris.item, baris.varian, baris.uraian, baris.tanggalRaw) !== sig) return null;

    // uid tidak ikut dibaca dari sel Dokumentasi (perlu render FORMULA, satu panggilan lagi);
    // deep-link dari spreadsheet sudah membawanya lewat `&foto=`.
    baris.uid = (uid ?? '').trim();
    const rec = recordInti(kind, baris);
    const { error } = await createAdmin()
        .from('critical_sheet_rows')
        .upsert({ ...rec, synced_at: new Date().toISOString() }, { onConflict: 'kind,row_index' });
    if (error) throw error;

    return resolveRowForUpload(kind, rowIndex, sig);
}

async function maxRowIndex(supabase: SupabaseClient, kind: 'critical' | 'maintenance'): Promise<number> {
    const { data } = await supabase
        .from('critical_sheet_rows')
        .select('row_index')
        .eq('kind', kind)
        .order('row_index', { ascending: false })
        .limit(1)
        .maybeSingle();
    return (data?.row_index as number | undefined) ?? 1;
}

async function catatError(supabase: SupabaseClient, mode: string, err: unknown): Promise<void> {
    const pesan = err instanceof Error ? err.message : String(err);
    console.error(`[critical-sheet-sync] ${mode} GAGAL:`, pesan);
    // Dicatat supaya kegagalan diam-diam tetap terlihat; kegagalan menulis catatan ini
    // sendiri diabaikan — jangan sampai menutupi error aslinya.
    try {
        await supabase.from('critical_sheet_sync')
            .upsert({ id: 1, last_error: `${new Date().toISOString()} ${mode}: ${pesan}` }, { onConflict: 'id' });
    } catch { /* abaikan */ }
}

/**
 * Jalankan syncFull hanya bila cermin sudah lebih tua dari `maxUmurMs`. Dipakai cron,
 * jadi jumlah tulisannya dibatasi agar tidak pernah menembus batas waktu fungsi
 * serverless — sisanya dikerjakan tick berikutnya.
 */
const CRON_MAX_WRITES = 2_000;

export async function syncFullIfStale(maxUmurMs: number): Promise<SyncResult | null> {
    const supabase = createAdmin();
    const { data } = await supabase
        .from('critical_sheet_sync').select('full_synced_at').eq('id', 1).maybeSingle();
    const terakhir = data?.full_synced_at ? Date.parse(data.full_synced_at as string) : 0;
    if (Date.now() - terakhir < maxUmurMs) return null;
    return syncFull(CRON_MAX_WRITES);
}
