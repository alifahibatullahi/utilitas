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
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => { setSearch(value); }, [value]);

    useEffect(() => {
        fetch('/api/equipment-items')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data.items) && data.items.length > 0) {
                    setItems(data.items);
                }
            })
            .catch(() => { /* gunakan fallback */ });
    }, []);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = items.filter(item =>
        item.no_item.toLowerCase().includes(search.toLowerCase()) ||
        item.deskripsi.toLowerCase().includes(search.toLowerCase())
    );

    const baseInput = light
        ? 'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none'
        : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0f1923] text-slate-100 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none';

    const dropdownBg = light ? 'bg-white border-gray-200 shadow-lg' : 'bg-[#16202e] border-slate-700 shadow-xl';
    const itemHover = light ? 'hover:bg-blue-50' : 'hover:bg-surface-highlight';

    function selectItem(item: EquipmentItem) {
        const val = item.deskripsi ? `${item.no_item} - ${item.deskripsi}` : item.no_item;
        onChange(val);
        setSearch(val);
        setOpen(false);
    }

    return (
        <div ref={ref} className="relative">
            <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder="Ketik atau pilih item..."
                className={baseInput}
            />
            {open && filtered.length > 0 && (
                <div className={`absolute z-50 mt-1 w-full max-h-48 overflow-y-auto light-scrollbar rounded-lg border ${dropdownBg}`}>
                    {filtered.map(item => (
                        <button
                            key={item.no_item}
                            type="button"
                            onClick={() => selectItem(item)}
                            className={`w-full text-left px-3 py-2 text-sm ${itemHover} transition-colors`}
                        >
                            <span className={`font-bold ${light ? 'text-gray-900' : 'text-slate-100'}`}>{item.no_item}</span>
                            {item.deskripsi && (
                                <span className={`ml-2 font-normal ${light ? 'text-gray-500' : 'text-slate-400'}`}>— {item.deskripsi}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
