'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { HOME_MENU_ITEMS, ROLE_LABELS, ROLE_DOT_COLORS, HomeMenuItem } from '@/lib/constants';

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

function MenuCard({ item, featured }: { item: HomeMenuItem; featured: boolean }) {
    const openNewTab = item.id === 'history';
    return (
        <Link
            href={item.path}
            target={openNewTab ? '_blank' : undefined}
            rel={openNewTab ? 'noopener noreferrer' : undefined}
            className={`group flex flex-col rounded-2xl border border-slate-200 bg-white
                shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40
                transition-all duration-200 cursor-pointer
                ${featured ? 'p-5 gap-3' : 'p-4 gap-2'}`}
        >
            <div className={`rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0
                group-hover:bg-primary/15 transition-colors
                ${featured ? 'w-12 h-12' : 'w-9 h-9'}`}
            >
                <span className={`material-symbols-outlined text-primary ${featured ? 'text-2xl' : 'text-lg'}`}>
                    {ICON_MAP[item.icon] || 'circle'}
                </span>
            </div>
            <div className="min-w-0">
                <p className={`font-semibold text-slate-800 ${featured ? 'text-base' : 'text-sm'}`}>{item.label}</p>
                <p className={`text-slate-500 mt-0.5 ${featured ? 'text-xs' : 'text-[11px]'} line-clamp-2`}>{item.description}</p>
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
                <div className="animate-pulse text-slate-400">Loading...</div>
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

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <span className="material-symbols-outlined text-primary">electric_bolt</span>
                        </div>
                        <div>
                            <h1 className="text-slate-800 text-lg font-bold leading-none tracking-tight">PowerOps</h1>
                            <p className="text-slate-400 text-xs font-medium mt-0.5">Operator Panel</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex flex-col items-end">
                            <p className="text-sm font-medium text-slate-700 leading-tight">{operator.name}</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${ROLE_DOT_COLORS[operator.role]}`} />
                                {ROLE_LABELS[operator.role]}
                                {operator.group && <span className="text-primary/80">({operator.group})</span>}
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-500
                                hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                            title="Ganti Operator"
                        >
                            <span className="material-symbols-outlined text-lg">swap_horiz</span>
                            <span className="hidden md:inline">Ganti Operator</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-slate-800">Halo, {operator.name.split(' ')[0]} 👋</h2>
                    <p className="text-sm text-slate-500 mt-1">{today} — pilih menu untuk mulai bekerja.</p>
                </div>

                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Menu Utama</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
                    {featured.map(item => <MenuCard key={item.id} item={item} featured />)}
                </div>

                {others.length > 0 && (
                    <>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Lainnya</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {others.map(item => <MenuCard key={item.id} item={item} featured={false} />)}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
