import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteGroup,
    getWhatsappGroup,
    logNotification,
} from '@/lib/whatsapp';

function fmtNum(v: number | null | undefined, decimals = 1): string {
    if (v == null) return '-';
    const n = Number(v);
    if (isNaN(n)) return '-';
    return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

function shiftLabel(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

interface NotifyBody {
    type: 'shift' | 'harian';
    date: string;
    shift?: string;
    reportId: string;
}

export async function POST(req: NextRequest) {
    let body: NotifyBody;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
    const { type, date, shift, reportId } = body;
    if (!reportId || !date || !type) {
        return NextResponse.json({ error: 'reportId, date, type required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];

    if (type === 'shift') {
        await sendShiftNotifications(supabase, reportId, date, shift ?? '', results);
    } else {
        await sendHarianNotifications(supabase, reportId, date, results);
    }

    return NextResponse.json({ results });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendShiftNotifications(supabase: any, reportId: string, date: string, shift: string, results: any[]) {
    const { data: report } = await supabase
        .from('shift_reports')
        .select('shift_power_dist(*), shift_generator_gi(*), shift_steam_dist(*)')
        .eq('id', reportId)
        .single();

    if (!report) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (x: any) => Array.isArray(x) ? x[0] : x;
    const pd = first(report.shift_power_dist);
    const gen = first(report.shift_generator_gi);
    const sd = first(report.shift_steam_dist);

    // --- Utilitas 2: Power data in MW ---
    const u2Group = await getWhatsappGroup(supabase, 'utilitas_2');
    if (u2Group) {
        const msg = [
            `⚡ *Laporan Power Shift ${shiftLabel(shift)}*`,
            `Tanggal: ${date}`,
            '',
            `Internal UBB : ${fmtNum(pd?.power_ubb)} MW`,
            `Pabrik 2     : ${fmtNum(pd?.power_pabrik2)} MW`,
            `Pabrik 3A    : ${fmtNum(pd?.power_pabrik3a)} MW`,
            `Pabrik 3B    : ${fmtNum(pd?.power_revamping)} MW`,
            `PIU          : ${fmtNum(pd?.power_pie)} MW`,
            `STG UBB      : ${fmtNum(gen?.gen_load)} MW`,
        ].join('\n');

        const send = await sendFonnteGroup(u2Group.fonnte_target, msg);
        await logNotification(supabase, {
            kind: 'turbin_save_shift',
            target_date: date,
            target_shift: shift,
            target_group: 'utilitas_2',
            sent_to: u2Group.fonnte_target,
            payload: msg,
        });
        results.push({ target: 'utilitas_2', label: 'Utilitas 2', ok: send.ok, error: send.error, message: msg });
    }

    // --- SU 3A: Distribusi Steam Pabrik 3 ---
    const su3aGroup = await getWhatsappGroup(supabase, 'su_3a');
    if (su3aGroup) {
        const msg = [
            `🔥 *Distribusi Steam Pabrik 3 — Shift ${shiftLabel(shift)}*`,
            `Tanggal: ${date}`,
            '',
            `Flow      : ${fmtNum(sd?.pabrik3a_flow)} t/h`,
            `Temperatur: ${fmtNum(sd?.pabrik3a_temp)} °C`,
            `Totalizer : ${fmtNum(sd?.pabrik3a_totalizer)} ton`,
            `Selisih   : ${fmtNum(sd?.selisih_pabrik3a)} ton`,
        ].join('\n');

        const send = await sendFonnteGroup(su3aGroup.fonnte_target, msg);
        await logNotification(supabase, {
            kind: 'turbin_save_shift',
            target_date: date,
            target_shift: shift,
            target_group: 'su_3a',
            sent_to: su3aGroup.fonnte_target,
            payload: msg,
        });
        results.push({ target: 'su_3a', label: 'SU 3A', ok: send.ok, error: send.error, message: msg });
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendHarianNotifications(supabase: any, reportId: string, date: string, results: any[]) {
    const { data: report } = await supabase
        .from('daily_reports')
        .select('daily_report_power(*), daily_report_steam(*)')
        .eq('id', reportId)
        .single();

    if (!report) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (x: any) => Array.isArray(x) ? x[0] : x;
    const pwr = first(report.daily_report_power);
    const stm = first(report.daily_report_steam);

    // --- Utilitas 2: Selisih totalizer Pabrik 2 ---
    const u2Group = await getWhatsappGroup(supabase, 'utilitas_2');
    if (u2Group) {
        const msg = [
            `⚡ *Laporan Power Harian*`,
            `Tanggal: ${date}`,
            '',
            `Totalizer Pabrik 2 : ${fmtNum(pwr?.power_pabrik2_totalizer)} MWh`,
            `Selisih (hari ini − kemarin): ${fmtNum(pwr?.selisih_pabrik2)} MWh`,
        ].join('\n');

        const send = await sendFonnteGroup(u2Group.fonnte_target, msg);
        await logNotification(supabase, {
            kind: 'turbin_save_harian',
            target_date: date,
            target_group: 'utilitas_2',
            sent_to: u2Group.fonnte_target,
            payload: msg,
        });
        results.push({ target: 'utilitas_2', label: 'Utilitas 2', ok: send.ok, error: send.error, message: msg });
    }

    // --- SU 3A: Distribusi Steam Pabrik 3 harian ---
    const su3aGroup = await getWhatsappGroup(supabase, 'su_3a');
    if (su3aGroup) {
        const msg = [
            `🔥 *Distribusi Steam Pabrik 3 — Harian*`,
            `Tanggal: ${date}`,
            '',
            `Flow jam 00:00   : ${fmtNum(stm?.mps_3a_00)} t/h`,
            `Totalizer 24 jam : ${fmtNum(stm?.mps_3a_24)} ton`,
            `Selisih (hari ini − kemarin): ${fmtNum(stm?.selisih_mps_3a)} ton`,
        ].join('\n');

        const send = await sendFonnteGroup(su3aGroup.fonnte_target, msg);
        await logNotification(supabase, {
            kind: 'turbin_save_harian',
            target_date: date,
            target_group: 'su_3a',
            sent_to: su3aGroup.fonnte_target,
            payload: msg,
        });
        results.push({ target: 'su_3a', label: 'SU 3A', ok: send.ok, error: send.error, message: msg });
    }
}
