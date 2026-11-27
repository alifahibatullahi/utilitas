'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeftRight, ArrowRight, ArrowUpRight, BookOpen, BrushCleaning, CalendarDays,
    Clock3, Cylinder, LayoutGrid, LockKeyhole, MessagesSquare, Moon, RefreshCw,
    SquarePen, Sun, Sunset, TriangleAlert, Users, Warehouse, type LucideIcon,
} from 'lucide-react';
import { useOperator } from '@/hooks/useOperator';
import {
    HOME_ADMIN_MENU_ITEMS, HOME_MENU_ITEMS, ROLE_LABELS, detectCurrentShift,
    getGroupForShift, type HomeMenuItem,
} from '@/lib/constants';
import { nowWIB } from '@/lib/utils';
import styles from './home.module.css';
import boilerImage from '../../public/home-boiler.webp';
import danantaraLogo from '../../public/logo/Danantara_Indonesia_(no_SW).png';
import pupukIndonesiaLogo from '../../public/logo/Logo_Pupuk_Indonesia__Persero_-removebg-preview.png';
import petrokimiaLogo from '../../public/logo/logo-PG-agro-trans-small-removebg-preview.png';

const MENU_ICONS: Record<string, LucideIcon> = {
    tank: Cylinder, edit: SquarePen, report: BookOpen, warning: TriangleAlert,
    storage: Warehouse, cleaning: BrushCleaning, forum: MessagesSquare, sync: RefreshCw, users: Users,
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
    const Icon = MENU_ICONS[item.icon] ?? LayoutGrid;
    const openNewTab = item.id === 'history' || /^https?:\/\//.test(item.path);
    const ActionIcon = item.comingSoon ? LockKeyhole : openNewTab ? ArrowUpRight : ArrowRight;
    const baseClass = 'relative grid grid-cols-[auto_1fr_auto] items-center gap-x-3.5 rounded-xl border border-stone-200 bg-white p-4 sm:block sm:p-6';
    const content = (
        <>
            <span className="inline-flex size-10 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-700">
                <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0 sm:mt-4">
                <h3 className="text-[17px] leading-tight font-bold tracking-tight text-stone-900">{item.label}</h3>
                <p className="mt-1 text-sm leading-5 text-stone-600">{item.description}</p>
                {item.comingSoon && <span className="mt-2 block text-xs font-semibold text-slate-500">Segera hadir</span>}
            </div>
            <span className={`${styles.arrow} flex size-7 items-center justify-center rounded-full text-stone-500 sm:absolute sm:top-6 sm:right-6`}>
                <ActionIcon size={15} aria-hidden="true" />
            </span>
        </>
    );

    if (item.comingSoon) return <div className={baseClass} aria-disabled="true">{content}</div>;
    return (
        <Link href={item.path} target={openNewTab ? '_blank' : undefined}
            rel={openNewTab ? 'noopener noreferrer' : undefined}
            className={`${baseClass} ${styles.menuLink}`}>
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
        return <div role="status" className="light-canvas grid min-h-screen place-items-center bg-stone-50 text-sm text-stone-700">Memuat beranda…</div>;
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
        <div className="light-canvas min-h-screen bg-stone-50 pb-12 font-sans text-stone-900">
            <header className="border-b border-stone-200 bg-white">
                <div className={`${wrap} grid min-h-17 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-2 md:grid-cols-[auto_1fr_auto] md:gap-x-5`}>
                    <div className="col-span-full flex items-center justify-center gap-4 border-b border-stone-200 pt-1 pb-3 md:col-span-1 md:border-r md:border-b-0 md:py-0 md:pr-5">
                        <Image src={danantaraLogo} alt="Danantara Indonesia" sizes="122px" className="h-7 w-auto md:h-8" />
                        <Image src={pupukIndonesiaLogo} alt="Pupuk Indonesia" sizes="69px" className="h-7 w-auto md:h-8" />
                        <Image src={petrokimiaLogo} alt="Petrokimia Gresik" sizes="79px" className="h-7 w-auto md:h-8" />
                    </div>
                    <span className="text-base leading-tight font-bold tracking-tight sm:text-lg">Web Utilitas Batubara</span>
                    <button type="button" onClick={() => { logout(); router.push('/'); }}
                        className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-stone-300 px-3 text-xs font-semibold hover:border-stone-500 hover:bg-stone-100 active:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700 sm:px-4 sm:text-sm">
                        <ArrowLeftRight size={16} aria-hidden="true" /> Ganti Operator
                    </button>
                </div>
            </header>

            <main className={`${wrap} pt-5 sm:pt-7`}>
                <section aria-labelledby="home-greeting">
                    <div className="flex items-center justify-between gap-4 py-2 sm:gap-6">
                        <div className="min-w-0">
                            <p className="flex items-center gap-2 text-xs font-medium text-stone-600 sm:text-sm">
                                <CalendarDays size={15} aria-hidden="true" />{today}
                            </p>
                            <h1 id="home-greeting" className="mt-2 text-[clamp(1.6rem,4vw,2.75rem)] leading-tight font-semibold tracking-tight wrap-anywhere">
                                Selamat {greeting}, {operator.name.split(' ')[0]}
                            </h1>
                        </div>
                        <Image src={boilerImage} alt="" sizes="(min-width: 640px) 144px, 64px"
                            className="h-14 w-16 shrink-0 rounded-lg object-cover object-right saturate-50 sm:h-18 sm:w-36" />
                    </div>

                    <dl className="mt-4 grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-3 border-y border-stone-200 py-4 sm:grid-cols-3 sm:divide-x sm:divide-stone-200">
                        <div>
                            <dt className="text-xs font-semibold text-stone-600">Waktu WIB</dt>
                            <dd className="mt-1 flex items-center gap-2 font-bold tabular-nums"><Clock3 size={16} aria-hidden="true" />{clock}</dd>
                        </div>
                        <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:pl-6">
                            <dt className="text-xs font-semibold text-stone-600">Shift aktif</dt>
                            <dd className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-bold"><ShiftIcon size={16} aria-hidden="true" />{shiftLabel} <span className="text-xs font-medium text-stone-600">{shiftTime}</span></dd>
                        </div>
                        <div className="col-start-2 row-start-1 sm:col-start-3 sm:pl-6">
                            <dt className="text-xs font-semibold text-stone-600">Grup piket</dt>
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
                <footer className="mt-7 flex flex-wrap items-center gap-x-2 border-t border-stone-200 pt-4 text-sm text-stone-600">
                    <span>Masuk sebagai <strong className="text-stone-800">{operator.name}</strong></span>
                    <span>· {role}{operator.group && !role.includes(`Group ${operator.group}`) && ` · Grup ${operator.group}`}</span>
                </footer>
            </main>
        </div>
    );
}
