export interface HeyGenVideoInput {
  character:
    | { type: "talking_photo"; talking_photo_id: string }
    | { type: "avatar"; avatar_id: string };
  voice:
    | { type: "audio"; audio_asset_id: string }
    | { type: "text"; voice_id: string; input_text: string }
    | { type: "silence"; duration: number };
  background?:
    | { type: "image"; image_asset_id: string }
    | { type: "video"; video_asset_id: string; play_style: string }
    | { type: "color"; value: string };
  text?: {
    type: "text";
    text: string;
    font_family?: string;
    font_size?: number;
    line_height: number;
    color?: string;
    position?: { x: number; y: number };
    text_align?: string;
    width?: number;
  };
}

// v1 endpoints use { code: 100, data, message }
interface HeyGenV1Response<T> {
  code: number;
  data: T;
  message: string;
}

// v2 endpoints use { error: null | { code, message }, data }
interface HeyGenV2Response<T> {
  error: { code: string; message: string } | null;
  data: T;
}

const HEYGEN_API_BASE = "https://api.heygen.com";
const HEYGEN_UPLOAD_BASE = "https://upload.heygen.com";

function getApiKey(): string {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HEYGEN_API_KEY not configured");
  return key;
}

function jsonHeaders(): HeadersInit {
  return {
    "X-Api-Key": getApiKey(),
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
        `HeyGen rate limited (429), retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${maxRetries})`
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
        `HeyGen server error (${res.status}), retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${maxRetries})`
      );
      await delay(backoffMs);
      continue;
    }

    const text = await res.text();
    throw new Error(`HeyGen request failed (${res.status}): ${text}`);
  }

  throw new Error("HeyGen request failed: max retries exceeded");
}

/** Unwrap v1 `{ code: 100, data, message }` envelope. */
function unwrapV1<T>(response: HeyGenV1Response<T>): T {
  if (response.code !== 100) {
    throw new Error(
      `HeyGen API error (code ${response.code}): ${response.message}`
    );
  }
  return response.data;
}

/** Unwrap v2 `{ error, data }` envelope. */
function unwrapV2<T>(response: HeyGenV2Response<T>): T {
  if (response.error) {
    throw new Error(
      `HeyGen API error (${response.error.code}): ${response.error.message}`
    );
  }
  return response.data;
}

export async function uploadAsset(
  fileBuffer: Buffer,
  contentType: string
): Promise<{ id: string; image_key?: string; url: string }> {
  const res = await fetchWithRetry(
    `${HEYGEN_UPLOAD_BASE}/v1/asset`,
    {
      method: "POST",
      headers: {
        "X-Api-Key": getApiKey(),
        "Content-Type": contentType,
      },
      body: new Uint8Array(fileBuffer),
    }
  );

  const json: HeyGenV1Response<{
    id: string;
    image_key?: string;
    url: string;
  }> = await res.json();
  return unwrapV1(json);
}

/**
 * Upload a photo and register it as a talking photo via the v2 photo avatar flow:
 * 1. Upload image to /v1/asset → get image_key
 * 2. Create avatar group with that image_key → registers as talking photo
 * 3. List avatars → find the new talking_photo_id
 */
