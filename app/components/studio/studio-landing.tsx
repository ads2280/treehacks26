"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { DjHead } from "@/components/icons/dj-head";

interface StudioLandingProps {
  onSubmit: (prompt: string) => void;
  isSubmitting: boolean;
}

const QUICK_PROMPTS = [
  { label: "Lofi chill beats", prompt: "lofi hip hop, chill, rainy day vibes, nostalgic" },
  { label: "Trap banger", prompt: "trap, 808s, hard hitting drums, dark energy" },
  { label: "Acoustic folk", prompt: "acoustic guitar, folk, warm, storytelling" },
  { label: "Synth pop", prompt: "synth pop, 80s inspired, bright, danceable" },
  { label: "Jazz vibes", prompt: "smooth jazz, saxophone, piano, late night" },
  { label: "EDM drop", prompt: "edm, electronic, heavy bass drop, festival energy" },
];

export function StudioLanding({ onSubmit, isSubmitting }: StudioLandingProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting) return;
    onSubmit(input.trim());
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isSubmitting) return;
    onSubmit(prompt);
  };

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
        <div className="relative bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-[#c4f567]/40 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your music..."
            disabled={isSubmitting}
            autoFocus
            className="w-full bg-transparent px-5 py-4 pr-14 text-white placeholder:text-white/30 focus:outline-none disabled:opacity-50 text-base"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSubmitting}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#c4f567] text-black flex items-center justify-center disabled:opacity-30 hover:bg-[#b8e557] transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

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
