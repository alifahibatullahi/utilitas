'use server';

import {
    createAdminClient,
    renderTemplate,
    buildDeepLink,
    buildStationLinksBlock,
    sendFonnteGroup,
    FonnteAccount,
} from '@/lib/whatsapp';

export interface TemplateRow {
    key: string;
    label: string;
    body: string;
    updated_at: string;
}

export interface PreviewVars {
    shift?: 'pagi' | 'sore' | 'malam';
    group?: string;
    date?: string;
    summary?: string;
}

/**
 * Render template body dengan variable yang sama persis seperti cron `notify-shift`.
 * Untuk template share/maintenance yang butuh {{summary}}, var summary diisi placeholder
 * teks kalau tidak dilewatkan.
 */
export async function renderTemplatePreview(key: string, overrides: PreviewVars = {}) {
    const supabase = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const date = overrides.date || today;
    const shift = overrides.shift; // bisa undefined untuk daily/share
    const group = overrides.group ?? 'A';

    // shift placeholder: kalau template butuh tapi user tidak set, pakai 'Pagi' sebagai contoh.
    const shiftLabel = shift ? shift.charAt(0).toUpperCase() + shift.slice(1) : 'Pagi';

    const isShift = key === 'shift_reminder' || key === 'shift_share';
    const linkPath = isShift ? '/input-shift' : '/laporan-harian';
    // LINK TETAP/PERMANEN — tanpa tanggal/shift (auto-resolve ke shift/hari berjalan).
    const link = buildDeepLink(linkPath, {});

    // Station links block — hanya relevan untuk reminder, tapi safe untuk semua.
    const links = buildStationLinksBlock(isShift ? 'shift' : 'harian');

    const summary = overrides.summary
        ?? '(placeholder summary — isi otomatis saat kirim dari laporan)';

    const body = await renderTemplate(supabase, key, {
        shift: shiftLabel,
        group,
        date,
        link,
        links,
        summary,
    });
    return { ok: true as const, body };
}

export async function sendTemplatePreview(target: string, key: string, overrides: PreviewVars = {}, account: FonnteAccount = 'notif') {
    if (!target) return { ok: false as const, error: 'target kosong' };
    const rendered = await renderTemplatePreview(key, overrides);
    if (!rendered.ok) return { ok: false as const, error: 'gagal render template' };
    const send = await sendFonnteGroup(target, rendered.body, account);
    return { ok: send.ok, status: send.status, body: send.body, error: send.error, preview: rendered.body };
}

export async function listTemplates() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .order('key');
    if (error) return { ok: false, error: error.message, data: [] as TemplateRow[] };
    return { ok: true, data: (data ?? []) as TemplateRow[] };
}

export async function updateTemplate(key: string, body: string) {
    const supabase = createAdminClient();
    const { error } = await supabase
        .from('notification_templates')
        .update({ body, updated_at: new Date().toISOString() })
        .eq('key', key);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
