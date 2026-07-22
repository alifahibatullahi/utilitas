'use client';

/** Bar filter bersama untuk daftar critical & maintenance (search + status + scope). */

interface SheetFilterBarProps {
    q: string;
    onQChange: (v: string) => void;
    status: 'aktif' | 'semua';
    onStatusChange: (v: 'aktif' | 'semua') => void;
    scope: string;
    onScopeChange: (v: string) => void;
    scopes: string[];
    placeholder?: string;
}

export default function SheetFilterBar({
    q, onQChange, status, onStatusChange, scope, onScopeChange, scopes, placeholder = 'Cari item / uraian…',
}: SheetFilterBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }}>search</span>
                <input
                    value={q}
                    onChange={e => onQChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-all"
                />
            </div>
            <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden">
                {(['aktif', 'semua'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => onStatusChange(s)}
                        className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                            status === s ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        {s === 'aktif' ? 'Aktif' : 'Semua'}
                    </button>
                ))}
            </div>
            <select
                value={scope}
                onChange={e => onScopeChange(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 outline-none cursor-pointer focus:ring-2 focus:ring-blue-400/40"
            >
                <option value="">Semua Scope</option>
                {scopes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
        </div>
    );
}

export function SheetPagination({ page, total, pageSize, onPage }: {
    page: number; total: number; pageSize: number; onPage: (p: number) => void;
}) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] font-semibold text-neutral-400">
                {total} data · hal {page}/{totalPages}
            </p>
            <div className="flex gap-1">
                <button
                    onClick={() => onPage(page - 1)}
                    disabled={page <= 1}
                    className="w-8 h-8 rounded-lg border border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 flex items-center justify-center cursor-pointer disabled:cursor-default"
                    aria-label="Sebelumnya"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                </button>
                <button
                    onClick={() => onPage(page + 1)}
                    disabled={page >= totalPages}
                    className="w-8 h-8 rounded-lg border border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 flex items-center justify-center cursor-pointer disabled:cursor-default"
                    aria-label="Berikutnya"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                </button>
            </div>
        </div>
    );
}
