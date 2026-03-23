'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { Operator } from '@/lib/constants';

const GROUP_CONFIG = [
  { group: 'A', label: 'Group A', color: 'from-cyan-500/20 to-cyan-600/5', border: 'border-cyan-500/30', accent: 'text-cyan-400', dot: 'bg-cyan-400', ring: 'ring-cyan-500/20' },
  { group: 'B', label: 'Group B', color: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/30', accent: 'text-blue-400', dot: 'bg-blue-400', ring: 'ring-blue-500/20' },
  { group: 'C', label: 'Group C', color: 'from-violet-500/20 to-violet-600/5', border: 'border-violet-500/30', accent: 'text-violet-400', dot: 'bg-violet-400', ring: 'ring-violet-500/20' },
  { group: 'D', label: 'Group D', color: 'from-emerald-500/20 to-emerald-600/5', border: 'border-emerald-500/30', accent: 'text-emerald-400', dot: 'bg-emerald-400', ring: 'ring-emerald-500/20' },
  { group: 'ND', label: 'Normal Day', color: 'from-amber-500/20 to-amber-600/5', border: 'border-amber-500/30', accent: 'text-amber-400', dot: 'bg-amber-400', ring: 'ring-amber-500/20' },
];

function CompanyBadge({ company }: { company?: string }) {
  if (!company || company === 'UBB') return null;
  const short = company === 'PT FJM' ? 'FJM' : company === 'PT Shohib Jaya Putra' ? 'PSJP' : company;
  return (
    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-700/60 text-slate-400 uppercase tracking-wide">
      {short}
    </span>
  );
}

export default function LoginPage() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedOp, setSelectedOp] = useState<Operator | null>(null);
  const { operator, operators, loading, login } = useOperator();
  const router = useRouter();

  useEffect(() => {
    if (!loading && operator) {
      router.replace('/dashboard');
    }
  }, [loading, operator, router]);

  const groupMembers = useMemo(() => {
    if (!selectedGroup) return [];
    if (selectedGroup === 'ND') return operators.filter(o => !o.group);
    return operators.filter(o => o.group === selectedGroup);
  }, [selectedGroup, operators]);

  const jabatanOrder = (j?: string) =>
    j === 'Supervisor' ? 0 : j === 'Foreman Turbin' ? 1 : j === 'Foreman Boiler' ? 2
    : j === 'AVP' ? 0 : j === 'Junior AVP' ? 1 : 3;

  const sortByJabatan = (a: Operator, b: Operator) => jabatanOrder(a.jabatan) - jabatanOrder(b.jabatan);

  const organik = groupMembers.filter(o => !o.company || o.company === 'UBB').sort(sortByJabatan);
  const tad = groupMembers.filter(o => o.company && o.company !== 'UBB');

  const handleLogin = () => {
    if (!selectedOp) return;
    login(selectedOp);
    router.push('/dashboard');
  };

  const handleBack = () => {
    setSelectedGroup(null);
    setSelectedOp(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark">
        <div className="animate-pulse text-text-secondary">Loading...</div>
      </div>
    );
  }

  if (operator) return null;

  const activeConfig = GROUP_CONFIG.find(g => g.group === selectedGroup);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-dark relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-surface-dark backdrop-blur-xl rounded-2xl border border-slate-800 p-6 sm:p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="bg-primary/20 p-3 rounded-2xl mb-3 shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-primary text-3xl">electric_bolt</span>
            </div>
            <h1 className="text-xl font-bold text-white">PowerOps</h1>
            <p className="text-xs text-text-secondary mt-1">Operator Panel Login</p>
          </div>

          {/* Step 1: Group Selection */}
          {!selectedGroup && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-text-secondary text-center mb-4">Pilih Grup Shift</p>
              <div className="grid grid-cols-2 gap-3">
                {GROUP_CONFIG.map(g => {
                  const count = g.group === 'ND'
                    ? operators.filter(o => !o.group).length
                    : operators.filter(o => o.group === g.group).length;
                  return (
                    <button
                      key={g.group}
                      onClick={() => setSelectedGroup(g.group)}
                      className={`relative p-4 rounded-xl border ${g.border} bg-gradient-to-br ${g.color}
                        hover:ring-2 ${g.ring} transition-all duration-200 cursor-pointer text-left group active:scale-[0.98]
                        ${g.group === 'ND' ? 'col-span-2' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-surface-dark/60 flex items-center justify-center`}>
                          <span className={`text-lg font-bold ${g.accent}`}>
                            {g.group === 'ND' ? '☀' : g.group}
                          </span>
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${g.accent}`}>{g.label}</p>
                          <p className="text-xs text-text-secondary/60">{count} personil</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-slate-400 transition-colors text-[20px]">
                        chevron_right
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Member Selection */}
          {selectedGroup && !selectedOp && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-slate-400 text-[20px]">arrow_back</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${activeConfig?.dot}`} />
                  <p className={`text-sm font-semibold ${activeConfig?.accent}`}>{activeConfig?.label}</p>
                </div>
              </div>

              <div className="max-h-[360px] overflow-y-auto space-y-1">
                {/* Organik section */}
                {organik.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 pt-1">Organik</p>
                    {organik.map(op => (
                      <button
                        key={op.id}
                        onClick={() => setSelectedOp(op)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer text-left group"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-slate-300">{op.name.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">{op.name}</p>
                          {op.jabatan && (
                            <p className="text-[11px] text-slate-500">{op.jabatan}</p>
                          )}
                        </div>
                        <span className="material-symbols-outlined text-slate-700 group-hover:text-slate-500 text-[18px]">
                          chevron_right
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {/* Tenaga Alih Daya section */}
                {tad.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-2 pt-3 pb-1">
                      <div className="h-px bg-slate-700/50 flex-1" />
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tenaga Alih Daya</p>
                      <div className="h-px bg-slate-700/50 flex-1" />
                    </div>
                    {tad.map(op => (
                      <button
                        key={op.id}
                        onClick={() => setSelectedOp(op)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer text-left group"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-slate-300">{op.name.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">{op.name}</p>
                        </div>
                        <CompanyBadge company={op.company} />
                        <span className="material-symbols-outlined text-slate-700 group-hover:text-slate-500 text-[18px]">
                          chevron_right
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Confirm & Login */}
          {selectedOp && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setSelectedOp(null)} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-slate-400 text-[20px]">arrow_back</span>
                </button>
                <p className="text-sm font-medium text-text-secondary">Konfirmasi Login</p>
              </div>

              {/* Selected operator card */}
              <div className={`p-4 rounded-xl border ${activeConfig?.border} bg-gradient-to-br ${activeConfig?.color}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-surface-dark/60 flex items-center justify-center`}>
                    <span className={`text-2xl font-bold ${activeConfig?.accent}`}>{selectedOp.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-white truncate">{selectedOp.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selectedOp.jabatan && (
                        <span className="text-xs text-slate-300">{selectedOp.jabatan}</span>
                      )}
                      {selectedOp.group && (
                        <span className={`text-xs ${activeConfig?.accent}`}>Group {selectedOp.group}</span>
                      )}
                      <CompanyBadge company={selectedOp.company} />
                    </div>
                    {selectedOp.nik && (
                      <p className="text-[11px] text-slate-500 mt-1">NIK: {selectedOp.nik}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Login button */}
              <button
                onClick={handleLogin}
                className="w-full py-3.5 rounded-xl text-base font-semibold transition-all duration-300 cursor-pointer
                  bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:bg-primary/90 active:scale-[0.99]"
              >
                MASUK
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-text-secondary/40 mt-6">
          &copy; 2025 PowerOps Control Systems
        </p>
      </div>
    </div>
  );
}
