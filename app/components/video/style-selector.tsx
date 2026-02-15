"use client";

import { useState } from "react";
import { Sparkles, Palette, BookOpen, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VideoStyleConfig, VideoTheme } from "@/lib/layertune-types";
import { VIDEO_THEME_LABELS } from "@/lib/layertune-types";

interface StyleSelectorProps {
  onSubmit: (config: VideoStyleConfig) => void;
  hasLyrics: boolean;
}

type StyleMode = VideoStyleConfig["mode"];

const MODE_TABS: { mode: StyleMode; label: string; icon: typeof Palette }[] = [
  { mode: "preset", label: "Theme Preset", icon: Palette },
  { mode: "custom", label: "Custom", icon: Sparkles },
  { mode: "lyrics-driven", label: "Lyrics-Driven", icon: BookOpen },
  { mode: "surprise", label: "Surprise Me", icon: Shuffle },
];

const THEME_OPTIONS: VideoTheme[] = [
  "concert_stage",
  "music_video",
  "minimalist",
  "retro_vhs",
  "neon_city",
];

const THEME_ICONS: Record<VideoTheme, string> = {
  concert_stage: "🎤",
  music_video: "🎬",
  minimalist: "◻️",
  retro_vhs: "📼",
  neon_city: "🌆",
};

export function StyleSelector({ onSubmit, hasLyrics }: StyleSelectorProps) {
  const [activeMode, setActiveMode] = useState<StyleMode>("preset");
  const [selectedTheme, setSelectedTheme] = useState<VideoTheme | null>(null);
  const [freeText, setFreeText] = useState("");

  const isSubmitDisabled =
    (activeMode === "preset" && !selectedTheme) ||
    (activeMode === "custom" && !freeText.trim()) ||
    (activeMode === "lyrics-driven" && !hasLyrics);

  const handleSubmit = () => {
    const config: VideoStyleConfig = {
      mode: activeMode,
      theme: activeMode === "preset" ? selectedTheme : null,
      freeTextPrompt: activeMode === "custom" ? freeText.trim() : "",
    };
    onSubmit(config);
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-lg mx-auto">
      {/* Mode tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/[0.07]">
        {MODE_TABS.map(({ mode, label, icon: Icon }) => {
          const isActive = activeMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setActiveMode(mode)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-[#c4f567]/10 text-[#c4f567] border border-[#c4f567]/30"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.03] border border-transparent"
              }`}
              aria-pressed={isActive}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Mode content */}
      <div className="min-h-[200px]">
        {/* Theme Preset mode */}
        {activeMode === "preset" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEME_OPTIONS.map((theme) => {
              const isSelected = selectedTheme === theme;
              return (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setSelectedTheme(theme)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    isSelected
                      ? "border-[#c4f567] bg-[#c4f567]/5 shadow-[0_0_16px_rgba(196,245,103,0.1)]"
                      : "border-white/10 bg-white/[0.02] hover:border-[#c4f567]/50 hover:bg-white/[0.04]"
                  }`}
                  aria-pressed={isSelected}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {THEME_ICONS[theme]}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      isSelected ? "text-[#c4f567]" : "text-white/60"
                    }`}
                  >
                    {VIDEO_THEME_LABELS[theme]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Custom mode */}
        {activeMode === "custom" && (
          <div className="space-y-3">
            <label
              htmlFor="custom-scene"
              className="block text-sm text-white/50"
            >
              Describe your video scene
            </label>
            <textarea
              id="custom-scene"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="A dreamy forest at sunset with floating particles of light, cinematic camera movement..."
              rows={5}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#c4f567]/40 transition-colors resize-none"
            />
            <p className="text-[11px] text-white/30">
              Be descriptive. Include lighting, colors, mood, and camera style
              for best results.
            </p>
          </div>
        )}

        {/* Lyrics-Driven mode */}
        {activeMode === "lyrics-driven" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-[#c4f567]/10 border border-[#c4f567]/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#c4f567]" />
            </div>
            {hasLyrics ? (
              <>
                <p className="text-sm text-white/70 text-center max-w-xs">
                  Your lyrics will be analyzed to automatically generate matching
                  scenes for each section of your song.
                </p>
                <p className="text-xs text-white/30 text-center">
                  Verses, choruses, and bridges each get unique visuals.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-white/50 text-center max-w-xs">
                  No lyrics found in your project.
                </p>
                <p className="text-xs text-white/30 text-center">
                  Add lyrics in the Lyrics panel first, then come back here.
                </p>
              </>
            )}
          </div>
        )}

        {/* Surprise Me mode */}
        {activeMode === "surprise" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-[#c4f567]/10 border border-[#c4f567]/20 flex items-center justify-center">
              <Shuffle className="w-5 h-5 text-[#c4f567]" />
            </div>
            <p className="text-sm text-white/70 text-center max-w-xs">
              AI will auto-generate everything from your track vibes, genre, and
              mood. No input needed.
            </p>
            <p className="text-xs text-white/30 text-center">
              Sit back and let the AI surprise you.
            </p>
          </div>
        )}
      </div>

      {/* Generate button */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        className="w-full h-11 bg-[#c4f567] text-black font-semibold hover:bg-[#b8e557] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <Sparkles className="w-4 h-4" />
        Generate Video
      </Button>
    </div>
  );
}

export default StyleSelector;