export async function uploadTalkingPhoto(
  fileBuffer: Buffer,
  contentType: string
): Promise<{ talking_photo_id: string; talking_photo_url: string }> {
  // Step 1: Upload image as asset
  const asset = await uploadAsset(fileBuffer, contentType);
  console.log("[heygen/talking_photo] Asset uploaded, image_key:", asset.image_key);

  if (!asset.image_key) {
    throw new Error("Asset upload succeeded but no image_key returned");
  }

  // Step 2: Create avatar group from the uploaded image
  const groupName = `selfie_${Date.now()}`;
  const groupRes = await fetchWithRetry(
    `${HEYGEN_API_BASE}/v2/photo_avatar/avatar_group/create`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ name: groupName, image_key: asset.image_key }),
    }
  );

  const groupJson = await groupRes.json();
  console.log("[heygen/talking_photo] Group create response:", JSON.stringify(groupJson));
  const groupData = unwrapV2(groupJson as HeyGenV2Response<{ id: string }>);
  console.log("[heygen/talking_photo] Group created, id:", groupData.id);

  // Step 3: Poll /v2/avatars until the talking photo appears and is no longer "pending"
  const maxWaitMs = 90_000; // 90s max
  const pollIntervalMs = 5_000;
  const pollStart = Date.now();
  let talkingPhoto: { talking_photo_id: string; talking_photo_name: string; preview_image_url: string } | null = null;

  while (Date.now() - pollStart < maxWaitMs) {
    await delay(pollIntervalMs);

    const listRes = await fetchWithRetry(
      `${HEYGEN_API_BASE}/v2/avatars`,
      { method: "GET", headers: { "X-Api-Key": getApiKey() } }
    );

    const listJson = await listRes.json();
    const listData = unwrapV2(listJson as HeyGenV2Response<{
      talking_photos: {
        talking_photo_id: string;
        talking_photo_name: string;
        preview_image_url: string;
        status?: string;
      }[];
    }>);

    console.log("[heygen/talking_photo] Found", listData.talking_photos.length, "talking photos, looking for:", groupName);

    const match = listData.talking_photos.find(tp => tp.talking_photo_name === groupName);
    if (match) {
      const status = (match as { status?: string }).status;
      console.log("[heygen/talking_photo] Found match, status:", status || "unknown");

      // If status is present and still "pending", keep polling
      if (status && status === "pending") {
        console.log("[heygen/talking_photo] Still pending, waiting...");
        continue;
      }

      // Ready (status is "active", "success", undefined, or anything non-pending)
      talkingPhoto = match;
      break;
    }
  }

  if (!talkingPhoto) {
    // Fallback: use the most recent talking photo
    const fallbackRes = await fetchWithRetry(
      `${HEYGEN_API_BASE}/v2/avatars`,
      { method: "GET", headers: { "X-Api-Key": getApiKey() } }
    );
    const fallbackJson = await fallbackRes.json();
    const fallbackData = unwrapV2(fallbackJson as HeyGenV2Response<{
      talking_photos: { talking_photo_id: string; talking_photo_name: string; preview_image_url: string }[];
    }>);
    talkingPhoto = fallbackData.talking_photos[fallbackData.talking_photos.length - 1];

    if (!talkingPhoto) {
      throw new Error("No talking photos found after avatar group creation (timed out after 90s)");
    }
    console.warn("[heygen/talking_photo] Name match not found after polling, using most recent:", talkingPhoto.talking_photo_id);
  }

  console.log("[heygen/talking_photo] Using talking_photo_id:", talkingPhoto.talking_photo_id);

  return {
    talking_photo_id: talkingPhoto.talking_photo_id,
    talking_photo_url: talkingPhoto.preview_image_url,
  };
}

export async function generateVideo(
  videoInputs: HeyGenVideoInput[]
): Promise<{ video_id: string }> {
  const res = await fetchWithRetry(
    `${HEYGEN_API_BASE}/v2/video/generate`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ video_inputs: videoInputs }),
    }
  );

  const json: HeyGenV2Response<{ video_id: string }> = await res.json();
  return unwrapV2(json);
}

export async function getVideoStatus(
  videoId: string
): Promise<{
  status: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: { code?: string; message?: string; detail?: string };
}> {
  const res = await fetchWithRetry(
    `${HEYGEN_API_BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
    {
      method: "GET",
      headers: {
        "X-Api-Key": getApiKey(),
      },
    }
  );

  const json: HeyGenV1Response<{
    status: string;
    video_url?: string;
    thumbnail_url?: string;
    duration?: number;
    error?: { code?: string; message?: string; detail?: string };
  }> = await res.json();
  const data = unwrapV1(json);
  console.log(`[heygen/status] video_id=${videoId} status=${data.status}`, data.error ? `error=${JSON.stringify(data.error)}` : "");
  return data;
}

export async function createStreamingToken(): Promise<{ token: string }> {
  const res = await fetchWithRetry(
    `${HEYGEN_API_BASE}/v1/streaming.create_token`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({}),
    }
  );

  const json = await res.json();

  // Handle both v1 ({ code: 100, data }) and v2 ({ error, data }) response formats
  if (json.code === 100 && json.data) {
    return json.data;
  }
  if (!json.error && json.data) {
    return json.data;
  }

  const errMsg = json.error?.message || json.message || "Streaming not available";
  throw new Error(`HeyGen streaming token failed: ${errMsg}`);
}
