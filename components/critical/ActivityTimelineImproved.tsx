'use client';

import { useMemo, useState } from 'react';
import type { CriticalActivityLogRow, WorkOrderActivityLogRow, ActivityActionType } from '@/lib/supabase/types';

const ACTION_CONFIG: Record<ActivityActionType, { icon: string; bg: string; text: string; ring: string; label: string }> = {
    created:              { icon: 'flag',                    bg: 'bg-rose-500',    text: 'text-rose-700',    ring: 'ring-rose-200',    label: 'Dibuat' },
    status_changed:       { icon: 'published_with_changes',  bg: 'bg-amber-500',   text: 'text-amber-700',   ring: 'ring-amber-200',   label: 'Status' },
    note:                 { icon: 'chat_bubble',             bg: 'bg-blue-500',    text: 'text-blue-700',    ring: 'ring-blue-200',    label: 'Catatan' },
    maintenance_added:    { icon: 'build_circle',            bg: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-200', label: 'Maintenance' },
    maintenance_updated:  { icon: 'handyman',                bg: 'bg-purple-500',  text: 'text-purple-700',  ring: 'ring-purple-200',  label: 'Update' },
    maintenance_deleted:  { icon: 'remove_circle',           bg: 'bg-gray-500',    text: 'text-gray-700',    ring: 'ring-gray-200',    label: 'Hapus' },
};

type AnyActivityLog = (CriticalActivityLogRow | WorkOrderActivityLogRow) & {
    metadata?: Record<string, unknown> | null;
};

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function dateBucket(iso: string): { key: string; label: string; sortKey: number } {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    if (sameDay(d, today)) return { key: 'today', label: 'Hari ini', sortKey: 99999999 };
    if (sameDay(d, yesterday)) return { key: 'yesterday', label: 'Kemarin', sortKey: 99999998 };

    const dayMonth = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    return { key: dayMonth, label: dayMonth, sortKey: -d.getTime() };
}

interface Props {
    logs: AnyActivityLog[];
    /** Kept for backwards-compat — note adding is handled by parent modal. */
    onAddNote?: (note: string, actor?: string | null) => Promise<{ error: string | null }>;
    operatorName?: string | null;
    compact?: boolean;
    groupByMaintenance?: boolean;
}

function getStatusStyle(val: string, isFrom: boolean) {
    const v = val.toUpperCase();
    if (v === 'OPEN' || v === 'BELUM SELESAI') return `bg-rose-50 text-rose-700 border-rose-200 ${isFrom ? 'line-through decoration-rose-300/50' : ''}`;
    if (v === 'IP' || v === 'IN PROGRESS') return `bg-amber-50 text-amber-700 border-amber-200 ${isFrom ? 'line-through decoration-amber-300/50' : ''}`;
    if (v === 'OK' || v === 'SELESAI') return `bg-emerald-50 text-emerald-700 border-emerald-200 ${isFrom ? 'line-through decoration-emerald-300/50' : ''}`;
    if (v === 'CLOSED') return `bg-slate-100 text-slate-700 border-slate-300 ${isFrom ? 'line-through decoration-slate-400/50' : ''}`;
    return `bg-gray-50 text-gray-700 border-gray-200 ${isFrom ? 'line-through decoration-gray-300/50' : ''}`;
}

function BeforeAfter({ from, to, label }: { from: string; to: string; label: string }) {
    if (label === 'status') {
        return (
            <div className="flex items-center gap-1.5 text-[11px] font-bold mt-1">
                <span className={`px-2 py-0.5 rounded-md border ${getStatusStyle(from, true)}`}>{from}</span>
                <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 12 }}>arrow_forward</span>
                <span className={`px-2 py-0.5 rounded-md border ${getStatusStyle(to, false)}`}>{to}</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-1.5 text-[11px] font-bold mt-1">
            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-100 line-through decoration-rose-300/50">{from}</span>
            <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 12 }}>arrow_forward</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">{to}</span>
            <span className="text-[10px] font-semibold text-gray-400 ml-1">({label})</span>
        </div>
    );
}

