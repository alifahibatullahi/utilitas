import type { CSSProperties } from 'react';

/** Area kerja — satu area = satu warna kalem, dipakai konsisten di tab, kepala kartu,
 *  ringkasan & kartu station. Nilai warnanya ada di globals.css (blok .graphite-canvas). */
export type Area = 'boiler' | 'steam' | 'power' | 'coal' | 'ash' | 'water' | 'note';

/** Pasang --area pada container; Card/CalculatedField di dalamnya membaca `--area`. */
export const areaStyle = (a: Area) => ({ '--area': `var(--area-${a})` }) as CSSProperties;

export type ShiftTone = 'malam' | 'pagi' | 'sore' | 'harian';

/** Pasang --shift (warna kalem Malam/Pagi/Sore/Harian) pada elemen pilihan/chip shift. */
export const shiftStyle = (s: ShiftTone) => ({ '--shift': `var(--shift-${s})` }) as CSSProperties;
