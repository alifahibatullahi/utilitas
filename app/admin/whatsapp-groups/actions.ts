'use server';

import { createAdminClient, sendFonnteGroup, FonnteAccount } from '@/lib/whatsapp';

export interface WhatsappGroupRow {
    id: string;
    key: string;
    label: string;
    fonnte_target: string;
    is_group: boolean;
    active: boolean;
}

export async function listGroups() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .order('key');
    if (error) return { ok: false, error: error.message, data: [] as WhatsappGroupRow[] };
    return { ok: true, data: (data ?? []) as WhatsappGroupRow[] };
}

export async function upsertGroup(input: {
    id?: string;
    key: string;
    label: string;
    fonnte_target: string;
    is_group: boolean;
    active: boolean;
}) {
    const supabase = createAdminClient();
    if (!input.key || !input.label || !input.fonnte_target) {
        return { ok: false, error: 'key, label, fonnte_target wajib diisi' };
    }
    const payload = {
        key: input.key,
        label: input.label,
        fonnte_target: input.fonnte_target,
        is_group: input.is_group,
        active: input.active,
        updated_at: new Date().toISOString(),
    };
    const { error } = input.id
        ? await supabase.from('whatsapp_groups').update(payload).eq('id', input.id)
        : await supabase.from('whatsapp_groups').insert(payload);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

export async function deleteGroup(id: string) {
    const supabase = createAdminClient();
    const { error } = await supabase.from('whatsapp_groups').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

export async function testSend(target: string, account: FonnteAccount = 'notif') {
    if (!target) return { ok: false, error: 'target kosong' };
    const send = await sendFonnteGroup(target, '✅ Test PowerOps WhatsApp — koneksi OK.', account);
    return { ok: send.ok, status: send.status, body: send.body, error: send.error };
}

// Generic send — for the Test Send hub panel, supports raw number/JID + custom message.
export async function sendCustomMessage(target: string, message: string, account: FonnteAccount = 'notif') {
    if (!target) return { ok: false, error: 'target kosong' };
    if (!message?.trim()) return { ok: false, error: 'pesan kosong' };
    const send = await sendFonnteGroup(target, message, account);
    return { ok: send.ok, status: send.status, body: send.body, error: send.error };
}
