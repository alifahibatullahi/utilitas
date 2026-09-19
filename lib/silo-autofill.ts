/**
 * Auto-isi kolom Silo & Fly Ash laporan HARIAN (LHUBB) saat jam pengisian:
 *   CU/CV = level Silo A/B  → pembacaan ESP terakhir sampai tanggal itu
 *   CW/CX = unloading fly ash → total ritase ash_unloadings tanggal itu (0 bila nihil)
 *
 * Level silo hampir tidak berubah antar hari dan nilainya selalu ada di laporan
 * shift ESP, jadi LHUBB tidak perlu menunggu operator mengetik ulang. Ritase pun
 * sudah tercatat per shift; di sini hanya dijumlahkan.
 *
 * Dipicu server-side dari cron (app/api/cron/notify-shift) pada tick LHUBB SESUDAH
 * tengah malam — shift sore (berakhir 23:00) sudah melapor, jadi "level terakhir"
 * benar-benar level jam 24:00.
 *
 * Idempotent: hanya mengisi kolom yang masih NULL (operator menang) dan hanya
 * menulis Sheets kalau ada yang berubah, sehingga aman dipanggil tiap tick.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchLatestSiloLevels, sumAshRitasePerSilo } from './ash-silo-query';
import { postSheets } from './sheets-sync';

export interface SiloAutofillResult {
    date: string;
    skipped?: 'no_data' | 'sudah_terisi';
    filled?: string[];
}

export async function autofillSiloDaily(supabase: SupabaseClient, date: string): Promise<SiloAutofillResult> {
    const [levels, ashRes] = await Promise.all([
        fetchLatestSiloLevels(supabase, { maxDate: date }),
        supabase.from('ash_unloadings').select('silo, ritase').eq('date', date),
    ]);
    const ashRows = (ashRes.data ?? []) as { silo: string; ritase: number | null }[];
    const ritase = sumAshRitasePerSilo(ashRows);

    // Belum ada pembacaan silo sama sekali & tidak ada unloading → tidak ada yang
    // bisa dicatat; jangan membuat baris laporan kosong.
    if (levels.A == null && levels.B == null && ashRows.length === 0) {
        return { date, skipped: 'no_data' };
    }

    // Pastikan baris daily_reports ada (pola autofillShutdownDaily).
    let reportId: string | null = null;
    const { data: existing } = await supabase.from('daily_reports').select('id').eq('date', date).limit(1);
    if (existing && existing.length > 0) reportId = (existing[0] as { id: string }).id;
    else {
        const { data: ins } = await supabase.from('daily_reports').insert({ date, status: 'draft' } as never).select('id').single();
        reportId = (ins as { id: string } | null)?.id ?? null;
    }
    if (!reportId) return { date, skipped: 'no_data' };

    const { data: stockRows } = await supabase
        .from('daily_report_stock_tank')
        .select('id, silo_a_pct, silo_b_pct, unloading_fly_ash_a, unloading_fly_ash_b')
        .eq('daily_report_id', reportId);
    const stock = (stockRows ?? [])[0] as
        | { id: string; silo_a_pct: number | null; silo_b_pct: number | null; unloading_fly_ash_a: number | null; unloading_fly_ash_b: number | null }
        | undefined;

    // Hanya kolom yang masih kosong — isian operator tidak pernah ditimpa, dan
    // kolom lain di baris ini tidak disentuh (aturan merge tabel anak).
    const patch: Record<string, number> = {};
    const setIfEmpty = (col: keyof NonNullable<typeof stock>, val: number | null) => {
        if (val == null) return;
        if (stock && stock[col] != null) return;
        patch[col as string] = val;
    };
    setIfEmpty('silo_a_pct', levels.A?.pct ?? null);
    setIfEmpty('silo_b_pct', levels.B?.pct ?? null);
    setIfEmpty('unloading_fly_ash_a', ritase.A);
    setIfEmpty('unloading_fly_ash_b', ritase.B);

    if (Object.keys(patch).length === 0) return { date, skipped: 'sudah_terisi' };

    if (stock) await supabase.from('daily_report_stock_tank').update(patch as never).eq('id', stock.id);
    else await supabase.from('daily_report_stock_tank').insert({ daily_report_id: reportId, ...patch } as never);

    // Sync LHUBB (server re-baca DB).
    await postSheets('daily_report', { date });
    return { date, filled: Object.keys(patch) };
}
