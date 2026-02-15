"use client";

import { useEffect, useRef } from "react";
import type { Layer } from "@/lib/layertune-types";
import { Layers as LayersIcon } from "lucide-react";

interface WaveformDisplayProps {
  layers: Layer[];
  currentTime: number;
  duration: number;
  zoom: number;
  onSeek: (time: number) => void;
  playlistContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function WaveformDisplay({
  layers,
  currentTime,
  duration,
  zoom,
  onSeek,
  playlistContainerRef,
}: WaveformDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || duration === 0) return;
    const progress = currentTime / duration;
    const totalWidth = containerRef.current.scrollWidth;
    const visibleWidth = containerRef.current.clientWidth;
    const playheadX = progress * totalWidth;

    if (
      playheadX < containerRef.current.scrollLeft ||
      playheadX > containerRef.current.scrollLeft + visibleWidth
    ) {
      containerRef.current.scrollLeft = playheadX - visibleWidth / 4;
    }
  }, [currentTime, duration]);

  const playheadProgress = duration > 0 ? currentTime / duration : 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const totalWidth = containerRef.current.scrollWidth;
    const newTime = (clickX / totalWidth) * duration;
    onSeek(Math.max(0, Math.min(newTime, duration)));
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-x-auto overflow-y-auto relative cursor-crosshair"
      onClick={handleClick}
    >
      <div
        className="relative"
        style={{ width: `${Math.round(100 * zoom)}%`, minWidth: "100%" }}
      >
        {layers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-center text-white/30">
              <LayersIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Describe your music to get started</p>
            </div>
          </div>
        )}

        <div
          className="absolute top-0 bottom-0 w-px bg-[#c4f567] z-10 pointer-events-none"
          style={{ left: `${playheadProgress * 100}%` }}
        >
          <div className="w-2.5 h-2.5 bg-[#c4f567] rounded-full absolute -top-1 -left-[4px]" />
        </div>

        <div ref={playlistContainerRef} className="min-h-[200px]" />

        <div className="h-6 border-t border-white/10 flex items-center relative">
          {duration > 0 &&
            Array.from(
              { length: Math.ceil(duration / 10) + 1 },
              (_, i) => i * 10
            ).map((sec) => (
              <div
                key={sec}
                className="absolute text-[10px] text-white/30 font-mono"
                style={{ left: `${(sec / duration) * 100}%` }}
              >
                <div className="w-px h-2 bg-white/15 mb-0.5" />
                {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
