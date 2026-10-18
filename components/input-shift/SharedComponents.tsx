'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRisetContext } from './TotalizerRiset';
import { kurangiTotalizer, pilihSaran } from '@/lib/totalizer-riset';
import { areaStyle, type Area } from './area';

export interface InputFieldProps {
    label?: string;
    placeholder?: string;
    unit?: string;
    /** Tidak dipakai lagi — fokus isian selalu warna aksen. */
    color?: string;
    size?: string;
    value?: number | string | null;
    onChange?: (name: string, value: number | string | null) => void;
    name?: string;
    negative?: boolean;
    readOnly?: boolean;
    textMode?: boolean;
    thousands?: boolean;
    /** Bilangan bulat polos — tanpa pemisah ribuan & tanpa desimal; memakai mode
     *  input teks numerik yang sama dengan `thousands`. */
    plainInteger?: boolean;
    /** Pinggir merah — isian wajib yang masih kosong (mis. saat reset totalizer). */
    highlight?: boolean;
    autoFocus?: boolean;
}

// Label isian memakai tinta warna kartu (--area-ink, lihat ./area.ts).
const FIELD_LABEL = "font-bold text-(--area-ink) uppercase tracking-wider block text-left text-xs";

export const InputField = ({ label, placeholder = "0.0", unit, size = "small", value, onChange, name, negative, readOnly, textMode, thousands, plainInteger, highlight, autoFocus }: InputFieldProps) => {
    const border = highlight ? 'border-red-500 ring-1 ring-red-500/60' : 'border-slate-700/80';
    // Local state for textMode to handle intermediate values like "-" or "1."
    const [rawText, setRawText] = useState('');
    const [thuText, setThuText] = useState('');
    const isFocused = useRef(false);
    const thuFocused = useRef(false);

    const fmtThu = (v: number | string | null | undefined): string => {
        if (v == null || v === '') return '';
        const num = Number(v);
        if (isNaN(num)) return '';
        // Mode polos: tampil apa adanya — tanpa titik ribuan & tanpa koma desimal,
        // jadi angka yang terlihat persis sama dengan yang diketik operator.
        if (plainInteger) return String(Math.round(num));
        return num.toLocaleString('id-ID', { maximumFractionDigits: 3 });
    };

    // Skala font menyesuaikan panjang nilai → angka totalizer yang panjang tetap
    // terlihat penuh di semua ukuran layar (tidak terpotong di kolom sempit).
    const sizeForLen = (s: string | null | undefined): string => {
        const len = (s ?? '').length;
        if (len > 14) return 'text-xs';
        if (len > 11) return 'text-sm';
        if (len > 8) return 'text-base';
        return 'text-lg';
    };

    // Sync rawText when value changes from parent (e.g. loading saved data)
    useEffect(() => {
        if (textMode && !isFocused.current) {
            setRawText(value != null && value !== '' ? String(value) : '');
        }
    }, [value, textMode]);

    useEffect(() => {
        if ((thousands || plainInteger) && !thuFocused.current) {
            setThuText(value != null && value !== '' ? fmtThu(value) : '');
        }
    }, [value, thousands, plainInteger]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('input:not([readonly]):not([disabled])'));
            const idx = inputs.indexOf(e.target as Element);
            if (idx >= 0 && idx < inputs.length - 1) {
                (inputs[idx + 1] as HTMLElement).focus();
            }
        }
    };

    const labelEl = label && (
        <label className={FIELD_LABEL}>
            {label}
        </label>
    );

    // ── Thousands separator mode (juga dipakai mode polos `plainInteger`) ──────
    if (thousands || plainInteger) {
        const isEmpty = !thuText;
        return (
            <div className="space-y-1.5 w-full">
                {labelEl}
                <div className="relative">
                    <input
                        className={`w-full ${readOnly ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed' : `bg-bg-dark/50 ${isEmpty ? 'text-slate-400' : 'text-white'}`} border ${border} rounded-lg py-2.5 pl-3 ${unit ? 'pr-12' : 'pr-3'} placeholder-slate-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${sizeForLen(thuText)} font-mono font-bold tracking-wide transition-all text-left`}
                        type="text"
                        inputMode="numeric"
                        placeholder={placeholder}
                        autoFocus={autoFocus}
                        readOnly={readOnly}
                        tabIndex={readOnly ? -1 : undefined}
                        value={thuText}
                        onFocus={() => {
                            thuFocused.current = true;
                            // Show raw number for easy editing
                            const num = value != null && value !== '' ? Number(value) : null;
                            setThuText(num != null && !isNaN(num) ? String(plainInteger ? Math.round(num) : num) : '');
                        }}
                        onBlur={() => {
                            thuFocused.current = false;
                            setThuText(fmtThu(value));
                        }}
                        onChange={e => {
                            if (readOnly) return;
                            const raw = e.target.value;
                            if (raw !== '' && !(plainInteger ? /^-?\d*$/ : /^-?\d*\.?\d*$/).test(raw)) return;
                            setThuText(raw);
                            if (raw === '' || raw === '-' || raw.endsWith('.')) {
                                if (raw === '') onChange?.(name || label || '', null);
                                return;
                            }
                            const num = plainInteger ? parseInt(raw, 10) : parseFloat(raw);
                            if (!isNaN(num)) onChange?.(name || label || '', num);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                    {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">{unit}</span>}
                </div>
            </div>
        );
    }

    const displayValue = negative && value != null && value !== '' ? Math.abs(Number(value)) : value;
    return (
        <div className="space-y-1.5 w-full">
            {labelEl}
            <div className="relative">
                {negative && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono pointer-events-none">−</span>}
                <input
                    className={`w-full ${readOnly ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed' : 'bg-bg-dark/50 text-white'} border ${border} rounded-lg py-2.5 ${negative ? 'pl-7' : 'pl-3'} ${unit ? 'pr-12' : 'pr-3'} placeholder-slate-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${sizeForLen(String(textMode ? rawText : (displayValue ?? '')))} font-mono font-bold tracking-wide transition-all text-left`}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    type={textMode ? "text" : "number"}
                    inputMode={textMode ? "text" : "decimal"}
                    readOnly={readOnly}
                    tabIndex={readOnly ? -1 : undefined}
                    value={textMode ? rawText : (displayValue ?? '')}
                    onFocus={() => { if (textMode) isFocused.current = true; }}
                    onBlur={() => {
                        if (!textMode) return;
                        isFocused.current = false;
                        if (rawText === '-' || rawText === '.' || rawText === '-.') {
                            setRawText('');
                            onChange?.(name || label || '', null);
                        }
                    }}
                    onChange={e => {
                        if (readOnly) return;
                        if (textMode) {
                            const raw = e.target.value;
                            if (raw !== '' && !/^-?\d*\.?\d*$/.test(raw)) return;
                            setRawText(raw);
                            if (raw === '' ) { onChange?.(name || label || '', null); return; }
                            if (raw === '-' || raw === '.' || raw === '-.' || raw.endsWith('.')) return;
                            const num = parseFloat(raw);
                            if (!isNaN(num)) onChange?.(name || label || '', num);
                            return;
                        }
                        const raw = e.target.value === '' ? null : parseFloat(e.target.value);
                        const val = negative && raw != null ? -Math.abs(raw) : raw;
                        onChange?.(name || label || '', val);
                    }}
                    onKeyDown={handleKeyDown}
                />
                {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">{unit}</span>}
            </div>
        </div>
    );
};

export const SelectField = ({ label, options, size = "normal", value, onChange, name, placeholder = "Pilih..." }: {
    label?: string;
    options: { value: string; label: string }[];
    color?: string;
    size?: string;
    value?: string | null;
    onChange?: (name: string, value: string | null) => void;
    name?: string;
    placeholder?: string;
}) => (
    <div className="space-y-1.5 w-full">
        {label && (
            <label className={`font-medium text-(--area-ink) uppercase tracking-wider block text-left ${size === 'small' ? 'text-[10px]' : 'text-xs'}`}>
                {label}
            </label>
        )}
        <select
            className={`w-full bg-bg-dark/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-lg font-mono font-bold tracking-wide transition-all appearance-none cursor-pointer`}
            value={value ?? ''}
            onChange={e => onChange?.(name || label || '', e.target.value === '' ? null : e.target.value)}
        >
            <option value="" className="bg-bg-dark text-slate-500">{placeholder}</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-bg-dark text-white">
                    {opt.label}
                </option>
            ))}
        </select>
    </div>
);

export const Card = ({ title, icon, area, children, isSidebar = false, className = '', headerRight }: {
    title: string;
    icon: string;
    /** Warna kartu menurut isinya (uap, air, batubara, …; lihat ./area.ts). Kosong = ikut
     *  warna tab tempatnya — dipakai kartu ringkasan. Label di dalamnya ikut warna ini. */
    area?: Area;
    children: React.ReactNode;
    isSidebar?: boolean;
    className?: string;
    headerRight?: React.ReactNode;
}) => {
    return (
        <div className={`bg-surface-dark border border-slate-700/60 rounded-xl overflow-hidden flex flex-col ${className}`} style={area ? areaStyle(area) : undefined}>
            <div className="p-4 bg-(--area) flex items-center gap-3 shrink-0">
                <div className="p-2 rounded-lg bg-white/15">
                    <span className="material-symbols-outlined text-white">{icon}</span>
                </div>
                <h3 className="text-white font-bold text-lg tracking-wide">{title}</h3>
                {headerRight}
            </div>
            <div className={`${isSidebar ? 'p-4 space-y-2' : 'p-5 space-y-4'} flex flex-col justify-start`}>
                {children}
            </div>
        </div>
    );
};

export const SectionLabel = ({ label, badge }: { label: string; badge?: string }) => (
    <div className="flex items-center gap-2 pt-3 pb-1 first:pt-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-(--area-ink)">{label}</span>
        {badge && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 font-medium">{badge}</span>}
        <div className="flex-1 border-t border-slate-700/40" />
    </div>
);

/**
 * Isian raw totalizer + prev/selisih di bawahnya. Dengan `meter` (kunci di
 * lib/totalizer-riset.ts) dan berada di dalam RisetProvider, sekaligus menangani RESET
 * totalizer (meter kembali ke 0; di kode & DB disebut "riset"):
 *  - reset BARU dicatat hanya lewat klik tombol "Reset Totalizer" → muncul isian
 *    ① totalizer terakhir sebelum reset DI ATAS isian ini (② totalizer saat ini), keduanya
 *    berpinggir merah selama kosong, + rumus (akhir − prev) + cur (tak ada prompt saat
 *    selisih negatif);
 *  - laporan PASANGAN (shift ↔ harian yang mencakup reset yang sudah dicatat) menampilkan
 *    panel reset otomatis dengan ① terisi — selama pembacaan di sini masih kosong atau di
 *    bawah prev. Lewat pasangan itu, laporan berikutnya normal lagi.
 * Tanpa `meter`/provider tampil sebagai isian + prev/selisih biasa.
 *
 * Urutan child panel dijaga tetap (bagian reset = `{reset && …}`) supaya isian ② tidak
 * remount saat reset diaktifkan/dibatalkan.
 */
export const TotalizerField = ({ prev, meter, plain, ...input }: InputFieldProps & {
    prev: number;
    meter?: string;
    /** Angka tanpa pemisah ribuan (isian `plainInteger`). */
    plain?: boolean;
}) => {
    const current = Number(input.value) || 0;
    const [baruDiklik, setBaruDiklik] = useState(false);
    const ctx = useRisetContext();
    const risetOn = !!(meter && ctx && Object.prototype.hasOwnProperty.call(ctx.riset, meter));
    const nilaiAkhir = risetOn ? ctx!.riset[meter!] : null;
    const saran = meter && ctx ? pilihSaran(ctx.saran[meter], prev) : null;
    const otomatis = !!(meter && ctx?.otomatis.has(meter));
    // Isi otomatis dari pasangan hanya kalau pembacaan di sini belum diisi (0) atau turun —
    // pembacaan ≥ prev berarti riset tidak terjadi di jendela laporan ini.
    const layakOtomatis = !!saran && prev > 0 && (!(current > 0) || current < prev);
    const ditolak = !!(meter && ctx?.ditolak.has(meter));

    useEffect(() => {
        if (!meter || !ctx) return;
        if (layakOtomatis && !risetOn && !ditolak) ctx.terapkanOtomatis(meter, saran!.nilai);
        else if (!layakOtomatis && otomatis) ctx.lepasOtomatis(meter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meter, layakOtomatis, risetOn, ditolak, otomatis, saran?.nilai]);

    // plain: tanpa pemisah ribuan, biar sama persis dengan angka di kolom isian.
    const fmt = (v: number) => v % 1 !== 0 ? v.toFixed(1) : plain ? String(v) : v.toLocaleString('id-ID');

    // Info prev/selisih & panel reset hanya kalau ada pembanding sebelumnya.
    const adaPrev = prev > 0;
    const reset = adaPrev && risetOn && !!meter && !!ctx;
    const L = nilaiAkhir != null && nilaiAkhir > 0 ? nilaiAkhir : null;
    const kosongAkhir = L == null;
    const kosongCur = input.value == null || input.value === '';
    const dariSaran = saran && L === saran.nilai ? saran.sumber : null;

    const mulaiReset = () => {
        setBaruDiklik(true);
        ctx!.setRiset(meter!, saran?.nilai ?? null);
    };
    const batalReset = () => {
        setBaruDiklik(false);
        ctx!.setRiset(meter!, undefined);
        ctx!.tolak(meter!);
    };

    let info: React.ReactNode = null;
    if (reset) {
        const sel = L != null && !kosongCur ? kurangiTotalizer(current, prev, L) : null;
        info = sel != null ? (
            <p className="text-[10px] text-slate-400">
                Selisih: ({fmt(L!)} − {fmt(prev)}) + {fmt(current)} ={' '}
                <span className={`font-bold ${sel >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(sel)}</span>
            </p>
        ) : (
            <p className="text-[10px] font-semibold text-red-300">
                {kosongAkhir && kosongCur
                    ? 'Isi ① totalizer terakhir sebelum reset, lalu ② totalizer saat ini.'
                    : kosongAkhir
                        ? 'Isi ① totalizer terakhir sebelum kembali ke 0.'
                        : 'Isi ② totalizer saat ini (dihitung dari 0 setelah reset).'}
            </p>
        );
    } else if (adaPrev) {
        // Selisih tampil apa adanya (boleh minus) — anomali justru harus kelihatan.
        // Penjagaannya ada saat simpan lewat checkSelisihNegatif().
        const diff = current - prev;
        info = (
            <div className="mt-1.5 text-[10px] text-slate-500 space-y-0.5">
                <p>Prev: <span className="text-slate-400 font-medium">{fmt(prev)}</span></p>
                <p>Selisih: <span className={`font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span></p>
                {meter && ctx && (
                    <button
                        type="button"
                        onClick={mulaiReset}
                        className="mt-1 rounded border border-amber-500/50 px-2 py-0.5 font-semibold text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                    >
                        Reset Totalizer
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-1.5 w-full">
            {input.label && <label className={FIELD_LABEL}>{input.label}</label>}
            <div className={reset ? 'rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 space-y-1.5' : ''}>
                {reset && (
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-amber-300">
                            <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                            Reset totalizer
                        </span>
                        <button
                            type="button"
                            onClick={batalReset}
                            className="font-semibold text-red-300 hover:text-red-200 underline cursor-pointer"
                        >
                            Batal reset
                        </button>
                    </div>
                )}
                {reset && (
                    <div className="space-y-1 text-[10px] text-slate-400">
                        <InputField
                            label="① Terakhir sebelum reset"
                            name={`riset_${meter}`}
                            value={nilaiAkhir}
                            onChange={(_, v) => ctx!.setRiset(meter!, typeof v === 'number' ? v : null)}
                            placeholder={`≥ ${fmt(prev)}`}
                            unit={input.unit}
                            color="amber"
                            thousands={!plain}
                            plainInteger={!!plain}
                            highlight={kosongAkhir}
                            autoFocus={baruDiklik}
                        />
                        <p>Prev: <span className="text-slate-300 font-medium">{fmt(prev)}</span></p>
                        {dariSaran && <p className="text-amber-200/80">Tercatat di {dariSaran}.</p>}
                        {/* Isian diubah operator jadi beda dari yang tercatat di laporan pasangan →
                            tawarkan nilai tercatat, jangan timpa diam-diam. */}
                        {saran && !dariSaran && (
                            <button
                                type="button"
                                onClick={() => ctx!.setRiset(meter!, saran.nilai)}
                                className="text-left font-semibold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                            >
                                Pakai {fmt(saran.nilai)} (tercatat di {saran.sumber})
                            </button>
                        )}
                    </div>
                )}
                {reset && <label className={`${FIELD_LABEL} pt-1`}>② Saat ini (setelah reset)</label>}
                <InputField
                    {...input}
                    label={undefined}
                    placeholder={reset ? 'Setelah reset' : input.placeholder}
                    highlight={reset && kosongCur}
                />
                {info}
            </div>
        </div>
    );
};

export const TotalizerInput = ({ label, name, value, prev, onChange, unit, color, meter }: {
    label: string; name: string; value: number | null; prev: number;
    onChange: (n: string, v: number | string | null) => void; unit: string; color: string;
    meter?: string;
}) => (
    <TotalizerField label={`Totalizer ${label}`} name={name} value={value} onChange={onChange} unit={unit} color={color} prev={prev} meter={meter} />
);

// ── Feeder status chip (Coal Feeder) ──────────────────────────────────────────
// Dipakai bersama oleh tab Boiler laporan shift & harian supaya tampil identik.
export const FEEDER_STATUS_OPTIONS = [
    { value: 'running', label: 'Running' },
    { value: 'standby', label: 'Standby' },
    { value: 'emergency standby', label: 'Emergency Standby' },
    { value: 'not standby', label: 'Not Standby' },
];

// Chip status diisi warna penuh (bukan garis). Standby kuning → teks gelap.
export const FEEDER_STATUS_STYLE: Record<string, { chip: string; dot: string }> = {
    'running':          { chip: 'bg-emerald-600 border-emerald-600 text-white',                     dot: 'bg-white/80' },
    'standby':          { chip: 'bg-(--status-standby) border-(--status-standby) text-[#1c1606]',     dot: 'bg-black/50' },
    'emergency standby':{ chip: 'bg-(--status-emergency) border-(--status-emergency) text-white',     dot: 'bg-white/80' },
    'not standby':      { chip: 'bg-(--status-stop) border-(--status-stop) text-white',               dot: 'bg-white/80' },
};

/** Chip status unit Running/Shutdown (header tab Boiler/Turbin) — warna penuh. */
export const runStatusClass = (status: string): string =>
    status === 'running' ? 'bg-emerald-600 border-emerald-600'
    : status === 'shutdown' ? 'bg-(--status-stop) border-(--status-stop)'
    : 'bg-bg-dark/60 border-slate-700/60';

export function FeederStatusChip({ sk, value, onChange }: {
    sk: string;
    value: string;
    onChange?: (name: string, v: number | string | null) => void;
}) {
    const style = FEEDER_STATUS_STYLE[value];
    const chip = style?.chip ?? 'bg-bg-dark/60 border-slate-700/60 text-white';
    const dot = style?.dot ?? 'bg-slate-500';
    return (
        <div className={`inline-flex items-center gap-1.5 border ${chip} rounded-lg pl-2 pr-1 py-1 transition-colors`}>
            <span className={`w-2.5 h-2.5 rounded-full ${dot} shrink-0`} />
            <select
                className="bg-transparent appearance-none text-sm text-inherit font-semibold pr-3 cursor-pointer outline-none"
                value={value}
                onChange={e => onChange?.(sk, e.target.value === '' ? null : e.target.value)}
            >
                <option value="" className="bg-bg-dark text-slate-500">Status...</option>
                {FEEDER_STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-bg-dark text-white">{opt.label}</option>
                ))}
            </select>
        </div>
    );
}

export const CalculatedField = ({ label, value = "0.00", unit, variant = "primary" }: {
    label: string;
    value?: string;
    unit: string;
    variant?: 'primary' | 'secondary' | 'small' | 'transparent';
    size?: 'large' | 'medium' | 'small';
}) => {
    const variantStyles = {
        // Hasil utama = blok solid warna area (--area, dipasang container tab).
        primary: {
            bg: 'bg-(--area) border-(--area) p-3',
            label: 'text-white/80 text-xs font-bold uppercase tracking-wider',
            value: 'text-white font-mono font-black text-2xl tracking-tighter',
            unit: 'text-white/70 text-xs font-bold',
        },
        secondary: {
            bg: 'bg-slate-800 border-slate-700 p-3',
            label: 'text-slate-300 text-xs font-medium uppercase tracking-wider',
            value: 'text-slate-100 font-mono font-bold text-xl',
            unit: 'text-slate-500 text-xs font-medium',
        },
        small: {
            bg: 'bg-surface-highlight/30 border-slate-700/30 p-2.5',
            label: 'text-(--area-ink) text-[10px] font-medium uppercase tracking-wider',
            value: 'text-white font-mono font-bold text-sm',
            unit: 'text-slate-500 text-[10px] font-medium',
        },
        transparent: {
            bg: 'bg-transparent border-slate-700/50 p-2.5',
            label: 'text-(--area-ink) text-xs font-bold uppercase tracking-wider',
            value: 'text-white font-mono font-black text-2xl',
            unit: 'text-slate-400 text-xs font-bold',
        }
    };

    const s = variantStyles[variant];

    return (
        <div className={`flex flex-col gap-1 rounded-lg border ${s.bg}`}>
            <span className={`text-left ${s.label}`}>{label}</span>
            <div className="flex items-baseline justify-between w-full">
                <span className={`${s.value}`}>{value}</span>
                <span className={`${s.unit}`}>{unit}</span>
            </div>
        </div>
    );
};

export const Modal = ({ open, onClose, title, children }: {
    open: boolean;
    onClose: () => void;
    title: string;
    /** Tidak dipakai lagi — modal netral. */
    color?: string;
    children: React.ReactNode;
}) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!open || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className={`relative bg-surface-dark border border-slate-700/80 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl max-h-[90dvh] flex flex-col`}>
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-800/60 shrink-0">
                    <h3 className="text-white font-bold text-base tracking-wide">{title}</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-700/50 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
                <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};
