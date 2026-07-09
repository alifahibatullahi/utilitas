'use client';

import { useState, useEffect } from 'react';

interface CustomCalendarPopoverProps {
    value: string; // YYYY-MM-DD
    onChange: (dateStr: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function CustomCalendarPopover({ value, onChange, isOpen, onClose }: CustomCalendarPopoverProps) {
    const [year, month, day] = value.split('-').map(Number);
    
    // Calendar navigation state
    const [navMonth, setNavMonth] = useState(month - 1); // 0-indexed
    const [navYear, setNavYear] = useState(year);

    // Sync external changes
    useEffect(() => {
        if (value) {
            const [y, m] = value.split('-').map(Number);
            setNavMonth(m - 1);
            setNavYear(y);
        }
    }, [value]);

    if (!isOpen) return null;

    const pad = (n: number) => String(n).padStart(2, '0');

    // Quick Select handler
    const selectRelativeDate = (offset: number) => {
        const today = new Date();
        const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
        onChange(`${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`);
        onClose();
    };

    // Calculate days for the calendar grid
    const firstDayOfMonth = new Date(navYear, navMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const totalDaysInMonth = new Date(navYear, navMonth + 1, 0).getDate();

    // Create array for days
    const dayCells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        dayCells.push(null);
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
        dayCells.push(d);
    }

    const prevMonth = () => {
        if (navMonth === 0) {
            setNavMonth(11);
            setNavYear(navYear - 1);
        } else {
            setNavMonth(navMonth - 1);
        }
    };

    const nextMonth = () => {
        if (navMonth === 11) {
            setNavMonth(0);
            setNavYear(navYear + 1);
        } else {
            setNavMonth(navMonth + 1);
        }
    };

    const selectDay = (d: number) => {
        onChange(`${navYear}-${pad(navMonth + 1)}-${pad(d)}`);
        onClose();
    };

    const isSelected = (d: number) => {
        return d === day && (navMonth + 1) === month && navYear === year;
    };

    const isTodayDate = (d: number) => {
        const today = new Date();
        return d === today.getDate() && navMonth === today.getMonth() && navYear === today.getFullYear();
    };

    return (
        <>
            {/* Backdrop to close when clicking outside */}
            <div className="fixed inset-0 z-40 cursor-default" onClick={onClose} />

            {/* Popover container */}
            <div className="absolute right-0 mt-2 top-full w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Presets */}
                <div className="flex gap-1.5 pb-3 border-b border-slate-100">
                    <button
                        onClick={() => selectRelativeDate(-1)}
                        className="flex-1 py-1 px-2 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-[10px] font-black text-slate-600 transition-colors cursor-pointer"
                    >
                        Kemarin
                    </button>
                    <button
                        onClick={() => selectRelativeDate(0)}
                        className="flex-1 py-1 px-2 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-[10px] font-black text-slate-600 transition-colors cursor-pointer"
                    >
                        Hari Ini
                    </button>
                    <button
                        onClick={() => selectRelativeDate(1)}
                        className="flex-1 py-1 px-2 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-[10px] font-black text-slate-600 transition-colors cursor-pointer"
                    >
                        Besok
                    </button>
                </div>

                {/* Month/Year selector header */}
                <div className="flex items-center justify-between py-2">
                    <button
                        onClick={prevMonth}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                        <span className="material-symbols-outlined block" style={{ fontSize: 18 }}>chevron_left</span>
                    </button>
                    <span className="text-xs font-black text-slate-800">
                        {MONTH_NAMES[navMonth]} {navYear}
                    </span>
                    <button
                        onClick={nextMonth}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                        <span className="material-symbols-outlined block" style={{ fontSize: 18 }}>chevron_right</span>
                    </button>
                </div>

                {/* Weekdays */}
                <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-slate-400 py-1">
                    {WEEKDAYS.map((w, idx) => (
                        <div key={idx} className={w === 'Min' ? 'text-rose-500' : ''}>{w}</div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-0.5 mt-0.5">
                    {dayCells.map((d, idx) => {
                        if (d === null) {
                            return <div key={idx} className="aspect-square" />;
                        }
                        
                        const selected = isSelected(d);
                        const isToday = isTodayDate(d);

                        return (
                            <button
                                key={idx}
                                onClick={() => selectDay(d)}
                                className={`aspect-square rounded-lg text-xs font-semibold flex flex-col items-center justify-center relative transition-colors cursor-pointer ${
                                    selected
                                        ? 'bg-blue-600 text-white font-black shadow-sm'
                                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-905'
                                }`}
                            >
                                <span>{d}</span>
                                {isToday && !selected && (
                                    <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
