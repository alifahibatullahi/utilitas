// ─── Output Destination type ───
export interface OutputDestination {
    name: string;
    hasFlow: boolean;       // true = has flow rate data
    pumps?: string[];       // optional pump choices (e.g. Demin Revamp)
}

// Tank definitions and configuration
export const TANKS: Record<string, {
    id: string;
    name: string;
    capacity: string;
    capacityM3: number;
    liquidColor: string;
    liquidColorLight: string;
    gradientFrom: string;
    gradientTo: string;
    inputSources: string[];
    outputDestinations: OutputDestination[];
}> = {
    DEMIN: {
        id: 'demin',
        name: 'DEMIN',
        capacity: '1.250 m³',
        capacityM3: 1250,
        liquidColor: '#38bdf8',       // sky-400
        liquidColorLight: '#7dd3fc',  // sky-300
        gradientFrom: '#0284c7',      // sky-600
        gradientTo: '#38bdf8',        // sky-400
        inputSources: ['Utilitas 1', 'Demin 3A'],
        outputDestinations: [
            { name: 'Deaerator', hasFlow: true },
            { name: 'Demin Revamp', hasFlow: false, pumps: ['P-1000A', 'P-1000B', 'Demin B'] },
        ],
    },
    RCW: {
        id: 'rcw',
        name: 'RCW',
        capacity: '4.600 m³',
        capacityM3: 4600,
        liquidColor: '#2dd4bf',       // teal-400
        liquidColorLight: '#5eead4',  // teal-300
        gradientFrom: '#0d9488',      // teal-600
        gradientTo: '#2dd4bf',        // teal-400
        inputSources: ['Utilitas 1'],
        outputDestinations: [
            { name: 'Cooling Tower', hasFlow: true },
            { name: 'Hydrant', hasFlow: true },
            { name: 'Service', hasFlow: true },
        ],
    },
    SOLAR: {
        id: 'solar',
        name: 'SOLAR',
        capacity: '2x200 m³',
        capacityM3: 400,
        liquidColor: '#fbbf24',       // amber-400
        liquidColorLight: '#fcd34d',  // amber-300
        gradientFrom: '#d97706',      // amber-600
        gradientTo: '#fbbf24',        // amber-400
        inputSources: [],
        outputDestinations: [],
    },
};

export type TankId = 'DEMIN' | 'RCW' | 'SOLAR';
export const TANK_IDS: TankId[] = ['DEMIN', 'RCW', 'SOLAR'];

// Alert thresholds (default, can be overridden per tank)
export const DEFAULT_THRESHOLDS = {
    critical_low: 20,
    warning_low: 40,
    warning_high: 80,
    critical_high: 90,
};

// Per-tank thresholds (in %)
// DEMIN: normal 900–1120 m³ dari 1200 = 75%–93.3%
// RCW  : normal 3800–4600 m³ dari 4600 = 82.6%–100%
export const TANK_THRESHOLDS: Record<string, typeof DEFAULT_THRESHOLDS> = {
    DEMIN:  { critical_low: 0, warning_low: 75,   warning_high: 93.3, critical_high: 101 },
    RCW:    { critical_low: 0, warning_low: 82.6,  warning_high: 100,  critical_high: 101 },
    SOLAR:  DEFAULT_THRESHOLDS,
};

// Alert status colors
export const ALERT_COLORS = {
    normal: {
        glow: '0 0 20px rgba(34, 197, 94, 0.3)',
        border: '#22c55e',
        label: 'Normal',
    },
    warning: {
        glow: '0 0 25px rgba(234, 179, 8, 0.5)',
        border: '#eab308',
        label: 'Warning',
    },
    critical: {
        glow: '0 0 30px rgba(239, 68, 68, 0.6)',
        border: '#ef4444',
        label: 'Critical',
    },
};

