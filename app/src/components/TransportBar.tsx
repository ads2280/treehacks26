'use client';

import React from 'react';
import { Play, Pause, Square, SkipBack, Volume2, ZoomIn, ZoomOut } from 'lucide-react';

interface TransportBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  masterVolume: number;
  zoomLevel: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRewind: () => void;
  onVolumeChange: (volume: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TransportBar({
  isPlaying,
  currentTime,
  duration,
  masterVolume,
  zoomLevel,
  onPlay,
  onPause,
  onStop,
  onRewind,
  onVolumeChange,
  onZoomIn,
  onZoomOut,
}: TransportBarProps) {
  return (
    <div className="border-t border-white/10 bg-zinc-900 px-6 py-3 flex items-center gap-6">
      {/* Transport controls */}
      <div className="flex items-center gap-1">
        <button onClick={onRewind} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Rewind (R)">
          <SkipBack size={18} />
        </button>
        {isPlaying ? (
          <button onClick={onPause} className="p-2 hover:bg-zinc-800 rounded-lg text-white transition-colors" title="Pause (Space)">
            <Pause size={18} />
          </button>
        ) : (
          <button onClick={onPlay} className="p-2 hover:bg-zinc-800 rounded-lg text-white transition-colors" title="Play (Space)">
            <Play size={18} />
          </button>
        )}
        <button onClick={onStop} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Stop">
          <Square size={16} />
        </button>
      </div>

      {/* Time display */}
      <div className="font-mono text-sm text-zinc-300 min-w-[100px]">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button onClick={onZoomOut} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors">
          <ZoomOut size={16} />
        </button>
        <span className="text-xs text-zinc-500 min-w-[40px] text-center">{Math.round(zoomLevel * 100)}%</span>
        <button onClick={onZoomIn} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors">
          <ZoomIn size={16} />
        </button>
      </div>

      {/* Master volume */}
      <div className="flex items-center gap-2">
        <Volume2 size={16} className="text-zinc-400" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-24 accent-purple-500"
        />
      </div>
    </div>
  );
}
