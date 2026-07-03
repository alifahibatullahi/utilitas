'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { HOME_MENU_ITEMS, ROLE_LABELS, ROLE_DOT_COLORS, HomeMenuItem, detectCurrentShift, getGroupForShift } from '@/lib/constants';

const ICON_MAP: Record<string, string> = {
    dashboard: 'dashboard',
    tank: 'propane_tank',
    edit: 'edit_square',
    warning: 'warning',
    report: 'description',
    daily: 'calendar_month',
    trend: 'history',
    users: 'group',
    forum: 'forum',
    campaign: 'campaign',
    sync: 'sync',
};

const CARD_THEMES: Record<string, {
    border: string;
    hoverBorder: string;
    iconBg: string;
    iconText: string;
    hoverShadow: string;
    hoverBg: string;
    accentBar: string;
}> = {
    'tank-level': {
        border: 'border-sky-100',
        hoverBorder: 'hover:border-sky-300',
        iconBg: 'bg-sky-50 group-hover:bg-sky-100',
        iconText: 'text-sky-600',
        hoverShadow: 'hover:shadow-sky-200/50',
        hoverBg: 'hover:bg-sky-50/10',
        accentBar: 'bg-sky-500'
    },
    'input-shift': {
        border: 'border-emerald-100',
        hoverBorder: 'hover:border-emerald-300',
        iconBg: 'bg-emerald-50 group-hover:bg-emerald-100',
        iconText: 'text-emerald-600',
        hoverShadow: 'hover:shadow-emerald-200/50',
        hoverBg: 'hover:bg-emerald-50/10',
        accentBar: 'bg-emerald-500'
    },
    'logbook': {
        border: 'border-violet-100',
        hoverBorder: 'hover:border-violet-300',
        iconBg: 'bg-violet-50 group-hover:bg-violet-100',
        iconText: 'text-violet-600',
        hoverShadow: 'hover:shadow-violet-200/50',
        hoverBg: 'hover:bg-violet-50/10',
        accentBar: 'bg-violet-500'
    }
};

const DEFAULT_THEME = {
    border: 'border-slate-200/60',
    hoverBorder: 'hover:border-primary/30',
    iconBg: 'bg-primary/5 group-hover:bg-primary/10',
    iconText: 'text-primary',
    hoverShadow: 'hover:shadow-primary/5',
    hoverBg: 'hover:bg-primary/5',
    accentBar: 'bg-primary'
};

const SHIFT_INFO_MAP = {
    pagi: {
        label: 'Shift 1 (Pagi)',
        time: '07:00 – 15:00 WIB',
        icon: 'light_mode',
        color: 'text-amber-700 bg-amber-50 border-amber-200/60',
    },
    sore: {
        label: 'Shift 2 (Siang/Sore)',
        time: '15:00 – 23:00 WIB',
        icon: 'wb_twilight',
        color: 'text-orange-700 bg-orange-50 border-orange-200/60',
    },
    malam: {
        label: 'Shift 3 (Malam)',
        time: '23:00 – 07:00 WIB',
        icon: 'dark_mode',
        color: 'text-indigo-700 bg-indigo-50 border-indigo-200/60',
    },
};

const GROUP_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    A: { bg: 'bg-cyan-50/50', text: 'text-cyan-700', border: 'border-cyan-200/60', dot: 'bg-cyan-500' },
    B: { bg: 'bg-blue-50/50', text: 'text-blue-700', border: 'border-blue-200/60', dot: 'bg-blue-500' },
    C: { bg: 'bg-violet-50/50', text: 'text-violet-700', border: 'border-violet-200/60', dot: 'bg-violet-500' },
    D: { bg: 'bg-emerald-50/50', text: 'text-emerald-700', border: 'border-emerald-200/60', dot: 'bg-emerald-500' },
    ND: { bg: 'bg-amber-50/50', text: 'text-amber-700', border: 'border-amber-200/60', dot: 'bg-amber-500' },
};

