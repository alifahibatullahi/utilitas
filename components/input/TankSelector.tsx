'use client';

import { TankId } from '@/lib/constants';

interface TankSelectorProps {
    selected: TankId | null;
    onSelect: (tankId: TankId) => void;
}

const tankOptions: { id: TankId; name: string; icon: string; color: string; bgColor: string }[] = [
    { id: 'DEMIN', name: 'DEMIN', icon: '💧', color: '#38bdf8', bgColor: 'rgba(56, 189, 248, 0.1)' },
    { id: 'RCW', name: 'RCW', icon: '🟢', color: '#2dd4bf', bgColor: 'rgba(45, 212, 191, 0.1)' },
    { id: 'SOLAR', name: 'SOLAR', icon: '🟡', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.1)' },
];

export default function TankSelector({ selected, onSelect }: TankSelectorProps) {
    return (
        <div className="grid grid-cols-3 gap-3">
            {tankOptions.map((tank) => {
                const isSelected = selected === tank.id;
                return (
                    <button
                        key={tank.id}
                        onClick={() => onSelect(tank.id)}
                        className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer
              ${isSelected
                                ? 'scale-[1.02] shadow-lg'
                                : 'border-slate-700/50 bg-slate-800/50 hover:bg-slate-700/50 hover:border-slate-600/50'
                            }`}
                        style={isSelected ? {
                            borderColor: tank.color,
                            backgroundColor: tank.bgColor,
                            boxShadow: `0 8px 25px ${tank.color}30`,
                        } : {}}
                    >
                        <span className="text-3xl">{tank.icon}</span>
                        <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                            {tank.name}
                        </span>
                        {isSelected && (
                            <div
                                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                                style={{ backgroundColor: tank.color }}
                            >
                                ✓
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
