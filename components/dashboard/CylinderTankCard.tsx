'use client';

import CylinderTank from '@/components/ui/CylinderTank';
import SparklineTrend from '@/components/ui/SparklineTrend';
import { TANKS, TankId } from '@/lib/constants';
import { formatRelativeTime, getAlertStatus } from '@/lib/utils';
import { FlowRate } from '@/hooks/useTankData';
import { useRouter } from 'next/navigation';

interface CylinderTankCardProps {
    tankId: TankId;
    level: number;
    operator: string;
    timestamp: string;
    trendData: { time: string; level: number }[];
    flowRates: FlowRate[];
    solarUnloadingNote?: string;
}

export default function CylinderTankCard({
    tankId,
    level,
    operator,
    timestamp,
    trendData,
    flowRates,
    solarUnloadingNote,
}: CylinderTankCardProps) {
    const tank = TANKS[tankId];
    const router = useRouter();
    const alertStatus = getAlertStatus(level);

    const alertBorderColor = alertStatus === 'critical'
        ? 'border-red-500/40'
        : alertStatus === 'warning'
            ? 'border-yellow-500/30'
            : 'border-slate-700/50';

    return (
        <div
            onClick={() => router.push(`/dashboard/${tank.id}`)}
            className={`group bg-slate-800/60 backdrop-blur-sm rounded-2xl border ${alertBorderColor} p-5 cursor-pointer
        hover:bg-slate-800/80 hover:border-slate-600/50 transition-all duration-300
        hover:shadow-lg hover:shadow-slate-900/50 hover:-translate-y-0.5`}
        >
            {/* Cylinder Tank */}
            <div className="flex justify-center">
                <CylinderTank
                    level={level}
                    liquidColor={tank.liquidColor}
                    liquidColorLight={tank.liquidColorLight}
                    gradientFrom={tank.gradientFrom}
                    gradientTo={tank.gradientTo}
                    tankName={tank.name}
                    capacity={tank.capacity}
                />
            </div>

            {/* Last update info */}
            <div className="text-center mt-2">
                <p className="text-xs text-slate-400">
                    Input oleh <span className="text-slate-300 font-medium">{operator}</span>
                </p>
                <p className="text-xs text-slate-500">{formatRelativeTime(timestamp)}</p>
            </div>

            {/* Sparkline trend */}
            <div className="mt-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Trend 1 jam</p>
                <SparklineTrend data={trendData} color={tank.liquidColor} height={50} />
            </div>

            {/* Flow source info with live rates (DEMIN & RCW) */}
            {flowRates.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Sumber Flow</p>
                    <div className="space-y-1.5">
                        {flowRates.map((flow) => (
                            <div
                                key={flow.sourceLabel}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                                style={{
                                    backgroundColor: `${tank.liquidColor}10`,
                                    border: `1px solid ${tank.liquidColor}20`,
                                }}
                            >
                                <span className="text-[11px] font-medium" style={{ color: tank.liquidColor }}>
                                    {flow.sourceLabel}
                                </span>
                                <span className="text-sm font-bold text-white">
                                    {flow.rate.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">ton/h</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Solar unloading note (only for SOLAR) */}
            {tankId === 'SOLAR' && (
                <div className="mt-3 pt-3 border-t border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Catatan Unloading</p>
                    {solarUnloadingNote ? (
                        <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <p className="text-xs text-amber-300 font-medium">🚛 {solarUnloadingNote}</p>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-600 italic">Tidak ada unloading</p>
                    )}
                </div>
            )}

            {/* Alert badge */}
            {alertStatus !== 'normal' && (
                <div className={`mt-3 text-center py-1.5 rounded-lg text-xs font-semibold ${alertStatus === 'critical'
                    ? 'bg-red-500/15 text-red-400 animate-pulse'
                    : 'bg-yellow-500/15 text-yellow-400'
                    }`}>
                    {alertStatus === 'critical' ? '⚠️ CRITICAL' : '⚡ WARNING'}
                </div>
            )}
        </div>
    );
}

