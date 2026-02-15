import {
  SunoGenerateRequest,
  SunoGenerateResponse,
  SunoClip,
  SunoStemResponse,
  STEM_NAME_TO_TYPE,
} from "@/lib/layertune-types";
import type { StemType, DemucsClientResponse } from "@/lib/layertune-types";

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

    const clips = await pollClips(ids);

    if (Array.isArray(clips) && clips.length > 0) {
      const errorClip = clips.find((c) => c.status === "error");
      if (errorClip) {
        throw new Error(`Generation failed for clip ${errorClip.id}`);
      }

      if (clips.every((c) => doneStatuses.includes(c.status))) {
        return clips;
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
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

    const clips = await pollClips(ids);
    if (Array.isArray(clips)) {
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

    if (completed.size < ids.length) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  return Array.from(completed.values());
}

/**
 * Poll stems until the target stem type is ready — resolves immediately
 * when the matching stem completes instead of waiting for all 12.
 */
export async function pollForTargetStem(
  ids: string[],
  targetStemType: StemType,
  {
    intervalMs = 5000,
    timeoutMs = 300000,
  } = {}
): Promise<SunoClip> {
  const startTime = Date.now();
  let pollCount = 0;

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Stem polling timed out after ${timeoutMs / 1000}s waiting for "${targetStemType}"`);
    }

    pollCount++;

    const clips = await pollClips(ids);
    if (Array.isArray(clips)) {
      // Check for target stem completion FIRST — unrelated stem errors
      // should not abort polling when the target stem may still succeed.
      const resolvedTypes: string[] = [];
      for (const clip of clips) {
        if (clip.status === "complete" && clip.audio_url) {
          const stemType = stemTitleToType(clip.title);
          if (stemType) resolvedTypes.push(stemType);
          if (stemType === targetStemType) {
            return clip;
          }
        }
      }

      // Only throw if the target stem itself has errored
      for (const clip of clips) {
        const stemType = stemTitleToType(clip.title);
        if (stemType === targetStemType && clip.status === "error") {
          throw new Error(`Stem "${targetStemType}" failed (clip ${clip.id})`);
        }
      }

      // Early exit: if ALL stems are done (complete or error) but target wasn't found,
      // don't wait for timeout — fail immediately with available stem types
      const allDone = clips.every((c) => c.status === "complete" || c.status === "error");
      if (allDone && clips.length > 0) {
        const available = resolvedTypes.join(", ") || "none matched";
        throw new Error(
          `All ${clips.length} stems finished but "${targetStemType}" not found. Available: ${available}`
        );
      }

    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
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

export function stemDemucs(
  audioUrl: string,
  clipId: string
): Promise<DemucsClientResponse> {
  return fetchJSON("/api/stem-demucs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_url: audioUrl, clip_id: clipId }),
  });
}

// --- HeyGen & Video ---

export async function uploadToHeyGen(
  file: Blob,
  contentType: string,
  type?: "talking_photo"
): Promise<{ id?: string; image_key?: string; url?: string; talking_photo_id?: string; talking_photo_url?: string }> {
  const url = type
    ? `/api/heygen/upload?type=${type}`
    : "/api/heygen/upload";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export function generateHeyGenVideo(params: {
  video_inputs: unknown[];
}): Promise<{ video_id: string }> {
  return fetchJSON("/api/heygen/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function pollHeyGenVideoStatus(
  videoId: string
): Promise<{ status: string; video_url?: string; thumbnail_url?: string; duration?: number; error?: { code?: string; message?: string; detail?: string } }> {
  return fetchJSON(`/api/heygen/status?video_id=${encodeURIComponent(videoId)}`);
}

export async function pollHeyGenUntilDone(
  videoId: string,
  { intervalMs = 10000, timeoutMs = 600000 } = {}
): Promise<{ status: string; video_url: string; thumbnail_url?: string; duration?: number }> {
  const startTime = Date.now();
  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error("Video generation timed out after 10 minutes");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    const result = await pollHeyGenVideoStatus(videoId);
    if (result.status === "completed" && result.video_url) {
      return result as { status: string; video_url: string; thumbnail_url?: string; duration?: number };
    }
    if (result.status === "failed") {
      const errDetail = result.error
        ? ` — ${result.error.message || result.error.detail || JSON.stringify(result.error)}`
        : "";
      throw new Error(`Video generation failed${errDetail}`);
    }
  }
}

export function getStreamingToken(): Promise<{ token: string }> {
  return fetchJSON("/api/heygen/streaming-token", { method: "POST" });
}

export function generateBackgrounds(params: {
  sections: { tag: string; lines: string[] }[];
  vibePrompt: string;
  theme: string | null;
  tags: string;
}): Promise<{ sections: { tag: string; lines: string[]; backgroundUrl: string }[] }> {
  return fetchJSON("/api/generate-backgrounds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function uploadVideoToBlob(
  videoBlob: Blob,
  filename: string
): Promise<{ url: string }> {
  const res = await fetch("/api/video/upload", {
    method: "POST",
    headers: { "Content-Type": "video/mp4" },
    body: videoBlob,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Video upload failed: ${res.status}`);
  }
  return res.json();
}
