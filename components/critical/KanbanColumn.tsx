'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { MaintenanceWithCritical, CriticalStatus, PhotoRow, WorkOrderWithPekerjaan } from '@/lib/supabase/types';
import { KANBAN_COLUMNS } from '@/lib/constants';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
    status: 'OPEN' | 'IP' | 'IP_PREV' | 'OK' | 'CLOSED';
    items: MaintenanceWithCritical[];
    prevItems?: MaintenanceWithCritical[];
    hiddenFuture?: number;
    onKonfirmasiShift?: (id: string) => Promise<{ error: string | null }>;
    photosByMaintId?: Record<string, PhotoRow[]>;
    onMoveInColumn?: (id: string, direction: 'up' | 'down') => void;
    statusTimeByMaintId?: Record<string, string>;
    statusActorByMaintId?: Record<string, { ip?: string; ok?: string }>;
    /** Optional slot dirender di bawah column header (mis. search input). */
    headerExtra?: React.ReactNode;
    /** Handler batalkan assignment dari shift sekarang (akan ditampilkan untuk card di items kolom IP/OK). */
    onUnassignCurrentShift?: (id: string) => Promise<{ error: string | null }>;
    boardDate?: string;
    boardShift?: 'pagi' | 'sore' | 'malam';
    readOnly?: boolean;
    workOrders?: WorkOrderWithPekerjaan[];
    onOpenDetail?: (id: string, type: 'critical' | 'preventif' | 'modifikasi') => void;
}

