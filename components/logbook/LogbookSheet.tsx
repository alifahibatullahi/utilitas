/* ───────────────────────────────────────────────────────────
   LogbookSheet — render lembar buku PG-LB-50-5004 (read-only).
   Murni presentational: terima LogbookData yang sudah dipetakan
   di halaman, lalu render satu <table> dengan 4 kolom waktu
   (06.00 / 14.00 / 22.00 / 24.00) yang sejajar dari atas (Boiler A),
   tengah (Boiler B), sampai blok bawah — persis lembar fisik.
   ─────────────────────────────────────────────────────────── */

export type Cell = string | number | null | undefined;

export interface BoilerTotRow {
    fq: Cell;
    ton: Cell;
    flow: Cell;
}

export interface BoilerCol {
    // Pembacaan sesaat (pasangan X / Y)
    steam: [Cell, Cell]; // press / temp
    bfw: [Cell, Cell]; // press / temp
    furn: [Cell, Cell]; // furnace / flue gas
    hotair: [Cell, Cell]; // hot air / O2
    // Totaliser
    totSteam: BoilerTotRow;
    totBfw: BoilerTotRow;
    feeders: BoilerTotRow[]; // 3 feeder (A/B/C atau D/E/F)
    totalBatubara: Cell;
    steamDrumPress: Cell;
    pa: Cell;
    sa: Cell;
}

export interface BottomCol {
    loading: Cell;
    conveyor: Cell;
    hopper: Cell;
    bunkerABC: [Cell, Cell, Cell];
    bunkerDEF: [Cell, Cell, Cell];
    trafoA: [Cell, Cell, Cell];
    trafoB: [Cell, Cell, Cell];
    silo: [Cell, Cell, Cell]; // silo A / silo B / unloading (rit)
    solar: Cell;
    demin: Cell;
    rcw: Cell;
    // Totaliser hanya untuk kolom 24.00
    solarTot?: Cell;
    deminTot?: Cell;
    rcwTot?: Cell;
}

export interface LogbookData {
    boilerA: BoilerCol[]; // panjang 4 (06/14/22/24)
    boilerB: BoilerCol[];
    bottom: BottomCol[];
}

export interface LogbookSheetProps {
    data: LogbookData;
    tanggal: string; // teks tanggal "hari, tanggal tahun" untuk kotak meta
}

const TIMES = ['06.00', '14.00', '22.00', '24.00'];

// Format angka gaya Indonesia; string dikembalikan apa adanya; kosong → ''
function f(v: Cell): string {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'string') return v;
    if (!isFinite(v)) return '';
    return v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function pair(a: Cell, b: Cell): string {
    if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) return '';
    return `${f(a)} / ${f(b)}`;
}

function tri(a: Cell, b: Cell, c: Cell): string {
    if ([a, b, c].every((x) => x === null || x === undefined || x === '')) return '';
    return `${f(a)} / ${f(b)} / ${f(c)}`;
}

function Val({ children }: { children: string }) {
    if (!children) return <>&nbsp;</>;
    return <span className="lb-val">{children}</span>;
}

