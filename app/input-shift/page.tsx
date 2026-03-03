'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { getCurrentShift, SHIFTS, ShiftId } from '@/lib/constants';

const TABS = ['Boiler A', 'Boiler B', 'STG', 'Catatan & Handover'] as const;
type Tab = typeof TABS[number];

function FormField({ label, value, onChange, unit, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; unit: string; placeholder?: string;
}) {
    return (
        <div className="flex items-center gap-3 py-2">
            <span className="text-sm text-text-secondary w-40 flex-shrink-0">{label}</span>
            <div className="relative flex-1">
                <input
                    type="number"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder || '0.0'}
                    step="0.1"
                    className="w-full px-4 py-2.5 bg-surface-highlight border border-slate-700 rounded-xl text-base font-bold text-white text-right pr-16
                        focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder:text-slate-600 appearance-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-text-secondary font-medium">{unit}</span>
            </div>
        </div>
    );
}

function BoilerForm({ name }: { name: string }) {
    const [steam, setSteam] = useState('');
    const [steamT, setSteamT] = useState('');
    const [water, setWater] = useState('');
    const [waterT, setWaterT] = useState('');
    const [tempFurnace, setTempFurnace] = useState('');
    const [vakumBoiler, setVakumBoiler] = useState('');
    const [hotAir, setHotAir] = useState('');
    const [o2, setO2] = useState('');
    const [tempFeedWater, setTempFeedWater] = useState('');
    const [f1, setF1] = useState('');
    const [f1T, setF1T] = useState('');
    const [f2, setF2] = useState('');
    const [f2T, setF2T] = useState('');
    const [f3, setF3] = useState('');
    const [f3T, setF3T] = useState('');

    // Boiler A = Feeders A/B/C, Boiler B = Feeders D/E/F
    const feederIds = name === 'A' ? ['A', 'B', 'C'] : ['D', 'E', 'F'];
    const feederStates = [
        { val: f1, set: setF1, valT: f1T, setT: setF1T },
        { val: f2, set: setF2, valT: f2T, setT: setF2T },
        { val: f3, set: setF3, valT: f3T, setT: setF3T },
    ];

    return (
        <div className="space-y-4">
            {/* Steam */}
            <div className="bg-surface-dark rounded-xl p-5 border border-slate-800">
                <p className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-primary">air</span>
                    Steam — Boiler {name}
                </p>
                <FormField label="Flow" value={steam} onChange={setSteam} unit="t/h" />
                <FormField label="Totaliser" value={steamT} onChange={setSteamT} unit="ton" />
            </div>

            {/* Water */}
            <div className="bg-surface-dark rounded-xl p-5 border border-slate-800">
                <p className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-blue-400">water_drop</span>
                    Water
                </p>
                <FormField label="Flow" value={water} onChange={setWater} unit="t/h" />
                <FormField label="Totaliser" value={waterT} onChange={setWaterT} unit="ton" />
            </div>

            {/* Temperatur & Boiler Parameters */}
            <div className="bg-surface-dark rounded-xl p-5 border border-slate-800">
                <p className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-orange-400">thermometer</span>
                    Temperatur & Parameter Boiler
                </p>
                <FormField label="Furnace Temp" value={tempFurnace} onChange={setTempFurnace} unit="°C" />
                <FormField label="Feed Water Temp" value={tempFeedWater} onChange={setTempFeedWater} unit="°C" />
                <FormField label="Hot Air Temp" value={hotAir} onChange={setHotAir} unit="°C" />
                <FormField label="O2" value={o2} onChange={setO2} unit="%" />
                <FormField label="Vakum Boiler" value={vakumBoiler} onChange={setVakumBoiler} unit="KPa" />
            </div>

            {/* Coal Feeders — dynamic based on boiler */}
            <div className="bg-surface-dark rounded-xl p-5 border border-slate-800">
                <p className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-amber-400">local_fire_department</span>
                    Coal Feeders ({feederIds.join(' / ')})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    {feederIds.map((fId, i) => (
                        <div key={fId} className="contents">
                            <FormField label={`Feeder ${fId} Flow`} value={feederStates[i].val} onChange={feederStates[i].set} unit="t/h" />
                            <FormField label={`Feeder ${fId} Totaliser`} value={feederStates[i].valT} onChange={feederStates[i].setT} unit="ton" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function STGForm() {
    const [loadMW, setLoadMW] = useState('');
    const [frequency, setFrequency] = useState('');
    const [steamInlet, setSteamInlet] = useState('');
    const [steamInletT, setSteamInletT] = useState('');
    const [condensate, setCondensate] = useState('');
    const [condensateT, setCondensateT] = useState('');
    const [vacuum, setVacuum] = useState('');
    const [thrustBearing, setThrustBearing] = useState('');
    const [pabrik1, setPabrik1] = useState('');
    const [pabrik1T, setPabrik1T] = useState('');
    const [pabrik2, setPabrik2] = useState('');
    const [pabrik2T, setPabrik2T] = useState('');
    const [pabrik3, setPabrik3] = useState('');
    const [pabrik3T, setPabrik3T] = useState('');

    return (
        <div className="space-y-4">
            {/* Load MW & Frequency */}
            <div className="bg-primary/5 rounded-xl p-5 border border-primary/20">
                <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">electric_bolt</span>
                    Load Generator
                </p>
                <FormField label="Load" value={loadMW} onChange={setLoadMW} unit="MW" />
                <FormField label="Frequency" value={frequency} onChange={setFrequency} unit="Hz" />
            </div>

            {/* Steam & Condensate */}
            <div className="bg-surface-dark rounded-xl p-5 border border-slate-800">
                <p className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-primary">air</span>
                    Steam & Condensate
                </p>
                <FormField label="Steam Inlet" value={steamInlet} onChange={setSteamInlet} unit="t/h" />
                <FormField label="Steam Inlet Total" value={steamInletT} onChange={setSteamInletT} unit="ton" />
                <FormField label="Condensate" value={condensate} onChange={setCondensate} unit="t/h" />
                <FormField label="Condensate Total" value={condensateT} onChange={setCondensateT} unit="ton" />
            </div>

            {/* Vacuum & Thrust Bearing */}
            <div className="bg-surface-dark rounded-xl p-5 border border-slate-800">
                <p className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-cyan-400">speed</span>
                    Vacuum & Thrust Bearing
                </p>
                <FormField label="Vacuum" value={vacuum} onChange={setVacuum} unit="Mpa" />
                <FormField label="Thrust Bearing" value={thrustBearing} onChange={setThrustBearing} unit="°C" />
            </div>

            {/* Distribusi Steam */}
            <div className="bg-surface-dark rounded-xl p-5 border border-slate-800">
                <p className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-purple-400">factory</span>
                    Distribusi Steam
                </p>
                <FormField label="→ Pabrik 1" value={pabrik1} onChange={setPabrik1} unit="t/h" />
                <FormField label="Pabrik 1 Total" value={pabrik1T} onChange={setPabrik1T} unit="ton" />
                <FormField label="→ Pabrik 2" value={pabrik2} onChange={setPabrik2} unit="t/h" />
                <FormField label="Pabrik 2 Total" value={pabrik2T} onChange={setPabrik2T} unit="ton" />
                <FormField label="→ Pabrik 3" value={pabrik3} onChange={setPabrik3} unit="t/h" />
                <FormField label="Pabrik 3 Total" value={pabrik3T} onChange={setPabrik3T} unit="ton" />
            </div>
        </div>
    );
}

function CatatanForm() {
    const [catatan, setCatatan] = useState('');
    const [handover, setHandover] = useState('');

    return (
        <div className="space-y-5">
            <div className="bg-primary/5 rounded-xl p-5 border border-primary/20">
                <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">mail</span>
                    Handover dari Shift Sebelumnya
                </p>
                <div className="bg-surface-highlight/50 rounded-lg p-3">
                    <p className="text-sm text-slate-300 italic">&ldquo;Boiler B ada sedikit vibrasi di coal feeder B. Sudah koordinasi dengan maintenance.&rdquo;</p>
                    <p className="text-xs text-text-secondary mt-2 text-right">— Shift C, Eko Prasetyo</p>
                </div>
            </div>

            <div className="bg-surface-dark rounded-xl p-5 border border-slate-800">
                <p className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-amber-400">edit_note</span>
                    Catatan Shift Ini
                </p>
                <textarea
                    value={catatan}
                    onChange={e => setCatatan(e.target.value.slice(0, 500))}
                    placeholder="Kejadian penting selama shift..."
                    maxLength={500}
                    rows={4}
                    className="w-full px-4 py-3 bg-surface-highlight border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-slate-600 resize-none"
                />
                <p className="text-xs text-text-secondary mt-1 text-right">{catatan.length}/500</p>
            </div>

            <div className="bg-surface-dark rounded-xl p-5 border border-slate-800">
                <p className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-emerald-400">send</span>
                    Handover ke Shift Berikutnya
                </p>
                <textarea
                    value={handover}
                    onChange={e => setHandover(e.target.value.slice(0, 500))}
                    placeholder="Informasi penting untuk shift berikutnya..."
                    maxLength={500}
                    rows={4}
                    className="w-full px-4 py-3 bg-surface-highlight border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-slate-600 resize-none"
                />
                <p className="text-xs text-text-secondary mt-1 text-right">{handover.length}/500</p>
            </div>
        </div>
    );
}

export default function InputShiftPage() {
    const { operator, canInputShift } = useOperator();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('Boiler A');
    const currentShift = getCurrentShift();

    useEffect(() => {
        if (!operator) router.push('/');
        else if (!canInputShift) router.push('/dashboard');
    }, [operator, canInputShift, router]);

    if (!operator || !canInputShift) return null;

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const shiftInfo = SHIFTS[currentShift];

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <header className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-xl">
                    <span className="material-symbols-outlined text-primary text-2xl">edit_square</span>
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-white">Input Laporan Shift</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary border border-primary/20">{shiftInfo.label}</span>
                        <span className="text-sm text-text-secondary">{dateStr}</span>
                        <span className="text-sm text-text-secondary/50">•</span>
                        <span className="text-sm text-text-secondary">{operator.name}</span>
                    </div>
                </div>
            </header>

            {/* Tab navigation */}
            <div className="flex gap-1 p-1 bg-surface-dark rounded-xl border border-slate-800 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap
                            ${activeTab === tab
                                ? 'bg-primary/20 text-primary border border-primary/10'
                                : 'text-text-secondary hover:text-white hover:bg-surface-highlight border border-transparent'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div>
                {activeTab === 'Boiler A' && <BoilerForm name="A" />}
                {activeTab === 'Boiler B' && <BoilerForm name="B" />}
                {activeTab === 'STG' && <STGForm />}
                {activeTab === 'Catatan & Handover' && <CatatanForm />}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
                <button className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-surface-dark text-text-secondary border border-slate-800 hover:bg-surface-highlight transition-all cursor-pointer flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-base">save</span>
                    Save Draft
                </button>
                <button className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Submit Shift
                </button>
            </div>
        </div>
    );
}
