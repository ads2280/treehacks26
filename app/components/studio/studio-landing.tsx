"use client";

import { useState, useEffect, useRef } from "react";

import { DjHead } from "@/components/icons/dj-head";
import type { ModelProvider } from "@/lib/layertune-types";

const LOADING_MESSAGES = [
  "Setting up your session",
  "Analyzing your vibe",
  "Planning the composition",
  "Warming up the instruments",
];

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

interface StudioLandingProps {
  onSubmit: (prompt: string) => void;
  isSubmitting: boolean;
  pendingPrompt?: string;
  modelProvider: ModelProvider;
  onModelProviderChange: (provider: ModelProvider) => void;
  agentMode: boolean;
  onAgentModeChange: (mode: boolean) => void;
  lyrics: string;
  onLyricsChange: (lyrics: string) => void;
}

const STRUCTURE_TAGS = ["[Intro]", "[Verse]", "[Chorus]", "[Bridge]", "[Outro]"];

const QUICK_PROMPTS = [
  { label: "Lofi chill beats", prompt: "lofi hip hop, chill, rainy day vibes, nostalgic" },
  { label: "Trap banger", prompt: "trap, 808s, hard hitting drums, dark energy" },
  { label: "Acoustic folk", prompt: "acoustic guitar, folk, warm, storytelling" },
  { label: "Synth pop", prompt: "synth pop, 80s inspired, bright, danceable" },
  { label: "Jazz vibes", prompt: "smooth jazz, saxophone, piano, late night" },
  { label: "EDM drop", prompt: "edm, electronic, heavy bass drop, festival energy" },
];

