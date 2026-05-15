'use server';

import { createAdminClient } from '@/lib/whatsapp';

export interface ScheduleRow {
    id: string;
    label: string;
    kind: string;
    shift: string | null;
    start_hour: number;
    start_minute: number;
    end_hour: number;
    end_minute: number;
    throttle_minutes: number;
    enabled: boolean;
}

export async function listSchedules() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('notification_schedule')
        .select('*')
        .order('id');
    if (error) return { ok: false, error: error.message, data: [] as ScheduleRow[] };
    return { ok: true, data: (data ?? []) as ScheduleRow[] };
}

export async function updateSchedule(id: string, patch: {
    start_hour: number;
    start_minute: number;
    end_hour: number;
    end_minute: number;
    throttle_minutes: number;
    enabled: boolean;
}) {
    const supabase = createAdminClient();
    const valid =
        patch.start_hour >= 0 && patch.start_hour <= 23 &&
        patch.end_hour >= 0 && patch.end_hour <= 47 &&
        patch.start_minute >= 0 && patch.start_minute <= 59 &&
        patch.end_minute >= 0 && patch.end_minute <= 59 &&
        patch.throttle_minutes >= 1 && patch.throttle_minutes <= 1440;
    if (!valid) return { ok: false, error: 'Nilai jam/menit/throttle di luar range valid' };
    const { error } = await supabase
        .from('notification_schedule')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
