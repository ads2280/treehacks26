'use client';

import React, { useState } from 'react';
import { Download, FileAudio, Layers, Loader2 } from 'lucide-react';
import { Layer, StemType } from '@/lib/types';
import { downloadBlob, downloadUrl } from '@/lib/audio-utils';
import { STEM_DISPLAY_NAMES } from '@/lib/constants';

interface ExportPanelProps {
  layers: Layer[];
  onExportMix: () => Promise<Blob | null>;
  projectTitle: string;
}

export function ExportPanel({ layers, onExportMix, projectTitle }: ExportPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportMix = async () => {
    setIsExporting(true);
    try {
      const blob = await onExportMix();
      if (blob) {
        const filename = `${projectTitle || 'layertune-mix'}.wav`.replace(/[^a-zA-Z0-9.-]/g, '_');
        downloadBlob(blob, filename);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadStem = async (layer: Layer) => {
    if (!layer.audioUrl) return;
    const name = STEM_DISPLAY_NAMES[layer.stemType as StemType] || layer.name;
    const filename = `${projectTitle || 'layertune'}-${name}.mp3`.replace(/[^a-zA-Z0-9.-]/g, '_');
    await downloadUrl(layer.audioUrl, filename);
  };

  const handleDownloadAllStems = async () => {
    const layersWithAudio = layers.filter((l) => l.audioUrl);
    for (const layer of layersWithAudio) {
      await handleDownloadStem(layer);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  if (layers.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-lg text-zinc-300 transition-colors"
      >
        <Download size={16} />
        Export
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-2">
            <button
              onClick={handleExportMix}
              disabled={isExporting}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-left transition-colors"
            >
              {isExporting ? (
                <Loader2 size={18} className="text-purple-400 animate-spin" />
              ) : (
                <FileAudio size={18} className="text-purple-400" />
              )}
              <div>
                <div className="text-sm font-medium text-white">Export Full Mix</div>
                <div className="text-xs text-zinc-500">WAV format</div>
              </div>
            </button>

            <button
              onClick={handleDownloadAllStems}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-left transition-colors"
            >
              <Layers size={18} className="text-blue-400" />
              <div>
                <div className="text-sm font-medium text-white">Download All Stems</div>
                <div className="text-xs text-zinc-500">{layers.filter((l) => l.audioUrl).length} stems</div>
              </div>
            </button>

            <div className="border-t border-white/10 my-1" />

            <div className="max-h-48 overflow-y-auto">
              {layers.filter((l) => l.audioUrl).map((layer) => {
                const name = STEM_DISPLAY_NAMES[layer.stemType as StemType] || layer.name;
                return (
                  <button
                    key={layer.id}
                    onClick={() => handleDownloadStem(layer)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 text-left transition-colors"
                  >
                    <Download size={14} className="text-zinc-500" />
                    <span className="text-xs text-zinc-300 truncate">{name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
