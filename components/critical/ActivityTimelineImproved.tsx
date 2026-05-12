'use client';

import { useState, useMemo } from 'react';
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
    onAddNote: (note: string, actor?: string | null) => Promise<{ error: string | null }>;
    operatorName?: string | null;
    compact?: boolean;
}

function BeforeAfter({ from, to, label }: { from: string; to: string; label: string }) {
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
    // Field-by-field for maintenance_updated
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

export default function ActivityTimelineImproved({ logs, onAddNote, operatorName, compact = false }: Props) {
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [filterType, setFilterType] = useState<'all' | ActivityActionType>('all');

    const summary = useMemo(() => {
        const counts: Record<string, number> = { total: logs.length };
        for (const l of logs) counts[l.action_type] = (counts[l.action_type] ?? 0) + 1;
        return counts;
    }, [logs]);

    // Filter & group by date (newest first)
    const grouped = useMemo(() => {
        const filtered = filterType === 'all' ? logs : logs.filter(l => l.action_type === filterType);
        const sorted = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const groups = new Map<string, { label: string; sortKey: number; items: AnyActivityLog[] }>();
        for (const log of sorted) {
            const b = dateBucket(log.created_at);
            if (!groups.has(b.key)) groups.set(b.key, { label: b.label, sortKey: b.sortKey, items: [] });
            groups.get(b.key)!.items.push(log);
        }
        return Array.from(groups.values()).sort((a, b) => b.sortKey - a.sortKey);
    }, [logs, filterType]);

    async function handleSubmit() {
        const t = note.trim();
        if (!t) return;
        setSaving(true);
        await onAddNote(t, operatorName ?? null);
        setNote('');
        setSaving(false);
    }

    return (
        <div className="flex flex-col h-full">
            {/* Summary chip */}
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
                    <div className="space-y-4 pr-3">
                        {grouped.map(group => (
                            <div key={group.label}>
                                {/* Date header */}
                                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-slate-50/80 backdrop-blur z-10 py-1">
                                    <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider px-2 py-0.5 bg-white border border-slate-200 rounded-full shadow-sm">
                                        {group.label}
                                    </span>
                                    <div className="flex-1 h-px bg-slate-200" />
                                    <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">{group.items.length} aktivitas</span>
                                </div>

                                {/* Events with vertical line */}
                                <div className="relative ml-1.5 pl-5">
                                    <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200" />
                                    <div className="space-y-2.5">
                                        {group.items.map(log => {
                                            const cfg = ACTION_CONFIG[log.action_type] ?? ACTION_CONFIG.note;
                                            return (
                                                <div key={log.id} className="relative">
                                                    {/* Dot */}
                                                    <div className={`absolute -left-5 top-1 w-[15px] h-[15px] rounded-full ${cfg.bg} ring-4 ${cfg.ring} flex items-center justify-center shadow-sm`}>
                                                        <span className="material-symbols-outlined text-white" style={{ fontSize: 9 }}>{cfg.icon}</span>
                                                    </div>
                                                    {/* Content */}
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
                                        })}
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