function PrevItemWrapper({ item, onKonfirmasi, photos, statusTimeIso, statusActors, boardDate, boardShift }: { item: MaintenanceWithCritical; onKonfirmasi?: (id: string) => Promise<{ error: string | null }>; photos?: PhotoRow[]; statusTimeIso?: string; statusActors?: { ip?: string; ok?: string }; boardDate?: string; boardShift?: 'pagi' | 'sore' | 'malam' }) {
    const [loading, setLoading] = useState(false);
    const handleKonfirmasi = async () => {
        if (!onKonfirmasi) return;
        setLoading(true);
        await onKonfirmasi(item.id);
        setLoading(false);
    };
    return (
        <div className="relative opacity-80 hover:opacity-100 transition-opacity">
            <KanbanCard item={item} photos={photos} statusTimeIso={statusTimeIso} statusActors={statusActors} boardDate={boardDate} boardShift={boardShift} />
            {onKonfirmasi && (
                <button
                    onClick={handleKonfirmasi}
                    disabled={loading}
                    className="mt-1 w-full flex items-center justify-center gap-1 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200 transition-colors cursor-pointer disabled:opacity-50"
                    title="Tandai ada pekerjaan di shift ini → maintenance masuk laporan shift"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{loading ? 'progress_activity' : 'add_task'}</span>
                    {loading ? 'Memproses…' : '+ Lanjut Kerja di Shift Ini'}
                </button>
            )}
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AssignedItemWrapper({ item, photos, statusTimeIso, statusActors, onUnassign, boardDate, boardShift }: { item: MaintenanceWithCritical; photos?: PhotoRow[]; statusTimeIso?: string; statusActors?: { ip?: string; ok?: string }; onUnassign: (id: string) => Promise<{ error: string | null }>; boardDate?: string; boardShift?: 'pagi' | 'sore' | 'malam' }) {
    const [loading, setLoading] = useState(false);
    return (
        <div>
            <KanbanCard item={item} photos={photos} statusTimeIso={statusTimeIso} statusActors={statusActors} boardDate={boardDate} boardShift={boardShift} />
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

export default function KanbanColumn({ status, items, prevItems = [], hiddenFuture = 0, onKonfirmasiShift, photosByMaintId, onMoveInColumn, statusTimeByMaintId, statusActorByMaintId, headerExtra, onUnassignCurrentShift, boardDate, boardShift, readOnly = false, workOrders, onOpenDetail }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: status });
    const baseConfig = KANBAN_COLUMNS.find(c => c.id === (status === 'IP_PREV' ? 'IP' : status))!;
    const config = status === 'IP_PREV' ? {
        ...baseConfig,
        label: 'In Progress (Sebelumnya)',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-300',
        textColor: 'text-slate-700',
        badgeBg: 'bg-slate-200/80',
    } : status === 'IP' ? {
        ...baseConfig,
        label: 'In Progress (Shift Ini)',
    } : baseConfig;

    function renderCardOrWrapper(item: MaintenanceWithCritical, flatIdx: number, totalLen: number, withControls: boolean) {
        const card = (
            <KanbanCard
                item={item}
                photos={photosByMaintId?.[item.id]}
                statusTimeIso={statusTimeByMaintId?.[item.id]}
                statusActors={statusActorByMaintId?.[item.id]}
                boardDate={boardDate}
                boardShift={boardShift}
                index={flatIdx + 1}
                isFirst={flatIdx === 0}
                isLast={flatIdx === totalLen - 1}
                onMoveUp={withControls ? () => onMoveInColumn?.(item.id, 'up') : undefined}
                onMoveDown={withControls ? () => onMoveInColumn?.(item.id, 'down') : undefined}
            />
        );

        if (status === 'IP_PREV') {
            return (
                <div key={item.id}>
                    <PrevItemWrapper
                        item={item}
                        onKonfirmasi={readOnly ? undefined : onKonfirmasiShift}
                        photos={photosByMaintId?.[item.id]}
                        statusTimeIso={statusTimeByMaintId?.[item.id]}
                        statusActors={statusActorByMaintId?.[item.id]}
                        boardDate={boardDate}
                        boardShift={boardShift}
                    />
                </div>
            );
        }

        return (
            <div key={item.id}>
                {card}
            </div>
        );
    }

    function renderGroups(list: MaintenanceWithCritical[], keyPrefix = '', withControls = false) {
        // Group by parent ID (critical_id or work_order_id)
        const groupsMap = new Map<string, MaintenanceWithCritical[]>();
        const groupKeys: string[] = []; // preserve original order of first appearance

        list.forEach(item => {
            let key = '';
            if (item.critical_id) {
                key = `critical-${item.critical_id}`;
            } else if (item.work_order_id) {
                key = `wo-${item.work_order_id}`;
            } else {
                key = `standalone-${item.id}`;
            }

            if (!groupsMap.has(key)) {
                groupsMap.set(key, []);
                groupKeys.push(key);
            }
            groupsMap.get(key)!.push(item);
        });

        // Build flat index for numbering (based on original list position)
        const flatIndexMap = new Map<string, number>();
        list.forEach((item, idx) => flatIndexMap.set(item.id, idx));

        return groupKeys.map((key, groupIdx) => {
            const cards = groupsMap.get(key) || [];
            if (cards.length === 0) return null;

            const firstCard = cards[0];
            const isGroup = cards.length > 1;

            if (!isGroup) {
                const flatIdx = flatIndexMap.get(firstCard.id) ?? 0;
                return renderCardOrWrapper(firstCard, flatIdx, list.length, withControls);
            }

            // Resolve parent properties for grouped items
            let parentTitle = firstCard.item;
            let parentDesc = '';
            let parentType: 'critical' | 'preventif' | 'modifikasi' = 'critical';

            if (firstCard.critical_id) {
                parentTitle = firstCard.critical_equipment?.item || firstCard.item;
                parentDesc = firstCard.critical_equipment?.deskripsi || '';
                parentType = 'critical';
            } else if (firstCard.work_order_id && workOrders) {
                const wo = workOrders.find(w => w.id === firstCard.work_order_id);
                parentTitle = wo?.item || firstCard.item;
                parentDesc = wo?.deskripsi || '';
                parentType = wo?.tipe === 'preventif' ? 'preventif' : 'modifikasi';
            } else if (firstCard.work_order_id) {
                parentTitle = firstCard.item;
                parentType = firstCard.tipe === 'preventif' ? 'preventif' : 'modifikasi';
            }

            // Style tokens per parent type
            const styles: Record<'critical' | 'preventif' | 'modifikasi', {
                bg: string;
                border: string;
                borderLeft: string;
                badgeBg: string;
                badgeText: string;
                badgeBorder: string;
                iconColor: string;
                icon: string;
                label: string;
            }> = {
                critical: {
                    bg: 'bg-rose-50/30 backdrop-blur-[2px]',
                    border: 'border-rose-200/75 shadow-sm shadow-rose-100/10',
                    borderLeft: 'border-l-rose-500',
                    badgeBg: 'bg-rose-100/60',
                    badgeText: 'text-rose-700',
                    badgeBorder: 'border-rose-200/50',
                    iconColor: 'text-rose-500',
                    icon: 'report_problem',
                    label: 'Critical'
                },
                preventif: {
                    bg: 'bg-emerald-50/20 backdrop-blur-[2px]',
                    border: 'border-emerald-250/50 shadow-sm shadow-emerald-100/5',
                    borderLeft: 'border-l-emerald-500',
                    badgeBg: 'bg-emerald-100/60',
                    badgeText: 'text-emerald-700',
                    badgeBorder: 'border-emerald-200/50',
                    iconColor: 'text-emerald-500',
                    icon: 'build_circle',
                    label: 'Preventif'
                },
                modifikasi: {
                    bg: 'bg-indigo-50/20 backdrop-blur-[2px]',
                    border: 'border-indigo-200/60 shadow-sm shadow-indigo-100/5',
                    borderLeft: 'border-l-indigo-500',
                    badgeBg: 'bg-indigo-100/60',
                    badgeText: 'text-indigo-700',
                    badgeBorder: 'border-indigo-200/50',
                    iconColor: 'text-indigo-500',
                    icon: 'published_with_changes',
                    label: 'Modifikasi'
                }
            };

            const style = styles[parentType] || styles.critical;

            return (
                <div
                    key={`${keyPrefix}group-${key}-${groupIdx}`}
                    className={`rounded-2xl p-3 flex flex-col gap-2.5 relative border border-l-4 ${style.bg} ${style.border} ${style.borderLeft} transition-all hover:shadow-md duration-200`}
                >
                    {/* Parent Header */}
                    <div className="flex flex-col gap-1 border-b border-slate-200/40 pb-2 px-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`material-symbols-outlined ${style.iconColor}`} style={{ fontSize: 16 }}>
                                {style.icon}
                            </span>
                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}>
                                {style.label}
                            </span>
                            <h4 className="text-xs font-black text-slate-800 tracking-tight truncate max-w-[130px]" title={parentTitle}>
                                {parentTitle}
                            </h4>
                            <button
                                onClick={() => {
                                    const parentId = firstCard.critical_id || firstCard.work_order_id;
                                    if (parentId) onOpenDetail?.(parentId, parentType);
                                }}
                                className={`flex items-center justify-center p-1 rounded-lg text-slate-400 hover:scale-105 transition-all cursor-pointer ${
                                    parentType === 'critical' ? 'hover:bg-rose-100/80 hover:text-rose-700' :
                                    parentType === 'preventif' ? 'hover:bg-emerald-100/80 hover:text-emerald-700' :
                                    'hover:bg-indigo-100/80 hover:text-indigo-700'
                                }`}
                                title="Buka Detail"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
                            </button>
                            <span className="ml-auto text-[9px] font-black text-slate-500 bg-white/70 px-2 py-0.5 rounded-full border border-slate-200 shadow-sm whitespace-nowrap">
                                {cards.length} Pekerjaan
                            </span>
                        </div>
                        {parentDesc && (
                            <p className="text-sm text-slate-900 font-bold mt-1.5 leading-snug line-clamp-2" title={parentDesc}>
                                {style.label}: {parentDesc.charAt(0).toUpperCase() + parentDesc.slice(1)}
                            </p>
                        )}
                    </div>

                    {/* Grouped Cards nested list with connector line */}
                    <div className="flex flex-col gap-2 pl-2 border-l border-dashed border-slate-300/70 ml-2">
                        {cards.map(item => {
                            const flatIdx = flatIndexMap.get(item.id) ?? 0;
                            return renderCardOrWrapper(item, flatIdx, list.length, withControls);
                        })}
                    </div>
                </div>
            );
        });
    }

    const headerGradient: Record<string, string> = {
        OPEN: 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-sm',
        IP_PREV: 'bg-gradient-to-r from-slate-500 to-slate-600 shadow-sm',
        IP: 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-sm',
        OK: 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-sm',
    };
    const headerIcon: Record<string, string> = {
        OPEN: 'info',
        IP_PREV: 'history',
        IP: 'pending',
        OK: 'check_circle',
    };

    return (
        <div className={`flex flex-col min-w-[260px] md:min-w-0 md:flex-1 rounded-2xl border transition-all duration-200
            ${isOver ? `${config.borderColor} shadow-md scale-[1.01]` : 'border-gray-200 shadow-sm'}
            ${config.bgColor}`}
        >
            {/* Column header */}
            <div className={`${headerGradient[status]} rounded-t-2xl px-4 py-2.5 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }}>
                        {headerIcon[status]}
                    </span>
                    <h3 className="text-sm font-extrabold text-white tracking-wider uppercase">{config.label}</h3>
                </div>
                <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-black px-2.5 py-0.5 rounded-full border border-white/10 shadow-inner">
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
                                    <PrevItemWrapper
                                        key={item.id}
                                        item={item}
                                        onKonfirmasi={readOnly ? undefined : onKonfirmasiShift}
                                        photos={photosByMaintId?.[item.id]}
                                        statusTimeIso={statusTimeByMaintId?.[item.id]}
                                        statusActors={statusActorByMaintId?.[item.id]}
                                        boardDate={boardDate}
                                        boardShift={boardShift}
                                    />
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
