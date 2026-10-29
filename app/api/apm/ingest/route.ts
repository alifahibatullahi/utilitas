/**
 * Pintu masuk data E-Logsheet APM dari agen di PC kantor (scripts/apm-agent).
 *
 * APM memblokir IP luar Indonesia — fungsi Vercel (hnd1) dibalas 403 — jadi server ini
 * tidak mengambil sendiri. Agen login ke APM dari jaringan kantor, lalu POST ke sini
 * dengan `Authorization: Bearer <APM_INGEST_SECRET>`. Secret ini sengaja terpisah dari
 * CRON_SECRET dan kunci Supabase: yang tersimpan di PC kantor hanya bisa mengisi cermin APM.
 *
 * Body: `{ rows: ApmReadingRow[], error: null }` saat berhasil, atau
 *       `{ rows: [], error: "pesan" }` saat agen gagal (tampil di banner dashboard).
 */

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/whatsapp';
import { parseIngestPayload, simpanIngest } from '@/lib/apm/ingest';

export const dynamic = 'force-dynamic';

function secretCocok(authHeader: string | null, secret: string): boolean {
    const diberikan = Buffer.from(authHeader?.replace(/^Bearer\s+/i, '') ?? '');
    const harapan = Buffer.from(secret);
    return diberikan.length === harapan.length && timingSafeEqual(diberikan, harapan);
}

export async function POST(req: NextRequest) {
    const secret = process.env.APM_INGEST_SECRET;
    if (!secret) return NextResponse.json({ error: 'APM_INGEST_SECRET belum diisi di env server' }, { status: 503 });
    if (!secretCocok(req.headers.get('authorization'), secret)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'body bukan JSON' }, { status: 400 });
    }
    const parsed = parseIngestPayload(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    try {
        const hasil = await simpanIngest(createAdminClient(), parsed.value);
        return NextResponse.json({ ok: true, ...hasil });
    } catch (e) {
        const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
        console.error('[apm-ingest]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
