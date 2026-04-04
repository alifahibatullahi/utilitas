import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToR2, deleteFromR2, keyFromUrl, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/r2';

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    const formData      = await req.formData();
    const file          = formData.get('file')           as File   | null;
    const criticalId    = formData.get('critical_id')    as string | null;
    const maintId       = formData.get('maintenance_id') as string | null;
    const uploadedBy    = formData.get('uploaded_by')    as string | null;

    // ── Validation ──
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!criticalId && !maintId) {
      return NextResponse.json({ error: 'critical_id or maintenance_id required' }, { status: 400 });
    }
    if (criticalId && maintId) {
      return NextResponse.json({ error: 'Only one parent ID allowed' }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipe file tidak didukung. Gunakan: JPEG, PNG, WebP, atau GIF` },
        { status: 415 },
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Ukuran file terlalu besar. Maksimal ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` },
        { status: 413 },
      );
    }

    // ── Build R2 key ──
    const ext        = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const prefix     = criticalId ? 'critical' : 'maintenance';
    const parentId   = criticalId ?? maintId;
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const r2Key      = `photos/${prefix}/${parentId}/${uniqueName}`;

    // ── Upload to R2 ──
    const buffer    = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadToR2(r2Key, buffer, file.type);

    // ── Insert Supabase row ──
    const { data, error: dbErr } = await supabaseAdmin
      .from('photos')
      .insert({
        critical_id:    criticalId    ?? null,
        maintenance_id: maintId       ?? null,
        url:            publicUrl,
        filename:       file.name,
        uploaded_via:   'app',
        uploaded_by:    uploadedBy    ?? null,
      })
      .select()
      .single();

    if (dbErr) {
      // DB failed — clean up orphaned R2 object
      try { await deleteFromR2(r2Key); } catch { /* best effort */ }
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ photo: data }, { status: 201 });

  } catch (err) {
    console.error('[upload/POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
