# Specification: Music Video Generation with HeyGen Avatar IV

> To implement this spec, clear context and run:
> `/duy-workflow:execute docs/specs/music-video-generation.spec.md`

## Context

ProduceThing lets users compose music layer-by-layer through natural language. After composing, users can export audio — but there's no video output. HeyGen (a TreeHacks 2026 sponsor) offers an Avatar IV API that turns a single photo into a lip-synced video with custom audio. This feature adds a "Create Music Video" flow: take a selfie, pick a style, and generate a full music video where YOU are the artist singing your own song. Generated videos are stored in Vercel Blob for shareable public URLs.

**Target prizes:** HeyGen Avatar API (AirPods Pro 3 + interviews), Suno Best Musical Hack, Vercel Best Deployed, Anthropic Human Flourishing, Greylock Best Agent.

## Goal

Add a music video generation page (`/studio/video`) that takes the user's selfie + composed song and generates a multi-scene HeyGen Avatar IV video with DALL-E backgrounds and lyrics overlay per song section. Videos stored in Vercel Blob with shareable URLs.

## Requirements

1. **[REQ-1] HeyGen server-side client** — `lib/heygen.ts`
   - Upload assets (photo, audio, images) to `POST https://upload.heygen.com/v1/asset`
   - Generate multi-scene video via `POST https://api.heygen.com/v2/video/generate`
   - Poll video status via `GET https://api.heygen.com/v1/video_status.get`
   - Create streaming avatar token via `POST https://api.heygen.com/v1/streaming.create_token`
   - Follow `lib/suno.ts` patterns: `getApiKey()`, `fetchWithRetry()` (exponential backoff, 429/5xx handling), response normalization
   - HeyGen wraps responses in `{ code: 100, data: {...}, message: "..." }` — normalize to unwrap
   - Env var: `HEYGEN_API_KEY`
   - Acceptance: Can upload a JPEG and get back an `image_key`; can submit a video generation request and get a `video_id`

2. **[REQ-2] HeyGen API proxy routes** — 4 thin proxy routes
   - `app/api/heygen/upload/route.ts` — POST, raw binary body, 10MB limit validation, delegates to `lib/heygen.ts:uploadAsset()`
   - `app/api/heygen/generate/route.ts` — POST, JSON body with `videoInputs` array (1-50), delegates to `generateVideo()`
   - `app/api/heygen/status/route.ts` — GET with `?video_id=`, delegates to `getVideoStatus()`
   - `app/api/heygen/streaming-token/route.ts` — POST, delegates to `createStreamingToken()`
   - Follow existing route patterns: input validation, error extraction with status code parsing, `console.error` logging
   - Acceptance: All 4 routes respond correctly to valid/invalid requests

3. **[REQ-3] Background generation route** — `app/api/generate-backgrounds/route.ts`
   - POST, accepts `{ sections: LyricsSection[], vibePrompt, theme, tags }`
   - Step 1: GPT (gpt-4o-mini) generates a visual scene description per section from lyrics content + theme
   - Step 2: DALL-E (gpt-image-1) generates 1792x1024 background image per section (parallel, low quality for speed)
   - Returns sections with `backgroundUrl` (base64 data URL) populated
   - Uses existing `OPENAI_API_KEY` env var, requires `openai` npm package (NOT `@ai-sdk/openai`)
   - maxDuration: 120s (multiple DALL-E calls)
   - Acceptance: Given 4 lyric sections + "neon city" theme, returns 4 sections with base64 image URLs

4. **[REQ-4] Lyrics parser** — `lib/lyrics-parser.ts`
   - `parseLyricsIntoSections(text)` → `LyricsSection[]` — splits on `[Verse]`, `[Chorus]`, etc. using existing `isStructureTag()` from `lib/lyrics-utils.ts:17`
   - Lines before first tag go into "Intro" section
   - Cap at 10 scenes max; merge short adjacent sections if >10
   - `generateInstrumentalSections(durationSeconds, vibePrompt, tags)` → `LyricsSection[]` — creates time-based sections (~30s each) for instrumentals
   - Acceptance: Parsing "[Verse]\nLine 1\nLine 2\n[Chorus]\nHook line" returns 2 sections with correct tags and lines