function MenuCard({ item, featured }: { item: HomeMenuItem; featured: boolean }) {
    const openNewTab = item.id === 'history';
    const theme = CARD_THEMES[item.id] || DEFAULT_THEME;
    return (
        <Link
            href={item.path}
            target={openNewTab ? '_blank' : undefined}
            rel={openNewTab ? 'noopener noreferrer' : undefined}
            className={`group relative flex flex-col justify-between rounded-2xl border ${theme.border} ${theme.hoverBorder} bg-white/95 backdrop-blur-sm
                shadow-[0_4px_20px_rgba(0,0,0,0.02)] ${theme.hoverShadow} ${theme.hoverBg} hover:-translate-y-1
                transition-all duration-350 cursor-pointer
                ${featured ? 'p-5 min-h-[160px]' : 'p-4 min-h-[130px]'}`}
        >
            {/* Top color accent strip */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl ${theme.accentBar}`} />

            <div className="space-y-3">
                <div className={`rounded-xl ${theme.iconBg} flex items-center justify-center flex-shrink-0
                    transition-all duration-300 w-11 h-11 border border-slate-100 shadow-inner group-hover:scale-105`}
                >
                    <span className={`material-symbols-outlined ${theme.iconText} ${featured ? 'text-2xl' : 'text-xl'}`}>
                        {ICON_MAP[item.icon] || 'circle'}
                    </span>
                </div>
                <div className="min-w-0">
                    <p className="font-extrabold text-slate-800 tracking-tight text-base sm:text-lg">{item.label}</p>
                    <p className="text-slate-500 mt-1 text-xs leading-relaxed line-clamp-2">{item.description}</p>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-slate-700 transition-colors">
                <span>Buka Menu</span>
                <span className="material-symbols-outlined text-[16px] translate-x-0 group-hover:translate-x-1.5 transition-transform duration-300">
                    arrow_forward
                </span>
            </div>
        </Link>
    );
}

export default function HomePage() {
    const { operator, loading, logout } = useOperator();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !operator) router.replace('/');
    }, [loading, operator, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-pulse text-slate-400 font-semibold text-sm">Loading...</div>
            </div>
        );
    }
    if (!operator) return null;

    const menus = HOME_MENU_ITEMS.filter(item =>
        item.roles === 'all' || item.roles.includes(operator.role)
    );
    const featured = menus.filter(m => m.featured);
    const others = menus.filter(m => !m.featured);

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    const today = new Date().toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    // Get current shift and active group information
    const currentInfo = detectCurrentShift();
    const activeGroup = getGroupForShift(currentInfo.date, currentInfo.shift) || 'ND';
    const shiftInfo = SHIFT_INFO_MAP[currentInfo.shift] || SHIFT_INFO_MAP.pagi;
    const groupStyle = GROUP_STYLE[activeGroup] || GROUP_STYLE.ND;

    return (
        <div className="min-h-screen bg-gradient-to-tr from-slate-50 via-slate-100/70 to-blue-50/30 relative overflow-hidden pb-12">
            {/* Background decorative glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-[100px]" />
                <div className="absolute top-1/3 -left-40 w-80 h-80 rounded-full bg-cyan-500/5 blur-[80px]" />
                <div className="absolute -bottom-40 right-1/4 w-96 h-96 rounded-full bg-violet-500/5 blur-[120px]" />
            </div>

            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-xl border border-primary/20 shadow-sm shadow-primary/5">
                            <span className="material-symbols-outlined text-primary text-xl font-black">electric_bolt</span>
                        </div>
                        <div>
                            <h1 className="text-slate-800 text-base font-black leading-none tracking-tight">PowerOps</h1>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Control Center</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {/* Desktop Quick Role Summary */}
                        <div className="hidden sm:flex items-center gap-3 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl">
                            <div className={`w-2.5 h-2.5 rounded-full ${ROLE_DOT_COLORS[operator.role]} shadow-sm shadow-slate-300`} />
                            <div className="text-left">
                                <p className="text-xs font-black text-slate-700 leading-none">{operator.name.split(' ')[0]}</p>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{ROLE_LABELS[operator.role]}</p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 bg-white
                                hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                            title="Ganti Operator"
                        >
                            <span className="material-symbols-outlined text-base">swap_horiz</span>
                            <span>Ganti Operator</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-4 py-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Greeting */}
                        <div className="bg-white/40 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/50">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Halo, {operator.name.split(' ')[0]} 👋</h2>
                            <p className="text-sm text-slate-500 mt-1.5 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_month</span>
                                {today} — silakan pilih menu di bawah untuk memulai pekerjaan Anda.
                            </p>
                        </div>

                        {/* Menu Cards */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-1.5 h-4 bg-primary rounded-full" />
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Menu Utama</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {featured.map(item => <MenuCard key={item.id} item={item} featured />)}
                            </div>
                        </div>

                        {others.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-1.5 h-4 bg-slate-300 rounded-full" />
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lainnya</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {others.map(item => <MenuCard key={item.id} item={item} featured={false} />)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar/Side Panel Column */}
                    <div className="space-y-6">
                        {/* Operational Shift Widget */}
                        <div className="bg-white/85 backdrop-blur-md p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                <span className="material-symbols-outlined text-primary text-xl">schedule</span>
                                <h3 className="text-sm font-black text-slate-800 tracking-tight">Jadwal Shift Dinas</h3>
                            </div>

                            <div className="space-y-3">
                                {/* Shift Type Info */}
                                <div className={`flex items-center gap-3 p-3 rounded-xl border ${shiftInfo.color}`}>
                                    <span className="material-symbols-outlined text-2xl shrink-0">{shiftInfo.icon}</span>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider opacity-85">Shift Aktif</p>
                                        <p className="text-sm font-black mt-0.5">{shiftInfo.label}</p>
                                        <p className="text-[11px] opacity-75 font-semibold">{shiftInfo.time}</p>
                                    </div>
                                </div>

                                {/* Group on Duty Info */}
                                <div className={`flex items-center justify-between p-3 rounded-xl border ${groupStyle.border} ${groupStyle.bg}`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`w-3 h-3 rounded-full ${groupStyle.dot} animate-pulse`} />
                                        <div>
                                            <p className={`text-xs font-bold uppercase tracking-wider ${groupStyle.text} opacity-85`}>Grup Piket</p>
                                            <p className={`text-sm font-black mt-0.5 ${groupStyle.text}`}>Group {activeGroup}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${groupStyle.border} ${groupStyle.bg} shrink-0 uppercase tracking-widest`}>
                                        ON DUTY
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Active Operator Detail Profile */}
                        <div className="bg-white/85 backdrop-blur-md p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                <span className="material-symbols-outlined text-primary text-xl">badge</span>
                                <h3 className="text-sm font-black text-slate-800 tracking-tight">Operator Aktif</h3>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                                    <span className="text-lg font-black">{operator.name.charAt(0)}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-black text-slate-800 truncate" title={operator.name}>{operator.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${ROLE_DOT_COLORS[operator.role]}`} />
                                        {ROLE_LABELS[operator.role]}
                                    </p>
                                    {operator.nik && (
                                        <p className="text-[10px] text-slate-400 mt-1 font-mono">NIK: {operator.nik}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                        {operator.company && operator.company !== 'UBB' && (
                                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-600 uppercase tracking-wider border border-slate-200">
                                                {operator.company}
                                            </span>
                                        )}
                                        {operator.group && (
                                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary/10 text-primary uppercase tracking-wider border border-primary/20`}>
                                                Grup {operator.group}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

