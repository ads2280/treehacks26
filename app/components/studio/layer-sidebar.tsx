"use client";

import {
  Volume2,
  VolumeX,
  Headphones,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { Layer, ABState } from "@/lib/layertune-types";
import { STEM_COLORS, STEM_LABELS } from "@/lib/layertune-types";

interface LayerSidebarProps {
  layers: Layer[];
  abState: Record<string, ABState>;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onVolumeChange: (id: string, volume: number) => void;
  onRegenerate: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectAB: (id: string, version: "a" | "b") => void;
  onKeepVersion: (id: string, version: "a" | "b") => void;
}

export function LayerSidebar({
  layers,
  abState,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  onRegenerate,
  onDelete,
  onSelectAB,
  onKeepVersion,
}: LayerSidebarProps) {
  return (
    <div className="w-56 flex-shrink-0 border-r border-white/10 overflow-y-auto">
      {layers.map((layer) => {
        const color = STEM_COLORS[layer.stemType];
        const ab = abState[layer.id] || "none";
        const isComparing = ab === "comparing" || ab === "a_selected" || ab === "b_selected";
        const isA = ab === "a_selected";

        return (
          <div
            key={layer.id}
            className="border-b border-white/5 transition-colors"
            style={{ height: isComparing ? 110 : 80 }}
          >
            {/* Main controls */}
            <div className="flex items-center gap-2 px-3 py-2 h-[50px]">
              {/* Color dot */}
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              {/* Name */}
              <span className="text-xs text-white/80 truncate flex-1" title={layer.name}>
                {STEM_LABELS[layer.stemType]}
              </span>
              {/* Mute */}
              <button
                onClick={() => onToggleMute(layer.id)}
                className={`p-1 rounded transition-colors ${
                  layer.isMuted
                    ? "bg-red-500/20 text-red-400"
                    : "text-white/40 hover:text-white/70"
                }`}
                title={layer.isMuted ? "Unmute" : "Mute"}
              >
                {layer.isMuted ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              {/* Solo */}
              <button
                onClick={() => onToggleSolo(layer.id)}
                className={`p-1 rounded transition-colors ${
                  layer.isSoloed
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "text-white/40 hover:text-white/70"
                }`}
                title={layer.isSoloed ? "Unsolo" : "Solo"}
              >
                <Headphones className="w-3.5 h-3.5" />
              </button>
              {/* Regenerate */}
              <button
                onClick={() => onRegenerate(layer.id)}
                className="p-1 rounded text-white/40 hover:text-white/70 transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {/* Delete */}
              <button
                onClick={() => onDelete(layer.id)}
                className="p-1 rounded text-white/40 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Volume slider */}
            <div className="px-3 pb-1.5">
              <Slider
                value={[layer.volume * 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => onVolumeChange(layer.id, v / 100)}
                className="w-full [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-white/30 [&_[data-slot=slider-thumb]]:h-2.5 [&_[data-slot=slider-thumb]]:w-2.5 [&_[data-slot=slider-thumb]]:border-0"
                style={
                  {
                    "--slider-color": color,
                  } as React.CSSProperties
                }
              />
            </div>

            {/* A/B Comparison panel */}
            {isComparing && (
              <div className="flex items-center gap-1 px-3 pb-1.5">
                <button
                  onClick={() => onSelectAB(layer.id, "a")}
                  className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                    isA
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-white/40 hover:text-white/60"
                  }`}
                >
                  A
                </button>
                <button
                  onClick={() => onSelectAB(layer.id, "b")}
                  className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                    !isA
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-white/40 hover:text-white/60"
                  }`}
                >
                  B
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => onKeepVersion(layer.id, "a")}
                  className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Keep A
                </button>
                <button
                  onClick={() => onKeepVersion(layer.id, "b")}
                  className="px-2 py-0.5 text-[10px] rounded bg-[#c4f567]/10 text-[#c4f567]/70 hover:bg-[#c4f567]/20 hover:text-[#c4f567] transition-colors"
                >
                  Keep B
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
