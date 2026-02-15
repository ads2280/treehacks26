import { StemType } from './types';
export type { StemType };

export const SUNO_API_BASE = 'https://studio-api.prod.suno.com/api/v2/external/hackathons';

export const STEM_COLORS: Record<StemType, string> = {
  vocals: '#a78bfa',
  backing_vocals: '#c4b5fd',
  drums: '#f97316',
  bass: '#ef4444',
  guitar: '#22c55e',
  keyboard: '#3b82f6',
  percussion: '#f59e0b',
  strings: '#ec4899',
  synth: '#06b6d4',
  fx: '#8b5cf6',
  brass: '#eab308',
  woodwinds: '#14b8a6',
};

export const STEM_DISPLAY_NAMES: Record<StemType, string> = {
  vocals: 'Vocals',
  backing_vocals: 'Backing Vocals',
  drums: 'Drums',
  bass: 'Bass',
  guitar: 'Guitar',
  keyboard: 'Keyboard',
  percussion: 'Percussion',
  strings: 'Strings',
  synth: 'Synth',
  fx: 'FX',
  brass: 'Brass',
  woodwinds: 'Woodwinds',
};

export interface SmartSuggestion {
  label: string;
  stemType: StemType;
  defaultTags: string;
}

export const SMART_SUGGESTIONS: SmartSuggestion[] = [
  { label: '+ Drums', stemType: 'drums', defaultTags: 'drums, beat, rhythm' },
  { label: '+ Melody', stemType: 'keyboard', defaultTags: 'melody, piano, keys' },
  { label: '+ Vocals', stemType: 'vocals', defaultTags: 'vocals, singing, voice' },
  { label: '+ Bass', stemType: 'bass', defaultTags: 'bass, low-end, groove' },
  { label: '+ Guitar', stemType: 'guitar', defaultTags: 'guitar, acoustic, strumming' },
  { label: '+ Synth', stemType: 'synth', defaultTags: 'synth, electronic, pad' },
];

export const POLL_INTERVALS = {
  clip: 5000,
  stem: 8000,
} as const;

export const STEM_TYPE_TAGS: Record<StemType, string> = {
  vocals: 'vocals, singing, voice',
  backing_vocals: 'backing vocals, harmony, choir',
  drums: 'drums, beat, rhythm, percussion',
  bass: 'bass, low-end, groove, bassline',
  guitar: 'guitar, acoustic, electric guitar',
  keyboard: 'piano, keys, keyboard, melody',
  percussion: 'percussion, shaker, tambourine',
  strings: 'strings, violin, cello, orchestral',
  synth: 'synth, electronic, synthesizer, pad',
  fx: 'fx, effects, ambient, atmosphere',
  brass: 'brass, trumpet, horn, trombone',
  woodwinds: 'woodwinds, flute, clarinet, saxophone',
};

export const STEM_NAME_TO_TYPE: Record<string, StemType> = {
  Vocals: 'vocals',
  'Backing Vocals': 'backing_vocals',
  Drums: 'drums',
  Bass: 'bass',
  Guitar: 'guitar',
  Keyboard: 'keyboard',
  Percussion: 'percussion',
  Strings: 'strings',
  Synth: 'synth',
  FX: 'fx',
  Brass: 'brass',
  Woodwinds: 'woodwinds',
};
