'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface RkapSettings {
    rkap_steam: number;
    cr_target: number;
    tahun: number;
}

function isSupabaseConfigured(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return !!url && !url.includes('YOUR_PROJECT_ID');
}

export function useAppSettings() {
    const [rkap, setRkap] = useState<RkapSettings>({ rkap_steam: 569400, cr_target: 0.210, tahun: 2025 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isSupabaseConfigured()) { setLoading(false); return; }

        const supabase = createClient();
        async function fetch() {
            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'rkap')
                .single();

            if (data?.value) {
                setRkap(data.value as RkapSettings);
            }
            setLoading(false);
        }
        fetch();
    }, []);

    const updateRkap = useCallback(async (newRkap: Partial<RkapSettings>) => {
        if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

        const supabase = createClient();
        const updated = { ...rkap, ...newRkap };
        const { error } = await supabase
            .from('app_settings')
            .update({ value: updated, updated_at: new Date().toISOString() })
            .eq('key', 'rkap');

        if (!error) setRkap(updated);
        return { error: error?.message ?? null };
    }, [rkap]);

    return { rkap, loading, updateRkap };
}

export function useStreamDays(date: string) {
    const [streamDaysA, setStreamDaysA] = useState<number>(0);
    const [streamDaysB, setStreamDaysB] = useState<number>(0);

    useEffect(() => {
        if (!isSupabaseConfigured() || !date) return;

        const supabase = createClient();
        async function fetch() {
            // Get the latest shift report for this date that has boiler data
            const { data } = await supabase
                .from('shift_reports')
                .select('id, shift, shift_boiler(boiler, stream_days)')
                .eq('date', date)
                .order('created_at', { ascending: false })
                .limit(3);

            if (data && data.length > 0) {
                // Find the latest stream_days values across all shifts of the day
                let latestA = 0;
                let latestB = 0;
                for (const sr of data) {
                    const boilers = (sr as unknown as { shift_boiler: { boiler: string; stream_days: number | null }[] }).shift_boiler ?? [];
                    for (const b of boilers) {
                        if (b.boiler === 'A' && b.stream_days != null && b.stream_days > latestA) {
                            latestA = b.stream_days;
                        }
                        if (b.boiler === 'B' && b.stream_days != null && b.stream_days > latestB) {
                            latestB = b.stream_days;
                        }
                    }
                }
                setStreamDaysA(latestA);
                setStreamDaysB(latestB);
            }
        }
        fetch();
    }, [date]);

    return { streamDaysA, streamDaysB };
}
