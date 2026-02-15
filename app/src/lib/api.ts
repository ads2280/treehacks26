import {
  SunoGenerateRequest,
  SunoGenerateResponse,
  SunoClip,
  SunoStemResponse,
} from './types';
import { STEM_NAME_TO_TYPE } from './constants';
import type { StemType } from './types';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const errorMsg = body.error || `Request failed: ${res.status}`;
    // Preserve rate-limit info for callers
    if (res.status === 429) {
      throw new Error(`Rate limited: ${errorMsg}`);
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export function generate(params: SunoGenerateRequest): Promise<SunoGenerateResponse> {
  return fetchJSON('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export function pollClips(ids: string[]): Promise<SunoClip[]> {
  return fetchJSON(`/api/clips?ids=${ids.join(',')}`);
}

export function stem(clipId: string): Promise<SunoStemResponse> {
  return fetchJSON('/api/stem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clip_id: clipId }),
  });
}

export function proxyAudioUrl(url: string): string {
  return `/api/audio-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Poll clips via the Next.js API proxy until all reach a terminal status.
 *
 * @param ids - Clip IDs to poll
 * @param acceptStreaming - Whether 'streaming' counts as done (true for main clips, false for stems)
 * @param intervalMs - Polling interval
 * @param timeoutMs - Max total wait time
 */
export async function pollUntilDone(
  ids: string[],
  {
    acceptStreaming = true,
    intervalMs = 5000,
    timeoutMs = 300000,
  } = {}
): Promise<SunoClip[]> {
  const startTime = Date.now();
  const doneStatuses = acceptStreaming ? ['complete', 'streaming'] : ['complete'];

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Polling timed out after ${timeoutMs / 1000}s`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));

    const clips = await pollClips(ids);

    if (!Array.isArray(clips) || clips.length === 0) {
      continue;
    }

    const errorClip = clips.find((c) => c.status === 'error');
    if (errorClip) {
      throw new Error(`Generation failed for clip ${errorClip.id}`);
    }

    const allDone = clips.every((c) => doneStatuses.includes(c.status));
    if (allDone) {
      return clips;
    }
  }
}

/**
 * Map Suno stem clip title to our StemType.
 * Suno titles are formatted as "Song Name - Stem Name" (e.g., "Rainy Reverie - Vocals").
 * Returns undefined if the title doesn't match any known stem.
 */
export function stemTitleToType(title: string): StemType | undefined {
  // Try direct match first
  const direct = STEM_NAME_TO_TYPE[title] as StemType | undefined;
  if (direct) return direct;

  // Extract stem name after " - " (Suno format: "Song Title - Stem Name")
  const dashIdx = title.lastIndexOf(' - ');
  if (dashIdx !== -1) {
    const stemPart = title.slice(dashIdx + 3);
    return STEM_NAME_TO_TYPE[stemPart] as StemType | undefined;
  }

  return undefined;
}
