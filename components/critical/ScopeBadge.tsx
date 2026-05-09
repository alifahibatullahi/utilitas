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

// Fallback colors for custom scopes
const FALLBACK_COLORS = [
    { name: 'rose', bg: 'bg-rose-500/15', text: 'text-rose-400', lightBg: 'bg-white border border-rose-200', lightText: 'text-rose-600', solidBg: 'bg-rose-600', solidText: 'text-white' },
    { name: 'indigo', bg: 'bg-indigo-500/15', text: 'text-indigo-400', lightBg: 'bg-white border border-indigo-200', lightText: 'text-indigo-600', solidBg: 'bg-indigo-600', solidText: 'text-white' },
    { name: 'emerald', bg: 'bg-emerald-500/15', text: 'text-emerald-400', lightBg: 'bg-white border border-emerald-200', lightText: 'text-emerald-600', solidBg: 'bg-emerald-600', solidText: 'text-white' },
    { name: 'cyan', bg: 'bg-cyan-500/15', text: 'text-cyan-400', lightBg: 'bg-white border border-cyan-200', lightText: 'text-cyan-600', solidBg: 'bg-cyan-600', solidText: 'text-white' },
    { name: 'pink', bg: 'bg-pink-500/15', text: 'text-pink-400', lightBg: 'bg-white border border-pink-200', lightText: 'text-pink-600', solidBg: 'bg-pink-600', solidText: 'text-white' },
    { name: 'orange', bg: 'bg-orange-500/15', text: 'text-orange-400', lightBg: 'bg-white border border-orange-200', lightText: 'text-orange-600', solidBg: 'bg-orange-600', solidText: 'text-white' },
    { name: 'sky', bg: 'bg-sky-500/15', text: 'text-sky-400', lightBg: 'bg-white border border-sky-200', lightText: 'text-sky-600', solidBg: 'bg-sky-600', solidText: 'text-white' },
    { name: 'fuchsia', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400', lightBg: 'bg-white border border-fuchsia-200', lightText: 'text-fuchsia-600', solidBg: 'bg-fuchsia-600', solidText: 'text-white' },
];

function getDynamicScopeStyle(scope: string, mode: 'default' | 'light' | 'solid'): ScopeStyle {
    // Calculate a simple hash
    let hash = 0;
    for (let i = 0; i < scope.length; i++) {
        hash = scope.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % FALLBACK_COLORS.length;
    const color = FALLBACK_COLORS[index];

    if (mode === 'solid') return { label: '', bg: color.solidBg, text: color.solidText };
    if (mode === 'light') return { label: '', bg: color.lightBg, text: color.lightText };
    return { label: '', bg: color.bg, text: color.text };
}

function humanize(slug: string) {
    if (!slug) return '-';
    return slug.split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function ScopeBadge({ scope, light = false, solid = false, className = '' }: { scope: HarScope | string; light?: boolean; solid?: boolean; className?: string }) {
    const map = solid ? SCOPE_CONFIG_SOLID : light ? SCOPE_CONFIG_LIGHT : SCOPE_CONFIG;
    const fallbackMode: 'default' | 'light' | 'solid' = solid ? 'solid' : light ? 'light' : 'default';
    
    const scopeStr = scope as string;
    let cfg = map[scopeStr];
    if (!cfg) {
        cfg = { ...getDynamicScopeStyle(scopeStr, fallbackMode), label: humanize(scopeStr) };
    }
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text} ${className}`}>
            {cfg.label}
        </span>
    );
}
