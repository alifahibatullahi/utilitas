import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteFromR2, keyFromUrl } from '@/lib/r2';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { id } = await params;

  // Fetch the row first to get the R2 URL
  const { data: photo, error: fetchErr } = await supabaseAdmin
    .from('photos')
    .select('id, url')
    .eq('id', id)
    .single();

  if (fetchErr || !photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  // Delete from Supabase
  const { error: dbErr } = await supabaseAdmin
    .from('photos')
    .delete()
    .eq('id', id);

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  // Delete from R2 (best effort — DB row is already gone)
  try {
    await deleteFromR2(keyFromUrl(photo.url));
  } catch (r2Err) {
    console.warn('[delete-photo] R2 delete failed (DB row removed):', r2Err);
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { id } = await params;
  let body: { caption?: string | null } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.caption !== 'string' && body.caption !== null) {
    return NextResponse.json({ error: 'caption must be string or null' }, { status: 400 });
  }

  const { data, error: dbErr } = await supabaseAdmin
    .from('photos')
    .update({ caption: body.caption })
    .eq('id', id)
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ photo: data });
}
