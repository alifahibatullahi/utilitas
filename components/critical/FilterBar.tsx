'use client';

import type { CriticalEquipmentStatus, HarScope } from '@/lib/supabase/types';
import { HAR_SCOPES, CRITICAL_STATUSES } from '@/lib/constants';
import type { CriticalMaintenanceFilters } from '@/hooks/useCriticalMaintenance';

interface FilterBarProps {
    filters: CriticalMaintenanceFilters;
    onChange: (filters: CriticalMaintenanceFilters) => void;
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
    const update = (patch: Partial<CriticalMaintenanceFilters>) => onChange({ ...filters, ...patch });

    return (
        <div className="flex flex-wrap gap-3 items-center w-full">
            {/* Item search */}
            <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-black font-bold" style={{ fontSize: 16 }}>search</span>
                <input
                    type="text"
                    placeholder="Cari item..."
                    value={filters.item ?? ''}
                    onChange={e => update({ item: e.target.value || undefined })}
                    className="pl-9 pr-3 py-2 rounded-xl border-2 border-gray-900 bg-white text-black text-xs font-bold focus:ring-1 focus:ring-black focus:border-black outline-none w-48 shadow-sm transition-all placeholder:text-gray-500"
                />
            </div>

            {/* Status pills — OPEN / CLOSED */}
            <div className="flex gap-1.5 p-1 bg-white rounded-xl border-2 border-gray-900 shadow-sm">
                {CRITICAL_STATUSES.map(s => {
                    const active = filters.status === s.value;
                    return (
                        <button
                            key={s.value}
                            onClick={() => update({ status: active ? undefined : s.value as CriticalEquipmentStatus })}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold tracking-wide transition-all cursor-pointer border-2
                                ${active
                                    ? s.value === 'OPEN'
                                        ? 'bg-rose-500 text-white border-rose-500 shadow-md'
                                        : 'bg-slate-600 text-white border-slate-600 shadow-md'
                                    : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-100 hover:text-black'
                                }`}
                        >
                            {s.label}
                        </button>
                    );
                })}
            </div>

            {/* Scope filter */}
            <div className="relative">
                <select
                    value={filters.scope ?? ''}
                    onChange={e => update({ scope: (e.target.value || undefined) as HarScope | undefined })}
                    className="appearance-none pl-3 pr-8 py-2 rounded-xl border-2 border-gray-900 bg-white text-black font-bold text-xs focus:ring-1 focus:ring-black focus:border-black outline-none cursor-pointer shadow-sm transition-all"
                >
                    <option value="">Semua Scope</option>
                    {HAR_SCOPES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-black pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 bg-white border-2 border-gray-900 rounded-xl px-2 shadow-sm transition-all focus-within:ring-1 focus-within:ring-black focus-within:border-black">
                <span className="material-symbols-outlined text-black font-bold ml-1" style={{ fontSize: 16 }}>calendar_today</span>
                <input
                    type="date"
                    value={filters.dateFrom ?? ''}
                    onChange={e => update({ dateFrom: e.target.value || undefined })}
                    className="py-2 bg-transparent text-black font-bold text-xs outline-none cursor-pointer"
                />
                <span className="text-black font-extrabold text-xs">—</span>
                <input
                    type="date"
                    value={filters.dateTo ?? ''}
                    onChange={e => update({ dateTo: e.target.value || undefined })}
                    className="py-2 bg-transparent text-black font-bold text-xs outline-none cursor-pointer"
                />
            </div>

            {/* Clear */}
            {(filters.item || filters.status || filters.scope || filters.dateFrom || filters.dateTo) && (
                <button
                    onClick={() => onChange({})}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-gray-900 border-2 border-gray-900 hover:bg-black hover:border-black transition-colors shadow-sm cursor-pointer uppercase tracking-wider"
                >
                    <span className="material-symbols-outlined font-bold" style={{ fontSize: 14 }}>close</span>
                    RESET
                </button>
            )}
        </div>
    );
}
