'use client';

import React, { useCallback, useRef, useState } from 'react';

/**
 * Pop-up konfirmasi nilai tidak wajar (dipakai laporan shift & harian).
 * Pemakaian:
 *   const { confirmWarnings, warningModal } = useWarningConfirm();
 *   ...
 *   if (warnings.length > 0) { const ok = await confirmWarnings(warnings); if (!ok) return; }
 *   // render {warningModal} di JSX.
 * confirmWarnings(warnings) → Promise<boolean>: true = "Tetap Simpan", false = "Perbaiki Isi".
 */
export function useWarningConfirm() {
    const [warnings, setWarnings] = useState<string[] | null>(null);
    const resolverRef = useRef<((proceed: boolean) => void) | null>(null);

    const confirmWarnings = useCallback((w: string[]) => {
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
            setWarnings(w);
        });
    }, []);

    const decide = useCallback((proceed: boolean) => {
        resolverRef.current?.(proceed);
        resolverRef.current = null;
        setWarnings(null);
    }, []);

    const warningModal = warnings && warnings.length > 0 ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#0d1520] border border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-500/10 max-w-md w-full p-6 animate-in zoom-in-95">
                <div className="flex items-center gap-3 mb-3">
                    <span className="material-symbols-outlined text-amber-400 text-[28px]">warning</span>
                    <h3 className="text-white font-bold text-lg">Nilai Tidak Wajar</h3>
                </div>
                <p className="text-slate-400 text-sm mb-3">
                    Beberapa nilai sepertinya tidak wajar. Periksa kembali sebelum menyimpan:
                </p>
                <ul className="space-y-1.5 mb-5 max-h-60 overflow-y-auto">
                    {warnings.map((w, i) => (
                        <li key={i} className="flex gap-2 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                            <span className="text-amber-400 shrink-0">•</span>
                            <span>{w}</span>
                        </li>
                    ))}
                </ul>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => decide(false)}
                        className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                        Perbaiki Isi
                    </button>
                    <button
                        type="button"
                        onClick={() => decide(true)}
                        className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        Tetap Simpan
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return { confirmWarnings, warningModal };
}
