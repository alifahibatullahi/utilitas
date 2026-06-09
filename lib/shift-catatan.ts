import { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// SUMBER TUNGGAL "Catatan Operasional" shift. Dipakai oleh publish-shift (washift
// text, Review, PDF), laporan-shift view, DAN agregasi harian — supaya isinya IDENTIK.
// Format: SATU blok, tiap baris jadi bullet "• ", tanpa label per-station
// (permintaan user: "semua jadi satu, jangan dibedakan; tiap catatan jadi bullet").
// ─────────────────────────────────────────────────────────────────────────────

const SHIFT_LABEL_PUBLISH: Record<string, string> = { malam: 'Shift Malam', pagi: 'Shift Pagi', sore: 'Shift Sore' };

/** Format {date,shift} → "DD/MM Shift X". */
export function formatBerasapSince(info: { date: string; shift: string } | null | undefined): string {
    if (!info || !info.date) return '';
    const [y, m, d] = info.date.split('-').map(Number);
    if (!y || !m || !d) return '';
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} ${SHIFT_LABEL_PUBLISH[info.shift] || info.shift}`;
}

const STATION_CATATAN_ORDER = ['panel_boiler', 'panel_boiler_a', 'panel_boiler_b', 'panel_turbin'];

/** Gabungkan catatan utama + catatan tiap station jadi satu, tanpa label. */
export function mergeShiftCatatan(mainCatatan: string | null | undefined, stationCatatan: Record<string, string> | null | undefined): string {
    const parts: string[] = [];
    const main = (mainCatatan ?? '').trim();
    if (main) parts.push(main);
    const sc = stationCatatan ?? {};
    for (const key of STATION_CATATAN_ORDER) {
        const note = (sc[key] ?? '').trim();
        if (note) parts.push(note);
    }
    return parts.join('\n');
}

// Baris aktivitas dari tabel: kedatangan/permintaan solar & unloading fly ash.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildActivityLines(internal: { ash?: any[]; solarIn?: any[]; solarOut?: any[] } | undefined): string[] {
    const lines: string[] = [];
    for (const s of internal?.solarIn ?? []) {
        const liters = Number(s.liters);
        if (liters > 0) lines.push(`Kedatangan solar dari ${s.supplier ?? '-'} sebanyak ${liters.toLocaleString('id-ID')} L`);
    }
    for (const s of internal?.solarOut ?? []) {
        const liters = Number(s.liters);
        if (liters > 0) lines.push(`Permintaan solar ke ${s.tujuan ?? '-'} sebanyak ${liters.toLocaleString('id-ID')} L`);
    }
    for (const a of internal?.ash ?? []) {
        const ritase = Number(a.ritase);
        if (ritase > 0) lines.push(`Unloading fly ash Silo ${a.silo ?? '-'} sebanyak ${ritase}× ke ${a.tujuan || '-'}`);
    }
    return lines;
}

// Baris "Bunker X berasap sejak ..." dari status bunker + history (berasapSince).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeBunkerBerasapLines(coal: any, date: string, shift: string, berasapSince: Record<string, { date: string; shift: string } | null>): string[] {
    if (!coal) return [];
    return ['a', 'b', 'c', 'd', 'e', 'f']
        .filter(k => String(coal[`status_bunker_${k}`] ?? '').toLowerCase() === 'berasap')
        .map(k => {
            const since = berasapSince[`status_bunker_${k}`] ?? { date, shift };
            const s = formatBerasapSince(since);
            return s ? `Bunker ${k.toUpperCase()} berasap sejak ${s}` : `Bunker ${k.toUpperCase()} berasap`;
        });
}

/** Hitung kapan tiap bunker mulai berasap (walk-back shift berturut berstatus Berasap). */
export async function fetchBunkerBerasapSince(
    supabase: SupabaseClient,
    date: string,
    shift: string,
): Promise<Record<string, { date: string; shift: string } | null>> {
    const BUNKER_KEYS = ['status_bunker_a', 'status_bunker_b', 'status_bunker_c', 'status_bunker_d', 'status_bunker_e', 'status_bunker_f'];
    const { data } = await supabase
        .from('shift_reports')
        .select('date, shift, shift_coal_bunker(status_bunker_a, status_bunker_b, status_bunker_c, status_bunker_d, status_bunker_e, status_bunker_f)')
        .lte('date', date)
        .order('date', { ascending: false })
        .limit(30);
    const shiftOrder: Record<string, number> = { sore: 2, pagi: 1, malam: 0 };
    const sorted = ((data ?? []) as { date: string; shift: string; shift_coal_bunker: Record<string, string | null>[] | Record<string, string | null> | null }[])
        .filter(r => {
            if (r.date === date && r.shift === shift) return false;
            if (r.date === date && (shiftOrder[r.shift] ?? 0) >= (shiftOrder[shift] ?? 0)) return false;
            return true;
        })
        .sort((a, b) => a.date !== b.date ? b.date.localeCompare(a.date) : (shiftOrder[b.shift] || 0) - (shiftOrder[a.shift] || 0));
    const result: Record<string, { date: string; shift: string } | null> = {};
    for (const key of BUNKER_KEYS) {
        let since: { date: string; shift: string } | null = null;
        for (const r of sorted) {
            const cb = Array.isArray(r.shift_coal_bunker) ? r.shift_coal_bunker[0] : r.shift_coal_bunker;
            if (!cb) break;
            if (String(cb[key] ?? '').toLowerCase() === 'berasap') since = { date: r.date, shift: r.shift };
            else break;
        }
        result[key] = since;
    }
    return result;
}

/** Jadikan tiap baris non-kosong sebagai bullet "• " (idempotent — tak dobel kalau sudah bullet). */
export function toBullets(text: string): string {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => (l.startsWith('•') ? l : `• ${l}`)).join('\n');
}

/** Catatan Operasional shift KANONIK = manual (gabungan station) + solar/fly ash + bunker
 *  berasap, satu blok, tiap baris bullet. Dedup terhadap catatan manual. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildOperationalCatatan(report: any, internal: { ash?: any[]; solarIn?: any[]; solarOut?: any[] } | undefined, bunkerLines: string[] = []): string {
    const manual = mergeShiftCatatan(report.catatan as string | null, report.station_catatan as Record<string, string> | null);
    const parts: string[] = [];
    if (manual.trim()) parts.push(manual.trim());
    for (const line of [...buildActivityLines(internal), ...bunkerLines]) {
        if (!manual.includes(line)) parts.push(line);
    }
    return toBullets(parts.join('\n'));
}

/** Catatan Operasional kanonik untuk SATU shift report row — fetch solar/ash + bunker,
 *  lalu rakit lewat builder. shiftRow wajib punya: date, shift, catatan, station_catatan,
 *  shift_coal_bunker. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getShiftCatatanCanonical(supabase: SupabaseClient, shiftRow: any): Promise<string> {
    const date = shiftRow.date as string;
    const shift = shiftRow.shift as string;
    const [{ data: ashRows }, { data: solarInRows }, { data: solarOutRows }] = await Promise.all([
        supabase.from('ash_unloadings').select('silo, perusahaan, tujuan, ritase').eq('date', date).eq('shift', shift),
        supabase.from('solar_unloadings').select('supplier, liters').eq('date', date).eq('shift', shift),
        supabase.from('solar_usages').select('tujuan, liters').eq('date', date).eq('shift', shift),
    ]);
    const internal = { ash: ashRows ?? [], solarIn: solarInRows ?? [], solarOut: solarOutRows ?? [] };
    const berasapSince = await fetchBunkerBerasapSince(supabase, date, shift);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coal = Array.isArray(shiftRow.shift_coal_bunker) ? (shiftRow.shift_coal_bunker as any[])[0] : (shiftRow.shift_coal_bunker ?? null);
    const bunkerLines = computeBunkerBerasapLines(coal, date, shift, berasapSince);
    return buildOperationalCatatan(shiftRow, internal, bunkerLines);
}
