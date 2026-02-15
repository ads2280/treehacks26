"use client";

import { useState, useEffect, useRef } from "react";
import {
  Volume2,
  VolumeX,
  Headphones,
  RefreshCw,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { Layer, LayerGenerationStatus } from "@/lib/layertune-types";
import { STEM_COLORS, STEM_LABELS } from "@/lib/layertune-types";

const PHASE_LABELS: Record<LayerGenerationStatus, string> = {
  generating: "Generating",
  separating: "Separating stems",
  loading: "Loading audio",
  error: "Error",
};

// Estimated durations per phase (seconds) for asymptotic progress
const PHASE_DURATIONS: Record<string, number> = {
  generating: 90,
  separating: 120,
  loading: 5,
};

// Each phase's share of the total bar [0..1]
const PHASE_RANGES: Record<string, [number, number]> = {
  generating: [0, 0.5],
  separating: [0.5, 0.9],
  loading: [0.9, 1.0],
};

function LayerProgressBar({ status, color }: { status: LayerGenerationStatus; color: string }) {
  const [elapsed, setElapsed] = useState(0);
  const phaseStartRef = useRef(0);

  useEffect(() => {
    phaseStartRef.current = Date.now();
    setElapsed(0); // eslint-disable-line react-hooks/set-state-in-effect -- reset timer on status change
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - phaseStartRef.current) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [status]);

  const estimate = PHASE_DURATIONS[status] || 60;
  const [rangeStart, rangeEnd] = PHASE_RANGES[status] || [0, 1];
  const rangeSize = rangeEnd - rangeStart;
  // Asymptotic: approaches 95% of this phase's range
  const phaseProgress = Math.min(0.95, 1 - Math.exp(-elapsed / (estimate * 0.4)));
  const totalProgress = (rangeStart + phaseProgress * rangeSize) * 100;

  return (
    <div className="px-3 pb-1.5 space-y-1">
      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${totalProgress}%`, backgroundColor: color, opacity: 0.7 }}
        />
      </div>
      <span className="text-[10px] text-white/30">{PHASE_LABELS[status]}</span>
    </div>
  );
}

function layerButtonClass(isDisabled: boolean, activeClass?: string): string {
  const base = "p-1 rounded transition-colors";
  if (isDisabled) return `${base} opacity-30 cursor-not-allowed`;
  if (activeClass) return `${base} ${activeClass}`;
  return `${base} text-white/40 hover:text-white/70`;
}

interface LayerSidebarProps {
  layers: Layer[];
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onVolumeChange: (id: string, volume: number) => void;
  onRegenerate: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigateOlder: (id: string) => void;
  onNavigateNewer: (id: string) => void;
}

export function LayerSidebar({
  layers,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  onRegenerate,
  onDelete,
  onNavigateOlder,
  onNavigateNewer,
}: LayerSidebarProps) {
  return (
    <div className="w-56 flex-shrink-0 border-r border-white/10 overflow-y-auto studio-scroll">
      {layers.map((layer) => {
        const color = STEM_COLORS[layer.stemType];
        const genStatus = layer.generationStatus;
        const isLayerGenerating = !!genStatus && genStatus !== "error";
        const hasVersions = (layer.versions?.length ?? 0) > 0;
        const totalVersions = (layer.versions?.length ?? 0) + 1;

        return (
          <div
            key={layer.id}
            draggable={!isLayerGenerating}
            onDragStart={(e) => {
              e.dataTransfer.setData(
                "application/layertune-layer",
                JSON.stringify({
                  id: layer.id,
                  name: STEM_LABELS[layer.stemType],
                  stemType: layer.stemType,
                })
              );
              e.dataTransfer.effectAllowed = "copy";
            }}
            className={`border-b border-white/5 transition-colors ${isLayerGenerating ? "opacity-70" : "cursor-grab active:cursor-grabbing"}`}
            style={{ height: hasVersions && !isLayerGenerating ? 110 : 80 }}
          >
            {/* Main controls */}
            <div className="flex items-center gap-2 px-3 py-2 h-[50px]">
              {/* Color dot or spinner */}
              {isLayerGenerating ? (
                <Loader2
                  className="w-3 h-3 flex-shrink-0 animate-spin"
                  style={{ color }}
                />
              ) : (
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: genStatus === "error" ? "#ef4444" : color }}
                />
              )}
              {/* Name */}
              <span className="text-xs text-white/80 truncate flex-1" title={layer.name}>
                {STEM_LABELS[layer.stemType]}
              </span>
              {/* Mute */}
              <button
                onClick={() => onToggleMute(layer.id)}
                disabled={isLayerGenerating}
                className={layerButtonClass(
                  isLayerGenerating,
                  layer.isMuted ? "bg-red-500/20 text-red-400" : undefined
                )}
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
                disabled={isLayerGenerating}
                className={layerButtonClass(
                  isLayerGenerating,
                  layer.isSoloed ? "bg-yellow-500/20 text-yellow-400" : undefined
                )}
                title={layer.isSoloed ? "Unsolo" : "Solo"}
              >
                <Headphones className="w-3.5 h-3.5" />
              </button>
              {/* Regenerate */}
              <button
                onClick={() => onRegenerate(layer.id)}
                disabled={isLayerGenerating}
                className={layerButtonClass(isLayerGenerating)}
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

            {/* Volume slider, progress bar, or error state */}
            {genStatus === "error" ? (
              <div className="px-3 pb-1.5 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                <span className="text-[10px] text-red-400 flex-1 truncate">Generation failed</span>
                <button
                  onClick={() => onDelete(layer.id)}
                  className="p-0.5 rounded text-red-400/60 hover:text-red-400 transition-colors"
                  title="Remove failed layer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : isLayerGenerating && genStatus ? (
              <LayerProgressBar status={genStatus} color={color} />
            ) : (
              <div className="px-3 pb-1.5">
                <Slider
                  value={[layer.volume * 100]}
                  min={0}
                  max={100}
                  step={1}
                  disabled={isLayerGenerating}
                  onValueChange={([v]) => onVolumeChange(layer.id, v / 100)}
                  className={`w-full [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-white/30 [&_[data-slot=slider-thumb]]:h-2.5 [&_[data-slot=slider-thumb]]:w-2.5 [&_[data-slot=slider-thumb]]:border-0 ${isLayerGenerating ? "opacity-30" : ""}`}
                  style={
                    {
                      "--slider-color": color,
                    } as React.CSSProperties
                  }
                />
              </div>
            )}

            {/* Version history */}
            {hasVersions && !isLayerGenerating && (
              <div className="flex items-center gap-1 px-3 pb-1.5">
                <button
                  onClick={() => onNavigateOlder(layer.id)}
                  disabled={(layer.versionCursor ?? 0) >= (layer.versions?.length ?? 0)}
                  className="p-0.5 rounded text-white/40 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Switch to older version"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-[10px] text-white/40 tabular-nums">
                  {totalVersions} versions
                </span>
                <button
                  onClick={() => onNavigateNewer(layer.id)}
                  disabled={(layer.versionCursor ?? 0) <= 0}
                  className="p-0.5 rounded text-white/40 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Switch to newer version"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
