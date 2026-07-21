/** Tipe client untuk viewer /critical-maintenance (mirror payload API). */

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
    refNo: number | null;
    refRaw: string;
}

export interface SheetPhoto {
    id: string;
    parent_kind: 'critical' | 'maintenance';
    row_uid: string;
    filename: string;
    caption: string | null;
    uploaded_by: string | null;
    created_at: string;
}

export interface SheetDataResponse<T> {
    view: 'critical' | 'maintenance';
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    scopes: string[];
    fetchedAt: string;
    error?: string;
}

export async function fetchSheetData<T>(params: Record<string, string | number>): Promise<SheetDataResponse<T>> {
    const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    );
    const res = await fetch(`/api/critical-maintenance/data?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal memuat data');
    return json as SheetDataResponse<T>;
}

/** Ambil foto untuk sekumpulan row_uid (dipanggil per halaman yang tampil saja). */
export async function fetchSheetPhotos(uids: string[]): Promise<SheetPhoto[]> {
    const clean = uids.filter(Boolean);
    if (clean.length === 0) return [];
    const res = await fetch(`/api/sheet-photos?uids=${encodeURIComponent(clean.join(','))}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal memuat foto');
    return (json.photos ?? []) as SheetPhoto[];
}
