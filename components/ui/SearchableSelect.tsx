'use client';

import { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SearchableOption {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SearchableOption[];
    /** Teks saat belum ada pilihan. Juga jadi label baris "kosongkan". */
    placeholder?: string;
    disabled?: boolean;
    /** Kelas teks trigger — untuk meniru styling <select> lama (warna/ukuran/font). */
    triggerClassName?: string;
    /** Kelas teks saat placeholder (belum dipilih). */
    placeholderClassName?: string;
    /** Placeholder kotak pencarian. */
    searchPlaceholder?: string;
    ariaLabel?: string;
}

/**
 * Dropdown nama yang bisa dicari dengan mengetik. Panel di-render via portal ke
 * document.body + posisi fixed mengikuti trigger, supaya tidak ter-clip oleh
 * container ber-overflow (mis. body modal yang overflow-y-auto).
 */
export default function SearchableSelect({
    value,
    onChange,
    options,
    placeholder = 'Pilih...',
    disabled = false,
    triggerClassName = '',
    placeholderClassName = 'text-slate-500',
    searchPlaceholder = 'Cari nama...',
    ariaLabel,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const [mounted, setMounted] = useState(false);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => setMounted(true), []);

    const selectedLabel = useMemo(
        () => options.find(o => o.value === value)?.label ?? '',
        [options, value],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter(o => o.label.toLowerCase().includes(q));
    }, [options, query]);

    const updateRect = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }, []);

    // Posisikan + reposisi panel saat scroll/resize selama terbuka.
    useLayoutEffect(() => {
        if (!open) return;
        updateRect();
        const onMove = () => updateRect();
        window.addEventListener('scroll', onMove, true);
        window.addEventListener('resize', onMove);
        return () => {
            window.removeEventListener('scroll', onMove, true);
            window.removeEventListener('resize', onMove);
        };
    }, [open, updateRect]);

    // Tutup saat klik di luar trigger & panel.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t)) return;
            if (panelRef.current?.contains(t)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    // Reset pencarian tiap kali dibuka.
    useEffect(() => {
        if (open) { setQuery(''); setHighlight(0); }
    }, [open]);

    const choose = (v: string) => { onChange(v); setOpen(false); };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(h => Math.min(h + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const o = filtered[highlight];
            if (o) choose(o.value);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
        }
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                aria-label={ariaLabel}
                onClick={() => { if (!disabled) setOpen(o => !o); }}
                className={`w-full text-left truncate ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${triggerClassName}`}
            >
                {selectedLabel
                    ? selectedLabel
                    : <span className={placeholderClassName}>{placeholder}</span>}
            </button>

            {open && rect && mounted && createPortal(
                <div
                    ref={panelRef}
                    style={{ position: 'fixed', top: rect.top, left: rect.left, width: Math.max(rect.width, 220), zIndex: 9999 }}
                    className="rounded-xl border border-slate-700 bg-[#0e1621] shadow-2xl shadow-black/60 overflow-hidden"
                >
                    <div className="p-2 border-b border-slate-800">
                        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                        <input
                            autoFocus
                            value={query}
                            onChange={e => { setQuery(e.target.value); setHighlight(0); }}
                            onKeyDown={onKeyDown}
                            placeholder={searchPlaceholder}
                            className="w-full bg-[#101822] border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                        {query.trim() === '' && (
                            <button
                                type="button"
                                onClick={() => choose('')}
                                className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-800/60 transition-colors"
                            >
                                {placeholder}
                            </button>
                        )}
                        {filtered.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-slate-500">Tidak ada hasil</div>
                        ) : (
                            filtered.map((o, i) => (
                                <button
                                    key={o.value || `__${i}`}
                                    type="button"
                                    onMouseEnter={() => setHighlight(i)}
                                    onClick={() => choose(o.value)}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                        i === highlight ? 'bg-blue-500/20 text-white' : 'text-slate-200 hover:bg-slate-800/60'
                                    } ${o.value === value ? 'font-bold' : ''}`}
                                >
                                    {o.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
