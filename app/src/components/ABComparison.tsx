'use client';

import React from 'react';
import { ArrowLeftRight } from 'lucide-react';

interface ABComparisonProps {
  isComparing: boolean;
  selectedVersion: 'a' | 'b' | null;
  onSelectA: () => void;
  onSelectB: () => void;
  onKeepA: () => void;
  onKeepB: () => void;
}

export function ABComparison({
  isComparing,
  selectedVersion,
  onSelectA,
  onSelectB,
  onKeepA,
  onKeepB,
}: ABComparisonProps) {
  if (!isComparing) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/80 border border-white/10 rounded-lg">
      <ArrowLeftRight size={14} className="text-purple-400 flex-shrink-0" />

      <button
        onClick={onSelectA}
        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
          selectedVersion === 'a'
            ? 'bg-purple-600 text-white'
            : 'bg-zinc-700 text-zinc-400 hover:text-white'
        }`}
      >
        A (Original)
      </button>
      <button
        onClick={onSelectB}
        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
          selectedVersion === 'b'
            ? 'bg-purple-600 text-white'
            : 'bg-zinc-700 text-zinc-400 hover:text-white'
        }`}
      >
        B (New)
      </button>

      <div className="w-px h-4 bg-zinc-600 mx-1" />

      <button
        onClick={onKeepA}
        className="px-2 py-1 rounded text-xs font-medium text-zinc-400 hover:text-green-400 hover:bg-green-400/10 transition-colors"
      >
        Keep A
      </button>
      <button
        onClick={onKeepB}
        className="px-2 py-1 rounded text-xs font-medium text-zinc-400 hover:text-green-400 hover:bg-green-400/10 transition-colors"
      >
        Keep B
      </button>
    </div>
  );
}
