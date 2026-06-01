/* ───────────────────────────────────────────────────────────
   LogbookSheet — render lembar buku (read-only) dalam 1 halaman:
   Boiler A → Boiler B → Handling/ESP/Coal Bunker → Chemical Dosing
   (PG-LB-50-5004) → Turbin (PG-LB-50-5007) → Generator (PG-LS-50-5008).
   Satu <table> 14 leaf-kolom (name, unit, + 4 waktu × 3 sub) supaya
   semua kolom waktu sejajar. Tanggal hanya 1 di header atas.
   ─────────────────────────────────────────────────────────── */
import { Fragment } from 'react';

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

// ── Chemical Dosing ──
export interface ChemRow {
    level: Cell;
    stroke: Cell;
    air: Cell;
    chem: Cell;
}
export interface ChemCol {
    phosA: ChemRow;
    phosB: ChemRow;
    amine: ChemRow;
    hydrazine: ChemRow;
}

// ── Turbin (FQ | 8 Jam | F) ──
export interface TurbinCol {
    steamTurbin: BoilerTotRow;
    mpsPb1: BoilerTotRow;
    lpsPb2: BoilerTotRow;
    lpsPb3: BoilerTotRow;
    mpsPb3: BoilerTotRow;
    mpsRevamp: BoilerTotRow;
    steamCond: BoilerTotRow;
    hpo: Cell;
}

// ── Generator (Total | 8 Jam | Act) ──
export interface GenCol {
    busBar1: BoilerTotRow;
    busBar2: BoilerTotRow;
    pabrik2: BoilerTotRow;
    pabrik3: BoilerTotRow;
    pja: BoilerTotRow;
    revamping: BoilerTotRow;
    piu: BoilerTotRow;
    genOut: BoilerTotRow;
    current: Cell;
    voltage: Cell;
    q: Cell;
    pf: Cell;
    sumP: Cell;
    sumQ: Cell;
    cosO: Cell;
    pMwh: Cell;
    qMvarh: Cell;
    delivered: Cell;
    received: Cell;
    dr: Cell;
}

