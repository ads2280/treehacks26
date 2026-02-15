'use client';

import React, { useState } from 'react';
import { Sparkles, Music, Loader2 } from 'lucide-react';
import { SMART_SUGGESTIONS } from '@/lib/constants';
import type { StemType } from '@/lib/types';

interface CreatePanelProps {
  onGenerate: (prompt: string, tags?: string, instrumental?: boolean) => void;
  onAddLayer: (stemType: string, tags: string) => void;
  isGenerating: boolean;
  hasLayers: boolean;
  existingStemTypes: StemType[];
}

export function CreatePanel({ onGenerate, onAddLayer, isGenerating, hasLayers, existingStemTypes }: CreatePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [instrumental, setInstrumental] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt.trim(), undefined, instrumental);
  };

  // Filter out suggestions for stem types that already have layers
  const availableSuggestions = SMART_SUGGESTIONS.filter(
    (s) => !existingStemTypes.includes(s.stemType)
  );

  return (
    <div className="border-b border-white/10 bg-zinc-900/50 px-6 py-4">
      {/* Show text input only when no layers exist (initial generation) */}
      {!hasLayers && (
        <form onSubmit={handleSubmit} className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Music className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='Describe your vibe... (e.g., "lofi hip-hop, rainy day, nostalgic")'
              className="w-full bg-zinc-800 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/25"
              disabled={isGenerating}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={instrumental}
              onChange={(e) => setInstrumental(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500/25"
            />
            Instrumental
          </label>
          <button
            type="submit"
            disabled={!prompt.trim() || isGenerating}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {isGenerating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Generate
          </button>
        </form>
      )}

      {/* Smart suggestions — shown when layers exist and there are unused stem types */}
      {hasLayers && availableSuggestions.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-zinc-500 mr-1">Add layer:</span>
          {availableSuggestions.map((suggestion) => (
            <button
              key={suggestion.stemType}
              onClick={() => onAddLayer(suggestion.stemType, suggestion.defaultTags)}
              disabled={isGenerating}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-full text-zinc-300 transition-colors disabled:opacity-50"
            >
              {suggestion.label}
            </button>
          ))}
          {isGenerating && (
            <Loader2 size={14} className="animate-spin text-purple-400 ml-2" />
          )}
        </div>
      )}
    </div>
  );
}
