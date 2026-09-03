'use client';

import { useMemo } from 'react';
import {
    Batas, DIAGRAM_MIN_WIDTH_PX, FluidKey, PipingLine, PipingNode, Titik,
    batasKosong, kedalaman, petaNode, proyeksi, pusatNode, ruteLine, tambahBatas, titikNode,
} from '@/lib/piping';
import Peralatan from './Peralatan';
import JalurPipa, { TagJalur } from './JalurPipa';

const PADDING = 34;
/** Jarak antar garis lantai, dalam satuan plant. */
const GRID_STEP = 10;
/**
 * Grid sengaja dibuat jauh lebih luas daripada isi gambar supaya sudut-sudut
 * bingkai tetap kebagian lantai — persegi panjang di koordinat plant jatuh
 * sebagai belah ketupat di layar. Kelebihannya dipotong clipPath, jadi grid
 * tidak pernah ikut memperbesar viewBox.
 */
const GRID_MARGIN = 60;

/**
 * Kanvas gambar isometrik.
 *
 * Urutan lukis dijaga supaya gambar tetap terbaca:
 *   1. lantai (grid isometrik sebagai acuan ruang)
 *   2. jalur pipa + panah arah aliran
 *   3. peralatan, diurutkan dari yang terjauh ke yang terdekat mata
 *   4. tag line — selalu paling atas supaya tidak pernah tertutup kotak
 *
 * viewBox dihitung dari isinya, jadi menggeser peralatan di lib/piping-data.ts
 * tidak pernah membuat gambar terpotong.
 */
export default function IsoDiagram({ nodes, lines, highlight }: {
    nodes: PipingNode[];
    lines: PipingLine[];
    highlight: FluidKey | null;
}) {
    const peta = useMemo(() => petaNode(nodes), [nodes]);
    const rute = useMemo(
        () => lines.map(line => ({ line, titik: ruteLine(line, peta) })),
        [lines, peta],
    );
    const grid = useMemo(() => garisLantai(nodes), [nodes]);
    const urut = useMemo(
        () => [...nodes].sort((a, b) => kedalaman(pusatNode(a)) - kedalaman(pusatNode(b))),
        [nodes],
    );

    // Bingkai dihitung dari isi gambar saja (peralatan + pipa); grid tidak ikut
    // dihitung supaya sudut belah ketupatnya tidak menyisakan ruang kosong lebar.
    const batas = useMemo(() => {
        let b = batasKosong();
        for (const n of nodes) for (const t of titikNode(n)) b = tambahBatas(b, t);
        for (const r of rute) for (const p of r.titik) b = tambahBatas(b, proyeksi(p));
        return b;
    }, [nodes, rute]);

    const bingkai = {
        x: batas.minX - PADDING,
        y: batas.minY - PADDING,
        w: batas.maxX - batas.minX + PADDING * 2,
        h: batas.maxY - batas.minY + PADDING * 2,
    };
    const viewBox = [bingkai.x, bingkai.y, bingkai.w, bingkai.h].join(' ');

    return (
        <div className="overflow-x-auto pb-1">
            <div style={{ minWidth: DIAGRAM_MIN_WIDTH_PX }}>
                <svg
                    viewBox={viewBox}
                    role="img"
                    aria-label="Gambar isometrik jalur pipa air"
                    className="w-full h-auto block"
                >
                    <defs>
                        <clipPath id="pp-bingkai">
                            <rect x={bingkai.x} y={bingkai.y} width={bingkai.w} height={bingkai.h} />
                        </clipPath>
                    </defs>

                    <g stroke="#e2e8f0" strokeWidth={1} clipPath="url(#pp-bingkai)">
                        {grid.map((g, i) => (
                            <line key={i} x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} />
                        ))}
                    </g>

                    <g>
                        {rute.map(({ line, titik }, i) => (
                            <JalurPipa
                                key={line.id}
                                line={line}
                                rute={titik}
                                redup={highlight !== null && highlight !== line.fluida}
                                delayMs={260 + i * 55}
                            />
                        ))}
                    </g>

                    <g>
                        {urut.map((n, i) => (
                            <Peralatan
                                key={n.id}
                                node={n}
                                redup={highlight !== null && !terpakai(n.id, lines, highlight)}
                                delayMs={i * 45}
                            />
                        ))}
                    </g>

                    <g>
                        {rute.map(({ line, titik }, i) => (
                            <TagJalur
                                key={line.id}
                                line={line}
                                rute={titik}
                                redup={highlight !== null && highlight !== line.fluida}
                                delayMs={620 + i * 55}
                            />
                        ))}
                    </g>

                    <PenunjukUtara batas={batas} />
                </svg>
            </div>
        </div>
    );
}

