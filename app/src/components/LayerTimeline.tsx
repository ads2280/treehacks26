'use client';

import React from 'react';
import { Music } from 'lucide-react';
import { Layer, ABState } from '@/lib/types';
import { LayerOverlay } from './LayerOverlay';

interface LayerTimelineProps {
  layers: Layer[];
  playlistContainerRef: React.RefObject<HTMLDivElement | null>;
  onToggleMute: (layerId: string) => void;
  onToggleSolo: (layerId: string) => void;
  onVolumeChange: (layerId: string, volume: number) => void;
  onRegenerate: (layerId: string) => void;
  onDelete: (layerId: string) => void;
  abState: Record<string, ABState>;
  abSelectedVersions: Record<string, 'a' | 'b'>;
  onSelectABVersion: (layerId: string, version: 'a' | 'b') => void;
  onKeepA: (layerId: string) => void;
  onKeepB: (layerId: string) => void;
}

export function LayerTimeline({
  layers,
  playlistContainerRef,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  onRegenerate,
  onDelete,
  abState,
  abSelectedVersions,
  onSelectABVersion,
  onKeepA,
  onKeepB,
}: LayerTimelineProps) {
  return (
    <div className="flex-1 overflow-auto relative">
      {/* Empty state overlay */}
      {layers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <Music size={48} className="text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-lg">Describe your music to get started</p>
            <p className="text-zinc-600 text-sm mt-1">Type a vibe above and click Generate</p>
          </div>
        </div>
      )}
      {/* Always render so the waveform-playlist ref is available on mount */}
      <div className="flex min-h-full">
        {/* Layer overlays (left panel) */}
        <div className="w-44 flex-shrink-0 border-r border-white/5">
          {layers.map((layer) => {
            const hasAB = layer.previousAudioUrl !== null && abState[layer.id] === 'comparing';
            return (
              <LayerOverlay
                key={layer.id}
                layer={layer}
                onToggleMute={() => onToggleMute(layer.id)}
                onToggleSolo={() => onToggleSolo(layer.id)}
                onVolumeChange={(v) => onVolumeChange(layer.id, v)}
                onRegenerate={() => onRegenerate(layer.id)}
                onDelete={() => onDelete(layer.id)}
                hasABComparison={hasAB}
                abSelectedVersion={abSelectedVersions[layer.id] || 'b'}
                onSelectABVersion={(v) => onSelectABVersion(layer.id, v)}
                onKeepA={() => onKeepA(layer.id)}
                onKeepB={() => onKeepB(layer.id)}
              />
            );
          })}
        </div>
        {/* Waveform playlist container */}
        <div ref={playlistContainerRef} className="flex-1 playlist-container" />
      </div>
    </div>
  );
}
