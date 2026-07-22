/**
 * Spesifikasi item equipment (tabel item_specs).
 * GET ?key=<itemKey>  → baca spec satu item (null bila belum ada).
 * PUT                 → upsert spec (onConflict item_key).
 *
 * Catatan keamanan: identitas app berbasis localStorage (bukan JWT), jadi endpoint
 * tulis ini mempercayai client — sama seperti /api/sheet-photos. UI membatasi tombol
 * Edit ke admin. Konsisten dgn postur app yang sudah ada.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface SpecLine { label: string; value: string }

function getAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

function ensureConfigured(): string | null {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return 'Server tidak terkonfigurasi';
    }
    return null;
}

export async function GET(req: NextRequest) {
    const cfg = ensureConfigured();
    if (cfg) return NextResponse.json({ error: cfg }, { status: 500 });

    const key = (req.nextUrl.searchParams.get('key') ?? '').trim();
    if (!key) return NextResponse.json({ error: 'Parameter key wajib' }, { status: 400 });

    const { data, error } = await getAdmin()
        .from('item_specs')
        .select('*')
        .eq('item_key', key)
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ spec: data ?? null });
}

export async function PUT(req: NextRequest) {
    const cfg = ensureConfigured();
    if (cfg) return NextResponse.json({ error: cfg }, { status: 500 });

    let body: {
        item_key?: string; item_name?: string; variant?: string; code?: string;
        description?: string; specs?: SpecLine[]; updated_by?: string;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 });
    }

    const item_key = (body.item_key ?? '').trim();
    const item_name = (body.item_name ?? '').trim();
    if (!item_key || !item_name) {
        return NextResponse.json({ error: 'item_key dan item_name wajib' }, { status: 400 });
    }

    // Bersihkan specs: hanya baris yang punya label & value.
    const specs = Array.isArray(body.specs)
        ? body.specs
            .map(s => ({ label: (s.label ?? '').trim(), value: (s.value ?? '').trim() }))
            .filter(s => s.label || s.value)
        : [];

    const { data, error } = await getAdmin()
        .from('item_specs')
        .upsert({
            item_key,
            item_name,
            variant: (body.variant ?? '').trim() || null,
            code: (body.code ?? '').trim() || null,
            description: (body.description ?? '').trim() || null,
            specs,
            updated_by: (body.updated_by ?? '').trim() || null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'item_key' })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ spec: data });
}
