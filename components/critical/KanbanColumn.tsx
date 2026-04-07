'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { MaintenanceWithCritical, CriticalStatus, PhotoRow } from '@/lib/supabase/types';
import { KANBAN_COLUMNS } from '@/lib/constants';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
    status: CriticalStatus;
    items: MaintenanceWithCritical[];
    prevItems?: MaintenanceWithCritical[];
    onKonfirmasiShift?: (id: string) => Promise<{ error: string | null }>;
    photosByMaintId?: Record<string, PhotoRow[]>;
    onMoveInColumn?: (id: string, direction: 'up' | 'down') => void;
}

function PrevItemWrapper({ item, onKonfirmasi, photos }: { item: MaintenanceWithCritical; onKonfirmasi?: (id: string) => Promise<{ error: string | null }>; photos?: PhotoRow[] }) {
    const [loading, setLoading] = useState(false);
    const handleKonfirmasi = async () => {
        if (!onKonfirmasi) return;
        setLoading(true);
        await onKonfirmasi(item.id);
        setLoading(false);
    };
    return (
        <div className="relative">
            <KanbanCard item={item} photos={photos} />
            <button
                onClick={handleKonfirmasi}
                disabled={loading}
                className="mt-1 w-full flex items-center justify-center gap-1 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-extrabold transition-colors cursor-pointer disabled:opacity-50"
            >
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{loading ? 'progress_activity' : 'arrow_upward'}</span>
                {loading ? 'Memproses...' : 'Konfirmasi ke Shift Ini'}
            </button>
        </div>
    );
}

export default function KanbanColumn({ status, items, prevItems = [], onKonfirmasiShift, photosByMaintId, onMoveInColumn }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: status });
    const config = KANBAN_COLUMNS.find(c => c.id === status)!;

    function renderGroups(list: MaintenanceWithCritical[], keyPrefix = '', withControls = false) {
        const groups: { isGroup: boolean; criticalId: string | null; itemName: string | null; cards: MaintenanceWithCritical[] }[] = [];
        let current: MaintenanceWithCritical[] = [];
        list.forEach(item => {
            if (current.length === 0) {
                current.push(item);
            } else {
                const prev = current[current.length - 1];
                if (item.critical_id && prev.critical_id === item.critical_id) {
                    current.push(item);
                } else {
                    groups.push({ isGroup: current.length > 1, criticalId: current[0].critical_id, itemName: current[0].critical_equipment?.item || 'Unknown Critical', cards: current });
                    current = [item];
                }
            }
        });
        if (current.length > 0) groups.push({ isGroup: current.length > 1, criticalId: current[0].critical_id, itemName: current[0].critical_equipment?.item || 'Unknown Critical', cards: current });

        // Build flat index for numbering (based on original list position)
        const flatIndexMap = new Map<string, number>();
        list.forEach((item, idx) => flatIndexMap.set(item.id, idx));

        return groups.map((g, idx) => g.isGroup ? (
            <div key={keyPrefix + 'group-' + idx} className="bg-slate-100/70 border-2 border-slate-200/80 rounded-2xl p-2 flex flex-col gap-2 relative shadow-inner overflow-hidden">
                <div className="px-1.5 pt-0.5 flex items-center gap-1.5 opacity-80">
                    <span className="material-symbols-outlined text-blue-500" style={{ fontSize: 14 }}>layers</span>
                    <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-widest truncate">{g.itemName}</span>
                </div>
                {g.cards.map(item => {
                    const flatIdx = flatIndexMap.get(item.id) ?? 0;
                    return (
                        <KanbanCard
                            key={item.id}
                            item={item}
                            photos={photosByMaintId?.[item.id]}
                            index={flatIdx + 1}
                            isFirst={flatIdx === 0}
                            isLast={flatIdx === list.length - 1}
                            onMoveUp={withControls ? () => onMoveInColumn?.(item.id, 'up') : undefined}
                            onMoveDown={withControls ? () => onMoveInColumn?.(item.id, 'down') : undefined}
                        />
                    );
                })}
            </div>
        ) : (
            (() => {
                const item = g.cards[0];
                const flatIdx = flatIndexMap.get(item.id) ?? 0;
                return (
                    <KanbanCard
                        key={item.id}
                        item={item}
                        photos={photosByMaintId?.[item.id]}
                        index={flatIdx + 1}
                        isFirst={flatIdx === 0}
                        isLast={flatIdx === list.length - 1}
                        onMoveUp={withControls ? () => onMoveInColumn?.(item.id, 'up') : undefined}
                        onMoveDown={withControls ? () => onMoveInColumn?.(item.id, 'down') : undefined}
                    />
                );
            })()
        ));
    }

    return (
        <div className={`flex flex-col min-w-[300px] md:min-w-0 md:flex-1 rounded-2xl border-2 transition-all
            ${isOver ? `${config.borderColor} shadow-lg scale-[1.01]` : 'border-gray-200'}
            ${config.bgColor}`}
        >
            {/* Column header */}
            <div className={`${config.headerBg} rounded-t-xl px-4 py-3 flex items-center justify-between`}>
                <h3 className="text-sm font-bold text-white">{config.label}</h3>
                <span className="bg-white/30 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {items.length + prevItems.length}
                </span>
            </div>

            {/* Cards container */}
            <div
                ref={setNodeRef}
                className="flex-1 p-3 space-y-3 min-h-[200px] overflow-y-auto"
            >
                <SortableContext items={[...items, ...prevItems].map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {renderGroups(items, '', true)}

                    {/* Divider: shift sebelumnya */}
                    {prevItems.length > 0 && (
                        <>
                            <div className="flex items-center gap-2 py-1">
                                <div className="flex-1 h-px bg-gray-300" />
                                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest whitespace-nowrap">Shift Sebelumnya</span>
                                <div className="flex-1 h-px bg-gray-300" />
                            </div>
                            <div className="opacity-60 flex flex-col gap-3">
                                {prevItems.map(item => (
                                    <PrevItemWrapper key={item.id} item={item} onKonfirmasi={onKonfirmasiShift} photos={photosByMaintId?.[item.id]} />
                                ))}
                            </div>
                        </>
                    )}
                </SortableContext>

                {items.length === 0 && prevItems.length === 0 && (
                    <div className={`flex flex-col items-center justify-center py-8 ${config.textColor} opacity-50`}>
                        <span className="material-symbols-outlined text-3xl">inbox</span>
                        <span className="text-xs mt-1">Kosong</span>
                    </div>
                )}
            </div>
        </div>
    );
}
