import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Ambil foto untuk sekumpulan row_uid — POST, bukan GET.
 *
 * Halaman item bisa punya ribuan record (mis. TG-01.01 = 876 baris), dan daftar
 * uid-nya jauh melewati batas panjang URL. Versi GET lama memotong daftarnya di 100
 * uid, sehingga foto milik record LAMA (yang berada di urutan bawah) tidak pernah
 * ikut terambil dan galerinya tampak kosong. Body JSON menghilangkan batas itu, dan
 * satu request tetap = satu invocation.
 */

const MAX_UIDS = 5_000;
// PostgREST menaruh filter `.in()` di query string; ribuan uid sekaligus membuat URL-nya
// membengkak, jadi dipecah per blok dan digabung lagi di sini.
const CHUNK = 200;

export async function POST(req: NextRequest) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server tidak terkonfigurasi' }, { status: 500 });
    }

    let uids: string[];
    try {
        const body = await req.json();
        const raw = Array.isArray(body?.uids) ? body.uids : [];
        uids = Array.from(new Set(raw.filter((u: unknown): u is string => typeof u === 'string' && u.trim() !== '')
            .map((u: string) => u.trim()))).slice(0, MAX_UIDS);
    } catch {
        return NextResponse.json({ error: 'Body harus JSON { uids: string[] }' }, { status: 400 });
    }
    if (uids.length === 0) return NextResponse.json({ photos: [] });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const chunks: string[][] = [];
    for (let i = 0; i < uids.length; i += CHUNK) chunks.push(uids.slice(i, i + CHUNK));

    const results = await Promise.all(chunks.map(chunk => supabase
        .from('sheet_photos')
        // `url` ikut supaya <img> bisa memuat langsung dari R2 (proxy /file hanya fallback,
        // menekan invocation Vercel saat galeri berisi banyak foto).
        .select('id, parent_kind, row_uid, url, filename, caption, uploaded_by, created_at')
        .in('row_uid', chunk)));

    const failed = results.find(r => r.error);
    if (failed?.error) {
        return NextResponse.json({ error: failed.error.message }, { status: 500 });
    }

    const photos = results.flatMap(r => r.data ?? [])
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    return NextResponse.json({ photos });
}
