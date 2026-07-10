'use client';

import { SILO_IDS } from '@/lib/ash-silo';
import { useAshSiloData } from '@/hooks/useAshSiloData';
import SiloCard from '@/components/ash-silo/SiloCard';

// View ash silo di halaman tank-level. Dimuat lazy via next/dynamic —
// bundle + fetch data baru jalan saat user membuka view ini.
export default function AshSiloSection() {
    const { siloLevels, unloadings, trendData, loadHistory, loading, error } = useAshSiloData();

    return (
        <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
            {error && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {error}
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 2xl:gap-6 lg:flex-1 lg:min-h-0">
                {SILO_IDS.map(id => (
                    <SiloCard key={id} siloId={id}
                        level={siloLevels[id]}
                        unloadings={unloadings.filter(u => u.silo === id)}
                        trend={trendData[id]}
                        loadTrend={loadHistory}
                        loading={loading} />
                ))}
            </div>
        </div>
    );
}
