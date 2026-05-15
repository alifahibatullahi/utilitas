'use server';

import { createAdminClient } from '@/lib/whatsapp';

export interface TemplateRow {
    key: string;
    label: string;
    body: string;
    updated_at: string;
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
