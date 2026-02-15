'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel,
    danger = true,
    onConfirm,
    onCancel,
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div
                ref={dialogRef}
                className="bg-zinc-900 rounded-2xl shadow-2xl border border-white/10 w-full max-w-sm mx-4 p-6"
            >
                <div className="flex items-start gap-3 mb-4">
                    {danger && (
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertTriangle size={20} className="text-red-500" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-white">
                            {title}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-400 leading-relaxed">
                            {message}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    >
                        {cancelLabel || 'Cancel'}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            danger
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                    >
                        {confirmLabel || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};
