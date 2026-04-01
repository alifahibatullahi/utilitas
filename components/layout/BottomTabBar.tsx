'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { NAV_ITEMS } from '@/lib/constants';

// Material icon mapping
const ICON_MAP: Record<string, string> = {
    dashboard: 'dashboard',
    tank: 'propane_tank',
    edit: 'edit_square',
    warning: 'warning',
    report: 'description',
    daily: 'calendar_month',
    trend: 'history',
    users: 'group',
};

export default function BottomTabBar() {
    const pathname = usePathname();
    const router = useRouter();
    const { operator } = useOperator();

    if (!operator) return null;

    // Show max 5 items in mobile tab bar
    const mobileItems = NAV_ITEMS
        .filter(item => item.roles === 'all' || item.roles.includes(operator.role))
        .slice(0, 5);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-dark/95 backdrop-blur-xl border-t border-slate-800 md:hidden">
            <div className="flex items-center justify-around h-16 px-2">
                {mobileItems.map((item) => {
                    const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                    return (
                        <button
                            key={item.id}
                            onClick={() => router.push(item.path)}
                            className={`flex flex-col items-center gap-0.5 px-2 py-1 cursor-pointer transition-all duration-200
                                ${isActive ? 'scale-105' : 'opacity-60'}`}
                        >
                            <span className={`material-symbols-outlined text-xl ${isActive ? 'text-primary' : 'text-text-secondary'}`}>
                                {ICON_MAP[item.icon] || 'circle'}
                            </span>
                            <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-text-secondary'}`}>
                                {item.label.split(' ')[0]}
                            </span>
                        </button>
                    );
                })}
            </div>
            {/* Safe area padding for phones with notch */}
            <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
    );
}
