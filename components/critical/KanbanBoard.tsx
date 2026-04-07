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
import type { MaintenanceWithCritical, MaintenanceStatus, PhotoRow } from '@/lib/supabase/types';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';

interface KanbanBoardProps {
    maintenances: MaintenanceWithCritical[];
    shiftWindow?: { start: Date; end: Date };
    onMoveStatus: (id: string, newStatus: MaintenanceStatus) => Promise<{ error: string | null }>;
    onKonfirmasiShift: (id: string) => Promise<{ error: string | null }>;
    photosByMaintId?: Record<string, PhotoRow[]>;
}

const STATUSES: MaintenanceStatus[] = ['OPEN', 'IP', 'OK'];

export default function KanbanBoard({ maintenances, shiftWindow, onMoveStatus, onKonfirmasiShift, photosByMaintId }: KanbanBoardProps) {
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
                const statusItems = [...maintenances]
                    .filter(m => m.status === status)
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                const prevOrder = prev[status] || [];
                // Keep existing custom order, append any new items
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

    function inWindow(updatedAt: string) {
        if (!shiftWindow) return true;
        const t = new Date(updatedAt).getTime();
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

        if (status === 'OK') {
            return { status, items: sortedAll.filter(m => inWindow(m.updated_at)), prevItems: [] };
        }
        if (status === 'IP') {
            return {
                status,
                items: sortedAll.filter(m => inWindow(m.updated_at)),
                prevItems: sortedAll.filter(m => !inWindow(m.updated_at)),
            };
        }
        return { status, items: sortedAll, prevItems: [] };
    });

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory pb-4 px-1">
                {columns.map(col => (
                    <KanbanColumn
                        key={col.status}
                        status={col.status}
                        items={col.items}
                        prevItems={col.prevItems}
                        onKonfirmasiShift={onKonfirmasiShift}
                        photosByMaintId={photosByMaintId}
                        onMoveInColumn={(id, dir) => handleMoveInColumn(col.status, id, dir)}
                    />
                ))}
            </div>
            <DragOverlay>
                {activeItem ? <KanbanCard item={activeItem} overlay /> : null}
            </DragOverlay>
        </DndContext>
    );
}
