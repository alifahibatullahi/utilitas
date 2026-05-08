'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EquipmentItemRow, HarScopeRow } from '@/lib/supabase/types';

export function useEquipmentItems() {
    const [items, setItems] = useState<EquipmentItemRow[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchItems = useCallback(async () => {
        const { data } = await supabase
            .from('equipment_items')
            .select('*')
            .order('no_item', { ascending: true })
            .limit(2000);
        setItems((data ?? []) as EquipmentItemRow[]);
        setLoading(false);
    }, [supabase]);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const createItem = useCallback(async (data: { no_item: string; deskripsi: string }) => {
        const { error } = await supabase.from('equipment_items').insert(data);
        if (error) return { error: error.message };
        await fetchItems();
        return { error: null };
    }, [supabase, fetchItems]);

    const updateItem = useCallback(async (id: string, data: { no_item?: string; deskripsi?: string }) => {
        const { error } = await supabase.from('equipment_items').update(data).eq('id', id);
        if (error) return { error: error.message };
        await fetchItems();
        return { error: null };
    }, [supabase, fetchItems]);

    return { items, loading, createItem, updateItem, refetch: fetchItems };
}

export function useHarScopes() {
    const [scopes, setScopes] = useState<HarScopeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchScopes = useCallback(async () => {
        const { data } = await supabase
            .from('har_scopes')
            .select('*')
            .order('sort_order', { ascending: true });
        setScopes((data ?? []) as HarScopeRow[]);
        setLoading(false);
    }, [supabase]);

    useEffect(() => { fetchScopes(); }, [fetchScopes]);

    const createScope = useCallback(async (data: { value: string; label: string }) => {
        const slug = data.value.toLowerCase().trim().replace(/\s+/g, '_');
        const { error } = await supabase.from('har_scopes').insert({
            value: slug,
            label: data.label.trim(),
            sort_order: scopes.length + 1,
        });
        if (error) return { error: error.message };
        await fetchScopes();
        return { error: null };
    }, [supabase, fetchScopes, scopes.length]);

    const updateScope = useCallback(async (id: string, data: { label?: string }) => {
        // Hanya boleh edit label, bukan value (untuk jaga konsistensi data lama)
        const patch: Record<string, string> = {};
        if (data.label !== undefined) patch.label = data.label.trim();
        const { error } = await supabase.from('har_scopes').update(patch).eq('id', id);
        if (error) return { error: error.message };
        await fetchScopes();
        return { error: null };
    }, [supabase, fetchScopes]);

    return { scopes, loading, createScope, updateScope, refetch: fetchScopes };
}
