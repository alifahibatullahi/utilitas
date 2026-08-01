import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Proxy media sheet_photos (foto DAN video) dari R2 lewat backend.
 * Berguna — dan di sini wajib — karena jaringan kantor operator memblokir akses langsung
 * ke domain `*.r2.dev`, sehingga satu-satunya jalan adalah lewat origin aplikasi sendiri.
 *
 * Meneruskan Range request. Ini BUKAN sekadar optimasi: Safari/iOS menolak memutar
 * <video> dari sumber yang tidak menjawab 206 Partial Content, jadi tanpa ini video
 * hanya diam di HP operator, sementara foto tetap tampil normal — gejala yang sangat
 * membingungkan kalau tidak tahu sebabnya.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server tidak terkonfigurasi' }, { status: 500 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: media, error: dbErr } = await supabase
        .from('sheet_photos')
        .select('id, url, filename, mime_type')
        .eq('id', id)
        .single();

    if (dbErr || !media) {
        return NextResponse.json({ error: 'Media tidak ditemukan' }, { status: 404 });
    }

    const row = media as { url: string; filename: string; mime_type: string | null };

    try {
        // Batas waktu WAJIB: kalau R2 tak terjangkau, jaringan yang memblokirnya biasanya
        // menggantung alih-alih menolak. Tanpa ini, permintaan tidak pernah selesai —
        // di browser ubinnya berdenyut selamanya, di Vercel durasi fungsinya ikut terbakar.
        const range = req.headers.get('range');
        const upstream = await fetch(row.url, {
            cache: 'no-store',
            signal: AbortSignal.timeout(15_000),
            headers: range ? { Range: range } : undefined,
        });
        if (!upstream.ok || !upstream.body) {
            return NextResponse.json({
                error: `Upstream R2 gagal (status ${upstream.status})`,
            }, { status: 502 });
        }

        const headers = new Headers({
            // MIME dari DB lebih dipercaya daripada tebakan upstream: berkas .mov yang
            // terunggah sebagai octet-stream tidak akan bisa diputar tanpa tipe yang benar.
            'Content-Type': row.mime_type || upstream.headers.get('content-type') || 'application/octet-stream',
            // URL ber-id unik dan isinya tidak pernah berubah → cache panjang.
            'Cache-Control': 'public, max-age=31536000, immutable',
            // Memberi tahu browser bahwa media ini boleh di-seek.
            'Accept-Ranges': 'bytes',
        });
        for (const h of ['content-length', 'content-range']) {
            const v = upstream.headers.get(h);
            if (v) headers.set(h, v);
        }
        headers.set('Content-Disposition', `inline; filename="${row.filename ?? id}"`);

        // Teruskan status upstream apa adanya: 206 harus tetap 206, bukan dijadikan 200.
        return new Response(upstream.body, { status: upstream.status, headers });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Gagal fetch dari R2: ${message}` }, { status: 502 });
    }
}
