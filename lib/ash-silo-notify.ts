import type { SupabaseClient } from '@supabase/supabase-js';
import { sendWaText, logNotification, formatTanggalIndo, nowWIB } from '@/lib/whatsapp';

// Kirim "UPDATE SILO UBB" ke grup WA tiap hari sekitar 07:00 WIB. Dipanggil dari
// endpoint cron notify-shift (di-ping scheduler eksternal ~15 mnt sekali); fungsi
// ini yang menentukan kapan benar-benar kirim (window jam) + dedup 1×/hari.

// Grup ini hanya beranggotakan device FONNTE (ID diperoleh dari Fonnte), jadi
// kirim lewat akun 'publish' (Fonnte) dengan target format "...@g.us" — BUKAN via
// Wablas. Fonnte deteksi grup dari sufiks @g.us.
const ASH_SILO_GROUP = '120363025310720659@g.us';
const SEND_HOUR = 7; // 07:00 WIB
const KIND = 'ash_silo_update';

// Konvensi ENDING: dalam satu tanggal DB, shift malam berakhir 07:00, pagi 15:00,
// sore 23:00 — jadi urutan kronologis dalam satu tanggal adalah malam < pagi < sore
// (BUKAN urutan enum DB). Dipakai untuk menentukan pembacaan "terbaru".
const SHIFT_RANK: Record<string, number> = { malam: 0, pagi: 1, sore: 2 };

interface EspRow {
    silo_a: number | null;
    silo_b: number | null;
    created_at: string;
    shift_reports: { date: string; shift: string };
}

function fmt(v: number | null): string {
    if (v == null) return '-';
    return Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`;
}

export async function notifyAshSiloDaily(supabase: SupabaseClient) {
    const { hour, date } = nowWIB();

    // 1. Guard window: kirim pada tick PERTAMA di jam 07:xx WIB (seluruh jam 07,
    //    menit 0–59). Tick pertama yang masuk window menang; sisanya di-skip oleh
    //    dedup harian. Jam penuh (bukan cuma 07:00–07:30) supaya tetap tertangkap
    //    walau ping scheduler agak meleset dari 07:00. Scheduler eksternal nge-ping
    //    endpoint ini tiap ~15 mnt sepanjang hari, jadi jam 07 pasti kena ≥1 tick.
    if (hour !== SEND_HOUR) {
        return { skipped: 'outside_window' as const };
    }

    // 2. Dedup harian: kalau sudah pernah terkirim sukses hari ini → skip.
    const { data: sentRows } = await supabase
        .from('notification_log')
        .select('id')
        .eq('kind', KIND)
        .eq('target_date', date)
        .or('status.is.null,status.eq.sent')
        .limit(1);
    if (sentRows && sentRows.length > 0) {
        return { skipped: 'already_sent' as const };
    }

    // 3. Ambil level terakhir per silo (sama seperti /tank-level). "Terbaru"
    //    ditentukan client-side: tanggal desc → rank shift (ENDING) desc →
    //    created_at desc. created_at saja salah untuk laporan backfill.
    const { data, error } = await supabase
        .from('shift_esp_handling')
        .select('silo_a, silo_b, created_at, shift_reports!inner(date, shift)')
        .or('silo_a.not.is.null,silo_b.not.is.null')
        .order('created_at', { ascending: false })
        .limit(12);
    if (error) return { error: error.message };

    const rows = (data ?? []) as unknown as EspRow[];
    rows.sort((a, b) =>
        b.shift_reports.date.localeCompare(a.shift_reports.date)
        || (SHIFT_RANK[b.shift_reports.shift] ?? 0) - (SHIFT_RANK[a.shift_reports.shift] ?? 0)
        || b.created_at.localeCompare(a.created_at));

    const pick = (col: 'silo_a' | 'silo_b'): number | null => {
        const row = rows.find(r => r[col] !== null);
        return row ? Number(row[col]) : null;
    };
    const a = pick('silo_a');
    const b = pick('silo_b');

    // 4. Belum pernah ada data sama sekali → jangan kirim pesan kosong.
    if (a == null && b == null) return { skipped: 'no_data' as const };

    // 5. Susun pesan sesuai format yang diminta.
    const message = `UPDATE SILO UBB\n${formatTanggalIndo(date)}\n\nSILO A ${fmt(a)}\nSILO B ${fmt(b)}`;

    // 6. Kirim ke grup via akun 'publish' (Fonnte) — device Fonnte yang jadi
    //    anggota grup ini.
    const res = await sendWaText(ASH_SILO_GROUP, message, 'publish');

    // 7. Log hanya bila sukses → kalau gagal, tick berikutnya (masih dalam window
    //    07:00) mencoba lagi. Pola retry yang sama seperti reminder.
    if (res.ok) {
        await logNotification(supabase, {
            kind: KIND,
            target_date: date,
            target_shift: null,
            target_group: null,
            sent_to: ASH_SILO_GROUP,
            payload: message,
            result: res,
        });
    }

    return { sent: res.ok, status: res.status, error: res.error };
}
