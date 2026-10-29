/**
 * Susun nilai field dashboard dari baris `apm_readings`. Murni (tanpa I/O) — dipakai
 * route /api/dashboard/apm, dan tipenya dipakai halaman /dashboard.
 */

import { APM_FIELDS } from './tags';

export interface ApmFieldValue {
    /** Nilai slot terakhir yang terisi (rata-rata bila field punya beberapa tag). */
    value: number | null;
    /** Nilai slot terisi sebelumnya — untuk tren. */
    prev: number | null;
    /** ISO slot logsheet milik `value`. */
    readingAt: string | null;
}

export interface ApmDashboardData {
    fields: Record<string, ApmFieldValue>;
    /** Slot logsheet terbaru yang punya isian, dari field mana pun. */
    lastSlot: string | null;
    syncedAt: string | null;
    attemptedAt: string | null;
    lastError: string | null;
}

export interface ApmReadingLite {
    unit_id: number;
    tag: string;
    reading_at: string;
    value: number | string | null;
}

const KOSONG: ApmFieldValue = { value: null, prev: null, readingAt: null };

/**
 * Nilai sebuah field hanya dipakai bila tertinggal paling banyak satu slot (2 jam) dari
 * slot terbaru UNIT-nya. Sel yang dikosongkan operator (mis. feeder yang berhenti sejak
 * subuh) tidak boleh terus tampil sebagai nilai lama yang "masih jalan"; sebaliknya slot
 * terbaru yang baru separuh terisi masih jatuh ke slot sebelumnya.
 */
const MAX_TERTINGGAL_MS = 2 * 60 * 60_000;

export function buildFieldValues(rows: ApmReadingLite[]): Pick<ApmDashboardData, 'fields' | 'lastSlot'> {
    // (unit, tag) → (epoch slot → nilai)
    const seri = new Map<string, Map<number, number>>();
    const slotTerbaruUnit = new Map<number, number>();
    let lastSlot: number | null = null;
    for (const r of rows) {
        const v = r.value === null ? null : Number(r.value);
        if (v === null || !Number.isFinite(v)) continue;
        const t = Date.parse(r.reading_at);
        if (Number.isNaN(t)) continue;
        const key = `${r.unit_id}:${r.tag}`;
        const m = seri.get(key) ?? new Map<number, number>();
        m.set(t, v);
        seri.set(key, m);
        slotTerbaruUnit.set(r.unit_id, Math.max(slotTerbaruUnit.get(r.unit_id) ?? t, t));
        if (lastSlot === null || t > lastSlot) lastSlot = t;
    }

    const fields: Record<string, ApmFieldValue> = {};
    for (const [name, field] of Object.entries(APM_FIELDS)) {
        const perSlot = new Map<number, number[]>();
        for (const tag of field.tags) {
            for (const [t, v] of seri.get(`${field.unitId}:${tag}`) ?? []) {
                perSlot.set(t, [...(perSlot.get(t) ?? []), v]);
            }
        }
        const slots = [...perSlot.keys()].sort((a, b) => b - a);
        const terbaruUnit = slotTerbaruUnit.get(field.unitId);
        if (slots.length === 0 || terbaruUnit === undefined || terbaruUnit - slots[0] > MAX_TERTINGGAL_MS) {
            fields[name] = KOSONG;
            continue;
        }
        const rata = (t: number) => {
            const vs = perSlot.get(t)!;
            return vs.reduce((s, v) => s + v, 0) / vs.length;
        };
        fields[name] = {
            value: rata(slots[0]),
            prev: slots.length > 1 ? rata(slots[1]) : null,
            readingAt: new Date(slots[0]).toISOString(),
        };
    }

    return { fields, lastSlot: lastSlot === null ? null : new Date(lastSlot).toISOString() };
}
