'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { NAV_ITEMS, ROLE_LABELS, ROLE_DOT_COLORS } from '@/lib/constants';

// Material icon mapping for nav items
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

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { operator, logout } = useOperator();

    if (!operator) return null;

    const filteredNav = NAV_ITEMS.filter(item =>
        item.roles === 'all' || item.roles.includes(operator.role)
    );

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    // Group nav items
    const mainNav = filteredNav.filter(item => ['dashboard', 'tank-level', 'input-shift', 'critical'].includes(item.id));
    const reportNav = filteredNav.filter(item => ['laporan-shift', 'laporan-harian'].includes(item.id));
    const systemNav = filteredNav.filter(item => ['history', 'admin-users'].includes(item.id));

    return (
        <aside
            className={`fixed left-0 top-0 h-full z-40 flex flex-col
                bg-surface-dark border-r border-slate-800
                transition-all duration-300 ease-in-out
                ${collapsed ? 'w-[68px]' : 'w-[260px]'}`}
        >
            {/* Header */}
            <div className={`h-16 flex items-center px-5 border-b border-slate-800 ${collapsed ? 'justify-center' : 'gap-3'}`}>
                <div
                    className="bg-primary/20 p-2 rounded-lg flex-shrink-0 cursor-pointer"
                    onClick={() => router.push('/dashboard')}
                >
                    <span className="material-symbols-outlined text-primary">electric_bolt</span>
                </div>
                {!collapsed && (
                    <div className="overflow-hidden">
                        <h1 className="text-white text-lg font-bold leading-none tracking-tight">PowerOps</h1>
                        <p className="text-text-secondary text-xs font-medium">Operator Panel</p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1">
                {mainNav.map((item) => {
                    const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                    return (
                        <button
                            key={item.id}
                            onClick={() => router.push(item.path)}
                            title={collapsed ? item.label : undefined}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                                transition-all duration-200 cursor-pointer
                                ${isActive
                                    ? 'bg-primary/20 text-primary border border-primary/10'
                                    : 'text-text-secondary hover:bg-surface-highlight hover:text-white border border-transparent'
                                }
                                ${collapsed ? 'justify-center' : ''}`}
                        >
                            <span className="material-symbols-outlined">{ICON_MAP[item.icon] || 'circle'}</span>
                            {!collapsed && <span>{item.label}</span>}
                        </button>
                    );
                })}

                {reportNav.length > 0 && (
                    <>
                        {!collapsed && (
                            <div className="px-3 py-2 mt-2">
                                <p className="text-xs font-bold text-text-secondary/50 uppercase tracking-wider">Reports</p>
                            </div>
                        )}
                        {reportNav.map((item) => {
                            const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => router.push(item.path)}
                                    title={collapsed ? item.label : undefined}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                                        transition-all duration-200 cursor-pointer
                                        ${isActive
                                            ? 'bg-primary/20 text-primary border border-primary/10'
                                            : 'text-text-secondary hover:bg-surface-highlight hover:text-white border border-transparent'
                                        }
                                        ${collapsed ? 'justify-center' : ''}`}
                                >
                                    <span className="material-symbols-outlined">{ICON_MAP[item.icon] || 'circle'}</span>
                                    {!collapsed && <span>{item.label}</span>}
                                </button>
                            );
                        })}
                    </>
                )}

                {systemNav.length > 0 && (
                    <>
                        {!collapsed && (
                            <div className="px-3 py-2 mt-2">
                                <p className="text-xs font-bold text-text-secondary/50 uppercase tracking-wider">System</p>
                            </div>
                        )}
                        {systemNav.map((item) => {
                            const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => router.push(item.path)}
                                    title={collapsed ? item.label : undefined}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                                        transition-all duration-200 cursor-pointer
                                        ${isActive
                                            ? 'bg-primary/20 text-primary border border-primary/10'
                                            : 'text-text-secondary hover:bg-surface-highlight hover:text-white border border-transparent'
                                        }
                                        ${collapsed ? 'justify-center' : ''}`}
                                >
                                    <span className="material-symbols-outlined">{ICON_MAP[item.icon] || 'circle'}</span>
                                    {!collapsed && <span>{item.label}</span>}
                                </button>
                            );
                        })}
                    </>
                )}
            </nav>

            {/* User info & controls */}
            <div className="border-t border-slate-800 p-3 space-y-2">
                {/* User */}
                {!collapsed ? (
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-surface-highlight/50">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300 border border-slate-600 flex-shrink-0">
                            {operator.name.charAt(0)}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{operator.name}</p>
                            <p className="text-xs text-text-secondary flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ROLE_DOT_COLORS[operator.role]}`} />
                                <span className="truncate">{ROLE_LABELS[operator.role]}</span>
                                {operator.group && <span className="text-[10px] text-primary/80 ml-0.5">({operator.group})</span>}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center" title={`${operator.name} — ${ROLE_LABELS[operator.role]}`}>
                        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-600">
                            {operator.name.charAt(0)}
                        </div>
                    </div>
                )}

                {/* Ganti Operator */}
                <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary
                        hover:text-amber-400 hover:bg-amber-500/10 transition-all duration-200 cursor-pointer
                        ${collapsed ? 'justify-center' : ''}`}
                    title="Ganti Operator"
                >
                    <span className="material-symbols-outlined text-lg">swap_horiz</span>
                    {!collapsed && <span>Ganti Operator</span>}
                </button>

                {/* Toggle collapse */}
                <button
                    onClick={onToggle}
                    className="w-full flex items-center justify-center py-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-surface-highlight transition-all cursor-pointer"
                    title={collapsed ? 'Expand' : 'Collapse'}
                >
                    <span className={`material-symbols-outlined text-lg transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}>
                        chevron_left
                    </span>
                </button>
            </div>
        </aside>
    );
}
