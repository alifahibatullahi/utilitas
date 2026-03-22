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
        capacity: '1.200 m³',
        capacityM3: 1200,
        liquidColor: '#38bdf8',       // sky-400
        liquidColorLight: '#7dd3fc',  // sky-300
        gradientFrom: '#0284c7',      // sky-600
        gradientTo: '#38bdf8',        // sky-400
        inputSources: ['Utilitas 1', 'Demin 3A'],
        outputDestinations: [
            { name: 'Internal UBB', hasFlow: true },
            { name: 'Demin Revamp', hasFlow: true, pumps: ['P-1000A', 'P-1000B', 'Demin B'] },
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
            { name: 'Make UP Cooling Tower', hasFlow: false },
            { name: 'Hydrant', hasFlow: false },
            { name: 'Service', hasFlow: false },
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
    name: string;
    role: OperatorRole;
    group?: string;         // Group A/B/C/D
    shiftDefault?: string;  // current shift assignment
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

// Personnel list — 4 Groups (A-D)
export const OPERATORS: Operator[] = [
    // ─── Group A ───
    { id: 1, name: 'Budi Santoso', role: 'supervisor', group: 'A' },
    { id: 2, name: 'Ahmad Fauzi', role: 'foreman_boiler', group: 'A' },
    { id: 3, name: 'Doni Saputra', role: 'foreman_turbin', group: 'A' },
    { id: 4, name: 'Hendra Wijaya', role: 'group_a', group: 'A' },
    { id: 5, name: 'Irfan Hakim', role: 'group_a', group: 'A' },
    // ─── Group B ───
    { id: 6, name: 'Rizky Pratama', role: 'supervisor', group: 'B' },
    { id: 7, name: 'Siti Rahayu', role: 'foreman_boiler', group: 'B' },
    { id: 8, name: 'Fajar Nugroho', role: 'foreman_turbin', group: 'B' },
    { id: 9, name: 'Gilang Ramadhan', role: 'group_b', group: 'B' },
    { id: 10, name: 'Bagus Setiawan', role: 'group_b', group: 'B' },
    // ─── Group C ───
    { id: 11, name: 'Eko Prasetyo', role: 'supervisor', group: 'C' },
    { id: 12, name: 'Dimas Aditya', role: 'foreman_boiler', group: 'C' },
    { id: 13, name: 'Wahyu Hidayat', role: 'foreman_turbin', group: 'C' },
    { id: 14, name: 'Rudi Hartono', role: 'group_c', group: 'C' },
    { id: 15, name: 'Satria Putra', role: 'group_c', group: 'C' },
    // ─── Group D ───
    { id: 16, name: 'Agus Supriyanto', role: 'supervisor', group: 'D' },
    { id: 17, name: 'Dewi Kartika', role: 'foreman_boiler', group: 'D' },
    { id: 18, name: 'Lukman Hakim', role: 'foreman_turbin', group: 'D' },
    { id: 19, name: 'Yusuf Maulana', role: 'group_d', group: 'D' },
    { id: 20, name: 'Arief Rahman', role: 'group_d', group: 'D' },
    // ─── Handling ───
    { id: 21, name: 'Teguh Prasetya', role: 'handling' },
    { id: 22, name: 'Surya Dharma', role: 'handling' },
    // ─── Admin ───
    { id: 23, name: 'Admin Sistem', role: 'admin' },
];

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
    { id: 'laporan-shift', label: 'Laporan Shift', icon: 'report', path: '/laporan-shift', roles: 'all' },
    { id: 'laporan-harian', label: 'Laporan Harian', icon: 'daily', path: '/laporan-harian', roles: 'all' },
    { id: 'history', label: 'History & Trend', icon: 'trend', path: '/history', roles: 'all' },
    { id: 'admin-users', label: 'Kelola User', icon: 'users', path: '/admin/users', roles: ['admin'] },
];