function renderMetaChanges(log: AnyActivityLog) {
    const meta = log.metadata;
    if (!meta) return null;
    const elements: React.ReactNode[] = [];

    if (meta.old_status && meta.new_status) {
        elements.push(<BeforeAfter key="status" from={String(meta.old_status)} to={String(meta.new_status)} label="status" />);
    }

    for (const k of ['deskripsi', 'scope', 'foreman', 'notif', 'uraian'] as const) {
        const v = meta[k] as { old?: unknown; new?: unknown } | undefined;
        if (v && typeof v === 'object' && 'old' in v && 'new' in v) {
            elements.push(
                <BeforeAfter
                    key={k}
                    from={String(v.old ?? '-')}
                    to={String(v.new ?? '-')}
                    label={k}
                />
            );
        }
    }
    return elements.length > 0 ? <div className="space-y-0.5">{elements}</div> : null;
}

function isMaintenanceEvent(log: AnyActivityLog): boolean {
    return log.action_type === 'maintenance_added'
        || log.action_type === 'maintenance_updated'
        || log.action_type === 'maintenance_deleted';
}

function maintenanceIdOf(log: AnyActivityLog): string | null {
    const m = log.metadata;
    if (!m) return null;
    const v = m.maintenance_id;
    return typeof v === 'string' ? v : null;
}

function maintenanceUraianOf(log: AnyActivityLog): string | null {
    const m = log.metadata;
    if (!m) return null;
    const v = m.maintenance_uraian ?? m.maintenance_item;
    return typeof v === 'string' ? v : null;
}

function maintenanceItemOf(log: AnyActivityLog): string | null {
    const m = log.metadata;
    if (!m) return null;
    const v = m.maintenance_item;
    return typeof v === 'string' ? v : null;
}

function maintenanceScopeOf(log: AnyActivityLog): string | null {
    const m = log.metadata;
    if (!m) return null;
    const v = m.scope;
    return typeof v === 'string' ? v : null;
}

interface MaintenanceGroup {
    type: 'maintenance_group';
    maintenanceId: string;
    item: string | null;
    uraian: string | null;
    scope: string | null;
    events: AnyActivityLog[];        // sorted ascending
    anchorTime: number;              // for sort: time of latest event
    isDeleted: boolean;
}

interface SingleEntry {
    type: 'single';
    log: AnyActivityLog;
    anchorTime: number;
}

type TimelineEntry = MaintenanceGroup | SingleEntry;

function renderSingleEvent(log: AnyActivityLog) {
    const cfg = ACTION_CONFIG[log.action_type] ?? ACTION_CONFIG.note;
    return (
        <div className="relative">
            <div className={`absolute -left-5 top-1 w-[15px] h-[15px] rounded-full ${cfg.bg} ring-4 ${cfg.ring} flex items-center justify-center shadow-sm`}>
                <span className="material-symbols-outlined text-white" style={{ fontSize: 9 }}>{cfg.icon}</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-lg p-2.5 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-xs font-bold text-slate-800 leading-snug">{log.description}</p>
                {renderMetaChanges(log)}
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                    {log.actor && (
                        <span className="flex items-center gap-1 font-semibold text-slate-500">
                            <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-extrabold text-slate-600">
                                {log.actor.charAt(0).toUpperCase()}
                            </span>
                            {log.actor}
                        </span>
                    )}
                    <span>·</span>
                    <span>{formatTime(log.created_at)}</span>
                </div>
            </div>
        </div>
    );
}

