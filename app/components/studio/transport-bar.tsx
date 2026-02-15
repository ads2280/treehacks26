"use client";

import { useCallback, useRef } from "react";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  ZoomIn,
  ZoomOut,
  Volume2,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface TransportBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  zoom: number;
  masterVolume: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRewind: () => void;
  onSeek: (time: number) => void;
  onSeekCommit: (time: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onMasterVolumeChange: (v: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TransportBar({
  isPlaying,
  currentTime,
  duration,
  zoom,
  masterVolume,
  onPlay,
  onPause,
  onStop,
  onRewind,
  onSeek,
  onSeekCommit,
  onZoomIn,
  onZoomOut,
  onMasterVolumeChange,
}: TransportBarProps) {
  const seekBarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastSeekTime = useRef(0);

  const timeFromEvent = useCallback(
    (clientX: number): number => {
      const bar = seekBarRef.current;
      if (!bar || duration <= 0) return 0;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      isDragging.current = true;
      const time = timeFromEvent(e.clientX);
      lastSeekTime.current = time;
      onSeek(time);

      const handleMouseMove = (me: MouseEvent) => {
        if (!isDragging.current) return;
        const t = timeFromEvent(me.clientX);
        lastSeekTime.current = t;
        onSeek(t);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        onSeekCommit(lastSeekTime.current);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [timeFromEvent, onSeek, onSeekCommit]
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-[#0a0a0a] border-t border-white/10">
      {/* Seek bar */}
      <div
        ref={seekBarRef}
        className="group relative h-1.5 cursor-pointer hover:h-2.5 transition-all"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0 bg-white/5" />
        <div
          className="absolute left-0 top-0 bottom-0 bg-[#c4f567]/60 group-hover:bg-[#c4f567]/80 transition-colors"
          style={{ width: `${progress}%` }}
        />
        {/* Playhead indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#c4f567] opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_6px_rgba(196,245,103,0.5)]"
          style={{ left: `calc(${progress}% - 5px)` }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onRewind}
            className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Rewind (R)"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="p-2 rounded-full bg-[#c4f567] text-black hover:bg-[#b8e557] transition-colors"
            title="Play/Pause (Space)"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>
          <button
            onClick={onStop}
            className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>

        {/* Time display */}
        <div className="font-mono text-sm text-white/70 tabular-nums min-w-[90px] text-center">
          {formatTime(currentTime)}{" "}
          <span className="text-white/30">/</span>{" "}
          {formatTime(duration)}
        </div>

        <div className="flex-1" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onZoomOut}
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-white/40 font-mono min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Master volume */}
        <div className="flex items-center gap-2 w-28">
          <Volume2 className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
          <Slider
            value={[masterVolume * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => onMasterVolumeChange(v / 100)}
            className="w-full [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-[#c4f567]/50 [&_[data-slot=slider-thumb]]:h-2.5 [&_[data-slot=slider-thumb]]:w-2.5 [&_[data-slot=slider-thumb]]:border-0"
          />
        </div>
      </div>
    </div>
  );
}
