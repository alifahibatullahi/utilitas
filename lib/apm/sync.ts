/**
 * Salin data E-Logsheet APM (tag di lib/apm/tags.ts) ke `apm_readings`.
 *
 * Dipanggil dari cron notify-shift (tiap tick ±15 menit, dijaga "basi ≥ 1 jam") dan dari
 * tombol Refresh dashboard. Login memakai akun operator di env APM_USERNAME/APM_PASSWORD;
 * cookie sesinya disimpan di `apm_sync_state` supaya login hanya terjadi saat sesi habis.
 *
 * Pengaman akun: kredensial yang pernah DITOLAK Keycloak dicatat sidik jarinya dan tidak
 * dicoba lagi sampai env diganti. Tanpa ini setiap tick cron akan mengulang login gagal
 * dan Keycloak mengunci akun pribadi operator.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, nowWIB, shiftYesterdayWIB } from '../whatsapp';
import {
    ApmClient,
    ApmLoginRejected,
    ApmSessionExpired,
    parseApmNumber,
    type ApmParameter,
    type ApmUnitDay,
} from './client';
import { apmTagsByUnit } from './tags';

/**
 * Anggaran waktu total satu sync (login + semua unit). Cron notify-shift punya batas 60
 * detik dan reminder WA lebih penting, jadi APM yang lambat dipotong di sini.
 */
const SYNC_BUDGET_MS = 20_000;
const CHUNK = 500;

/** Slot 22:00 sering baru diisi lewat tengah malam — sampai jam ini kemarin ikut diambil. */
const AMBIL_KEMARIN_SAMPAI_JAM = 3;

interface SyncState {
    cookies: string | null;
    attempted_at: string | null;
    synced_at: string | null;
    last_error: string | null;
    failed_cred_fp: string | null;
}

export interface ApmSyncResult {
    units: number;
    dates: string[];
    rows: number;
    /** true = sesi tersimpan habis dan sync ini login ulang. */
    login: boolean;
    ms: number;
    warnings?: string[];
}

export type ApmSyncOutcome = ApmSyncResult | { skipped: string } | { error: string };

async function bacaState(supabase: SupabaseClient): Promise<SyncState | null> {
    const { data, error } = await supabase.from('apm_sync_state').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data as SyncState | null;
}

async function tulisState(supabase: SupabaseClient, patch: Partial<SyncState>): Promise<void> {
    const { error } = await supabase.from('apm_sync_state').upsert({ id: 1, ...patch }, { onConflict: 'id' });
    if (error) throw error;
}

function sidikJari(username: string, password: string): string {
    return createHash('sha256').update(`${username}\0${password}`).digest('hex');
}

/**
 * Jalankan sync kalau percobaan terakhir (berhasil ATAU gagal) lebih tua dari maxAgeMs.
 * null = masih segar, tidak ada yang dikerjakan. Tidak pernah melempar: kegagalan dicatat
 * di `apm_sync_state.last_error` dan dikembalikan sebagai `{ error }`.
 */
