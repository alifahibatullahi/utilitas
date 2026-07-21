import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteFromR2, keyFromUrl } from '@/lib/r2';

/** DELETE: hapus foto sheet_photos (objek R2 + row). PATCH: ubah caption. */

function getAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server tidak terkonfigurasi' }, { status: 500 });
    }
    const supabase = getAdmin();

    const { data: photo, error: findErr } = await supabase
        .from('sheet_photos')
        .select('id, url')
        .eq('id', id)
        .single();
    if (findErr || !photo) {
        return NextResponse.json({ error: 'Foto tidak ditemukan' }, { status: 404 });
    }

    try { await deleteFromR2(keyFromUrl((photo as { url: string }).url)); } catch { /* best effort */ }

    const { error: delErr } = await supabase.from('sheet_photos').delete().eq('id', id);
    if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server tidak terkonfigurasi' }, { status: 500 });
    }
    let body: { caption?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 });
    }

    const { data, error } = await getAdmin()
        .from('sheet_photos')
        .update({ caption: body.caption?.trim() || null })
        .eq('id', id)
        .select()
        .single();
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ photo: data });
}
