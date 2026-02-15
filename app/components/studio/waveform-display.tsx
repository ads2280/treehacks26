"use client";

import type { Layer } from "@/lib/layertune-types";
import { Layers as LayersIcon } from "lucide-react";

interface WaveformDisplayProps {
  layers: Layer[];
  playlistContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function WaveformDisplay({
  layers,
  playlistContainerRef,
}: WaveformDisplayProps) {
  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto relative cursor-crosshair studio-scroll">
      <div className="relative" style={{ minWidth: "100%" }}>
        {layers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-center text-white/30">
              <LayersIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Describe your music to get started</p>
            </div>
          </div>
        )}

        <div ref={playlistContainerRef} className="min-h-[200px]" />
      </div>
    </div>
  );
}
