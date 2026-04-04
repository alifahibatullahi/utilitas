'use client';

import { useState, useCallback } from 'react';
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

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const item = maintenances.find(m => m.id === event.active.id);
        if (item) setActiveItem(item);
    }, [maintenances]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        setActiveItem(null);
        const { active, over } = event;
        if (!over) return;

        // Determine the target column
        let targetStatus: MaintenanceStatus | null = null;

        // Check if dropped on a column (droppable id is the status)
        if (STATUSES.includes(over.id as MaintenanceStatus)) {
            targetStatus = over.id as MaintenanceStatus;
        } else {
            // Dropped on another card — find which column that card belongs to
            const targetCard = maintenances.find(m => m.id === over.id);
            if (targetCard) targetStatus = targetCard.status;
        }

        if (!targetStatus) return;

        const sourceItem = maintenances.find(m => m.id === active.id);
        if (!sourceItem || sourceItem.status === targetStatus) return;

        await onMoveStatus(active.id as string, targetStatus);
    }, [maintenances, onMoveStatus]);

    const sortedMaintenances = [...maintenances].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    function inWindow(updatedAt: string) {
        if (!shiftWindow) return true;
        const t = new Date(updatedAt).getTime();
        return t >= shiftWindow.start.getTime() && t <= shiftWindow.end.getTime();
    }

    // Group by status — OK only shows this shift, IP split into this shift + previous
    const columns = STATUSES.map(status => {
        if (status === 'OK') {
            return { status, items: sortedMaintenances.filter(m => m.status === 'OK' && inWindow(m.updated_at)), prevItems: [] };
        }
        if (status === 'IP') {
            const all = sortedMaintenances.filter(m => m.status === 'IP');
            return {
                status,
                items: all.filter(m => inWindow(m.updated_at)),
                prevItems: all.filter(m => !inWindow(m.updated_at)),
            };
        }
        return { status, items: sortedMaintenances.filter(m => m.status === status), prevItems: [] };
    });

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory pb-4 px-1">
                {columns.map(col => (
                    <KanbanColumn key={col.status} status={col.status} items={col.items} prevItems={col.prevItems} onKonfirmasiShift={onKonfirmasiShift} photosByMaintId={photosByMaintId} />
                ))}
            </div>
            <DragOverlay>
                {activeItem ? <KanbanCard item={activeItem} overlay /> : null}
            </DragOverlay>
        </DndContext>
    );
}
