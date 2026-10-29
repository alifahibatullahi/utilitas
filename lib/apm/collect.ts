/**
 * Ambil data E-Logsheet APM (tag di lib/apm/tags.ts) dan ubah jadi baris `apm_readings`.
 *
 * Tidak menyentuh database. APM hanya bisa dibuka dari IP Indonesia — fungsi Vercel (hnd1,
 * Tokyo) dibalas 403 — jadi pengambilan dijalankan agen di PC kantor (scripts/apm-agent)
 * dan hasilnya dikirim ke /api/apm/ingest. Cookie sesi dan sidik jari kredensial yang
 * ditolak disimpan agen sendiri.
 */

import { createHash } from 'crypto';
import {
    ApmClient,
    ApmLoginRejected,
    ApmSessionExpired,
    parseApmNumber,
    type ApmParameter,
    type ApmUnitDay,
} from './client';
import { apmTagsByUnit } from './tags';

/** Slot 22:00 sering baru diisi lewat tengah malam — sampai jam ini kemarin ikut diambil. */
const AMBIL_KEMARIN_SAMPAI_JAM = 3;

/** Satu baris `apm_readings`; `fetched_at` diisi server saat menerima. */
export interface ApmReadingRow {
    unit_id: number;
    tag: string;
    /** Tanggal + slot logsheet, selalu `YYYY-MM-DDTHH:MM:00+07:00`. */
    reading_at: string;
    value: number | null;
    value_text: string | null;
    recorded_at: string | null;
}

export type ApmCollectOutcome =
    | {
          ok: true;
          rows: ApmReadingRow[];
          dates: string[];
          /** true = sesi tersimpan habis dan pengambilan ini login ulang. */
          login: boolean;
          ms: number;
          warnings: string[];
          cookies: string;
      }
    | {
          ok: false;
          error: string;
          /** Keycloak menolak kredensial — jangan dicoba lagi sampai password diganti. */
          loginRejected: boolean;
          cookies: string;
      };

export function sidikJariKredensial(username: string, password: string): string {
    return createHash('sha256').update(`${username}\0${password}`).digest('hex');
}

/** Tanggal kalender WIB (YYYY-MM-DD) yang perlu diambil pada saat `now`. */
export function tanggalYangDiambil(now: Date = new Date()): string[] {
    const wib = new Date(now.getTime() + 7 * 3_600_000);
    const tgl = (d: Date) => d.toISOString().slice(0, 10);
    const hariIni = tgl(wib);
    if (wib.getUTCHours() >= AMBIL_KEMARIN_SAMPAI_JAM) return [hariIni];
    return [tgl(new Date(wib.getTime() - 86_400_000)), hariIni];
}

/**
 * Login (kalau sesi habis) lalu baca semua unit untuk tanggal yang perlu. Tidak pernah
 * melempar: kegagalan dikembalikan sebagai `{ ok: false }`, selalu beserta cookie terbaru.
 */
export async function collectApm(opts: {
    username: string;
    password: string;
    cookies: string | null;
    budgetMs: number;
    now?: Date;
}): Promise<ApmCollectOutcome> {
    const t0 = Date.now();
    const client = new ApmClient({ cookies: opts.cookies, budgetMs: opts.budgetMs });
    const dates = tanggalYangDiambil(opts.now);
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
            await client.login(opts.username, opts.password);
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

        const { rows, warnings } = keBaris([pertama, ...sisa], tagsByUnit);
        return { ok: true, rows, dates, login, ms: Date.now() - t0, warnings, cookies: client.jar.serialize() };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            loginRejected: err instanceof ApmLoginRejected,
            cookies: client.jar.serialize(),
        };
    }
}

export function keBaris(days: ApmUnitDay[], tagsByUnit: Map<number, Set<string>>) {
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
            });
        }
    }

    return { rows, warnings: [...warnings] };
}
