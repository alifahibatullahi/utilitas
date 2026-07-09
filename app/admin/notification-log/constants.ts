// Plain constants — must NOT live in actions.ts (which uses 'use server'
// and turns all exports into action references, breaking value imports).

export const KINDS = [
    { value: '',                       label: 'Semua' },
    { value: 'shift_reminder',         label: 'Reminder Shift' },
    { value: 'daily_reminder',         label: 'Reminder Harian' },
    { value: 'shift_share',            label: 'Share Laporan Shift' },
    { value: 'daily_share',            label: 'Share Laporan Harian' },
    { value: 'maintenance_broadcast',  label: 'Broadcast Maintenance' },
];
