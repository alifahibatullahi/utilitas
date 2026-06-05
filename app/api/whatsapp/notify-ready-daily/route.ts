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
// parameter Boiler A, Boiler B, Turbin, & Power sudah terisi (panel boiler + panel
// turbin selesai). Dipanggil fire-and-forget dari client tiap simpan harian. Endpoint
// sendiri yang menentukan complete & dedup (1x per hari).

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
    //    Kriteria SAMA PERSIS dengan centang tab di form (isTabLengkap):
    //    notif "siap publish" fire begitu Boiler A, Boiler B, Turbin, & Power
    //    sudah lengkap (panel boiler + panel turbin selesai). Handling/stock/coal
    //    TIDAK jadi syarat — by design, lihat keputusan ops.
    //    Pakai field totalizer 24h (_24) yang memang diisi operator, BUKAN _00
    //    yang di-zero saat boiler/turbin shutdown.
    const { data: report } = await supabase
        .from('daily_reports')
        .select(`
            id,
            daily_report_steam (prod_boiler_a_24, prod_boiler_b_24, inlet_turbine_24, fully_condens_24),
            daily_report_power (gen_00),
            daily_report_turbine_misc (gen_ampere),
            daily_report_stock_tank (bfw_boiler_a, bfw_boiler_b)
        `)
        .eq('id', reportId)
        .single();

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const steam = first(report.daily_report_steam);
    const power = first(report.daily_report_power);
    const turbineMisc = first(report.daily_report_turbine_misc);
    const stock = first(report.daily_report_stock_tank);

    const missing: string[] = [];
    // Boiler A & B — produksi totalizer 24h + BFW (mirror isTabLengkap 'Boiler A'/'Boiler B').
    if (!steam || !filled(steam.prod_boiler_a_24) || !stock || !filled(stock.bfw_boiler_a)) missing.push('Boiler A');
    if (!steam || !filled(steam.prod_boiler_b_24) || !stock || !filled(stock.bfw_boiler_b)) missing.push('Boiler B');
    // Turbin — inlet & fully condensing 24h (mirror isTabLengkap 'Turbin').
    if (!steam || !filled(steam.inlet_turbine_24) || !filled(steam.fully_condens_24)) missing.push('Turbin');
    // Power/Generator — gen_00 (load) ATAU gen_ampere (mirror isTabLengkap 'Power').
    if ((!power || !filled(power.gen_00)) && (!turbineMisc || !filled(turbineMisc.gen_ampere))) missing.push('Power');

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
    // LINK TETAP/PERMANEN — tanpa tanggal: auto-resolve ke laporan harian berjalan, supaya
    // Foreman/Supervisor pengganti bisa pakai link review LAMA dari grup WA aslinya.
    const link = buildDeepLink('/input-shift', { mode: 'harian', review: '1' });
    const logbookLink = buildDeepLink('/logbook', { date });
    const msg = [
        `✅ *Laporan Harian (LHUBB) siap dipublish*`,
        `Tanggal: ${date}  •  Grup ${groupLetter}`,
        '',
        'Parameter Boiler, Turbin & Power sudah terisi. Mohon Foreman/Supervisor review & publish:',
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
