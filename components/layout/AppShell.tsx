'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';

interface AppShellProps {
    children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
    const pathname = usePathname();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(pathname === '/tank-level');

    // Don't show shell on login page or fullscreen preview pages
    if (pathname === '/' || pathname === '/laporan-shift/preview' || pathname === '/laporan-harian/preview' || pathname === '/kanban' || pathname === '/critical') {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-bg-dark">
            {/* Sidebar - hidden on mobile */}
            <div className="hidden md:block">
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(prev => !prev)}
                />
            </div>

            {/* Mobile header */}
            <div className="md:hidden h-14 bg-surface-dark border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <div className="bg-primary/20 p-1.5 rounded-lg">
                        <span className="material-symbols-outlined text-primary text-lg">electric_bolt</span>
                    </div>
                    <h1 className="text-white font-bold text-sm">PowerOps</h1>
                </div>
            </div>

            {/* Main content area */}
            <main
                className={`min-h-screen transition-all duration-300 ease-in-out
                    pb-20 md:pb-0
                    ${sidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-[260px]'}`}
            >
                {children}
            </main>

            {/* Bottom tab bar - mobile only */}
            <BottomTabBar />
        </div>
    );
}
