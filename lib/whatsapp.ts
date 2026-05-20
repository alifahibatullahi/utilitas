import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { STATION_ORDER, STATION_LABELS, STATION_SHIFT_TABS, STATION_HARIAN_TABS } from './constants';

export function createAdminClient(): SupabaseClient {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

// ─── Fonnte send helpers ───

export interface SendResult {
    ok: boolean;
    status?: number;
    body?: unknown;
    error?: string;   // human-readable reason when ok=false
}

export async function sendFonnteText(to: string, message: string): Promise<SendResult> {
    const token = process.env.FONNTE_TOKEN?.trim();
    if (!token) {
        console.warn('[whatsapp] FONNTE_TOKEN not set');
        return { ok: false, error: 'FONNTE_TOKEN belum diset di environment server' };
    }

    try {
        const res = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ target: to, message }),
        });
        const body = await res.json().catch(() => null);
        // Fonnte returns HTTP 200 even on logical failure; check body.status as the source of truth.
        const fonnteOk = body && typeof body === 'object' && (body as { status?: boolean }).status === true;
        const reason = (body && typeof body === 'object' && (body as { reason?: string }).reason) || undefined;
        const ok = res.ok && fonnteOk !== false;  // if body has explicit false, fail
        return {
            ok,
            status: res.status,
            body,
            error: ok ? undefined : (reason ?? `HTTP ${res.status}${body ? ' · ' + JSON.stringify(body) : ''}`),
        };
    } catch (err) {
        console.warn('[whatsapp] Send failed:', err);
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

// Fonnte uses the same `target` parameter for personal numbers and group JIDs.
export const sendFonnteGroup = sendFonnteText;

// Send a file (PDF/image/doc) by passing a public URL. Fonnte fetches the URL server-side.
export async function sendFonnteFile(to: string, fileUrl: string, caption?: string, filename?: string): Promise<SendResult> {
    const token = process.env.FONNTE_TOKEN?.trim();
    if (!token) {
        console.warn('[whatsapp] FONNTE_TOKEN not set');
        return { ok: false, error: 'FONNTE_TOKEN belum diset di environment server' };
    }

    try {
        const payload: Record<string, string> = { target: to, url: fileUrl };
        if (caption) payload.message = caption;
        if (filename) payload.filename = filename;

        const res = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => null);
        const fonnteOk = body && typeof body === 'object' && (body as { status?: boolean }).status === true;
        const reason = (body && typeof body === 'object' && (body as { reason?: string }).reason) || undefined;
        const ok = res.ok && fonnteOk !== false;
        return {
            ok,
            status: res.status,
            body,
            error: ok ? undefined : (reason ?? `HTTP ${res.status}${body ? ' · ' + JSON.stringify(body) : ''}`),
        };
    } catch (err) {
        console.warn('[whatsapp] File send failed:', err);
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

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

// ─── Deep links & WIB time helpers ───

export function buildDeepLink(path: string, params: Record<string, string>): string {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const q = new URLSearchParams(params).toString();
    return `${base}${path}${q ? `?${q}` : ''}`;
}

// ─── Station-based deep link block for WA reminder ────────────────────────────
// Membangun block multi-baris berisi link per-station, masing-masing membawa
// operator ke tab yang sesuai tugasnya. Dipakai di template via {{links}}.
export function buildStationLinksBlock(
    mode: 'shift' | 'harian',
    date: string,
    shift?: 'pagi' | 'sore' | 'malam',
): string {
    const tabsMap = mode === 'shift' ? STATION_SHIFT_TABS : STATION_HARIAN_TABS;
    // Form harian dimount di halaman /input-shift via mode toggle, jadi link harian
    // tetap pakai path /input-shift dengan param ?mode=harian.
    const path = '/input-shift';
    const modeLabel = mode === 'shift' ? 'Laporan shift' : 'Laporan harian';

    const lines: string[] = [];
    for (const st of STATION_ORDER) {
        if (tabsMap[st].length === 0) continue; // station tidak punya tab di mode ini
        const params: Record<string, string> = { station: st, date };
        if (mode === 'shift' && shift) params.shift = shift;
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
