import type { SupabaseClient } from '@supabase/supabase-js';
import { sendWaText, logNotification, formatTanggalIndo, nowWIB } from '@/lib/whatsapp';
import { fetchLatestSiloLevels } from '@/lib/ash-silo-query';

// Kirim "Level Ash Silo UBB" ke grup WA tiap hari sekitar 07:00 WIB. Dipanggil dari
// endpoint cron notify-shift (di-ping scheduler eksternal ~15 mnt sekali); fungsi
// ini yang menentukan kapan benar-benar kirim (window jam) + dedup 1×/hari.

// Grup ini hanya beranggotakan device FONNTE (ID diperoleh dari Fonnte), jadi
// kirim lewat akun 'publish' (Fonnte) dengan target format "...@g.us" — BUKAN via
// Wablas. Fonnte deteksi grup dari sufiks @g.us.
const ASH_SILO_GROUP = '120363025310720659@g.us';
const SEND_HOUR = 7; // 07:00 WIB
const KIND = 'ash_silo_update';

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

    // 3. Ambil level terakhir per silo (sama seperti /tank-level & laporan harian
    //    — satu implementasi di lib/ash-silo-query, urutan ENDING).
    let levels;
    try {
        levels = await fetchLatestSiloLevels(supabase);
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
    const a = levels.A?.pct ?? null;
    const b = levels.B?.pct ?? null;

    // 4. Belum pernah ada data sama sekali → jangan kirim pesan kosong.
    if (a == null && b == null) return { skipped: 'no_data' as const };

    // 5. Susun pesan sesuai format yang diminta.
    const message = `*Level Ash Silo UBB*\n${formatTanggalIndo(date)}\n\nSilo A ${fmt(a)}\nSilo B ${fmt(b)}`;

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
