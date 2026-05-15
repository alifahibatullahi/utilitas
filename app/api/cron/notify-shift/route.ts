import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteGroup,
    getWhatsappGroup,
    renderTemplate,
    logNotification,
    buildDeepLink,
    nowWIB,
    shiftYesterdayWIB,
} from '@/lib/whatsapp';
import { getGroupForShift } from '@/lib/constants';

// Reminders run as a single endpoint hit by an external cron every ~5 minutes.
// Throttle is enforced via notification_log (5-min window).

interface ReminderJob {
    kind: 'shift_reminder' | 'daily_reminder';
    shift?: 'pagi' | 'sore' | 'malam';
    date: string;          // logical report date (yesterday for malam/daily-after-midnight)
    startMinutes: number;  // minutes-of-day when window opens (WIB)
    endMinutes: number;    // when window closes (no more reminders)
    nowMinutes: number;
}

function determineActiveJobs(): ReminderJob[] {
    const { hour, minute, date } = nowWIB();
    const nowMinutes = hour * 60 + minute;
    const yesterday = shiftYesterdayWIB();
    const jobs: ReminderJob[] = [];

    // Pagi shift report (07:00–15:00) → reminder 12:30 → 15:00
    if (nowMinutes >= 12 * 60 + 30 && nowMinutes < 15 * 60) {
        jobs.push({
            kind: 'shift_reminder',
            shift: 'pagi',
            date,
            startMinutes: 12 * 60 + 30,
            endMinutes: 15 * 60,
            nowMinutes,
        });
    }

    // Sore shift report (15:00–23:00) → reminder 20:30 → 23:00
    if (nowMinutes >= 20 * 60 + 30 && nowMinutes < 23 * 60) {
        jobs.push({
            kind: 'shift_reminder',
            shift: 'sore',
            date,
            startMinutes: 20 * 60 + 30,
            endMinutes: 23 * 60,
            nowMinutes,
        });
    }

    // Malam shift report (23:00 prev → 07:00 today) → reminder 04:30 → 07:00
    // Logical report date = yesterday.
    if (nowMinutes >= 4 * 60 + 30 && nowMinutes < 7 * 60) {
        jobs.push({
            kind: 'shift_reminder',
            shift: 'malam',
            date: yesterday,
            startMinutes: 4 * 60 + 30,
            endMinutes: 7 * 60,
            nowMinutes,
        });
    }

    // Daily LHUBB → reminder 23:00 today → 02:00 next day
    if (nowMinutes >= 23 * 60) {
        jobs.push({
            kind: 'daily_reminder',
            date,
            startMinutes: 23 * 60,
            endMinutes: 26 * 60, // 02:00 next day
            nowMinutes,
        });
    } else if (nowMinutes < 2 * 60) {
        jobs.push({
            kind: 'daily_reminder',
            date: yesterday,
            startMinutes: 23 * 60,
            endMinutes: 26 * 60,
            nowMinutes: nowMinutes + 24 * 60,
        });
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
    const jobs = determineActiveJobs();
    const results: unknown[] = [];

    for (const job of jobs) {
        results.push(await runJob(supabase, job));
    }

    return NextResponse.json({ now: nowWIB(), jobs: results });
}

async function runJob(supabase: ReturnType<typeof createAdminClient>, job: ReminderJob) {
    // 1. Already submitted? → skip
    if (job.kind === 'shift_reminder' && job.shift) {
        const { data } = await supabase
            .from('shift_reports')
            .select('id')
            .eq('date', job.date)
            .eq('shift', job.shift)
            .limit(1);
        if (data && data.length > 0) return { job, skipped: 'already_submitted' };
    } else if (job.kind === 'daily_reminder') {
        const { data } = await supabase
            .from('daily_reports')
            .select('id')
            .eq('date', job.date)
            .limit(1);
        if (data && data.length > 0) return { job, skipped: 'already_submitted' };
    }

    // 2. Throttle: was a reminder of this kind/date/shift sent in the last 5 minutes?
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    let throttleQuery = supabase
        .from('notification_log')
        .select('id')
        .eq('kind', job.kind)
        .eq('target_date', job.date)
        .gte('sent_at', fiveMinAgo);
    if (job.shift) throttleQuery = throttleQuery.eq('target_shift', job.shift);
    const { data: recent } = await throttleQuery.limit(1);
    if (recent && recent.length > 0) return { job, skipped: 'throttled' };

    // 3. Build target group + message
    let groupKey: string;
    let groupLetter: string | null = null;
    if (job.kind === 'shift_reminder' && job.shift) {
        groupLetter = getGroupForShift(job.date, job.shift);
        if (!groupLetter) return { job, skipped: 'no_group_assignment' };
        groupKey = `shift_${groupLetter.toLowerCase()}`;
    } else {
        // For daily LHUBB, use the management group (or fall back to current shift group).
        groupKey = 'management';
    }

    const group = await getWhatsappGroup(supabase, groupKey);
    if (!group) return { job, skipped: 'no_group_configured', groupKey };

    const link =
        job.kind === 'shift_reminder' && job.shift
            ? buildDeepLink('/input-shift', { shift: job.shift, date: job.date })
            : buildDeepLink('/laporan-harian', { date: job.date });

    const message = await renderTemplate(supabase, job.kind, {
        shift: job.shift ? job.shift.charAt(0).toUpperCase() + job.shift.slice(1) : '',
        group: groupLetter ?? '',
        date: job.date,
        link,
    });

    // 4. Send + log
    const send = await sendFonnteGroup(group.fonnte_target, message);
    await logNotification(supabase, {
        kind: job.kind,
        target_date: job.date,
        target_shift: job.shift ?? null,
        target_group: groupLetter,
        sent_to: group.fonnte_target,
        payload: message,
    });

    return { job, sent: send.ok, status: send.status };
}
