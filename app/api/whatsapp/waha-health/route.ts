import { NextResponse } from 'next/server';
import { wahaSessionStatus } from '@/lib/whatsapp';

// Health-check session WAHA. Cek nomor 'notif' & 'publish' sekaligus.
// healthy=true hanya kalau SEMUA session berstatus WORKING (siap kirim).
// Pakai untuk monitoring/uptime (mis. ping berkala) → tahu kapan perlu re-scan QR.
export async function GET() {
    const [notif, publish] = await Promise.all([
        wahaSessionStatus('notif'),
        wahaSessionStatus('publish'),
    ]);
    const healthy = notif.ok && publish.ok;
    return NextResponse.json(
        { healthy, sessions: { notif, publish } },
        { status: healthy ? 200 : 503 },
    );
}
