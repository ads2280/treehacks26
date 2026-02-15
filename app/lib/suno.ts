import {
  SUNO_API_BASE,
  SunoGenerateRequest,
  SunoGenerateResponse,
  SunoClip,
  SunoStemResponse,
} from "@/lib/layertune-types";

function getApiKey(): string {
  const key = process.env.SUNO_API_KEY;
  if (!key) throw new Error("SUNO_API_KEY not configured");
  return key;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);

    if (res.ok) return res;

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = res.headers.get("retry-after");
      const backoffMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(
            1000 * Math.pow(2, attempt) + Math.random() * 1000,
            30000
          );
      console.warn(
        `Suno rate limited (429), retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${maxRetries})`
      );
      await delay(backoffMs);
      continue;
    }

    if (res.status >= 500 && attempt < maxRetries) {
      const backoffMs = Math.min(
        1000 * Math.pow(2, attempt) + Math.random() * 500,
        15000
      );
      console.warn(
        `Suno server error (${res.status}), retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${maxRetries})`
      );
      await delay(backoffMs);
      continue;
    }

    const text = await res.text();
    throw new Error(`Suno request failed (${res.status}): ${text}`);
  }

  throw new Error("Suno request failed: max retries exceeded");
}

export async function generateTrack(
  params: SunoGenerateRequest
): Promise<SunoGenerateResponse> {
  const res = await fetchWithRetry(`${SUNO_API_BASE}/generate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params),
  });
  const data = await res.json();

  // Normalize flat clip response to { clips: [...] }
  if (data && !data.clips) {
    return {
      id: data.id,
      clips: [data],
      metadata: data.metadata || {},
      created_at: data.created_at,
    };
  }
  return data;
}

export async function getClips(ids: string[]): Promise<SunoClip[]> {
  const res = await fetchWithRetry(
    `${SUNO_API_BASE}/clips?ids=${ids.join(",")}`,
    { headers: headers() }
  );
  return res.json();
}

export async function stemClip(
  clipId: string
): Promise<SunoStemResponse> {
  const res = await fetchWithRetry(`${SUNO_API_BASE}/stem`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ clip_id: clipId }),
  });
  const data = await res.json();

  // Normalize flat or array response to { clips: [...] }
  if (data && !data.clips) {
    if (Array.isArray(data)) {
      return { id: clipId, clips: data };
    }
    return { id: data.id || clipId, clips: [data] };
  }
  return data;
}

export async function pollClipsUntilDone(
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
      throw new Error(
        `Polling timed out after ${timeoutMs / 1000}s for clips: ${ids.join(", ")}`
      );
    }

    await delay(intervalMs);

    const clips = await getClips(ids);

    if (!Array.isArray(clips) || clips.length === 0) {
      continue;
    }

    const errorClip = clips.find((c) => c.status === "error");
    if (errorClip) {
      throw new Error(`Clip ${errorClip.id} failed with error status`);
    }

    if (clips.every((c) => doneStatuses.includes(c.status))) {
      return clips;
    }
  }
}
