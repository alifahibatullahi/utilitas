'use client';

import { useState, useRef, useEffect } from 'react';
import { OPERATORS } from '@/lib/constants';

interface OperatorComboboxProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    dropUp?: boolean;
}

export default function OperatorCombobox({ value, onChange, placeholder = 'Ketik nama...', dropUp = false }: OperatorComboboxProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => { setSearch(value); }, [value]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function jabatanOrder(jabatan?: string): number {
        if (!jabatan) return 2;
        const j = jabatan.toLowerCase();
        if (j === 'supervisor') return 0;
        if (j.includes('foreman')) return 1;
        return 2;
    }

    const filtered = OPERATORS
        .filter(op => op.company === 'UBB' && op.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => jabatanOrder(a.jabatan) - jabatanOrder(b.jabatan))
        .slice(0, 15);

    const dropdownPos = dropUp
        ? 'bottom-full mb-1'
        : 'top-full mt-1';

    return (
        <div ref={ref} className="relative">
            <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); onChange(''); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none transition-all shadow-sm placeholder-gray-400"
            />
            {open && filtered.length > 0 && (
                <div className={`absolute z-50 ${dropdownPos} w-full max-h-52 overflow-y-auto light-scrollbar rounded-xl border border-gray-200 bg-white shadow-xl`}>
                    {filtered.map(op => (
                        <button
                            key={op.id}
                            type="button"
                            onClick={() => { onChange(op.name); setSearch(op.name); setOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm font-medium text-gray-800 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                        >
                            {op.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
