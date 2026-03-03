'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Operator, OperatorRole, SHIFT_INPUT_ROLES } from '@/lib/constants';

interface OperatorContextType {
    operator: Operator | null;
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

export function OperatorProvider({ children }: { children: ReactNode }) {
    const [operator, setOperator] = useState<Operator | null>(null);

    const login = useCallback((op: Operator) => {
        setOperator(op);
    }, []);

    const logout = useCallback(() => {
        setOperator(null);
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