/** Peralatan dianggap terpakai kalau ada line fluida itu yang menyentuhnya. */
function terpakai(id: string, lines: PipingLine[], fluida: FluidKey): boolean {
    return lines.some(l => l.fluida === fluida && (l.dari.node === id || l.ke.node === id));
}

interface Garis { a: Titik; b: Titik }

/** Grid lantai (z = 0) sebagai acuan ruang — pengganti garis dimensi. */
function garisLantai(nodes: PipingNode[]): Garis[] {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
        const [x, y] = n.pos;
        if (n.bentuk === 'silinder') {
            minX = Math.min(minX, x - n.jari); maxX = Math.max(maxX, x + n.jari);
            minY = Math.min(minY, y - n.jari); maxY = Math.max(maxY, y + n.jari);
        } else {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x + n.ukuran[0]);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y + n.ukuran[1]);
        }
    }
    if (!Number.isFinite(minX)) return [];

    const x0 = Math.floor((minX - GRID_MARGIN) / GRID_STEP) * GRID_STEP;
    const x1 = Math.ceil((maxX + GRID_MARGIN) / GRID_STEP) * GRID_STEP;
    const y0 = Math.floor((minY - GRID_MARGIN) / GRID_STEP) * GRID_STEP;
    const y1 = Math.ceil((maxY + GRID_MARGIN) / GRID_STEP) * GRID_STEP;

    const out: Garis[] = [];
    for (let x = x0; x <= x1; x += GRID_STEP) {
        out.push({ a: proyeksi([x, y0, 0]), b: proyeksi([x, y1, 0]) });
    }
    for (let y = y0; y <= y1; y += GRID_STEP) {
        out.push({ a: proyeksi([x0, y, 0]), b: proyeksi([x1, y, 0]) });
    }
    return out;
}

/**
 * Penunjuk arah utara — wajib ada di gambar isometrik piping supaya rute bisa
 * dicocokkan dengan denah lapangan. Utara = sumbu +y, yang pada proyeksi ini
 * jatuh ke arah kiri-bawah layar.
 */
function PenunjukUtara({ batas }: { batas: Batas }) {
    const o = proyeksi([0, 0, 0]);
    const u = proyeksi([0, 1, 0]);
    // Vektornya masih berskala SKALA piksel per satuan plant — dinormalkan dulu,
    // kalau tidak panjang panah ikut membesar bersama skala gambar.
    const jarak = Math.hypot(u.x - o.x, u.y - o.y) || 1;
    const dx = (u.x - o.x) / jarak;
    const dy = (u.y - o.y) / jarak;
    const panjang = 38;
    const pangkal = { x: batas.maxX - 58, y: batas.minY + 20 };
    const ujung = { x: pangkal.x + dx * panjang, y: pangkal.y + dy * panjang };
    const sudut = (Math.atan2(dy, dx) * 180) / Math.PI;

    return (
        <g className="pp-fade" style={{ animationDelay: '900ms' }}>
            <line x1={pangkal.x} y1={pangkal.y} x2={ujung.x} y2={ujung.y} stroke="#475569" strokeWidth={1.6} />
            <polygon points="-7,-4 5,0 -7,4" fill="#475569" transform={`translate(${ujung.x} ${ujung.y}) rotate(${sudut})`} />
            <text x={pangkal.x + 8} y={pangkal.y - 6} fontSize={13} fontWeight={700} fill="#475569">N</text>
        </g>
    );
}