// Totaliser sources per tank
export const TOTALISER_SOURCES = {
    DEMIN: [
        { id: 'demin_utilitas1', label: 'Utilitas 1', unit: 'm³' },
        { id: 'demin_3a', label: 'Demin 3A', unit: 'm³' },
    ],
    RCW: [
        { id: 'rcw_utilitas1', label: 'Utilitas 1', unit: 'm³' },
    ],
    SOLAR: [
        { id: 'solar_unloading', label: 'Unloading Truk', unit: 'liter' },
    ],
} as const;

// ─── Operator Roles ───
// 4 Groups (A-D), each with: 1 Supervisor, 1 Foreman Boiler, 1 Foreman Turbin, + Operators
export type OperatorRole = 'group_a' | 'group_b' | 'group_c' | 'group_d' | 'supervisor' | 'foreman_boiler' | 'foreman_turbin' | 'handling' | 'admin';

export interface Operator {
    id: number;
    supabaseId?: string;    // UUID dari DB operators.id
    name: string;
    role: OperatorRole;
    group?: string;         // Group A/B/C/D
    nik?: string;           // NIK/NIP karyawan atau ID kontraktor
    jabatan?: string;       // Hanya Supervisor, Foreman Turbin, Foreman Boiler, AVP, Junior AVP
    company?: string;       // "UBB" | "PT FJM" | "PT Shohib Jaya Putra"
}

export const ROLE_LABELS: Record<OperatorRole, string> = {
    group_a: 'Operator Group A',
    group_b: 'Operator Group B',
    group_c: 'Operator Group C',
    group_d: 'Operator Group D',
    supervisor: 'Supervisor',
    foreman_boiler: 'Foreman Boiler',
    foreman_turbin: 'Foreman Turbin',
    handling: 'Operator Handling',
    admin: 'Admin',
};

export const ROLE_ICONS: Record<OperatorRole, string> = {
    group_a: '🔧',
    group_b: '🔧',
    group_c: '🔧',
    group_d: '🔧',
    supervisor: '👔',
    foreman_boiler: '🔩',
    foreman_turbin: '⚙️',
    handling: '🔩',
    admin: '🔑',
};

export const ROLE_COLORS: Record<OperatorRole, string> = {
    group_a: 'text-cyan-400',
    group_b: 'text-blue-400',
    group_c: 'text-violet-400',
    group_d: 'text-emerald-400',
    supervisor: 'text-amber-400',
    foreman_boiler: 'text-orange-400',
    foreman_turbin: 'text-teal-400',
    handling: 'text-teal-400',
    admin: 'text-rose-400',
};

export const ROLE_DOT_COLORS: Record<OperatorRole, string> = {
    group_a: 'bg-cyan-400',
    group_b: 'bg-blue-400',
    group_c: 'bg-violet-400',
    group_d: 'bg-emerald-400',
    supervisor: 'bg-amber-400',
    foreman_boiler: 'bg-orange-400',
    foreman_turbin: 'bg-teal-400',
    handling: 'bg-teal-400',
    admin: 'bg-rose-400',
};

