import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Proxy foto dari R2 lewat backend.
 * Berguna ketika client network memblokir akses langsung ke domain `*.r2.dev`.
 * Client request: GET /api/photos/{id}/file
 * Server: lookup URL dari DB → fetch dari R2 → stream balik ke client.
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
        .from('photos')
        .select('id, url, filename')
        .eq('id', id)
        .single();

    if (dbErr || !photo) {
        return NextResponse.json({ error: 'Foto tidak ditemukan' }, { status: 404 });
    }

    try {
        const upstream = await fetch((photo as { url: string }).url, {
            // Edge runtimes umumnya mendukung native fetch streaming
            cache: 'no-store',
        });

        if (!upstream.ok || !upstream.body) {
            return NextResponse.json({
                error: `Upstream R2 gagal (status ${upstream.status})`,
            }, { status: 502 });
        }

        // Stream body langsung ke client
        const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
        const contentLength = upstream.headers.get('content-length');
        const headers = new Headers({
            'Content-Type': contentType,
            // Cache 1 tahun di browser & CDN (foto immutable — URL dengan id unik)
            'Cache-Control': 'public, max-age=31536000, immutable',
        });
        if (contentLength) headers.set('Content-Length', contentLength);
        // Set filename untuk download
        headers.set('Content-Disposition', `inline; filename="${(photo as { filename: string }).filename ?? id}"`);

        return new Response(upstream.body, { status: 200, headers });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({
            error: `Gagal fetch dari R2: ${message}`,
        }, { status: 502 });
    }
}