export interface LogbookData {
    boilerA: BoilerCol[]; // panjang 4 (06/14/22/24)
    boilerB: BoilerCol[];
    bottom: BottomCol[];
    chemical: ChemCol[];
    turbin: TurbinCol[];
    generator: GenCol[];
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

// Baris header waktu untuk tiap section (06.00/14.00/22.00/24.00)
function TimeRow() {
    return (
        <tr className="lb-time">
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            {TIMES.map((t) => (
                <td key={t} colSpan={3}>{t}</td>
            ))}
        </tr>
    );
}

// Band sub-header dokumen (judul + Nomor Dokumen) untuk Turbin & Generator
function SubDoc({ title, doc }: { title: string; doc: string }) {
    return (
        <tr className="lb-subdoc">
            <td colSpan={14}>
                <div className="lb-subdoc-inner">
                    <span className="lb-subdoc-title">{title}</span>
                    <span className="lb-subdoc-doc">Nomor Dokumen : {doc}</span>
                </div>
            </td>
        </tr>
    );
}

const TURBIN_ROWS: { name: string; key: keyof Omit<TurbinCol, 'hpo'> }[] = [
    { name: 'Steam Turbin', key: 'steamTurbin' },
    { name: 'MPS ke PB-1', key: 'mpsPb1' },
    { name: 'LPS ke PB-2', key: 'lpsPb2' },
    { name: 'LPS ke PB-3', key: 'lpsPb3' },
    { name: 'MPS ke PB-3', key: 'mpsPb3' },
    { name: 'MPS ke Revamp', key: 'mpsRevamp' },
    { name: 'Steam Cond.', key: 'steamCond' },
];

type GenDistKey = 'busBar1' | 'busBar2' | 'pabrik2' | 'pabrik3' | 'pja' | 'revamping' | 'piu' | 'genOut';
const GEN_DIST_ROWS: { name: string; key: GenDistKey }[] = [
    { name: 'Bus Bar-1', key: 'busBar1' },
    { name: 'Bus Bar-2', key: 'busBar2' },
    { name: 'Pabrik 2', key: 'pabrik2' },
    { name: 'Pabrik 3', key: 'pabrik3' },
    { name: 'PJA', key: 'pja' },
    { name: 'Revamping', key: 'revamping' },
    { name: 'PIU', key: 'piu' },
    { name: 'Gen. Out', key: 'genOut' },
];

type GenSingleKey = 'current' | 'voltage' | 'q' | 'pf' | 'sumP' | 'sumQ' | 'cosO' | 'pMwh' | 'qMvarh' | 'delivered' | 'received' | 'dr';
const GEN_OUTPUT_SINGLE: { name: string; unit: string; key: GenSingleKey }[] = [
    { name: 'Current', unit: 'A', key: 'current' },
    { name: 'Voltage', unit: 'kV', key: 'voltage' },
    { name: 'Q', unit: 'MVAR', key: 'q' },
    { name: 'PF', unit: 'Cos θ', key: 'pf' },
];
const GEN_GI_SINGLE: { name: string; unit: string; key: GenSingleKey }[] = [
    { name: 'Σ P', unit: 'MW', key: 'sumP' },
    { name: 'Σ Q', unit: 'MVAR', key: 'sumQ' },
    { name: 'Cos Ø', unit: '', key: 'cosO' },
    { name: 'P', unit: 'MWh', key: 'pMwh' },
    { name: 'Q', unit: 'MVARh', key: 'qMvarh' },
];
const GEN_PIE_SINGLE: { name: string; unit: string; key: GenSingleKey }[] = [
    { name: 'Delivered', unit: 'MWh', key: 'delivered' },
    { name: 'Received', unit: 'MWh', key: 'received' },
    { name: 'D - R', unit: 'MWh', key: 'dr' },
];

const CHEMICALS: { name: string; key: keyof ChemCol }[] = [
    { name: 'Phospat A', key: 'phosA' },
    { name: 'Phospat B', key: 'phosB' },
    { name: 'Amine', key: 'amine' },
    { name: 'Hydrazine', key: 'hydrazine' },
];

export default function LogbookSheet({ data, tanggal }: LogbookSheetProps) {
    const { boilerA, boilerB, bottom, chemical, turbin, generator } = data;

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

    // ── Render Chemical Dosing (kolom 24.00 kosong) ──
    const renderChemical = (cols: ChemCol[]) => (
        <>
            <tr className="lb-section">
                <td colSpan={14}>CHEMICAL DOSING</td>
            </tr>
            <TimeRow />
            {CHEMICALS.map((ch) => (
                <Fragment key={ch.key}>
                    <tr>
                        <td className="lb-name" rowSpan={2}>{ch.name}</td>
                        <td className="lb-unit">Level / Stroke</td>
                        {cols.map((c, i) => (
                            <td key={i} colSpan={3}><Val>{pair(c[ch.key].level, c[ch.key].stroke)}</Val></td>
                        ))}
                    </tr>
                    <tr>
                        <td className="lb-unit">Konsumsi</td>
                        {cols.map((c, i) => (
                            <td key={i} colSpan={3}><Val>{pair(c[ch.key].air, c[ch.key].chem)}</Val></td>
                        ))}
                    </tr>
                </Fragment>
            ))}
        </>
    );

    // ── Render Turbin ──
    const renderTurbin = (cols: TurbinCol[]) => (
        <>
            <SubDoc title="LOG BOOK PANEL TURBIN" doc="PG-LB-50-5007" />
            <TimeRow />
            <tr className="lb-tot-head">
                <td className="lb-name">Totaliser</td>
                <td className="lb-unit">&nbsp;</td>
                {cols.map((_, i) => (
                    <SectionTotHead key={i} is24={i === 3} firstLabel="FQ" midUnit="T" actLabel="F" actUnit="T/J" />
                ))}
            </tr>
            {TURBIN_ROWS.map((row) => (
                <tr key={row.key}>
                    <td className="lb-name">{row.name}</td>
                    <td className="lb-unit">&nbsp;</td>
                    {cols.map((c, i) => (
                        <TotCells key={i} row={c[row.key]} />
                    ))}
                </tr>
            ))}
            <tr>
                <td className="lb-name">Durasi HPO</td>
                <td className="lb-unit">&nbsp;</td>
                {cols.map((c, i) => (
                    <td key={i} colSpan={3}><Val>{f(c.hpo)}</Val></td>
                ))}
            </tr>
        </>
    );

    // ── Render Generator ──
    const renderGenerator = (cols: GenCol[]) => (
        <>
            <SubDoc title="LOG SHEET ELECTRIC GENERATOR" doc="PG-LS-50-5008" />
            <TimeRow />
            <tr className="lb-subsection">
                <td colSpan={14}>OUTPUT GENERATOR</td>
            </tr>
            <tr className="lb-tot-head">
                <td className="lb-name">Totalizer</td>
                <td className="lb-unit">&nbsp;</td>
                {cols.map((_, i) => (
                    <SectionTotHead key={i} is24={i === 3} firstLabel="Total" midUnit="MWh" actLabel="Act" actUnit="MW" />
                ))}
            </tr>
            {GEN_DIST_ROWS.map((row) => (
                <tr key={row.key}>
                    <td className="lb-name">{row.name}</td>
                    <td className="lb-unit">&nbsp;</td>
                    {cols.map((c, i) => (
                        <TotCells key={i} row={c[row.key]} />
                    ))}
                </tr>
            ))}
            {GEN_OUTPUT_SINGLE.map((row) => (
                <tr key={row.key}>
                    <td className="lb-name">{row.name}</td>
                    <td className="lb-unit">{row.unit}</td>
                    {cols.map((c, i) => (
                        <td key={i} colSpan={3}><Val>{f(c[row.key])}</Val></td>
                    ))}
                </tr>
            ))}
            <tr className="lb-subsection">
                <td colSpan={14}>Power Gi - PKG</td>
            </tr>
            {GEN_GI_SINGLE.map((row) => (
                <tr key={row.key}>
                    <td className="lb-name">{row.name}</td>
                    <td className="lb-unit">{row.unit}</td>
                    {cols.map((c, i) => (
                        <td key={i} colSpan={3}><Val>{f(c[row.key])}</Val></td>
                    ))}
                </tr>
            ))}
            <tr className="lb-subsection">
                <td colSpan={14}>PIE</td>
            </tr>
            {GEN_PIE_SINGLE.map((row) => (
                <tr key={row.key}>
                    <td className="lb-name">{row.name}</td>
                    <td className="lb-unit">{row.unit}</td>
                    {cols.map((c, i) => (
                        <td key={i} colSpan={3}><Val>{f(c[row.key])}</Val></td>
                    ))}
                </tr>
            ))}
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
                    <div className="t2">UNIT UTILITAS BATUBARA - DEPARTEMEN OPERASI PABRIK III B</div>
                    <div className="t3">Nomor Dokumen : PG-LB-50-5004</div>
                </div>
                <div className="lb-docmeta">
                    <div className="lb-meta-label">Tanggal</div>
                    <div className="lb-meta-value">{tanggal}</div>
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
                        <td colSpan={14}>HANDLING / ESP / COAL BUNKER</td>
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

                    {/* ── Section lanjutan ── */}
                    {renderChemical(chemical)}
                    {renderTurbin(turbin)}
                    {renderGenerator(generator)}
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

function SectionTotHead({ is24, firstLabel, midUnit, actLabel, actUnit }: { is24: boolean; firstLabel: string; midUnit: string; actLabel: string; actUnit: string }) {
    return (
        <>
            <td>{firstLabel}</td>
            <td>{is24 ? '24 Jam' : '8 Jam'}<br /><span className="lb-muted">{midUnit}</span></td>
            <td>{actLabel}<br /><span className="lb-muted">{actUnit}</span></td>
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
