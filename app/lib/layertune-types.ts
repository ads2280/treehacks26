export type StemType =
  | "vocals"
  | "backing_vocals"
  | "drums"
  | "bass"
  | "guitar"
  | "keyboard"
  | "percussion"
  | "strings"
  | "synth"
  | "fx"
  | "brass"
  | "woodwinds";

export type ABState = "none" | "comparing" | "a_selected" | "b_selected";

export type LayerGenerationStatus = "generating" | "separating" | "loading" | "error";

export type GenerationPhase =
  | "idle"
  | "generating"
  | "separating"
  | "loading"
  | "complete"
  | "error";

export interface Layer {
  id: string;
  projectId: string;
  name: string;
  stemType: StemType;
  prompt: string;
  audioUrl: string | null;
  previousAudioUrl: string | null;
  volume: number;
  isMuted: boolean;
  isSoloed: boolean;
  position: number;
  sunoClipId: string | null;
  generationJobId: string | null;
  generationStatus?: LayerGenerationStatus;
  createdAt: string;
}

export interface CachedStem {
  stemType: StemType;
  audioUrl: string;
  sunoClipId: string;
  fromClipId: string;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  vibePrompt: string;
  duration: number;
  layers: Layer[];
  originalClipId: string | null;
  stemCache: CachedStem[];
  abState: Record<string, ABState>;
  createdAt: string;
  updatedAt: string;
}

export interface SunoClip {
  id: string;
  video_url: string;
  audio_url: string;
  image_url: string | null;
  image_large_url: string | null;
  is_video_pending: boolean;
  major_model_version: string;
  model_name: string;
  metadata: Record<string, unknown>;
  is_liked: boolean;
  user_id: string;
  display_name: string;
  handle: string;
  is_handle_updated: boolean;
  is_trashed: boolean;
  reaction: null;
  created_at: string;
  status: "submitted" | "queued" | "streaming" | "complete" | "error";
  title: string;
  play_count: number;
  upvote_count: number;
  is_public: boolean;
}

export interface SunoGenerateRequest {
  topic?: string;
  tags?: string;
  prompt?: string;
  make_instrumental?: boolean;
  cover_clip_id?: string;
  negative_tags?: string;
}

export interface SunoGenerateResponse {
  id: string;
  clips: SunoClip[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SunoStemResponse {
  id: string;
  clips: SunoClip[];
}

export const STEM_COLORS: Record<StemType, string> = {
  vocals: "#a78bfa",
  backing_vocals: "#c4b5fd",
  drums: "#f97316",
  bass: "#ef4444",
  guitar: "#22c55e",
  keyboard: "#3b82f6",
  percussion: "#f59e0b",
  strings: "#ec4899",
  synth: "#06b6d4",
  fx: "#8b5cf6",
  brass: "#eab308",
  woodwinds: "#14b8a6",
};

export const STEM_LABELS: Record<StemType, string> = {
  vocals: "Vocals",
  backing_vocals: "Backing Vocals",
  drums: "Drums",
  bass: "Bass",
  guitar: "Guitar",
  keyboard: "Keyboard",
  percussion: "Percussion",
  strings: "Strings",
  synth: "Synth",
  fx: "FX",
  brass: "Brass",
  woodwinds: "Woodwinds",
};

export const SUNO_API_BASE =
  "https://studio-api.prod.suno.com/api/v2/external/hackathons";

export const POLL_INTERVALS = {
  clip: 5000,
  stem: 8000,
} as const;

export const STEM_TYPE_TAGS: Record<StemType, string> = {
  vocals: "vocals, singing, voice",
  backing_vocals: "backing vocals, harmony, choir",
  drums: "drums, beat, rhythm, percussion",
  bass: "bass, low-end, groove, bassline",
  guitar: "guitar, acoustic, electric guitar",
  keyboard: "piano, keys, keyboard, melody",
  percussion: "percussion, shaker, tambourine",
  strings: "strings, violin, cello, orchestral",
  synth: "synth, electronic, synthesizer, pad",
  fx: "fx, effects, ambient, atmosphere",
  brass: "brass, trumpet, horn, trombone",
  woodwinds: "woodwinds, flute, clarinet, saxophone",
};

export const STEM_NAME_TO_TYPE: Record<string, StemType> = {
  Vocals: "vocals",
  "Backing Vocals": "backing_vocals",
  Drums: "drums",
  Bass: "bass",
  Guitar: "guitar",
  Keyboard: "keyboard",
  Percussion: "percussion",
  Strings: "strings",
  Synth: "synth",
  FX: "fx",
  Brass: "brass",
  Woodwinds: "woodwinds",
};

export interface SmartSuggestion {
  label: string;
  stemType: StemType;
  defaultTags: string;
}

export const SMART_SUGGESTIONS: SmartSuggestion[] = [
  { label: "+ Drums", stemType: "drums", defaultTags: "drums, beat, rhythm" },
  { label: "+ Melody", stemType: "keyboard", defaultTags: "melody, piano, keys" },
  { label: "+ Vocals", stemType: "vocals", defaultTags: "vocals, singing, voice" },
  { label: "+ Bass", stemType: "bass", defaultTags: "bass, low-end, groove" },
  { label: "+ Guitar", stemType: "guitar", defaultTags: "guitar, acoustic, strumming" },
  { label: "+ Synth", stemType: "synth", defaultTags: "synth, electronic, pad" },
];
