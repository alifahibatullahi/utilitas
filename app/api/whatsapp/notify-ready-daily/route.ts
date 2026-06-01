import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteGroup,
    getWhatsappGroup,
    logNotification,
    buildDeepLink,
} from '@/lib/whatsapp';
import { getGroupShiftOnDate } from '@/lib/constants';

// Notif "siap dipublish" laporan HARIAN (LHUBB): dikirim ke grup yang MENGISI LHUBB —
// yaitu grup yang dinas malam mulai 23:00 hari D (jadwal 'M' pada tanggal D) — ketika
// semua parameter harian utama sudah terisi. Dipanggil fire-and-forget dari client tiap
// simpan harian. Endpoint sendiri yang menentukan complete & dedup (1x per hari).

const NOTIF_KIND = 'report_ready_daily';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const first = (x: any) => (Array.isArray(x) ? x[0] : x);
const filled = (v: unknown) => v !== null && v !== undefined && v !== '';

interface NotifyReadyDailyBody {
    date: string;
    reportId: string;
}

export async function POST(req: NextRequest) {
    let body: NotifyReadyDailyBody;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
    const { date, reportId } = body;
    if (!date || !reportId) {
        return NextResponse.json({ error: 'date, reportId required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Sudah pernah kirim notif "siap" untuk tanggal ini? → skip (1x per hari).
    const { data: existing } = await supabase
        .from('notification_log')
        .select('id')
        .eq('kind', NOTIF_KIND)
        .eq('target_date', date)
        .limit(1);
    if (existing && existing.length > 0) {
        return NextResponse.json({ skipped: 'already_sent' });
    }

    // 2. Ambil parameter harian utama untuk cek kelengkapan.
    const { data: report } = await supabase
        .from('daily_reports')
        .select(`
            id,
            daily_report_steam (prod_boiler_a_00, prod_boiler_b_00, inlet_turbine_00),
            daily_report_power (gen_00, power_ubb),
            daily_report_coal (total_boiler_a_24, total_boiler_b_24),
            daily_report_stock_tank (rcw_level_00, demin_level_00, stock_batubara)
        `)
        .eq('id', reportId)
        .single();

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const steam = first(report.daily_report_steam);
    const power = first(report.daily_report_power);
    const coal = first(report.daily_report_coal);
    const stock = first(report.daily_report_stock_tank);

    const missing: string[] = [];
    if (!steam || !filled(steam.prod_boiler_a_00) || !filled(steam.prod_boiler_b_00) || !filled(steam.inlet_turbine_00)) missing.push('Produksi Steam');
    if (!power || !filled(power.gen_00) || !filled(power.power_ubb)) missing.push('Power');
    if (!coal || !filled(coal.total_boiler_a_24) || !filled(coal.total_boiler_b_24)) missing.push('Batubara 24h');
    if (!stock || !filled(stock.rcw_level_00) || !filled(stock.demin_level_00) || !filled(stock.stock_batubara)) missing.push('Stock & Tank');

    if (missing.length > 0) {
        return NextResponse.json({ ready: false, missing });
    }

    // 3. Resolve grup pengisi LHUBB = grup yang dinas malam mulai 23:00 hari D
    //    (jadwal 'M' pada tanggal D, sinkron dgn cron/notify-shift daily_reminder).
    let groupLetter: string | null = null;
    for (const g of ['A', 'B', 'C', 'D'] as const) {
        if (getGroupShiftOnDate(g, date) === 'M') { groupLetter = g; break; }
    }
    if (!groupLetter) return NextResponse.json({ ready: true, skipped: 'no_group_assignment' });
    const groupKey = `shift_${groupLetter.toLowerCase()}`;
    const group = await getWhatsappGroup(supabase, groupKey);
    if (!group) return NextResponse.json({ ready: true, skipped: 'no_group_configured', groupKey });

    // 4. Pesan ringkas (tanpa isian parameter) + link review/publish harian.
    const link = buildDeepLink('/input-shift', { mode: 'harian', date, review: '1' });
    const logbookLink = buildDeepLink('/logbook', { date });
    const msg = [
        `✅ *Laporan Harian (LHUBB) siap dipublish*`,
        `Tanggal: ${date}  •  Grup ${groupLetter}`,
        '',
        'Semua parameter harian sudah terisi. Mohon Foreman/Supervisor review & publish:',
        link,
        '',
        '📖 Review via E-Logbook:',
        logbookLink,
    ].join('\n');

    const send = await sendFonnteGroup(group.fonnte_target, msg);
    await logNotification(supabase, {
        kind: NOTIF_KIND,
        target_date: date,
        target_shift: null,
        target_group: groupLetter,
        sent_to: group.fonnte_target,
        payload: msg,
    });

    return NextResponse.json({ ready: true, sent: send.ok, error: send.error, group: groupKey });
}
