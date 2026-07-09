'use client';

import { TankId } from '@/lib/constants';

interface TankSelectorProps {
    selected: TankId | null;
    onSelect: (tankId: TankId) => void;
    savedTanks?: Set<TankId>;
}

const tankOptions: { id: TankId; name: string; icon: string; color: string; bgColor: string }[] = [
    { id: 'DEMIN', name: 'DEMIN', icon: '💧', color: '#38bdf8', bgColor: 'rgba(56, 189, 248, 0.15)' },
    { id: 'RCW', name: 'RCW', icon: '🟢', color: '#2dd4bf', bgColor: 'rgba(45, 212, 191, 0.15)' },
    { id: 'SOLAR', name: 'SOLAR', icon: '🟡', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.15)' },
];

export default function TankSelector({ selected, onSelect, savedTanks }: TankSelectorProps) {
    return (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {tankOptions.map((tank) => {
                const isSelected = selected === tank.id;
                const isSaved = savedTanks?.has(tank.id);
                return (
                    <button
                        key={tank.id}
                        onClick={() => onSelect(tank.id)}
                        className={`relative flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden group
              ${isSelected
                                ? 'scale-[1.03] shadow-lg'
                                : 'border-slate-700/60 bg-slate-800/60 hover:bg-slate-700/60 hover:border-slate-500/50 hover:scale-[1.02]'
                            }`}
                        style={isSelected ? {
                            borderColor: tank.color,
                            backgroundColor: tank.bgColor,
                            boxShadow: `0 10px 30px -5px ${tank.color}40, inset 0 0 20px -5px ${tank.color}20`,
                        } : {}}
                    >
                        {/* Subtle background glow when selected */}
                        {isSelected && (
                            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50" />
                        )}
                        
                        <span className="text-2xl sm:text-3xl drop-shadow-sm group-hover:scale-110 transition-transform duration-300 transform-gpu">{tank.icon}</span>
                        <span className={`text-xs sm:text-sm font-bold tracking-wide z-10 ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                            {tank.name}
                        </span>
                        
                        {/* Saved badge */}
                        {isSaved && (
                            <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.5)] border border-emerald-400">
                                <span className="text-[9px] sm:text-[10px] text-white font-black">✓</span>
                            </div>
                        )}
                        
                        {/* Checkmark indicator for selection */}
                        {isSelected && !isSaved && (
                            <div
                                className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-lg transform scale-in"
                                style={{ backgroundColor: tank.color, boxShadow: `0 0 10px ${tank.color}80` }}
                            >
                                <span className="text-[9px] sm:text-[10px] text-slate-900 font-extrabold mix-blend-luminosity">✓</span>
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
