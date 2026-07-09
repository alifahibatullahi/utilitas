'use client';

import type { HarScope } from '@/lib/supabase/types';
import { useHarScopes } from '@/hooks/useMasterData';

type ScopeStyle = { bg: string; text: string };

// Color configs keyed by scope slug — label comes from DB
const SCOPE_COLORS: Record<string, { default: ScopeStyle; light: ScopeStyle; solid: ScopeStyle }> = {
    mekanik:     { default: { bg: 'bg-blue-500/15',   text: 'text-blue-400' },   light: { bg: 'bg-white border border-blue-200',   text: 'text-blue-600' },   solid: { bg: 'bg-blue-600',   text: 'text-white' } },
    listrik:     { default: { bg: 'bg-amber-500/15',  text: 'text-amber-400' },  light: { bg: 'bg-white border border-amber-300',  text: 'text-amber-600' },  solid: { bg: 'bg-amber-500',  text: 'text-white' } },
    instrumen:   { default: { bg: 'bg-purple-500/15', text: 'text-purple-400' }, light: { bg: 'bg-white border border-purple-200', text: 'text-purple-600' }, solid: { bg: 'bg-purple-600', text: 'text-white' } },
    sipil:       { default: { bg: 'bg-teal-500/15',   text: 'text-teal-400' },   light: { bg: 'bg-white border border-teal-200',   text: 'text-teal-600' },   solid: { bg: 'bg-teal-600',   text: 'text-white' } },
    bengkel_las: { default: { bg: 'bg-orange-500/15', text: 'text-orange-400' },   light: { bg: 'bg-white border border-orange-300', text: 'text-orange-600' },   solid: { bg: 'bg-orange-500', text: 'text-white' } },
};

// Fallback colors for custom scopes
const FALLBACK_COLORS = [
    { default: { bg: 'bg-rose-500/15', text: 'text-rose-400' },       light: { bg: 'bg-white border border-rose-200', text: 'text-rose-600' },       solid: { bg: 'bg-rose-600', text: 'text-white' } },
    { default: { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },   light: { bg: 'bg-white border border-indigo-200', text: 'text-indigo-600' },   solid: { bg: 'bg-indigo-600', text: 'text-white' } },
    { default: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' }, light: { bg: 'bg-white border border-emerald-200', text: 'text-emerald-600' }, solid: { bg: 'bg-emerald-600', text: 'text-white' } },
    { default: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },       light: { bg: 'bg-white border border-cyan-200', text: 'text-cyan-600' },       solid: { bg: 'bg-cyan-600', text: 'text-white' } },
    { default: { bg: 'bg-pink-500/15', text: 'text-pink-400' },       light: { bg: 'bg-white border border-pink-200', text: 'text-pink-600' },       solid: { bg: 'bg-pink-600', text: 'text-white' } },
    { default: { bg: 'bg-orange-500/15', text: 'text-orange-400' },   light: { bg: 'bg-white border border-orange-200', text: 'text-orange-600' },   solid: { bg: 'bg-orange-600', text: 'text-white' } },
    { default: { bg: 'bg-sky-500/15', text: 'text-sky-400' },         light: { bg: 'bg-white border border-sky-200', text: 'text-sky-600' },         solid: { bg: 'bg-sky-600', text: 'text-white' } },
    { default: { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400' }, light: { bg: 'bg-white border border-fuchsia-200', text: 'text-fuchsia-600' }, solid: { bg: 'bg-fuchsia-600', text: 'text-white' } },
];

function getDynamicColors(scope: string): (typeof FALLBACK_COLORS)[0] {
    let hash = 0;
    for (let i = 0; i < scope.length; i++) {
        hash = scope.charCodeAt(i) + ((hash << 5) - hash);
    }
    return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function humanize(slug: string) {
    if (!slug) return '-';
    return slug.split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function ScopeBadge({ scope, light = false, solid = false, className = '' }: { scope: HarScope | string; light?: boolean; solid?: boolean; className?: string }) {
    const { scopes } = useHarScopes();

    const scopeStr = scope as string;
    const mode = solid ? 'solid' : light ? 'light' : 'default';

    // Resolve label from master data
    const scopeRow = scopes.find(s => s.value === scopeStr);
    const label = scopeRow?.label ?? humanize(scopeStr);

    // Resolve colors
    const colorSet = SCOPE_COLORS[scopeStr] ?? getDynamicColors(scopeStr);
    const style = colorSet[mode];

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${style.bg} ${style.text} ${className}`}>
            {label}
        </span>
    );
}
