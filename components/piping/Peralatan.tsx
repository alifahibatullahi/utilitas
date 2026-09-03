'use client';

import {
    ELIPS_RX, ELIPS_RY, NodeKotak, PipingNode, SKALA, TIPE_STYLE,
    keTitikPoly, mukaKotak, pecahNama, proyeksi,
} from '@/lib/piping';

/**
 * Satu peralatan dalam proyeksi isometrik.
 *
 * Kotak digambar tiga muka (atas paling terang, muka +y paling gelap) supaya
 * arah pandangnya konsisten dengan seluruh gambar. Silinder tegak jadi elips
 * baku isometrik dengan perbandingan sumbu akar-3 : 1.
 *
 * Peralatan yang perluKonfirmasi digambar bergaris putus-putus — penanda bahwa
 * keberadaan atau namanya masih menunggu koreksi lapangan.
 */
export default function Peralatan({ node, redup, delayMs }: {
    node: PipingNode;
    redup: boolean;
    delayMs: number;
}) {
    const t = TIPE_STYLE[node.tipe];
    const dash = node.perluKonfirmasi ? '5 4' : undefined;
    const label = labelPosisi(node);
    const nama = pecahNama(node.nama);

    return (
        // Dua lapis g: peredupan sorot di luar, animasi masuk di dalam. Kalau
        // digabung, keyframes opacity akan menimpa peredupan inline.
        <g style={{ opacity: redup ? 0.2 : 1, transition: 'opacity 240ms' }}>
            <g className="pp-fade" style={{ animationDelay: `${delayMs}ms` }}>
            {node.penyangga && <Penyangga node={node} />}
            {node.bentuk === 'kotak' ? <Kotak node={node} dash={dash} /> : <Silinder node={node} dash={dash} />}

            {/* Teks diberi halo putih (paint-order) supaya tetap terbaca saat
                melintas di atas garis pipa atau muka peralatan lain. */}
            <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                fontSize={14}
                fontWeight={700}
                fill={t.teks}
                stroke="#ffffff"
                strokeWidth={3.5}
                paintOrder="stroke"
                style={{ pointerEvents: 'none' }}
            >
                {nama.map((b, i) => (
                    <tspan key={b} x={label.x} dy={i === 0 ? 0 : 15}>{b}</tspan>
                ))}
            </text>
            {node.tag && (
                <text
                    x={label.x}
                    y={label.y + 15 * nama.length}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill="#64748b"
                    stroke="#ffffff"
                    strokeWidth={3}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none', letterSpacing: 0.3 }}
                >
                    {node.tag}
                </text>
            )}
            </g>
        </g>
    );
}

/** Label ditaruh di atas puncak peralatan, sejajar sumbu tegaknya. */
function labelPosisi(node: PipingNode): { x: number; y: number } {
    if (node.bentuk === 'silinder') {
        const p = proyeksi([node.pos[0], node.pos[1], node.pos[2] + node.tinggi]);
        return { x: p.x + (node.labelGeser?.x ?? 0), y: p.y - node.jari * ELIPS_RY * SKALA - 12 + (node.labelGeser?.y ?? 0) };
    }
    const [x, y, z] = node.pos;
    const [w, d, h] = node.ukuran;
    const p = proyeksi([x + w / 2, y + d / 2, z + h]);
    return { x: p.x + (node.labelGeser?.x ?? 0), y: p.y - 14 + (node.labelGeser?.y ?? 0) };
}

function Kotak({ node, dash }: { node: NodeKotak; dash?: string }) {
    const t = TIPE_STYLE[node.tipe];
    const muka = mukaKotak(node);
    return (
        <g stroke={t.garis} strokeWidth={1.4} strokeLinejoin="round" strokeDasharray={dash}>
            <polygon points={keTitikPoly(muka.kiri)} fill={t.kiri} />
            <polygon points={keTitikPoly(muka.kanan)} fill={t.kanan} />
            <polygon points={keTitikPoly(muka.atas)} fill={t.atas} />
        </g>
    );
}

function Silinder({ node, dash }: { node: Extract<PipingNode, { bentuk: 'silinder' }>; dash?: string }) {
    const t = TIPE_STYLE[node.tipe];
    const [cx, cy, cz] = node.pos;
    const atas = proyeksi([cx, cy, cz + node.tinggi]);
    const bawah = proyeksi([cx, cy, cz]);
    const rx = node.jari * ELIPS_RX * SKALA;
    const ry = node.jari * ELIPS_RY * SKALA;

    // Urutan gambar: elips alas → badan → elips tutup. Badan menutupi separuh
    // belakang elips alas, jadi garis tersembunyi tidak ikut terlihat.
    const badan = [
        `M ${atas.x - rx} ${atas.y}`,
        `L ${bawah.x - rx} ${bawah.y}`,
        `A ${rx} ${ry} 0 0 0 ${bawah.x + rx} ${bawah.y}`,
        `L ${atas.x + rx} ${atas.y}`,
        'Z',
    ].join(' ');

    return (
        <g stroke={t.garis} strokeWidth={1.4} strokeDasharray={dash}>
            <ellipse cx={bawah.x} cy={bawah.y} rx={rx} ry={ry} fill={t.kiri} />
            <path d={badan} fill={t.kanan} />
            <ellipse cx={atas.x} cy={atas.y} rx={rx} ry={ry} fill={t.atas} />
        </g>
    );
}

/** Kaki penyangga bejana yang terangkat, ditarik lurus ke lantai (z = 0). */
function Penyangga({ node }: { node: PipingNode }) {
    if (node.bentuk === 'silinder') return null;
    const [x, y, z] = node.pos;
    const [w, d] = node.ukuran;
    const kaki: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    return (
        <g stroke="#94a3b8" strokeWidth={1.6} strokeLinecap="round">
            {kaki.map(([a, b]) => {
                const atas = proyeksi([x + a * w, y + b * d, z]);
                const lantai = proyeksi([x + a * w, y + b * d, 0]);
                return <line key={`${a}-${b}`} x1={atas.x} y1={atas.y} x2={lantai.x} y2={lantai.y} />;
            })}
        </g>
    );
}
