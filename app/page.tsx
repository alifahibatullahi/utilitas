'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { OPERATORS, Operator, ROLE_LABELS, ROLE_ICONS, ROLE_COLORS, ROLE_DOT_COLORS, OperatorRole } from '@/lib/constants';

const GROUP_ORDER: { group: string; label: string }[] = [
  { group: 'A', label: '🅰️ Group A' },
  { group: 'B', label: '🅱️ Group B' },
  { group: 'C', label: '🅲 Group C' },
  { group: 'D', label: '🅳 Group D' },
];

export default function LoginPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { login } = useOperator();
  const router = useRouter();

  const selectedOp = OPERATORS.find(o => o.id === selectedId) || null;

  const handleLogin = () => {
    if (!selectedOp) return;
    login(selectedOp as Operator);
    if (selectedOp.role === 'handling') {
      router.push('/tank-level');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-dark relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-surface-dark backdrop-blur-xl rounded-2xl border border-slate-800 p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="bg-primary/20 p-4 rounded-2xl mb-4 shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-primary text-4xl">electric_bolt</span>
            </div>
            <h1 className="text-2xl font-bold text-white">PowerOps</h1>
            <p className="text-sm text-text-secondary mt-1">Operator Panel Login</p>
          </div>

          {/* Operator selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Pilih Nama Operator
              </label>
              <select
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(Number(e.target.value) || null)}
                className="w-full px-4 py-3 bg-surface-highlight border border-slate-700 rounded-xl text-slate-200
                                    focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
                                    appearance-none cursor-pointer text-base"
              >
                <option value="" disabled>-- Pilih Nama --</option>
                {GROUP_ORDER.map(g => {
                  const ops = OPERATORS.filter(o => o.group === g.group);
                  if (ops.length === 0) return null;
                  return (
                    <optgroup key={g.group} label={g.label}>
                      {ops.map(op => (
                        <option key={op.id} value={op.id}>
                          {op.name} — {ROLE_LABELS[op.role]}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
                {/* Handling & Admin */}
                <optgroup label="🔩 Handling">
                  {OPERATORS.filter(o => o.role === 'handling').map(op => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </optgroup>
                <optgroup label="🔑 Admin">
                  {OPERATORS.filter(o => o.role === 'admin').map(op => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Selected operator info */}
            {selectedOp && (
              <div className="px-4 py-3 bg-surface-highlight/50 rounded-xl border border-slate-700/30">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${ROLE_DOT_COLORS[selectedOp.role]}`} />
                  <p className="text-sm text-text-secondary">
                    <span className={`font-medium ${ROLE_COLORS[selectedOp.role]}`}>
                      {ROLE_ICONS[selectedOp.role]} {ROLE_LABELS[selectedOp.role]}
                    </span>
                  </p>
                </div>
                {selectedOp.group && (
                  <p className="text-xs text-text-secondary/60 mt-1 ml-5">
                    Group {selectedOp.group}
                  </p>
                )}
              </div>
            )}

            {/* Login button */}
            <button
              onClick={handleLogin}
              disabled={selectedId === null}
              className={`w-full py-3.5 rounded-xl text-base font-semibold transition-all duration-300 cursor-pointer
                                ${selectedId !== null
                  ? 'bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:bg-primary/90 active:scale-[0.99]'
                  : 'bg-surface-highlight text-text-secondary/50 cursor-not-allowed'
                }`}
            >
              MASUK
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-text-secondary/40 mt-6">
          © 2023 PowerOps Control Systems. All systems operational.
        </p>
      </div>
    </div>
  );
}
