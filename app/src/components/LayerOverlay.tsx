'use client';

import React from 'react';
import { Volume2, VolumeX, Headphones, RefreshCw, Trash2 } from 'lucide-react';
import { Layer } from '@/lib/types';
import { STEM_COLORS, STEM_DISPLAY_NAMES, StemType } from '@/lib/constants';
import { ABComparison } from './ABComparison';

interface LayerOverlayProps {
  layer: Layer;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onVolumeChange: (volume: number) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  hasABComparison: boolean;
  abSelectedVersion: 'a' | 'b' | null;
  onSelectABVersion: (version: 'a' | 'b') => void;
  onKeepA: () => void;
  onKeepB: () => void;
}

export function LayerOverlay({
  layer,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  onRegenerate,
  onDelete,
  hasABComparison,
  abSelectedVersion,
  onSelectABVersion,
  onKeepA,
  onKeepB,
}: LayerOverlayProps) {
  const color = STEM_COLORS[layer.stemType as StemType] || '#a78bfa';
  const displayName = STEM_DISPLAY_NAMES[layer.stemType as StemType] || layer.name;

  return (
    <div
      className={`border-b border-white/5 px-2 flex flex-col justify-center bg-zinc-900/50 ${
        hasABComparison ? 'h-[110px]' : 'h-[55px]'
      }`}
    >
      {/* Name row */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[11px] font-medium text-zinc-200 truncate">{displayName}</span>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onToggleMute}
          className={`p-0.5 rounded transition-colors ${layer.isMuted ? 'text-red-400 bg-red-400/10' : 'text-zinc-500 hover:text-zinc-300'}`}
          title="Mute"
        >
          {layer.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
        <button
          onClick={onToggleSolo}
          className={`p-0.5 rounded transition-colors ${layer.isSoloed ? 'text-yellow-400 bg-yellow-400/10' : 'text-zinc-500 hover:text-zinc-300'}`}
          title="Solo"
        >
          <Headphones size={12} />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={layer.volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-12 h-1 accent-purple-500"
          aria-label={`Volume for ${displayName}`}
        />
        <button onClick={onRegenerate} className="p-0.5 rounded text-zinc-500 hover:text-purple-400 transition-colors" title="Regenerate">
          <RefreshCw size={12} />
        </button>
        <button onClick={onDelete} className="p-0.5 rounded text-zinc-500 hover:text-red-400 transition-colors" title="Delete">
          <Trash2 size={12} />
        </button>
      </div>

      {/* A/B Comparison row (shown when comparing) */}
      {hasABComparison && (
        <ABComparison
          isComparing={true}
          selectedVersion={abSelectedVersion}
          onSelectA={() => onSelectABVersion('a')}
          onSelectB={() => onSelectABVersion('b')}
          onKeepA={onKeepA}
          onKeepB={onKeepB}
        />
      )}
    </div>
  );
}
