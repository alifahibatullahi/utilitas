'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
    CriticalEquipmentRow,
    MaintenanceLogRow,
    CriticalWithMaintenance,
    MaintenanceWithCritical,
    CriticalEquipmentStatus,
    MaintenanceStatus,
    CriticalStatus,
    HarScope,
    ActivityActionType,
    PhotoRow,
} from '@/lib/supabase/types';

export interface CriticalMaintenanceFilters {
    item?: string;
    status?: CriticalStatus;
    scope?: HarScope;
    dateFrom?: string;
    dateTo?: string;
}

const STATUS_LABEL: Record<string, string> = { OPEN: 'OPEN', IP: 'In Progress', OK: 'OK', CLOSED: 'CLOSED' };
const STATUS_ORDER: Record<string, number> = { OPEN: 0, IP: 1, OK: 2, CLOSED: 3 };

// Transisi maju: ke status yang lebih tinggi
function isForwardTransition(from: string, to: string): boolean {
    return (STATUS_ORDER[to] ?? 0) > (STATUS_ORDER[from] ?? 0);
}

// Hapus log milestone untuk status tertentu (critical atau maintenance)
async function deleteMilestoneLog(
    supabase: ReturnType<typeof createClient>,
    criticalId: string,
    targetStatus: string,
    maintenanceId?: string
) {
    const actionType = maintenanceId ? 'maintenance_updated' : 'status_changed';
    let query = supabase
        .from('critical_activity_logs')
        .delete()
        .eq('critical_id', criticalId)
        .eq('action_type', actionType)
        .filter('metadata->>new_status', 'eq', targetStatus);
    if (maintenanceId) {
        query = query.filter('metadata->>maintenance_id', 'eq', maintenanceId);
    }
    await query;
}

// Hapus semua milestone log di atas status tujuan (untuk transisi mundur)
async function deleteForwardMilestonesAbove(
    supabase: ReturnType<typeof createClient>,
    criticalId: string,
    aboveStatus: string,
    maintenanceId?: string
) {
    const toDelete = ['IP', 'OK', 'CLOSED'].filter(
        s => (STATUS_ORDER[s] ?? 0) > (STATUS_ORDER[aboveStatus] ?? 0)
    );
    for (const s of toDelete) {
        await deleteMilestoneLog(supabase, criticalId, s, maintenanceId);
    }
}

// Standalone helper - logs silently, failure does not block main operation
async function insertActivityLog(
    supabase: ReturnType<typeof createClient>,
    criticalId: string,
    actionType: ActivityActionType,
    description: string,
    actor: string | null = null,
    metadata: Record<string, unknown> | null = null
) {
    await supabase.from('critical_activity_logs').insert({
        critical_id: criticalId,
        action_type: actionType,
        description,
        actor,
        metadata,
    });
}

