'use client';

import React, { useState } from 'react';
import TabBoiler from '@/components/input-shift/TabBoiler';
import TabTurbin from '@/components/input-shift/TabTurbin';
import TabGenerator from '@/components/input-shift/TabGenerator';
import TabDistribusiSteam from '@/components/input-shift/TabDistribusiSteam';
import TabHandling from '@/components/input-shift/TabHandling';
import TabESP from '@/components/input-shift/TabESP';
import TabCoalBunker from '@/components/input-shift/TabCoalBunker';

type TabId = 'Boiler A' | 'Boiler B' | 'Turbin' | 'Generator' | 'Distribusi Steam' | 'Handling' | 'ESP' | 'Coal Bunker';

const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'Boiler A', label: 'Boiler A', icon: 'factory' },
    { id: 'Boiler B', label: 'Boiler B', icon: 'factory' },
    { id: 'Turbin', label: 'Turbin', icon: 'mode_fan' },
    { id: 'Generator', label: 'Generator', icon: 'bolt' },
    { id: 'Distribusi Steam', label: 'Distribusi Steam', icon: 'water_drop' },
    { id: 'Handling', label: 'Coal Handling', icon: 'local_shipping' },
    { id: 'ESP', label: 'ESP', icon: 'air' },
    { id: 'Coal Bunker', label: 'Coal Bunker', icon: 'inventory_2' },
];

export default function InputShiftPage() {
    const [activeTab, setActiveTab] = useState<TabId>('Boiler A');
    const [inputMode, setInputMode] = useState<'shift' | 'harian'>('shift');
    const [selectedShift, setSelectedShift] = useState<1 | 2 | 3>(2);

    return (
        <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 flex flex-col gap-6 h-full overflow-hidden">
            {/* Header */}
            <header className="flex flex-col items-center justify-center gap-4 shrink-0 mt-4 mb-2">
                
                {/* Mode & Shift Controls */}
                <div className="flex items-center gap-3">
                    <div className="flex bg-[#16202e]/80 border border-slate-700/50 rounded-lg p-1">
                        <button 
                            onClick={() => setInputMode('shift')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${inputMode === 'shift' ? 'bg-[#2b7cee] text-white shadow-[0_0_10px_rgba(43,124,238,0.3)]' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Shift
                        </button>
                        <button 
                            onClick={() => setInputMode('harian')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${inputMode === 'harian' ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Harian
                        </button>
                    </div>

                    {inputMode === 'shift' && (
                        <div className="flex bg-[#16202e]/80 border border-slate-700/50 rounded-lg p-1">
                            {[
                                { id: 1, label: 'Pagi' },
                                { id: 2, label: 'Sore' },
                                { id: 3, label: 'Malam' }
                            ].map(shift => (
                                <button
                                    key={shift.id}
                                    onClick={() => setSelectedShift(shift.id as any)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${selectedShift === shift.id ? 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    {shift.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="text-center flex flex-col items-center justify-center -mt-2">
                    <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-white dark:text-white mb-3">
                        {inputMode === 'shift' ? 'Input Laporan Shift' : 'Input Laporan Harian'}
                    </h2>
                    <div className="flex items-center justify-center gap-2 text-[#92a9c9]">
                        {inputMode === 'shift' ? (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#2b7cee]/20 text-[#2b7cee] border border-[#2b7cee]/20 uppercase">
                                SHIFT {selectedShift} ({selectedShift === 1 ? 'PAGI' : selectedShift === 2 ? 'SORE' : 'MALAM'})
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 uppercase">
                                REPORT HARIAN
                            </span>
                        )}
                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                        <span className="text-sm">
                            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                        <span className="text-sm font-mono text-slate-300">
                            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
                <div className="flex gap-3 shrink-0 mt-2">
                    <button className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-[0_0_10px_rgba(37,99,235,0.3)] border border-blue-500/50">
                        <span className="material-symbols-outlined text-[14px]">drafts</span>
                        Save Draft
                    </button>
                    <button className="flex justify-center items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-[0_0_10px_rgba(16,185,129,0.3)] border border-emerald-400/50">
                        <span className="material-symbols-outlined text-[14px]">send</span>
                        Submit Report
                    </button>
                </div>
            </header>

            {/* Tab Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
                <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden p-1 flex items-center overflow-x-auto scrollbar-hide shrink-0 flex-1 w-full min-w-0">
                    <div className="flex gap-1 min-w-max px-1">
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-5 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${isActive
                                        ? 'font-bold bg-[#2b7cee]/20 text-[#2b7cee] border border-[#2b7cee]/30 shadow-inner shadow-[#2b7cee]/10'
                                        : 'font-medium text-[#92a9c9] hover:text-white hover:bg-[#1f2b3e] border border-transparent'
                                        }`}
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-[#2b7cee]' : ''}`}>
                                        {tab.icon}
                                    </span>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0 pb-6 w-full max-w-full">
                {activeTab === 'Boiler A' && <TabBoiler boilerId="A" />}
                {activeTab === 'Boiler B' && <TabBoiler boilerId="B" />}
                {activeTab === 'Turbin' && <TabTurbin />}
                {activeTab === 'Generator' && <TabGenerator />}
                {activeTab === 'Distribusi Steam' && <TabDistribusiSteam />}
                {activeTab === 'Handling' && <TabHandling />}
                {activeTab === 'ESP' && <TabESP />}
                {activeTab === 'Coal Bunker' && <TabCoalBunker />}
            </div>
        </div>
    );
}
