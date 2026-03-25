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

export const SelectField = ({ label, options, color = "blue", size = "normal", value, onChange, name }: {
    label?: string;
    options: { value: string; label: string }[];
    color?: string;
    size?: string;
    value?: string | null;
    onChange?: (name: string, value: string | null) => void;
    name?: string;
}) => (
    <div className="space-y-1.5 w-full">
        {label && (
            <label className={`font-medium text-[#92a9c9] uppercase tracking-wider block text-left ${size === 'small' ? 'text-[10px]' : 'text-xs'}`}>
                {label}
            </label>
        )}
        <select
            className={`w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-${color}-500 focus:border-${color}-500 text-sm font-mono transition-all appearance-none cursor-pointer`}
            value={value ?? ''}
            onChange={e => onChange?.(name || label || '', e.target.value === '' ? null : e.target.value)}
        >
            <option value="" className="bg-[#101822] text-slate-500">Normal / Berasap...</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#101822] text-white">
                    {opt.label}
                </option>
            ))}
        </select>
    </div>
);

export const Card = ({ title, icon, color = "blue", children, isSidebar = false }: {
    title: string;
    icon: string;
    color?: 'blue' | 'cyan' | 'orange' | 'emerald' | 'purple' | 'indigo' | 'slate' | 'amber' | 'rose' | 'teal' | 'sky';
    children: React.ReactNode;
    isSidebar?: boolean;
}) => {
    const colorMap: Record<string, { icon: string; iconBg: string; headerGradient: string; border: string; glow: string }> = {
        blue:    { icon: 'text-blue-400',    iconBg: 'bg-blue-500/20',    headerGradient: 'from-blue-500/10',    border: 'border-blue-500/20 hover:border-blue-400/40',    glow: 'shadow-blue-500/5 hover:shadow-blue-500/15' },
        cyan:    { icon: 'text-cyan-400',    iconBg: 'bg-cyan-500/20',    headerGradient: 'from-cyan-500/10',    border: 'border-cyan-500/20 hover:border-cyan-400/40',    glow: 'shadow-cyan-500/5 hover:shadow-cyan-500/15' },
        orange:  { icon: 'text-orange-400',  iconBg: 'bg-orange-500/20',  headerGradient: 'from-orange-500/10',  border: 'border-orange-500/20 hover:border-orange-400/40',  glow: 'shadow-orange-500/5 hover:shadow-orange-500/15' },
        emerald: { icon: 'text-emerald-400', iconBg: 'bg-emerald-500/20', headerGradient: 'from-emerald-500/10', border: 'border-emerald-500/20 hover:border-emerald-400/40', glow: 'shadow-emerald-500/5 hover:shadow-emerald-500/15' },
        purple:  { icon: 'text-purple-400',  iconBg: 'bg-purple-500/20',  headerGradient: 'from-purple-500/10',  border: 'border-purple-500/20 hover:border-purple-400/40',  glow: 'shadow-purple-500/5 hover:shadow-purple-500/15' },
        indigo:  { icon: 'text-indigo-400',  iconBg: 'bg-indigo-500/20',  headerGradient: 'from-indigo-500/10',  border: 'border-indigo-500/20 hover:border-indigo-400/40',  glow: 'shadow-indigo-500/5 hover:shadow-indigo-500/15' },
        amber:   { icon: 'text-amber-400',   iconBg: 'bg-amber-500/20',   headerGradient: 'from-amber-500/10',   border: 'border-amber-500/20 hover:border-amber-400/40',   glow: 'shadow-amber-500/5 hover:shadow-amber-500/15' },
        rose:    { icon: 'text-rose-400',    iconBg: 'bg-rose-500/20',    headerGradient: 'from-rose-500/10',    border: 'border-rose-500/20 hover:border-rose-400/40',    glow: 'shadow-rose-500/5 hover:shadow-rose-500/15' },
        teal:    { icon: 'text-teal-400',    iconBg: 'bg-teal-500/20',    headerGradient: 'from-teal-500/10',    border: 'border-teal-500/20 hover:border-teal-400/40',    glow: 'shadow-teal-500/5 hover:shadow-teal-500/15' },
        sky:     { icon: 'text-sky-400',     iconBg: 'bg-sky-500/20',     headerGradient: 'from-sky-500/10',     border: 'border-sky-500/20 hover:border-sky-400/40',     glow: 'shadow-sky-500/5 hover:shadow-sky-500/15' },
        slate:   { icon: 'text-slate-400',   iconBg: 'bg-slate-500/20',   headerGradient: 'from-slate-500/10',   border: 'border-slate-500/20 hover:border-slate-400/40',   glow: 'shadow-slate-500/5 hover:shadow-slate-500/15' },
    };

    const c = colorMap[color] || colorMap.blue;

    return (
        <div className={`bg-[#0f1923]/90 backdrop-blur-md border rounded-xl overflow-hidden flex flex-col group transition-all duration-300 ${c.border} shadow-lg ${c.glow}`}>
            <div className={`p-4 border-b border-slate-800/60 flex items-center gap-3 bg-gradient-to-r ${c.headerGradient} to-transparent shrink-0`}>
                <div className={`p-2 rounded-lg ${c.iconBg} ring-1 ring-white/5`}>
                    <span className={`material-symbols-outlined ${c.icon}`}>{icon}</span>
                </div>
                <h3 className="text-white font-bold text-lg tracking-wide">{title}</h3>
            </div>
            <div className={`${isSidebar ? 'p-4 space-y-2' : 'p-5 space-y-4'} flex flex-col justify-start`}>
                {children}
            </div>
        </div>
    );
};

