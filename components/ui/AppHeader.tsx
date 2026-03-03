'use client';

import { useOperator } from '@/hooks/useOperator';
import { useRouter } from 'next/navigation';

export default function AppHeader() {
    const { operator, logout } = useOperator();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    return (
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo + Title */}
                    <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => router.push('/dashboard')}
                    >
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 3v18M6 3h12v6H6M6 13h10v8H6" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white leading-tight">Tank Level Monitor</h1>
                            <p className="text-xs text-slate-400 leading-tight hidden sm:block">Real-time Monitoring System</p>
                        </div>
                    </div>

                    {/* Operator info */}
                    {operator && (
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-slate-200">{operator.name}</p>
                                <p className="text-xs text-slate-400 capitalize">
                                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${operator.role === 'handling' ? 'bg-cyan-400' : 'bg-emerald-400'}`} />
                                    {operator.role === 'handling' ? 'Operator Handling' : 'Operator CCR'}
                                </p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/50 transition-all duration-200 cursor-pointer"
                            >
                                Keluar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
