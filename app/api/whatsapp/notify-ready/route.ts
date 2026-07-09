import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteGroup,
    getWhatsappGroup,
    logNotification,
    notifySupervisorPersonal,
    buildDeepLink,
} from '@/lib/whatsapp';
import { getGroupForShift } from '@/lib/constants';

// Notif "siap dipublish": dikirim ke grup shift yang sedang dinas ketika SEMUA
// parameter yang dikirim ke washift sudah terisi (panel boiler A&B + panel turbin,
// plus level RCW & Demin terakhir). Dipanggil fire-and-forget dari client setiap
// kali ada SIMPAN. Endpoint sendiri yang menentukan complete & dedup, jadi notif
// hanya terkirim 1x per shift saat parameter baru saja lengkap.

const NOTIF_KIND = 'report_ready_shift';

function shiftLabel(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const first = (x: any) => (Array.isArray(x) ? x[0] : x);
const filled = (v: unknown) => v !== null && v !== undefined && v !== '';

interface NotifyReadyBody {
    date: string;
    shift: string;
    reportId: string;
}

export async function POST(req: NextRequest) {
    let body: NotifyReadyBody;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
    const { date, shift, reportId } = body;
    if (!date || !shift || !reportId) {
        return NextResponse.json({ error: 'date, shift, reportId required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Dedup PER-PENERIMA (bukan per-shift): nomor yang SUDAH sukses (status sent/NULL) di-skip
    // di langkah kirim (bawah), nomor yang gagal boleh retry — tanpa spam ke yang sudah dapat.

    // 2. Ambil data parameter washift dari report.
    const { data: report } = await supabase
        .from('shift_reports')
        .select(`
            id,
            supervisor,
            shift_boiler (boiler, press_steam, temp_steam, flow_steam, batubara_ton, temp_furnace, status_boiler),
            shift_turbin (press_steam, temp_steam, flow_steam, vacuum, thrust_bearing, status_turbin),
            shift_generator_gi (gen_load, gi_sum_p),
            shift_steam_dist (pabrik1_flow, pabrik2_flow, pabrik3a_flow, pabrik3b_flow),
            shift_power_dist (power_ubb, power_pabrik2, power_pabrik3a, power_revamping, power_pie),
            shift_tankyard (tk_rcw, tk_demin)
        `)
        .eq('id', reportId)
        .single();

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    // Boiler: bisa 2 baris (A & B). Sebuah boiler dianggap "terisi" kalau status
    // shutdown, atau flow/press/temp steam sudah diisi.
    const boilers = Array.isArray(report.shift_boiler) ? report.shift_boiler : (report.shift_boiler ? [report.shift_boiler] : []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findBoiler = (label: string) => boilers.find((b: any) => String(b.boiler).toUpperCase() === label);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boilerFilled = (b: any) =>
        !!b && (b.status_boiler === 'shutdown' || (filled(b.flow_steam) && filled(b.press_steam) && filled(b.temp_steam)));

    const boilerA = findBoiler('A');
    const boilerB = findBoiler('B');
    const turbin = first(report.shift_turbin);
    const gen = first(report.shift_generator_gi);
    const sd = first(report.shift_steam_dist);
    const pd = first(report.shift_power_dist);

    const missing: string[] = [];
    if (!boilerFilled(boilerA)) missing.push('Boiler A');
    if (!boilerFilled(boilerB)) missing.push('Boiler B');
    const turbinFilled = !!turbin && ((turbin as { status_turbin?: string }).status_turbin === 'shutdown' || (filled(turbin.flow_steam) && filled(turbin.press_steam) && filled(turbin.temp_steam)));
    if (!turbinFilled) missing.push('Turbin');
    if (!sd || !filled(sd.pabrik1_flow) || !filled(sd.pabrik2_flow) || !filled(sd.pabrik3a_flow)) missing.push('Distribusi Steam');
    if (!pd || !filled(pd.power_ubb) || !filled(pd.power_pabrik2) || !filled(pd.power_pabrik3a)) missing.push('Power');
    if (!gen || !filled(gen.gen_load)) missing.push('STG UBB');

    if (missing.length > 0) {
        return NextResponse.json({ ready: false, missing });
    }

    // 3. Resolve grup shift yang sedang dinas.
    const groupLetter = getGroupForShift(date, shift as 'pagi' | 'sore' | 'malam');
    if (!groupLetter) return NextResponse.json({ ready: true, skipped: 'no_group_assignment' });
    const groupKey = `shift_${groupLetter.toLowerCase()}`;

    // 4. Susun pesan ringkas parameter washift + link review/publish.
    // review=1 → halaman input-laporan auto-buka modal Review/Publish untuk Foreman/Supervisor.
    // LINK TETAP/PERMANEN — tanpa tanggal/shift: auto-resolve ke shift berjalan, supaya
    // Foreman/Supervisor pengganti bisa pakai link review LAMA dari grup WA aslinya.
    const link = buildDeepLink('/input-laporan', { review: '1' });
    // LINK TETAP/PERMANEN — tanpa tanggal: /logbook default ke hari ini (todayWIB), supaya
    // link review LAMA dari grup WA tetap mendarat di logbook hari berjalan saat dibuka ulang.
    const logbookLink = buildDeepLink('/logbook', {});
    const sc = shiftLabel(shift);
    // Pesan ringkas: tanpa isian parameter — cukup info + link untuk Foreman/Supervisor
    // membuka halaman Review/Publish + link E-Logbook untuk review tampilan buku.
    const msg = [
        `✅ *Laporan Shift ${sc} siap dipublish ke Washift*`,
        `Tanggal: ${date}  •  Grup ${groupLetter}`,
        '',
        'Semua parameter Shift sudah terisi. Mohon Foreman/Supervisor review & publish:',
        link,
        '',
        '📖 Review via E-Logbook:',
        logbookLink,
    ].join('\n');

    // 5. Kirim notif "siap dipublish":
    //   - Grup dengan penerima pribadi (A–C) → kirim ke tiap nomor pribadi.
    //   - Grup punya baris whatsapp_groups (mis. D) → kirim ke grup WA.
    // Lookup grup TIDAK lagi memblokir (dulu early-return memblokir A–C yang tak punya
    // baris whatsapp_groups). Supervisor personal SELALU dikirim di bawah.
    const { data: recips } = await supabase
        .from('whatsapp_reminder_recipients')
        .select('name, phone_number')
        .eq('group_letter', groupLetter)
        .eq('active', true);

    // Set nomor/target yang SUDAH sukses dikirimi (status sent/NULL) untuk shift ini → skip.
    const { data: sentRows } = await supabase
        .from('notification_log')
        .select('sent_to')
        .eq('kind', NOTIF_KIND)
        .eq('target_date', date)
        .eq('target_shift', shift)
        .or('status.is.null,status.eq.sent');
    const alreadySent = new Set((sentRows ?? []).map((r: { sent_to: string }) => r.sent_to));

    let dispatch: Record<string, unknown>;
    if (recips && recips.length > 0) {
        let sent = 0, skipped = 0;
        for (const r of recips as { name: string; phone_number: string }[]) {
            if (alreadySent.has(r.phone_number)) { skipped++; continue; } // sudah sukses → jangan dobel
            const ps = await sendFonnteGroup(r.phone_number, msg);
            if (ps.ok) sent++;
            await logNotification(supabase, { kind: NOTIF_KIND, target_date: date, target_shift: shift, target_group: groupLetter, sent_to: r.phone_number, payload: msg, result: ps });
        }
        dispatch = { mode: 'personal', recipients: recips.length, sent, skipped };
    } else {
        const group = await getWhatsappGroup(supabase, groupKey);
        if (group && alreadySent.has(group.fonnte_target)) {
            dispatch = { mode: 'group', skipped: 'already_sent' };
        } else if (group) {
            const send = await sendFonnteGroup(group.fonnte_target, msg);
            await logNotification(supabase, { kind: NOTIF_KIND, target_date: date, target_shift: shift, target_group: groupLetter, sent_to: group.fonnte_target, payload: msg, result: send });
            dispatch = { mode: 'group', sent: send.ok, error: send.error };
        } else {
            dispatch = { mode: 'none', skipped: 'no_group_configured', groupKey };
        }
    }

    // Kirim ke nomor pribadi supervisor (Fonnte) — SELALU, lepas dari grup.
    const sv = await notifySupervisorPersonal(supabase, {
        supervisorName: (report as { supervisor?: string | null }).supervisor,
        message: msg,
        logKind: `${NOTIF_KIND}_supervisor`,
        date,
        shift,
        account: 'publish', // notif siap-publish ke supervisor → Fonnte
    });

    return NextResponse.json({ ready: true, dispatch, supervisor: sv });
}
