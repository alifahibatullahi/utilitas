import type { Metadata } from 'next';

/**
 * Judul tab browser khusus rute ini. Halamannya sendiri `'use client'`, dan komponen
 * klien tidak boleh mengekspor `metadata` — jadi judulnya dipasang lewat layout ini.
 */
export const metadata: Metadata = {
    title: 'Critical Maintenance Utilitas Batubara',
};

export default function CriticalMaintenanceLayout({ children }: { children: React.ReactNode }) {
    return children;
}
