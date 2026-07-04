'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AppShellProps {
    children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
    const pathname = usePathname();
    const [isLargeScreen, setIsLargeScreen] = useState(false);

    useEffect(() => {
        // Cek resolusi monitor fisik (bukan viewport CSS)
        const check = () => setIsLargeScreen(window.screen.width >= 1920);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Zoom 125% pada monitor 1920px+ untuk semua halaman kecuali dashboard dan tank-level
    const shouldZoom = isLargeScreen && !pathname.startsWith('/dashboard');

    // Don't show shell on login page, home menu, fullscreen preview, or history data page
    if (pathname === '/' || pathname === '/home' || pathname === '/laporan-shift/preview' || pathname === '/laporan-harian/preview' || pathname === '/kanban' || pathname === '/critical' || pathname === '/tank-level' || pathname === '/history' || pathname.startsWith('/history/')) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-bg-dark">
            {/* Top header — logo + tombol kembali ke menu utama */}
            <div className="h-14 bg-surface-dark border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <div className="bg-primary/20 p-1.5 rounded-lg">
                        <span className="material-symbols-outlined text-primary text-lg">electric_bolt</span>
                    </div>
                    <h1 className="text-white font-bold text-sm">Web UBB</h1>
                </div>
                <Link
                    href="/home"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                        text-text-secondary hover:text-white hover:bg-surface-highlight transition-all"
                >
                    <span className="material-symbols-outlined text-lg">home</span>
                    <span>Menu</span>
                </Link>
            </div>

            {/* Main content area */}
            <main
                className="min-h-screen pb-8"
                style={shouldZoom ? { zoom: 1.25 } : undefined}
            >
                {children}
            </main>
        </div>
    );
}
