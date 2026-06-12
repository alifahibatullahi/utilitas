import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteGroup,
    sendWaText,
    formatTanggalIndo,
    getWhatsappGroup,
    renderTemplate,
    logNotification,
    buildDeepLink,
    buildStationLinksBlock,
    nowWIB,
    shiftYesterdayWIB,
} from '@/lib/whatsapp';
import { getGroupForShift, getGroupShiftOnDate } from '@/lib/constants';

// Pesan lanjutan yang dikirim SETELAH reminder pribadi (grup A–C, mode personal):
// minta penerima meneruskan reminder ke grup WA-nya supaya operator lain ikut mengisi.
const FORWARD_NOTE = '🙏 Tolong kirim ke grup, agar yang lain bisa mengisi laporan.';

// Reminders run as a single endpoint hit by an external cron every ~15 minutes.
// Schedule (start/end/throttle per kind) is loaded from `notification_schedule` table — admin-editable.

// Bersama timeout 10 dtk per request gateway (lib/whatsapp.ts), worst case semua
// penerima gagal tetap selesai jauh di bawah 60 dtk; yang belum kebagian dilanjutkan
// tick berikutnya lewat dedup per-penerima di runJob.
export const maxDuration = 60;

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

    // 1. Sudah SUBMIT (bukan sekadar ada baris draft)? → skip.
    //    Penting: laporan harian sering dibuat sebagai 'draft' siang hari (jauh sebelum grup
    //    malam mengisi LHUBB). Cek status, jangan cuma keberadaan baris — kalau tidak,
    //    reminder LHUBB ke-skip padahal belum diisi.
    if (schedule.kind === 'shift_reminder' && schedule.shift) {
        const { data } = await supabase
            .from('shift_reports')
            .select('id')
            .eq('date', date)
            .eq('shift', schedule.shift)
            .neq('status', 'draft')
            .limit(1);
        if (data && data.length > 0) return { schedule: schedule.id, skipped: 'already_submitted' };
    } else if (schedule.kind === 'daily_reminder') {
        const { data } = await supabase
            .from('daily_reports')
            .select('id')
            .eq('date', date)
            .neq('status', 'draft')
            .limit(1);
        if (data && data.length > 0) return { schedule: schedule.id, skipped: 'already_submitted' };
    }

    // 2. One-shot PER PENERIMA: yang di-log hanya kiriman SUKSES (langkah 4), jadi
    //    `alreadySent` = nomor/grup yang sudah benar-benar menerima. Penerima yang
    //    gagal/terlewat (insiden Wablas hang, grup C 10 Jun 2026: 1 dari 3 nomor tak
    //    pernah dikirimi & dedup lama memblokir retry) otomatis dicoba lagi di tick
    //    cron berikutnya, tanpa mengirim dobel ke yang sudah dapat.
    // Abaikan baris status='failed' (resend manual dari log admin kini mencatat
    // kegagalan juga) supaya percobaan gagal tidak memblokir retry tick berikutnya.
    let dedupQuery = supabase
        .from('notification_log')
        .select('sent_to')
        .eq('kind', schedule.kind)
        .eq('target_date', date)
        .or('status.is.null,status.eq.sent');
    if (schedule.shift) dedupQuery = dedupQuery.eq('target_shift', schedule.shift);
    const { data: sentRows } = await dedupQuery;
    const alreadySent = new Set(((sentRows ?? []) as { sent_to: string }[]).map((r) => r.sent_to));

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

    const isShift = schedule.kind === 'shift_reminder' && !!schedule.shift;
    // LINK TETAP/PERMANEN — tanpa tanggal/shift. Saat dibuka, halaman auto-resolve ke
    // shift/hari yang sedang berjalan. Supaya operator pengganti (tukar shift) bisa pakai
    // link reminder LAMA dari grup WA aslinya & tetap mendarat di laporan yang aktif.
    // Single general link (back-compat untuk template lama yang masih pakai {{link}})
    // Harian: form input harian dimount di /input-shift via ?mode=harian (page auto-resolve
    // tanggal LHUBB berjalan dgn rollover 21:00). JANGAN ke /laporan-harian (halaman view).
    const link = isShift
        ? buildDeepLink('/input-shift', {})
        : buildDeepLink('/input-shift', { mode: 'harian' });
    // Multi-station links block — template baru pakai {{links}} untuk menampilkan
    // 1 link per operator station.
    const links = buildStationLinksBlock(isShift ? 'shift' : 'harian');

    const message = await renderTemplate(supabase, schedule.kind, {
        shift: schedule.shift ? schedule.shift.charAt(0).toUpperCase() + schedule.shift.slice(1) : '',
        group: groupLetter ?? '',
        date: formatTanggalIndo(date), // {{date}} tampil "Selasa, 10 Juni 2026"; `date` ISO tetap dipakai utk log/DB
        link,
        links,
    });

    // 4. Routing reminder (semua via Wablas):
    //   - Grup dengan penerima PRIBADI aktif (mis. A–C) → kirim HANYA ke nomor pribadi
    //     mereka, TIDAK ke grup WhatsApp.
    //   - Grup tanpa penerima pribadi (mis. D) / management → kirim ke GRUP WhatsApp.
    // Di KEDUA mode pakai kind dasar `schedule.kind` saat log, supaya one-shot dedup di
    // langkah 2 (query kind = schedule.kind) menemukan log ini & skip tick cron berikutnya.
    const recipients: { name: string; phone_number: string }[] = groupLetter
        ? (((await supabase
            .from('whatsapp_reminder_recipients')
            .select('name, phone_number')
            .eq('group_letter', groupLetter)
            .eq('active', true)).data ?? []) as { name: string; phone_number: string }[])
        : [];

    if (recipients.length > 0) {
        // Mode PRIBADI — grup A–C: kirim ke tiap nomor, grup WA dilewati.
        const pending = recipients.filter((r) => !alreadySent.has(r.phone_number));
        if (pending.length === 0) return { schedule: schedule.id, skipped: 'already_sent_once' };
        let personalSent = 0;
        const failed: string[] = [];
        for (const r of pending) {
            const ps = await sendWaText(r.phone_number, message);
            if (!ps.ok) {
                // Gagal → JANGAN log, supaya nomor ini di-retry tick berikutnya.
                failed.push(`${r.phone_number}: ${ps.error ?? 'unknown'}`);
                continue;
            }
            personalSent++;
            await logNotification(supabase, {
                kind: schedule.kind,
                target_date: date,
                target_shift: schedule.shift ?? null,
                target_group: groupLetter,
                sent_to: r.phone_number,
                payload: message,
                result: ps,
            });
            // Pesan lanjutan: minta penerima meneruskan reminder ke grup WA-nya.
            await sendWaText(r.phone_number, FORWARD_NOTE);
        }
        return { schedule: schedule.id, mode: 'personal', recipients: recipients.length, pending: pending.length, personalSent, failed };
    }

    // Mode GRUP — grup D / management: kirim ke grup WhatsApp. Lookup grup di SINI (bukan
    // di awal) supaya grup A–C yang TIDAK punya baris whatsapp_groups tetap bisa kirim ke
    // penerima pribadi di atas — sebelumnya early-return 'no_group_configured' memblokirnya.
    const group = await getWhatsappGroup(supabase, groupKey);
    if (!group) return { schedule: schedule.id, skipped: 'no_group_configured', groupKey };
    if (alreadySent.has(group.fonnte_target)) return { schedule: schedule.id, skipped: 'already_sent_once' };
    const send = await sendFonnteGroup(group.fonnte_target, message);
    if (send.ok) {
        await logNotification(supabase, {
            kind: schedule.kind,
            target_date: date,
            target_shift: schedule.shift ?? null,
            target_group: groupLetter,
            sent_to: group.fonnte_target,
            payload: message,
            result: send,
        });
    }

    return { schedule: schedule.id, mode: 'group', sent: send.ok, status: send.status, error: send.error };
}