// Personnel list — 4 Groups (A-D) × 12 orang + Normal Day
// 7 Organik (UBB) + 5 Tenaga Alih Daya (3 PT FJM + 2 PT Shohib Jaya Putra) per grup
export const OPERATORS: Operator[] = [
    // ─── Group A ─── (7 Organik UBB)
    { id: 1, name: 'Ardhian Wisnu Perdana', role: 'group_a', group: 'A', nik: '2074878', jabatan: 'Supervisor', company: 'UBB' },
    { id: 2, name: 'Jaka Riyantaka', role: 'group_a', group: 'A', nik: '2146101', jabatan: 'Foreman Turbin', company: 'UBB' },
    { id: 3, name: 'Aldilla Indra R', role: 'group_a', group: 'A', nik: '2180323', company: 'UBB' },
    { id: 4, name: 'Ilham Mirza Nur R', role: 'group_a', group: 'A', nik: '2146074', jabatan: 'Foreman Boiler', company: 'UBB' },
    { id: 5, name: 'Bagus Indra Prasetya', role: 'group_a', group: 'A', nik: '2190502', company: 'UBB' },
    { id: 6, name: 'Rizky Dharmaji', role: 'group_a', group: 'A', nik: '2156352', company: 'UBB' },
    { id: 7, name: 'Lutfi Abdul Aziz', role: 'group_a', group: 'A', nik: '2180237', company: 'UBB' },
    // Group A — Tenaga Alih Daya (3 PT FJM + 2 PT Shohib Jaya Putra)
    { id: 8, name: 'Andreansyah', role: 'handling', group: 'A', nik: '25-09677', company: 'PT FJM' },
    { id: 9, name: 'Bambang Agus', role: 'group_a', group: 'A', nik: '25-10301', company: 'PT FJM' },
    { id: 10, name: 'M. Syaiful Amri', role: 'group_a', group: 'A', nik: '25-09676', company: 'PT FJM' },
    { id: 11, name: 'Aditya Dwi', role: 'group_a', group: 'A', nik: '24-05632', company: 'PT Shohib Jaya Putra' },
    { id: 12, name: 'Miftahul Ihsan', role: 'group_a', group: 'A', nik: '24-05636', company: 'PT Shohib Jaya Putra' },

    // ─── Group B ─── (7 Organik UBB)
    { id: 13, name: 'Putra Aris Hidayat', role: 'group_b', group: 'B', nik: '2125518', jabatan: 'Supervisor', company: 'UBB' },
    { id: 14, name: 'Bili Pratama Kurnia', role: 'group_b', group: 'B', nik: '2146080', jabatan: 'Foreman Turbin', company: 'UBB' },
    { id: 15, name: 'Yusuf Efendi Saputra', role: 'group_b', group: 'B', nik: '2156361', company: 'UBB' },
    { id: 16, name: 'Ferdian Maulana Fah', role: 'group_b', group: 'B', nik: '2125676', jabatan: 'Foreman Boiler', company: 'UBB' },
    { id: 17, name: 'Rachmat Nordiyansyah', role: 'group_b', group: 'B', nik: '2146117', company: 'UBB' },
    { id: 18, name: 'Nastainul Firdaus Z', role: 'group_b', group: 'B', nik: '2146089', company: 'UBB' },
    { id: 19, name: 'Mohamad Rizky Arsyi', role: 'group_b', group: 'B', nik: '2180310', company: 'UBB' },
    // Group B — Tenaga Alih Daya
    { id: 20, name: 'Muhammad Syahri', role: 'handling', group: 'B', nik: '25-09683', company: 'PT FJM' },
    { id: 21, name: 'Mulyono', role: 'group_b', group: 'B', nik: '25-10302', company: 'PT FJM' },
    { id: 22, name: 'Sun\'an Kusaini', role: 'group_b', group: 'B', nik: '25-08504', company: 'PT FJM' },
    { id: 23, name: 'Hadi Santoso', role: 'group_b', group: 'B', nik: '24-05614', company: 'PT Shohib Jaya Putra' },
    { id: 24, name: 'Radyth Ferdynanto', role: 'group_b', group: 'B', nik: '24-25639', company: 'PT Shohib Jaya Putra' },

    // ─── Group C ─── (7 Organik UBB)
    { id: 25, name: 'Zulkarnain Bayu', role: 'group_c', group: 'C', nik: '2125519', jabatan: 'Supervisor', company: 'UBB' },
    { id: 26, name: 'Ryo Risky Faizal', role: 'group_c', group: 'C', nik: '2125716', jabatan: 'Foreman Turbin', company: 'UBB' },
    { id: 27, name: 'Rofindra Alif Iskandar', role: 'group_c', group: 'C', nik: '2180327', company: 'UBB' },
    { id: 28, name: 'Akhmad Agung Prabowo', role: 'group_c', group: 'C', nik: '2156285', jabatan: 'Foreman Boiler', company: 'UBB' },
    { id: 29, name: 'Dimas Cahyo Nugroho', role: 'group_c', group: 'C', nik: '2180302', company: 'UBB' },
    { id: 30, name: 'Muhammad Indra Ali', role: 'group_c', group: 'C', nik: '2156337', company: 'UBB' },
    { id: 31, name: 'Rizqy Aulia Rahman', role: 'group_c', group: 'C', nik: '2156353', company: 'UBB' },
    // Group C — Tenaga Alih Daya
    { id: 32, name: 'Achmad Mirza Yusuf', role: 'handling', group: 'C', nik: '25-10304', company: 'PT FJM' },
    { id: 33, name: 'Moh. Muchlis', role: 'group_c', group: 'C', nik: '25-09675', company: 'PT FJM' },
    { id: 34, name: 'Yusuf Adnan', role: 'group_c', group: 'C', nik: '25-08539', company: 'PT FJM' },
    { id: 35, name: 'Alif Amirul', role: 'group_c', group: 'C', nik: '24-25633', company: 'PT Shohib Jaya Putra' },
    { id: 36, name: 'Naufal Nasrulloh', role: 'group_c', group: 'C', nik: '24-05636', company: 'PT Shohib Jaya Putra' },

    // ─── Group D ─── (7 Organik UBB)
    { id: 37, name: 'Ade Rahmad Abrianto', role: 'group_d', group: 'D', nik: '2125719', jabatan: 'Supervisor', company: 'UBB' },
    { id: 38, name: 'Yudistira Alnur', role: 'group_d', group: 'D', nik: '2125525', jabatan: 'Foreman Turbin', company: 'UBB' },
    { id: 39, name: 'Moh. Taufiqurrohman', role: 'group_d', group: 'D', nik: '2146088', company: 'UBB' },
    { id: 40, name: 'Julio Purnanugraha', role: 'group_d', group: 'D', nik: '2146090', jabatan: 'Foreman Boiler', company: 'UBB' },
    { id: 41, name: 'Alifahi Batullahi', role: 'group_d', group: 'D', nik: '2180331', company: 'UBB' },
    { id: 42, name: 'Ahmad Shofi Hamim', role: 'group_d', group: 'D', nik: '2156283', company: 'UBB' },
    { id: 43, name: 'Achmad Ali Chorudin', role: 'group_d', group: 'D', nik: '2125718', company: 'UBB' },
    // Group D — Tenaga Alih Daya
    { id: 44, name: 'Mohammad Agil', role: 'handling', group: 'D', nik: '25-09679', company: 'PT FJM' },
    { id: 45, name: 'Mohammad Zubairi', role: 'group_d', group: 'D', nik: '25-08496', company: 'PT FJM' },
    { id: 46, name: 'Andik Purwanto', role: 'group_d', group: 'D', nik: '25-10300', company: 'PT FJM' },
    { id: 47, name: 'M. Diso', role: 'group_d', group: 'D', nik: '24-05637', company: 'PT Shohib Jaya Putra' },
    { id: 48, name: 'Firman Fathollah', role: 'group_d', group: 'D', nik: '24-05634', company: 'PT Shohib Jaya Putra' },

    // ─── Normal Day (Management) ───
    { id: 49, name: 'Dimas Randyta Iswara', role: 'admin', nik: '2145605', jabatan: 'AVP', company: 'UBB' },
    { id: 50, name: 'Mashasan Imanuddin', role: 'admin', nik: '2085010', jabatan: 'Junior AVP', company: 'UBB' },
    { id: 51, name: 'Admin Sistem', role: 'admin' },
];

