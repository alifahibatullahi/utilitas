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
    normSearch,
    recordItemKeys,
    rowFingerprint,
    type CriticalRow,
    type CriticalSheetData,
    type MaintenanceRow,
} from './critical-sheet';
import { createAdmin } from './critical-sheet-db';

/** Berapa baris terakhir yang ikut dibaca ulang saat syncTail. */
const TAIL_ROWS = 400;

/** Sekali tulis maksimal sekian baris — menjaga payload request Supabase tetap wajar. */
const CHUNK = 500;

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
): Promise<{ ditulis: number; tersisa: number }> {
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
 * Perbarui ujung sheet saja + seluruh kolom Dokumentasi. Inilah yang dijalankan sering:
 * baris baru yang diketik operator muncul, dan foto yang baru ditempel ke record LAMA
 * pun ikut terlihat (peta uid mencakup seluruh sheet, bukan hanya ekor).
 *
 * TIDAK melihat perubahan isi baris lama dan tidak bisa mendeteksi baris terhapus —
 * itu bagian syncFull.
 */
export async function syncTail(): Promise<SyncResult> {
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
        const data = await loadCriticalSheetTailFrom(
            Math.max(1, batasC - TAIL_ROWS),
            Math.max(1, batasM - TAIL_ROWS),
        );

        const records = toRecords(data);
        const hasil = await upsertChanged(supabase, records);
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
 * Samakan kolom `uid` untuk baris DI LUAR ekor. Kolom Dokumentasi dibaca penuh, jadi foto
 * yang ditempel ke record lama diketahui di sini tanpa perlu ikut membaca isi barisnya.
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
        for (const [rowIndex, uid] of peta) {
            if (dilewati.has(`${kind}:${rowIndex}`)) continue;
            const { error } = await supabase
                .from('critical_sheet_rows')
                .update({ uid })
                .eq('kind', kind).eq('row_index', rowIndex).neq('uid', uid);
            if (error) throw error;
            n++;
        }
    }
    return n;
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
