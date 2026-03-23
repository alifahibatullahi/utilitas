'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { OPERATORS, ROLE_LABELS, ROLE_DOT_COLORS } from '@/lib/constants';

export default function AdminUsersPage() {
    const { operator, canManageUsers } = useOperator();
    const router = useRouter();
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        if (!operator) router.push('/');
        else if (!canManageUsers) router.push('/dashboard');
    }, [operator, canManageUsers, router]);

    if (!operator || !canManageUsers) return null;

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-6">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-xl">
                        <span className="material-symbols-outlined text-primary text-2xl">group</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-white">User & Shift Management</h2>
                        <p className="text-text-secondary text-sm mt-1">Kelola operator, role, dan pengaturan shift</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAddModal(!showAddModal)}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-primary/20 cursor-pointer"
                >
                    <span className="material-symbols-outlined text-base">person_add</span>
                    Tambah Operator
                </button>
            </header>

            {/* Operator list */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800 bg-gradient-to-r from-surface-highlight/50 to-transparent">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">list</span>
                        Daftar Operator
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-800 bg-surface-highlight/20">
                                <th className="text-left text-xs text-text-secondary uppercase tracking-wider py-3 px-5">Nama</th>
                                <th className="text-left text-xs text-text-secondary uppercase tracking-wider py-3 px-3">Role</th>
                                <th className="text-left text-xs text-text-secondary uppercase tracking-wider py-3 px-3">Shift Default</th>
                                <th className="text-center text-xs text-text-secondary uppercase tracking-wider py-3 px-5">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {OPERATORS.map((op) => (
                                <tr key={op.id} className="hover:bg-surface-highlight/30 transition-colors">
                                    <td className="py-3 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-600">
                                                {op.name.charAt(0)}
                                            </div>
                                            <span className="text-white font-medium">{op.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${ROLE_DOT_COLORS[op.role]}`} />
                                            <span className="text-text-secondary text-xs">{ROLE_LABELS[op.role]}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3">
                                        <span className="text-text-secondary text-xs">{op.jabatan || '—'}</span>
                                    </td>
                                    <td className="py-3 px-5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button className="p-1.5 rounded-lg hover:bg-surface-highlight text-text-secondary hover:text-white transition-all cursor-pointer" title="Edit">
                                                <span className="material-symbols-outlined text-base">edit</span>
                                            </button>
                                            <button className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-all cursor-pointer" title="Hapus">
                                                <span className="material-symbols-outlined text-base">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Shift configuration */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">settings</span>
                    Pengaturan Shift
                </h3>
                <div className="space-y-3">
                    {[
                        { shift: 'A', label: 'Shift A (Pagi)', time: '06:00 — 14:00', icon: 'light_mode' },
                        { shift: 'B', label: 'Shift B (Siang)', time: '14:00 — 22:00', icon: 'wb_twilight' },
                        { shift: 'C', label: 'Shift C (Malam)', time: '22:00 — 06:00', icon: 'dark_mode' },
                    ].map(s => (
                        <div key={s.shift} className="flex items-center justify-between p-4 bg-surface-highlight/30 rounded-xl border border-slate-700/30">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-text-secondary">{s.icon}</span>
                                <div>
                                    <p className="text-sm text-white font-medium">{s.label}</p>
                                    <p className="text-xs text-text-secondary">{s.time}</p>
                                </div>
                            </div>
                            <button className="px-3 py-1.5 text-xs text-text-secondary bg-surface-dark rounded-lg border border-slate-800 hover:bg-surface-highlight cursor-pointer transition-all flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">edit</span>
                                Edit
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
