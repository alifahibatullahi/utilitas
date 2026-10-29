/**
 * Data E-Logsheet APM untuk /dashboard.
 *
 * GET  — nilai slot terakhir (+ slot sebelumnya untuk tren) tiap field di lib/apm/tags.ts,
 *        dibaca dari cermin `apm_readings`. Tidak pernah menyentuh APM.
 * POST — tombol Refresh: sync dari APM kalau percobaan terakhir > 5 menit lalu. Rem ini
 *        disimpan di apm_sync_state, jadi berlaku untuk semua instance dan juga mencegah
 *        klik beruntun memicu login berulang ke akun operator.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/whatsapp';
import { buildFieldValues, type ApmDashboardData, type ApmReadingLite } from '@/lib/apm/dashboard';
import { syncApmIfStale } from '@/lib/apm/sync';

/** Login + 3 unit dibatasi 20 detik di lib/apm/sync.ts; beri ruang di atas batas default. */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Cukup untuk slot terakhir + sebelumnya walau logsheet telat diisi beberapa jam. */
const WINDOW_MS = 26 * 60 * 60_000;
const REFRESH_MIN_INTERVAL_MS = 5 * 60_000;

export async function GET() {
    const supabase = createAdminClient();
    const since = new Date(Date.now() - WINDOW_MS).toISOString();

    const [readings, state] = await Promise.all([
        supabase
            .from('apm_readings')
            .select('unit_id, tag, reading_at, value')
            .gte('reading_at', since)
            .order('reading_at', { ascending: false }),
        supabase
            .from('apm_sync_state')
            .select('attempted_at, synced_at, last_error')
            .eq('id', 1)
            .maybeSingle(),
    ]);
    if (readings.error) return NextResponse.json({ error: readings.error.message }, { status: 500 });
    if (state.error) return NextResponse.json({ error: state.error.message }, { status: 500 });

    const body: ApmDashboardData = {
        ...buildFieldValues((readings.data ?? []) as ApmReadingLite[]),
        syncedAt: state.data?.synced_at ?? null,
        attemptedAt: state.data?.attempted_at ?? null,
        lastError: state.data?.last_error ?? null,
    };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST() {
    const outcome = await syncApmIfStale(REFRESH_MIN_INTERVAL_MS);
    if (outcome && 'error' in outcome) return NextResponse.json({ ok: false, ...outcome }, { status: 502 });
    return NextResponse.json({ ok: true, outcome: outcome ?? { skipped: 'baru saja disegarkan' } });
}
