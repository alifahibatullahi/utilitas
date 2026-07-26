'use client';

/**
 * Badge status & scope untuk data sheet — versi lokal /critical-maintenance.
 * Sengaja TIDAK memakai StatusBadge/ScopeBadge fitur critical lama: nilai dari
 * sheet bebas (bukan enum), dan ScopeBadge menarik data Supabase (useHarScopes)
 * yang ingin dihindari di halaman ini.
 */

/**
 * Aksen jenis record — satu sumber warna untuk chip, rail baris, dan tombol filter
 * supaya critical (merah) vs maintenance (hijau) langsung terbaca sekilas. Merah/hijau
 * dipilih karena status badge memakai red/amber/neutral dan scope badge cuma outline,
 * jadi tidak saling menutupi.
 */
export type SheetKind = 'critical' | 'maintenance';

const KIND_STYLE: Record<SheetKind, { label: string; icon: string; chip: string; rail: string; active: string }> = {
    critical: {
        label: 'Critical',
        icon: 'warning',
        chip: 'bg-red-50 text-red-700 border border-red-200',
        rail: 'bg-red-500',
        active: 'bg-red-600 text-white',
    },
    maintenance: {
        label: 'Maintenance',
        icon: 'build',
        chip: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        rail: 'bg-emerald-500',
        active: 'bg-emerald-600 text-white',
    },
};

export function SheetKindBadge({ kind, className = '' }: { kind: SheetKind; className?: string }) {
    const cfg = KIND_STYLE[kind];
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${cfg.chip} ${className}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{cfg.icon}</span>
            {cfg.label}
        </span>
    );
}

/** Warna rail penanda jenis (garis tipis di sisi kiri baris tabel / kartu). */
export function kindRailClass(kind: SheetKind): string {
    return KIND_STYLE[kind].rail;
}

/** Warna tombol filter jenis saat aktif. */
export function kindActiveClass(kind: SheetKind): string {
    return KIND_STYLE[kind].active;
}

const STATUS_STYLE: Record<string, { label: string; cls: string; icon: string }> = {
    ok: { label: 'SELESAI', cls: 'bg-neutral-100 border border-neutral-300 text-neutral-600', icon: 'check_circle' },
    ip: { label: 'IN PROGRESS', cls: 'bg-amber-50 border border-amber-300 text-amber-600', icon: 'pending' },
    open: { label: 'OPEN', cls: 'bg-red-50 border border-red-300 text-red-700', icon: 'error' },
};

function statusStyle(status: string) {
    // Sel status kosong di sheet berarti pekerjaannya belum ditutup → OPEN.
    const key = status.trim().toLowerCase() || 'open';
    return STATUS_STYLE[key] ?? {
        label: status.trim().toUpperCase(),
        cls: 'bg-neutral-100 border border-neutral-300 text-neutral-600',
        icon: 'radio_button_checked',
    };
}

/** Teks status seperti yang tampil di badge — supaya tempat lain (mis. keterangan foto
 *  di lightbox) tidak menuliskan aturan "kosong = OPEN" sendiri lalu ikut melenceng. */
export function statusLabel(status: string): string {
    return statusStyle(status).label;
}

export function SheetStatusBadge({ status, className = '' }: { status: string; className?: string }) {
    const cfg = statusStyle(status);
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${cfg.cls} ${className}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{cfg.icon}</span>
            {cfg.label}
        </span>
    );
}

const SCOPE_COLORS: Record<string, string> = {
    mekanik: 'bg-white border border-blue-200 text-blue-600',
    listrik: 'bg-white border border-amber-300 text-amber-600',
    instrumen: 'bg-white border border-purple-200 text-purple-600',
    sipil: 'bg-white border border-teal-200 text-teal-600',
    las: 'bg-white border border-orange-300 text-orange-600',
};

const SCOPE_FALLBACK = [
    'bg-white border border-rose-200 text-rose-600',
    'bg-white border border-indigo-200 text-indigo-600',
    'bg-white border border-emerald-200 text-emerald-600',
    'bg-white border border-cyan-200 text-cyan-600',
    'bg-white border border-pink-200 text-pink-600',
    'bg-white border border-sky-200 text-sky-600',
    'bg-white border border-fuchsia-200 text-fuchsia-600',
];

export function SheetScopeBadge({ scope, className = '' }: { scope: string; className?: string }) {
    const s = scope.trim();
    if (!s) return null;
    let cls = SCOPE_COLORS[s.toLowerCase()];
    if (!cls) {
        let hash = 0;
        for (const ch of s) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
        cls = SCOPE_FALLBACK[hash % SCOPE_FALLBACK.length];
    }
    return (
        // Tanpa whitespace-nowrap: scope gabungan ("Mekanik, Las") boleh turun baris
        // supaya kolomnya tidak memaksa tabel melebar.
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls} ${className}`}>
            {s}
        </span>
    );
}