export function useCriticalMaintenance() {
    const [criticals, setCriticals] = useState<CriticalWithMaintenance[]>([]);
    const [maintenances, setMaintenances] = useState<MaintenanceWithCritical[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClient();

    // ─── Fetch all data ───
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: critData, error: critErr } = await supabase
                .from('critical_equipment')
                .select('*, maintenance_logs(*), critical_activity_logs(*)')
                .order('created_at', { ascending: false });

            if (critErr) throw critErr;

            const { data: maintData, error: maintErr } = await supabase
                .from('maintenance_logs')
                .select('*, critical_equipment(*)')
                .order('created_at', { ascending: false });

            if (maintErr) throw maintErr;

            setCriticals((critData ?? []) as CriticalWithMaintenance[]);
            setMaintenances((maintData ?? []) as MaintenanceWithCritical[]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Gagal memuat data');
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Silent background sync (no loading state, for optimistic flows) ───
    const silentFetch = useCallback(async () => {
        try {
            const { data: critData, error: critErr } = await supabase
                .from('critical_equipment')
                .select('*, maintenance_logs(*), critical_activity_logs(*)')
                .order('created_at', { ascending: false });
            if (critErr) return;
            const { data: maintData, error: maintErr } = await supabase
                .from('maintenance_logs')
                .select('*, critical_equipment(*)')
                .order('created_at', { ascending: false });
            if (maintErr) return;
            setCriticals((critData ?? []) as CriticalWithMaintenance[]);
            setMaintenances((maintData ?? []) as MaintenanceWithCritical[]);
        } catch { /* silent */ }
    }, [supabase]);

    // ─── Filter helpers ───
    const filterCriticals = useCallback((filters: CriticalMaintenanceFilters) => {
        return criticals.filter(c => {
            if (filters.item && !c.item.toLowerCase().includes(filters.item.toLowerCase())) return false;
            if (filters.status && c.status !== filters.status) return false;
            if (filters.scope && c.scope !== filters.scope) return false;
            if (filters.dateFrom && c.date < filters.dateFrom) return false;
            if (filters.dateTo && c.date > filters.dateTo) return false;
            return true;
        });
    }, [criticals]);

    const filterMaintenances = useCallback((filters: CriticalMaintenanceFilters) => {
        return maintenances.filter(m => {
            if (filters.item && !m.item.toLowerCase().includes(filters.item.toLowerCase())) return false;
            if (filters.status && m.status !== filters.status) return false;
            if (filters.scope && m.scope !== filters.scope) return false;
            if (filters.dateFrom && m.date < filters.dateFrom) return false;
            if (filters.dateTo && m.date > filters.dateTo) return false;
            return true;
        });
    }, [maintenances]);

    // ─── CRUD Critical ───
    const createCritical = useCallback(async (data: Omit<CriticalEquipmentRow, 'id' | 'created_at' | 'updated_at'>) => {
        const { data: newCrit, error: err } = await supabase
            .from('critical_equipment')
            .insert(data)
            .select('id')
            .single();
        if (err) return { error: err.message };
        if (newCrit) {
            await insertActivityLog(
                supabase, newCrit.id, 'created',
                `Critical dilaporkan: ${data.item}`,
                data.reported_by ?? null
            );
        }
        await fetchData();
        return { error: null };
    }, [supabase, fetchData]);

    const updateCritical = useCallback(async (id: string, data: Partial<CriticalEquipmentRow>, actor?: string | null) => {
        const oldCritical = criticals.find(c => c.id === id);
        // Optimistic update
        setCriticals(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
        const { error: err } = await supabase.from('critical_equipment').update(data).eq('id', id);
        if (err) {
            await fetchData(); // rollback
            return { error: err.message };
        }
        if (data.status && oldCritical && data.status !== oldCritical.status) {
            if (isForwardTransition(oldCritical.status, data.status)) {
                await deleteMilestoneLog(supabase, id, data.status);
                await insertActivityLog(
                    supabase, id, 'status_changed',
                    `Status diubah: ${STATUS_LABEL[oldCritical.status]} → ${STATUS_LABEL[data.status]}`,
                    actor ?? null,
                    { old_status: oldCritical.status, new_status: data.status }
                );
            } else {
                await deleteForwardMilestonesAbove(supabase, id, data.status);
            }
        }
        await silentFetch();
        return { error: null };
    }, [supabase, fetchData, silentFetch, criticals]);

    const deleteCritical = useCallback(async (id: string) => {
        // Hapus maintenance & activity logs terkait terlebih dahulu
        await supabase.from('maintenance_logs').delete().eq('critical_id', id);
        await supabase.from('critical_activity_logs').delete().eq('critical_id', id);
        const { error: err } = await supabase.from('critical_equipment').delete().eq('id', id);
        if (err) return { error: err.message };
        await fetchData();
        return { error: null };
    }, [supabase, fetchData]);

    // ─── CRUD Maintenance ───
    const createMaintenance = useCallback(async (data: Omit<MaintenanceLogRow, 'id' | 'created_at' | 'updated_at'>) => {
        const { error: err } = await supabase.from('maintenance_logs').insert(data);
        if (err) return { error: err.message };
        if (data.critical_id) {
            await insertActivityLog(
                supabase, data.critical_id, 'maintenance_added',
                `Maintenance ditambahkan: ${data.uraian}`,
                data.reported_by ?? null,
                { maintenance_item: data.item }
            );
        }
        await fetchData();
        return { error: null };
    }, [supabase, fetchData]);

    const updateMaintenance = useCallback(async (id: string, data: Partial<MaintenanceLogRow>, actor?: string | null) => {
        const oldMaint = maintenances.find(m => m.id === id);
        // Optimistic update
        setMaintenances(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
        setCriticals(prev => prev.map(c => ({
            ...c,
            maintenance_logs: c.maintenance_logs.map(m => m.id === id ? { ...m, ...data } : m),
        })));
        const { error: err } = await supabase.from('maintenance_logs').update(data).eq('id', id);
        if (err) {
            await fetchData(); // rollback
            return { error: err.message };
        }
        if (data.status && oldMaint?.critical_id && data.status !== oldMaint.status) {
            if (isForwardTransition(oldMaint.status, data.status)) {
                await deleteMilestoneLog(supabase, oldMaint.critical_id, data.status, id);
                await insertActivityLog(
                    supabase, oldMaint.critical_id, 'maintenance_updated',
                    `Status maintenance '${oldMaint.uraian}': ${STATUS_LABEL[oldMaint.status]} → ${STATUS_LABEL[data.status]}`,
                    actor ?? null,
                    { old_status: oldMaint.status, new_status: data.status, maintenance_id: id }
                );
            } else {
                await deleteForwardMilestonesAbove(supabase, oldMaint.critical_id, data.status, id);
            }
        }
        await silentFetch();
        return { error: null };
    }, [supabase, fetchData, silentFetch, maintenances]);

    const deleteMaintenance = useCallback(async (id: string, actor?: string | null) => {
        const oldMaint = maintenances.find(m => m.id === id);
        const { error: err } = await supabase.from('maintenance_logs').delete().eq('id', id);
        if (err) return { error: err.message };
        if (oldMaint?.critical_id) {
            await insertActivityLog(
                supabase, oldMaint.critical_id, 'maintenance_deleted',
                `Maintenance '${oldMaint.uraian}' dihapus`,
                actor ?? null
            );
        }
        await fetchData();
        return { error: null };
    }, [supabase, fetchData, maintenances]);

    // ─── Kanban move (optimistic update) ───
    const moveMaintenanceStatus = useCallback(async (id: string, newStatus: MaintenanceStatus, actor?: string | null) => {
        const oldMaint = maintenances.find(m => m.id === id);
        // Optimistic update
        setMaintenances(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
        setCriticals(prev => prev.map(c => ({
            ...c,
            maintenance_logs: c.maintenance_logs.map(m => m.id === id ? { ...m, status: newStatus } : m),
        })));

        const { error: err } = await supabase.from('maintenance_logs').update({ status: newStatus }).eq('id', id);
        if (err) {
            await fetchData(); // rollback
            return { error: err.message };
        }
        if (oldMaint?.critical_id && oldMaint.status !== newStatus) {
            if (isForwardTransition(oldMaint.status, newStatus)) {
                await deleteMilestoneLog(supabase, oldMaint.critical_id, newStatus, id);
                await insertActivityLog(
                    supabase, oldMaint.critical_id, 'maintenance_updated',
                    `Status maintenance '${oldMaint.uraian}': ${STATUS_LABEL[oldMaint.status]} → ${STATUS_LABEL[newStatus]}`,
                    actor ?? null,
                    { old_status: oldMaint.status, new_status: newStatus, maintenance_id: id }
                );
            } else {
                await deleteForwardMilestonesAbove(supabase, oldMaint.critical_id, newStatus, id);
            }
            await silentFetch();
        }
        return { error: null };
    }, [supabase, fetchData, silentFetch, maintenances]);

    const moveCriticalStatus = useCallback(async (id: string, newStatus: CriticalEquipmentStatus, actor?: string | null) => {
        const oldCritical = criticals.find(c => c.id === id);
        setCriticals(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));

        const { error: err } = await supabase.from('critical_equipment').update({ status: newStatus }).eq('id', id);
        if (err) {
            await fetchData(); // rollback
            return { error: err.message };
        }
        if (oldCritical && oldCritical.status !== newStatus) {
            if (isForwardTransition(oldCritical.status, newStatus)) {
                await deleteMilestoneLog(supabase, id, newStatus);
                await insertActivityLog(
                    supabase, id, 'status_changed',
                    `Status diubah: ${STATUS_LABEL[oldCritical.status]} → ${STATUS_LABEL[newStatus]}`,
                    actor ?? null,
                    { old_status: oldCritical.status, new_status: newStatus }
                );
            } else {
                await deleteForwardMilestonesAbove(supabase, id, newStatus);
            }
            await silentFetch();
        }
        return { error: null };
    }, [supabase, fetchData, silentFetch, criticals]);

    // ─── Konfirmasi maintenance ke shift ini (touch updated_at) ───
    const konfirmasiShift = useCallback(async (id: string) => {
        const maint = maintenances.find(m => m.id === id);
        if (!maint) return { error: 'Tidak ditemukan' };
        // Optimistic: update updated_at locally so card moves to "Shift ini"
        const now = new Date().toISOString();
        setMaintenances(prev => prev.map(m => m.id === id ? { ...m, updated_at: now } : m));
        // Touch the record in DB — triggers updated_at via DB trigger
        const { error: err } = await supabase.from('maintenance_logs').update({ status: maint.status }).eq('id', id);
        if (err) {
            await fetchData();
            return { error: err.message };
        }
        await silentFetch();
        return { error: null };
    }, [supabase, fetchData, silentFetch, maintenances]);

    // ─── Add manual activity note ───
    const addActivityNote = useCallback(async (criticalId: string, note: string, actor?: string | null) => {
        const { error: err } = await supabase.from('critical_activity_logs').insert({
            critical_id: criticalId,
            action_type: 'note',
            description: note,
            actor: actor ?? null,
        });
        if (err) return { error: err.message };
        await fetchData();
        return { error: null };
    }, [supabase, fetchData]);

    // ─── Photos ───

    const fetchPhotos = useCallback(async (
        parentType: 'critical' | 'maintenance',
        parentId: string,
    ): Promise<PhotoRow[]> => {
        const column = parentType === 'critical' ? 'critical_id' : 'maintenance_id';
        const { data, error: err } = await supabase
            .from('photos')
            .select('*')
            .eq(column, parentId)
            .order('created_at', { ascending: true });
        if (err) {
            console.error('[fetchPhotos]', err.message);
            return [];
        }
        return (data ?? []) as PhotoRow[];
    }, [supabase]);

    const deletePhoto = useCallback(async (photoId: string): Promise<{ error: string | null }> => {
        const res = await fetch(`/api/upload/${photoId}`, { method: 'DELETE' });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            return { error: (json as { error?: string }).error ?? 'Hapus foto gagal' };
        }
        return { error: null };
    }, []);

    /** Batch fetch photos for a list of maintenance IDs — returns a map of maintId → PhotoRow[] */
    const fetchPhotosForMaintList = useCallback(async (maintIds: string[]): Promise<Record<string, PhotoRow[]>> => {
        if (maintIds.length === 0) return {};
        const { data, error: err } = await supabase
            .from('photos')
            .select('*')
            .in('maintenance_id', maintIds)
            .order('created_at', { ascending: true });
        if (err || !data) return {};
        const map: Record<string, PhotoRow[]> = {};
        for (const photo of (data as PhotoRow[])) {
            if (!photo.maintenance_id) continue;
            if (!map[photo.maintenance_id]) map[photo.maintenance_id] = [];
            map[photo.maintenance_id].push(photo);
        }
        return map;
    }, [supabase]);

    return {
        criticals,
        maintenances,
        loading,
        error,
        refetch: fetchData,
        filterCriticals,
        filterMaintenances,
        createCritical,
        updateCritical,
        deleteCritical,
        createMaintenance,
        updateMaintenance,
        deleteMaintenance,
        moveMaintenanceStatus,
        moveCriticalStatus,
        konfirmasiShift,
        addActivityNote,
        fetchPhotos,
        deletePhoto,
        fetchPhotosForMaintList,
    };
}
