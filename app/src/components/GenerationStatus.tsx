'use client';

import React from 'react';
import { Loader2, Music, Layers, AudioLines } from 'lucide-react';

export type GenerationPhase = 'idle' | 'generating' | 'separating' | 'loading' | 'complete' | 'error';

interface GenerationStatusProps {
  phase: GenerationPhase;
  message?: string;
}

const phaseConfig: Record<GenerationPhase, { icon: React.ReactNode; label: string; color: string }> = {
  idle: { icon: null, label: '', color: '' },
  generating: {
    icon: <Music size={16} className="animate-pulse" />,
    label: 'Generating track...',
    color: 'text-purple-400',
  },
  separating: {
    icon: <Layers size={16} className="animate-pulse" />,
    label: 'Separating stems...',
    color: 'text-blue-400',
  },
  loading: {
    icon: <AudioLines size={16} className="animate-pulse" />,
    label: 'Loading audio...',
    color: 'text-green-400',
  },
  complete: {
    icon: null,
    label: 'Done!',
    color: 'text-green-400',
  },
  error: {
    icon: null,
    label: 'Error',
    color: 'text-red-400',
  },
};

export function GenerationStatus({ phase, message }: GenerationStatusProps) {
  if (phase === 'idle') return null;

  const config = phaseConfig[phase];

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm ${config.color}`}>
      {phase !== 'complete' && phase !== 'error' && <Loader2 size={14} className="animate-spin" />}
      {config.icon}
      <span>{message || config.label}</span>
    </div>
  );
}
