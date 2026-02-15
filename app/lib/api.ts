import {
  SunoGenerateRequest,
  SunoGenerateResponse,
  SunoClip,
  SunoStemResponse,
  STEM_NAME_TO_TYPE,
} from "@/lib/layertune-types";
import type { StemType } from "@/lib/layertune-types";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const errorMsg = body.error || `Request failed: ${res.status}`;
    if (res.status === 429) {
      throw new Error(`Rate limited: ${errorMsg}`);
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export function generate(
  params: SunoGenerateRequest
): Promise<SunoGenerateResponse> {
  return fetchJSON("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function pollClips(ids: string[]): Promise<SunoClip[]> {
  return fetchJSON(`/api/clips?ids=${ids.join(",")}`);
}

export function stem(clipId: string): Promise<SunoStemResponse> {
  return fetchJSON("/api/stem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clip_id: clipId }),
  });
}

export function proxyAudioUrl(url: string): string {
  return `/api/audio-proxy?url=${encodeURIComponent(url)}`;
}

export async function pollUntilDone(
  ids: string[],
  {
    acceptStreaming = true,
    intervalMs = 5000,
    timeoutMs = 300000,
  } = {}
): Promise<SunoClip[]> {
  const startTime = Date.now();
  const doneStatuses = acceptStreaming
    ? ["complete", "streaming"]
    : ["complete"];

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Polling timed out after ${timeoutMs / 1000}s`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));

    const clips = await pollClips(ids);

    if (!Array.isArray(clips) || clips.length === 0) {
      continue;
    }

    const errorClip = clips.find((c) => c.status === "error");
    if (errorClip) {
      throw new Error(`Generation failed for clip ${errorClip.id}`);
    }

    if (clips.every((c) => doneStatuses.includes(c.status))) {
      return clips;
    }
  }
}

/**
 * Poll stems progressively — calls `onStemReady` as each stem completes
 * instead of waiting for all 12 to finish.
 */
export async function pollStemsProgressively(
  ids: string[],
  onStemReady: (clip: SunoClip) => void,
  {
    intervalMs = 5000,
    timeoutMs = 300000,
  } = {}
): Promise<SunoClip[]> {
  const startTime = Date.now();
  const completed = new Map<string, SunoClip>();

  while (completed.size < ids.length) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Stem polling timed out after ${timeoutMs / 1000}s`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));

    const clips = await pollClips(ids);
    if (!Array.isArray(clips)) continue;

    const errorClip = clips.find((c) => c.status === "error");
    if (errorClip) {
      throw new Error(`Stem ${errorClip.id} failed`);
    }

    for (const clip of clips) {
      if (clip.status === "complete" && !completed.has(clip.id) && clip.audio_url) {
        completed.set(clip.id, clip);
        onStemReady(clip);
      }
    }
  }

  return Array.from(completed.values());
}

export function stemTitleToType(title: string): StemType | undefined {
  const direct = STEM_NAME_TO_TYPE[title];
  if (direct) return direct;

  const dashIdx = title.lastIndexOf(" - ");
  if (dashIdx !== -1) {
    return STEM_NAME_TO_TYPE[title.slice(dashIdx + 3)];
  }

  return undefined;
}
