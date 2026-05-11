'use client';

import { useState, useEffect, useRef } from 'react';

export default function ClickableStatusDropdown({
    currentStatus,
    options,
    onChange,
    label,
}: {
    currentStatus: string;
    options: { value: string; label: string; color: string }[];
    onChange: (newStatus: string) => Promise<void> | void;
    label: string;
}) {
    const [open, setOpen] = useState(false);
    const [updating, setUpdating] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const current = options.find(o => o.value === currentStatus);

    async function handleSelect(value: string) {
        if (value === currentStatus) { setOpen(false); return; }
        setUpdating(true);
        try { await onChange(value); }
        finally { setUpdating(false); setOpen(false); }
    }

    return (
        <div ref={ref} className="relative inline-block">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                disabled={updating}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-extrabold uppercase tracking-wide shadow-sm transition-all cursor-pointer hover:opacity-80 disabled:opacity-50 ${current?.color ?? 'bg-gray-200 text-gray-700'}`}
                title={`Klik untuk ubah status (${label})`}
            >
                {updating ? (
                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                ) : null}
                {current?.label ?? currentStatus}
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
            </button>
            {open && (
                <div className="absolute z-50 left-0 mt-1 min-w-[160px] bg-white border-2 border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-gray-50">
                        Ubah Status
                    </div>
                    {options.map(opt => {
                        const active = opt.value === currentStatus;
                        return (
                            <button
                                key={opt.value}
                                onClick={(e) => { e.stopPropagation(); handleSelect(opt.value); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors text-left ${active ? `${opt.color}` : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${opt.color.split(' ')[0]}`} />
                                {opt.label}
                                {active && <span className="ml-auto text-[10px] text-gray-400 normal-case">saat ini</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
