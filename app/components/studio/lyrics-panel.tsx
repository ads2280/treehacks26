"use client";

import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LyricsPanelProps {
  lyrics: string;
  onLyricsChange: (lyrics: string) => void;
  onClose: () => void;
  onUseLyrics: () => void;
}

const STRUCTURE_TAGS = ["[Intro]", "[Verse]", "[Chorus]", "[Bridge]", "[Outro]"];

export function LyricsPanel({
  lyrics,
  onLyricsChange,
  onClose,
  onUseLyrics,
}: LyricsPanelProps) {
  const insertTag = (tag: string) => {
    const newLyrics = lyrics ? `${lyrics}\n\n${tag}\n` : `${tag}\n`;
    onLyricsChange(newLyrics);
  };

  return (
    <div className="w-80 flex flex-col bg-[#0a0a0a] border-l border-white/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <span className="text-sm font-medium text-white/80">Lyrics</span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Structure tag buttons */}
      <div className="px-3 py-2 border-b border-white/10">
        <div className="flex flex-wrap gap-1.5">
          {STRUCTURE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => insertTag(tag)}
              className="px-2.5 py-1 text-xs rounded-md bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20 font-mono transition-all"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Lyrics textarea */}
      <div className="flex-1 p-3">
        <textarea
          value={lyrics}
          onChange={(e) => onLyricsChange(e.target.value)}
          placeholder={"[Verse]\nWrite your lyrics here...\n\n[Chorus]\n..."}
          className="w-full h-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white/80 font-mono placeholder:text-white/20 focus:outline-none focus:border-[#c4f567]/50 resize-none transition-colors"
        />
      </div>

      {/* Use Lyrics button */}
      <div className="px-3 py-3 border-t border-white/10">
        <Button
          onClick={onUseLyrics}
          disabled={!lyrics.trim()}
          className="w-full bg-[#c4f567] text-black hover:bg-[#b8e557] font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          Use These Lyrics
        </Button>
      </div>
    </div>
  );
}