// ─── Shift Group Rotation ───
// Pola 28 hari: M=Malam, P=Pagi, S=Sore, O=Off
// Group A pos 0 = 9 Maret 2026; tiap grup offset 7 hari
// OO = Sabtu-Minggu (pos 0-1), pola berulang 28 hari
const SHIFT_PATTERN = 'OOMMOPPSSSOMMOPPPSSOMMMOPPSS';
const GROUP_ANCHORS: Record<string, string> = {
    A: '2026-03-07',
    B: '2026-03-14',
    C: '2026-03-28',
    D: '2026-03-21',
};

/**
 * Returns the shift type for a group on a given date.
 * Returns 'M' | 'P' | 'S' | 'O'
 */
export function getGroupShiftOnDate(group: 'A' | 'B' | 'C' | 'D', dateStr: string): 'M' | 'P' | 'S' | 'O' {
    const anchor = new Date(GROUP_ANCHORS[group] + 'T00:00:00');
    const target = new Date(dateStr + 'T00:00:00');
    const daysDiff = Math.round((target.getTime() - anchor.getTime()) / 86400000);
    const pos = ((daysDiff % 28) + 28) % 28;
    return SHIFT_PATTERN[pos] as 'M' | 'P' | 'S' | 'O';
}

/**
 * Returns which group is assigned to a shift type on a given date.
 * shiftType: 'malam' | 'pagi' | 'sore'
 */
