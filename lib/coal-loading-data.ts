import { CoalLoading } from './coal-storage';

/**
 * Data dummy riwayat loading batubara — pengambilan tumpukan oleh payloader
 * untuk dituang ke hopper.
 *
 * Sama seperti lib/coal-storage-data.ts, isinya disunting langsung di berkas ini
 * selama halaman /coal-storage masih baca-saja. Bentuk barisnya sengaja
 * disamakan dengan calon sumbernya di laporan shift handling supaya nanti cukup
 * berkas ini yang diganti:
 *
 *   tanggal → shift_reports.date      (shift malam = tanggal SUBMIT, konvensi
 *                                      ENDING: kerja 23:00 D-1 → 07:00 D)
 *   shift   → shift_reports.shift
 *   grup    → shift_reports.group_name; dikosongkan di sini dan diturunkan lewat
 *             getGroupForShift() supaya rotasi regunya ikut jadwal yang sama
 *             dengan seluruh aplikasi
 *   shovel  → shift_esp_handling.loading   (card "Loading Batubara")
 *   hopper  → shift_esp_handling.hopper    (A = darat, B = laut, AB = keduanya)
 *   zona    → BELUM ada kolomnya; ini satu-satunya field yang perlu ditambahkan
 *             ke form handling sebelum riwayat ini bisa pakai data nyata.
 */
export const COAL_LOADINGS: CoalLoading[] = [
    { tanggal: '2026-08-27', shift: 'malam', zona: 'C1', shovel: 24, hopper: 'A' },
    { tanggal: '2026-08-27', shift: 'pagi', zona: 'C1', shovel: 30, hopper: 'B' },
    { tanggal: '2026-08-27', shift: 'sore', zona: 'C2', shovel: 18, hopper: 'A' },

    { tanggal: '2026-08-28', shift: 'malam', zona: 'C1', shovel: 22, hopper: 'A' },
    { tanggal: '2026-08-28', shift: 'pagi', zona: 'C4', shovel: 26, hopper: 'B' },
    { tanggal: '2026-08-28', shift: 'sore', zona: 'O1', shovel: 20, hopper: 'A' },

    { tanggal: '2026-08-29', shift: 'malam', zona: 'C2', shovel: 16, hopper: 'A' },
    { tanggal: '2026-08-29', shift: 'pagi', zona: 'C7', shovel: 28, hopper: 'B' },
    { tanggal: '2026-08-29', shift: 'sore', zona: 'O1', shovel: 18, hopper: 'A' },

    { tanggal: '2026-08-30', shift: 'malam', zona: 'C4', shovel: 20, hopper: 'A' },
    { tanggal: '2026-08-30', shift: 'pagi', zona: 'O5', shovel: 24, hopper: 'B' },
    { tanggal: '2026-08-30', shift: 'sore', zona: 'C7', shovel: 22, hopper: 'AB' },

    { tanggal: '2026-08-31', shift: 'malam', zona: 'C1', shovel: 18, hopper: 'A' },
    { tanggal: '2026-08-31', shift: 'pagi', zona: 'C9', shovel: 26, hopper: 'B' },
    { tanggal: '2026-08-31', shift: 'sore', zona: 'O5', shovel: 20, hopper: 'A' },

    { tanggal: '2026-09-01', shift: 'malam', zona: 'C7', shovel: 16, hopper: 'A' },
    { tanggal: '2026-09-01', shift: 'pagi', zona: 'C2', shovel: 22, hopper: 'B' },
    { tanggal: '2026-09-01', shift: 'sore', zona: 'O6', shovel: 24, hopper: 'A' },

    { tanggal: '2026-09-02', shift: 'malam', zona: 'O6', shovel: 18, hopper: 'A' },
    { tanggal: '2026-09-02', shift: 'pagi', zona: 'C9', shovel: 30, hopper: 'B' },
    { tanggal: '2026-09-02', shift: 'sore', zona: 'C8', shovel: 22, hopper: 'AB' },

    { tanggal: '2026-09-03', shift: 'malam', zona: 'C4', shovel: 20, hopper: 'A' },
    { tanggal: '2026-09-03', shift: 'pagi', zona: 'C1', shovel: 36, hopper: 'B' },
    { tanggal: '2026-09-03', shift: 'sore', zona: 'C5', shovel: 26, hopper: 'A' },
];
