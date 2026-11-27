'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeftRight, ArrowRight, ArrowUpRight, BookOpen, BrushCleaning, CalendarDays,
    Clock3, Cylinder, LayoutGrid, LockKeyhole, MessagesSquare, Moon, RefreshCw,
    SquarePen, Sun, Sunset, TriangleAlert, Users, Warehouse, Zap, type LucideIcon,
} from 'lucide-react';
import { useOperator } from '@/hooks/useOperator';
import {
    HOME_ADMIN_MENU_ITEMS, HOME_MENU_ITEMS, ROLE_LABELS, detectCurrentShift,
    getGroupForShift, type HomeMenuItem,
} from '@/lib/constants';
import { nowWIB } from '@/lib/utils';
import boilerImage from '../../public/home-boiler.webp';

const MENU_STYLES: Record<string, { icon: LucideIcon; color: string }> = {
    tank: { icon: Cylinder, color: 'bg-sky-100 text-sky-700' },
    edit: { icon: SquarePen, color: 'bg-emerald-100 text-emerald-700' },
    report: { icon: BookOpen, color: 'bg-violet-100 text-violet-700' },
    warning: { icon: TriangleAlert, color: 'bg-amber-100 text-amber-800' },
    storage: { icon: Warehouse, color: 'bg-orange-100 text-orange-800' },
    cleaning: { icon: BrushCleaning, color: 'bg-teal-100 text-teal-700' },
    forum: { icon: MessagesSquare, color: 'bg-green-100 text-green-700' },
    sync: { icon: RefreshCw, color: 'bg-blue-100 text-blue-700' },
    users: { icon: Users, color: 'bg-indigo-100 text-indigo-700' },
};

const SHIFT_INFO = {
    pagi: { label: 'Shift 1 · Pagi', time: '07.00–15.00', icon: Sun },
    sore: { label: 'Shift 2 · Sore', time: '15.00–23.00', icon: Sunset },
    malam: { label: 'Shift 3 · Malam', time: '23.00–07.00', icon: Moon },
};

const GROUP_DOT: Record<string, string> = {
    A: 'bg-cyan-500', B: 'bg-blue-500', C: 'bg-violet-500', D: 'bg-emerald-500', ND: 'bg-amber-500',
};

function MenuCard({ item }: { item: HomeMenuItem }) {
    const { icon: Icon, color } = MENU_STYLES[item.icon] ?? { icon: LayoutGrid, color: 'bg-slate-100 text-slate-700' };
    const openNewTab = item.id === 'history' || /^https?:\/\//.test(item.path);
    const ActionIcon = item.comingSoon ? LockKeyhole : openNewTab ? ArrowUpRight : ArrowRight;
    const baseClass = 'group relative grid grid-cols-[auto_1fr_auto] items-center gap-x-4 rounded-2xl border border-[#d5dfd9] bg-white p-4 sm:block sm:p-5';
    const content = (
        <>
            <span className={`inline-flex size-11 items-center justify-center rounded-xl ${color}`}>
                <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0 sm:mt-4">
                <h3 className="text-[17px] leading-tight font-bold tracking-tight text-[#19382f]">{item.label}</h3>
                <p className="mt-1 text-sm leading-5 text-[#51665d]">{item.description}</p>
                {item.comingSoon && <span className="mt-2 block text-xs font-semibold text-slate-500">Segera hadir</span>}
            </div>
            <span className="flex size-7 items-center justify-center rounded-full border border-[#dae4de] text-[#4c685c] group-hover:border-emerald-700 group-hover:text-emerald-800 sm:absolute sm:top-5 sm:right-5">
                <ActionIcon size={15} aria-hidden="true" />
            </span>
        </>
    );

    if (item.comingSoon) return <div className={baseClass} aria-disabled="true">{content}</div>;
    return (
        <Link href={item.path} target={openNewTab ? '_blank' : undefined}
            rel={openNewTab ? 'noopener noreferrer' : undefined}
            className={`${baseClass} hover:border-emerald-700 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700`}>
            {content}
        </Link>
    );
}

