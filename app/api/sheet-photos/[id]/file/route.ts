import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Proxy foto sheet_photos dari R2 lewat backend (salinan pola /api/photos/[id]/file).
 * Berguna ketika client network memblokir akses langsung ke domain `*.r2.dev`.
 */
export async function GET(
    _req: NextRequest,
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

    const { data: photo, error: dbErr } = await supabase
        .from('sheet_photos')
        .select('id, url, filename')
        .eq('id', id)
        .single();

    if (dbErr || !photo) {
        return NextResponse.json({ error: 'Foto tidak ditemukan' }, { status: 404 });
    }

    try {
        const upstream = await fetch((photo as { url: string }).url, { cache: 'no-store' });
        if (!upstream.ok || !upstream.body) {
            return NextResponse.json({
                error: `Upstream R2 gagal (status ${upstream.status})`,
            }, { status: 502 });
        }

        const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
        const contentLength = upstream.headers.get('content-length');
        const headers = new Headers({
            'Content-Type': contentType,
            // Foto immutable (URL ber-id unik) → cache panjang di browser & CDN
            'Cache-Control': 'public, max-age=31536000, immutable',
        });
        if (contentLength) headers.set('Content-Length', contentLength);
        headers.set('Content-Disposition', `inline; filename="${(photo as { filename: string }).filename ?? id}"`);

        return new Response(upstream.body, { status: 200, headers });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Gagal fetch dari R2: ${message}` }, { status: 502 });
    }
}
