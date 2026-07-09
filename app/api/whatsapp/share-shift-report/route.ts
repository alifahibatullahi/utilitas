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
        .from('shift_reports')
        .select('id, date, shift, group_name, supervisor, catatan')
        .eq('id', reportId)
        .single();
    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const summary = await buildSummary(supabase, reportId, report);
    const shiftLabel = (report.shift as string).charAt(0).toUpperCase() + (report.shift as string).slice(1);

    const message = await renderTemplate(supabase, 'shift_share', {
        shift: shiftLabel,
        group: report.group_name as string,
        date: report.date as string,
        summary,
    });

    const group = await getWhatsappGroup(supabase, groupKey);
    if (!group) return NextResponse.json({ error: `WhatsApp group "${groupKey}" not configured` }, { status: 400 });

    const send = await sendFonnteGroup(group.fonnte_target, message, 'publish');
    await logNotification(supabase, {
        kind: 'shift_share',
        target_date: report.date as string,
        target_shift: report.shift as string,
        target_group: report.group_name as string,
        sent_to: group.fonnte_target,
        payload: message,
        result: send,
    });

    return NextResponse.json({ ok: send.ok, status: send.status });
}

async function buildSummary(
    supabase: ReturnType<typeof createAdminClient>,
    reportId: string,
    report: { supervisor: string; catatan: string | null },
): Promise<string> {
    const { data: turbin } = await supabase
        .from('shift_turbin')
        .select('flow_steam, press_steam, vacuum, stream_days')
        .eq('shift_report_id', reportId)
        .maybeSingle();
    const { data: gen } = await supabase
        .from('shift_generator_gi')
        .select('gen_load, gen_tegangan, gen_frequensi, gi_sum_p')
        .eq('shift_report_id', reportId)
        .maybeSingle();
    const { data: boiler } = await supabase
        .from('shift_boiler')
        .select('boiler, press_steam, flow_steam, batubara_ton')
        .eq('shift_report_id', reportId);

    const lines: string[] = [];
    lines.push(`Supervisor: ${report.supervisor ?? '-'}`);
    if (turbin) {
        lines.push('');
        lines.push('*Turbin*');
        lines.push(`  Flow steam: ${turbin.flow_steam ?? '-'} t/h`);
        lines.push(`  Press steam: ${turbin.press_steam ?? '-'} bar`);
        lines.push(`  Vacuum: ${turbin.vacuum ?? '-'}`);
        lines.push(`  Stream days: ${turbin.stream_days ?? '-'}`);
    }
    if (gen) {
        lines.push('');
        lines.push('*Generator*');
        lines.push(`  Load: ${gen.gen_load ?? '-'} MW`);
        lines.push(`  Tegangan: ${gen.gen_tegangan ?? '-'} V`);
        lines.push(`  Frekuensi: ${gen.gen_frequensi ?? '-'} Hz`);
        lines.push(`  GI Sum P: ${gen.gi_sum_p ?? '-'} MW`);
    }
    if (boiler && boiler.length > 0) {
        lines.push('');
        lines.push('*Boiler*');
        for (const b of boiler) {
            lines.push(`  Boiler ${b.boiler ?? '?'}: ${b.flow_steam ?? '-'} t/h, ${b.press_steam ?? '-'} bar, BB ${b.batubara_ton ?? '-'} t`);
        }
    }
    if (report.catatan) {
        lines.push('');
        lines.push(`*Catatan*: ${report.catatan}`);
    }

    return lines.join('\n');
}