export default function LogbookSheet({ data, tanggal }: LogbookSheetProps) {
    const { boilerA, boilerB, bottom } = data;

    // ── Render satu blok boiler (4 kolom) ──
    const renderBoiler = (label: string, cols: BoilerCol[], feederLetters: string[]) => (
        <>
            <tr className="lb-section">
                <td colSpan={14}>{label}</td>
            </tr>

            {/* Pembacaan sesaat */}
            {([
                { name: 'Steam', unit: 'Mpa/°C', key: 'steam' as const },
                { name: 'BFW', unit: 'Mpa/°C', key: 'bfw' as const },
                { name: 'Furn/Flue gas', unit: '°C/°C', key: 'furn' as const },
                { name: 'Hot Air / O₂', unit: '°C/%', key: 'hotair' as const },
            ]).map((row) => (
                <tr key={row.key}>
                    <td className="lb-name">{row.name}</td>
                    <td className="lb-unit">{row.unit}</td>
                    {cols.map((c, i) => (
                        <td key={i} colSpan={3}><Val>{pair(c[row.key][0], c[row.key][1])}</Val></td>
                    ))}
                </tr>
            ))}

            {/* Header Totaliser */}
            <tr className="lb-tot-head">
                <td className="lb-name">Totaliser</td>
                <td className="lb-unit">&nbsp;</td>
                {cols.map((_, i) => (
                    <FQHeader key={i} is24={i === 3} />
                ))}
            </tr>

            {/* Steam & BFW totaliser */}
            {([
                { name: 'Steam', key: 'totSteam' as const },
                { name: 'BFW', key: 'totBfw' as const },
            ]).map((row) => (
                <tr key={row.key}>
                    <td className="lb-name">{row.name}</td>
                    <td className="lb-unit">&nbsp;</td>
                    {cols.map((c, i) => (
                        <TotCells key={i} row={c[row.key]} />
                    ))}
                </tr>
            ))}

            {/* Coal Feeder A/B/C (atau D/E/F) */}
            {feederLetters.map((letter, fi) => (
                <tr key={letter}>
                    {fi === 0 && <td className="lb-name" rowSpan={3}>Coal Feeder</td>}
                    <td className="lb-unit">{letter}</td>
                    {cols.map((c, i) => (
                        <TotCells key={i} row={c.feeders[fi]} />
                    ))}
                </tr>
            ))}

            {/* Total Batubara */}
            <tr>
                <td className="lb-name">Total Batubara</td>
                <td className="lb-unit">Ton</td>
                {cols.map((c, i) => (
                    <td key={i} colSpan={3}><Val>{f(c.totalBatubara)}</Val></td>
                ))}
            </tr>

            {/* Press. Steam Drum (pengganti Solar) */}
            <tr>
                <td className="lb-name">Press. Steam Drum</td>
                <td className="lb-unit">Mpa</td>
                {cols.map((c, i) => (
                    <td key={i} colSpan={3}><Val>{f(c.steamDrumPress)}</Val></td>
                ))}
            </tr>

            {/* PA / SA (pengganti Bottom Slug) */}
            <tr>
                <td className="lb-name">PA / SA</td>
                <td className="lb-unit">%</td>
                {cols.map((c, i) => (
                    <td key={i} colSpan={3}><Val>{pair(c.pa, c.sa)}</Val></td>
                ))}
            </tr>
        </>
    );

    return (
        <div className="lb-paper">
            {/* Header dokumen */}
            <div className="lb-dochead">
                <div className="lb-doclogo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo/Danantara_Indonesia_(no_SW).png" alt="Danantara Indonesia" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo/Logo_Pupuk_Indonesia__Persero_-removebg-preview.png" alt="Pupuk Indonesia" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo/logo-PG-agro-trans-small-removebg-preview.png" alt="Petrokimia Gresik" />
                </div>
                <div className="lb-doctitle">
                    <div className="t1">LOG BOOK LAPORAN HARIAN PANEL BOILER A &amp; B</div>
                    <div className="t2">UNIT UTILITAS BATUBARA - DEPARTEMEN PRODUKSI III B</div>
                    <div className="t3">Nomor Dokumen : PG-LB-50-5004</div>
                </div>
                <div className="lb-docmeta">
                    <div><b>Tanggal</b>&nbsp;{tanggal}</div>
                </div>
            </div>

            <table className="lb-table">
                <colgroup>
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '9%' }} />
                    {Array.from({ length: 12 }).map((_, i) => (
                        <col key={i} style={{ width: `${74 / 12}%` }} />
                    ))}
                </colgroup>
                <thead>
                    <tr className="lb-time">
                        <th>&nbsp;</th>
                        <th>&nbsp;</th>
                        {TIMES.map((t) => (
                            <th key={t} colSpan={3}>{t}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {renderBoiler('BOILER A', boilerA, ['A', 'B', 'C'])}
                    {renderBoiler('BOILER B', boilerB, ['D', 'E', 'F'])}

                    {/* ── Blok bawah (shared) ── */}
                    <tr className="lb-section">
                        <td colSpan={14}>&nbsp;</td>
                    </tr>
                    <tr>
                        <td className="lb-name">Loading Batubara</td>
                        <td className="lb-unit">Shovel</td>
                        {bottom.map((b, i) => (
                            <td key={i} colSpan={3}><Val>{f(b.loading)}</Val></td>
                        ))}
                    </tr>
                    <tr>
                        <td className="lb-name">Conveyor / Hopper</td>
                        <td className="lb-unit">&nbsp;</td>
                        {bottom.map((b, i) => (
                            <td key={i} colSpan={3}><Val>{pair(b.conveyor, b.hopper)}</Val></td>
                        ))}
                    </tr>
                    <tr>
                        <td className="lb-name" rowSpan={2}>Bunker</td>
                        <td className="lb-unit">A/B/C</td>
                        {bottom.map((b, i) => (
                            <td key={i} colSpan={3}><Val>{tri(b.bunkerABC[0], b.bunkerABC[1], b.bunkerABC[2])}</Val></td>
                        ))}
                    </tr>
                    <tr>
                        <td className="lb-unit">D/E/F</td>
                        {bottom.map((b, i) => (
                            <td key={i} colSpan={3}><Val>{tri(b.bunkerDEF[0], b.bunkerDEF[1], b.bunkerDEF[2])}</Val></td>
                        ))}
                    </tr>
                    <tr>
                        <td className="lb-name">Trafo A</td>
                        <td className="lb-unit">A1/A2/A3</td>
                        {bottom.map((b, i) => (
                            <td key={i} colSpan={3}><Val>{tri(b.trafoA[0], b.trafoA[1], b.trafoA[2])}</Val></td>
                        ))}
                    </tr>
                    <tr>
                        <td className="lb-name">Trafo B</td>
                        <td className="lb-unit">B1/B2/B3</td>
                        {bottom.map((b, i) => (
                            <td key={i} colSpan={3}><Val>{tri(b.trafoB[0], b.trafoB[1], b.trafoB[2])}</Val></td>
                        ))}
                    </tr>
                    <tr>
                        <td className="lb-name">Silo A/B / Unloading</td>
                        <td className="lb-unit">rit</td>
                        {bottom.map((b, i) => (
                            <td key={i} colSpan={3}><Val>{tri(b.silo[0], b.silo[1], b.silo[2])}</Val></td>
                        ))}
                    </tr>
                    <tr>
                        <td className="lb-name" rowSpan={3}>Tankyard</td>
                        <td className="lb-unit">Solar</td>
                        {bottom.map((b, i) => (
                            <td key={i} colSpan={3}><TankCell level={b.solar} tot={i === 3 ? b.solarTot : undefined} /></td>
                        ))}
                    </tr>
                    <tr>
                        <td className="lb-unit">Demin</td>
                        {bottom.map((b, i) => (
                            <td key={i} colSpan={3}><TankCell level={b.demin} tot={i === 3 ? b.deminTot : undefined} /></td>
                        ))}
                    </tr>
                    <tr>
                        <td className="lb-unit">RCW</td>
                        {bottom.map((b, i) => (
                            <td key={i} colSpan={3}><TankCell level={b.rcw} tot={i === 3 ? b.rcwTot : undefined} /></td>
                        ))}
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function FQHeader({ is24 }: { is24: boolean }) {
    return (
        <>
            <td>FQ</td>
            <td>{is24 ? '24 Jam' : '8 Jam'}<br /><span className="lb-muted">Ton</span></td>
            <td>Flow<br /><span className="lb-muted">T/J</span></td>
        </>
    );
}

function TotCells({ row }: { row: BoilerTotRow | undefined }) {
    const r = row ?? { fq: null, ton: null, flow: null };
    return (
        <>
            <td><Val>{f(r.fq)}</Val></td>
            <td><Val>{f(r.ton)}</Val></td>
            <td><Val>{f(r.flow)}</Val></td>
        </>
    );
}

function TankCell({ level, tot }: { level: Cell; tot: Cell }) {
    const lvl = f(level);
    const t = f(tot);
    return (
        <span>
            {lvl ? <span className="lb-val">{lvl}</span> : <>&nbsp;</>}
            {lvl ? ' m³' : ''}
            {t ? <span className="lb-muted"> · Tot: {t}</span> : ''}
        </span>
    );
}
