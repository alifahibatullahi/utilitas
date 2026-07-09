'use server';

import { createAdminClient } from '@/lib/whatsapp';

export interface OpenMaintenanceRow {
    id: string;
    date: string;
    item: string;
    uraian: string;
    scope: string;
    foreman: string;
    notif: string | null;
}

export async function listOpenMaintenance() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('maintenance_logs')
        .select('id, date, item, uraian, scope, foreman, notif')
        .eq('status', 'OPEN')
        .order('date', { ascending: false });
    if (error) return { ok: false, error: error.message, data: [] as OpenMaintenanceRow[] };
    return { ok: true, data: (data ?? []) as OpenMaintenanceRow[] };
}

export async function listGroupKeys() {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from('whatsapp_groups')
        .select('key, label, fonnte_target')
        .eq('active', true)
        .order('key');
    return data ?? [];
}
