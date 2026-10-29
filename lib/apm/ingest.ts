/**
 * Terima hasil agen APM (scripts/apm-agent, di PC kantor) dan tulis ke `apm_readings` +
 * `apm_sync_state`.
 *
 * Isi kiriman divalidasi ketat — hanya unit/tag yang terdaftar di lib/apm/tags.ts, slot
 * logsheet berformat WIB dalam rentang wajar, angka hingga — supaya secret yang bocor tidak
 * bisa dipakai mengisi tabel dengan sembarang data.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApmReadingRow } from './collect';
import { apmTagsByUnit } from './tags';

const MAX_ROWS = 5_000;
const MAX_TEXT = 500;
const CHUNK = 500;
const SLOT_RE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:00\+07:00$/;
/** Agen mengambil hari ini (+ kemarin lewat tengah malam); lebih dari ini pasti bukan dari agen. */
const SLOT_MUNDUR_MAKS_MS = 7 * 86_400_000;
const SLOT_MAJU_MAKS_MS = 86_400_000;

export interface ApmIngestPayload {
    rows: ApmReadingRow[];
    /** Diisi agen kalau pengambilan gagal; `rows` lalu kosong. */
    error: string | null;
}

type Hasil<T> = { ok: true; value: T } | { ok: false; error: string };

function cekBaris(r: unknown, tagsByUnit: Map<number, Set<string>>, now: number): Hasil<ApmReadingRow> {
    if (!r || typeof r !== 'object') return { ok: false, error: 'bukan objek' };
    const { unit_id, tag, reading_at, value, value_text, recorded_at } = r as Record<string, unknown>;

    if (typeof unit_id !== 'number' || !tagsByUnit.has(unit_id)) return { ok: false, error: `unit_id ${String(unit_id)} tidak terdaftar` };
    if (typeof tag !== 'string' || !tagsByUnit.get(unit_id)!.has(tag)) return { ok: false, error: `tag ${String(tag)} tidak terdaftar untuk unit ${unit_id}` };
    if (typeof reading_at !== 'string' || !SLOT_RE.test(reading_at)) return { ok: false, error: `reading_at ${String(reading_at)} bukan slot WIB` };
    const slot = Date.parse(reading_at);
    if (Number.isNaN(slot) || slot < now - SLOT_MUNDUR_MAKS_MS || slot > now + SLOT_MAJU_MAKS_MS) {
        return { ok: false, error: `reading_at ${reading_at} di luar rentang` };
    }
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) >= 1e12)) {
        return { ok: false, error: 'value harus angka hingga atau null' };
    }
    if (value_text !== null && (typeof value_text !== 'string' || value_text.length > MAX_TEXT)) {
        return { ok: false, error: 'value_text harus string pendek atau null' };
    }
    if (recorded_at !== null && (typeof recorded_at !== 'string' || recorded_at.length > 40 || Number.isNaN(Date.parse(recorded_at)))) {
        return { ok: false, error: 'recorded_at harus waktu ISO atau null' };
    }

    return { ok: true, value: { unit_id, tag, reading_at, value, value_text, recorded_at } };
}

export function parseIngestPayload(body: unknown, now = Date.now()): Hasil<ApmIngestPayload> {
    if (!body || typeof body !== 'object') return { ok: false, error: 'body bukan objek JSON' };
    const { rows, error } = body as Record<string, unknown>;

    if (error !== undefined && error !== null && typeof error !== 'string') return { ok: false, error: 'error harus string' };
    if (!Array.isArray(rows)) return { ok: false, error: 'rows harus array' };
    if (rows.length > MAX_ROWS) return { ok: false, error: `rows maksimal ${MAX_ROWS}` };
    if (error && rows.length) return { ok: false, error: 'kiriman gagal tidak boleh membawa rows' };

    const tagsByUnit = apmTagsByUnit();
    // Kunci ganda dalam satu upsert ditolak Postgres ("cannot affect row a second time").
    const unik = new Map<string, ApmReadingRow>();
    for (const [i, r] of rows.entries()) {
        const cek = cekBaris(r, tagsByUnit, now);
        if (!cek.ok) return { ok: false, error: `rows[${i}]: ${cek.error}` };
        unik.set(`${cek.value.unit_id}|${cek.value.tag}|${cek.value.reading_at}`, cek.value);
    }

    return { ok: true, value: { rows: [...unik.values()], error: error ? error.slice(0, MAX_TEXT) : null } };
}

async function tulisState(supabase: SupabaseClient, patch: Record<string, string | null>): Promise<void> {
    const { error } = await supabase.from('apm_sync_state').upsert({ id: 1, ...patch }, { onConflict: 'id' });
    if (error) throw error;
}

export async function simpanIngest(supabase: SupabaseClient, payload: ApmIngestPayload): Promise<{ rows: number }> {
    const sekarang = new Date().toISOString();
    if (payload.error) {
        await tulisState(supabase, { attempted_at: sekarang, last_error: payload.error });
        return { rows: 0 };
    }

    const rows = payload.rows.map(r => ({ ...r, fetched_at: sekarang }));
    for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase
            .from('apm_readings')
            .upsert(rows.slice(i, i + CHUNK), { onConflict: 'unit_id,tag,reading_at' });
        if (error) throw error;
    }
    await tulisState(supabase, { attempted_at: sekarang, synced_at: sekarang, last_error: null });
    return { rows: rows.length };
}
