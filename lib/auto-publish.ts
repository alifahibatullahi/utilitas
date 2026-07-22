/**
 * Auto-publish laporan shift/harian yang sudah lewat batas waktu (deadline) submit
 * tapi belum di-publish operator. Dipicu server-side dari cron (notify-shift, ~15 mnt).
 *
 * Kebijakan (permintaan user 2026-07-22): HANYA menandai status → 'approved'
 * (reviewed_by='Sistem (auto)', reviewed_at=now). TIDAK broadcast WA/PDF & TIDAK
 * sync Sheets — murni pencatatan supaya laporan yang telat tetap tercatat "terpublish".
 * Semua baris yang masih draft/submitted saat deadline lewat ikut ditandai, apa pun
 * kelengkapannya.
 *
 * Deadline = akhir jendela submit di form (getShiftWindow + 2 jam grace, lihat
 * app/input-laporan/page.tsx submitWindow):
 *   pagi  → 17:00 (D)          sore  → 01:00 (D+1)
 *   malam → 09:00 (D, ENDING)  harian → 09:00 (D+1)
 * Idempotent: setelah status 'approved', baris tak lagi cocok filter draft/submitted.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { nowWIB } from './whatsapp';

// Nama pencatat untuk laporan yang di-publish otomatis oleh sistem (bukan operator).
const REVIEWER = 'Sistem (auto)';
// Berapa hari ke belakang laporan draft/submitted masih ikut disapu. Cukup lebar untuk
// menutup tick cron yang sempat mati; laporan lebih lama sudah ditangani tick sebelumnya.
const LOOKBACK_DAYS = 3;

// Deadline per shift dalam wall-clock WIB: offset hari dari `date` + jam.
const SHIFT_DEADLINE: Record<'pagi' | 'sore' | 'malam', { addDays: number; hour: number }> = {
    pagi: { addDays: 0, hour: 17 },   // end 15:00 (D) + 2 jam
    sore: { addDays: 1, hour: 1 },    // end 23:00 (D) + 2 jam
    malam: { addDays: 0, hour: 9 },   // end 07:00 (D, ENDING) + 2 jam
};

// Instant (ms epoch) dari wall-clock WIB (UTC+7). Date.UTC menangani overflow hari/jam
// (mis. hour-7 negatif atau day+addDays lewat akhir bulan) dengan benar.
function wibInstant(dateStr: string, addDays: number, hour: number): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d + addDays, hour - 7, 0, 0);
}

function shiftDeadlineInstant(dateStr: string, shift: string): number {
    const c = SHIFT_DEADLINE[shift as 'pagi' | 'sore' | 'malam'];
    return c ? wibInstant(dateStr, c.addDays, c.hour) : Number.POSITIVE_INFINITY;
}

// ISO date (YYYY-MM-DD) N hari lalu, dihitung dari tanggal WIB sekarang.
function isoDaysAgoWIB(days: number): string {
    const { date } = nowWIB();
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

export interface AutopublishResult {
    shift: number;
    daily: number;
    shiftIds: string[];
    dailyIds: string[];
}

export async function autopublishPastDeadline(supabase: SupabaseClient): Promise<AutopublishResult> {
    const now = Date.now();
    const since = isoDaysAgoWIB(LOOKBACK_DAYS);
    const reviewedAt = new Date().toISOString();

    // ── SHIFT ──
    const { data: shiftRows } = await supabase
        .from('shift_reports')
        .select('id, date, shift, status')
        .gte('date', since)
        .in('status', ['draft', 'submitted']);
    const shiftDue = ((shiftRows ?? []) as { id: string; date: string; shift: string }[])
        .filter(r => now >= shiftDeadlineInstant(r.date, r.shift));
    if (shiftDue.length > 0) {
        await supabase
            .from('shift_reports')
            .update({ status: 'approved', reviewed_by: REVIEWER, reviewed_at: reviewedAt } as never)
            .in('id', shiftDue.map(r => r.id));
    }

    // ── HARIAN (LHUBB) ──
    const { data: dailyRows } = await supabase
        .from('daily_reports')
        .select('id, date, status')
        .gte('date', since)
        .in('status', ['draft', 'submitted']);
    const dailyDue = ((dailyRows ?? []) as { id: string; date: string }[])
        .filter(r => now >= wibInstant(r.date, 1, 9)); // 09:00 (D+1)
    if (dailyDue.length > 0) {
        await supabase
            .from('daily_reports')
            .update({ status: 'approved', reviewed_by: REVIEWER, reviewed_at: reviewedAt } as never)
            .in('id', dailyDue.map(r => r.id));
    }

    return {
        shift: shiftDue.length,
        daily: dailyDue.length,
        shiftIds: shiftDue.map(r => r.id),
        dailyIds: dailyDue.map(r => r.id),
    };
}
