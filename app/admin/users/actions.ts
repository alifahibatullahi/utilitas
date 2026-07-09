'use server';

import { createAdminClient } from '@/lib/whatsapp';

export async function updateOperatorPhone(id: string, phone: string | null) {
    const supabase = createAdminClient();
    const trimmed = phone?.trim() || null;
    if (trimmed && !/^628\d{8,13}$/.test(trimmed)) {
        return { ok: false, error: 'Format harus 628xxxxxxxxxx (10–15 digit, tanpa +).' };
    }
    const { error } = await supabase
        .from('operators')
        .update({ phone_number: trimmed })
        .eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

export async function listOperators() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('operators')
        .select('id, name, role, group_name, jabatan, company, phone_number')
        .order('group_name', { ascending: true })
        .order('name', { ascending: true });
    if (error) return { ok: false, error: error.message, data: [] };
    return { ok: true, data: data ?? [] };
}
