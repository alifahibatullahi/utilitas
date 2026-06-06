import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteGroup,
    getWhatsappGroup,
    logNotification,
    notifySupervisorPersonal,
    buildDeepLink,
} from '@/lib/whatsapp';
import { getGroupShiftOnDate } from '@/lib/constants';
import {
    type DailyState,
    isBoilerComplete, isTurbinComplete, isPowerComplete,
} from '@/lib/daily-completeness';

// Notif "siap dipublish" laporan HARIAN (LHUBB): dikirim ke grup yang MENGISI LHUBB —
// yaitu grup yang dinas malam mulai 23:00 hari D (jadwal 'M' pada tanggal D) — ketika
// parameter Boiler A, Boiler B, Turbin, & Power sudah terisi (panel boiler + panel
// turbin selesai). Dipanggil fire-and-forget dari client tiap simpan harian. Endpoint
// sendiri yang menentukan complete & dedup (1x per hari).

const NOTIF_KIND = 'report_ready_daily';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const first = (x: any) => (Array.isArray(x) ? x[0] : x);

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

    // 2. Ambil parameter harian untuk cek kelengkapan. Kriteria kelengkapan SAMA
    //    PERSIS dengan centang tab di form (lib/daily-completeness.ts) — notif fire
    //    begitu tab Boiler A, Boiler B, Turbin, & Power BENAR-BENAR lengkap (semua
    //    field), sinkron dgn centang. Tarik semua kolom yang dibutuhkan helper.
    const { data: report } = await supabase
        .from('daily_reports')
        .select(`
            id,
            daily_report_steam (
                prod_boiler_a_24, prod_boiler_a_00, prod_boiler_b_24, prod_boiler_b_00,
                inlet_turbine_24, inlet_turbine_00, mps_i_24, mps_i_00,
                mps_3a_24, mps_3a_00, fully_condens_24, fully_condens_00
            ),
            daily_report_power (
                gen_00, power_ubb, power_ubb_totalizer,
                power_pabrik2, power_pabrik2_totalizer,
                power_pabrik3a, power_pabrik3a_totalizer, power_stg_ubb_totalizer
            ),
            daily_report_turbine_misc (
                status_boiler_a, status_boiler_b, status_turbin,
                status_feeder_a, status_feeder_b, status_feeder_c,
                status_feeder_d, status_feeder_e, status_feeder_f,
                press_steam_a, temp_steam_a, bfw_press_a, temp_bfw_a, temp_furnace_a,
                air_heater_ti113_a, temp_flue_gas_a, o2_a, primary_air_a, secondary_air_a, steam_drum_press_a,
                press_steam_b, temp_steam_b, bfw_press_b, temp_bfw_b, temp_furnace_b,
                air_heater_ti113_b, temp_flue_gas_b, o2_b, primary_air_b, secondary_air_b, steam_drum_press_b,
                steam_inlet_press, steam_inlet_temp, thrust_bearing_temp, axial_displacement,
                gen_ampere, gen_tegangan, gen_amp_react, gen_frequensi, gen_cos_phi,
                gi_sum_p, gi_sum_q, gi_cos_phi
            ),
            daily_report_coal (
                coal_a_24, coal_b_24, coal_c_24, coal_a_00, coal_b_00, coal_c_00,
                coal_d_24, coal_e_24, coal_f_24, coal_d_00, coal_e_00, coal_f_00
            ),
            daily_report_stock_tank (bfw_boiler_a, flow_bfw_a, bfw_boiler_b, flow_bfw_b),
            daily_report_totalizer (kasi_name)
        `)
        .eq('id', reportId)
        .single();

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const state: DailyState = {
        steam: first(report.daily_report_steam) ?? {},
        power: first(report.daily_report_power) ?? {},
        coal: first(report.daily_report_coal) ?? {},
        turbineMisc: first(report.daily_report_turbine_misc) ?? {},
        stockTank: first(report.daily_report_stock_tank) ?? {},
        totalizer: {},
    };

    const missing: string[] = [];
    if (!isBoilerComplete(state, 'a')) missing.push('Boiler A');
    if (!isBoilerComplete(state, 'b')) missing.push('Boiler B');
    if (!isTurbinComplete(state)) missing.push('Turbin');
    if (!isPowerComplete(state)) missing.push('Power');

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

    // Kirim juga ke nomor pribadi supervisor (KASI) — operators.phone_number sesuai nama.
    const kasiName = first(report.daily_report_totalizer)?.kasi_name as string | null | undefined;
    const sv = await notifySupervisorPersonal(supabase, {
        supervisorName: kasiName,
        message: msg,
        logKind: `${NOTIF_KIND}_supervisor`,
        date,
    });

    return NextResponse.json({ ready: true, sent: send.ok, error: send.error, group: groupKey, supervisor: sv });
}
