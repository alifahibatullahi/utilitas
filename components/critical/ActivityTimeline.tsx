'use client';

import { useState } from 'react';
import type { CriticalActivityLogRow, ActivityActionType } from '@/lib/supabase/types';

const ACTION_CONFIG: Record<ActivityActionType, { icon: string; color: string; dotColor: string }> = {
    created:              { icon: 'flag',              color: 'text-rose-500',    dotColor: 'border-rose-300' },
    status_changed:       { icon: 'published_with_changes', color: 'text-amber-500', dotColor: 'border-amber-300' },
    note:                 { icon: 'chat_bubble',       color: 'text-blue-500',     dotColor: 'border-blue-300' },
    maintenance_added:    { icon: 'build_circle',      color: 'text-emerald-500', dotColor: 'border-emerald-300' },
    maintenance_updated:  { icon: 'handyman',          color: 'text-purple-500',  dotColor: 'border-purple-300' },
    maintenance_deleted:  { icon: 'remove_circle',     color: 'text-gray-500',   dotColor: 'border-gray-400' },
};

function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

interface ActivityTimelineProps {
    logs: CriticalActivityLogRow[];
    criticalId: string;
    onAddNote: (criticalId: string, note: string, actor?: string | null) => Promise<{ error: string | null }>;
    operatorName?: string | null;
}

export default function ActivityTimeline({ logs, criticalId, onAddNote, operatorName }: ActivityTimelineProps) {
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    // Show oldest first (chronological)
    const sorted = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const handleSubmit = async () => {
        const trimmed = note.trim();
        if (!trimmed) return;
        setSaving(true);
        await onAddNote(criticalId, trimmed, operatorName ?? null);
        setNote('');
        setSaving(false);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50">
            <div className="px-8 py-4 border-b border-gray-100 bg-white/50">
                <h3 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>timeline</span>Kronologi Aktivitas
                </h3>
            </div>

            <div className="px-8 py-5 flex-1 flex flex-col">

            {/* Timeline list */}
            {sorted.length === 0 ? (
                <p className="text-xs font-semibold text-gray-400 mb-4 ml-1">Belum ada aktivitas tercatat</p>
            ) : (
                <div className="relative ml-1 mb-4">
                    {/* Vertical connector line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
                    <div className="space-y-3">
                        {sorted.map((log) => {
                            const cfg = ACTION_CONFIG[log.action_type] ?? ACTION_CONFIG.note;
                            return (
                                <div key={log.id} className="flex gap-4 relative">
                                    {/* Dot */}
                                    <div className={`w-[15px] h-[15px] rounded-full bg-white border-2 ${cfg.dotColor} flex items-center justify-center flex-shrink-0 mt-0.5 z-10 shadow-sm`}>
                                        <span className={`material-symbols-outlined ${cfg.color}`} style={{ fontSize: 9 }}>
                                            {cfg.icon}
                                        </span>
                                    </div>
                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pb-0.5">
                                        <p className="text-xs font-bold text-gray-700 leading-snug">{log.description}</p>
                                        <div className="flex flex-wrap gap-x-2 mt-1 text-[10px] font-semibold text-gray-400">
                                            {log.actor && <span className="text-gray-500">{log.actor}</span>}
                                            <span className="text-gray-300">—</span>
                                            <span>{formatDateTime(log.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add note input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                    placeholder="Ketik catatan pantauan..."
                    className="flex-1 bg-white border-2 border-gray-900 rounded-xl px-4 py-2.5 text-xs font-bold text-black placeholder-gray-500 focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-sm transition-all"
                />
                <button
                    onClick={handleSubmit}
                    disabled={!note.trim() || saving}
                    className="px-6 py-2.5 rounded-xl bg-gray-900 text-white border-2 border-gray-900 text-xs font-extrabold disabled:opacity-50 hover:bg-black hover:border-black transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md uppercase tracking-wider"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                    {saving ? 'KIRIM...' : 'KIRIM'}
                </button>
            </div>
        </div>
        </div>
    );
}
