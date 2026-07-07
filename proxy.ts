import { NextResponse, type NextRequest } from 'next/server';

// ─── Redirect permanen URL lama /input-shift → /input-laporan ───
// (Menggantikan redirects() di next.config yang tidak bisa memanipulasi query.)
// File ini memakai konvensi PROXY Next.js 16 (pengganti middleware.ts —
// nama file middleware.ts membuat dev server Turbopack 16.1 macet di "Starting...").
//
// Aturan (permintaan user):
// 1. Link reminder LAMA yang tersebar di WA (bawa ?station= / ?mode=harian /
//    ?date/?shift) → diarahkan ke /input-laporan TANPA param tersebut, sehingga
//    modal "Pilih Laporan" auto-terbuka dan USER MEMILIH STATION SENDIRI dari
//    modal (default jenis/tanggal sudah pintar: ikut jendela pengisian, ada
//    badge "Sekarang" + tanda "Terpublish").
// 2. Link review supervisor (?review=1 / ?review=publish) DIPERTAHANKAN UTUH —
//    tetap auto-navigasi ke halaman Review/Publish laporan yang sedang berjalan
//    (termasuk ?mode=harian&review=1 untuk review harian).
//
// Link BARU (/input-laporan?station=...) tidak lewat sini — deep link station
// dari pesan reminder baru tetap berfungsi langsung.
export default function proxy(req: NextRequest) {
    const url = req.nextUrl.clone();
    url.pathname = '/input-laporan';

    const isReviewLink = !!url.searchParams.get('review');
    if (!isReviewLink) {
        url.searchParams.delete('station');
        url.searchParams.delete('mode');
        url.searchParams.delete('date');
        url.searchParams.delete('shift');
    }

    return NextResponse.redirect(url, 308);
}

export const config = {
    matcher: ['/input-shift'],
};