export function getGroupForShift(dateStr: string, shiftType: 'malam' | 'pagi' | 'sore'): string {
    const shiftLetter: Record<string, string> = { malam: 'M', pagi: 'P', sore: 'S' };
    const letter = shiftLetter[shiftType];
    // Shift malam tanggal X dikerjakan oleh grup shift malam tanggal X-1
    let lookupDate = dateStr;
    if (shiftType === 'malam') {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        // Gunakan tanggal lokal, bukan UTC (toISOString() di UTC+7 akan mundur 1 hari lagi)
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        lookupDate = `${y}-${mo}-${dy}`;
    }
    for (const group of ['A', 'B', 'C', 'D'] as const) {
        if (getGroupShiftOnDate(group, lookupDate) === letter) return group;
    }
    return '';
}

// ─── Shift Configuration ───
// Shifts: 07:00-15:00, 15:00-23:00, 23:00-07:00
export const SHIFTS = {
    1: { id: '1', label: 'Shift 1 (Pagi)', start: 7, end: 15 },
    2: { id: '2', label: 'Shift 2 (Siang)', start: 15, end: 23 },
    3: { id: '3', label: 'Shift 3 (Malam)', start: 23, end: 7 },
} as const;

export type ShiftId = keyof typeof SHIFTS;

export function getCurrentShift(): ShiftId {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 15) return 1;
    if (hour >= 15 && hour < 23) return 2;
    return 3;
}

// ─── Navigation Items ───
export interface NavItem {
    id: string;
    label: string;
    icon: string;
    path: string;
    roles: OperatorRole[] | 'all';
}

// Which roles can input shift data
export const SHIFT_INPUT_ROLES: OperatorRole[] = ['group_a', 'group_b', 'group_c', 'group_d', 'foreman_boiler', 'foreman_turbin'];

export const NAV_ITEMS: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '/dashboard', roles: 'all' },
    { id: 'tank-level', label: 'Tank Level', icon: 'tank', path: '/tank-level', roles: 'all' },
    { id: 'input-shift', label: 'Input Laporan', icon: 'edit', path: '/input-shift', roles: [...SHIFT_INPUT_ROLES, 'supervisor'] },
    { id: 'critical', label: 'Critical & Maint', icon: 'warning', path: '/critical', roles: 'all' },
    { id: 'laporan-shift', label: 'Laporan Shift', icon: 'report', path: '/laporan-shift', roles: 'all' },
    { id: 'laporan-harian', label: 'Laporan Harian', icon: 'daily', path: '/laporan-harian', roles: 'all' },
    { id: 'history', label: 'History Data', icon: 'trend', path: '/history', roles: 'all' },
    { id: 'admin-users', label: 'Kelola User', icon: 'users', path: '/admin/users', roles: ['admin'] },
];

// ─── Critical & Maintenance Constants ───

export const HAR_SCOPES = [
    { value: 'mekanik', label: 'Mekanik' },
    { value: 'listrik', label: 'Listrik' },
    { value: 'instrumen', label: 'Instrumen' },
    { value: 'sipil', label: 'Sipil' },
] as const;

export const FOREMAN_OPTIONS = [
    { value: 'foreman_turbin', label: 'Foreman Turbin' },
    { value: 'foreman_boiler', label: 'Foreman Boiler' },
] as const;