function MaintenanceGroupCard({ group }: { group: MaintenanceGroup }) {
    const added = group.events.find(e => e.action_type === 'maintenance_added');
    const deleted = group.events.find(e => e.action_type === 'maintenance_deleted');
    const statusEvents = group.events.filter(e => e.action_type === 'maintenance_updated');
    const lastStatus = statusEvents[statusEvents.length - 1];
    const lastNewStatus = lastStatus?.metadata?.new_status as string | undefined;

    return (
        <div className="relative">
            {/* Anchor dot */}
            <div className="absolute -left-5 top-1 w-[15px] h-[15px] rounded-full bg-emerald-500 ring-4 ring-emerald-200 flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-white" style={{ fontSize: 9 }}>build_circle</span>
            </div>

            <div className={`bg-white border-2 rounded-xl shadow-sm overflow-hidden ${deleted ? 'border-gray-300 opacity-75' : 'border-emerald-200'}`}>
                {/* Header */}
                <div className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${deleted ? 'bg-gray-50 border-gray-200' : 'bg-emerald-50/60 border-emerald-100'}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`material-symbols-outlined ${deleted ? 'text-gray-400' : 'text-emerald-600'}`} style={{ fontSize: 14 }}>
                            {deleted ? 'delete' : 'build'}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className={`text-xs font-extrabold leading-tight truncate ${deleted ? 'line-through text-gray-500' : 'text-emerald-900'}`}>
                                {group.uraian ?? group.item ?? 'Maintenance'}
                            </p>
                            {group.item && group.uraian && group.item !== group.uraian && (
                                <p className="text-[10px] text-emerald-700/70 font-semibold truncate">{group.item}</p>
                            )}
                        </div>
                    </div>
                    {!deleted && lastNewStatus && (
                        <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold ${getStatusStyle(lastNewStatus, false)}`}>
                            {lastNewStatus}
                        </span>
                    )}
                    {deleted && (
                        <span className="shrink-0 px-2 py-0.5 rounded-md border bg-gray-100 text-gray-600 border-gray-200 text-[10px] font-bold">Dihapus</span>
                    )}
                </div>

                {/* Inner timeline */}
                <div className="p-3 space-y-2">
                    {added && (
                        <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-emerald-500 mt-0.5" style={{ fontSize: 14 }}>add_circle</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-gray-700">Ditambahkan</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                                    {added.actor && <span className="font-semibold text-gray-500">{added.actor}</span>}
                                    {added.actor && <span>·</span>}
                                    <span>{formatDateTime(added.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {statusEvents.map(ev => {
                        const meta = ev.metadata ?? {};
                        const oldS = meta.old_status as string | undefined;
                        const newS = meta.new_status as string | undefined;
                        return (
                            <div key={ev.id} className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-amber-500 mt-0.5" style={{ fontSize: 14 }}>published_with_changes</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-bold text-gray-700">Status:</span>
                                        {oldS && newS ? (
                                            <>
                                                <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${getStatusStyle(oldS, true)}`}>{oldS}</span>
                                                <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 11 }}>arrow_forward</span>
                                                <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${getStatusStyle(newS, false)}`}>{newS}</span>
                                            </>
                                        ) : (
                                            <span className="text-[10px] text-gray-500">{ev.description}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                                        {ev.actor && <span className="font-semibold text-gray-500">{ev.actor}</span>}
                                        {ev.actor && <span>·</span>}
                                        <span>{formatDateTime(ev.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {deleted && (
                        <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-gray-400 mt-0.5" style={{ fontSize: 14 }}>delete</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-gray-600">Dihapus</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                                    {deleted.actor && <span className="font-semibold text-gray-500">{deleted.actor}</span>}
                                    {deleted.actor && <span>·</span>}
                                    <span>{formatDateTime(deleted.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ActivityTimelineImproved({ logs, compact = false, groupByMaintenance = true }: Props) {
    const [filterType, setFilterType] = useState<'all' | ActivityActionType>('all');

    const summary = useMemo(() => {
        const counts: Record<string, number> = { total: logs.length };
        for (const l of logs) counts[l.action_type] = (counts[l.action_type] ?? 0) + 1;
        return counts;
    }, [logs]);

    // Build entries: maintenance events grouped by maintenance_id, others as single entries
    const entries: TimelineEntry[] = useMemo(() => {
        const filtered = filterType === 'all' ? logs : logs.filter(l => l.action_type === filterType);
        if (!groupByMaintenance) {
            return filtered.map(l => ({ type: 'single' as const, log: l, anchorTime: new Date(l.created_at).getTime() }));
        }

        const groupMap = new Map<string, MaintenanceGroup>();
        const singles: SingleEntry[] = [];

        for (const log of filtered) {
            if (isMaintenanceEvent(log)) {
                const mid = maintenanceIdOf(log);
                if (mid) {
                    let g = groupMap.get(mid);
                    if (!g) {
                        g = {
                            type: 'maintenance_group',
                            maintenanceId: mid,
                            item: maintenanceItemOf(log),
                            uraian: maintenanceUraianOf(log),
                            scope: maintenanceScopeOf(log),
                            events: [],
                            anchorTime: 0,
                            isDeleted: false,
                        };
                        groupMap.set(mid, g);
                    }
                    g.events.push(log);
                    // Update display fields if richer info appears
                    if (!g.item && maintenanceItemOf(log)) g.item = maintenanceItemOf(log);
                    if (!g.uraian && maintenanceUraianOf(log)) g.uraian = maintenanceUraianOf(log);
                    if (!g.scope && maintenanceScopeOf(log)) g.scope = maintenanceScopeOf(log);
                    if (log.action_type === 'maintenance_deleted') g.isDeleted = true;
                    continue;
                }
                // Fallback: maintenance event without maintenance_id → keep as single
            }
            singles.push({ type: 'single' as const, log, anchorTime: new Date(log.created_at).getTime() });
        }

        // Finalize groups: sort events ascending, set anchorTime to latest event
        const groups: MaintenanceGroup[] = [];
        for (const g of groupMap.values()) {
            g.events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            g.anchorTime = new Date(g.events[g.events.length - 1].created_at).getTime();
            groups.push(g);
        }

        const all: TimelineEntry[] = [...singles, ...groups];
        all.sort((a, b) => b.anchorTime - a.anchorTime);
        return all;
    }, [logs, filterType, groupByMaintenance]);

    // Bucket by date (using anchorTime)
    const grouped = useMemo(() => {
        const buckets = new Map<string, { label: string; sortKey: number; items: TimelineEntry[] }>();
        for (const entry of entries) {
            const iso = new Date(entry.anchorTime).toISOString();
            const b = dateBucket(iso);
            if (!buckets.has(b.key)) buckets.set(b.key, { label: b.label, sortKey: b.sortKey, items: [] });
            buckets.get(b.key)!.items.push(entry);
        }
        return Array.from(buckets.values()).sort((a, b) => b.sortKey - a.sortKey);
    }, [entries]);

    return (
        <div className="flex flex-col h-full">
            {/* Summary chips */}
            {logs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-slate-100">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            filterType === 'all'
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        Semua · {summary.total}
                    </button>
                    {(Object.keys(ACTION_CONFIG) as ActivityActionType[]).map(t => {
                        const cnt = summary[t] ?? 0;
                        if (cnt === 0) return null;
                        const cfg = ACTION_CONFIG[t];
                        const active = filterType === t;
                        return (
                            <button
                                key={t}
                                onClick={() => setFilterType(active ? 'all' : t)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                    active
                                        ? `${cfg.bg} text-white border-transparent shadow-sm`
                                        : `bg-white ${cfg.text} border-slate-200 hover:bg-slate-50`
                                }`}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{cfg.icon}</span>
                                {cfg.label} · {cnt}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Timeline */}
            <div className={`flex-1 ${compact ? '' : 'overflow-y-auto'} light-scrollbar`}>
                {grouped.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                        <span className="material-symbols-outlined text-4xl mb-2">timeline</span>
                        <p className="text-xs font-bold">{logs.length === 0 ? 'Belum ada aktivitas' : 'Tidak ada hasil filter'}</p>
                    </div>
                ) : (
                    <div className="space-y-4 pr-6">
                        {grouped.map(group => (
                            <div key={group.label}>
                                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-slate-50/80 backdrop-blur z-10 py-1">
                                    <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider px-2 py-0.5 bg-white border border-slate-200 rounded-full shadow-sm">
                                        {group.label}
                                    </span>
                                    <div className="flex-1 h-px bg-slate-200" />
                                    <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">{group.items.length} aktivitas</span>
                                </div>

                                <div className="relative ml-1.5 pl-5">
                                    <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200" />
                                    <div className="space-y-2.5">
                                        {group.items.map((entry, idx) => (
                                            <div key={entry.type === 'single' ? entry.log.id : entry.maintenanceId + '-' + idx}>
                                                {entry.type === 'single'
                                                    ? renderSingleEvent(entry.log)
                                                    : <MaintenanceGroupCard group={entry} />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
