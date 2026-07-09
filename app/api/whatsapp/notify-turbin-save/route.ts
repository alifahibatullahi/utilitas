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

const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Format "2026-05-23" → "23 Mei". Parse local agar tidak ke-shift TZ. */
function formatTanggalBulan(isoDate: string): string {
    const [, m, d] = (isoDate || '').split('-').map(Number);
    if (!m || !d) return isoDate ?? '';
    return `${d} ${BULAN_ID[m - 1] ?? ''}`.trim();
}

/** Format "2026-05-23" → "23 Mei 2026" untuk baris Tanggal di pesan WA. */
function formatTanggalIndo(isoDate: string): string {
    const [y, m, d] = (isoDate || '').split('-').map(Number);
    if (!y || !m || !d) return isoDate ?? '';
    return `${d} ${BULAN_ID[m - 1] ?? ''} ${y}`.replace(/\s+/g, ' ').trim();
}

interface NotifyBody {
    type: 'shift' | 'harian';
    date: string;
    shift?: string;
    reportId: string;
    /** true = dry-run: kembalikan teks pesan saja, TANPA kirim WA & TANPA tulis notification_log */
    preview?: boolean;
}

/** Pesan siap kirim ke satu grup. Dipakai baik untuk preview maupun kirim beneran
 *  supaya teks yang tampil di modal preview identik dengan yang dikirim. */
interface OutgoingMessage {
    target: string;
    label: string;
    message: string;
    fonnteTarget: string;
    logKind: string;
    logShift?: string;
}

