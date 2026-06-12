import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteGroup,
    getWhatsappGroup,
    logNotification,
    nowWIB,
} from '@/lib/whatsapp';

// User-edited message — endpoint sends as-is. The "preview list editable" UX
// lives client-side; the server simply delivers what the user composed.
export async function POST(req: NextRequest) {
    let body: { groupKey?: string; message?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { groupKey, message } = body;
    if (!groupKey || !message) {
        return NextResponse.json({ error: 'groupKey and message required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const group = await getWhatsappGroup(supabase, groupKey);
    if (!group) return NextResponse.json({ error: `WhatsApp group "${groupKey}" not configured` }, { status: 400 });

    const send = await sendFonnteGroup(group.fonnte_target, message);
    await logNotification(supabase, {
        kind: 'maintenance_broadcast',
        target_date: nowWIB().date,
        sent_to: group.fonnte_target,
        payload: message,
        result: send,
    });

    return NextResponse.json({ ok: send.ok, status: send.status });
}