export const SectionLabel = ({ label, badge }: { label: string; badge?: string }) => (
    <div className="flex items-center gap-2 pt-3 pb-1 first:pt-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        {badge && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 font-medium">{badge}</span>}
        <div className="flex-1 border-t border-slate-700/40" />
    </div>
);

export const SelisihInfo = ({ prev, current }: { prev: number; current: number }) => {
    const diff = current - prev;
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('id-ID');
    return prev > 0 ? (
        <div className="mt-1.5 text-[10px] text-slate-500 space-y-0.5">
            <p>Prev: <span className="text-slate-400 font-medium">{fmt(prev)}</span></p>
            <p>Selisih: <span className={`font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span></p>
        </div>
    ) : null;
};

export const TotalizerInput = ({ label, name, value, prev, onChange, unit, color }: {
    label: string; name: string; value: number | null; prev: number;
    onChange: (n: string, v: number | string | null) => void; unit: string; color: string;
}) => (
    <div>
        <InputField label={`Totalizer ${label}`} name={name} value={value} onChange={onChange} unit={unit} color={color} />
        <SelisihInfo prev={prev} current={Number(value) || 0} />
    </div>
);

export const CalculatedField = ({ label, value = "0.00", unit, variant = "primary" }: {
    label: string;
    value?: string;
    unit: string;
    variant?: 'primary' | 'secondary' | 'small' | 'purple' | 'transparent';
    size?: 'large' | 'medium' | 'small';
}) => {
    const variantStyles = {
        primary: {
            bg: 'bg-emerald-500/10 border-emerald-500/30 p-3',
            label: 'text-emerald-300 text-xs font-bold uppercase tracking-wider',
            value: 'text-emerald-100 font-mono font-black text-2xl tracking-tighter',
            unit: 'text-emerald-400/70 text-xs font-bold',
        },
        secondary: {
            bg: 'bg-sky-500/10 border-sky-500/20 p-3',
            label: 'text-sky-300 text-xs font-medium uppercase tracking-wider',
            value: 'text-sky-100 font-mono font-bold text-xl',
            unit: 'text-sky-400/60 text-xs font-medium',
        },
        small: {
            bg: 'bg-[#1f2b3e]/30 border-slate-700/30 p-2.5',
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
