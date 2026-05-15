'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import LogPanel from '@/components/admin-wa/LogPanel';
import SchedulePanel from '@/components/admin-wa/SchedulePanel';
import TemplatePanel from '@/components/admin-wa/TemplatePanel';
import GroupsPanel from '@/components/admin-wa/GroupsPanel';
import UsersPhonePanel from '@/components/admin-wa/UsersPhonePanel';
import TestSendPanel from '@/components/admin-wa/TestSendPanel';

type TabId = 'log' | 'schedule' | 'template' | 'groups' | 'users' | 'test';

const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'log',      label: 'Log',           icon: 'history' },
    { id: 'schedule', label: 'Jadwal',        icon: 'schedule' },
    { id: 'template', label: 'Template',      icon: 'draft' },
    { id: 'groups',   label: 'Groups WA',     icon: 'forum' },
    { id: 'users',    label: 'Nomor Operator', icon: 'group' },
    { id: 'test',     label: 'Test Send',     icon: 'send' },
];

export default function NotificationHubPage() {
    const { operator, canManageUsers } = useOperator();
    const router = useRouter();
    const [tab, setTab] = useState<TabId>('log');

    useEffect(() => {
        if (!operator) router.push('/');
        else if (!canManageUsers) router.push('/dashboard');
    }, [operator, canManageUsers, router]);

    if (!operator || !canManageUsers) return null;

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-6">
            <header className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/20 rounded-xl">
                    <span className="material-symbols-outlined text-indigo-400 text-2xl">hub</span>
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-white">WhatsApp Hub</h2>
                    <p className="text-text-secondary text-sm mt-1">Pusat pengaturan notifikasi WhatsApp — log, jadwal, template, group, & operator.</p>
                </div>
            </header>

            <div className="border-b border-slate-800 flex flex-wrap gap-1">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer
                            ${tab === t.id
                                ? 'border-primary text-white'
                                : 'border-transparent text-text-secondary hover:text-white hover:bg-surface-highlight/30'}`}>
                        <span className="material-symbols-outlined text-base">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            <div>
                {tab === 'log' && <LogPanel />}
                {tab === 'schedule' && <SchedulePanel />}
                {tab === 'template' && <TemplatePanel />}
                {tab === 'groups' && <GroupsPanel />}
                {tab === 'users' && <UsersPhonePanel />}
                {tab === 'test' && <TestSendPanel />}
            </div>
        </div>
    );
}
