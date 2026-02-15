"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GenerationPhase, StemType } from "@/lib/layertune-types";

interface CreatePanelProps {
  hasLayers: boolean;
  phase: GenerationPhase;
  onGenerate: (prompt: string, instrumental: boolean) => void;
  onAddLayer: (stemType: StemType, prompt: string) => void;
}

const SUGGESTIONS: { label: string; stemType: StemType; prompt: string }[] = [
  { label: "+ Drums", stemType: "drums", prompt: "drums, beat, rhythm" },
  { label: "+ Melody", stemType: "keyboard", prompt: "melody, piano, keys" },
  { label: "+ Vocals", stemType: "vocals", prompt: "vocals, singing, voice" },
  { label: "+ Bass", stemType: "bass", prompt: "bass, low-end, groove" },
  {
    label: "+ Guitar",
    stemType: "guitar",
    prompt: "guitar, acoustic, strumming",
  },
  {
    label: "+ Synth",
    stemType: "synth",
    prompt: "synth, electronic, pad",
  },
];

export function CreatePanel({
  hasLayers,
  phase,
  onGenerate,
  onAddLayer,
}: CreatePanelProps) {
  const [prompt, setPrompt] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const isGenerating = phase !== "idle" && phase !== "complete" && phase !== "error";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt.trim(), instrumental);
    setPrompt("");
  };

  return (
    <div className="px-4 py-4 bg-[#0d0d0d] border-b border-white/10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                hasLayers ? "Describe a new layer..." : "Describe your music..."
              }
              disabled={isGenerating}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#c4f567]/50 focus:ring-1 focus:ring-[#c4f567]/30 disabled:opacity-50 transition-colors"
            />
          </div>
          <Button
            type="submit"
            disabled={!prompt.trim() || isGenerating}
            className="bg-[#c4f567] text-black hover:bg-[#b8e557] font-semibold px-5 disabled:opacity-40 flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Generating...</span>
              </>
            ) : (
              <span>Generate</span>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-4">
          {!hasLayers && (
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={instrumental}
                onChange={(e) => setInstrumental(e.target.checked)}
                className="accent-[#c4f567] w-3.5 h-3.5"
              />
              Instrumental
            </label>
          )}

          {hasLayers && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.stemType}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => onAddLayer(s.stemType, s.prompt)}
                  className="px-3 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20 disabled:opacity-40 transition-all"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
