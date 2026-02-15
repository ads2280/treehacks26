'use client';

import React, { useState } from 'react';
import { Sparkles, Music, Loader2 } from 'lucide-react';
import { SMART_SUGGESTIONS } from '@/lib/constants';

interface CreatePanelProps {
  onGenerate: (prompt: string, tags?: string, instrumental?: boolean) => void;
  onAddLayer: (stemType: string, tags: string) => void;
  isGenerating: boolean;
  hasLayers: boolean;
}

export function CreatePanel({ onGenerate, onAddLayer, isGenerating, hasLayers }: CreatePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [instrumental, setInstrumental] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt.trim(), undefined, instrumental);
  };

  return (
    <div className="border-b border-white/10 bg-zinc-900/50 px-6 py-4">
      <form onSubmit={handleSubmit} className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Music className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={hasLayers ? 'Describe a new layer to add...' : 'Describe your music... (e.g., "lofi hip-hop, rainy day, nostalgic")'}
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
          {hasLayers ? 'Add Layer' : 'Generate'}
        </button>
      </form>

      {hasLayers && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {SMART_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.stemType}
              onClick={() => onAddLayer(suggestion.stemType, suggestion.defaultTags)}
              disabled={isGenerating}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-full text-zinc-300 transition-colors disabled:opacity-50"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
