'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';

interface ShiftResult {
    date: string;
    shift: string;
    action: string;
    raw_totalizer_steam_a: number | null;
    raw_totalizer_steam_b: number | null;
    batubara_a: number | null;
    batubara_b: number | null;
    note?: string;
}

interface DailyResult {
    date: string;
    action: string;
    fields: Record<string, number | null>;
    note?: string;
}

interface SyncResponse {
    ok: boolean;
    dryRun: boolean;
    shiftResults?: ShiftResult[];
    dailyResults?: DailyResult[];
    error?: string;
}

function fmt(v: number | null | undefined): string {
    if (v == null) return '—';
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function actionStyle(action: string): string {
    switch (action) {
        case 'inserted': return 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50';
        case 'updated':  return 'bg-blue-900/40 text-blue-300 border-blue-700/50';
        case 'sheet_not_found': return 'bg-amber-900/40 text-amber-300 border-amber-700/50';
        case 'skipped':  return 'bg-slate-800/60 text-slate-400 border-slate-700/50';
        default: return 'bg-slate-800/60 text-slate-400 border-slate-700/50';
    }
}

export default function SyncSheetsPage() {
    const { operator, canManageUsers } = useOperator();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SyncResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!operator) router.push('/');
        else if (!canManageUsers) router.push('/dashboard');
    }, [operator, canManageUsers, router]);

    if (!operator || !canManageUsers) return null;

    const runSync = async (dryRun: boolean) => {
        setLoading(true);
        setResult(null);
        setError(null);
        try {
            const res = await fetch('/api/admin/sync-sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dryRun }),
            });
            const data: SyncResponse = await res.json();
            if (!res.ok || !data.ok) {
                setError(data.error || `HTTP ${res.status}`);
            } else {
                setResult(data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-6">
            <header className="flex items-center gap-4">
                <div className="p-3 bg-cyan-500/20 rounded-xl">
                    <span className="material-symbols-outlined text-cyan-400 text-2xl">sync</span>
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-white">Sync dari Google Sheets</h2>
                    <p className="text-text-secondary text-sm mt-1">
                        Backfill raw totalizer ke PowerOps dari selisih yang diisi grup lain di Sheets.
                    </p>
                </div>
            </header>

            <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-400 mt-0.5">info</span>
                    <div className="text-sm text-slate-300 space-y-2">
                        <p>
                            Sistem akan mencari row terakhir di PowerOps yang punya raw totalizer lengkap,
                            lalu untuk tiap shift/hari setelah itu sampai hari ini, akan:
                        </p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Baca selisih totalizer dari Sheets (tab Pagi/Sore/Malam untuk shift, LHUBB untuk harian)</li>
                            <li>Tambahkan ke raw totalizer terakhir → raw totalizer baru</li>
                            <li>Insert/update row di PowerOps dengan raw totalizer hasil hitungan</li>
                        </ol>
                        <p className="pt-2 text-xs text-slate-400">
                            <strong>Cakupan terbatas:</strong> Shift hanya steam totalizer per boiler. Harian
                            lengkap (steam, batubara, BFW, power) kecuali Pabrik 3B & PIU (tidak ada di Sheets).
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={() => runSync(true)}
                        disabled={loading}
                        className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">visibility</span>
                        Preview (Dry Run)
                    </button>
                    <button
                        onClick={() => runSync(false)}
                        disabled={loading}
                        className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                Sync berjalan...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-lg">sync</span>
                                Jalankan Sync
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/40 border border-red-700/50 rounded-xl p-4 text-red-300 flex items-start gap-3">
                    <span className="material-symbols-outlined">error</span>
                    <div>
                        <div className="font-semibold">Sync gagal</div>
                        <div className="text-sm mt-1">{error}</div>
                    </div>
                </div>
            )}

            {result && (
                <div className="space-y-6">
                    {result.dryRun && (
                        <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-3 text-amber-200 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">visibility</span>
                            Mode preview — data belum ditulis ke database. Klik <strong>Jalankan Sync</strong> untuk apply.
                        </div>
                    )}

                    {/* Shift results */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-orange-400">timer</span>
                            Shift Reports — {result.shiftResults?.length ?? 0} entry
                        </h3>
                        <div className="overflow-x-auto bg-slate-900/60 border border-slate-700/50 rounded-xl">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-800/60 text-slate-300">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Tanggal</th>
                                        <th className="px-3 py-2 text-left">Shift</th>
                                        <th className="px-3 py-2 text-left">Action</th>
                                        <th className="px-3 py-2 text-right">Steam A (raw)</th>
                                        <th className="px-3 py-2 text-right">Steam B (raw)</th>
                                        <th className="px-3 py-2 text-right">Batubara A</th>
                                        <th className="px-3 py-2 text-right">Batubara B</th>
                                        <th className="px-3 py-2 text-left">Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(result.shiftResults ?? []).map((r, i) => (
                                        <tr key={i} className="border-t border-slate-800/60">
                                            <td className="px-3 py-2 text-slate-200">{r.date}</td>
                                            <td className="px-3 py-2 capitalize text-slate-200">{r.shift}</td>
                                            <td className="px-3 py-2">
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${actionStyle(r.action)}`}>
                                                    {r.action}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(r.raw_totalizer_steam_a)}</td>
                                            <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(r.raw_totalizer_steam_b)}</td>
                                            <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(r.batubara_a)}</td>
                                            <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(r.batubara_b)}</td>
                                            <td className="px-3 py-2 text-xs text-slate-400">{r.note ?? ''}</td>
                                        </tr>
                                    ))}
                                    {(result.shiftResults ?? []).length === 0 && (
                                        <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Tidak ada shift yang perlu di-sync</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Daily results */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-400">today</span>
                            Daily Reports (LHUBB) — {result.dailyResults?.length ?? 0} entry
                        </h3>
                        <div className="overflow-x-auto bg-slate-900/60 border border-slate-700/50 rounded-xl">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-800/60 text-slate-300">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Tanggal</th>
                                        <th className="px-3 py-2 text-left">Action</th>
                                        <th className="px-3 py-2 text-right">Prod B-A</th>
                                        <th className="px-3 py-2 text-right">Prod B-B</th>
                                        <th className="px-3 py-2 text-right">Inlet Turbin</th>
                                        <th className="px-3 py-2 text-right">Power UBB</th>
                                        <th className="px-3 py-2 text-right">Power P2</th>
                                        <th className="px-3 py-2 text-right">Power STG</th>
                                        <th className="px-3 py-2 text-right">Coal A..F (tot)</th>
                                        <th className="px-3 py-2 text-left">Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(result.dailyResults ?? []).map((r, i) => {
                                        const coalSum = (
                                            (r.fields.coal_a_24 ?? 0) + (r.fields.coal_b_24 ?? 0) + (r.fields.coal_c_24 ?? 0) +
                                            (r.fields.coal_d_24 ?? 0) + (r.fields.coal_e_24 ?? 0) + (r.fields.coal_f_24 ?? 0)
                                        );
                                        return (
                                            <tr key={i} className="border-t border-slate-800/60">
                                                <td className="px-3 py-2 text-slate-200">{r.date}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${actionStyle(r.action)}`}>
                                                        {r.action}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(r.fields.prod_boiler_a_24)}</td>
                                                <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(r.fields.prod_boiler_b_24)}</td>
                                                <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(r.fields.inlet_turbine_24)}</td>
                                                <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(r.fields.power_ubb_totalizer)}</td>
                                                <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(r.fields.power_pabrik2_totalizer)}</td>
                                                <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmt(r.fields.power_stg_ubb_totalizer)}</td>
                                                <td className="px-3 py-2 text-right text-slate-300 font-mono">{coalSum ? fmt(coalSum) : '—'}</td>
                                                <td className="px-3 py-2 text-xs text-slate-400">{r.note ?? ''}</td>
                                            </tr>
                                        );
                                    })}
                                    {(result.dailyResults ?? []).length === 0 && (
                                        <tr><td colSpan={10} className="px-3 py-6 text-center text-slate-500">Tidak ada daily yang perlu di-sync</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