export const CRITICAL_STATUSES = [
    { value: 'OPEN', label: 'Open', color: 'rose', icon: 'error' },
    { value: 'CLOSED', label: 'Closed', color: 'slate', icon: 'lock' },
] as const;

export const MAINTENANCE_STATUSES = [
    { value: 'OPEN', label: 'Open', color: 'blue', icon: 'info' },
    { value: 'IP', label: 'In Progress', color: 'amber', icon: 'pending' },
    { value: 'OK', label: 'Selesai', color: 'emerald', icon: 'check_circle' },
] as const;

export const PREDEFINED_ITEMS = [
    'Boiler A', 'Boiler B',
    'STG (Turbin)', 'Generator',
    'ESP A', 'ESP B',
    'Silo A', 'Silo B',
    'Conveyor', 'Crusher',
    'Pompa BFW A', 'Pompa BFW B',
    'Pompa Kondensat', 'Pompa CEP',
    'Deaerator', 'Condenser',
    'Cooling Tower',
    'Fan ID A', 'Fan ID B',
    'Fan FD A', 'Fan FD B',
    'Fan SA A', 'Fan SA B',
    'Coal Feeder A', 'Coal Feeder B', 'Coal Feeder C',
    'Coal Feeder D', 'Coal Feeder E', 'Coal Feeder F',
] as const;

// ─── Shift time window helper ───
export type ShiftKey = 'pagi' | 'sore' | 'malam';

// Shift times (WIB local):
//   Pagi  : 07:00 – 15:00
//   Sore  : 15:00 – 23:00
//   Malam : 23:00 – 07:00 (next day)
export const SHIFT_OPTIONS: { value: ShiftKey; label: string; start: string; end: string }[] = [
    { value: 'pagi',  label: 'Pagi (07:00–15:00)',  start: '07:00', end: '15:00' },
    { value: 'sore',  label: 'Sore (15:00–23:00)',  start: '15:00', end: '23:00' },
    { value: 'malam', label: 'Malam (23:00–07:00)', start: '23:00', end: '07:00' },
];

export function getShiftWindow(date: string, shift: ShiftKey): { start: Date; end: Date } {
    const [y, m, d] = date.split('-').map(Number);
    if (shift === 'pagi') {
        return { start: new Date(y, m - 1, d, 7, 0, 0), end: new Date(y, m - 1, d, 15, 0, 0) };
    }
    if (shift === 'sore') {
        return { start: new Date(y, m - 1, d, 15, 0, 0), end: new Date(y, m - 1, d, 23, 0, 0) };
    }
    // malam: 23:00 same day – 07:00 next day
    return { start: new Date(y, m - 1, d, 23, 0, 0), end: new Date(y, m - 1, d + 1, 7, 0, 0) };
}

export function detectCurrentShift(): { shift: ShiftKey; date: string } {
    const now = new Date();
    const h = now.getHours();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    if (h >= 7 && h < 15) return { shift: 'pagi', date: fmt(now) };
    if (h >= 15 && h < 23) return { shift: 'sore', date: fmt(now) };
    // malam: 23:00+ same day, or 00:00–06:59 = previous day's malam
    if (h < 7) {
        const prev = new Date(now); prev.setDate(prev.getDate() - 1);
        return { shift: 'malam', date: fmt(prev) };
    }
    return { shift: 'malam', date: fmt(now) };
}

export const KANBAN_COLUMNS = [
    { id: 'OPEN', label: 'Open', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', headerBg: 'bg-blue-500', textColor: 'text-blue-700', badgeBg: 'bg-blue-100' },
    { id: 'IP', label: 'In Progress', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', headerBg: 'bg-amber-500', textColor: 'text-amber-700', badgeBg: 'bg-amber-100' },
    { id: 'OK', label: 'Selesai', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300', headerBg: 'bg-emerald-500', textColor: 'text-emerald-700', badgeBg: 'bg-emerald-100' },
] as const;
