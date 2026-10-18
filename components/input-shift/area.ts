import type { CSSProperties } from 'react';

/** Area kerja / jenis isi — satu area = satu warna solid (cat mesin RAL). Tab memakai
 *  warna areanya; tiap kartu memakai warna menurut isinya (uap, air, batubara, …), jadi
 *  satu tab berisi beberapa warna. Nilai warnanya ada di globals.css (blok .graphite-canvas). */
export type Area = 'boiler' | 'steam' | 'power' | 'coal' | 'ash' | 'water' | 'chem' | 'mech' | 'note';

/** Pasang --area (warna solid, utk blok berteks putih) + --area-ink (versi terang, utk teks
 *  label di latar gelap) pada container; Card/label/CalculatedField di dalamnya membacanya. */
export const areaStyle = (a: Area) =>
    ({ '--area': `var(--area-${a})`, '--area-ink': `var(--area-${a}-ink)` }) as CSSProperties;

export type ShiftTone = 'malam' | 'pagi' | 'sore' | 'harian';

/** Pasang --shift (warna solid Malam/Pagi/Sore/Harian) + --shift-fg (warna teks di atasnya;
 *  Pagi kuning butuh teks gelap) pada elemen pilihan/chip shift. */
export const shiftStyle = (s: ShiftTone) =>
    ({ '--shift': `var(--shift-${s})`, '--shift-fg': `var(--on-shift-${s})` }) as CSSProperties;
