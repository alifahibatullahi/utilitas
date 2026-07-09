'use client';

import Link from 'next/link';

/** Layar pengganti untuk fitur yang dinonaktifkan sementara (lihat lib/feature-flags.ts).
 *  Dirender SEBAGAI GANTI komponen halaman asli sehingga hook fetch-nya tidak pernah
 *  jalan — halaman nonaktif tidak menyentuh database sama sekali. */
export default function FeatureDisabled({ name }: { name: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-3xl shadow-sm px-8 py-12">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
                    <span className="material-symbols-outlined text-3xl text-slate-400">power_settings_new</span>
                </div>
                <h1 className="text-lg font-bold text-slate-800">Fitur {name} dinonaktifkan sementara</h1>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                    Saat ini hanya Tank Level, Input Laporan, e-Logbook, dan Admin yang aktif.
                    Hubungi admin bila fitur ini dibutuhkan kembali.
                </p>
                <Link
                    href="/home"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
                >
                    <span className="material-symbols-outlined text-base">home</span>
                    Kembali ke Menu
                </Link>
            </div>
        </div>
    );
}
