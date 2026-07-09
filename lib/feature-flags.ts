// ─── Feature flags: nonaktifkan fitur SEMENTARA tanpa menghapus kode ───
// Konteks (Jul 2026): hanya 4 fitur yang dipakai — Tank Level, Input Laporan,
// e-Logbook, dan Admin. Fitur lain dinonaktifkan supaya tidak menambah beban
// database (halaman nonaktif tidak me-mount komponen aslinya → 0 query).
// Reaktivasi = ubah flag ke false di sini. Alur review/publish laporan
// (/laporan-shift*, /laporan-harian*) TETAP AKTIF karena bagian dari Input Laporan.
export const DISABLED_FEATURES = {
    dashboard: true,   // /dashboard + /dashboard/[tank]
    history: true,     // /history
    critical: true,    // /critical + /critical/broadcast (+ query maintenance di input laporan)
    kanban: true,      // /kanban
    totaliser: true,   // /totaliser
} as const;

export type DisabledFeatureKey = keyof typeof DISABLED_FEATURES;

/** Path → flag, dipakai untuk menyaring NAV_ITEMS/menu. */
export function isPathDisabled(path: string): boolean {
    if (path.startsWith('/dashboard')) return DISABLED_FEATURES.dashboard;
    if (path.startsWith('/history')) return DISABLED_FEATURES.history;
    if (path.startsWith('/critical')) return DISABLED_FEATURES.critical;
    if (path.startsWith('/kanban')) return DISABLED_FEATURES.kanban;
    if (path.startsWith('/totaliser')) return DISABLED_FEATURES.totaliser;
    return false;
}
