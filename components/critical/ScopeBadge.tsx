'use client';

import type { HarScope } from '@/lib/supabase/types';

type ScopeStyle = { label: string; bg: string; text: string };

const SCOPE_CONFIG: Record<string, ScopeStyle> = {
    mekanik: { label: 'Mekanik', bg: 'bg-blue-500/15', text: 'text-blue-400' },
    listrik: { label: 'Listrik', bg: 'bg-amber-500/15', text: 'text-amber-400' },
    instrumen: { label: 'Instrumen', bg: 'bg-purple-500/15', text: 'text-purple-400' },
    sipil: { label: 'Sipil', bg: 'bg-teal-500/15', text: 'text-teal-400' },
};

const SCOPE_CONFIG_LIGHT: Record<string, ScopeStyle> = {
    mekanik: { label: 'Mekanik', bg: 'bg-white border border-blue-200', text: 'text-blue-600' },
    listrik: { label: 'Listrik', bg: 'bg-white border border-amber-300', text: 'text-amber-600' },
    instrumen: { label: 'Instrumen', bg: 'bg-white border border-purple-200', text: 'text-purple-600' },
    sipil: { label: 'Sipil', bg: 'bg-white border border-teal-200', text: 'text-teal-600' },
};

const SCOPE_CONFIG_SOLID: Record<string, ScopeStyle> = {
    mekanik: { label: 'Mekanik', bg: 'bg-blue-600', text: 'text-white' },
    listrik: { label: 'Listrik', bg: 'bg-amber-500', text: 'text-white' },
    instrumen: { label: 'Instrumen', bg: 'bg-purple-600', text: 'text-white' },
    sipil: { label: 'Sipil', bg: 'bg-teal-600', text: 'text-white' },
};

// Fallback untuk scope custom yang user buat sendiri
const FALLBACK: Record<'default' | 'light' | 'solid', ScopeStyle> = {
    default: { label: '', bg: 'bg-slate-500/15',                          text: 'text-slate-400' },
    light:   { label: '', bg: 'bg-white border border-slate-200',         text: 'text-slate-600' },
    solid:   { label: '', bg: 'bg-slate-600',                             text: 'text-white' },
};

function humanize(slug: string) {
    if (!slug) return '-';
    return slug.split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function ScopeBadge({ scope, light = false, solid = false, className = '' }: { scope: HarScope | string; light?: boolean; solid?: boolean; className?: string }) {
    const map = solid ? SCOPE_CONFIG_SOLID : light ? SCOPE_CONFIG_LIGHT : SCOPE_CONFIG;
    const fallbackKey: 'default' | 'light' | 'solid' = solid ? 'solid' : light ? 'light' : 'default';
    const cfg = map[scope as string] ?? { ...FALLBACK[fallbackKey], label: humanize(scope as string) };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text} ${className}`}>
            {cfg.label}
        </span>
    );
}