export function StudioLanding({ onSubmit, isSubmitting, pendingPrompt, modelProvider, onModelProviderChange, agentMode, onAgentModeChange, lyrics, onLyricsChange }: StudioLandingProps) {
  const [input, setInput] = useState(pendingPrompt || "");
  const [lyricsPopupOpen, setLyricsPopupOpen] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Cycle through loading messages
  useEffect(() => {
    if (!isSubmitting) {
      setMsgIdx(0);
      return;
    }
    intervalRef.current = setInterval(() => {
      setMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(intervalRef.current);
  }, [isSubmitting]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting) return;
    onSubmit(input.trim());
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isSubmitting) return;
    setInput(prompt);
  };

  // --- Loading state: shown immediately after pressing enter ---
  if (isSubmitting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center max-w-sm w-full">
          {/* DJ head with pulse ring */}
          <div className="relative mb-8">
            <div className="w-16 h-16 rounded-full bg-[#c4f567]/10 border border-[#c4f567]/30 flex items-center justify-center">
              <DjHead className="w-8 h-8 text-[#c4f567]" />
            </div>
            <div className="absolute inset-0 w-16 h-16 rounded-full border border-[#c4f567]/20 animate-ping" />
          </div>

          {/* Waveform equalizer */}
          <div className="flex items-center justify-center gap-[3px] h-12 mb-6" aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className="inline-block w-[3px] rounded-full bg-[#c4f567]"
                style={{
                  animation: "waveBar 1.2s ease-in-out infinite",
                  animationDelay: `${(i * 0.06) % 1.2}s`,
                  opacity: 0.35 + seededRandom(i) * 0.45,
                }}
              />
            ))}
          </div>

          {/* Cycling status message */}
          <p
            key={msgIdx}
            className="text-base font-medium text-white text-center animate-in fade-in duration-300"
          >
            {LOADING_MESSAGES[msgIdx]}...
          </p>

          {/* User's prompt */}
          <div className="mt-4 px-5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] w-full">
            <p className="text-sm text-white/40 text-center leading-relaxed truncate">
              &ldquo;{pendingPrompt || input}&rdquo;
            </p>
          </div>

          {/* Subtle progress dots */}
          <div className="mt-6 flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#c4f567]/40"
                style={{
                  animation: "pulse 1.4s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Normal input state ---
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      {/* Icon + Greeting */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-[#c4f567]/10 border border-[#c4f567]/20 flex items-center justify-center mb-4">
          <DjHead className="w-8 h-8 text-[#c4f567]" />
        </div>
        <h1 className="text-2xl font-medium text-white mb-1">
          What do you want to produce?
        </h1>
        <p className="text-sm text-white/40">
          Describe a vibe, genre, or feeling to get started
        </p>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="w-full max-w-xl mb-6">
        <div className="bg-white/5 border border-white/10 rounded-xl focus-within:border-[#c4f567]/40 transition-colors">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Describe your music"
              placeholder="Describe your music..."
              disabled={isSubmitting}
              autoFocus
              className="w-full bg-transparent px-5 py-4 pr-14 text-white placeholder:text-white/30 focus:outline-none disabled:opacity-50 text-base"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSubmitting}
              aria-label="Submit prompt"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#c4f567] text-black flex items-center justify-center disabled:opacity-20 hover:shadow-[0_0_16px_rgba(196,245,103,0.5)] hover:scale-110 active:scale-95 transition-all duration-200"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          {/* Controls row */}
          <div className="flex items-center justify-between px-4 pb-3">
            {/* Lyrics button */}
            <button
              type="button"
              onClick={() => setLyricsPopupOpen(!lyricsPopupOpen)}
              className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
                lyricsPopupOpen || lyrics.trim()
                  ? "text-[#c4f567]"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>Lyrics{lyrics.trim() ? " *" : ""}</span>
            </button>

            {/* Model / Agent controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (agentMode) return;
                  onModelProviderChange(modelProvider === "openai" ? "anthropic" : "openai");
                }}
                disabled={agentMode}
                className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(agentMode || modelProvider === "anthropic") ? (
                  <AnthropicLogo className="w-3.5 h-3.5" />
                ) : (
                  <OpenAILogo className="w-3.5 h-3.5" />
                )}
                <span>
                  {(agentMode || modelProvider === "anthropic") ? "Claude Opus" : "GPT-5"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onAgentModeChange(!agentMode)}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-all ${
                  agentMode
                    ? "bg-[#c4f567]/15 text-[#c4f567]"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <span className="text-[10px]">{agentMode ? "●" : "○"}</span>
                <span>{agentMode ? "Agent" : "Normal"}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Lyrics popup */}
      {lyricsPopupOpen && (
        <div className="w-full max-w-xl mb-6 bg-white/5 border border-white/10 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-medium text-white/70">Lyrics</span>
            <button
              type="button"
              onClick={() => setLyricsPopupOpen(false)}
              aria-label="Close lyrics"
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          {/* Structure tags */}
          <div className="px-4 py-2 flex flex-wrap gap-1.5">
            {STRUCTURE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  const newLyrics = lyrics ? `${lyrics}\n\n${tag}\n` : `${tag}\n`;
                  onLyricsChange(newLyrics);
                }}
                className="px-2.5 py-1 text-xs rounded-md bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20 font-mono transition-all"
              >
                {tag}
              </button>
            ))}
          </div>
          {/* Textarea */}
          <div className="px-4 pb-4">
            <textarea
              value={lyrics}
              onChange={(e) => onLyricsChange(e.target.value)}
              aria-label="Lyrics editor"
              placeholder={"[Verse]\nWrite your lyrics here...\n\n[Chorus]\n..."}
              rows={8}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm font-mono text-white/80 placeholder:text-white/20 focus:outline-none focus:border-[#c4f567]/50 resize-none transition-colors caret-[#c4f567]"
            />
          </div>
        </div>
      )}

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-2 justify-center max-w-xl">
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp.label}
            type="button"
            onClick={() => handleQuickPrompt(qp.prompt)}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 text-sm rounded-full bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
          >
            {qp.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AnthropicLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm2.327 5.14L6.22 15.25h5.35L8.896 8.66z" />
    </svg>
  );
}

function OpenAILogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}
