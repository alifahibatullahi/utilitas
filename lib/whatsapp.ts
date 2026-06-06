import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { STATION_ORDER, STATION_LABELS, STATION_SHIFT_TABS, STATION_HARIAN_TABS } from './constants';

export function createAdminClient(): SupabaseClient {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

// ─── WAHA send helpers ───
// WAHA (WhatsApp HTTP API, self-host) menggantikan Fonnte. Nama fungsi lama
// (sendFonnteText/Group/File, FonnteAccount, accountForKind) DIPERTAHANKAN sebagai
// alias supaya seluruh pemanggil lama tidak perlu diubah.

export interface SendResult {
    ok: boolean;
    status?: number;
    body?: unknown;
    error?: string;   // human-readable reason when ok=false
}

// Dua "akun" = dua nomor/instance WAHA (tiap nomor = 1 session WAHA terpisah):
//  - 'notif'   → WAHA_*          : reminder isi laporan shift/harian (grup A–D), photo-bot.
//  - 'publish' → WAHA_*_PUBLISH  : publish laporan ke washift, Utilitas 2, SU 3A.
export type WaAccount = 'notif' | 'publish';
/** @deprecated nama lama; pakai WaAccount. */
export type FonnteAccount = WaAccount;

// notification_log.kind yang berasal dari akun PUBLISH — dipakai resend agar kirim
// ulang lewat akun/nomor yang sama dengan pengiriman aslinya.
const PUBLISH_KINDS = new Set(['shift_share', 'daily_share', 'turbin_save_shift', 'turbin_save_harian']);

/** Tentukan akun (nomor WA) dari kind notification_log (untuk resend). Default 'notif'. */
export function accountForKind(kind: string | null | undefined): WaAccount {
    return kind && PUBLISH_KINDS.has(kind) ? 'publish' : 'notif';
}

interface WahaConfig { baseUrl: string; apiKey: string; session: string; }

/** Resolve konfigurasi WAHA untuk akun tertentu. Akun 'publish' fallback ke env
 *  notif (dengan warning) kalau WAHA_*_PUBLISH belum diset, supaya tidak gagal total. */
function resolveWaha(account: WaAccount): { cfg?: WahaConfig; error?: string } {
    const pick = (suffix: '' | '_PUBLISH') => ({
        baseUrl: process.env[`WAHA_BASE_URL${suffix}`]?.trim().replace(/\/+$/, ''),
        apiKey: process.env[`WAHA_API_KEY${suffix}`]?.trim(),
        session: process.env[`WAHA_SESSION${suffix}`]?.trim() || 'default',
    });

    let conf = account === 'publish' ? pick('_PUBLISH') : pick('');
    if (account === 'publish' && !conf.baseUrl) {
        console.warn('[whatsapp] WAHA_BASE_URL_PUBLISH not set, falling back to WAHA_BASE_URL');
        conf = pick('');
    }
    if (!conf.baseUrl) return { error: 'WAHA_BASE_URL belum diset di environment server' };
    if (!conf.apiKey) return { error: 'WAHA_API_KEY belum diset di environment server' };
    return { cfg: { baseUrl: conf.baseUrl, apiKey: conf.apiKey, session: conf.session } };
}

/** Normalisasi target ke chatId WAHA. Grup sudah disimpan sbg "...@g.us" → dipakai
 *  apa adanya; nomor personal polos (mis. "628123...") → ditambah suffix "@c.us". */
function toChatId(target: string): string {
    const t = target.trim();
    if (t.includes('@')) return t;
    return `${t.replace(/[^\d]/g, '')}@c.us`;
}

async function wahaPost(cfg: WahaConfig, path: string, payload: Record<string, unknown>): Promise<SendResult> {
    try {
        const res = await fetch(`${cfg.baseUrl}${path}`, {
            method: 'POST',
            headers: { 'X-Api-Key': cfg.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => null);
        // WAHA: 2xx = terkirim. Error → non-2xx + { error/message } di body.
        const reason = body && typeof body === 'object'
            ? ((body as { error?: string; message?: string }).error ?? (body as { message?: string }).message)
            : undefined;
        return {
            ok: res.ok,
            status: res.status,
            body,
            error: res.ok ? undefined : (reason ?? `HTTP ${res.status}${body ? ' · ' + JSON.stringify(body) : ''}`),
        };
    } catch (err) {
        console.warn('[whatsapp] WAHA send failed:', err);
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

export async function sendWaText(to: string, message: string, account: WaAccount = 'notif'): Promise<SendResult> {
    const { cfg, error } = resolveWaha(account);
    if (!cfg) { console.warn('[whatsapp]', error); return { ok: false, error }; }
    return wahaPost(cfg, '/api/sendText', { session: cfg.session, chatId: toChatId(to), text: message });
}

// WAHA pakai chatId yang sama untuk nomor personal (@c.us) maupun grup (@g.us).
export const sendWaGroup = sendWaText;

// Tebak mimetype dari ekstensi nama file / URL (untuk sendFile WAHA).
function guessMime(name: string): string {
    const ext = name.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/)?.[1];
    switch (ext) {
        case 'pdf': return 'application/pdf';
        case 'jpg': case 'jpeg': return 'image/jpeg';
        case 'png': return 'image/png';
        case 'doc': return 'application/msword';
        case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case 'xls': return 'application/vnd.ms-excel';
        case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        default: return 'application/octet-stream';
    }
}

// Kirim file (PDF/gambar/dokumen) lewat URL publik — WAHA yang mengunduh & mengirim.
export async function sendWaFile(to: string, fileUrl: string, caption?: string, filename?: string, account: WaAccount = 'notif'): Promise<SendResult> {
    const { cfg, error } = resolveWaha(account);
    if (!cfg) { console.warn('[whatsapp]', error); return { ok: false, error }; }
    const name = filename || fileUrl.split('/').pop()?.split('?')[0] || 'file';
    const payload: Record<string, unknown> = {
        session: cfg.session,
        chatId: toChatId(to),
        file: { url: fileUrl, filename: name, mimetype: guessMime(name) },
    };
    if (caption) payload.caption = caption;
    return wahaPost(cfg, '/api/sendFile', payload);
}

// ─── Alias kompatibilitas (nama lama Fonnte → WAHA) ───
/** @deprecated pakai sendWaText. */
export const sendFonnteText = sendWaText;
/** @deprecated pakai sendWaGroup. */
export const sendFonnteGroup = sendWaGroup;
/** @deprecated pakai sendWaFile. */
export const sendFonnteFile = sendWaFile;

// ─── DB helpers ───

export async function getWhatsappGroup(supabase: SupabaseClient, key: string) {
    const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .eq('key', key)
        .eq('active', true)
        .maybeSingle();
    if (error) console.warn('[whatsapp] getWhatsappGroup error:', error);
    return data as { id: string; key: string; label: string; fonnte_target: string; is_group: boolean } | null;
}

export async function renderTemplate(
    supabase: SupabaseClient,
    key: string,
    vars: Record<string, string>,
): Promise<string> {
    const { data } = await supabase
        .from('notification_templates')
        .select('body')
        .eq('key', key)
        .maybeSingle();
    const body = (data?.body as string) ?? '';
    return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

export async function logNotification(
    supabase: SupabaseClient,
    entry: {
        kind: string;
        target_date: string;
        target_shift?: string | null;
        target_group?: string | null;
        sent_to: string;
        payload: string;
    },
): Promise<void> {
    const { error } = await supabase.from('notification_log').insert(entry);
    if (error) console.warn('[whatsapp] logNotification error:', error);
}

// ─── Shared report formatting ───

/** Format angka: null/undefined → '-', integer → tanpa decimal, selain itu fixed `decimals`. */
function fmtNum(v: unknown, decimals = 1): string {
    if (v == null) return '-';
    const n = Number(v);
    if (isNaN(n)) return '-';
    return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

// Membangun blok "PARAMETER OPERASI" (Boiler A&B / Turbin / Distribusi Steam /
// Power / Level RCW & Demin). Dipakai bersama oleh ringkasan publish washift
// (publish-shift) dan notif "siap dipublish" (notify-ready) supaya parameter di
// kedua pesan SELALU identik. Field di-akses lewat `first` agar tahan terhadap
// PostgREST yang return object (1-1) maupun array (1-many).
// `tankLevels` (opsional) meng-override Level RCW/Demin dengan data TERAKHIR dari
// tabel tank_levels (bukan dari shift_tankyard report).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildOperasiParams(report: any, tankLevels?: { rcw: number | null; demin: number | null }): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (x: any) => (Array.isArray(x) ? x[0] : (x ?? undefined));
    const turbin = first(report.shift_turbin);
    const gen = first(report.shift_generator_gi);
    const steamDist = first(report.shift_steam_dist);
    const powerDist = first(report.shift_power_dist);
    const tankyard = first(report.shift_tankyard);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boilers: any[] = [...(report.shift_boiler ?? [])].sort((a, b) => (a.boiler ?? '').localeCompare(b.boiler ?? ''));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boilerA = boilers.find((b: any) => b.boiler === 'A');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boilerB = boilers.find((b: any) => b.boiler === 'B');

    const lines: string[] = [];
    lines.push('━━━ *PARAMETER OPERASI* ━━━');

    // Boiler A & B — unit di setiap value supaya konsisten kalau salah satu kosong.
    if (boilerA || boilerB) {
        lines.push('');
        lines.push('*Boiler A & B*');
        lines.push(`  Flow Steam     : A ${fmtNum(boilerA?.flow_steam)} t/h | B ${fmtNum(boilerB?.flow_steam)} t/h`);
        lines.push(`  Total Batubara : A ${fmtNum(boilerA?.batubara_ton)} Ton | B ${fmtNum(boilerB?.batubara_ton)} Ton`);
        lines.push(`  Temp. Furnace  : A ${fmtNum(boilerA?.temp_furnace)} °C | B ${fmtNum(boilerB?.temp_furnace)} °C`);
    }

    // Turbin
    if (turbin) {
        lines.push('');
        lines.push('*Turbin*');
        lines.push(`  Steam Inlet         : ${fmtNum(turbin.flow_steam)} t/h`);
        lines.push(`  Temp. Thrust Bearing: ${fmtNum(turbin.thrust_bearing)} °C`);
    }

    // Distribusi Steam
    if (steamDist) {
        lines.push('');
        lines.push('*Distribusi Steam*');
        lines.push(`  Pabrik 1 : ${fmtNum(steamDist.pabrik1_flow)} t/h`);
        lines.push(`  Pabrik 3 : ${fmtNum(steamDist.pabrik3a_flow)} t/h`);
    }

    // Power
    if (gen || powerDist) {
        lines.push('');
        lines.push('*Power*');
        lines.push(`  STG UBB     : ${fmtNum(gen?.gen_load)} MW`);
        lines.push(`  Internal UBB: ${fmtNum(powerDist?.power_ubb)} MW`);
        lines.push(`  Pabrik 2    : ${fmtNum(powerDist?.power_pabrik2)} MW`);
        lines.push(`  Pabrik 3A   : ${fmtNum(powerDist?.power_pabrik3a)} MW`);
        lines.push(`  Pabrik 3B   : ${fmtNum(powerDist?.power_revamping)} MW`);
        lines.push(`  PIU         : ${fmtNum(powerDist?.power_pie)} MW`);
        lines.push(`  PLN         : ${fmtNum(gen?.gi_sum_p)} MW`);
    }

    // Tank Yard — Level RCW & Demin. Pakai data terakhir dari tank_levels kalau
    // disediakan (tankLevels), kalau tidak fallback ke shift_tankyard report.
    const rcw = tankLevels ? tankLevels.rcw : (tankyard?.tk_rcw ?? null);
    const demin = tankLevels ? tankLevels.demin : (tankyard?.tk_demin ?? null);
    if (tankLevels || tankyard) {
        lines.push('');
        lines.push(`Level RCW   : ${fmtNum(rcw)} m³`);
        lines.push(`Level Demin : ${fmtNum(demin)} m³`);
    }

    return lines.join('\n');
}

// ─── Deep links & WIB time helpers ───

export function buildDeepLink(path: string, params: Record<string, string>): string {
    // Strip trailing slash di base supaya tidak hasilkan double slash kalau env-nya
    // di-set seperti "https://app.com/" (browser tolerate tapi jelek).
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
    const q = new URLSearchParams(params).toString();
    return `${base}${path}${q ? `?${q}` : ''}`;
}

// ─── Station-based deep link block for WA reminder ────────────────────────────
// Membangun block multi-baris berisi link per-station, masing-masing membawa
// operator ke tab yang sesuai tugasnya. Dipakai di template via {{links}}.
export function buildStationLinksBlock(
    mode: 'shift' | 'harian',
): string {
    const tabsMap = mode === 'shift' ? STATION_SHIFT_TABS : STATION_HARIAN_TABS;
    // Form harian dimount di halaman /input-shift via mode toggle, jadi link harian
    // tetap pakai path /input-shift dengan param ?mode=harian.
    const path = '/input-shift';
    const modeLabel = mode === 'shift' ? 'Laporan shift' : 'Laporan harian';

    // LINK TETAP/PERMANEN: tidak menyertakan tanggal/shift. Saat dibuka, halaman
    // /input-shift auto-resolve ke shift/hari "saat ini" (lihat detectCurrentShift +
    // logika resolusi di page). Tujuannya: operator pengganti (tukar shift) yang tidak
    // dapat notif di grup WA bisa pakai link reminder LAMA dari grup aslinya, dan tetap
    // mendarat di laporan shift/hari yang sedang berjalan.
    const lines: string[] = [];
    for (const st of STATION_ORDER) {
        if (tabsMap[st].length === 0) continue; // station tidak punya tab di mode ini
        const params: Record<string, string> = { station: st };
        if (mode === 'harian') params.mode = 'harian';
        const link = buildDeepLink(path, params);
        // Format: bold station label di baris atas, link di baris bawah →
        // WhatsApp auto-render URL jadi tombol clickable yang jelas.
        lines.push(`👉 *Operator ${STATION_LABELS[st]}*\n${link}`);
    }
    void modeLabel; // dipertahankan untuk dokumentasi; konteks shift/harian sudah di template body
    return lines.join('\n\n');
}

// Returns the current date+time in WIB (UTC+7), regardless of server TZ.
export function nowWIB(): { hour: number; minute: number; date: string; isoDate: Date } {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utcMs + 7 * 60 * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
        hour: wib.getHours(),
        minute: wib.getMinutes(),
        date: `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())}`,
        isoDate: wib,
    };
}

export function shiftYesterdayWIB(): string {
    const { isoDate } = nowWIB();
    const d = new Date(isoDate);
    d.setDate(d.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
