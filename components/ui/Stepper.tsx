'use client';

/** Satu langkah di stepper. `icon` = nama material-symbols. */
export interface StepperItem {
    id: string;
    label: string;
    icon: string;
    /** Keterangan singkat isi langkah — tampil di ringkasan atas & di bawah label (sm+). */
    description?: string;
}

interface StepperProps {
    steps: StepperItem[];
    /** Index langkah yang sedang dibuka. */
    current: number;
    /** Index langkah terjauh yang pernah dibuka — supaya langkah yang sudah dilihat
     *  lalu ditinggal tidak salah terbaca sebagai "belum dibuka". */
    furthest: number;
    onSelect: (index: number) => void;
    disabled?: boolean;
}

type StepState = 'done' | 'active' | 'visited' | 'upcoming';

function stateOf(i: number, current: number, furthest: number): StepState {
    if (i < current) return 'done';
    if (i === current) return 'active';
    return i <= furthest ? 'visited' : 'upcoming';
}

const CIRCLE: Record<StepState, string> = {
    done: 'bg-emerald-500 border-2 border-emerald-500 text-white',
    active: 'bg-gradient-to-br from-emerald-600 to-teal-500 border-2 border-emerald-400 text-white ring-4 ring-emerald-500/20 shadow-[0_4px_12px_rgba(16,185,129,0.25)] scale-110',
    visited: 'bg-slate-950 border-2 border-emerald-500/60 text-emerald-300',
    upcoming: 'bg-slate-800/80 border-2 border-slate-700/60 text-slate-500',
};

const LABEL: Record<StepState, string> = {
    done: 'text-emerald-300',
    active: 'text-white font-black',
    visited: 'text-slate-300',
    upcoming: 'text-slate-500',
};

/** Stepper navigasi horizontal — menyampaikan POSISI & PROGRES, bukan validasi.
 *  (Tidak ada status "belum diisi": di form In/Out Batubara nilai 0 itu sah.)
 *  Semua langkah tetap bisa diklik supaya navigasi bebas tidak berubah. */
export default function Stepper({ steps, current, furthest, onSelect, disabled = false }: StepperProps) {
    if (steps.length === 0) return null;
    const safe = Math.min(Math.max(current, 0), steps.length - 1);
    const active = steps[safe];

    return (
        <nav aria-label="Langkah publish" className="bg-slate-950/60 rounded-xl border border-slate-800/80 px-3 pt-3 pb-2.5 sm:px-4 sm:pt-3.5 sm:pb-3">
            {/* Ringkasan posisi — "Langkah 2 dari 3" + isi langkah aktif */}
            <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[18px] text-emerald-400 shrink-0 select-none">{active.icon}</span>
                <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 truncate">
                        Langkah {safe + 1} dari {steps.length} · {active.label}
                    </div>
                    {active.description && (
                        <div className="text-[10.5px] sm:text-[11px] text-slate-400 leading-tight truncate">{active.description}</div>
                    )}
                </div>
            </div>

            {/* Rail — lingkaran + garis penghubung, label di bawahnya */}
            <ol className="flex items-start">
                {steps.map((s, i) => {
                    const st = stateOf(i, safe, furthest);
                    // Garis kiri terisi bila langkah ini sudah tercapai; garis kanan bila sudah dilewati.
                    const leftFilled = i <= safe;
                    const rightFilled = i < safe;
                    return (
                        <li key={s.id} className="relative flex-1 min-w-0">
                            {/* Penghubung hanya di antara lingkaran, tidak melintasi label */}
                            {i > 0 && (
                                <span
                                    aria-hidden="true"
                                    className={`absolute top-[13px] sm:top-[15px] left-0 right-1/2 mr-[20px] sm:mr-[22px] h-0.5 rounded-full transition-colors duration-300 ${leftFilled ? 'bg-emerald-500' : 'bg-slate-800'}`}
                                />
                            )}
                            {i < steps.length - 1 && (
                                <span
                                    aria-hidden="true"
                                    className={`absolute top-[13px] sm:top-[15px] left-1/2 right-0 ml-[20px] sm:ml-[22px] h-0.5 rounded-full transition-colors duration-300 ${rightFilled ? 'bg-emerald-500' : 'bg-slate-800'}`}
                                />
                            )}

                            <button
                                type="button"
                                onClick={() => onSelect(i)}
                                disabled={disabled}
                                aria-current={st === 'active' ? 'step' : undefined}
                                aria-label={`Langkah ${i + 1}: ${s.label}`}
                                className="relative w-full flex flex-col items-center gap-1.5 px-0.5 py-0.5 rounded-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 group"
                            >
                                <span
                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-black shrink-0 transition-all duration-300 group-hover:brightness-110 ${CIRCLE[st]}`}
                                >
                                    {st === 'done'
                                        ? <span className="material-symbols-outlined text-[16px] sm:text-[18px] leading-none">check</span>
                                        : i + 1}
                                </span>
                                <span className={`text-[9px] sm:text-[11px] font-bold leading-tight text-center break-words transition-colors duration-300 ${LABEL[st]}`}>
                                    {s.label}
                                </span>
                                {s.description && (
                                    <span className="hidden sm:block text-[9px] text-slate-500 leading-tight text-center break-words">
                                        {s.description}
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
