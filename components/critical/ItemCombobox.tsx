'use client';

import { useState, useRef, useEffect } from 'react';
import { PREDEFINED_ITEMS } from '@/lib/constants';

interface EquipmentItem {
    no_item: string;
    deskripsi: string;
}

interface ItemComboboxProps {
    value: string;
    onChange: (value: string) => void;
    light?: boolean;
}

const FALLBACK_ITEMS: EquipmentItem[] = PREDEFINED_ITEMS.map(name => ({ no_item: name, deskripsi: '' }));

export default function ItemCombobox({ value, onChange, light = false }: ItemComboboxProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    const [items, setItems] = useState<EquipmentItem[]>(FALLBACK_ITEMS);
    const [activeIndex, setActiveIndex] = useState(-1);
    const ref = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setSearch(value); }, [value]);

    useEffect(() => {
        fetch('/api/equipment-items')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data.items) && data.items.length > 0) setItems(data.items);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = (() => {
        if (!search) return items.slice(0, 10);
        const q = search.toLowerCase();
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordRe = new RegExp(`\\b${escaped}`);
        return items
            .map(item => {
                const desc = item.deskripsi.toLowerCase();
                const no = item.no_item.toLowerCase();
                let score = -1;
                if (desc === q || no === q) score = 0;
                else if (desc.startsWith(q)) score = 1;
                else if (no.startsWith(q)) score = 2;
                else if (wordRe.test(desc)) score = 3;
                else if (desc.includes(q)) score = 4;
                else if (no.includes(q)) score = 5;
                return { item, score };
            })
            .filter(x => x.score >= 0)
            .sort((a, b) => a.score - b.score)
            .slice(0, 10)
            .map(x => x.item);
    })();

    function selectItem(item: EquipmentItem) {
        const val = item.deskripsi ? `${item.no_item} - ${item.deskripsi}` : item.no_item;
        onChange(val);
        setSearch(val);
        setOpen(false);
        setActiveIndex(-1);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open) { if (e.key === 'ArrowDown') { setOpen(true); setActiveIndex(0); } return; }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = Math.min(activeIndex + 1, filtered.length - 1);
            setActiveIndex(next);
            listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = Math.max(activeIndex - 1, 0);
            setActiveIndex(prev);
            listRef.current?.children[prev]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && filtered[activeIndex]) selectItem(filtered[activeIndex]);
        } else if (e.key === 'Escape') {
            setOpen(false);
            setActiveIndex(-1);
        }
    }

    const baseInput = light
        ? 'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none'
        : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0f1923] text-slate-100 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none';

    const dropdownBg = light ? 'bg-white border-gray-200 shadow-lg' : 'bg-[#16202e] border-slate-700 shadow-xl';

    return (
        <div ref={ref} className="relative">
            <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); setActiveIndex(-1); }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik atau pilih item..."
                className={baseInput}
            />
            {open && filtered.length > 0 && (
                <div ref={listRef} className={`absolute z-50 mt-1 w-full max-h-60 overflow-y-auto light-scrollbar rounded-lg border ${dropdownBg}`}>
                    {filtered.map((item, idx) => (
                        <button
                            key={item.no_item}
                            type="button"
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => selectItem(item)}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                idx === activeIndex
                                    ? light ? 'bg-blue-50 text-blue-700' : 'bg-surface-highlight text-slate-100'
                                    : light ? 'text-gray-800 hover:bg-blue-50' : 'text-slate-200 hover:bg-surface-highlight'
                            }`}
                        >
                            <span className={`font-bold ${idx === activeIndex ? (light ? 'text-blue-400' : 'text-slate-400') : (light ? 'text-gray-400' : 'text-slate-400')}`}>{item.no_item}</span>
                            {item.deskripsi && (
                                <span className={`ml-2 font-semibold ${idx === activeIndex ? (light ? 'text-blue-700' : 'text-slate-100') : (light ? 'text-gray-800' : 'text-slate-200')}`}>— {item.deskripsi}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
