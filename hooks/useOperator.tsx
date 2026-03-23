'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Operator, OperatorRole, SHIFT_INPUT_ROLES, OPERATORS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import type { OperatorRow } from '@/lib/supabase/types';

const STORAGE_KEY = 'powerops_operator';

interface OperatorContextType {
    operator: Operator | null;
    operators: Operator[];
    loading: boolean;
    login: (op: Operator) => void;
    logout: () => void;
    isGroupOperator: boolean;
    isForeman: boolean;
    isHandling: boolean;
    isSupervisor: boolean;
    isAdmin: boolean;
    canInputShift: boolean;
    canInputTank: boolean;
    canApprove: boolean;
    canManageUsers: boolean;
}

const GROUP_ROLES: OperatorRole[] = ['group_a', 'group_b', 'group_c', 'group_d'];
const FOREMAN_ROLES: OperatorRole[] = ['foreman_boiler', 'foreman_turbin'];

const OperatorContext = createContext<OperatorContextType>({
    operator: null,
    operators: [],
    loading: true,
    login: () => { },
    logout: () => { },
    isGroupOperator: false,
    isForeman: false,
    isHandling: false,
    isSupervisor: false,
    isAdmin: false,
    canInputShift: false,
    canInputTank: false,
    canApprove: false,
    canManageUsers: false,
});

function getStoredOperator(): Operator | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return null;
}

export function OperatorProvider({ children }: { children: ReactNode }) {
    const [operator, setOperator] = useState<Operator | null>(null);
    const [operators, setOperators] = useState<Operator[]>(OPERATORS);
    const [loading, setLoading] = useState(true);

    // On mount: restore from localStorage
    useEffect(() => {
        const stored = getStoredOperator();
        if (stored) setOperator(stored);
        setLoading(false);
    }, []);

    // Fetch operators from Supabase (fallback to constants)
    useEffect(() => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl || supabaseUrl.includes('YOUR_PROJECT_ID')) return;

        const supabase = createClient();
        supabase
            .from('operators')
            .select('*')
            .order('name')
            .then(({ data, error }) => {
                if (!error && data && data.length > 0) {
                    const rows = data as unknown as OperatorRow[];
                    setOperators(rows.map((op, idx) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const raw = op as any;
                        // Try DB columns first, fallback to constants match
                        const constant = OPERATORS.find(c => c.name === op.name && c.group === (op.group_name || undefined));
                        return {
                            id: idx + 1,
                            supabaseId: op.id,
                            name: op.name,
                            role: op.role as OperatorRole,
                            group: op.group_name || undefined,
                            nik: raw.nik || constant?.nik,
                            jabatan: raw.jabatan || constant?.jabatan,
                            company: raw.company || constant?.company,
                        };
                    }));
                }
            });
    }, []);

    const login = useCallback((op: Operator) => {
        setOperator(op);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(op));
        } catch { /* ignore */ }
    }, []);

    const logout = useCallback(() => {
        setOperator(null);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch { /* ignore */ }
    }, []);

    const role = operator?.role;
    const isGroupOperator = role ? GROUP_ROLES.includes(role) : false;
    const isForeman = role ? FOREMAN_ROLES.includes(role) : false;
    const isHandling = role === 'handling';
    const isSupervisor = role === 'supervisor';
    const isAdmin = role === 'admin';

    return (
        <OperatorContext.Provider
            value={{
                operator,
                operators,
                loading,
                login,
                logout,
                isGroupOperator,
                isForeman,
                isHandling,
                isSupervisor,
                isAdmin,
                canInputShift: role ? SHIFT_INPUT_ROLES.includes(role) || isSupervisor : false,
                canInputTank: isHandling,
                canApprove: isSupervisor || isAdmin,
                canManageUsers: isAdmin,
            }}
        >
            {children}
        </OperatorContext.Provider>
    );
}

export function useOperator() {
    const context = useContext(OperatorContext);
    if (!context) {
        throw new Error('useOperator must be used within OperatorProvider');
    }
    return context;
}
