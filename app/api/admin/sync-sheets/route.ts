/**
 * Sync from Google Sheets → PowerOps DB.
 *
 * Reads SELISIH values from sheets (Pagi/Sore/Malam tabs for shifts, LHUBB tab
 * for daily) and adds them to the last known raw totalizer in PowerOps to
 * reconstruct continuous raw totalizer values for periods where other groups
 * filled sheets manually instead of PowerOps.
 *
 * Limitations:
 * - SHIFT sheets only have steam totalizer selisih (cols 69, 70) and batubara
 *   total per boiler (cols 82, 83). Other totalizers (BFW, per-feeder, power)
 *   are not present at shift level.
 * - DAILY sheet has comprehensive selisih: steam, coal feeders, power MWh, BFW.
 *   Exception: Power Pabrik 3B and PIU only have MW (no MWh selisih) — left null.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/whatsapp';
import { getSheetRows, fromIndonesianDate, SHEET_TABS } from '@/lib/google-sheets';
import { rowToShiftReport } from '@/lib/sheets-mapper';
import { parseDailyRowSelisih } from './daily-parser';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ShiftType = 'pagi' | 'sore' | 'malam';

interface SyncBody {
    dryRun?: boolean;
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

function nextShift(date: string, shift: ShiftType): { date: string; shift: ShiftType } {
    if (shift === 'malam') return { date, shift: 'pagi' };
    if (shift === 'pagi') return { date, shift: 'sore' };
    const d = new Date(date + 'T00:00:00+07:00');
    d.setDate(d.getDate() + 1);
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, shift: 'malam' };
}

function nextDate(date: string): string {
    const d = new Date(date + 'T00:00:00+07:00');
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayWIB(): string {
    const now = new Date();
    const wib = new Date(now.getTime() + (now.getTimezoneOffset() + 7 * 60) * 60000);
    return `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())}`;
}

// Stop iterating when reaching this — today's data may not be in sheets yet.
function isAfterToday(date: string): boolean {
    return date > todayWIB();
}

interface ShiftResult {
    date: string;
    shift: ShiftType;
    action: 'inserted' | 'updated' | 'skipped' | 'sheet_not_found';
    raw_totalizer_steam_a: number | null;
    raw_totalizer_steam_b: number | null;
    batubara_a: number | null;
    batubara_b: number | null;
    note?: string;
}

interface DailyResult {
    date: string;
    action: 'inserted' | 'updated' | 'skipped' | 'sheet_not_found';
    fields: Record<string, number | null>;
    note?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createAdminClient>;

export async function POST(req: NextRequest) {
    let body: SyncBody = {};
    try { body = await req.json(); } catch { /* allow empty */ }
    const dryRun = !!body.dryRun;

    const supabase = createAdminClient();

    try {
        const shiftResults = await syncShifts(supabase, dryRun);
        const dailyResults = await syncDaily(supabase, dryRun);

        return NextResponse.json({
            ok: true,
            dryRun,
            shiftResults,
            dailyResults,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

// ─── Sheet bulk fetch (1 call per tab, with retry-on-429) ─────────────────────

async function fetchTabWithRetry(tab: string, attempts = 3): Promise<string[][]> {
    let lastErr: unknown = null;
    for (let i = 0; i < attempts; i++) {
        try {
            return await getSheetRows(tab);
        } catch (err) {
            lastErr = err;
            const msg = err instanceof Error ? err.message : String(err);
            // Quota exceeded → exponential backoff
            if (/quota|429|rateLimitExceeded/i.test(msg) && i < attempts - 1) {
                await new Promise(r => setTimeout(r, 1000 * (i + 1) * 2));
                continue;
            }
            throw err;
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// Build a Map<isoDate, row> from a sheet tab's data rows.
function indexByDate(rows: string[][]): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const row of rows) {
        const dateStr = (row[1] ?? '').trim();
        if (!dateStr) continue;
        const iso = fromIndonesianDate(dateStr);
        if (!iso) continue;
        map.set(iso, row);
    }
    return map;
}

// ─── SHIFT sync ───────────────────────────────────────────────────────────────

async function syncShifts(supabase: SupabaseClient, dryRun: boolean): Promise<ShiftResult[]> {
    // Find latest shift with steam totalizer data (the baseline).
    const { data: latest } = await supabase
        .from('shift_reports')
        .select('id, date, shift, shift_boiler(boiler, totalizer_steam)')
        .order('date', { ascending: false })
        .order('shift', { ascending: false }) // sore > pagi > malam alphabetically — need custom sort
        .limit(50);

    if (!latest || latest.length === 0) {
        return [{ date: '-', shift: 'malam', action: 'skipped', raw_totalizer_steam_a: null, raw_totalizer_steam_b: null, batubara_a: null, batubara_b: null, note: 'No shift_reports in DB' }];
    }

    // Sort chronologically (malam < pagi < sore) and find last row with non-null steam totalizer.
    const shiftOrder: Record<string, number> = { malam: 0, pagi: 1, sore: 2 };
    const sorted = [...latest].sort((a, b) => {
        if (a.date !== b.date) return (b.date as string).localeCompare(a.date as string);
        return shiftOrder[b.shift as string] - shiftOrder[a.shift as string];
    });

    let baselineRow: typeof sorted[number] | null = null;
    let baselineA: number | null = null;
    let baselineB: number | null = null;
    for (const row of sorted) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const boilers = (row as any).shift_boiler as { boiler: string; totalizer_steam: number | null }[];
        const a = boilers?.find(b => b.boiler === 'A')?.totalizer_steam;
        const b = boilers?.find(b => b.boiler === 'B')?.totalizer_steam;
        if (a != null && a > 0 && b != null && b > 0) {
            baselineRow = row;
            baselineA = Number(a);
            baselineB = Number(b);
            break;
        }
    }

    if (!baselineRow || baselineA == null || baselineB == null) {
        return [{ date: '-', shift: 'malam', action: 'skipped', raw_totalizer_steam_a: null, raw_totalizer_steam_b: null, batubara_a: null, batubara_b: null, note: 'No baseline shift_report with both boiler steam totalizers found' }];
    }

    const results: ShiftResult[] = [];
    let cur = nextShift(baselineRow.date as string, baselineRow.shift as ShiftType);
    let runningA = baselineA;
    let runningB = baselineB;

    // Bulk-fetch each shift tab ONCE (3 API calls total) then look up locally.
    const [pagiRows, soreRows, malamRows] = await Promise.all([
        fetchTabWithRetry(SHEET_TABS.pagi),
        fetchTabWithRetry(SHEET_TABS.sore),
        fetchTabWithRetry(SHEET_TABS.malam),
    ]);
    const tabIndex: Record<ShiftType, Map<string, string[]>> = {
        pagi: indexByDate(pagiRows),
        sore: indexByDate(soreRows),
        malam: indexByDate(malamRows),
    };

    // Iterate forward through shifts, stop after today.
    while (!isAfterToday(cur.date)) {
        const sheetRow = tabIndex[cur.shift].get(cur.date) ?? null;
        if (!sheetRow) {
            results.push({ date: cur.date, shift: cur.shift, action: 'sheet_not_found', raw_totalizer_steam_a: null, raw_totalizer_steam_b: null, batubara_a: null, batubara_b: null });
            cur = nextShift(cur.date, cur.shift);
            continue;
        }

        const parsed = rowToShiftReport(sheetRow);
        const selisihA = parsed.boilerA.totalizer_steam; // already selisih in sheets
        const selisihB = parsed.boilerB.totalizer_steam;
        const batA = parsed.boilerA.batubara_ton;
        const batB = parsed.boilerB.batubara_ton;

        const newRawA = selisihA != null ? runningA + Number(selisihA) : null;
        const newRawB = selisihB != null ? runningB + Number(selisihB) : null;

        if (newRawA != null) runningA = newRawA;
        if (newRawB != null) runningB = newRawB;

        const action = dryRun
            ? 'skipped'
            : await upsertShiftRow(supabase, cur.date, cur.shift, newRawA, newRawB, batA != null ? Number(batA) : null, batB != null ? Number(batB) : null);

        results.push({
            date: cur.date,
            shift: cur.shift,
            action: dryRun ? 'skipped' : action,
            raw_totalizer_steam_a: newRawA,
            raw_totalizer_steam_b: newRawB,
            batubara_a: batA != null ? Number(batA) : null,
            batubara_b: batB != null ? Number(batB) : null,
            note: dryRun ? '(dry run)' : undefined,
        });

        cur = nextShift(cur.date, cur.shift);
    }

    return results;
}

async function upsertShiftRow(
    supabase: SupabaseClient,
    date: string,
    shift: ShiftType,
    rawSteamA: number | null,
    rawSteamB: number | null,
    batA: number | null,
    batB: number | null,
): Promise<'inserted' | 'updated'> {
    // Find or create shift_report parent row.
    const { data: existing } = await supabase
        .from('shift_reports')
        .select('id')
        .eq('date', date)
        .eq('shift', shift)
        .maybeSingle();

    let reportId: string;
    let action: 'inserted' | 'updated';
    if (existing) {
        reportId = (existing as { id: string }).id;
        action = 'updated';
    } else {
        const { data: created, error } = await supabase
            .from('shift_reports')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .insert({ date, shift, group_name: '?', supervisor: 'Sync from Sheets', status: 'draft', catatan: 'Synced from Google Sheets (selisih → raw totalizer)' } as any)
            .select('id')
            .single();
        if (error || !created) throw new Error(`insert shift_report ${date} ${shift}: ${error?.message}`);
        reportId = (created as { id: string }).id;
        action = 'inserted';
    }

    // Upsert boiler A and B rows. Use delete+insert to handle update cleanly.
    for (const [boiler, raw, bat] of [['A', rawSteamA, batA], ['B', rawSteamB, batB]] as const) {
        if (raw == null && bat == null) continue;
        // Check if row exists
        const { data: existingBoiler } = await supabase
            .from('shift_boiler')
            .select('id, totalizer_steam, batubara_ton')
            .eq('shift_report_id', reportId)
            .eq('boiler', boiler)
            .maybeSingle();

        const payload: Record<string, unknown> = {};
        if (raw != null) payload.totalizer_steam = raw;
        if (bat != null) payload.batubara_ton = bat;

        if (existingBoiler) {
            const { error } = await supabase
                .from('shift_boiler')
                .update(payload)
                .eq('id', (existingBoiler as { id: string }).id);
            if (error) throw new Error(`update shift_boiler ${boiler} ${date} ${shift}: ${error.message}`);
        } else {
            const { error } = await supabase
                .from('shift_boiler')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .insert({ shift_report_id: reportId, boiler, ...payload } as any);
            if (error) throw new Error(`insert shift_boiler ${boiler} ${date} ${shift}: ${error.message}`);
        }
    }

    return action;
}

// ─── DAILY sync ───────────────────────────────────────────────────────────────

async function syncDaily(supabase: SupabaseClient, dryRun: boolean): Promise<DailyResult[]> {
    // Find latest daily_report with totalizer data.
    const { data: latest } = await supabase
        .from('daily_reports')
        .select(`
            id, date,
            daily_report_steam(prod_boiler_a_24, prod_boiler_b_24, inlet_turbine_24, mps_i_24, mps_3a_24, fully_condens_24),
            daily_report_power(power_ubb_totalizer, power_pabrik2_totalizer, power_pabrik3a_totalizer, power_stg_ubb_totalizer),
            daily_report_coal(coal_a_24, coal_b_24, coal_c_24, coal_d_24, coal_e_24, coal_f_24),
            daily_report_stock_tank(bfw_boiler_a, bfw_boiler_b)
        `)
        .order('date', { ascending: false })
        .limit(30);

    if (!latest || latest.length === 0) {
        return [{ date: '-', action: 'skipped', fields: {}, note: 'No daily_reports in DB' }];
    }

    // Find baseline = latest row with non-null totalizers.
    type DailyRow = {
        id: string;
        date: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        daily_report_steam: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        daily_report_power: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        daily_report_coal: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        daily_report_stock_tank: any;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (x: any) => Array.isArray(x) ? x[0] : x;
    let baseline: DailyRow | null = null;
    let running: Record<string, number> = {};

    for (const r of latest as unknown as DailyRow[]) {
        const stm = first(r.daily_report_steam);
        const pwr = first(r.daily_report_power);
        const cl = first(r.daily_report_coal);
        const stk = first(r.daily_report_stock_tank);
        if (stm?.prod_boiler_a_24 != null && cl?.coal_a_24 != null && pwr?.power_ubb_totalizer != null) {
            baseline = r;
            running = {
                prod_boiler_a_24: Number(stm.prod_boiler_a_24),
                prod_boiler_b_24: Number(stm.prod_boiler_b_24 ?? 0),
                inlet_turbine_24: Number(stm.inlet_turbine_24 ?? 0),
                mps_i_24: Number(stm.mps_i_24 ?? 0),
                mps_3a_24: Number(stm.mps_3a_24 ?? 0),
                fully_condens_24: Number(stm.fully_condens_24 ?? 0),
                coal_a_24: Number(cl.coal_a_24),
                coal_b_24: Number(cl.coal_b_24 ?? 0),
                coal_c_24: Number(cl.coal_c_24 ?? 0),
                coal_d_24: Number(cl.coal_d_24 ?? 0),
                coal_e_24: Number(cl.coal_e_24 ?? 0),
                coal_f_24: Number(cl.coal_f_24 ?? 0),
                power_ubb_totalizer: Number(pwr.power_ubb_totalizer),
                power_pabrik2_totalizer: Number(pwr.power_pabrik2_totalizer ?? 0),
                power_pabrik3a_totalizer: Number(pwr.power_pabrik3a_totalizer ?? 0),
                power_stg_ubb_totalizer: Number(pwr.power_stg_ubb_totalizer ?? 0),
                bfw_boiler_a: Number(stk?.bfw_boiler_a ?? 0),
                bfw_boiler_b: Number(stk?.bfw_boiler_b ?? 0),
            };
            break;
        }
    }

    if (!baseline) {
        return [{ date: '-', action: 'skipped', fields: {}, note: 'No baseline daily_report with totalizer data found' }];
    }

    const results: DailyResult[] = [];
    let curDate = nextDate(baseline.date);

    // Bulk-fetch LHUBB tab ONCE (1 API call) then look up locally.
    const lhubbRows = await fetchTabWithRetry(SHEET_TABS.harian);
    const lhubbIndex = indexByDate(lhubbRows);

    while (!isAfterToday(curDate)) {
        const sheetRow = lhubbIndex.get(curDate) ?? null;
        if (!sheetRow) {
            results.push({ date: curDate, action: 'sheet_not_found', fields: {} });
            curDate = nextDate(curDate);
            continue;
        }

        const selisih = parseDailyRowSelisih(sheetRow);

        // Compute new raw = running + selisih (where selisih is non-null)
        const newRaw: Record<string, number | null> = {};
        for (const [k, v] of Object.entries(selisih)) {
            if (v == null) { newRaw[k] = null; continue; }
            newRaw[k] = running[k] + Number(v);
        }

        // Update running totals only for fields that got new values.
        for (const [k, v] of Object.entries(newRaw)) {
            if (v != null) running[k] = v;
        }

        const action = dryRun
            ? 'skipped'
            : await upsertDailyRow(supabase, curDate, newRaw, selisih);

        results.push({
            date: curDate,
            action: dryRun ? 'skipped' : action,
            fields: newRaw,
            note: dryRun ? '(dry run)' : undefined,
        });

        curDate = nextDate(curDate);
    }

    return results;
}

async function upsertDailyRow(
    supabase: SupabaseClient,
    date: string,
    newRaw: Record<string, number | null>,
    _selisih: Record<string, number | null>,
): Promise<'inserted' | 'updated'> {
    // Find or create daily_report parent row.
    const { data: existing } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('date', date)
        .maybeSingle();

    let reportId: string;
    let action: 'inserted' | 'updated';
    if (existing) {
        reportId = (existing as { id: string }).id;
        action = 'updated';
    } else {
        const { data: created, error } = await supabase
            .from('daily_reports')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .insert({ date, status: 'draft', notes: 'Synced from Google Sheets (selisih → raw totalizer)' } as any)
            .select('id')
            .single();
        if (error || !created) throw new Error(`insert daily_report ${date}: ${error?.message}`);
        reportId = (created as { id: string }).id;
        action = 'inserted';
    }

    // Steam child
    const steamFields: Record<string, number | null> = {
        prod_boiler_a_24: newRaw.prod_boiler_a_24,
        prod_boiler_b_24: newRaw.prod_boiler_b_24,
        inlet_turbine_24: newRaw.inlet_turbine_24,
        mps_i_24: newRaw.mps_i_24,
        mps_3a_24: newRaw.mps_3a_24,
        fully_condens_24: newRaw.fully_condens_24,
        selisih_prod_boiler_a: _selisih.prod_boiler_a_24,
        selisih_prod_boiler_b: _selisih.prod_boiler_b_24,
        selisih_inlet_turbine: _selisih.inlet_turbine_24,
        selisih_mps_i: _selisih.mps_i_24,
        selisih_mps_3a: _selisih.mps_3a_24,
        selisih_fully_condens: _selisih.fully_condens_24,
    };
    await upsertChild(supabase, 'daily_report_steam', reportId, steamFields);

    // Coal child
    const coalFields: Record<string, number | null> = {
        coal_a_24: newRaw.coal_a_24,
        coal_b_24: newRaw.coal_b_24,
        coal_c_24: newRaw.coal_c_24,
        coal_d_24: newRaw.coal_d_24,
        coal_e_24: newRaw.coal_e_24,
        coal_f_24: newRaw.coal_f_24,
        selisih_coal_a: _selisih.coal_a_24,
        selisih_coal_b: _selisih.coal_b_24,
        selisih_coal_c: _selisih.coal_c_24,
        selisih_coal_d: _selisih.coal_d_24,
        selisih_coal_e: _selisih.coal_e_24,
        selisih_coal_f: _selisih.coal_f_24,
    };
    await upsertChild(supabase, 'daily_report_coal', reportId, coalFields);

    // Power child
    const powerFields: Record<string, number | null> = {
        power_ubb_totalizer: newRaw.power_ubb_totalizer,
        power_pabrik2_totalizer: newRaw.power_pabrik2_totalizer,
        power_pabrik3a_totalizer: newRaw.power_pabrik3a_totalizer,
        power_stg_ubb_totalizer: newRaw.power_stg_ubb_totalizer,
        selisih_ubb: _selisih.power_ubb_totalizer,
        selisih_pabrik2: _selisih.power_pabrik2_totalizer,
        selisih_pabrik3a: _selisih.power_pabrik3a_totalizer,
        selisih_stg_ubb: _selisih.power_stg_ubb_totalizer,
    };
    await upsertChild(supabase, 'daily_report_power', reportId, powerFields);

    // Stock tank child (BFW)
    const stockFields: Record<string, number | null> = {
        bfw_boiler_a: newRaw.bfw_boiler_a,
        bfw_boiler_b: newRaw.bfw_boiler_b,
    };
    await upsertChild(supabase, 'daily_report_stock_tank', reportId, stockFields);

    return action;
}

async function upsertChild(
    supabase: SupabaseClient,
    table: string,
    reportId: string,
    fields: Record<string, number | null>,
): Promise<void> {
    // Filter out null values
    const payload: Record<string, number> = {};
    for (const [k, v] of Object.entries(fields)) {
        if (v != null && Number.isFinite(v)) payload[k] = v;
    }
    if (Object.keys(payload).length === 0) return;

    const { data: existing } = await supabase
        .from(table)
        .select('id')
        .eq('daily_report_id', reportId)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from(table)
            .update(payload)
            .eq('id', (existing as { id: string }).id);
        if (error) throw new Error(`update ${table}: ${error.message}`);
    } else {
        const { error } = await supabase
            .from(table)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .insert({ daily_report_id: reportId, ...payload } as any);
        if (error) throw new Error(`insert ${table}: ${error.message}`);
    }
}
