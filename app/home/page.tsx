'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { HOME_MENU_ITEMS, HOME_ADMIN_MENU_ITEMS, ROLE_LABELS, ROLE_DOT_COLORS, HomeMenuItem, detectCurrentShift, getGroupForShift } from '@/lib/constants';

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

const CARD_THEMES: Record<string, { iconBg: string; iconText: string; hoverBorder: string }> = {
    'tank-level': { iconBg: 'bg-sky-50', iconText: 'text-sky-500', hoverBorder: 'hover:border-sky-200' },
    'input-laporan': { iconBg: 'bg-emerald-50', iconText: 'text-emerald-500', hoverBorder: 'hover:border-emerald-200' },
    'logbook': { iconBg: 'bg-violet-50', iconText: 'text-violet-500', hoverBorder: 'hover:border-violet-200' },
    'admin-wa-hub': { iconBg: 'bg-teal-50', iconText: 'text-teal-500', hoverBorder: 'hover:border-teal-200' },
    'admin-sync-sheets': { iconBg: 'bg-blue-50', iconText: 'text-blue-500', hoverBorder: 'hover:border-blue-200' },
    'admin-users': { iconBg: 'bg-amber-50', iconText: 'text-amber-500', hoverBorder: 'hover:border-amber-200' },
};

const DEFAULT_THEME = { iconBg: 'bg-slate-50', iconText: 'text-slate-500', hoverBorder: 'hover:border-slate-300' };

const SHIFT_INFO_MAP = {
    pagi: { label: 'Shift 1 · Pagi', time: '07:00 – 15:00', icon: 'light_mode', color: 'text-amber-500' },
    sore: { label: 'Shift 2 · Sore', time: '15:00 – 23:00', icon: 'wb_twilight', color: 'text-orange-500' },
    malam: { label: 'Shift 3 · Malam', time: '23:00 – 07:00', icon: 'dark_mode', color: 'text-indigo-500' },
};

const GROUP_DOT: Record<string, string> = {
    A: 'bg-cyan-500', B: 'bg-blue-500', C: 'bg-violet-500', D: 'bg-emerald-500', ND: 'bg-amber-500',
};

const pad = (n: number) => String(n).padStart(2, '0');

function MenuCard({ item, delayMs }: { item: HomeMenuItem; delayMs: number }) {
    const openNewTab = item.id === 'history';
    const theme = CARD_THEMES[item.id] || DEFAULT_THEME;
    return (
        <Link
            href={item.path}
            target={openNewTab ? '_blank' : undefined}
            rel={openNewTab ? 'noopener noreferrer' : undefined}
            style={{ animationDelay: `${delayMs}ms` }}
            className={`group p-5 rounded-2xl border border-slate-200 ${theme.hoverBorder} bg-white
                hover:-translate-y-1 hover:shadow-md shadow-sm transition-all duration-300 ease-out
                cursor-pointer home-fade-up
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2`}
        >
            <div className="flex items-start justify-between">
                <div className={`w-11 h-11 rounded-xl ${theme.iconBg} flex items-center justify-center`}>
                    <span aria-hidden="true" className={`material-symbols-outlined text-xl ${theme.iconText} icon-wiggle`}>
                        {ICON_MAP[item.icon] || 'circle'}
                    </span>
                </div>
                <span aria-hidden="true" className="material-symbols-outlined text-lg text-slate-200 group-hover:text-slate-500 group-hover:translate-x-1 transition-all duration-300">
                    arrow_forward
                </span>
            </div>
            <p className="font-bold text-slate-800 mt-4">{item.label}</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
        </Link>
    );
}

