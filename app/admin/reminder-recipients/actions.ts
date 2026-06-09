'use server';

import { createAdminClient, sendWaText } from '@/lib/whatsapp';

export interface ReminderRecipientRow {
    id: string;
    group_letter: 'A' | 'B' | 'C' | 'D';
    name: string;
    phone_number: string;
    active: boolean;
}

/** Daftar penerima pribadi reminder (per grup). Diurutkan grup lalu nama. */
export async function listRecipients() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('whatsapp_reminder_recipients')
        .select('id, group_letter, name, phone_number, active')
        .order('group_letter')
        .order('name');
    if (error) return { ok: false, error: error.message, data: [] as ReminderRecipientRow[] };
    return { ok: true, data: (data ?? []) as ReminderRecipientRow[] };
}

// Normalisasi nomor ke format Wablas/Fonnte: buang spasi/strip/+, '0' awal → '62'.
function normalizePhone(raw: string): string {
    let p = raw.replace(/[\s\-()+]/g, '');
    if (p.startsWith('0')) p = '62' + p.slice(1);
    return p;
}

export async function upsertRecipient(input: {
    id?: string;
    group_letter: string;
    name: string;
    phone_number: string;
    active: boolean;
}) {
    const supabase = createAdminClient();
    const group = input.group_letter?.trim().toUpperCase();
    const name = input.name?.trim();
    const phone = normalizePhone(input.phone_number ?? '');
    if (!group || !['A', 'B', 'C', 'D'].includes(group)) return { ok: false, error: 'Grup wajib A/B/C/D' };
    if (!name) return { ok: false, error: 'Nama wajib diisi' };
    if (!/^62\d{7,15}$/.test(phone)) return { ok: false, error: 'Nomor tidak valid (format 628xxxxxxxxxx)' };
    const payload = {
        group_letter: group,
        name,
        phone_number: phone,
        active: input.active,
        updated_at: new Date().toISOString(),
    };
    const { error } = input.id
        ? await supabase.from('whatsapp_reminder_recipients').update(payload).eq('id', input.id)
        : await supabase.from('whatsapp_reminder_recipients').insert(payload);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

export async function deleteRecipient(id: string) {
    const supabase = createAdminClient();
    const { error } = await supabase.from('whatsapp_reminder_recipients').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

/** Test kirim ke 1 nomor pribadi (via Wablas, akun notif). */
export async function testSendRecipient(phone: string) {
    if (!phone) return { ok: false, error: 'nomor kosong' };
    const send = await sendWaText(normalizePhone(phone), '✅ Test PowerOps — reminder pribadi OK.');
    return { ok: send.ok, status: send.status, error: send.error };
}
