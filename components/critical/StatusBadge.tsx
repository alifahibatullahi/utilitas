'use client';

import type { CriticalStatus } from '@/lib/supabase/types';

const STATUS_CONFIG: Record<CriticalStatus, { label: string; bg: string; text: string; icon: string }> = {
    OPEN: { label: 'Open', bg: 'bg-blue-500/15', text: 'text-blue-400', icon: 'info' },
    IP: { label: 'In Progress', bg: 'bg-amber-500/15', text: 'text-amber-400', icon: 'pending' },
    OK: { label: 'Selesai', bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: 'check_circle' },
    CLOSED: { label: 'Closed', bg: 'bg-slate-500/15', text: 'text-slate-400', icon: 'lock' },
};

// Light theme variant
const STATUS_CONFIG_LIGHT: Record<CriticalStatus, { label: string; bg: string; text: string; icon: string }> = {
    OPEN: { label: 'Open', bg: 'bg-white border border-rose-300', text: 'text-rose-500', icon: 'error' },
    IP: { label: 'In Progress', bg: 'bg-white border border-amber-300', text: 'text-amber-500', icon: 'pending' },
    OK: { label: 'Selesai', bg: 'bg-white border border-emerald-300', text: 'text-emerald-500', icon: 'check_circle' },
    CLOSED: { label: 'Closed', bg: 'bg-white border border-slate-400', text: 'text-slate-600', icon: 'lock' },
};

// Solid theme variant
const STATUS_CONFIG_SOLID: Record<CriticalStatus, { label: string; bg: string; text: string; icon: string }> = {
    OPEN: { label: 'Open', bg: 'bg-rose-600', text: 'text-white', icon: 'error' },
    IP: { label: 'In Progress', bg: 'bg-amber-500', text: 'text-white', icon: 'pending' },
    OK: { label: 'Selesai', bg: 'bg-emerald-600', text: 'text-white', icon: 'check_circle' },
    CLOSED: { label: 'Closed', bg: 'bg-slate-600', text: 'text-white', icon: 'lock' },
};

export default function StatusBadge({ status, light = false, solid = false, className = '' }: { status: CriticalStatus; light?: boolean; solid?: boolean; className?: string }) {
    const cfg = solid ? STATUS_CONFIG_SOLID[status] : light ? STATUS_CONFIG_LIGHT[status] : STATUS_CONFIG[status];
    if (!cfg) return null;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text} ${className}`}>
            <span className="material-symbols-outlined" style={{ fontSize: className.includes('text-sm') ? 16 : 12 }}>{cfg.icon}</span>
            {cfg.label}
        </span>
    );
}
