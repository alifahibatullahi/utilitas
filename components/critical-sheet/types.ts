/** Tipe client untuk viewer /critical-maintenance (item-centric; mirror payload API). */

export interface SheetCritical {
    uid: string;
    rowIndex: number;
    no: number | null;
    tanggal: string | null;
    tanggalRaw: string;
    pelapor: string;
    item: string;
    varian: string;
    uraian: string;
    notif: string;
    scope: string;
    status: string;
    tanggalOk: string | null;
    tanggalOkRaw: string;
    pengOk: string;
    gabungan: string;
    linkFoto: string;
}

export interface SheetMaintenance {
    uid: string;
    rowIndex: number;
    no: number | null;
    tanggal: string | null;
    tanggalRaw: string;
    shift: string;
    item: string;
    varian: string;
    uraian: string;
    scope: string;
    status: string;
    notifikasi: string;
    foreman: string;
    gabungan: string;
    linkFoto: string;
}

export interface ItemDetailResponse {
    key: string;
    itemName: string;
    variant: string;
    code: string;
    criticals: SheetCritical[];
    maintenances: SheetMaintenance[];
    fetchedAt: string;
    error?: string;
}

export interface SpecLine { label: string; value: string }

export interface ItemSpec {
    id: string;
    item_key: string;
    item_name: string;
    variant: string | null;
    code: string | null;
    description: string | null;
    specs: SpecLine[];
    updated_by: string | null;
    updated_at: string;
}

export interface SheetPhoto {
    id: string;
    parent_kind: 'critical' | 'maintenance';
    row_uid: string;
    /** URL publik R2 — dipakai langsung oleh <img>; proxy /file jadi fallback. */
    url: string;
    filename: string;
    caption: string | null;
    uploaded_by: string | null;
    created_at: string;
}

/** Sumber gambar: R2 langsung, dengan proxy backend sebagai cadangan.
 *  Proxy tetap diperlukan untuk jaringan yang memblokir domain `*.r2.dev`. */
export function photoSrc(photo: SheetPhoto): string {
    return photo.url || photoProxySrc(photo.id);
}

export function photoProxySrc(id: string): string {
    return `/api/sheet-photos/${id}/file`;
}

/** Satu baris daftar record. Kolom khas satu tab diisi '' di tab lainnya
 *  (shift → maintenance, tanggalOk → critical). */
export interface RecentEntry {
    uid: string;
    kind: 'critical' | 'maintenance';
    tanggal: string | null;
    tanggalRaw: string;
    shift: string;
    itemName: string;
    variant: string;
    code: string;
    uraian: string;
    notifikasi: string;
    scope: string;
    status: string;
    pelapor: string;
    tanggalOkRaw: string;
    itemKey: string;
}

export interface RecentResponse {
    items: RecentEntry[];
    total: number;
    page: number;
    pageSize: number;
    fetchedAt: string;
    error?: string;
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

export async function fetchRecent(params: { kind?: 'all' | 'critical' | 'maintenance'; q?: string; page?: number; pageSize?: number }): Promise<RecentResponse> {
    const qs = new URLSearchParams();
    if (params.kind) qs.set('kind', params.kind);
    if (params.q) qs.set('q', params.q);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    const res = await fetch(`/api/critical-maintenance/recent?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal memuat aktivitas terbaru');
    return json as RecentResponse;
}

export async function fetchItemDetail(key: string): Promise<ItemDetailResponse> {
    const res = await fetch(`/api/critical-maintenance/item?key=${encodeURIComponent(key)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal memuat detail item');
    return json as ItemDetailResponse;
}

export async function fetchItemSpec(key: string): Promise<ItemSpec | null> {
    const res = await fetch(`/api/item-specs?key=${encodeURIComponent(key)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal memuat spesifikasi');
    return (json.spec ?? null) as ItemSpec | null;
}

export async function saveItemSpec(payload: {
    item_key: string; item_name: string; variant?: string; code?: string;
    description?: string; specs: SpecLine[]; updated_by?: string;
}): Promise<ItemSpec> {
    const res = await fetch('/api/item-specs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal menyimpan spesifikasi');
    return json.spec as ItemSpec;
}

/**
 * Ambil foto untuk sekumpulan row_uid. POST karena satu item bisa punya ratusan sampai
 * ribuan record — daftar uid sepanjang itu tidak muat di query string.
 */
export async function fetchSheetPhotos(uids: string[]): Promise<SheetPhoto[]> {
    const clean = uids.filter(Boolean);
    if (clean.length === 0) return [];
    const res = await fetch('/api/sheet-photos/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids: clean }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal memuat foto');
    return (json.photos ?? []) as SheetPhoto[];
}
