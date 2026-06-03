import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteGroup,
    getWhatsappGroup,
    renderTemplate,
    logNotification,
    buildDeepLink,
    buildStationLinksBlock,
    nowWIB,
    shiftYesterdayWIB,
} from '@/lib/whatsapp';
import { getGroupForShift, getGroupShiftOnDate } from '@/lib/constants';

// Reminders run as a single endpoint hit by an external cron every ~15 minutes.
// Schedule (start/end/throttle per kind) is loaded from `notification_schedule` table — admin-editable.

interface ScheduleRow {
    id: string;
    label: string;
    kind: string;             // 'shift_reminder' | 'daily_reminder'
    shift: string | null;     // 'pagi'|'sore'|'malam'|null
    start_hour: number;
    start_minute: number;
    end_hour: number;         // may exceed 24 to mean next-day (e.g. 26 = 02:00 next day)
    end_minute: number;
    throttle_minutes: number;
    enabled: boolean;
}

interface ReminderJob {
    schedule: ScheduleRow;
    date: string;             // logical report date (yesterday for malam shift / late LHUBB tick)
    nowMinutesShifted: number;// minutes-of-day in WIB; +24*60 if we treated current time as belonging to "yesterday's window"
}

function rowsToActiveJobs(rows: ScheduleRow[]): ReminderJob[] {
    const { hour, minute, date } = nowWIB();
    const nowMinutes = hour * 60 + minute;
    const yesterday = shiftYesterdayWIB();
    const jobs: ReminderJob[] = [];

    for (const row of rows) {
        if (!row.enabled) continue;
        const start = row.start_hour * 60 + row.start_minute;
        const end = row.end_hour * 60 + row.end_minute;

        // Same-day window (start < end)
        if (start <= end) {
            if (nowMinutes >= start && nowMinutes < end) {
                // ENDING convention: malam D = shift yang submit di hari D.
                // Reminder malam fires 04:30 D → reportDate = today (= shift end day).
                // Pagi/sore/harian: reportDate = today.
                jobs.push({ schedule: row, date, nowMinutesShifted: nowMinutes });
            }
        } else {
            // Wrap window (e.g. 23:00 → 26:00 = 02:00 next day).
            // Two cases for "now is inside":
            //   case A: nowMinutes >= start (still same day, before midnight)
            //   case B: nowMinutes + 24*60 < end (after midnight, before wrap-end)
            if (nowMinutes >= start) {
                jobs.push({ schedule: row, date, nowMinutesShifted: nowMinutes });
            } else if (nowMinutes + 24 * 60 < end) {
                // After midnight: logical report date = yesterday for daily LHUBB.
                jobs.push({ schedule: row, date: yesterday, nowMinutesShifted: nowMinutes + 24 * 60 });
            }
        }
    }

    return jobs;
}

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization') ?? '';
    const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
    if (!process.env.CRON_SECRET || authHeader !== expected) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: schedules, error } = await supabase
        .from('notification_schedule')
        .select('*');
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const jobs = rowsToActiveJobs((schedules ?? []) as ScheduleRow[]);
    const results: unknown[] = [];

    for (const job of jobs) {
        results.push(await runJob(supabase, job));
    }

    return NextResponse.json({ now: nowWIB(), jobs: results });
}

async function runJob(supabase: ReturnType<typeof createAdminClient>, job: ReminderJob) {
    const { schedule, date } = job;

    // 1. Already submitted? → skip
    if (schedule.kind === 'shift_reminder' && schedule.shift) {
        const { data } = await supabase
            .from('shift_reports')
            .select('id')
            .eq('date', date)
            .eq('shift', schedule.shift)
            .limit(1);
        if (data && data.length > 0) return { schedule: schedule.id, skipped: 'already_submitted' };
    } else if (schedule.kind === 'daily_reminder') {
        const { data } = await supabase
            .from('daily_reports')
            .select('id')
            .eq('date', date)
            .limit(1);
        if (data && data.length > 0) return { schedule: schedule.id, skipped: 'already_submitted' };
    }

    // 2. One-shot: kalau notif jenis ini untuk tanggal+shift ini SUDAH PERNAH dikirim, skip.
    //    (User minta reminder cuma 1x per shift, bukan ulang tiap 15 menit.)
    let dedupQuery = supabase
        .from('notification_log')
        .select('id')
        .eq('kind', schedule.kind)
        .eq('target_date', date);
    if (schedule.shift) dedupQuery = dedupQuery.eq('target_shift', schedule.shift);
    const { data: existing } = await dedupQuery.limit(1);
    if (existing && existing.length > 0) return { schedule: schedule.id, skipped: 'already_sent_once' };

    // 3. Build target group + message
    let groupKey: string;
    let groupLetter: string | null = null;
    if (schedule.kind === 'shift_reminder' && schedule.shift) {
        groupLetter = getGroupForShift(date, schedule.shift as 'pagi' | 'sore' | 'malam');
        if (!groupLetter) return { schedule: schedule.id, skipped: 'no_group_assignment' };
        groupKey = `shift_${groupLetter.toLowerCase()}`;
    } else if (schedule.kind === 'daily_reminder') {
        // LHUBB reminder fires 22:45 hari D. Yang mengisi LHUBB = grup yang dinas malam
        // mulai 23:00 hari D (working_start = D). Pattern rotasi pakai working_start = `date`.
        for (const g of ['A', 'B', 'C', 'D'] as const) {
            if (getGroupShiftOnDate(g, date) === 'M') { groupLetter = g; break; }
        }
        if (!groupLetter) return { schedule: schedule.id, skipped: 'no_group_assignment' };
        groupKey = `shift_${groupLetter.toLowerCase()}`;
    } else {
        groupKey = 'management';
    }

    const group = await getWhatsappGroup(supabase, groupKey);
    if (!group) return { schedule: schedule.id, skipped: 'no_group_configured', groupKey };

    const isShift = schedule.kind === 'shift_reminder' && !!schedule.shift;
    // LINK TETAP/PERMANEN — tanpa tanggal/shift. Saat dibuka, halaman auto-resolve ke
    // shift/hari yang sedang berjalan. Supaya operator pengganti (tukar shift) bisa pakai
    // link reminder LAMA dari grup WA aslinya & tetap mendarat di laporan yang aktif.
    // Single general link (back-compat untuk template lama yang masih pakai {{link}})
    const link = isShift
        ? buildDeepLink('/input-shift', {})
        : buildDeepLink('/laporan-harian', {});
    // Multi-station links block — template baru pakai {{links}} untuk menampilkan
    // 1 link per operator station.
    const links = buildStationLinksBlock(isShift ? 'shift' : 'harian');

    const message = await renderTemplate(supabase, schedule.kind, {
        shift: schedule.shift ? schedule.shift.charAt(0).toUpperCase() + schedule.shift.slice(1) : '',
        group: groupLetter ?? '',
        date,
        link,
        links,
    });

    // 4. Send + log
    const send = await sendFonnteGroup(group.fonnte_target, message);
    await logNotification(supabase, {
        kind: schedule.kind,
        target_date: date,
        target_shift: schedule.shift ?? null,
        target_group: groupLetter,
        sent_to: group.fonnte_target,
        payload: message,
    });

    return { schedule: schedule.id, sent: send.ok, status: send.status };
}