5. **[REQ-5] Types, constants, and lyrics persistence** — modifications to `lib/layertune-types.ts` + `hooks/use-project.ts`
   - Add `lyrics?: string` field to `Project` interface (currently lyrics are ephemeral state in studio/page.tsx — they need to persist in localStorage so the video page can read them)
   - `VideoGenerationPhase`: "idle" | "parsing_lyrics" | "generating_backgrounds" | "uploading_assets" | "generating_video" | "polling" | "complete" | "error"
   - `LyricsSection`: { tag, lines[], scenePrompt?, backgroundUrl?, backgroundAssetId? }
   - `VideoStyleConfig`: { mode: "preset"|"custom"|"lyrics-driven"|"surprise", theme: VideoTheme|null, freeTextPrompt }
   - `VideoTheme`: "concert_stage" | "music_video" | "minimalist" | "retro_vhs" | "neon_city" with `VIDEO_THEME_LABELS` and `VIDEO_THEME_PROMPTS` (DALL-E prompt mappings)
   - `HeyGenUploadResponse`, `HeyGenVideoResponse`, `HeyGenVideoStatus` types
   - In `hooks/use-project.ts`: add `setLyrics(lyrics: string)` that persists to project
   - In `app/studio/page.tsx`: wire lyrics state to use `project.lyrics` instead of local `useState("")`
   - Acceptance: Types compile; lyrics persist across page navigation via localStorage

6. **[REQ-6] Client-side API wrappers** — additions to `lib/api.ts`
   - `uploadToHeyGen(file, contentType)`, `generateHeyGenVideo(params)`, `pollHeyGenVideoStatus(videoId)`, `pollHeyGenUntilDone(videoId, opts)`, `getStreamingToken()`, `generateBackgrounds(params)`, `uploadVideoToBlob(videoBlob, filename)`
   - Follow existing `fetchJSON<T>()` pattern at `lib/api.ts`
   - `pollHeyGenUntilDone`: 10s interval, 10min timeout, throws on "failed"
   - Acceptance: Client wrappers correctly call proxy routes and handle errors

7. **[REQ-7] Camera capture component** — `components/video/camera-capture.tsx`
   - Dynamic import (`ssr: false`) — uses `getUserMedia`
   - `facingMode: "user"` for selfie, 720x720 resolution
   - Capture button → draw video frame to canvas → `canvas.toBlob('image/jpeg', 0.9)` → `onCapture(blob)`
   - Fallback: if permission denied, show `<input type="file" accept="image/*" capture="user">`
   - Retake button to retry; live preview before capture
   - Acceptance: Can take a selfie on desktop webcam; falls back to file picker if camera blocked

8. **[REQ-8] Style selector component** — `components/video/style-selector.tsx`
   - Four mode cards/tabs: Theme Preset, Custom, Lyrics-Driven, Surprise Me
   - Theme Preset: grid of 5 theme cards with labels (Concert Stage, Music Video, Minimalist, Retro VHS, Neon City)
   - Custom: free-text textarea for describing desired video scene
   - Lyrics-Driven: shows parsed lyric sections as preview, each section gets auto-generated scene
   - Surprise Me: auto-picks theme + scene descriptions from vibePrompt + tags
   - "Generate Video" submit button
   - Acceptance: User can select a mode, configure it, and submit

9. **[REQ-9] Video generation overlay** — `components/video/video-generation-overlay.tsx`
   - Follow `components/studio/generation-overlay.tsx` pattern: animated waveform bars (`#c4f567`, `waveBar 1.2s ease-in-out infinite`), asymptotic progress (`1 - Math.exp(-elapsed / (estimate * 0.5))`), backdrop blur
   - 7 phases with descriptive messages (parsing → backgrounds → uploading → generating → polling → complete → error)
   - Step-based progress indicator showing which phase is active
   - 600ms exit animation on complete (same pattern as existing overlay lines 131-151)
   - Acceptance: Overlay shows during generation with correct phase transitions and matching visual style

