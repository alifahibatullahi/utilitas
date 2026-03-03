'use client';

import { TankLevelHistory } from '@/hooks/useTankData';
import { TANKS, TankId } from '@/lib/constants';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';

interface HistoryTableProps {
    data: TankLevelHistory[];
    maxRows?: number;
    showTankColumn?: boolean;
}

export default function HistoryTable({ data, maxRows = 20, showTankColumn = true }: HistoryTableProps) {
    const rows = data.slice(0, maxRows);

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-200">📋 Riwayat Input Terakhir</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-800/80">
                            <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Waktu</th>
                            <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Operator</th>
                            {showTankColumn && <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Tank</th>}
                            <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Level</th>
                            <th className="text-left px-4 py-2.5 text-slate-400 font-medium hidden sm:table-cell">Catatan</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {rows.map((row) => {
                            const tank = TANKS[row.tankId as TankId];
                            return (
                                <tr key={row.id} className="hover:bg-slate-700/20 transition-colors">
                                    <td className="px-4 py-2.5 text-slate-300">
                                        <span className="hidden sm:inline">{formatDateTime(row.timestamp)}</span>
                                        <span className="sm:hidden">{formatRelativeTime(row.timestamp)}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-300">{row.operator}</td>
                                    {showTankColumn && (
                                        <td className="px-4 py-2.5">
                                            <span
                                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                                                style={{
                                                    backgroundColor: `${tank?.liquidColor}20`,
                                                    color: tank?.liquidColor,
                                                }}
                                            >
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: tank?.liquidColor }}
                                                />
                                                {row.tankId}
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-100">
                                        {row.level.toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-400 text-xs hidden sm:table-cell max-w-[150px] truncate">
                                        {row.note || '–'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {data.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-500">Belum ada data input</div>
            )}
        </div>
    );
}
