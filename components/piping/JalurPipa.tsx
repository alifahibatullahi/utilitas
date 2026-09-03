'use client';

import {
    FLUIDA, PipingLine, Ruas, Titik, Vec3,
    keD, proyeksi, ruasLayar, ruasTerpanjang, sudutTeks, tagLine, tengah,
} from '@/lib/piping';

/** Ruas sependek ini tidak diberi panah — panahnya akan menutupi ruasnya sendiri. */
const PANJANG_MIN_PANAH = 26;
const MAKS_PANAH = 3;

/**
 * Satu jalur pipa: rangkaian ruas siku-siku 3D yang sudah diproyeksikan.
 * Garis penuh = rute dipastikan, putus-putus = masih menunggu konfirmasi.
 *
 * Tag line digambar terpisah (TagJalur) supaya bisa dilukis setelah peralatan
 * dan tidak pernah tertutup kotak.
 */
export default function JalurPipa({ line, rute, redup, delayMs }: {
    line: PipingLine;
    rute: Vec3[];
    redup: boolean;
    delayMs: number;
}) {
    if (rute.length < 2) return null;
    const warna = FLUIDA[line.fluida].warna;
    const ruas = ruasLayar(rute);
    const d = keD(rute.map(proyeksi));
    const draft = !!line.perluKonfirmasi;

    return (
        <g style={{ opacity: redup ? 0.08 : 1, transition: 'opacity 240ms' }}>
            <title>{`${tagLine(line)} — ${line.catatan ?? ''}`.trim()}</title>

            {/* Garis putih di bawah pipa: pemutus visual saat dua pipa bersilangan. */}
            <path d={d} fill="none" stroke="#ffffff" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
            <path
                className={draft ? 'pp-fade' : 'pp-draw'}
                style={{ animationDelay: `${delayMs}ms` }}
                pathLength={draft ? undefined : 1}
                d={d}
                fill="none"
                stroke={warna}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={draft ? '9 7' : undefined}
            />

            {panahTerpilih(ruas).map((r, i) => (
                <Panah key={i} ruas={r} warna={warna} delayMs={delayMs + 320} />
            ))}
        </g>
    );
}

/** Panah arah aliran di ruas-ruas terpanjang, maksimal tiga per jalur. */
function panahTerpilih(ruas: Ruas[]): Ruas[] {
    return [...ruas]
        .filter(r => r.panjang >= PANJANG_MIN_PANAH)
        .sort((a, b) => b.panjang - a.panjang)
        .slice(0, MAKS_PANAH);
}

function Panah({ ruas, warna, delayMs }: { ruas: Ruas; warna: string; delayMs: number }) {
    const t = tengah(ruas);
    return (
        <polygon
            className="pp-fade"
            style={{ animationDelay: `${delayMs}ms` }}
            points="-5,-4.5 6,0 -5,4.5"
            fill={warna}
            transform={`translate(${t.x} ${t.y}) rotate(${ruas.sudut})`}
        />
    );
}

/**
 * Tag line sesuai konvensi gambar piping: <ukuran>"-<SERVICE>-<nomor>,
 * ditulis sejajar pipanya di ruas terpanjang.
 */
export function TagJalur({ line, rute, redup, delayMs }: {
    line: PipingLine;
    rute: Vec3[];
    redup: boolean;
    delayMs: number;
}) {
    if (rute.length < 2) return null;
    const ruas = ruasTerpanjang(ruasLayar(rute));
    if (!ruas || ruas.panjang < 30) return null;

    const t = tengah(ruas);
    const sudut = sudutTeks(ruas.sudut);
    const warna = FLUIDA[line.fluida].warna;
    const geser: Titik = { x: 0, y: -9 };

    return (
        // Peredupan di g luar, animasi masuk di teksnya — keyframes opacity
        // akan menimpa opacity inline kalau dipasang di elemen yang sama.
        <g style={{ opacity: redup ? 0.08 : 1, transition: 'opacity 240ms' }}>
            <text
                className="pp-fade"
                style={{ animationDelay: `${delayMs}ms` }}
                transform={`translate(${t.x} ${t.y}) rotate(${sudut}) translate(${geser.x} ${geser.y})`}
                textAnchor="middle"
                fontSize={11.5}
                fontWeight={700}
                fill={warna}
                stroke="#ffffff"
                strokeWidth={3.2}
                paintOrder="stroke"
                letterSpacing={0.2}
            >
                {tagLine(line)}
            </text>
        </g>
    );
}
