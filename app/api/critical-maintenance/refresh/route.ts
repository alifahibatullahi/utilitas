/**
 * POST /api/critical-maintenance/refresh — paksa muat ulang data dari Google Sheets
 * (tombol "Perbarui data"). Loader dipanggil dengan force sehingga TTL cache
 * in-memory diabaikan dan respons berikutnya sudah fresh.
 */

import { NextResponse } from 'next/server';
import { loadCriticalSheet } from '@/lib/critical-sheet';

export async function POST() {
    try {
        const data = await loadCriticalSheet(true); // force: abaikan TTL cache
        return NextResponse.json({ ok: true, fetchedAt: data.fetchedAt });
    } catch (err) {
        console.error('[critical-maintenance/refresh]', err);
        const message = err instanceof Error ? err.message : 'Gagal memuat ulang data sheet';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
