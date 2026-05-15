import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteGroup,
    getWhatsappGroup,
    renderTemplate,
    logNotification,
} from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
    let body: { reportId?: string; groupKey?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { reportId, groupKey = 'management' } = body;
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 });

    const supabase = createAdminClient();

    const { data: report, error } = await supabase
        .from('daily_reports')
        .select('id, date, produksi_steam_a, produksi_steam_b, konsumsi_batubara, load_mw, notes')
        .eq('id', reportId)
        .single();
    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const lines: string[] = [];
    lines.push(`Produksi Steam A: ${report.produksi_steam_a ?? '-'} t`);
    lines.push(`Produksi Steam B: ${report.produksi_steam_b ?? '-'} t`);
    lines.push(`Konsumsi Batubara: ${report.konsumsi_batubara ?? '-'} t`);
    lines.push(`Load MW: ${report.load_mw ?? '-'} MW`);
    if (report.notes) lines.push('', `*Catatan*: ${report.notes}`);

    const message = await renderTemplate(supabase, 'daily_share', {
        date: report.date as string,
        summary: lines.join('\n'),
    });

    const group = await getWhatsappGroup(supabase, groupKey);
    if (!group) return NextResponse.json({ error: `WhatsApp group "${groupKey}" not configured` }, { status: 400 });

    const send = await sendFonnteGroup(group.fonnte_target, message);
    await logNotification(supabase, {
        kind: 'daily_share',
        target_date: report.date as string,
        sent_to: group.fonnte_target,
        payload: message,
    });

    return NextResponse.json({ ok: send.ok, status: send.status });
}
