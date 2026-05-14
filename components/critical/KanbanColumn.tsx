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
    hiddenFuture?: number;
    onKonfirmasiShift?: (id: string) => Promise<{ error: string | null }>;
    photosByMaintId?: Record<string, PhotoRow[]>;
    onMoveInColumn?: (id: string, direction: 'up' | 'down') => void;
    statusTimeByMaintId?: Record<string, string>;
    /** Optional slot dirender di bawah column header (mis. search input). */
    headerExtra?: React.ReactNode;
    /** Handler batalkan assignment dari shift sekarang (akan ditampilkan untuk card di items kolom IP/OK). */
    onUnassignCurrentShift?: (id: string) => Promise<{ error: string | null }>;
}

function PrevItemWrapper({ item, onKonfirmasi, photos, statusTimeIso }: { item: MaintenanceWithCritical; onKonfirmasi?: (id: string) => Promise<{ error: string | null }>; photos?: PhotoRow[]; statusTimeIso?: string }) {
    const [loading, setLoading] = useState(false);
    const handleKonfirmasi = async () => {
        if (!onKonfirmasi) return;
        setLoading(true);
        await onKonfirmasi(item.id);
        setLoading(false);
    };
    return (
        <div className="relative opacity-80 hover:opacity-100 transition-opacity">
            <KanbanCard item={item} photos={photos} statusTimeIso={statusTimeIso} />
            <button
                onClick={handleKonfirmasi}
                disabled={loading}
                className="mt-1 w-full flex items-center justify-center gap-1 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200 transition-colors cursor-pointer disabled:opacity-50"
                title="Tandai ada pekerjaan di shift ini → maintenance masuk laporan shift"
            >
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{loading ? 'progress_activity' : 'add_task'}</span>
                {loading ? 'Memproses…' : '+ Lanjut Kerja di Shift Ini'}
            </button>
        </div>
    );
}

function AssignedItemWrapper({ item, photos, statusTimeIso, onUnassign }: { item: MaintenanceWithCritical; photos?: PhotoRow[]; statusTimeIso?: string; onUnassign: (id: string) => Promise<{ error: string | null }> }) {
    const [loading, setLoading] = useState(false);
    return (
        <div>
            <KanbanCard item={item} photos={photos} statusTimeIso={statusTimeIso} />
            <button
                onClick={async () => {
                    if (!confirm('Batalkan "Lanjut Kerja" — maintenance ini akan dihapus dari laporan shift sekarang. Lanjut?')) return;
                    setLoading(true);
                    await onUnassign(item.id);
                    setLoading(false);
                }}
                disabled={loading}
                className="mt-1 w-full flex items-center justify-center gap-1 py-0.5 rounded text-rose-600 hover:bg-rose-50 text-[9px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                title="Batalkan: hapus dari laporan shift sekarang"
            >
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{loading ? 'progress_activity' : 'undo'}</span>
                {loading ? 'Memproses…' : 'Batalkan dari shift ini'}
            </button>
        </div>
    );
}

export default function KanbanColumn({ status, items, prevItems = [], hiddenFuture = 0, onKonfirmasiShift, photosByMaintId, onMoveInColumn, statusTimeByMaintId, headerExtra, onUnassignCurrentShift }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: status });
    const config = KANBAN_COLUMNS.find(c => c.id === status)!;

    // Tombol Batalkan ditampilkan untuk card di items kolom IP/OK (yang ter-assign ke shift sekarang)
    const showUnassignFor = (status === 'IP' || status === 'OK') && !!onUnassignCurrentShift;

    function renderCardOrWrapper(item: MaintenanceWithCritical, flatIdx: number, totalLen: number, withControls: boolean) {
        if (showUnassignFor && onUnassignCurrentShift) {
            return (
                <AssignedItemWrapper
                    key={item.id}
                    item={item}
                    photos={photosByMaintId?.[item.id]}
                    statusTimeIso={statusTimeByMaintId?.[item.id]}
                    onUnassign={onUnassignCurrentShift}
                />
            );
        }
        return (
            <div key={item.id}>
                <KanbanCard
                    item={item}
                    photos={photosByMaintId?.[item.id]}
                    statusTimeIso={statusTimeByMaintId?.[item.id]}
                    index={flatIdx + 1}
                    isFirst={flatIdx === 0}
                    isLast={flatIdx === totalLen - 1}
                    onMoveUp={withControls ? () => onMoveInColumn?.(item.id, 'up') : undefined}
                    onMoveDown={withControls ? () => onMoveInColumn?.(item.id, 'down') : undefined}
                />
            </div>
        );
    }

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
                    return renderCardOrWrapper(item, flatIdx, list.length, withControls);
                })}
            </div>
        ) : (
            (() => {
                const item = g.cards[0];
                const flatIdx = flatIndexMap.get(item.id) ?? 0;
                return renderCardOrWrapper(item, flatIdx, list.length, withControls);
            })()
        ));
    }

    return (
        <div className={`flex flex-col min-w-[260px] md:min-w-0 md:flex-1 rounded-xl border transition-all
            ${isOver ? `${config.borderColor} shadow-md scale-[1.01]` : 'border-gray-200'}
            ${config.bgColor}`}
        >
            {/* Column header */}
            <div className={`${config.headerBg} rounded-t-lg px-3 py-2 flex items-center justify-between`}>
                <h3 className="text-xs font-bold text-white">{config.label}</h3>
                <span className="bg-white/30 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {items.length + prevItems.length}
                </span>
            </div>

            {headerExtra}

            {/* Cards container */}
            <div
                ref={setNodeRef}
                className="flex-1 p-2 space-y-1.5 min-h-[160px] overflow-y-auto light-scrollbar"
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
                                    <PrevItemWrapper key={item.id} item={item} onKonfirmasi={onKonfirmasiShift} photos={photosByMaintId?.[item.id]} statusTimeIso={statusTimeByMaintId?.[item.id]} />
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

                {hiddenFuture > 0 && (
                    <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-100 border border-dashed border-slate-300 text-[11px] font-bold text-slate-500" title="Maintenance dengan tanggal di masa depan tidak ditampilkan untuk fokus pada backlog & hari ini">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                        +{hiddenFuture} dijadwalkan untuk tanggal mendatang
                    </div>
                )}
            </div>
        </div>
    );
}
