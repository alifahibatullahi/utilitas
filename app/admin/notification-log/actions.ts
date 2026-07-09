'use server';

import { createAdminClient } from '@/lib/whatsapp';

export interface LogRow {
    id: string;
    kind: string;
    target_date: string;
    target_shift: string | null;
    target_group: string | null;
    sent_to: string;
    payload: string | null;
    sent_at: string;
    status: 'sent' | 'failed' | null;  // null = baris lama (sebelum status dicatat)
    error: string | null;              // alasan gagal dari gateway WA
    target_label: string;  // resolved from whatsapp_groups, fallback to sent_to
}

export async function listNotifications(opts: { kind?: string; limit?: number } = {}) {
    const supabase = createAdminClient();
    const { kind = '', limit = 100 } = opts;

    let query = supabase
        .from('notification_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(limit);
    if (kind) query = query.eq('kind', kind);

    const { data: rows, error } = await query;
    if (error) return { ok: false, error: error.message, data: [] as LogRow[] };

    // Build label map from whatsapp_groups (cheap single query, cached per call).
    const { data: groups } = await supabase
        .from('whatsapp_groups')
        .select('fonnte_target, label');
    const labelMap = new Map<string, string>();
    (groups ?? []).forEach((g: { fonnte_target: string; label: string }) =>
        labelMap.set(g.fonnte_target, g.label),
    );

    const result: LogRow[] = (rows ?? []).map(r => ({
        ...(r as Omit<LogRow, 'target_label'>),
        target_label: labelMap.get(r.sent_to as string) ?? (r.sent_to as string),
    }));

    return { ok: true, data: result };
}
