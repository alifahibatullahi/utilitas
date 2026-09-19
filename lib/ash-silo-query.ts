// Query bersama data Ash Silo: level terakhir per silo + agregat ritase unloading.
// Satu definisi "level terakhir" untuk semua pemakai — monitor /tank-level
// (useAshSiloData), notifikasi WA harian (ash-silo-notify), default form laporan
// harian, dan auto-isi cron LHUBB (silo-autofill).
//
// lib/ash-silo.ts sengaja tetap murni (spesifikasi & konversi) supaya komponen
// visual tidak ikut menarik kode query; di sini import Supabase hanya type-only,
// jadi komponen klien yang cuma butuh sumAshRitasePerSilo tidak membawa apa pun
// ke bundle.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShiftType } from './supabase/types';
import type { SiloId } from './ash-silo';

// Konvensi ENDING: dalam satu tanggal DB, shift malam berakhir 07:00, pagi 15:00,
// sore 23:00 — jadi urutan kronologis dalam satu tanggal adalah malam < pagi < sore
// (BUKAN urutan enum DB pagi<sore<malam).
export const SHIFT_RANK: Record<string, number> = { malam: 0, pagi: 1, sore: 2 };

export interface SiloLevelInfo {
    pct: number;            // 0 adalah nilai valid — null berarti belum ada data
    reportDate: string;     // shift_reports.date
    reportShift: ShiftType;
}

export interface EspSiloRow {
    silo_a: number | null;
    silo_b: number | null;
    created_at: string;
    shift_reports: { date: string; shift: ShiftType };
}

// 12 baris terakhir cukup untuk menemukan pembacaan non-null terbaru tiap silo
// (3 shift/hari) tanpa menarik histori.
const LOOKBACK_ROWS = 12;

/**
 * Level terakhir per silo. Opsi maxDate (YYYY-MM-DD) membatasi ke pembacaan
 * sampai tanggal itu — dipakai laporan harian supaya tanggal lama memakai level
 * yang berlaku saat itu, bukan pembacaan hari ini.
 */
export async function fetchLatestSiloLevels(
    supabase: SupabaseClient,
    opts: { maxDate?: string } = {},
): Promise<Record<SiloId, SiloLevelInfo | null>> {
    let q = supabase
        .from('shift_esp_handling')
        .select('silo_a, silo_b, created_at, shift_reports!inner(date, shift)')
        .or('silo_a.not.is.null,silo_b.not.is.null');
    if (opts.maxDate) q = q.lte('shift_reports.date', opts.maxDate);

    const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(LOOKBACK_ROWS);
    if (error) throw error;

    return pickLatestSiloLevels((data ?? []) as unknown as EspSiloRow[]);
}

/**
 * Urutkan ENDING (tanggal desc → rank shift desc → created_at desc) lalu ambil
 * pembacaan non-null terbaru per silo. created_at saja salah untuk laporan yang
 * di-backfill; urutan enum shift di DB tidak kronologis.
 */
export function pickLatestSiloLevels(rows: EspSiloRow[]): Record<SiloId, SiloLevelInfo | null> {
    const sorted = [...rows].sort((a, b) =>
        b.shift_reports.date.localeCompare(a.shift_reports.date)
        || (SHIFT_RANK[b.shift_reports.shift] ?? 0) - (SHIFT_RANK[a.shift_reports.shift] ?? 0)
        || b.created_at.localeCompare(a.created_at));

    const pick = (col: 'silo_a' | 'silo_b'): SiloLevelInfo | null => {
        const row = sorted.find(r => r[col] !== null);
        return row ? {
            pct: Number(row[col]),
            reportDate: row.shift_reports.date,
            reportShift: row.shift_reports.shift,
        } : null;
    };

    return { A: pick('silo_a'), B: pick('silo_b') };
}

// Kolom silo di ash_unloadings pernah diisi "A"/"B" dan "Silo A"/"Silo B".
export const isSiloA = (s: string) => s === 'A' || s === 'Silo A';
export const isSiloB = (s: string) => s === 'B' || s === 'Silo B';

/** Total ritase per silo (0 bila tidak ada entri) — sumber kolom CW/CX LHUBB. */
export function sumAshRitasePerSilo(
    rows: { silo: string; ritase: number | null }[],
): Record<SiloId, number> {
    const total = (match: (s: string) => boolean) =>
        rows.filter(r => match(r.silo)).reduce((sum, r) => sum + (Number(r.ritase) || 0), 0);
    return { A: total(isSiloA), B: total(isSiloB) };
}
