'use client';

import { useState, useEffect } from 'react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error';
    onClose: () => void;
    duration?: number;
}

export default function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(true);
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300);
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-0'
                }`}
        >
            <div
                className={`pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border text-base ${type === 'success'
                        ? 'bg-emerald-900/90 border-emerald-600/50 text-emerald-100'
                        : 'bg-red-900/90 border-red-600/50 text-red-100'
                    }`}
            >
                <span className="text-lg">{type === 'success' ? '✅' : '❌'}</span>
                <p className="text-sm font-medium">{message}</p>
                <button
                    onClick={() => {
                        setVisible(false);
                        setTimeout(onClose, 300);
                    }}
                    className="ml-2 text-white/50 hover:text-white/80 transition-colors cursor-pointer"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
