'use client';
import React from 'react';

export const InputField = ({ label, placeholder = "0.0", unit, color = "blue", size = "normal", value, onChange, name }: {
    label?: string;
    placeholder?: string;
    unit?: string;
    color?: string;
    size?: string;
    value?: number | string | null;
    onChange?: (name: string, value: number | string | null) => void;
    name?: string;
}) => (
    <div className="space-y-1.5 w-full">
        {label && (
            <label className={`font-medium text-[#92a9c9] uppercase tracking-wider block text-left ${size === 'small' ? 'text-[10px]' : 'text-xs'}`}>
                {label}
            </label>
        )}
        <div className="relative">
            <input
                className={`w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 pl-3 ${unit ? 'pr-12' : 'pr-3'} text-white placeholder-slate-500 focus:ring-1 focus:ring-${color}-500 focus:border-${color}-500 text-sm font-mono transition-all text-left`}
                placeholder={placeholder}
                type="number"
                value={value ?? ''}
                onChange={e => onChange?.(name || label || '', e.target.value === '' ? null : parseFloat(e.target.value))}
            />
            {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">{unit}</span>}
        </div>
    </div>
);

export const Card = ({ title, icon, color = "blue", children, isSidebar = false }: {
    title: string;
    icon: string;
    color?: 'blue' | 'cyan' | 'orange' | 'emerald' | 'purple' | 'indigo' | 'slate';
    children: React.ReactNode;
    isSidebar?: boolean;
}) => {
    const colorMap = {
        blue: 'text-blue-500 bg-blue-500/10',
        cyan: 'text-cyan-500 bg-cyan-500/10',
        orange: 'text-orange-500 bg-orange-500/10',
        emerald: 'text-emerald-500 bg-emerald-500/10',
        purple: 'text-purple-500 bg-purple-500/10',
        indigo: 'text-indigo-500 bg-indigo-500/10',
        slate: 'text-slate-400 bg-slate-500/10',
    };

    const borderMap = {
        blue: 'hover:border-blue-500/30',
        cyan: 'hover:border-cyan-500/30',
        orange: 'hover:border-orange-500/30',
        emerald: 'hover:border-emerald-500/30',
        purple: 'hover:border-purple-500/30',
        indigo: 'hover:border-indigo-500/30',
        slate: 'hover:border-slate-500/30',
    };

    return (
        <div className={`bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-sm flex flex-col group transition-colors duration-300 ${borderMap[color]} ${isSidebar ? 'h-full' : ''}`}>
            <div className={`p-4 border-b border-slate-800/80 flex items-center gap-3 bg-gradient-to-r from-[#1f2b3e]/50 to-transparent ${isSidebar ? 'shrink-0' : ''}`}>
                <div className={`p-2 rounded-lg ${colorMap[color].split(' ')[1]}`}>
                    <span className={`material-symbols-outlined ${colorMap[color].split(' ')[0]}`}>{icon}</span>
                </div>
                <h3 className="text-white font-bold text-lg tracking-wide">{title}</h3>
            </div>
            <div className={`p-5 space-y-4 flex-1 flex flex-col justify-start ${isSidebar ? 'overflow-y-auto scrollbar-hide' : ''}`}>
                {children}
            </div>
        </div>
    );
};

export const CalculatedField = ({ label, value = "0.00", unit, variant = "primary", size = "large" }: {
    label: string;
    value?: string;
    unit: string;
    variant?: 'primary' | 'secondary' | 'small' | 'purple' | 'transparent';
    size?: 'large' | 'medium' | 'small';
}) => {
    const variantStyles = {
        primary: {
            bg: 'bg-[#1f2b3e]/40 border-slate-600/50 p-3',
            label: 'text-white text-xs font-bold uppercase tracking-wider',
            value: 'text-white font-mono font-black text-2xl tracking-tighter',
            unit: 'text-slate-400 text-xs font-bold',
        },
        secondary: {
            bg: 'bg-[#1f2b3e]/20 border-slate-700/30 p-3',
            label: 'text-[#92a9c9] text-xs font-medium uppercase tracking-wider',
            value: 'text-white font-mono font-bold text-xl',
            unit: 'text-slate-500 text-xs font-medium',
        },
        small: {
            bg: 'bg-[#1f2b3e]/20 border-slate-700/30 p-2.5',
            label: 'text-[#92a9c9] text-[10px] font-medium uppercase tracking-wider',
            value: 'text-white font-mono font-bold text-sm',
            unit: 'text-slate-500 text-[10px] font-medium',
        },
        purple: {
            bg: 'bg-purple-500/10 border-purple-500/30 p-3 mt-auto',
            label: 'text-purple-400 text-xs font-bold uppercase tracking-wider',
            value: 'text-purple-300 font-mono font-black text-2xl',
            unit: 'text-purple-500/80 text-xs font-bold',
        },
        transparent: {
            bg: 'bg-transparent border-slate-700/50 p-2.5',
            label: 'text-[#92a9c9] text-xs font-bold uppercase tracking-wider',
            value: 'text-white font-mono font-black text-2xl',
            unit: 'text-slate-400 text-xs font-bold',
        }
    };

    const s = variantStyles[variant];

    return (
        <div className={`flex flex-col gap-1 rounded-lg border ${s.bg}`}>
            <span className={`text-left ${s.label}`}>{label}</span>
            <div className="flex items-baseline justify-between w-full">
                <span className={`${s.value}`}>{value}</span>
                <span className={`${s.unit}`}>{unit}</span>
            </div>
        </div>
    );
};
