import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteText,
    logNotification,
    nowWIB,
    accountForKind,
} from '@/lib/whatsapp';

// Manual resend by admin from notification log page.
// Pulls original target + payload from the log row, re-sends as-is, logs again.
export async function POST(req: NextRequest) {
    let body: { logId?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { logId } = body;
    if (!logId) return NextResponse.json({ error: 'logId required' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: row, error } = await supabase
        .from('notification_log')
        .select('kind, target_date, target_shift, target_group, sent_to, payload')
        .eq('id', logId)
        .single();
    if (error || !row) return NextResponse.json({ error: 'Log row not found' }, { status: 404 });
    if (!row.payload) return NextResponse.json({ error: 'Original payload empty' }, { status: 400 });

    // Kirim ulang lewat akun/nomor yang sama dengan pengiriman aslinya (berdasar kind).
    const send = await sendFonnteText(row.sent_to as string, row.payload as string, accountForKind(row.kind as string));
    await logNotification(supabase, {
        kind: row.kind as string,
        target_date: (row.target_date as string) ?? nowWIB().date,
        target_shift: (row.target_shift as string | null) ?? null,
        target_group: (row.target_group as string | null) ?? null,
        sent_to: row.sent_to as string,
        payload: row.payload as string,
        result: send,
    });

    return NextResponse.json({ ok: send.ok, status: send.status });
}
