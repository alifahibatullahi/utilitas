'use client';

import { useState, useRef, useEffect } from 'react';

export interface ComboboxItem {
    id: string;          // Database id (untuk edit)
    value: string;       // Nilai yang disimpan saat dipilih
    primary: string;     // Label utama (bold)
    secondary?: string;  // Label sekunder (opsional, abu-abu)
}

interface EditableComboboxProps {
    value: string;
    onChange: (value: string) => void;
    items: ComboboxItem[];
    placeholder?: string;
    light?: boolean;
    onAdd?: () => void;             // Buka modal tambah
    onEdit?: (id: string) => void;  // Buka modal edit
    addLabel?: string;
    showSecondary?: boolean;
    maxItems?: number;
    smartSort?: boolean;
}

export default function EditableCombobox({
    value, onChange, items, placeholder = 'Cari atau pilih...', light = false,
    onAdd, onEdit, addLabel = '+ Tambahkan data', showSecondary = true,
    maxItems = 10, smartSort = true,
}: EditableComboboxProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    const [activeIndex, setActiveIndex] = useState(-1);
    const ref = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setSearch(value); }, [value]);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const filtered = (() => {
        if (!search) return items.slice(0, maxItems);
        if (!smartSort) {
            return items.filter(i =>
                i.primary.toLowerCase().includes(search.toLowerCase()) ||
                (i.secondary ?? '').toLowerCase().includes(search.toLowerCase())
            ).slice(0, maxItems);
        }
        const q = search.toLowerCase();
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordRe = new RegExp(`\\b${escaped}`);
        return items
            .map(item => {
                const p = item.primary.toLowerCase();
                const s = (item.secondary ?? '').toLowerCase();
                let score = -1;
                if (p === q || s === q) score = 0;
                else if (p.startsWith(q)) score = 1;
                else if (s.startsWith(q)) score = 2;
                else if (wordRe.test(p)) score = 3;
                else if (p.includes(q)) score = 4;
                else if (s.includes(q)) score = 5;
                return { item, score };
            })
            .filter(x => x.score >= 0)
            .sort((a, b) => a.score - b.score)
            .slice(0, maxItems)
            .map(x => x.item);
    })();

    function selectItem(item: ComboboxItem) {
        onChange(item.value);
        setSearch(item.primary);
        setOpen(false);
        setActiveIndex(-1);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        const total = filtered.length + (onAdd ? 1 : 0);
        if (!open) { if (e.key === 'ArrowDown') { setOpen(true); setActiveIndex(0); } return; }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = Math.min(activeIndex + 1, total - 1);
            setActiveIndex(next);
            listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = Math.max(activeIndex - 1, 0);
            setActiveIndex(prev);
            listRef.current?.children[prev]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < filtered.length) selectItem(filtered[activeIndex]);
            else if (activeIndex === filtered.length && onAdd) { onAdd(); setOpen(false); }
        } else if (e.key === 'Escape') {
            setOpen(false);
            setActiveIndex(-1);
        }
    }

    const baseInput = light
        ? 'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none'
        : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0f1923] text-slate-100 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none';
    const dropdownBg = light ? 'bg-white border-gray-200 shadow-xl' : 'bg-[#16202e] border-slate-700 shadow-xl';

    return (
        <div ref={ref} className="relative">
            <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); setActiveIndex(-1); }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={baseInput}
            />
            {open && (
                <div ref={listRef} className={`absolute z-50 mt-1 w-full max-h-72 overflow-y-auto light-scrollbar rounded-lg border ${dropdownBg}`}>
                    {filtered.length === 0 && !onAdd && (
                        <div className={`px-3 py-3 text-xs text-center ${light ? 'text-gray-400' : 'text-slate-400'}`}>Tidak ada hasil</div>
                    )}
                    {filtered.map((item, idx) => (
                        <div
                            key={item.id}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={`group flex items-center gap-2 px-3 py-2 transition-colors ${
                                idx === activeIndex
                                    ? light ? 'bg-blue-50' : 'bg-surface-highlight'
                                    : ''
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => selectItem(item)}
                                className="flex-1 text-left text-sm min-w-0"
                            >
                                {showSecondary && item.secondary ? (
                                    <>
                                        <span className={`text-xs font-bold ${light ? 'text-gray-400' : 'text-slate-400'}`}>{item.secondary}</span>
                                        <span className={`text-sm font-semibold ml-2 ${light ? 'text-gray-900' : 'text-slate-100'}`}>— {item.primary}</span>
                                    </>
                                ) : (
                                    <span className={`text-sm font-semibold ${light ? 'text-gray-900' : 'text-slate-100'}`}>{item.primary}</span>
                                )}
                            </button>
                            {onEdit && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onEdit(item.id); setOpen(false); }}
                                    className={`opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 w-7 h-7 rounded flex items-center justify-center ${
                                        light ? 'text-blue-600 hover:bg-blue-100' : 'text-blue-400 hover:bg-slate-700'
                                    }`}
                                    title="Edit data"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                                </button>
                            )}
                        </div>
                    ))}
                    {onAdd && (
                        <button
                            type="button"
                            onClick={() => { onAdd(); setOpen(false); }}
                            onMouseEnter={() => setActiveIndex(filtered.length)}
                            className={`w-full text-left px-4 py-3.5 text-sm font-extrabold border-t-2 flex items-center gap-2.5 transition-colors sticky bottom-0 ${
                                activeIndex === filtered.length
                                    ? light ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-900/30 text-emerald-300 border-emerald-600'
                                    : light ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' : 'text-emerald-300 bg-emerald-900/20 hover:bg-emerald-900/30 border-emerald-700'
                            }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                            {addLabel}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
