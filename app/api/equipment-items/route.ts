import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data, error } = await supabase
        .from('equipment_items')
        .select('no_item, deskripsi')
        .order('no_item', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items: string[] = (data ?? []).map((r: { no_item: string; deskripsi: string }) =>
        r.deskripsi ? `${r.no_item} - ${r.deskripsi}` : r.no_item
    );
    return NextResponse.json({ items });
}