10. **[REQ-10] Video result component** — `components/video/video-result.tsx`
    - `<video>` player with controls, poster thumbnail
    - Download MP4 button
    - Shareable URL (from Vercel Blob) with copy-to-clipboard button
    - Social share buttons: Twitter/X (intent URL with pre-filled text + video URL)
    - "Back to Studio" button
    - Acceptance: Can play the generated video, download it, copy share link, and share via Twitter

11. **[REQ-11] Video page orchestrator** — `app/studio/video/page.tsx`
    - Reads project from localStorage on mount (key: `"producething_project"` from `use-project.ts:6`)
    - Redirects to `/studio` if no project found
    - 4-step flow: "capture" → "style" → "generating" → "result"
    - Generation pipeline (in `handleStartGeneration`):
      1. Parse lyrics into sections (or generate instrumental sections if no lyrics)
      2. POST /api/generate-backgrounds → get DALL-E images per section
      3. Upload selfie photo to HeyGen → get `image_key`
      4. Upload song audio to HeyGen → get `audio_asset_id` (fetch audio from layer's proxyAudioUrl as Blob)
      5. Upload background images to HeyGen → get `image_asset_id` per section
      6. Build `video_inputs[]` array: each scene has character (talking_photo), voice (audio), background (image), text overlay (lyrics)
      7. POST /api/heygen/generate → get `video_id`
      8. Poll /api/heygen/status until "completed"
      9. Fetch completed video → upload to Vercel Blob → get public URL
    - Error handling: catch at each step, set error phase, show retry option
    - Dynamic imports for CameraCapture and StreamingPreview
    - Import `useRouter` from `next/navigation` (not currently imported in studio codebase)
    - Acceptance: Full end-to-end flow from selfie → style → generation → video playback + shareable URL

12. **[REQ-12] Studio header modification** — `components/studio/studio-header.tsx`
    - Add "Music Video" button between Lyrics toggle and Export menu (after line 101)
    - Only shows when `layers.length > 0`
    - Uses `Video` icon from lucide-react
    - New prop: `onCreateVideo?: () => void`
    - In `studio/page.tsx`: add `import { useRouter } from "next/navigation"`, wire `onCreateVideo={() => router.push("/studio/video")}`
    - Acceptance: Button visible in studio with layers, navigates to /studio/video

13. **[REQ-13] Streaming avatar preview** — `components/video/streaming-preview.tsx` (nice-to-have, do last)
    - Dynamic import (`ssr: false`) — uses `@heygen/streaming-avatar` + `livekit-client`
    - Fetch token → create session → attach to `<video>` element
    - Shows during "polling" phase as a live avatar performing
    - Graceful degradation: if session fails, `.catch()` swallows error, component renders nothing (same pattern as Demucs fallback at `studio/page.tsx:278`)
    - Always render the `<video>` ref container (never conditionally render — Bug #5 pattern)
    - Acceptance: Streaming avatar appears during video generation; gracefully hides on failure

14. **[REQ-14] Vercel Blob video storage** — `app/api/video/upload/route.ts`
    - POST route that receives video Blob, uploads to Vercel Blob via `@vercel/blob` `put()`
    - Returns public URL for the stored video
    - Client fetches HeyGen's completed video URL → sends to this route → gets permanent shareable URL
    - Acceptance: Video uploaded to Blob, public URL accessible and playable

15. **[REQ-15] Vercel config + dependencies**
    - Add HeyGen routes, backgrounds route, and video upload route to `app/vercel.json` with appropriate `maxDuration`
    - Install: `@heygen/streaming-avatar`, `livekit-client`, `openai`, `@vercel/blob`
    - Add `BLOB_READ_WRITE_TOKEN` to env vars (Vercel provides this automatically when Blob is enabled)
    - Acceptance: `npm run build` succeeds; Vercel deploy config valid

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Separate page vs inline | `/studio/video` page | Keeps 700-line studio page manageable; avoids loading video deps during music composition |
| State management | Local useState on video page; lyrics persisted in Project | Video flow is linear one-shot; lyrics need to survive navigation |
| Photo capture | getUserMedia with file upload fallback | Best UX for "take selfie" flow; graceful degradation for permission issues |
| Background generation | DALL-E (gpt-image-1) via existing OpenAI key | No new API key needed; cheap ($0.02-0.19/image); good quality |
| HeyGen video endpoint | v2/video/generate (multi-scene) | Supports up to 50 scenes with per-scene backgrounds, text overlay, and audio |
| Audio handling | Full song upload | User wants complete music video, not clips |
| Lyrics overlay | Static text per scene (not word-by-word karaoke) | HeyGen text overlay is static per scene; true karaoke would need post-processing |
| Video storage | Vercel Blob | Already on Vercel; gives public URLs for sharing; strengthens Vercel prize submission |
| Streaming preview | Nice-to-have with graceful degradation | Prize mentions "real-time streaming"; adds wow factor but complex |
| Zoom API | Not used | Research showed Zoom has no video generation/creative APIs |
| Lyrics persistence | Add `lyrics` field to Project interface | Lyrics were ephemeral React state — video page needs them via localStorage |

## Completion Criteria

- [x] All 15 REQs implemented with passing tests
- [x] Build + lint clean (`npm run build` succeeds)
- [ ] End-to-end: selfie → style selection → backgrounds generate → video generates → playback works (manual test)
- [ ] Video stored in Vercel Blob with shareable public URL (manual test)
- [x] Camera fallback works when permission denied (file upload fallback implemented)
- [x] Instrumental mode works (no lyrics) (generateInstrumentalSections implemented)
- [x] Streaming preview gracefully degrades on failure (.catch() swallow pattern)
- [ ] Vercel deployment succeeds with new routes (requires deploy)

## Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Camera permission denied | Show file upload input as fallback |
| Audio > 10MB | Show error with guidance ("Your song is too long for video generation") |
| HeyGen rate limit (429) | Retry with exponential backoff (fetchWithRetry) |
| Streaming avatar session fails | Hide preview, show static progress overlay |
| No lyrics (instrumental) | Skip text overlay; generate backgrounds from genre/mood tags |
| Photo with no clear face | HeyGen rejects → show error: "Please use a clear, front-facing photo" |
| DALL-E rate limits | Generate images sequentially with small delays |
| No project in localStorage | Redirect to /studio with error toast |
| HeyGen video generation fails | Show error with retry button |
| Very long lyrics (many sections) | Cap at 10 scenes; merge short sections |
| Vercel Blob upload fails | Fall back to direct HeyGen video URL (temporary, expires) |

## Out of Scope

- A/B video comparison / regeneration (one-shot only)
- Word-by-word karaoke animation (static lyrics per scene)
- Zoom API integration (no relevant creative APIs)
- Midjourney backgrounds (no public API access)
- Video editing / trimming after generation
- Multiple avatar poses per scene
- Database persistence of video state
- Open Graph meta tags for rich social previews (future enhancement)

## Technical Context

### Key Files to Modify
- `app/lib/layertune-types.ts` — Add video types + `lyrics` field to Project (REQ-5)
- `app/hooks/use-project.ts` — Add `setLyrics()` method (REQ-5)
- `app/app/studio/page.tsx` — Wire lyrics to project state + add `useRouter` + `onCreateVideo` (REQ-5, REQ-12)
- `app/lib/api.ts` — Add client-side HeyGen + background + blob wrappers (REQ-6)
- `app/components/studio/studio-header.tsx` — Add "Music Video" button (REQ-12)
- `app/vercel.json` — Add maxDuration for new routes (REQ-15)

### Key Files to Create
- `app/lib/heygen.ts` — Server-side HeyGen client (REQ-1)
- `app/lib/lyrics-parser.ts` — Lyrics section parser (REQ-4)
- `app/app/api/heygen/upload/route.ts` — Upload proxy (REQ-2)
- `app/app/api/heygen/generate/route.ts` — Generate proxy (REQ-2)
- `app/app/api/heygen/status/route.ts` — Status proxy (REQ-2)
- `app/app/api/heygen/streaming-token/route.ts` — Streaming token proxy (REQ-2)
- `app/app/api/generate-backgrounds/route.ts` — DALL-E background gen (REQ-3)
- `app/app/api/video/upload/route.ts` — Vercel Blob upload (REQ-14)
- `app/components/video/camera-capture.tsx` — Selfie capture (REQ-7)
- `app/components/video/style-selector.tsx` — Style picker (REQ-8)
- `app/components/video/video-generation-overlay.tsx` — Progress overlay (REQ-9)
- `app/components/video/video-result.tsx` — Result player + share (REQ-10)
- `app/components/video/streaming-preview.tsx` — Streaming avatar (REQ-13)
- `app/app/studio/video/page.tsx` — Video page orchestrator (REQ-11)

### Existing Code to Reuse
- `lib/lyrics-utils.ts:15-18` — `STRUCTURE_TAG_RE` and `isStructureTag()` for lyrics parsing
- `lib/suno.ts` — `fetchWithRetry()` pattern (exponential backoff, 429/5xx handling)
- `lib/api.ts` — `fetchJSON<T>()` client wrapper pattern
- `components/studio/generation-overlay.tsx` — Animation + progress patterns for video overlay
- `lib/audio-utils.ts` — `downloadBlob()`, `downloadUrl()` for video download
- `hooks/use-project.ts:6` — `STORAGE_KEY = "producething_project"` for localStorage read

### Patterns to Follow
- **API routes**: Thin proxies delegating to `lib/` (pattern from `app/api/generate/route.ts`)
- **Server client**: `getApiKey()` + `fetchWithRetry()` + response normalization (pattern from `lib/suno.ts`)
- **Client wrappers**: `fetchJSON<T>()` (pattern from `lib/api.ts`)
- **Dynamic imports**: `dynamic(() => import(...).then(m => m.Component), { ssr: false })` — no loading component (pattern from `studio/page.tsx:24-27`)
- **Lyrics parsing**: Reuse `isStructureTag()` from `lib/lyrics-utils.ts:17`
- **Progress overlay**: Same `#c4f567` color, `waveBar` animation, asymptotic progress formula (from `generation-overlay.tsx:37-81`)
- **Graceful degradation**: `.catch()` swallow pattern (from Demucs fallback in `studio/page.tsx:278`)
- **Never conditionally render ref containers** (Bug #5 lesson)
- **Error extraction**: Parse HTTP status from error message (pattern from all existing routes)

### HeyGen API Reference
- Upload: `POST https://upload.heygen.com/v1/asset` — `X-Api-Key` header, raw binary body, `Content-Type` header, 10MB limit. Returns `{ code: 100, data: { id, image_key, url } }`
- Generate: `POST https://api.heygen.com/v2/video/generate` — `video_inputs[]` (1-50 scenes), each with `character` + `voice` + `background` + optional `text`. Returns `{ data: { video_id } }`
- Status: `GET https://api.heygen.com/v1/video_status.get?video_id=X` — Returns `{ data: { status, video_url, thumbnail_url, duration } }`. Statuses: "pending" | "processing" | "completed" | "failed"
- Streaming token: `POST https://api.heygen.com/v1/streaming.create_token` — Returns `{ data: { token } }`
- Character types: `talking_photo` (with `talking_photo_id`) or `avatar` (with `avatar_id`)
- Voice types: `audio` (with `audio_asset_id`), `text` (with `voice_id` + `input_text`), `silence` (with `duration`)
- Background types: `image` (with `image_asset_id`), `video` (with `video_asset_id`, `play_style`), `color` (with `value` hex)
- Text overlay: `{ type: "text", text, font_family, font_size, color, position: {x, y}, text_align }`

### Dependencies to Install
```bash
cd app && npm install @heygen/streaming-avatar livekit-client openai @vercel/blob
```

### Environment Variables
```
HEYGEN_API_KEY=<from HeyGen booth at TreeHacks>
BLOB_READ_WRITE_TOKEN=<auto-provided by Vercel when Blob storage is enabled>
# Already existing:
OPENAI_API_KEY=<for DALL-E background generation>
```

## Execution Strategy

**Mode:** Agent team (3 parallel groups)

| Group | REQs | Layer | Key Files |
|-------|------|-------|-----------|
| 1: API Layer | REQ-1, REQ-2, REQ-3, REQ-14 | Server-side | `lib/heygen.ts`, `api/heygen/*/route.ts`, `api/generate-backgrounds/route.ts`, `api/video/upload/route.ts` |
| 2: Logic + Types Layer | REQ-4, REQ-5, REQ-6, REQ-15 | Shared logic | `lib/lyrics-parser.ts`, `lib/layertune-types.ts`, `lib/api.ts`, `hooks/use-project.ts`, `vercel.json`, `package.json` |
| 3: UI Layer | REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13 | Frontend | `components/video/*.tsx`, `app/studio/video/page.tsx`, `components/studio/studio-header.tsx`, `app/studio/page.tsx` |

**Dependency**: Groups 1 and 2 run in parallel (no shared files). Group 3 starts after Group 2 completes (needs types + client wrappers).

## Progress

| ID | Status | Notes |
|----|--------|-------|
| REQ-1 | COMPLETED | `lib/heygen.ts` — HeyGen client with fetchWithRetry, unwrap, upload/generate/status/streaming |
| REQ-2 | COMPLETED | `api/heygen/upload/generate/status/streaming-token/route.ts` — 4 proxy routes |
| REQ-3 | COMPLETED | `api/generate-backgrounds/route.ts` — GPT-4o-mini scenes + DALL-E images |
| REQ-4 | COMPLETED | `lib/lyrics-parser.ts` — parseLyricsIntoSections + generateInstrumentalSections |
| REQ-5 | COMPLETED | `lib/layertune-types.ts` + `hooks/use-project.ts` — Video types + setLyrics |
| REQ-6 | COMPLETED | `lib/api.ts` — 7 client wrappers for HeyGen/backgrounds/blob |
| REQ-7 | COMPLETED | `components/video/camera-capture.tsx` — Camera + file fallback |
| REQ-8 | COMPLETED | `components/video/style-selector.tsx` — 4 modes, 5 themes |
| REQ-9 | COMPLETED | `components/video/video-generation-overlay.tsx` — 7 phases, animations |
| REQ-10 | COMPLETED | `components/video/video-result.tsx` — Player + share/download |
| REQ-11 | COMPLETED | `app/studio/video/page.tsx` — 4-step orchestrator |
| REQ-12 | COMPLETED | `studio-header.tsx` + `studio/page.tsx` — Music Video button |
| REQ-13 | COMPLETED | `components/video/streaming-preview.tsx` — Graceful degradation |
| REQ-14 | COMPLETED | `api/video/upload/route.ts` — Vercel Blob upload |
| REQ-15 | COMPLETED | Dependencies + vercel.json config |

## Verification

1. `cd app && npm run build` — must succeed with no errors
2. `cd app && npm test` — all existing + new tests pass
3. Manual: Navigate to `/studio`, compose a track, verify lyrics persist in localStorage
4. Manual: Click "Music Video" button → navigates to `/studio/video`
5. Manual: Take selfie (or upload photo), select style, generate video
6. Manual: Verify video plays, download works, share URL copies to clipboard
7. Manual: Test camera denied → file upload fallback works
8. Manual: Test instrumental track (no lyrics) → generates without text overlay
9. Manual: Verify Vercel deployment succeeds with all new routes