export async function syncApmIfStale(maxAgeMs: number): Promise<ApmSyncOutcome | null> {
    const supabase = createAdminClient();
    let state: SyncState | null;
    try {
        state = await bacaState(supabase);
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
    if (state?.attempted_at && Date.now() - Date.parse(state.attempted_at) < maxAgeMs) return null;
    return syncApm(supabase, state);
}

async function syncApm(supabase: SupabaseClient, state: SyncState | null): Promise<ApmSyncOutcome> {
    const t0 = Date.now();
    const sekarang = new Date().toISOString();

    const username = process.env.APM_USERNAME;
    const password = process.env.APM_PASSWORD;
    if (!username || !password) {
        const msg = 'APM_USERNAME / APM_PASSWORD belum diisi di env';
        await tulisState(supabase, { attempted_at: sekarang, last_error: msg }).catch(() => {});
        return { error: msg };
    }
    const fp = sidikJari(username, password);
    if (state?.failed_cred_fp === fp) {
        return { skipped: 'Kredensial APM pernah ditolak — perbarui APM_PASSWORD di env Vercel' };
    }

    const client = new ApmClient({ cookies: state?.cookies, budgetMs: SYNC_BUDGET_MS });
    const { hour, date: hariIni } = nowWIB();
    const dates = hour < AMBIL_KEMARIN_SAMPAI_JAM ? [shiftYesterdayWIB(), hariIni] : [hariIni];
    const tagsByUnit = apmTagsByUnit();
    const jobs = [...tagsByUnit.keys()].flatMap(unitId => dates.map(date => ({ unitId, date })));

    let login = false;
    try {
        // Request pertama sekaligus menguji sesi tersimpan; sisanya paralel setelah sesi pasti.
        let pertama: ApmUnitDay;
        try {
            pertama = await client.fetchUnitDay(jobs[0].unitId, jobs[0].date);
        } catch (e) {
            if (!(e instanceof ApmSessionExpired)) throw e;
            await client.login(username, password);
            login = true;
            try {
                pertama = await client.fetchUnitDay(jobs[0].unitId, jobs[0].date);
            } catch (e2) {
                if (e2 instanceof ApmSessionExpired) {
                    throw new Error('Login APM berhasil, tetapi APM masih mengalihkan ke halaman masuk');
                }
                throw e2;
            }
        }
        const sisa = await Promise.all(jobs.slice(1).map(j => client.fetchUnitDay(j.unitId, j.date)));

        const { rows, warnings } = keBaris([pertama, ...sisa], tagsByUnit, sekarang);
        for (let i = 0; i < rows.length; i += CHUNK) {
            const { error } = await supabase
                .from('apm_readings')
                .upsert(rows.slice(i, i + CHUNK), { onConflict: 'unit_id,tag,reading_at' });
            if (error) throw error;
        }

        await tulisState(supabase, {
            cookies: client.jar.serialize(),
            attempted_at: sekarang,
            synced_at: new Date().toISOString(),
            last_error: null,
            ...(login ? { failed_cred_fp: null } : {}),
        });

        if (warnings.length) console.warn('[apm-sync]', warnings.join('; '));
        return {
            units: tagsByUnit.size,
            dates,
            rows: rows.length,
            login,
            ms: Date.now() - t0,
            ...(warnings.length ? { warnings } : {}),
        };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[apm-sync]', msg);
        await tulisState(supabase, {
            cookies: client.jar.serialize(),
            attempted_at: sekarang,
            last_error: msg,
            ...(err instanceof ApmLoginRejected ? { failed_cred_fp: fp } : {}),
        }).catch(e => console.error('[apm-sync] gagal mencatat state', e));
        return { error: msg };
    }
}

interface ApmReadingRow {
    unit_id: number;
    tag: string;
    reading_at: string;
    value: number | null;
    value_text: string | null;
    recorded_at: string | null;
    fetched_at: string;
}

function keBaris(days: ApmUnitDay[], tagsByUnit: Map<number, Set<string>>, fetchedAt: string) {
    const rows: ApmReadingRow[] = [];
    const warnings = new Set<string>();

    for (const day of days) {
        const wanted = tagsByUnit.get(day.unitId) ?? new Set<string>();
        const byTag = new Map<string, ApmParameter[]>();
        for (const p of day.params) {
            if (wanted.has(p.tag)) byTag.set(p.tag, [...(byTag.get(p.tag) ?? []), p]);
        }

        const idKeTag = new Map<number, string>();
        for (const tag of wanted) {
            const cocok = byTag.get(tag) ?? [];
            if (cocok.length === 1) idKeTag.set(cocok[0].id, tag);
            else warnings.add(`unit ${day.unitId} tag ${tag}: ${cocok.length === 0 ? 'tidak ada di APM' : `ganda (${cocok.length}×), dilewati`}`);
        }

        for (const r of day.readings) {
            const tag = idKeTag.get(r.paramId);
            if (!tag) continue;
            const value = parseApmNumber(r.raw);
            rows.push({
                unit_id: day.unitId,
                tag,
                reading_at: `${day.date}T${r.slot}:00+07:00`,
                value,
                value_text: value === null ? r.raw : null,
                recorded_at: r.recordedAt,
                fetched_at: fetchedAt,
            });
        }
    }

    return { rows, warnings: [...warnings] };
}
