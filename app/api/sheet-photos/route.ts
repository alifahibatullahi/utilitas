import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToR2, deleteFromR2, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/r2';

/**
 * Foto fitur Critical Maintenance berbasis Sheets (/critical-maintenance).
 * POST: upload foto → R2 + insert row `sheet_photos` (parent = row_uid baris sheet).
 * GET ?uids=a,b,c → daftar foto untuk kumpulan row_uid (hanya baris yang tampil
 * di halaman aktif — jaga beban Supabase free tier tetap kecil).
 */

function getAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function POST(req: NextRequest) {
    const missing: string[] = [];
    if (!process.env.R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
    if (!process.env.R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
    if (!process.env.R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
    if (!process.env.R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME');
    if (!process.env.R2_PUBLIC_URL) missing.push('R2_PUBLIC_URL');
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (missing.length > 0) {
        return NextResponse.json({
            error: `Konfigurasi server belum lengkap. Env hilang: ${missing.join(', ')}. Hubungi admin untuk set env di Vercel/deployment.`,
        }, { status: 500 });
    }

    try {
        const formData   = await req.formData();
        const file       = formData.get('file')        as File   | null;
        const parentKind = formData.get('parent_kind') as string | null;
        const rowUid     = formData.get('row_uid')     as string | null;
        const caption    = formData.get('caption')     as string | null;
        const uploadedBy = formData.get('uploaded_by') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }
        if (parentKind !== 'critical' && parentKind !== 'maintenance') {
            return NextResponse.json({ error: 'parent_kind harus critical atau maintenance' }, { status: 400 });
        }
        if (!rowUid) {
            return NextResponse.json({ error: 'row_uid required' }, { status: 400 });
        }
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Tipe file tidak didukung. Gunakan: JPEG, PNG, WebP, atau GIF' },
                { status: 415 },
            );
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json(
                { error: `Ukuran file terlalu besar. Maksimal ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` },
                { status: 413 },
            );
        }

        const ext        = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const r2Key      = `photos/sheet-${parentKind}/${rowUid}/${uniqueName}`;

        const buffer    = Buffer.from(await file.arrayBuffer());
        const publicUrl = await uploadToR2(r2Key, buffer, file.type);

        const { data, error: dbErr } = await getAdmin()
            .from('sheet_photos')
            .insert({
                parent_kind: parentKind,
                row_uid:     rowUid,
                url:         publicUrl,
                filename:    file.name,
                caption:     caption?.trim() || null,
                uploaded_via: 'app',
                uploaded_by: uploadedBy ?? null,
            })
            .select()
            .single();

        if (dbErr) {
            try { await deleteFromR2(r2Key); } catch { /* best effort */ }
            return NextResponse.json({ error: dbErr.message }, { status: 500 });
        }

        return NextResponse.json({ photo: data }, { status: 201 });
    } catch (err) {
        console.error('[sheet-photos/POST]', err);
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message || 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server tidak terkonfigurasi' }, { status: 500 });
    }
    const uidsParam = req.nextUrl.searchParams.get('uids') ?? '';
    const uids = uidsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100);
    if (uids.length === 0) {
        return NextResponse.json({ photos: [] });
    }

    const { data, error } = await getAdmin()
        .from('sheet_photos')
        .select('id, parent_kind, row_uid, filename, caption, uploaded_by, created_at')
        .in('row_uid', uids)
        .order('created_at', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ photos: data ?? [] });
}
