'use client';

import React, { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TabBoiler from '@/components/input-shift/TabBoiler';
import TabTurbin from '@/components/input-shift/TabTurbin';
import TabGenerator from '@/components/input-shift/TabGenerator';
import TabDistribusiSteam from '@/components/input-shift/TabDistribusiSteam';
import TabHandling from '@/components/input-shift/TabHandling';
import TabESP, { AshUnloadingEntry } from '@/components/input-shift/TabESP';
import TabCoalBunker from '@/components/input-shift/TabCoalBunker';
import TabLab from '@/components/input-shift/TabLab';
import { useShiftReport, usePreviousShiftData, useBunkerBerasapHistory, useBoilerShutdownHistory, useLatestBoilerStatus } from '@/hooks/useShiftReport';
import { useOperator } from '@/hooks/useOperator';
import { createClient } from '@/lib/supabase/client';
import type { ShiftType, SolarUnloadingRow, SolarUsageRow } from '@/lib/supabase/types';
import { SAMPLE_MALAM_01JAN } from '@/lib/sampleData';
import InputHarianForm from '@/components/input-harian/InputHarianForm';
import { PublishReportModal } from '@/components/ui/PublishReportModal';
import { nowWIB, todayWIB } from '@/lib/utils';
import { getGroupForShift, getGroupShiftOnDate, isValidStation, STATION_SHIFT_TABS, STATION_LABELS, getShiftWindow, detectCurrentShift, type OperatorStation } from '@/lib/constants';

function getGroupMalamOnDate(dateStr: string): string {
    for (const g of ['A', 'B', 'C', 'D'] as const) {
        if (getGroupShiftOnDate(g, dateStr) === 'M') return g;
    }
    return '';
}

type TabId = 'Boiler A' | 'Boiler B' | 'Turbin' | 'Generator' | 'Distribusi Steam' | 'Handling' | 'ESP' | 'Coal Bunker' | 'Lab';

const TABS: { id: TabId; label: string; icon: string; colorClass: string }[] = [
    { id: 'Boiler A', label: 'Boiler A', icon: 'factory', colorClass: 'rose' },
    { id: 'Boiler B', label: 'Boiler B', icon: 'factory', colorClass: 'purple' },
    { id: 'Turbin', label: 'Turbin', icon: 'mode_fan', colorClass: 'cyan' },
    { id: 'Distribusi Steam', label: 'Distribusi Steam', icon: 'water_drop', colorClass: 'blue' },
    { id: 'Generator', label: 'Generator', icon: 'bolt', colorClass: 'amber' },
    { id: 'Handling', label: 'Coal Handling', icon: 'local_shipping', colorClass: 'orange' },
    { id: 'ESP', label: 'ESP', icon: 'air', colorClass: 'stone' },
    { id: 'Coal Bunker', label: 'Coal Bunker', icon: 'inventory_2', colorClass: 'indigo' },
    { id: 'Lab', label: 'Lab / QC', icon: 'science', colorClass: 'teal' },
];

const TAB_STYLES: Record<string, { active: string; inactive: string; icon: string }> = {
    'rose': { active: 'font-bold bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-inner shadow-rose-500/10', inactive: 'font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border-transparent', icon: 'text-rose-400' },
    'purple': { active: 'font-bold bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-inner shadow-purple-500/10', inactive: 'font-medium text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 border-transparent', icon: 'text-purple-400' },
    'cyan': { active: 'font-bold bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-inner shadow-cyan-500/10', inactive: 'font-medium text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border-transparent', icon: 'text-cyan-400' },
    'amber': { active: 'font-bold bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-inner shadow-amber-500/10', inactive: 'font-medium text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 border-transparent', icon: 'text-amber-400' },
    'blue': { active: 'font-bold bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-inner shadow-blue-500/10', inactive: 'font-medium text-slate-400 hover:text-blue-300 hover:bg-blue-500/10 border-transparent', icon: 'text-blue-400' },
    'orange': { active: 'font-bold bg-orange-500/20 text-orange-400 border-orange-500/30 shadow-inner shadow-orange-500/10', inactive: 'font-medium text-slate-400 hover:text-orange-300 hover:bg-orange-500/10 border-transparent', icon: 'text-orange-400' },
    'stone': { active: 'font-bold bg-stone-500/20 text-stone-400 border-stone-500/30 shadow-inner shadow-stone-500/10', inactive: 'font-medium text-slate-400 hover:text-stone-300 hover:bg-stone-500/10 border-transparent', icon: 'text-stone-400' },
    'indigo': { active: 'font-bold bg-indigo-500/20 text-indigo-400 border-indigo-500/30 shadow-inner shadow-indigo-500/10', inactive: 'font-medium text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 border-transparent', icon: 'text-indigo-400' },
    'teal': { active: 'font-bold bg-teal-500/20 text-teal-400 border-teal-500/30 shadow-inner shadow-teal-500/10', inactive: 'font-medium text-slate-400 hover:text-teal-300 hover:bg-teal-500/10 border-transparent', icon: 'text-teal-400' },
};

export default function InputShiftPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-sm font-bold">Memuat...</div>}>
            <InputShiftPageInner />
        </Suspense>
    );
}

