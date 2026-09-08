'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AppShellProps {
    children: React.ReactNode;
}

// Prefix rute yang latarnya terang. Dipakai untuk latar shell sekaligus warna
// tombol Menu melayang — tombol gelap di atas halaman putih terlihat salah.
const LIGHT_ROUTES = ['/logbook', '/admin', '/coal-storage', '/piping'];

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

    // Bar atas (logo + Menu) DIHAPUS di semua halaman (permintaan user). Navigasi ke
    // /home diganti tombol Menu floating kiri-bawah — kecuali input-laporan yang sudah
    // punya tombol Menu di grup floating kanan-bawah miliknya sendiri, serta
    // coal-storage & piping yang punya tombol home di header berlogo masing-masing.
    const hasOwnMenuButton = pathname.startsWith('/input-laporan')
        || pathname.startsWith('/coal-storage')
        || pathname.startsWith('/piping');

    // Rute bertema terang. Konversi tema memang bertahap per halaman, jadi daftar ini
    // tumbuh sedikit demi sedikit; halaman yang sengaja tetap gelap (tank-level,
    // input-laporan, alur review/publish laporan) TIDAK boleh masuk sini.
    const isLight = LIGHT_ROUTES.some(p => pathname === p || pathname.startsWith(`${p}/`));

    // Don't show shell on login page, home menu, fullscreen preview, or history data page
    if (pathname === '/' || pathname === '/home' || pathname === '/laporan-shift/preview' || pathname === '/laporan-harian/preview' || pathname === '/kanban' || pathname === '/critical' || pathname.startsWith('/critical-maintenance') || pathname === '/tank-level' || pathname === '/history' || pathname.startsWith('/history/')) {
        return <>{children}</>;
    }

    return (
        <div className={`min-h-screen ${isLight ? 'light-canvas bg-neutral-50' : 'bg-bg-dark'}`}>
            {/* Tombol Menu floating — di luar <main> supaya tidak terpengaruh zoom
                (position:fixed di dalam subtree ber-zoom meleset di Chrome). */}
            {!hasOwnMenuButton && (
                <Link
                    href="/home"
                    aria-label="Kembali ke Menu"
                    title="Kembali ke Menu"
                    className={`fixed bottom-5 left-5 z-40 flex items-center justify-center w-12 h-12 rounded-full shadow-lg backdrop-blur-sm transition-all hover:scale-[1.05] active:scale-[0.95] ${
                        isLight
                            ? 'bg-white/90 hover:bg-neutral-100 text-slate-500 border border-neutral-300'
                            : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600/60'
                    }`}
                >
                    <span className="material-symbols-outlined text-[22px]">home</span>
                </Link>
            )}

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
