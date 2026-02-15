export type StemType =
  | 'vocals'
  | 'backing_vocals'
  | 'drums'
  | 'bass'
  | 'guitar'
  | 'keyboard'
  | 'percussion'
  | 'strings'
  | 'synth'
  | 'fx'
  | 'brass'
  | 'woodwinds';

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
  createdAt: string;
}

export interface CachedStem {
  stemType: StemType;
  audioUrl: string;
  sunoClipId: string;
  fromClipId: string;
  createdAt: string;
}

export type ABState = 'none' | 'comparing' | 'a_selected' | 'b_selected';

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

export type GenerationJobStatus =
  | 'pending'
  | 'submitted'
  | 'queued'
  | 'streaming'
  | 'complete'
  | 'error';

export interface GenerationJob {
  id: string;
  projectId: string;
  layerId: string | null;
  sunoClipId: string | null;
  status: GenerationJobStatus;
  params: SunoGenerateRequest;
  result: SunoClip | null;
  error: string | null;
  createdAt: string;
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
  status: 'submitted' | 'queued' | 'streaming' | 'complete' | 'error';
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

export interface SunoClipsResponse {
  [key: string]: SunoClip;
}

export interface SunoStemRequest {
  clip_id: string;
}

export interface SunoStemResponse {
  id: string;
  clips: SunoClip[];
}
