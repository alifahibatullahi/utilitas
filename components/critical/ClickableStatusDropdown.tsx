'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

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
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Compute position dropdown saat dibuka — berdasarkan trigger button rect
    useLayoutEffect(() => {
        if (!open || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const menuW = Math.max(rect.width, 180);
        let left = rect.left;
        // Auto-flip kanan kalau melebihi viewport
        if (left + menuW > window.innerWidth - 8) {
            left = Math.max(8, window.innerWidth - menuW - 8);
        }
        // Default tampil di bawah; kalau ruang bawah < 200px, tampil di atas
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow < 200
            ? Math.max(8, rect.top - 8) // anchor bottom of menu di atas trigger
            : rect.bottom + 4;
        setPos({ top, left, width: menuW });
    }, [open]);

    // Click outside → close
    useEffect(() => {
        if (!open) return;
        function handler(e: MouseEvent) {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t)) return;
            if (menuRef.current?.contains(t)) return;
            setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close on scroll/resize biar dropdown tidak melayang dari triggernya
    useEffect(() => {
        if (!open) return;
        function reposition() { setOpen(false); }
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => {
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [open]);

    const current = options.find(o => o.value === currentStatus);

    async function handleSelect(value: string) {
        if (value === currentStatus) { setOpen(false); return; }
        setUpdating(true);
        try { await onChange(value); }
        finally { setUpdating(false); setOpen(false); }
    }

    const spaceBelow = pos ? window.innerHeight - (pos.top - 4) : 999;
    const flipUp = spaceBelow < 200;

    const menu = open && pos ? (
        <div
            ref={menuRef}
            // Saat flipUp, gunakan transform translateY(-100%) supaya bottom dari menu menempel di pos.top
            style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                minWidth: pos.width,
                transform: flipUp ? 'translateY(-100%)' : undefined,
                zIndex: 9999,
            }}
            className="bg-white border-2 border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
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
    ) : null;

    return (
        <>
            <button
                ref={triggerRef}
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
            {typeof window !== 'undefined' && menu ? createPortal(menu, document.body) : null}
        </>
    );
}
