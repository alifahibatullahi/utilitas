import { NextRequest, NextResponse } from 'next/server';

// Debug endpoint — TIDAK expose token value, hanya metadata.
// Akses: GET /api/whatsapp/debug-token            → akun notif (FONNTE_TOKEN)
//        GET /api/whatsapp/debug-token?account=publish → akun publish (FONNTE_TOKEN_PUBLISH)
export async function GET(req: NextRequest) {
    const account = req.nextUrl.searchParams.get('account') === 'publish' ? 'publish' : 'notif';
    const envName = account === 'publish' ? 'FONNTE_TOKEN_PUBLISH' : 'FONNTE_TOKEN';
    const raw = process.env[envName];
    const trimmed = raw?.trim();

    const info = {
        account,
        envName,
        present: !!raw,
        rawLength: raw?.length ?? 0,
        trimmedLength: trimmed?.length ?? 0,
        hasWhitespace: raw && raw !== trimmed,
        prefix: trimmed?.slice(0, 4) ?? null,
        suffix: trimmed?.slice(-4) ?? null,
        env: process.env.VERCEL ? 'vercel' : 'local',
        vercelEnv: process.env.VERCEL_ENV ?? null,
    };

    // Live test: hit Fonnte /validate or /device for token verification.
    // Fonnte punya endpoint /device untuk cek device info — kalau token valid, return device data.
    let liveCheck: unknown = null;
    if (trimmed) {
        try {
            const res = await fetch('https://api.fonnte.com/device', {
                method: 'POST',
                headers: { Authorization: trimmed, 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            liveCheck = { httpStatus: res.status, body: await res.json().catch(() => null) };
        } catch (err) {
            liveCheck = { error: err instanceof Error ? err.message : String(err) };
        }
    }

    return NextResponse.json({ info, liveCheck });
}