export default function HomePage() {
    const { operator, loading, logout } = useOperator();
    const router = useRouter();
    const [now, setNow] = useState<Date>(() => new Date());

    useEffect(() => {
        if (!loading && !operator) router.replace('/');
    }, [loading, operator, router]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="animate-pulse text-slate-400 font-semibold text-sm">Loading...</div>
            </div>
        );
    }
    if (!operator) return null;

    const menus = HOME_MENU_ITEMS.filter(item =>
        item.roles === 'all' || item.roles.includes(operator.role)
    );
    const adminMenus = HOME_ADMIN_MENU_ITEMS.filter(item =>
        item.roles === 'all' || item.roles.includes(operator.role)
    );

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    const today = now.toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    const hour = now.getHours();
    const greeting = hour < 4 ? 'Selamat malam'
        : hour < 11 ? 'Selamat pagi'
        : hour < 15 ? 'Selamat siang'
        : hour < 19 ? 'Selamat sore'
        : 'Selamat malam';

    const currentInfo = detectCurrentShift();
    const activeGroup = getGroupForShift(currentInfo.date, currentInfo.shift) || 'ND';
    const shiftInfo = SHIFT_INFO_MAP[currentInfo.shift] || SHIFT_INFO_MAP.pagi;
    const groupDot = GROUP_DOT[activeGroup] || GROUP_DOT.ND;

    return (
        <div className="min-h-screen bg-white pb-16">
            <style>{`
                @keyframes homeFadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .home-fade-up {
                    opacity: 0;
                    animation: homeFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes waveHand {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(18deg); }
                    40% { transform: rotate(-8deg); }
                    60% { transform: rotate(14deg); }
                    80% { transform: rotate(-4deg); }
                }
                .wave-hand {
                    display: inline-block;
                    transform-origin: 70% 70%;
                    animation: waveHand 1.4s ease-in-out 0.5s 2;
                }
                @keyframes iconWiggle {
                    0%, 100% { transform: rotate(0deg) scale(1.15); }
                    25% { transform: rotate(-10deg) scale(1.15); }
                    75% { transform: rotate(10deg) scale(1.15); }
                }
                .group:hover .icon-wiggle {
                    animation: iconWiggle 0.5s ease-in-out;
                }
                @keyframes colonBlink {
                    50% { opacity: 0.25; }
                }
                .clock-colon {
                    animation: colonBlink 1s steps(1) infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                    .home-fade-up, .wave-hand, .clock-colon, .group:hover .icon-wiggle {
                        animation: none;
                        opacity: 1;
                    }
                }
            `}</style>

            {/* Header */}
            <header className="bg-white/90 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-primary/10 p-2 rounded-xl">
                            <span aria-hidden="true" className="material-symbols-outlined text-primary text-xl">electric_bolt</span>
                        </div>
                        <h1 className="text-slate-800 text-base font-bold tracking-tight">Web Utilitas Batubara</h1>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500
                            hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer active:scale-95
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                        title="Ganti Operator"
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-base">swap_horiz</span>
                        <span className="hidden min-[420px]:inline">Ganti Operator</span>
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-5 pt-10">
                {/* Greeting */}
                <div className="home-fade-up">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                        {greeting}, {operator.name.split(' ')[0]} <span className="wave-hand">👋</span>
                    </h2>
                    <p className="text-sm text-slate-400 mt-1.5">{today}</p>
                </div>

                {/* Status strip: jam + shift + grup */}
                <div className="mt-6 p-4 rounded-2xl border border-slate-100 bg-slate-50/60 home-fade-up" style={{ animationDelay: '80ms' }}>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                        {/* Jam */}
                        <p className="text-xl font-bold text-slate-800 tabular-nums" title="Waktu Indonesia Barat">
                            {pad(now.getHours())}<span className="clock-colon">:</span>{pad(now.getMinutes())}
                            <span className="text-xs font-semibold text-slate-400 ml-1.5">WIB</span>
                        </p>

                        <span className="hidden sm:block w-px h-6 bg-slate-200" />

                        {/* Shift aktif */}
                        <div className="flex items-center gap-2">
                            <span aria-hidden="true" className={`material-symbols-outlined text-lg ${shiftInfo.color}`}>{shiftInfo.icon}</span>
                            <p className="text-sm font-semibold text-slate-600">
                                {shiftInfo.label}
                                <span className="text-slate-400 font-medium ml-1.5 text-xs">{shiftInfo.time}</span>
                            </p>
                        </div>

                        <span className="hidden sm:block w-px h-6 bg-slate-200" />

                        {/* Grup piket */}
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${groupDot} animate-pulse`} />
                            <p className="text-sm font-semibold text-slate-600">Grup {activeGroup}</p>
                        </div>
                    </div>
                </div>

                {/* Menu Cards */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {menus.map((item, idx) => (
                        <MenuCard key={item.id} item={item} delayMs={160 + idx * 70} />
                    ))}
                </div>

                {/* Admin section — hanya role admin */}
                {adminMenus.length > 0 && (
                    <>
                        <div className="mt-10 flex items-center gap-3 home-fade-up" style={{ animationDelay: `${160 + menus.length * 70}ms` }}>
                            <span aria-hidden="true" className="material-symbols-outlined text-lg text-slate-400">admin_panel_settings</span>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Admin</p>
                            <span className="flex-1 h-px bg-slate-100" />
                        </div>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {adminMenus.map((item, idx) => (
                                <MenuCard key={item.id} item={item} delayMs={230 + (menus.length + idx) * 70} />
                            ))}
                        </div>
                    </>
                )}

                {/* Operator footer */}
                <div className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-400 home-fade-up" style={{ animationDelay: '400ms' }}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ROLE_DOT_COLORS[operator.role]}`} />
                    <span>
                        Masuk sebagai <span className="font-semibold text-slate-500">{operator.name}</span>
                        {' · '}{ROLE_LABELS[operator.role]}
                        {operator.group && !ROLE_LABELS[operator.role].includes(`Group ${operator.group}`) ? ` · Grup ${operator.group}` : ''}
                    </span>
                </div>
            </main>
        </div>
    );
}
