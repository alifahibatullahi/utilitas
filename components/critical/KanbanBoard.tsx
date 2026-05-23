'use client';

import { useState, useCallback, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import type { MaintenanceWithCritical, MaintenanceStatus, PhotoRow, WorkOrderWithPekerjaan } from '@/lib/supabase/types';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';

interface KanbanBoardProps {
    maintenances: MaintenanceWithCritical[];
    shiftWindow?: { start: Date; end: Date };
    onMoveStatus: (id: string, newStatus: MaintenanceStatus) => Promise<{ error: string | null }>;
    onKonfirmasiShift: (id: string) => Promise<{ error: string | null }>;
    photosByMaintId?: Record<string, PhotoRow[]>;
    /** Per-maintenance ISO timestamp of when status reached current value (sourced from activity logs). */
    statusTimeByMaintId?: Record<string, string>;
    /** Per-maintenance actor untuk status IP & OK (sourced from activity logs). */
    statusActorByMaintId?: Record<string, { ip?: string; ok?: string }>;
    /** Date string (YYYY-MM-DD) — OPEN dengan date > boardDate akan dihide (future, belum relevan). */
    boardDate?: string;
    /** Shift yang dilihat sekarang — untuk deteksi status "dari shift sebelumnya" pada card. */
    boardShift?: 'pagi' | 'sore' | 'malam';
    /** Search query, hanya difilter pada kolom OPEN. */
    openSearch?: string;
    onOpenSearchChange?: (q: string) => void;
    /** Maintenance IDs yang sudah ter-assign ke shift sekarang (date+shift yang dilihat). */
    assignedToCurrentShiftIds?: Set<string>;
    /** Handler untuk batal Lanjut Kerja: hapus assignment dari shift sekarang. */
    onUnassignCurrentShift?: (id: string) => Promise<{ error: string | null }>;
    /** Read-only mode (mis. shift sudah lewat) — disable DnD + Lanjut Kerja button. */
    readOnly?: boolean;
    workOrders?: WorkOrderWithPekerjaan[];
    onOpenDetail?: (id: string, type: 'critical' | 'preventif' | 'modifikasi') => void;
}

const STATUSES: MaintenanceStatus[] = ['OPEN', 'IP', 'OK'];

export default function KanbanBoard({ maintenances, shiftWindow, onMoveStatus, onKonfirmasiShift, photosByMaintId, statusTimeByMaintId, statusActorByMaintId, boardDate, boardShift, openSearch, onOpenSearchChange, assignedToCurrentShiftIds, onUnassignCurrentShift, readOnly = false, workOrders, onOpenDetail }: KanbanBoardProps) {
    const [activeItem, setActiveItem] = useState<MaintenanceWithCritical | null>(null);
    const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>({});

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    );

    // Sync columnOrders when maintenances change (new items or status changes)
    useEffect(() => {
        setColumnOrders(prev => {
            const next: Record<string, string[]> = {};
            STATUSES.forEach(status => {
                // OPEN: sort by item asc (item sama bersebelahan), then by created_at
                // IP/OK: sort by created_at saja (custom order via drag tetap dihormati di prevOrder)
                const statusItems = [...maintenances]
                    .filter(m => m.status === status)
                    .sort((a, b) => {
                        if (status === 'OPEN') {
                            const itemCmp = a.item.localeCompare(b.item);
                            if (itemCmp !== 0) return itemCmp;
                        }
                        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    });
                const prevOrder = prev[status] || [];
                // OPEN: ALWAYS pakai sort by item (ignore custom order biar item sama tetap bersebelahan)
                if (status === 'OPEN') {
                    next[status] = statusItems.map(m => m.id);
                    return;
                }
                // Keep existing custom order untuk IP/OK, append any new items
                const stillPresent = prevOrder.filter(id => statusItems.find(m => m.id === id));
                const newIds = statusItems.filter(m => !prevOrder.includes(m.id)).map(m => m.id);
                next[status] = [...stillPresent, ...newIds];
            });
            return next;
        });
    }, [maintenances]);

    const handleMoveInColumn = useCallback((status: string, id: string, direction: 'up' | 'down') => {
        setColumnOrders(prev => {
            const order = [...(prev[status] || [])];
            const idx = order.indexOf(id);
            if (idx === -1) return prev;
            const newIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= order.length) return prev;
            [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
            return { ...prev, [status]: order };
        });
    }, []);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const item = maintenances.find(m => m.id === event.active.id);
        if (item) setActiveItem(item);
    }, [maintenances]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        setActiveItem(null);
        if (readOnly) return; // shift sudah lewat → tidak boleh ubah status
        const { active, over } = event;
        if (!over) return;

        let targetStatus: MaintenanceStatus | null = null;
        if (STATUSES.includes(over.id as MaintenanceStatus)) {
            targetStatus = over.id as MaintenanceStatus;
        } else {
            const targetCard = maintenances.find(m => m.id === over.id);
            if (targetCard) targetStatus = targetCard.status;
        }

        if (!targetStatus) return;

        const sourceItem = maintenances.find(m => m.id === active.id);
        if (!sourceItem || sourceItem.status === targetStatus) return;

        await onMoveStatus(active.id as string, targetStatus);
    }, [maintenances, onMoveStatus]);

    function inWindow(iso: string) {
        if (!shiftWindow) return true;
        const t = new Date(iso).getTime();
        return t >= shiftWindow.start.getTime() && t <= shiftWindow.end.getTime();
    }

    // Build columns using columnOrders for sorting
    const columns = STATUSES.map(status => {
        const order = columnOrders[status] || [];
        const allStatusItems = maintenances.filter(m => m.status === status);
        // Sort by custom order
        const sortedAll = [
            ...order.map(id => allStatusItems.find(m => m.id === id)).filter(Boolean) as MaintenanceWithCritical[],
            ...allStatusItems.filter(m => !order.includes(m.id)),
        ];

        // IP/OK items = updated_at di window shift sekarang → match dengan laporan shift.
        // Untuk IP, juga tampilkan prevItems (IP yang updated_at di luar window) sebagai carry-forward —
        // visible dengan tombol "Lanjut Kerja" untuk dimasukkan ke laporan shift kalau dikerjakan di shift ini.
        // OK tidak punya prevItems (sudah selesai, tidak perlu carry-forward).
        if (status === 'OK') {
            const items = sortedAll.filter(m => inWindow(m.updated_at));
            return { status, items, prevItems: [], hiddenFuture: 0 };
        }
        if (status === 'IP') {
            const items = sortedAll.filter(m => inWindow(m.updated_at));
            const prevItems = sortedAll.filter(m => !inWindow(m.updated_at));
            return { status, items, prevItems, hiddenFuture: 0 };
        }
        // OPEN: filter berdasarkan search query (jika ada) + date <= boardDate (kalau search kosong)
        // Saat board dikunci (readOnly = past shift): tampilkan SEMUA OPEN tanpa filter date —
        // user perlu lihat semua context backlog, tidak ada lagi yang bisa diubah.
        const q = (openSearch ?? '').trim().toLowerCase();
        const searchedOpen = q
            ? sortedAll.filter(m =>
                m.item.toLowerCase().includes(q)
                || m.uraian.toLowerCase().includes(q)
                || (m.notif ?? '').toLowerCase().includes(q),
            )
            : sortedAll;
        const applyDateFilter = boardDate && !readOnly;
        const visibleOpen = applyDateFilter ? searchedOpen.filter(m => m.date <= boardDate) : searchedOpen;
        const hiddenFuture = searchedOpen.length - visibleOpen.length;
        return { status, items: visibleOpen, prevItems: [], hiddenFuture };
    });

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-2 md:gap-3 overflow-x-auto snap-x snap-mandatory pb-2 px-1">
                {columns.map(col => (
                    <KanbanColumn
                        key={col.status}
                        status={col.status}
                        items={col.items}
                        prevItems={col.prevItems}
                        hiddenFuture={col.hiddenFuture}
                        onKonfirmasiShift={readOnly ? undefined : onKonfirmasiShift}
                        photosByMaintId={photosByMaintId}
                        statusTimeByMaintId={statusTimeByMaintId}
                        statusActorByMaintId={statusActorByMaintId}
                        onMoveInColumn={(id, dir) => handleMoveInColumn(col.status, id, dir)}
                        onUnassignCurrentShift={onUnassignCurrentShift}
                        boardDate={boardDate}
                        boardShift={boardShift}
                        readOnly={readOnly}
                        workOrders={workOrders}
                        onOpenDetail={onOpenDetail}
                        headerExtra={col.status === 'OPEN' && onOpenSearchChange ? (
                            <div className="px-3 pt-2">
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" style={{ fontSize: 14 }}>search</span>
                                    <input
                                        type="text"
                                        value={openSearch ?? ''}
                                        onChange={e => onOpenSearchChange(e.target.value)}
                                        placeholder="Cari di Open…"
                                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>
                        ) : null}
                    />
                ))}
            </div>
            <DragOverlay>
                {activeItem ? <KanbanCard item={activeItem} overlay /> : null}
            </DragOverlay>
        </DndContext>
    );
}
