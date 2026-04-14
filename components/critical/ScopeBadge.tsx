'use client';

import type { HarScope } from '@/lib/supabase/types';

const SCOPE_CONFIG: Record<HarScope, { label: string; bg: string; text: string }> = {
    mekanik: { label: 'Mekanik', bg: 'bg-blue-500/15', text: 'text-blue-400' },
    listrik: { label: 'Listrik', bg: 'bg-amber-500/15', text: 'text-amber-400' },
    instrumen: { label: 'Instrumen', bg: 'bg-purple-500/15', text: 'text-purple-400' },
    sipil: { label: 'Sipil', bg: 'bg-teal-500/15', text: 'text-teal-400' },
};

const SCOPE_CONFIG_LIGHT: Record<HarScope, { label: string; bg: string; text: string }> = {
    mekanik: { label: 'Mekanik', bg: 'bg-white border border-blue-200', text: 'text-blue-600' },
    listrik: { label: 'Listrik', bg: 'bg-white border border-amber-300', text: 'text-amber-600' },
    instrumen: { label: 'Instrumen', bg: 'bg-white border border-purple-200', text: 'text-purple-600' },
    sipil: { label: 'Sipil', bg: 'bg-white border border-teal-200', text: 'text-teal-600' },
};

export default function ScopeBadge({ scope, light = false, className = '' }: { scope: HarScope; light?: boolean; className?: string }) {
    const cfg = light ? SCOPE_CONFIG_LIGHT[scope] : SCOPE_CONFIG[scope];
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text} ${className}`}>
            {cfg.label}
        </span>
    );
}