function InputShiftPageInner() {
    const [activeTab, setActiveTab] = useState<TabId>('Boiler A');
    const [inputMode, setInputMode] = useState<'shift' | 'harian'>('shift');
    const [selectedShift, setSelectedShift] = useState<1 | 2 | 3>(() => {
        const map: Record<string, 1 | 2 | 3> = { malam: 1, pagi: 2, sore: 3 };
        return map[detectCurrentShift().shift];
    });
    const [submitting, setSubmitting] = useState(false);
    const [saveProgress, setSaveProgress] = useState<number | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // ENDING convention untuk malam (malam D = submit di hari D). detectCurrentShift handle ini:
    // - h<7 : malam D=today (shift sedang berjalan, akan submit hari ini)
    // - h≥7&<15 : pagi D=today
    // - h≥15&<23 : sore D=today
    // - h≥23 : malam D=tomorrow (shift baru mulai, submit besok)
    const [selectedDate, setSelectedDate] = useState<string>(() => detectCurrentShift().date);
    const [mounted, setMounted] = useState(false);
    const today = mounted ? todayWIB() : '';
    const isToday = selectedDate === today;
    const formattedDate = mounted && selectedDate 
        ? new Date(selectedDate + 'T00:00:00+07:00').toLocaleDateString('id-ID', { 
            timeZone: 'Asia/Jakarta', 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          }) 
        : '';
    
    // Header specific states — persist to localStorage
    const [supervisor, setSupervisor] = useState(() => {
        if (typeof window === 'undefined') return '';
        try { return localStorage.getItem('shift_supervisor') || ''; } catch { return ''; }
    });
    const [foremanBoiler, setForemanBoiler] = useState(() => {
        if (typeof window === 'undefined') return '';
        try { return localStorage.getItem('shift_foreman_boiler') || ''; } catch { return ''; }
    });
    const [foremanTurbin, setForemanTurbin] = useState(() => {
        if (typeof window === 'undefined') return '';
        try { return localStorage.getItem('shift_foreman_turbin') || ''; } catch { return ''; }
    });
    // Per-station filler — siapa yang mengisi station ini. Default = operator login,
    // bisa di-override via picker untuk kasus tukar shift. Persist ke localStorage.
    const [fillerName, setFillerName] = useState(() => {
        if (typeof window === 'undefined') return '';
        try { return localStorage.getItem('shift_station_filler') || ''; } catch { return ''; }
    });

    const skipNextClear = useRef(false);
    const lastSubmittedReportId = useRef<string | null>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const [initialDataReady, setInitialDataReady] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // Deep-link prefill from WhatsApp reminder: ?shift=pagi|sore|malam&date=YYYY-MM-DD&station=<id>
    const searchParams = useSearchParams();
    const stationParam = searchParams?.get('station') ?? null;
    const station: OperatorStation | null = isValidStation(stationParam) ? stationParam : null;

    useEffect(() => {
        const qShift = searchParams?.get('shift');
        const qDate = searchParams?.get('date');
        const qMode = searchParams?.get('mode');
        // Mode toggle dari URL (always honored kalau di-set)
        if (qMode === 'harian') setInputMode('harian');
        else if (qMode === 'shift') setInputMode('shift');

        // Saat station mode aktif: override URL shift/date dengan default sesuai konteks.
        // - Shift mode: pakai current shift saat ini (jam sekarang).
        // - Harian mode: window submit harian = 23:00 (D) - 09:00 (D+1). Default:
        //     • jam < 9 → KEMARIN (D-1) — masih dalam window untuk laporan kemarin
        //     • jam ≥ 9 → HARI INI (D) — prep laporan untuk submit nanti malam jam 23:00
        // Operator pengganti yang akses link lama dari WA group → tidak salah isi shift/hari.
        if (stationParam) {
            if (qMode === 'harian') {
                const fmtY = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const nowH = new Date();
                const target = new Date(nowH);
                if (nowH.getHours() < 9) target.setDate(target.getDate() - 1);
                setSelectedDate(fmtY(target));
            } else {
                const { shift: nowShift, date: nowDate } = detectCurrentShift();
                const map: Record<string, 1 | 2 | 3> = { malam: 1, pagi: 2, sore: 3 };
                setSelectedShift(map[nowShift]);
                setSelectedDate(nowDate);
            }
            return;
        }
        // Non-station mode: honor URL params (deep-link dari WA reminder normal)
        if (qShift) {
            const map: Record<string, 1 | 2 | 3> = { malam: 1, pagi: 2, sore: 3 };
            const target = map[qShift.toLowerCase()];
            if (target) setSelectedShift(target);
        }
        if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) setSelectedDate(qDate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Tabs yang visible berdasarkan station (kalau ada). Tanpa station → semua tab.
    const visibleTabs = useMemo(() => {
        if (!station) return TABS;
        const allowed = STATION_SHIFT_TABS[station];
        return TABS.filter(t => allowed.includes(t.id));
    }, [station]);

    // Auto-pick tab pertama yang visible saat mount kalau activeTab default ('Boiler A')
    // tidak ada di visibleTabs (mis. station=esp).
    useEffect(() => {
        if (visibleTabs.length === 0) return;
        if (!visibleTabs.some(t => t.id === activeTab)) {
            setActiveTab(visibleTabs[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [station]);

    // Pre-warm: saat halaman pertama kali dibuka, fetch report 3 hari terakhir
    // untuk memastikan koneksi Supabase siap dan data sudah di-cache browser
    useEffect(() => {
        const supabase = createClient();
        const today = new Date();
        const dates: string[] = [];
        for (let i = 0; i < 3; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
        // Fire-and-forget: pre-warm koneksi Supabase dengan fetch ringan
        supabase
            .from('shift_reports')
            .select('id, date, shift')
            .in('date', dates)
            .order('date', { ascending: false })
            .then(() => {
                console.log('[pre-warm] Supabase connection warmed for', dates);
            });
    }, []);

    // Persist supervisor/foreman ke localStorage
    useEffect(() => {
        try {
            localStorage.setItem('shift_supervisor', supervisor);
        } catch { /* ignore */ }
    }, [supervisor]);

    useEffect(() => {
        try {
            localStorage.setItem('shift_foreman_boiler', foremanBoiler);
        } catch { /* ignore */ }
    }, [foremanBoiler]);

    useEffect(() => {
        try {
            localStorage.setItem('shift_foreman_turbin', foremanTurbin);
        } catch { /* ignore */ }
    }, [foremanTurbin]);

    useEffect(() => {
        try {
            localStorage.setItem('shift_station_filler', fillerName);
        } catch { /* ignore */ }
    }, [fillerName]);

    // NOTE: Sheets sync dihapus — alur sekarang: input form → Supabase (sumber data utama) → Sheets (fire-and-forget).
    // Data yang tampil di form selalu diambil dari Supabase melalui useShiftReport.

    // Form state
    const [boilerA, setBoilerA] = useState<Record<string, number | string | null>>({});
    const [boilerB, setBoilerB] = useState<Record<string, number | string | null>>({});
    const [turbin, setTurbin] = useState<Record<string, number | string | null>>({});
    const [steamDist, setSteamDist] = useState<Record<string, number | null>>({});
    const [generatorGi, setGeneratorGi] = useState<Record<string, number | null>>({});
    const [powerDist, setPowerDist] = useState<Record<string, number | null>>({});
    const [espHandling, setEspHandling] = useState<Record<string, number | string | null>>({});
    const [tankyard, setTankyard] = useState<Record<string, number | null>>({});
    const [coalBunker, setCoalBunker] = useState<Record<string, number | string | null>>({});
    const [waterQuality, setWaterQuality] = useState<Record<string, number | null>>({});
    const [chemicalDosing, setChemicalDosing] = useState<Record<string, number | null>>({});
    const [solarEntries, setSolarEntries] = useState<{ tanggal: string; jumlah: number | null; perusahaan: string }[]>([]);
    const [outSolarEntries, setOutSolarEntries] = useState<{ tanggal: string; jumlah: number | null; tujuan: string }[]>([]);
    const [savedSolarEntries, setSavedSolarEntries] = useState<{ id?: string; tanggal: string; jumlah: number | null; perusahaan: string }[]>([]);
    const [savedOutSolarEntries, setSavedOutSolarEntries] = useState<{ id?: string; tanggal: string; jumlah: number | null; tujuan: string }[]>([]);
    const [ashEntries, setAshEntries] = useState<AshUnloadingEntry[]>([]);
    const [savedAshEntries, setSavedAshEntries] = useState<AshUnloadingEntry[]>([]);
    const [lastStock, setLastStock] = useState<{ phosphate: number | null; amine: number | null; hydrazine: number | null }>({ phosphate: null, amine: null, hydrazine: null });

    // Shift mapping: button order matches chronological report time
    // 06.00 → shift malam (night shift makes 06.00 report)
    // 14.00 → shift pagi  (morning shift makes 14.00 report)
    // 22.00 → shift sore  (afternoon shift makes 22.00 report)
    const shiftMap: Record<number, ShiftType> = { 1: 'malam', 2: 'pagi', 3: 'sore' };
    const SHIFT_LABELS: Record<number, string> = { 1: 'Shift Malam 06.00', 2: 'Shift Pagi 14.00', 3: 'Shift Sore 22.00' };
    const { report, loading, submitReport, refetch } = useShiftReport(selectedDate, shiftMap[selectedShift]);
    const [publishOpen, setPublishOpen] = useState(false);
    const { prevBoilerA, prevBoilerB, prevCoalBunker, prevTurbin, prevSteamDist, prevPowerDist } = usePreviousShiftData(selectedDate, shiftMap[selectedShift]);
    const bunkerBerasapSince = useBunkerBerasapHistory(selectedDate, shiftMap[selectedShift]);
    const boilerShutdownSince = useBoilerShutdownHistory(selectedDate, shiftMap[selectedShift]);
    const latestBoilerStatus = useLatestBoilerStatus(selectedDate, shiftMap[selectedShift]);
    const { operator, operators } = useOperator();
    const isAdmin = operator?.role === 'admin';

    // Auto-kalkulasi grup dari pola jadwal shift
    const currentGroup = getGroupForShift(selectedDate, shiftMap[selectedShift]);

    // ─── Grace period & submit guard ─────────────────────────────────────────────
    // Shift: submit allowed sampai shift end + 2 jam.
    // Harian: submit allowed sampai shift malam (D+1) berakhir + 2 jam = jam 09:00 (D+2).
    // Submit window per shift = [reminder_time, shift_end + 2h grace].
    // Harian: window = [23:00 (D), 09:00 (D+1)].
    // Reminder times: pagi 12:30, sore 20:30, malam 04:30 (D+1).
    const SHIFT_GRACE_HOURS = 2;
    const submitWindow = useMemo(() => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        if (inputMode === 'harian') {
            const start = new Date(y, m - 1, d, 23, 0, 0);     // 23:00 (D)
            const end   = new Date(y, m - 1, d + 1, 9, 0, 0);  // 09:00 (D+1)
            return { start, end };
        }
        const shift = shiftMap[selectedShift];
        const win = getShiftWindow(selectedDate, shift);
        let startHour: number, startMin: number;
        if (shift === 'pagi') { startHour = 12; startMin = 30; }
        else if (shift === 'sore') { startHour = 20; startMin = 30; }
        else { startHour = 4; startMin = 30; } // malam reminder = 04:30 D (ENDING convention)
        const start = new Date(y, m - 1, d, startHour, startMin, 0);
        const end   = new Date(win.end.getTime() + SHIFT_GRACE_HOURS * 60 * 60 * 1000);
        return { start, end };
    }, [inputMode, selectedDate, selectedShift, shiftMap]);

    const [nowTick, setNowTick] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 60_000); // tick per menit
        return () => clearInterval(id);
    }, []);
    const _isBeforeStartRaw = nowTick < submitWindow.start.getTime();
    const _isPastDeadlineRaw = nowTick > submitWindow.end.getTime();
    // Admin bisa isi laporan kapan saja, tanpa terikat window submit.
    const isBeforeStart  = !isAdmin && _isBeforeStartRaw;
    const isPastDeadline = !isAdmin && _isPastDeadlineRaw;
    const isLocked       = isBeforeStart || isPastDeadline;
    // Backward-compat alias agar refactor minimal
    const submitDeadline = submitWindow.end;
    const reportStatus = (report?.status as 'draft' | 'submitted' | 'approved' | undefined) ?? null;
    const isReportSubmitted = reportStatus === 'submitted' || reportStatus === 'approved';

    // Supervisor: semua yg jabatan Supervisor atau Foreman
    const supervisorOptions = operators.filter(op =>
        op.jabatan === 'Supervisor' || op.jabatan?.startsWith('Foreman')
    );
    // Foreman Boiler: organik UBB dengan jabatan Foreman Boiler atau operator biasa (tanpa jabatan)
    const foremanBoilerOptions = operators.filter(op =>
        op.company === 'UBB' && (op.jabatan === 'Foreman Boiler' || !op.jabatan)
    );
    // Foreman Turbin: organik UBB dengan jabatan Foreman Turbin atau operator biasa (tanpa jabatan)
    const foremanTurbinOptions = operators.filter(op =>
        op.company === 'UBB' && (op.jabatan === 'Foreman Turbin' || !op.jabatan)
    );
    const router = useRouter();

    // Fetch saved ash unloadings and solar for current date+shift
    useEffect(() => {
        const supabase = createClient();
        
        supabase
            .from('ash_unloadings')
            .select('id, silo, perusahaan, tujuan, ritase')
            .eq('date', selectedDate)
            .eq('shift', shiftMap[selectedShift])
            .order('created_at', { ascending: true })
            .then(({ data }) => setSavedAshEntries((data ?? []).map((r: any) => ({ id: r.id, silo: r.silo, perusahaan: r.perusahaan, tujuan: r.tujuan, ritase: r.ritase }))));

        supabase
            .from('solar_unloadings')
            .select('id, date, supplier, liters')
            .eq('date', selectedDate)
            .eq('shift', shiftMap[selectedShift])
            .order('created_at', { ascending: true })
            .then(({ data }) => setSavedSolarEntries((data ?? []).map((r: any) => ({ id: r.id, tanggal: r.date, jumlah: r.liters, perusahaan: r.supplier }))));

        supabase
            .from('solar_usages')
            .select('id, date, tujuan, liters')
            .eq('date', selectedDate)
            .eq('shift', shiftMap[selectedShift])
            .order('created_at', { ascending: true })
            .then(({ data }) => setSavedOutSolarEntries((data ?? []).map((r: any) => ({ id: r.id, tanggal: r.date, jumlah: r.liters, tujuan: r.tujuan }))));

    }, [selectedDate, selectedShift]);

    // Fetch last known chemical stock (latest shift report with non-null stock)
    useEffect(() => {
        const supabase = createClient();
        supabase
            .from('shift_water_quality')
            .select('stock_phosphate, stock_amine, stock_hydrazine')
            .not('stock_phosphate', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .then(({ data }) => {
                if (data && data[0]) {
                    setLastStock({
                        phosphate: data[0].stock_phosphate as number | null,
                        amine: data[0].stock_amine as number | null,
                        hydrazine: data[0].stock_hydrazine as number | null,
                    });
                }
            });
    }, []);

    // ─── Delete handlers untuk entri yang sudah tersimpan di DB ───
    const handleDeleteSavedAsh = async (id: string) => {
        if (!confirm('Hapus data unloading ini?')) return;
        const supabase = createClient();
        const { error } = await supabase.from('ash_unloadings').delete().eq('id', id);
        if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }
        setSavedAshEntries(prev => prev.filter(e => e.id !== id));
    };
    const handleDeleteSavedSolar = async (id: string) => {
        if (!confirm('Hapus data kedatangan solar ini?')) return;
        const supabase = createClient();
        const { error } = await supabase.from('solar_unloadings').delete().eq('id', id);
        if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }
        setSavedSolarEntries(prev => prev.filter(e => e.id !== id));
    };
    const handleDeleteSavedOutSolar = async (id: string) => {
        if (!confirm('Hapus data permintaan solar ini?')) return;
        const supabase = createClient();
        const { error } = await supabase.from('solar_usages').delete().eq('id', id);
        if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }
        setSavedOutSolarEntries(prev => prev.filter(e => e.id !== id));
    };

    // ─── Navigation Guard ───
    const [showNavWarning, setShowNavWarning] = useState(false);
    const [userModified, setUserModified] = useState(false);
    const userModifiedRef = useRef(false);
    const bypassNavRef = useRef(false);
    const pendingNavUrl = useRef<string | null>(null);

    useEffect(() => { userModifiedRef.current = userModified; }, [userModified]);

    // Patch history.pushState once to intercept SPA navigation
    useEffect(() => {
        const originalPushState = history.pushState.bind(history);
        history.pushState = function(state: unknown, title: string, url?: string | URL | null) {
            const targetUrl = url ? String(url) : '';
            if (!userModifiedRef.current || bypassNavRef.current || !targetUrl || targetUrl.includes('/input-shift')) {
                originalPushState(state, title, url);
                return;
            }
            pendingNavUrl.current = targetUrl;
            setShowNavWarning(true);
        };
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!userModifiedRef.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            history.pushState = originalPushState;
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    // Restore supervisor/foreman dari report data jika sudah ada (setelah report loaded via useShiftReport)
    useEffect(() => {
        if (!report) return;
        if (report.supervisor) setSupervisor(report.supervisor);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const personnel = (report as any).shift_personnel?.[0];
        if (personnel?.turbin_karu) setForemanTurbin(personnel.turbin_karu);
        if (personnel?.boiler_karu) setForemanBoiler(personnel.boiler_karu);
        // status_turbin restored automatically via extractFields di useEffect lain saat
        // report.shift_turbin di-load → setTurbin(extractFields(turbinData)).
        // Restore filler dari station_fillers[station] kalau ada — kalau belum, default
        // ke operator login (saat user pertama buka station view).
        if (station) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sf = (report as any).station_fillers as Record<string, string> | null | undefined;
            const existing = sf?.[station];
            if (existing) setFillerName(existing);
            else if (!fillerName && operator?.name) setFillerName(operator.name);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [report, station]);

    const handleNavLeave = useCallback(() => {
        bypassNavRef.current = true;
        const url = pendingNavUrl.current!;
        setShowNavWarning(false);
        router.push(url);
    }, [router]);

    const handleNavStay = useCallback(() => {
        setShowNavWarning(false);
        pendingNavUrl.current = null;
    }, []);

    // Helper: extract non-null numeric fields from a record, skip id/FK fields
    const extractFields = (obj: Record<string, unknown> | undefined, skipKeys: string[] = []) => {
        if (!obj) return {};
        const skip = new Set(['id', 'shift_report_id', 'created_at', 'updated_at', ...skipKeys]);
        const result: Record<string, number | string | null> = {};
        for (const [k, v] of Object.entries(obj)) {
            if (skip.has(k)) continue;
            if (v !== null && v !== undefined) result[k] = v as number | string | null;
        }
        return result;
    };

    // Clear form immediately when date/shift changes
    useEffect(() => {
        if (skipNextClear.current) {
            skipNextClear.current = false;
            return;
        }
        setUserModified(false);
        // Reset ref segera (synchronous) supaya inherit useEffect di commit yang sama tidak
        // ke-skip karena ref masih nilai lama. setUserModified hanya queue state update async.
        userModifiedRef.current = false;
        setBoilerA({});
        setBoilerB({});
        setTurbin({});
        setSteamDist({});
        setGeneratorGi({});
        setPowerDist({});
        setEspHandling({});
        setTankyard({});
        setCoalBunker({});
        setWaterQuality({});
        setChemicalDosing({});
        setSolarEntries([]);
        setOutSolarEntries([]);
        setAshEntries([]);
        setSupervisor('');
        setForemanBoiler('');
        setForemanTurbin('');
    }, [selectedShift, selectedDate]);

    // Populate form when report data arrives from Supabase
    useEffect(() => {
        // Jangan overwrite input user yang sedang diketik
        if (userModifiedRef.current) return;

        if (!report) return;

        const boilerAData = report.shift_boiler?.find((b: { boiler: string }) => b.boiler === 'A');
        const boilerBData = report.shift_boiler?.find((b: { boiler: string }) => b.boiler === 'B');
        const turbinData = report.shift_turbin?.[0];
        const steamDistData = report.shift_steam_dist?.[0];
        const genData = report.shift_generator_gi?.[0];
        const powerData = report.shift_power_dist?.[0];
        const espData = report.shift_esp_handling?.[0];
        const tankyardData = report.shift_tankyard?.[0];
        const coalData = report.shift_coal_bunker?.[0];

        if (boilerAData) setBoilerA(extractFields(boilerAData as unknown as Record<string, unknown>, ['boiler', 'batubara_ton']) as Record<string, number | string | null>);
        if (boilerBData) setBoilerB(extractFields(boilerBData as unknown as Record<string, unknown>, ['boiler', 'batubara_ton']) as Record<string, number | string | null>);
        if (turbinData) setTurbin(extractFields(turbinData as unknown as Record<string, unknown>) as Record<string, number | string | null>);
        if (steamDistData) setSteamDist(extractFields(steamDistData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (genData) setGeneratorGi(extractFields(genData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (powerData) setPowerDist(extractFields(powerData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (espData) setEspHandling(extractFields(espData as unknown as Record<string, unknown>));
        if (tankyardData) setTankyard(extractFields(tankyardData as unknown as Record<string, unknown>) as Record<string, number | null>);
        if (coalData) setCoalBunker(extractFields(coalData as unknown as Record<string, unknown>) as Record<string, number | string | null>);

        // Load water quality & chemical dosing from shift_water_quality
        const wqData = report.shift_water_quality?.[0];
        if (wqData) {
            const allFields = extractFields(wqData as unknown as Record<string, unknown>) as Record<string, number | null>;
            const chemKeys = ['phosphate_', 'phosphate_b_', 'amine_', 'hydrazine_', 'stock_'];
            const wqFields: Record<string, number | null> = {};
            const cdFields: Record<string, number | null> = {};
            for (const [k, v] of Object.entries(allFields)) {
                if (chemKeys.some(prefix => k.startsWith(prefix))) {
                    cdFields[k] = v;
                } else {
                    wqFields[k] = v;
                }
            }
            setWaterQuality(wqFields);
            setChemicalDosing(cdFields);
        }
    }, [report]);

    // Tandai halaman siap setelah fetch pertama selesai
    useEffect(() => {
        if (!loading && !initialDataReady) {
            setInitialDataReady(true);
        }
    }, [loading, initialDataReady]);

    // Sync default-0 fields ke state (agar isTabLengkap bisa mendeteksi field sudah terisi)
    useEffect(() => {
        setSteamDist(prev => {
            if (prev.pabrik2_flow != null && prev.pabrik2_totalizer != null) return prev;
            return {
                ...prev,
                pabrik2_flow: prev.pabrik2_flow ?? 0,
                pabrik2_totalizer: prev.pabrik2_totalizer ?? 0,
            };
        });
    }, [steamDist.pabrik2_flow, steamDist.pabrik2_totalizer]);

    useEffect(() => {
        setPowerDist(prev => {
            if (prev.power_revamping_totalizer != null && prev.power_pie_totalizer != null) return prev;
            return {
                ...prev,
                power_revamping_totalizer: prev.power_revamping_totalizer ?? 0,
                power_pie_totalizer: prev.power_pie_totalizer ?? 0,
            };
        });
    }, [powerDist.power_revamping_totalizer, powerDist.power_pie_totalizer]);

    // Inherit status boiler & feeder dari shift sebelumnya (walkback hingga 15 shift)
    // Re-fire saat boilerA/B/coalBunker status berubah (mis. setelah clear effect navigasi shift)
    const _sf = latestBoilerStatus.statusFeeders;
    const _boilerAStatus = boilerA.status_boiler;
    const _boilerBStatus = boilerB.status_boiler;
    const _feederSig = [
        coalBunker.status_feeder_a, coalBunker.status_feeder_b, coalBunker.status_feeder_c,
        coalBunker.status_feeder_d, coalBunker.status_feeder_e, coalBunker.status_feeder_f,
    ].map(v => v ?? '').join('|');
    useEffect(() => {
        if (userModifiedRef.current || report) return;
        const { statusBoilerA, statusBoilerB } = latestBoilerStatus;
        if (statusBoilerA && !_boilerAStatus)
            setBoilerA(prev => prev.status_boiler ? prev : { ...prev, status_boiler: statusBoilerA });
        if (statusBoilerB && !_boilerBStatus)
            setBoilerB(prev => prev.status_boiler ? prev : { ...prev, status_boiler: statusBoilerB });
        const inherited: Record<string, string> = {};
        Object.entries(latestBoilerStatus.statusFeeders).forEach(([k, v]) => {
            if (v && !coalBunker[k]) inherited[k] = v as string;
        });
        if (Object.keys(inherited).length > 0)
            setCoalBunker(prev => {
                const next = { ...prev };
                let changed = false;
                Object.entries(inherited).forEach(([k, v]) => { if (!prev[k]) { next[k] = v; changed = true; } });
                return changed ? next : prev;
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        latestBoilerStatus.statusBoilerA, latestBoilerStatus.statusBoilerB,
        _sf.status_feeder_a, _sf.status_feeder_b, _sf.status_feeder_c,
        _sf.status_feeder_d, _sf.status_feeder_e, _sf.status_feeder_f,
        report,
        _boilerAStatus, _boilerBStatus, _feederSig,
    ]);

    // Inherit status turbin dari latestBoilerStatus.statusTurbin (walk back ≤15 hari, termasuk
    // harian sebagai entry terakhir per-hari). Inherit untuk SEMUA status (running/shutdown),
    // tidak hanya shutdown. Plus pre-fill raw totalizer kalau prev shift shutdown supaya nilai
    // stagnant tidak perlu re-input.
    const _latestTurbinStatus = latestBoilerStatus.statusTurbin;
    const _turbinStatus = turbin.status_turbin;
    useEffect(() => {
        if (userModifiedRef.current || report) return;
        if (!_latestTurbinStatus || _turbinStatus) return;
        setTurbin(prev => prev.status_turbin ? prev : { ...prev, status_turbin: _latestTurbinStatus });
        // Pre-fill raw totalizer dari prev shift hanya kalau status sebelumnya shutdown
        // (saat running, totalizer akumulasi, jadi nilai prev tidak relevan untuk default).
        if (_latestTurbinStatus === 'shutdown') {
            setTurbin(prev => {
                const next: Record<string, number | string | null> = { ...prev };
                let changed = false;
                if (prev.totalizer_steam_inlet == null && prevTurbin.totalizer_steam_inlet != null) {
                    next.totalizer_steam_inlet = prevTurbin.totalizer_steam_inlet;
                    changed = true;
                }
                if (prev.totalizer_condensate == null && prevTurbin.totalizer_condensate != null) {
                    next.totalizer_condensate = prevTurbin.totalizer_condensate;
                    changed = true;
                }
                return changed ? next : prev;
            });
            const prevStgTot = prevPowerDist.power_stg_ubb_totalizer;
            if (prevStgTot != null) {
                setPowerDist(prev => prev.power_stg_ubb_totalizer != null
                    ? prev
                    : { ...prev, power_stg_ubb_totalizer: prevStgTot });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_latestTurbinStatus, _turbinStatus, report]);

    // Generic change handlers
    const makeNumberHandler = (setter: React.Dispatch<React.SetStateAction<Record<string, number | null>>>) =>
        (name: string, value: number | string | null) => {
            setUserModified(true);
            setter(prev => ({
                ...prev,
                [name]: typeof value === 'string'
                    ? (value === '' ? null : parseFloat(value) ?? null)
                    : value,
            }));
        };

    const makeMixedHandler = (setter: React.Dispatch<React.SetStateAction<Record<string, number | string | null>>>) =>
        (name: string, value: number | string | null) => {
            setUserModified(true);
            setter(prev => ({ ...prev, [name]: value }));
        };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };


    const NON_TOTALIZER_FIELDS = [
        'press_steam','temp_steam','flow_steam','bfw_press','temp_bfw','flow_bfw',
        'air_heater_ti113','excess_air','temp_flue_gas','primary_air',
        'secondary_air','o2','steam_drum_press','solar_m3',
        'feeder_a_flow','feeder_b_flow','feeder_c_flow','feeder_d_flow','feeder_e_flow','feeder_f_flow',
    ];

    const handleSubmit = async () => {
        if (submitting) return;
        // Guard submit window — operator pengganti yang akses link lama tidak boleh nge-edit
        // shift di luar window submit (sebelum reminder time atau setelah grace period).
        if (isLocked) {
            const reason = isBeforeStart
                ? `Window submit belum dibuka (mulai ${submitWindow.start.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}).`
                : `Window submit sudah berakhir (deadline ${submitWindow.end.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}). Hubungi supervisor.`;
            setToast({ type: 'error', message: reason });
            setTimeout(() => setToast(null), 4000);
            return;
        }
        setSubmitting(true);
        setSaveProgress(5);
        // Animate progress 5→85% while saving
        const progressInterval = setInterval(() => {
            setSaveProgress(p => (p !== null && p < 85) ? p + 8 : p);
        }, 400);
        try {
            // Hitung selisih totalizer feeder (current - prev) sebagai konsumsi batubara shift ini
            const calcSelisih = (cur: number | string | null | undefined, prev: number | string | null | undefined) => {
                const c = Number(cur) || 0;
                const p = Number(prev) || 0;
                return p > 0 ? c - p : null;
            };
            const selisih = (key: string) => {
                const cur = Number(coalBunker[key]) || 0;
                const prev = Number(prevCoalBunker[key]) || 0;
                return prev > 0 ? cur - prev : 0;
            };
            const batubaraA = selisih('feeder_a') + selisih('feeder_b') + selisih('feeder_c');
            const batubaraB = selisih('feeder_d') + selisih('feeder_e') + selisih('feeder_f');

            // Selisih totalizer boiler
            const selisihSteamA = calcSelisih(boilerA.totalizer_steam, prevBoilerA.totalizer_steam);
            const selisihBfwA = calcSelisih(boilerA.totalizer_bfw, prevBoilerA.totalizer_bfw);
            const selisihSteamB = calcSelisih(boilerB.totalizer_steam, prevBoilerB.totalizer_steam);
            const selisihBfwB = calcSelisih(boilerB.totalizer_bfw, prevBoilerB.totalizer_bfw);

            // Selisih totalizer turbin
            const selisihTurbin = {
                selisih_steam_inlet: calcSelisih(turbin.totalizer_steam_inlet, prevTurbin.totalizer_steam_inlet),
                selisih_condensate: calcSelisih(turbin.totalizer_condensate, prevTurbin.totalizer_condensate),
            };

            // Selisih totalizer steam dist
            const selisihSteamDist = {
                selisih_pabrik1: calcSelisih(steamDist.pabrik1_totalizer, prevSteamDist.pabrik1_totalizer),
                selisih_pabrik2: calcSelisih(steamDist.pabrik2_totalizer, prevSteamDist.pabrik2_totalizer),
                selisih_pabrik3a: calcSelisih(steamDist.pabrik3a_totalizer, prevSteamDist.pabrik3a_totalizer),
            };

            // Selisih totalizer power dist
            const selisihPowerDist = {
                selisih_ubb: calcSelisih(powerDist.power_ubb_totalizer, prevPowerDist.power_ubb_totalizer),
                selisih_pabrik2: calcSelisih(powerDist.power_pabrik2_totalizer, prevPowerDist.power_pabrik2_totalizer),
                selisih_pabrik3a: calcSelisih(powerDist.power_pabrik3a_totalizer, prevPowerDist.power_pabrik3a_totalizer),
                selisih_revamping: calcSelisih(powerDist.power_revamping_totalizer, prevPowerDist.power_revamping_totalizer),
                selisih_pie: calcSelisih(powerDist.power_pie_totalizer, prevPowerDist.power_pie_totalizer),
                selisih_stg_ubb: calcSelisih(powerDist.power_stg_ubb_totalizer, prevPowerDist.power_stg_ubb_totalizer),
            };

            // Selisih totalizer feeder
            const selisihCoalBunker = {
                selisih_feeder_a: calcSelisih(coalBunker.feeder_a, prevCoalBunker.feeder_a),
                selisih_feeder_b: calcSelisih(coalBunker.feeder_b, prevCoalBunker.feeder_b),
                selisih_feeder_c: calcSelisih(coalBunker.feeder_c, prevCoalBunker.feeder_c),
                selisih_feeder_d: calcSelisih(coalBunker.feeder_d, prevCoalBunker.feeder_d),
                selisih_feeder_e: calcSelisih(coalBunker.feeder_e, prevCoalBunker.feeder_e),
                selisih_feeder_f: calcSelisih(coalBunker.feeder_f, prevCoalBunker.feeder_f),
            };

            // Total rit unloading fly ash per silo (saved + pending)
            const allAsh = [
                ...savedAshEntries,
                ...ashEntries.filter(e => e.silo && e.perusahaan && e.tujuan && e.ritase !== null),
            ];
            const totalRitA = allAsh.filter(e => e.silo === 'A').reduce((s, e) => s + (e.ritase ?? 0), 0);
            const totalRitB = allAsh.filter(e => e.silo === 'B').reduce((s, e) => s + (e.ritase ?? 0), 0);

            // When boiler shutdown, force all non-totalizer fields to 0
            const applyShutdownZeros = (data: Record<string, number | string | null>) => {
                const result = { ...data };
                NON_TOTALIZER_FIELDS.forEach(k => { result[k] = 0; });
                return result;
            };
            const finalBoilerA = boilerA.status_boiler === 'shutdown' ? applyShutdownZeros(boilerA) : boilerA;
            const finalBoilerB = boilerB.status_boiler === 'shutdown' ? applyShutdownZeros(boilerB) : boilerB;

            // Turbin shutdown → zero semua field operasional KECUALI kartu deaerator + raw totalizer.
            // Selisih steam_inlet/condensate diabaikan (kalau totalizer tidak berubah, selisih=0 alami).
            const TURBIN_KEEP_ON_SHUTDOWN = new Set([
                'press_deaerator', 'temp_deaerator',
                'totalizer_steam_inlet', 'totalizer_condensate',
                'selisih_steam_inlet', 'selisih_condensate',
                'status_turbin',
            ]);
            const isTurbinShutdown = turbin.status_turbin === 'shutdown';
            const turbinMerged = { ...turbin, ...selisihTurbin };
            const finalTurbin: Record<string, number | string | null> = isTurbinShutdown
                ? Object.fromEntries(
                    Object.entries(turbinMerged).map(([k, v]) =>
                        TURBIN_KEEP_ON_SHUTDOWN.has(k) ? [k, v] : [k, 0]
                    )
                )
                : turbinMerged;

            // Generator output → zero hanya kalau turbin shutdown (cascade).
            // GI & power dist tidak terpengaruh (PLN tetap bisa import lewat GI).
            const GEN_OUTPUT_FIELDS = ['gen_load', 'gen_ampere', 'gen_tegangan',
                'gen_amp_react', 'gen_frequensi', 'gen_cos_phi'];
            const finalGeneratorGi = isTurbinShutdown
                ? { ...generatorGi, ...Object.fromEntries(GEN_OUTPUT_FIELDS.map(k => [k, 0])) }
                : generatorGi;

            const result = await submitReport({
                group_name: currentGroup || operator?.group || 'A',
                supervisor: supervisor || operator?.name || 'Operator',
                created_by: operator?.supabaseId || '',
                boilerA: { ...finalBoilerA, batubara_ton: batubaraA, selisih_steam: selisihSteamA, selisih_bfw: selisihBfwA },
                boilerB: { ...finalBoilerB, batubara_ton: batubaraB, selisih_steam: selisihSteamB, selisih_bfw: selisihBfwB },
                turbin: finalTurbin,
                steamDist: { ...steamDist, ...selisihSteamDist },
                generatorGi: finalGeneratorGi,
                powerDist: { ...powerDist, ...selisihPowerDist },
                espHandling: { hopper: 'A', conveyor: 'AB', ...espHandling, unloading_a: totalRitA, unloading_b: totalRitB },
                tankyard,
                personnel: {
                    turbin_grup: currentGroup || operator?.group || null,
                    turbin_karu: foremanTurbin || null,
                    turbin_kasi: supervisor || null,
                    boiler_grup: currentGroup || operator?.group || null,
                    boiler_karu: foremanBoiler || null,
                    boiler_kasi: supervisor || null,
                },
                coalBunker: { ...coalBunker, ...selisihCoalBunker },
                waterQuality: { ...waterQuality, ...chemicalDosing },
                prevBoilerA: { totalizer_steam: (prevBoilerA.totalizer_steam as number | null) ?? null },
                prevBoilerB: { totalizer_steam: (prevBoilerB.totalizer_steam as number | null) ?? null },
                // Station-scoped fill audit: hanya di-kirim kalau operator submit dari station view.
                ...(station && fillerName ? { station_filler: { station, name: fillerName } } : {}),
            });
            // Save solar unloadings if filled
            const validSolarEntries = solarEntries.filter(e => e.tanggal && e.jumlah && e.perusahaan);
            if (validSolarEntries.length > 0) {
                const supabase = createClient();
                const inserts = validSolarEntries.map(entry => ({
                    date: selectedDate, // Store the shift date for filtering
                    shift: shiftMap[selectedShift],
                    date_time: entry.tanggal, // if table structure doesn't support multiple, we rely on the migration adding shift. Wait, 'date' is used usually for timestamp in old inserts. I'll use entry.tanggal for date because the table is date TEXT.
                    liters: entry.jumlah,
                    supplier: entry.perusahaan,
                    operator_id: operator?.supabaseId ?? null,
                }));
                // Make sure to correctly map to expected 'date' column with ISO time, but wait, if we changed it to use date as YYYY-MM-DD we'd break old code. Let's send the entry.tanggal as date, and passing shift explicitly. 
                await supabase.from('solar_unloadings').insert(inserts.map(i => ({ date: selectedDate, liters: i.liters, supplier: i.supplier, shift: i.shift, operator_id: i.operator_id })) as any[]);
            }

            // Save solar usages if filled
            const validOutSolarEntries = outSolarEntries.filter(e => e.tanggal && e.jumlah && e.tujuan);
            if (validOutSolarEntries.length > 0) {
                const supabase = createClient();
                const outInserts = validOutSolarEntries.map(entry => ({
                    date: entry.tanggal, // This saves exact time string
                    shift: shiftMap[selectedShift],
                    liters: entry.jumlah,
                    tujuan: entry.tujuan,
                    operator_id: operator?.supabaseId ?? null,
                }));
                await supabase.from('solar_usages').insert(outInserts as any[]);
            }

            // Save ash unloadings if filled
            const validAshEntries = ashEntries.filter(e => e.silo && e.perusahaan && e.tujuan && e.ritase !== null);
            if (validAshEntries.length > 0) {
                const supabase = createClient();
                const ashInserts = validAshEntries.map(entry => ({
                    date: selectedDate,
                    shift: shiftMap[selectedShift],
                    silo: entry.silo,
                    perusahaan: entry.perusahaan,
                    tujuan: entry.tujuan,
                    ritase: entry.ritase,
                    operator_id: operator?.supabaseId ?? null,
                }));
                await supabase.from('ash_unloadings').insert(ashInserts as any[]);
            }

            clearInterval(progressInterval);
            setSaveProgress(100);
            setTimeout(() => setSaveProgress(null), 800);

            if (result?.error) {
                showToast('Error: ' + result.error, 'error');
            } else {
                showToast('Laporan berhasil disimpan!', 'success');
                setUserModified(false);
                lastSubmittedReportId.current = result?.reportId || null;
                refetch();
                // Refresh saved data
                const spb = createClient();
                spb.from('ash_unloadings').select('id, silo, perusahaan, tujuan, ritase')
                    .eq('date', selectedDate).eq('shift', shiftMap[selectedShift])
                    .order('created_at', { ascending: true })
                    .then(({ data }) => setSavedAshEntries((data ?? []).map((r: any) => ({ id: r.id, silo: r.silo, perusahaan: r.perusahaan, tujuan: r.tujuan, ritase: r.ritase }))));

                spb.from('solar_unloadings').select('id, date, supplier, liters')
                    .eq('date', selectedDate).eq('shift', shiftMap[selectedShift])
                    .order('created_at', { ascending: true })
                    .then(({ data }) => setSavedSolarEntries((data ?? []).map((r: any) => ({ id: r.id, tanggal: r.date, jumlah: r.liters, perusahaan: r.supplier }))));

                spb.from('solar_usages').select('id, date, tujuan, liters')
                    .eq('date', selectedDate).eq('shift', shiftMap[selectedShift])
                    .order('created_at', { ascending: true })
                    .then(({ data }) => setSavedOutSolarEntries((data ?? []).map((r: any) => ({ id: r.id, tanggal: r.date, jumlah: r.liters, tujuan: r.tujuan }))));

                setAshEntries([]);
                setSolarEntries([]);
                setOutSolarEntries([]);
            }
        } catch (err) {
            clearInterval(progressInterval);
            setSaveProgress(null);
            showToast('Terjadi kesalahan saat menyimpan laporan.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveDraft = async () => {
        await handleSubmit();
    };

    const isTabLengkap = React.useCallback((tabId: TabId) => {
        const hasVal = (obj: Record<string, any>, keys: string[]) => keys.every(k => obj[k] !== null && obj[k] !== undefined && obj[k] !== '');
        
        switch (tabId) {
            case 'Boiler A':
                if (boilerA.status_boiler === 'shutdown')
                    return hasVal(boilerA, ['totalizer_steam', 'totalizer_bfw']) && hasVal(coalBunker, ['feeder_a', 'feeder_b', 'feeder_c']);
                return hasVal(boilerA, ['press_steam', 'temp_steam', 'flow_steam', 'totalizer_steam', 'bfw_press', 'temp_bfw', 'flow_bfw', 'totalizer_bfw', 'temp_furnace', 'air_heater_ti113', 'excess_air', 'temp_flue_gas', 'primary_air', 'secondary_air', 'o2', 'steam_drum_press']) && hasVal(coalBunker, ['feeder_a', 'feeder_b', 'feeder_c']);
            case 'Boiler B':
                if (boilerB.status_boiler === 'shutdown')
                    return hasVal(boilerB, ['totalizer_steam', 'totalizer_bfw']) && hasVal(coalBunker, ['feeder_d', 'feeder_e', 'feeder_f']);
                return hasVal(boilerB, ['press_steam', 'temp_steam', 'flow_steam', 'totalizer_steam', 'bfw_press', 'temp_bfw', 'flow_bfw', 'totalizer_bfw', 'temp_furnace', 'air_heater_ti113', 'excess_air', 'temp_flue_gas', 'primary_air', 'secondary_air', 'o2', 'steam_drum_press']) && hasVal(coalBunker, ['feeder_d', 'feeder_e', 'feeder_f']);
            case 'Turbin': return hasVal(turbin, ['press_steam', 'temp_steam', 'flow_steam', 'totalizer_steam_inlet', 'flow_cond', 'exh_steam', 'vacuum', 'level_condenser', 'hpo_durasi', 'totalizer_condensate', 'thrust_bearing', 'metal_bearing', 'vibrasi', 'winding', 'axial_displacement', 'press_deaerator', 'temp_deaerator', 'temp_cw_in', 'temp_cw_out']);
            case 'Generator': return hasVal(generatorGi, ['gen_load', 'gen_ampere', 'gen_tegangan', 'gen_amp_react', 'gen_frequensi', 'gen_cos_phi', 'gi_sum_p', 'gi_sum_q', 'gi_cos_phi']) && hasVal(powerDist, ['power_ubb', 'power_ubb_totalizer', 'power_pabrik2', 'power_pabrik2_totalizer', 'power_pabrik3a', 'power_pabrik3a_totalizer', 'power_revamping', 'power_revamping_totalizer', 'power_pie', 'power_pie_totalizer', 'power_stg_ubb_totalizer']);
            case 'Distribusi Steam': return hasVal(steamDist, ['pabrik1_flow', 'pabrik1_temp', 'pabrik1_totalizer', 'pabrik2_flow', 'pabrik2_temp', 'pabrik2_totalizer', 'press_lps', 'pabrik3a_flow', 'pabrik3a_temp', 'pabrik3a_totalizer']);
            case 'Handling': return hasVal(espHandling, ['loading', 'hopper', 'conveyor']) && hasVal(tankyard, ['tk_rcw', 'tk_demin', 'tk_solar_ab']);
            case 'ESP': return hasVal(espHandling, ['esp_a1', 'esp_a2', 'esp_a3', 'esp_b1', 'esp_b2', 'esp_b3', 'silo_a', 'silo_b']);
            case 'Coal Bunker': return hasVal(coalBunker, ['bunker_a', 'bunker_b', 'bunker_c', 'bunker_d', 'bunker_e', 'bunker_f']);
            case 'Lab': return hasVal(waterQuality, ['demin_1250_ph', 'demin_1250_conduct', 'bfw_ph', 'bfw_conduct', 'boiler_water_a_ph', 'boiler_water_b_ph', 'product_steam_ph']) && hasVal(chemicalDosing, ['phosphate_level_tanki', 'phosphate_stroke_pompa', 'phosphate_b_level_tanki', 'phosphate_b_stroke_pompa', 'amine_level_tanki', 'amine_stroke_pompa', 'hydrazine_level_tanki', 'hydrazine_stroke_pompa']);
            default: return false;
        }
    }, [boilerA, boilerB, turbin, generatorGi, powerDist, steamDist, tankyard, espHandling, coalBunker, waterQuality, chemicalDosing]);

    // Semua tab visible (sesuai station kalau ada) sudah lengkap → tombol Publish aktif.
    const allTabsComplete = useMemo(
        () => visibleTabs.length > 0 && visibleTabs.every(t => isTabLengkap(t.id)),
        [visibleTabs, isTabLengkap],
    );

    const loadSampleData = () => {
        const d = SAMPLE_MALAM_01JAN;
        skipNextClear.current = true;
        setSelectedDate(d.date);
        setSelectedShift(d.shift);
        setBoilerA(d.boilerA);
        setBoilerB(d.boilerB);
        setTurbin(d.turbin);
        setSteamDist(d.steamDist);
        setGeneratorGi(d.generatorGi);
        setPowerDist(d.powerDist);
        setEspHandling(d.espHandling);
        setTankyard(d.tankyard);
        setCoalBunker(d.coalBunker);
        setAshEntries([]);
        setSolarEntries([]);
        setOutSolarEntries([]);
        showToast('Data referensi Malam 01 Jan 2026 berhasil dimuat!', 'success');
    };

    return (
        <div className="flex-1 w-full max-w-[1366px] mx-auto p-4 lg:p-6 flex flex-col gap-4 h-full overflow-hidden">
            {/* Loading Overlay */}
            {submitting && (
                <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
                    <div className="relative flex flex-col items-center justify-center bg-[#16202e] border border-slate-700/50 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 w-72">
                        <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-2xl pointer-events-none"></div>
                        <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                        <h3 className="text-white font-black text-xl tracking-wide mb-1 relative z-10">Menyimpan data</h3>
                        <p className="text-slate-400 text-sm font-medium mb-5 relative z-10">Mohon tunggu sebentar...</p>
                        {saveProgress !== null && (
                            <div className="w-full relative z-10">
                                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                                    <span>Progress</span>
                                    <span className="font-bold text-emerald-400">{saveProgress}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-700/60 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                                        style={{ width: `${saveProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Navigation Warning Modal */}
            {showNavWarning && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[#16202e] border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-400 text-[22px]">warning</span>
                            </div>
                            <h3 className="text-white font-extrabold text-base">Data Belum Dikirim</h3>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed mb-5">
                            Kamu belum mengirim laporan shift. Data yang sudah diisi akan <span className="text-rose-400 font-semibold">hilang</span> jika pindah halaman.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleNavStay}
                                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-bold hover:bg-slate-700/50 transition-colors cursor-pointer"
                            >
                                Kembali
                            </button>
                            <button
                                onClick={handleNavLeave}
                                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-colors cursor-pointer"
                            >
                                Tinggalkan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className={`px-8 py-5 rounded-2xl shadow-2xl text-white text-base font-semibold transition-all scale-100 pointer-events-auto ${
                        toast.type === 'success'
                            ? 'bg-emerald-600 border border-emerald-400/50 shadow-emerald-500/30'
                            : 'bg-red-600 border border-red-400/50 shadow-red-500/30'
                    }`}>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-[28px]">
                                {toast.type === 'success' ? 'check_circle' : 'error'}
                            </span>
                            {toast.message}
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shrink-0 mt-4 mb-2 bg-[#101822]/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 lg:p-6 shadow-xl relative overflow-hidden">
                {/* Background Glow based on shift */}
                <div className={`absolute -inset-[100px] blur-3xl opacity-20 pointer-events-none transition-colors duration-1000 ${
                    inputMode === 'harian' ? 'bg-emerald-500/30' :
                    selectedShift === 1 ? 'bg-indigo-500/30' : 
                    selectedShift === 2 ? 'bg-amber-500/30' : 'bg-orange-500/30'
                }`}></div>

                <div className="flex flex-col gap-1 z-10 w-full lg:w-auto">
                    {/* Row 1: Judul + Badge Shift + Tanggal (Date Picker) */}
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
                            {inputMode === 'shift' ? 'LAPORAN SHIFT' : 'LAPORAN HARIAN'}
                        </h2>
                        {inputMode === 'shift' ? (
                            <span className="px-3 py-1 rounded-lg text-sm font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-widest">
                                {SHIFT_LABELS[selectedShift].toUpperCase()}
                            </span>
                        ) : (
                            <span className="px-3 py-1 rounded-lg text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
                                REPORT HARIAN
                            </span>
                        )}
                        {/* Group + Tanggal (Date Picker) — tampil untuk shift maupun harian */}
                        {(() => {
                            const group = inputMode === 'harian'
                                ? getGroupMalamOnDate(selectedDate)
                                : currentGroup;
                            return (
                                <>
                                    <span className={`px-3 py-1 rounded-lg text-sm font-black border uppercase tracking-widest ${
                                        group === 'A' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                                        group === 'B' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                        group === 'C' ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' :
                                        group === 'D' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                        'bg-slate-700/30 text-slate-400 border-slate-600/30'
                                    }`}>
                                        {group ? `Group ${group}` : 'Off'}
                                    </span>

                                    {/* Tanggal (Date Picker) - Swapped to Row 1 */}
                                    <div 
                                        onClick={() => {
                                            try {
                                                dateInputRef.current?.showPicker();
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }}
                                        className={`relative flex flex-col bg-slate-900/60 hover:bg-slate-900/80 border transition-all duration-200 rounded-xl pl-3 pr-8 py-1 min-w-[180px] lg:min-w-[240px] cursor-pointer focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/30 ${isToday ? 'bg-blue-500/5 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-slate-800'}`}
                                    >
                                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-tight select-none">Tanggal</span>
                                        <div className="relative w-full flex items-center h-5">
                                            <span className="text-xs lg:text-sm font-black text-blue-100 select-none">
                                                {formattedDate || selectedDate}
                                            </span>
                                            <input
                                                ref={dateInputRef}
                                                type="date"
                                                value={selectedDate}
                                                onChange={e => setSelectedDate(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full bg-transparent border-none outline-none ring-0 appearance-none focus:ring-0 focus:border-none focus:outline-none [color-scheme:dark]"
                                            />
                                        </div>
                                        <span className="material-symbols-outlined text-[18px] text-blue-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none select-none">calendar_month</span>
                                        {isToday && inputMode === 'shift' && (
                                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Station mode (shift & harian): cuma tampilkan badge station di header.
                                        Picker "Diisi oleh" ada di sidebar masing-masing form (style sama). */}
                                    {station && (
                                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold border uppercase tracking-wider ${
                                            inputMode === 'harian' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                        }`}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>badge</span>
                                            {STATION_LABELS[station]}
                                        </span>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                    {/* Row 2: Supervisor, Waktu, Foreman Boiler, Foreman Turbin. */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono mt-3">
                        {/* Supervisor dropdown - Swapped to Row 2 */}
                        {!station && (
                            <div className="relative flex flex-col bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/30 rounded-xl pl-3 pr-8 py-1 transition-all duration-200 min-w-[180px] lg:min-w-[240px]">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight select-none">Supervisor</span>
                                <div className="relative w-full flex items-center">
                                    <select 
                                        value={supervisor} 
                                        onChange={e => setSupervisor(e.target.value)} 
                                        className="w-full bg-transparent border-none p-0 text-xs lg:text-sm font-black text-slate-100 focus:ring-0 cursor-pointer appearance-none outline-none"
                                    >
                                        <option value="" className="bg-[#101822] text-slate-400">Pilih...</option>
                                        {supervisorOptions.map(op => (
                                            <option key={op.id} value={op.name} className="bg-[#101822] text-slate-100">{op.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <span className="material-symbols-outlined text-[18px] text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none select-none">expand_more</span>
                            </div>
                        )}

                        {!station && <span className="text-slate-600 hidden sm:inline">|</span>}

                        {inputMode === 'shift' && !station && (
                            <>
                                <div className="relative flex flex-col bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/30 rounded-xl pl-3 pr-8 py-1 transition-all duration-200 min-w-[180px] lg:min-w-[240px]">
                                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest leading-tight select-none">Foreman Boiler</span>
                                    <div className="relative w-full flex items-center">
                                        <select 
                                            value={foremanBoiler} 
                                            onChange={e => setForemanBoiler(e.target.value)} 
                                            className="w-full bg-transparent border-none p-0 text-xs lg:text-sm font-black text-amber-100 focus:ring-0 cursor-pointer appearance-none outline-none"
                                        >
                                            <option value="" className="bg-[#101822] text-slate-400">Pilih...</option>
                                            {foremanBoilerOptions.map(op => (
                                                <option key={op.id} value={op.name} className="bg-[#101822] text-amber-100">{op.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none select-none">expand_more</span>
                                </div>

                                <div className="relative flex flex-col bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/30 rounded-xl pl-3 pr-8 py-1 transition-all duration-200 min-w-[180px] lg:min-w-[240px]">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-tight select-none">Foreman Turbin</span>
                                    <div className="relative w-full flex items-center">
                                        <select 
                                            value={foremanTurbin} 
                                            onChange={e => setForemanTurbin(e.target.value)} 
                                            className="w-full bg-transparent border-none p-0 text-xs lg:text-sm font-black text-indigo-100 focus:ring-0 cursor-pointer appearance-none outline-none"
                                        >
                                            <option value="" className="bg-[#101822] text-slate-400">Pilih...</option>
                                            {foremanTurbinOptions.map(op => (
                                                <option key={op.id} value={op.name} className="bg-[#101822] text-indigo-100">{op.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <span className="material-symbols-outlined text-[18px] text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none select-none">expand_more</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Status banner — penting untuk operator pengganti yang akses link lama */}
                    {(isReportSubmitted || isLocked) && (
                        <div className={`mt-3 px-4 py-2.5 rounded-lg border flex items-center gap-2.5 text-sm font-bold ${
                            isLocked
                                ? 'bg-red-500/15 border-red-500/40 text-red-300'
                                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        }`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                                {isLocked ? 'lock' : 'warning'}
                            </span>
                            <span>
                                {isBeforeStart
                                    ? `Window submit ${inputMode === 'shift' ? SHIFT_LABELS[selectedShift].toLowerCase() : 'laporan harian'} belum dibuka (mulai ${submitWindow.start.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}).`
                                : isPastDeadline
                                    ? `Window submit ${inputMode === 'shift' ? SHIFT_LABELS[selectedShift].toLowerCase() : 'laporan harian'} sudah berakhir (deadline ${submitWindow.end.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}). Hubungi supervisor untuk koreksi.`
                                    : `Laporan ini sudah disubmit. Submit ulang akan mengganti data. Deadline koreksi: ${submitWindow.end.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Mode & Shift Controls */}
                <div className="flex flex-col gap-3 z-10 shrink-0 w-full lg:w-[340px]">
                    {!station && (
                        <div className="flex bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80 gap-2 shadow-[inset_0_1.5px_4px_rgba(0,0,0,0.5)]">
                            <button
                                onClick={() => setInputMode('shift')}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs uppercase tracking-wider font-bold transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]
                                    ${inputMode === 'shift' 
                                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]' 
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'}`}
                            >
                                <span className="material-symbols-outlined text-sm">schedule</span>
                                <span>Shift</span>
                            </button>
                            <button
                                onClick={() => setInputMode('harian')}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs uppercase tracking-wider font-bold transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]
                                    ${inputMode === 'harian' 
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]' 
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'}`}
                            >
                                <span className="material-symbols-outlined text-sm">today</span>
                                <span>Harian</span>
                            </button>
                        </div>
                    )}
                    {/* Station badge — label statis sudah dipindah ke row 1 header */}

                    {/* Admin badge — admin bypass window submit, bisa isi laporan kapan saja */}
                    {isAdmin && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-300">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>admin_panel_settings</span>
                            <span className="text-xs font-bold uppercase tracking-wider">Admin Override — Bisa isi semua tanggal/shift</span>
                        </div>
                    )}

                    {inputMode === 'shift' && (
                        <div className="flex bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80 gap-2 shadow-[inset_0_1.5px_4px_rgba(0,0,0,0.5)]">
                            {[
                                { 
                                    id: 1, 
                                    label: 'Malam (06)', 
                                    icon: 'bedtime', 
                                    activeClass: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:from-indigo-500 hover:to-violet-500' 
                                },
                                { 
                                    id: 2, 
                                    label: 'Pagi (14)', 
                                    icon: 'light_mode', 
                                    activeClass: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-[0_4px_14px_rgba(245,158,11,0.35)] hover:from-amber-400 hover:to-yellow-400' 
                                },
                                { 
                                    id: 3, 
                                    label: 'Sore (22)', 
                                    icon: 'wb_twilight', 
                                    activeClass: 'bg-gradient-to-r from-orange-600 to-red-500 text-white shadow-[0_4px_14px_rgba(234,88,12,0.35)] hover:from-orange-500 hover:to-red-400' 
                                }
                            ].map(shift => (
                                <button
                                    key={shift.id}
                                    onClick={() => setSelectedShift(shift.id as 1 | 2 | 3)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] sm:text-xs uppercase tracking-wider font-bold transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]
                                        ${selectedShift === shift.id 
                                            ? shift.activeClass 
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'}`}
                                >
                                    <span className="material-symbols-outlined text-sm">{shift.icon}</span>
                                    <span>{shift.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            {inputMode === 'shift' ? (
                <div className="flex flex-col lg:flex-row gap-6 w-full max-w-full">
                    {/* Left Sidebar */}
                    <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
                        {/* Action Buttons */}
                        <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
                            <div>
                                <h3 className="text-white font-bold text-sm mb-1">Menu Laporan</h3>
                                <p className="text-[11px] text-slate-400 leading-tight">Pilih kategori area untuk mulai input data shift.</p>
                            </div>
                            <div className="flex flex-col gap-2 mt-1">
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || isLocked}
                                    title={isBeforeStart ? `Window submit mulai ${submitWindow.start.toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : isPastDeadline ? 'Window submit sudah berakhir' : undefined}
                                    className={`flex justify-center items-center gap-2 ${isLocked ? 'bg-slate-700 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500'} text-white px-4 py-3 rounded-lg text-sm font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-emerald-500/50 w-full ${submitting || isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <span className="material-symbols-outlined text-[20px]">{isLocked ? 'lock' : 'save'}</span>
                                    {submitting ? 'Menyimpan...' : isLocked ? 'TERKUNCI' : 'SIMPAN LAPORAN'}
                                </button>
                                {/* Publish — aktif kalau semua tab visible centang lengkap DAN report sudah submit.
                                    Admin bypass: bisa klik tanpa nunggu centang lengkap (untuk testing). */}
                                {(() => {
                                    const publishDisabled = !report?.id || (!isAdmin && !allTabsComplete);
                                    return (
                                        <button
                                            onClick={() => setPublishOpen(true)}
                                            disabled={publishDisabled}
                                            title={!report?.id ? 'Submit laporan dulu sebelum publish' : (!allTabsComplete && !isAdmin) ? 'Semua tab harus lengkap dulu' : 'Publish ke WhatsApp'}
                                            className={`flex justify-center items-center gap-2 ${publishDisabled ? 'bg-slate-700 cursor-not-allowed opacity-60' : 'bg-blue-600 hover:bg-blue-500'} text-white px-4 py-3 rounded-lg text-sm font-bold transition-all shadow-[0_0_15px_rgba(43,124,238,0.3)] border border-blue-500/50 w-full`}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">send</span>
                                            PUBLISH LAPORAN{isAdmin && !allTabsComplete ? ' (Admin)' : ''}
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Station info + Diisi oleh — mirror style harian sidebar */}
                        {station && (
                            <div className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-[#0f1721]/80 border border-slate-700/50 shadow-lg">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-400" style={{ fontSize: 18 }}>badge</span>
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Station</span>
                                    <span className="text-sm font-extrabold text-white">{STATION_LABELS[station]}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Diisi oleh</span>
                                    <div className="flex items-center gap-1.5 bg-[#101822] px-2 py-1.5 rounded-lg border border-slate-700/50 relative pr-5">
                                        <select value={fillerName} onChange={e => setFillerName(e.target.value)} className="bg-transparent border-none p-0 text-sm font-bold text-white focus:ring-0 cursor-pointer appearance-none outline-none w-full">
                                            <option value="" className="bg-[#101822]">Pilih...</option>
                                            {operators.map(op => (
                                                <option key={op.id} value={op.name} className="bg-[#101822]">
                                                    {op.name}{op.group ? ` (Group ${op.group})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="material-symbols-outlined text-[16px] text-slate-500 absolute right-1 pointer-events-none">arrow_drop_down</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Desktop Tab List */}
                        <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-2 shadow-lg hidden lg:flex flex-col gap-1">
                            {visibleTabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                const isComplete = isTabLengkap(tab.id);
                                const styles = TAB_STYLES[tab.colorClass];
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as TabId)}
                                        className={`w-full text-left px-4 py-3 rounded-lg text-sm flex items-center gap-3 transition-all border relative overflow-hidden group ${isActive ? styles.active : styles.inactive}`}
                                    >
                                        <span className={`material-symbols-outlined text-[20px] ${isActive ? styles.icon : 'opacity-70 group-hover:opacity-100 transition-opacity'}`}>
                                            {tab.icon}
                                        </span>
                                        <span className="flex-1">{tab.label}</span>
                                        {isComplete && (
                                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 mr-1 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                                                <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                            </div>
                                        )}
                                        {isActive && <span className="material-symbols-outlined text-[16px] opacity-70">chevron_right</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Mobile Tab List */}
                        <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-2 shadow-lg lg:hidden overflow-x-auto">
                            <div className="flex gap-2 w-max pb-1">
                                {visibleTabs.map((tab) => {
                                    const isActive = activeTab === tab.id;
                                    const isComplete = isTabLengkap(tab.id);
                                    const styles = TAB_STYLES[tab.colorClass];
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as TabId)}
                                            className={`px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-all whitespace-nowrap border relative overflow-hidden ${isActive ? styles.active : styles.inactive}`}
                                        >
                                            <span className={`material-symbols-outlined text-[18px] ${isActive ? styles.icon : 'opacity-70'}`}>
                                                {tab.icon}
                                            </span>
                                            <span>{tab.label}</span>
                                            {isComplete && (
                                                <div className="flex items-center justify-center w-4 h-4 ml-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400">
                                                    <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Tab Content Area */}
                    <div className="flex-1 min-w-0 flex flex-col gap-4">
                        {/* Active Tab Header */}
                        <div className="bg-[#16202e]/80 backdrop-blur-md border border-slate-800/80 rounded-xl px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-3 sm:gap-4 shadow-lg overflow-hidden">
                            {(() => {
                                const tab = visibleTabs.find(t => t.id === activeTab);
                                const styles = tab ? TAB_STYLES[tab.colorClass] : TAB_STYLES['rose'];
                                const isBoilerTab = activeTab === 'Boiler A' || activeTab === 'Boiler B';
                                const currentBoilerState = activeTab === 'Boiler A' ? boilerA : boilerB;
                                const setCurrentBoiler = activeTab === 'Boiler A' ? setBoilerA : setBoilerB;
                                const boilerStatus = (currentBoilerState.status_boiler as string) ?? '';
                                return (
                                    <>
                                        <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center bg-[#101822] border border-slate-700/50 shadow-inner shrink-0`}>
                                            <span className={`material-symbols-outlined text-[22px] sm:text-[30px] ${styles.icon}`}>{tab?.icon}</span>
                                        </div>
                                        <h2 className="text-white font-bold text-xl sm:text-3xl tracking-wide shrink-0">{tab?.label}</h2>
                                        {isBoilerTab && (() => {
                                            const boilerBorder = boilerStatus === 'running' ? 'border-emerald-500/50' : boilerStatus === 'shutdown' ? 'border-red-500/50' : 'border-slate-700/60';
                                            const boilerDot = boilerStatus === 'running' ? 'bg-emerald-500' : boilerStatus === 'shutdown' ? 'bg-red-500' : 'bg-slate-500';
                                            return (
                                                <div className={`inline-flex items-center gap-2 sm:gap-3 bg-[#101822]/60 border ${boilerBorder} rounded-lg sm:rounded-xl pl-3 sm:pl-4 pr-2 sm:pr-3 py-2 sm:py-2.5 transition-colors shrink-0`}>
                                                    <span className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${boilerDot} shrink-0`} />
                                                    <select
                                                        className="bg-transparent appearance-none text-base sm:text-xl text-white font-bold uppercase pr-4 sm:pr-6 cursor-pointer outline-none tracking-wide"
                                                        value={boilerStatus}
                                                        onChange={e => {
                                                            const v = e.target.value === '' ? null : e.target.value;
                                                            setUserModified(true);
                                                            setCurrentBoiler(prev => ({ ...prev, status_boiler: v }));
                                                        }}
                                                    >
                                                        <option value="" className="bg-[#101822] text-slate-500">Status...</option>
                                                        <option value="running" className="bg-[#101822] text-white">Running</option>
                                                        <option value="shutdown" className="bg-[#101822] text-white">Shutdown</option>
                                                    </select>
                                                </div>
                                            );
                                        })()}
                                        {/* Status chip Turbin — saat shutdown, cascade: zero field operasional di turbin
                                            (kecuali kartu deaerator + raw totalizer) dan gen output di tab Generator. */}
                                        {activeTab === 'Turbin' && (() => {
                                            const turbinStatus = (turbin.status_turbin as string) ?? '';
                                            const tBorder = turbinStatus === 'running' ? 'border-emerald-500/50' : turbinStatus === 'shutdown' ? 'border-red-500/50' : 'border-slate-700/60';
                                            const tDot = turbinStatus === 'running' ? 'bg-emerald-500' : turbinStatus === 'shutdown' ? 'bg-red-500' : 'bg-slate-500';
                                            return (
                                                <div className={`inline-flex items-center gap-2 sm:gap-3 bg-[#101822]/60 border ${tBorder} rounded-lg sm:rounded-xl pl-3 sm:pl-4 pr-2 sm:pr-3 py-2 sm:py-2.5 transition-colors shrink-0`}>
                                                    <span className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${tDot} shrink-0`} />
                                                    <select
                                                        className="bg-transparent appearance-none text-base sm:text-xl text-white font-bold uppercase pr-4 sm:pr-6 cursor-pointer outline-none tracking-wide"
                                                        value={turbinStatus}
                                                        onChange={e => {
                                                            const v = e.target.value === '' ? null : e.target.value;
                                                            setUserModified(true);
                                                            setTurbin(prev => ({ ...prev, status_turbin: v }));
                                                        }}
                                                    >
                                                        <option value="" className="bg-[#101822] text-slate-500">Status...</option>
                                                        <option value="running" className="bg-[#101822] text-white">Running</option>
                                                        <option value="shutdown" className="bg-[#101822] text-white">Shutdown</option>
                                                    </select>
                                                </div>
                                            );
                                        })()}
                                    </>
                                );
                            })()}
                        </div>

                        {/* Loading Overlay — tampil saat data sedang di-fetch dari Supabase */}
                        {(loading || !initialDataReady) ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[400px] bg-[#16202e]/60 backdrop-blur-md border border-slate-800/80 rounded-xl">
                                <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_12px_rgba(16,185,129,0.3)]"></div>
                                <div className="text-center">
                                    <h3 className="text-white font-bold text-base mb-1">Memuat data dari Supabase</h3>
                                    <p className="text-slate-400 text-sm">Mengambil data laporan shift...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Empty state — station tidak punya tab di mode shift (mis. lapangan_turbin) */}
                                {visibleTabs.length === 0 && station && (
                                    <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[400px] bg-[#16202e]/60 backdrop-blur-md border border-slate-800/80 rounded-xl text-center px-6">
                                        <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 56 }}>info</span>
                                        <h3 className="text-white font-bold text-base">Station <span className="text-blue-400">{STATION_LABELS[station]}</span> tidak punya tab di laporan shift.</h3>
                                        <p className="text-slate-400 text-sm max-w-md">Station ini hanya mengisi data di laporan harian. Buka link yang sesuai dari grup WA.</p>
                                    </div>
                                )}
                                {/* Shift Tab Content */}
                                {visibleTabs.length > 0 && (
                                <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0 pb-6 w-full max-w-full">
                                    {activeTab === 'Boiler A' && <TabBoiler boilerId="A" values={boilerA} onFieldChange={makeMixedHandler(setBoilerA)} coalBunkerValues={coalBunker} onCoalBunkerChange={makeMixedHandler(setCoalBunker)} prevTotalizerSteam={prevBoilerA.totalizer_steam as number | null} prevTotalizerBfw={prevBoilerA.totalizer_bfw as number | null} prevCoalBunkerValues={prevCoalBunker as Record<string, number | null>} shutdownSince={boilerShutdownSince.boiler_a} currentDate={selectedDate} />}
                                    {activeTab === 'Boiler B' && <TabBoiler boilerId="B" values={boilerB} onFieldChange={makeMixedHandler(setBoilerB)} coalBunkerValues={coalBunker} onCoalBunkerChange={makeMixedHandler(setCoalBunker)} prevTotalizerSteam={prevBoilerB.totalizer_steam as number | null} prevTotalizerBfw={prevBoilerB.totalizer_bfw as number | null} prevCoalBunkerValues={prevCoalBunker as Record<string, number | null>} shutdownSince={boilerShutdownSince.boiler_b} currentDate={selectedDate} />}
                                    {activeTab === 'Turbin' && <TabTurbin values={turbin} onFieldChange={makeNumberHandler(setTurbin as React.Dispatch<React.SetStateAction<Record<string, number | null>>>)} prevTotalizerSteamInlet={prevTurbin.totalizer_steam_inlet as number | null} prevTotalizerCondensate={prevTurbin.totalizer_condensate as number | null} />}
                                    {activeTab === 'Generator' && <TabGenerator generatorValues={generatorGi} powerValues={powerDist} onGeneratorChange={makeNumberHandler(setGeneratorGi)} onPowerChange={makeNumberHandler(setPowerDist)} prevPowerDist={prevPowerDist} genLoad={Number(generatorGi.gen_load) || null} isTurbinShutdown={turbin.status_turbin === 'shutdown'} />}
                                    {activeTab === 'Distribusi Steam' && <TabDistribusiSteam values={steamDist} onFieldChange={makeNumberHandler(setSteamDist)} prevTotalizerPabrik1={prevSteamDist.pabrik1_totalizer} prevTotalizerPabrik2={prevSteamDist.pabrik2_totalizer} prevTotalizerPabrik3={prevSteamDist.pabrik3a_totalizer} />}
                                    {activeTab === 'Handling' && <TabHandling espValues={espHandling} tankyardValues={tankyard} onEspChange={makeMixedHandler(setEspHandling)} onTankyardChange={makeNumberHandler(setTankyard)} solarEntries={solarEntries} onSolarEntriesChange={setSolarEntries} outSolarEntries={outSolarEntries} onOutSolarEntriesChange={setOutSolarEntries} savedSolarEntries={savedSolarEntries} savedOutSolarEntries={savedOutSolarEntries} onDeleteSavedSolar={handleDeleteSavedSolar} onDeleteSavedOutSolar={handleDeleteSavedOutSolar} />}
                                    {activeTab === 'ESP' && <TabESP values={espHandling} onFieldChange={makeMixedHandler(setEspHandling)} ashEntries={ashEntries} onAshEntriesChange={setAshEntries} savedAshEntries={savedAshEntries} onDeleteSavedAsh={handleDeleteSavedAsh} />}
                                    {activeTab === 'Coal Bunker' && <TabCoalBunker values={coalBunker} onFieldChange={makeMixedHandler(setCoalBunker)} onStatusChange={(name, value) => setCoalBunker(prev => ({ ...prev, [name]: value }))} berasapSince={bunkerBerasapSince} />}
                                    {activeTab === 'Lab' && <TabLab waterQualityValues={waterQuality} chemicalDosingValues={chemicalDosing} onWaterQualityChange={makeNumberHandler(setWaterQuality)} onChemicalDosingChange={makeNumberHandler(setChemicalDosing)} lastStockPhosphate={lastStock.phosphate} lastStockAmine={lastStock.amine} lastStockHydrazine={lastStock.hydrazine} />}
                                </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <InputHarianForm date={selectedDate} operator={operator} groupName={getGroupMalamOnDate(selectedDate)} supervisorName={supervisor} submitWindowStart={submitWindow.start} submitWindowEnd={submitWindow.end} isAdmin={isAdmin} />
            )}
            {/* Publish modal — same component as laporan-shift / laporan-harian pages */}
            {inputMode === 'shift' && (
                <PublishReportModal
                    kind="shift"
                    reportId={report?.id ?? ''}
                    open={publishOpen}
                    onClose={() => setPublishOpen(false)}
                    reportDate={selectedDate}
                    reportShift={SHIFT_LABELS[selectedShift]}
                    reportGroup={currentGroup ?? undefined}
                    initialSupervisor={supervisor}
                    initialForemanTurbin={foremanTurbin}
                    initialForemanBoiler={foremanBoiler}
                />
            )}
        </div>
    );
}
