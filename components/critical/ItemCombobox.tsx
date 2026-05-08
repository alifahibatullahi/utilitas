'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EquipmentItemRow } from '@/lib/supabase/types';

interface ItemComboboxProps {
    value: string;
    onChange: (value: string) => void;
    light?: boolean;
}

export default function ItemCombobox({ value, onChange, light = false }: ItemComboboxProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    const [items, setItems] = useState<EquipmentItemRow[]>([]);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase
            .from('equipment_items')
            .select('id, no_item, deskripsi, created_at, updated_at')
            .order('no_item')
            .then(({ data }) => { if (data) setItems(data); });
    }, []);

    useEffect(() => { setSearch(value); }, [value]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = items.filter(item =>
        item.deskripsi.toLowerCase().includes(search.toLowerCase()) ||
        item.no_item.toLowerCase().includes(search.toLowerCase())
    );

    const baseInput = light
        ? 'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none'
        : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0f1923] text-slate-100 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none';

    const dropdownBg = light ? 'bg-white border-gray-200 shadow-lg' : 'bg-[#16202e] border-slate-700 shadow-xl';
    const itemHover = light ? 'hover:bg-blue-50 text-gray-800' : 'hover:bg-surface-highlight text-slate-200';

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
                            key={item.id}
                            type="button"
                            onClick={() => { onChange(item.deskripsi); setSearch(item.deskripsi); setOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm ${itemHover} transition-colors`}
                        >
                            <span className="font-semibold">{item.deskripsi}</span>
                            <span className="ml-2 text-xs opacity-50">{item.no_item}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
