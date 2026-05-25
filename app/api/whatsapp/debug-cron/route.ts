import { NextResponse } from 'next/server';

// Debug endpoint — cek CRON_SECRET di env tanpa expose value.
// Akses: GET /api/whatsapp/debug-cron
export async function GET() {
    const raw = process.env.CRON_SECRET;
    const trimmed = raw?.trim();

    return NextResponse.json({
        present: !!raw,
        rawLength: raw?.length ?? 0,
        trimmedLength: trimmed?.length ?? 0,
        hasWhitespace: !!raw && raw !== trimmed,
        prefix: trimmed?.slice(0, 4) ?? null,
        suffix: trimmed?.slice(-4) ?? null,
        env: process.env.VERCEL ? 'vercel' : 'local',
        vercelEnv: process.env.VERCEL_ENV ?? null,
    });
}
