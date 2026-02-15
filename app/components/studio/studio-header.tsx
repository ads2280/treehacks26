"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Download,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Layer } from "@/lib/layertune-types";
import { STEM_LABELS } from "@/lib/layertune-types";
import { downloadBlob, downloadUrl } from "@/lib/audio-utils";

interface StudioHeaderProps {
  projectTitle: string;
  layers: Layer[];
  lyricsOpen?: boolean;
  onToggleLyrics?: () => void;
  onExportMix?: () => Promise<Blob | null>;
  showLanding?: boolean;
}

export function StudioHeader({
  projectTitle,
  layers,
  lyricsOpen,
  onToggleLyrics,
  onExportMix,
  showLanding,
}: StudioHeaderProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleExportMix = async () => {
    setExportOpen(false);
    if (!onExportMix) return;
    const blob = await onExportMix();
    if (blob) {
      downloadBlob(blob, `${projectTitle || "mix"}.wav`);
    }
  };

  const handleDownloadAllStems = () => {
    setExportOpen(false);
    layers.forEach((layer) => {
      if (layer.audioUrl) {
        downloadUrl(layer.audioUrl, `${STEM_LABELS[layer.stemType] || layer.name}.mp3`);
      }
    });
  };

  const handleDownloadStem = (layer: Layer) => {
    setExportOpen(false);
    if (layer.audioUrl) {
      downloadUrl(layer.audioUrl, `${STEM_LABELS[layer.stemType] || layer.name}.mp3`);
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-b border-white/10">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/producething_brandmark.svg"
            alt="ProduceThing"
            width={32}
            height={32}
            className="h-8 w-auto"
          />
        </Link>
        <div className="hidden sm:block h-5 w-px bg-white/20" />
        <span className="hidden sm:block text-sm text-white/60 font-medium truncate max-w-48">
          {projectTitle}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Lyrics Toggle — hidden in landing mode */}
        {onToggleLyrics && !showLanding && (
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleLyrics}
            className={`bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white flex items-center gap-1.5 ${
              lyricsOpen ? "border-[#c4f567]/50 text-[#c4f567]" : ""
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Lyrics</span>
          </Button>
        )}

        {/* Export Menu */}
        {layers.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExportOpen(!exportOpen)}
              className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                <button
                  className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                  onClick={handleExportMix}
                >
                  Export Full Mix
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                  onClick={handleDownloadAllStems}
                >
                  Download All Stems
                </button>
                <div className="h-px bg-white/10 my-1" />
                {layers.map((layer) => (
                  <button
                    key={layer.id}
                    className="w-full px-3 py-2 text-left text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors truncate"
                    onClick={() => handleDownloadStem(layer)}
                  >
                    {layer.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