export default function HomePage() {
    const { operator, loading, logout } = useOperator();
    const router = useRouter();
    const [now, setNow] = useState(nowWIB);

    useEffect(() => {
        if (!loading && !operator) router.replace('/');
    }, [loading, operator, router]);

    useEffect(() => {
        const timer = setInterval(() => setNow(nowWIB()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (loading) {
        return <div role="status" className="light-canvas grid min-h-screen place-items-center bg-[#f5f7f4] text-sm text-emerald-900">Memuat beranda…</div>;
    }
    if (!operator) return null;

    const visible = (item: HomeMenuItem) => item.roles === 'all' || item.roles.includes(operator.role);
    const menus = HOME_MENU_ITEMS.filter(visible);
    const adminMenus = HOME_ADMIN_MENU_ITEMS.filter(visible);
    const role = ROLE_LABELS[operator.role];
    const hour = now.getHours();
    const greeting = hour < 4 || hour >= 19 ? 'malam' : hour < 11 ? 'pagi' : hour < 15 ? 'siang' : 'sore';
    const current = detectCurrentShift(now);
    const activeGroup = getGroupForShift(current.date, current.shift) || 'ND';
    const { label: shiftLabel, time: shiftTime, icon: ShiftIcon } = SHIFT_INFO[current.shift];
    const today = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const clock = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const wrap = 'mx-auto w-full max-w-6xl px-4 sm:px-7 lg:px-10';
    const menuGrid = 'mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3';

    return (
        <div className="light-canvas min-h-screen bg-[#f5f7f4] pb-12 font-sans text-[#19382f]">
            <header className="border-b border-[#dce4de] bg-white">
                <div className={`${wrap} flex min-h-17 items-center justify-between gap-3 py-2`}>
                    <div className="flex items-center gap-2.5">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#133e32] text-[#c2ec86]">
                            <Zap size={23} fill="currentColor" strokeWidth={1.6} aria-hidden="true" />
                        </span>
                        <span className="text-base leading-tight font-bold tracking-tight sm:text-lg">Web Utilitas Batubara</span>
                    </div>
                    <button type="button" onClick={() => { logout(); router.push('/'); }}
                        className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[#cfdbd3] px-3 text-xs font-semibold hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700 sm:px-4 sm:text-sm">
                        <ArrowLeftRight size={16} aria-hidden="true" /> Ganti Operator
                    </button>
                </div>
            </header>

            <main className={`${wrap} pt-5 sm:pt-7`}>
                <section aria-labelledby="home-greeting" className="overflow-hidden rounded-3xl border border-[#d5dfd9] bg-white">
                    <div className="relative isolate flex min-h-52 flex-col justify-center overflow-hidden bg-[#123e35] p-6 sm:min-h-58 sm:px-10">
                        <Image src={boilerImage} alt="" fill preload sizes="(min-width: 1152px) 1072px, 100vw"
                            className="-z-20 object-cover object-[68%_55%]" />
                        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-[#092e27]/95 via-[#092e27]/60 to-transparent" />
                        <div className="flex items-center gap-2 text-sm font-medium text-white">
                            <CalendarDays size={16} className="text-[#c9e9a6]" aria-hidden="true" />
                            {today}
                        </div>
                        <h1 id="home-greeting" className="mt-4 text-4xl leading-[1.08] font-semibold tracking-tight text-white sm:text-5xl">
                            Selamat {greeting}, <span className="block break-words text-[#d6f4ae]">{operator.name.split(' ')[0]}</span>
                        </h1>
                    </div>

                    <dl className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-4 px-6 py-5 sm:grid-cols-3 sm:divide-x sm:divide-[#dde6df] sm:px-10">
                        <div>
                            <dt className="text-xs font-semibold text-[#596c61]">Waktu WIB</dt>
                            <dd className="mt-1 flex items-center gap-2 font-bold tabular-nums"><Clock3 size={16} aria-hidden="true" />{clock}</dd>
                        </div>
                        <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:pl-6">
                            <dt className="text-xs font-semibold text-[#596c61]">Shift aktif</dt>
                            <dd className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-bold"><ShiftIcon size={16} aria-hidden="true" />{shiftLabel} <span className="text-xs font-medium text-[#596c61]">{shiftTime}</span></dd>
                        </div>
                        <div className="col-start-2 row-start-1 sm:col-start-3 sm:pl-6">
                            <dt className="text-xs font-semibold text-[#596c61]">Grup piket</dt>
                            <dd className="mt-1 flex items-center gap-2 font-bold"><span aria-hidden="true" className={`size-2 rounded-full ${GROUP_DOT[activeGroup] ?? GROUP_DOT.ND}`} />Grup {activeGroup}</dd>
                        </div>
                    </dl>
                </section>

                <nav aria-labelledby="operational-heading" className="mt-8 sm:mt-9">
                    <h2 id="operational-heading" className="text-2xl font-bold tracking-tight">Menu operasional</h2>
                    <div className={menuGrid}>
                        {menus.map(item => <MenuCard key={item.id} item={item} />)}
                    </div>
                </nav>
                {adminMenus.length > 0 && (
                    <nav aria-labelledby="admin-heading" className="mt-8">
                        <h2 id="admin-heading" className="text-2xl font-bold tracking-tight">Administrasi</h2>
                        <div className={menuGrid}>
                            {adminMenus.map(item => <MenuCard key={item.id} item={item} />)}
                        </div>
                    </nav>
                )}
                <footer className="mt-7 flex flex-wrap items-center gap-x-2 border-t border-[#d5dfd9] pt-4 text-sm text-[#52665b]">
                    <span>Masuk sebagai <strong className="text-[#284438]">{operator.name}</strong></span>
                    <span>· {role}{operator.group && !role.includes(`Group ${operator.group}`) && ` · Grup ${operator.group}`}</span>
                </footer>
            </main>
        </div>
    );
}
