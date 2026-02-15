'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Layer } from '@/lib/types';
import { STEM_DISPLAY_NAMES, StemType } from '@/lib/constants';

interface RegenerateModalProps {
  isOpen: boolean;
  layer: Layer | null;
  onRegenerate: (layerId: string, prompt: string) => void;
  onClose: () => void;
}

export function RegenerateModal({ isOpen, layer, onRegenerate, onClose }: RegenerateModalProps) {
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !layer) return null;

  const displayName = STEM_DISPLAY_NAMES[layer.stemType as StemType] || layer.name;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onRegenerate(layer.id, prompt.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-white/10 w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <RefreshCw size={18} className="text-purple-400" />
            Regenerate {displayName}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-zinc-400 mb-4">
          How should this layer change? Describe the new vibe.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`e.g., "make it more aggressive" or "softer, ambient"`}
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/25 mb-4"
          />
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white transition-colors"
            >
              Regenerate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