export async function POST(req: NextRequest) {
    let body: NotifyBody;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
    const { type, date, shift, reportId, preview } = body;
    if (!reportId || !date || !type) {
        return NextResponse.json({ error: 'reportId, date, type required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const items = type === 'shift'
        ? await buildShiftMessages(supabase, reportId, date, shift ?? '')
        : await buildHarianMessages(supabase, reportId, date);

    if (preview) {
        return NextResponse.json({
            preview: true,
            results: items.map(({ target, label, message }) => ({ target, label, message })),
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    for (const item of items) {
        const send = await sendFonnteGroup(item.fonnteTarget, item.message, 'publish');
        await logNotification(supabase, {
            kind: item.logKind,
            target_date: date,
            ...(item.logShift ? { target_shift: item.logShift } : {}),
            target_group: item.target,
            sent_to: item.fonnteTarget,
            payload: item.message,
            result: send,
        });
        results.push({ target: item.target, label: item.label, ok: send.ok, error: send.error, message: item.message });
    }

    return NextResponse.json({ results });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildShiftMessages(supabase: any, reportId: string, date: string, shift: string): Promise<OutgoingMessage[]> {
    const { data: report } = await supabase
        .from('shift_reports')
        .select('shift_power_dist(*), shift_generator_gi(*), shift_steam_dist(*)')
        .eq('id', reportId)
        .single();

    if (!report) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (x: any) => Array.isArray(x) ? x[0] : x;
    const pd = first(report.shift_power_dist);
    const gen = first(report.shift_generator_gi);
    const sd = first(report.shift_steam_dist);

    const items: OutgoingMessage[] = [];

    // --- Utilitas 2: Power data in MW ---
    const u2Group = await getWhatsappGroup(supabase, 'utilitas_2');
    if (u2Group) {
        items.push({
            target: 'utilitas_2',
            label: 'Utilitas 2',
            fonnteTarget: u2Group.fonnte_target,
            logKind: 'turbin_save_shift',
            logShift: shift,
            message: [
                `⚡ *Laporan Power Shift ${shiftLabel(shift)}*`,
                `Tanggal: ${formatTanggalIndo(date)}`,
                '',
                `Internal UBB : ${fmtNum(pd?.power_ubb)} MW`,
                `Pabrik 2     : ${fmtNum(pd?.power_pabrik2)} MW`,
                `Pabrik 3A    : ${fmtNum(pd?.power_pabrik3a)} MW`,
                `Pabrik 3B    : ${fmtNum(pd?.power_revamping)} MW`,
                `PIU          : ${fmtNum(pd?.power_pie)} MW`,
                `STG UBB      : ${fmtNum(gen?.gen_load)} MW`,
            ].join('\n'),
        });
    }

    // --- SU 3A: Distribusi Steam Pabrik 3 ---
    const su3aGroup = await getWhatsappGroup(supabase, 'su_3a');
    if (su3aGroup) {
        items.push({
            target: 'su_3a',
            label: 'SU 3A',
            fonnteTarget: su3aGroup.fonnte_target,
            logKind: 'turbin_save_shift',
            logShift: shift,
            message: [
                `🔥 *Distribusi Steam SU 3A — Shift ${shiftLabel(shift)}*`,
                `Tanggal: ${formatTanggalIndo(date)}`,
                '',
                `Flow       : ${fmtNum(sd?.pabrik3a_flow)} t/h`,
                `Temperature: ${fmtNum(sd?.pabrik3a_temp)} °C`,
                `Total Steam shift ${shiftLabel(shift)} : ${fmtNum(sd?.selisih_pabrik3a)} ton`,
            ].join('\n'),
        });
    }

    return items;
}

/** Ambil temperatur Pabrik 3A terakhir: nilai non-null dari shift_steam_dist paling baru
 *  (≤ tanggal laporan). Harian tidak menyimpan temperatur, jadi pakai data shift terbaru. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLastPabrik3aTemp(supabase: any, date: string): Promise<number | null> {
    const { data } = await supabase
        .from('shift_reports')
        .select('date, created_at, shift_steam_dist(pabrik3a_temp)')
        .lte('date', date)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);
    for (const r of data ?? []) {
        const sd = Array.isArray(r.shift_steam_dist) ? r.shift_steam_dist[0] : r.shift_steam_dist;
        if (sd?.pabrik3a_temp != null) return sd.pabrik3a_temp as number;
    }
    return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildHarianMessages(supabase: any, reportId: string, date: string): Promise<OutgoingMessage[]> {
    const { data: report } = await supabase
        .from('daily_reports')
        .select('daily_report_power(*), daily_report_steam(*)')
        .eq('id', reportId)
        .single();

    if (!report) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (x: any) => Array.isArray(x) ? x[0] : x;
    const pwr = first(report.daily_report_power);
    const stm = first(report.daily_report_steam);

    const items: OutgoingMessage[] = [];

    // --- Utilitas 2: Selisih totalizer Pabrik 2 ---
    const u2Group = await getWhatsappGroup(supabase, 'utilitas_2');
    if (u2Group) {
        items.push({
            target: 'utilitas_2',
            label: 'Utilitas 2',
            fonnteTarget: u2Group.fonnte_target,
            logKind: 'turbin_save_harian',
            message: [
                `⚡ *Laporan Power Harian*`,
                `Tanggal: ${formatTanggalIndo(date)}`,
                `Total Pabrik 2: ${fmtNum(pwr?.selisih_pabrik2)} MWh`,
            ].join('\n'),
        });
    }

    // --- SU 3A: Distribusi Steam Pabrik 3 harian ---
    const su3aGroup = await getWhatsappGroup(supabase, 'su_3a');
    if (su3aGroup) {
        // Temperatur Pabrik 3A tidak ada di laporan harian — ambil dari data shift terakhir
        // (entri shift_steam_dist non-null paling baru, ≤ tanggal laporan).
        const lastTemp = await fetchLastPabrik3aTemp(supabase, date);
        items.push({
            target: 'su_3a',
            label: 'SU 3A',
            fonnteTarget: su3aGroup.fonnte_target,
            logKind: 'turbin_save_harian',
            message: [
                `🔥 *Distribusi Steam SU 3A — Harian*`,
                `Tanggal: ${formatTanggalIndo(date)}`,
                '',
                `Flow : ${fmtNum(stm?.mps_3a_00)} t/h`,
                `Temperature : ${fmtNum(lastTemp)} °C`,
                `Total Steam ${formatTanggalBulan(date)} : ${fmtNum(stm?.selisih_mps_3a)} ton`,
            ].join('\n'),
        });
    }

    return items;
}
