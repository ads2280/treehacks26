# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# ProduceThing — AI Music Composition Studio (TreeHacks 2026)

## Project Vision
Layer-by-layer music composition through natural language. Users describe vibes, add layers (drums, melody, vocals, bass), regenerate individual layers, and export. Then turn it into a lip-synced music video with a selfie avatar. "I made this myself" feeling.

## Core Principles
- **Progressive Composition** — Build music incrementally, not all at once
- **Surgical Control** — Regenerate individual layers without affecting others
- **Ownership Through Process** — Multiple creative decisions = authentic ownership
- **Simplicity Over Features** — No knobs, no DAW complexity, just describe and refine

## Tech Stack
- **Framework**: Next.js 16, React 19, TypeScript, App Router
- **Styling**: Tailwind CSS 4, Radix UI (headless components), lucide-react icons
- **AI Chat**: Vercel AI SDK v6 — GPT-5 Nano (Normal mode) + Claude Opus 4.6 (Agent mode)
- **AI Music**: Suno API (unlimited TreeHacks credits)
- **Stem Separation**: Suno /stem (12 stems) + Modal Demucs (3 stems, parallel, faster)
- **Audio**: waveform-playlist (multitrack waveforms) + Web Audio API (mixing)
- **Video**: HeyGen API v2 (talking photo avatars, lip-sync video rendering)
- **Background Images**: OpenAI DALL-E 2 + GPT-5 (scene descriptions from lyrics)
- **Persistence**: localStorage only (no database)
- **Deploy**: Vercel (vercel.json configured, region iad1) + Modal (Demucs GPU endpoint)
- **Testing**: Vitest + Testing Library + Playwright

## Environment Variables
```
SUNO_API_KEY=<bearer token from Suno TreeHacks booth>
OPENAI_API_KEY=<sk-... for gpt-5-nano chat + DALL-E backgrounds>
ANTHROPIC_API_KEY=<sk-ant-... for Claude Opus agent mode>
HEYGEN_API_KEY=<HeyGen API key for video generation>
MODAL_DEMUCS_URL=<https://your-username--layertune-demucs.modal.run>
LYRICS_ASSISTANT_MODEL=gpt-4o-mini  # optional, for lyrics autocomplete + coach
```

## Commands
```bash
cd app && npm run dev         # Next.js dev server (port 3000)
cd app && npm run build       # Production build
cd app && npm test            # Vitest run
cd app && npm run test:watch  # Vitest watch mode
```

## File Structure
```
app/                              # Next.js app root (all code lives here)
├── app/                          # App Router
│   ├── page.tsx                  # Landing page (hero, animated card gallery)
│   ├── layout.tsx                # Root layout with Vercel analytics
│   ├── studio/
│   │   ├── page.tsx              # ★ Main studio orchestrator (~700 lines)
│   │   └── video/
│   │       └── page.tsx          # ★ Video generation pipeline (~420 lines)
│   └── api/
│       ├── generate/route.ts     # POST — Suno generate proxy
│       ├── stem/route.ts         # POST — Suno stem separation proxy
│       ├── stem-demucs/route.ts  # POST — Modal Demucs stem separation
│       ├── clips/route.ts        # GET  — Suno clip status polling proxy
│       ├── chat/route.ts         # POST — AI chat (dual model + agent mode)
│       ├── audio-proxy/route.ts  # GET  — CDN audio proxy (Suno + Modal)
│       ├── generate-backgrounds/route.ts  # POST — GPT-5 scene desc + DALL-E image
│       ├── heygen/
│       │   ├── upload/route.ts       # POST — Asset upload to HeyGen (images, audio)
│       │   ├── generate/route.ts     # POST — HeyGen video generation
│       │   ├── status/route.ts       # GET  — HeyGen video status polling
│       │   └── streaming-token/route.ts  # POST — HeyGen streaming session token
│       ├── video/
│       │   └── upload/route.ts       # POST — Local video file storage
│       └── lyrics/
│           ├── analyze/route.ts      # POST — Lyrics analysis (rhyme, flow, etc.)
│           ├── autocomplete/route.ts # POST — Line autocomplete suggestions
│           ├── chat/route.ts         # POST — Lyrics coaching chat
│           ├── pro-assist/route.ts   # POST — Pro-level lyrics assistance
│           └── produce/route.ts      # POST — Full lyrics production
├── components/
│   ├── studio/                   # Music studio UI components
│   │   ├── chat-panel.tsx           # AI chat interface (drag-layer-to-chat)
│   │   ├── layer-sidebar.tsx        # Layer list with mute/solo/volume
│   │   ├── waveform-display.tsx     # Waveform container div
│   │   ├── transport-bar.tsx        # Play/pause/stop, seek bar, zoom, master volume
│   │   ├── generation-overlay.tsx   # Spinner + phase text during generation
│   │   ├── studio-header.tsx        # Title, export menu (WAV/stems)
│   │   ├── lyrics-panel.tsx         # Lyrics editor with structure tags
│   │   ├── studio-landing.tsx       # Initial vibe prompt input
│   │   ├── modals.tsx               # Regenerate + delete confirmation dialogs
│   │   ├── create-panel.tsx         # Creation mode panel
│   │   ├── toast-provider.tsx       # Toast notification system
│   │   └── lyrics/                  # Lyrics analysis sub-components
│   │       ├── analysis-summary.tsx
│   │       ├── highlighted-line.tsx
│   │       └── suggestion-card.tsx
│   ├── video/                    # Video generation UI components
│   │   ├── camera-capture.tsx       # Browser camera selfie capture
│   │   ├── style-selector.tsx       # Visual style/theme selection
│   │   ├── video-generation-overlay.tsx  # Generation progress overlay
│   │   ├── video-result.tsx         # Final video player/share
│   │   └── streaming-preview.tsx    # HeyGen streaming preview
│   └── ui/                       # Radix-based headless UI primitives (~30 files)
├── hooks/
│   ├── use-project.ts            # ★ Project state (layers, cache, A/B, localStorage)
│   ├── use-waveform-playlist.ts  # ★ Waveform rendering + playback control
│   ├── use-lyrics-analysis.ts    # Lyrics analysis hook
│   ├── use-toast.ts              # Toast notification hook
│   └── use-mobile.ts             # Mobile detection hook
├── lib/
│   ├── api.ts                    # Client-side API helpers (generate, stem, poll, heygen, video)
│   ├── suno.ts                   # Server-side Suno API client (retry, normalize)
│   ├── demucs.ts                 # Server-side Modal Demucs client
│   ├── heygen.ts                 # Server-side HeyGen API client (upload, avatar, video)
│   ├── layertune-types.ts        # All types, constants, color/label maps, video themes
│   ├── lyrics-parser.ts          # Lyrics → sections with structure tags
│   ├── lyrics-analysis.ts        # Rhyme, flow, syllable analysis
│   ├── lyrics-assistant.ts       # AI lyrics coaching
│   ├── lyrics-filler.ts          # Auto-fill incomplete lyrics
│   ├── lyrics-hooks.ts           # Lyrics-specific hook utilities
│   ├── lyrics-prompts.ts         # AI prompt templates for lyrics
│   ├── lyrics-types.ts           # Lyrics type definitions
│   ├── lyrics-utils.ts           # Lyrics string utilities
│   ├── lyrics-validate.ts        # Lyrics validation
│   ├── rap-theory.ts             # Rap/hip-hop music theory utilities
│   ├── audio-utils.ts            # Audio download helpers
│   └── utils.ts                  # cn() utility
├── public/                       # Static assets (SVGs, branding images)
modal/
└── demucs_endpoint.py            # Modal Python function — htdemucs on T4 GPU
```

## Architecture

### State Management
All state lives in `use-project.ts` hook → React useState + localStorage persistence. No database, no backend state. Key state:
- `project`: title, vibePrompt, originalClipId, stemCache
- `layers`: array of Layer objects (audioUrl, volume, mute, solo, stemType)
- `abState`: per-layer A/B comparison state
- `masterVolume`: global volume multiplier

### Music Generation Flow (Parallel Pipeline)
1. User describes vibe → `POST /api/generate` (Suno) → poll until `complete`
2. **Parallel stem separation**: fire both Demucs (~20s, 3 stems) and Suno /stem (12 stems) simultaneously
3. `deliveredStems` Set deduplicates — first pipeline to deliver each stem wins
4. First stem (drums) becomes a layer immediately, rest cached in `stemCache`
5. Demucs delivers vocals/drums/bass fast; Suno fills remaining 9 stems
6. If Demucs fails, `.catch()` swallows error — Suno handles all 12 stems (zero degradation)
7. User clicks "+ Bass" → check cache first (instant), else generate new track with `cover_clip_id` → stem → swap

### Video Generation Flow (Sequential)
1. Selfie capture via browser camera → `CameraCapture` component
2. Style/theme selection → `StyleSelector` with preset themes or custom prompt
3. GPT-5 writes scene description from lyrics → DALL-E generates background image (`/api/generate-backgrounds`)
4. Upload selfie to HeyGen → create talking photo avatar (`/api/heygen/upload`)
5. Upload audio + background to HeyGen
6. HeyGen renders lip-synced video with lyrics overlay (`/api/heygen/generate` → poll `/api/heygen/status`)
7. Result: shareable MP4 video displayed in `VideoResult` component

### Layer Regeneration
1. User clicks regenerate → enters A/B mode (`previousAudioUrl` stored)
2. Generate new track (NO `cover_clip_id` — see Bug #9) + layer-specific tags → stem → swap `audioUrl`
3. User picks "Keep A" (revert) or "Keep B" (accept new)

### Audio Playback
- `waveform-playlist` renders canvas waveforms per track
- Web Audio API handles mixing (GainNode per stem, master gain)
- Per-layer controls: volume [0,1], mute, solo
- Export: WAV via waveform-playlist, individual stems via download

### AI Chat Integration
- **Dual model routing**: GPT-5 Nano (Normal mode, fast/cheap) or Claude Opus 4.6 (Agent mode, powerful multi-step)
- Model selection via dropdown in chat header; Agent mode forces Claude Opus
- 6 tools: `generate_track`, `add_layer`, `regenerate_layer`, `remove_layer`, `set_lyrics`, `get_composition_state`
- Client dispatches tool calls via `onToolCall` → `addToolOutput()` (NOT return value — see Bug #7)
- Drag-layer-to-chat targets a specific layer for editing
- Dynamic import (`next/dynamic`, ssr: false) to avoid SSR issues
- Transport uses `useRef` + `useMemo` for stability — `body: () => ({...ref.current})` reads latest model/agent state per request

### Agent Mode (Claude Opus)
- Autonomous multi-step composition from a single prompt
- **Plan → Execute → Observe → Reflect** loop: agent reasons between tool calls
- Tool results are enriched: in agent mode, callbacks `await` the full Suno flow and return detailed state (cached stems list, layer count, etc.)
- In normal mode, callbacks fire-and-forget and return immediately
- `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` creates the agent loop naturally
- Agent can't "hear" audio — reasoning is structural (genre → stems), not sonic

### Lyrics System
Comprehensive lyrics subsystem with analysis, coaching, and auto-completion:
- `lyrics-parser.ts` — parses raw lyrics text into sections with structure tags `[Verse]`, `[Chorus]`, etc.
- `lyrics-analysis.ts` — analyzes rhyme schemes, syllable patterns, flow metrics
- `lyrics-assistant.ts` + `lyrics-prompts.ts` — AI-powered coaching and suggestions
- `lyrics-filler.ts` — auto-fills incomplete lyrics sections
- `rap-theory.ts` — hip-hop specific music theory (bars, cadence, flow patterns)
- 5 API endpoints under `/api/lyrics/` for analyze, autocomplete, chat, pro-assist, produce

### API Routes (Next.js Route Handlers)
All routes are thin proxies to external APIs:
- `/api/generate` — calls `suno.ts:generateTrack()`, normalizes response
- `/api/stem` — calls `suno.ts:stemClip()`, normalizes response
- `/api/stem-demucs` — calls `demucs.ts:separateWithDemucs()` (Modal), maps results through `DEMUCS_TO_STEM_TYPE`
- `/api/clips` — calls `suno.ts:getClips()`, max 20 IDs per request
- `/api/chat` — dynamic model selection (GPT-5 Nano or Claude Opus), Zod-typed tools, streams response
- `/api/audio-proxy` — whitelist-based CDN proxy (cdn1/2.suno.ai, audiopipe.suno.ai, modal.run)
- `/api/generate-backgrounds` — GPT-5 scene description + DALL-E 2 image generation
- `/api/heygen/*` — HeyGen video generation (upload, generate, status polling, streaming token)
- `/api/video/upload` — local video file storage
- `/api/lyrics/*` — lyrics analysis, autocomplete, chat coaching, pro-assist, production

### Suno API Reference
Base URL: `https://studio-api.prod.suno.com/api/v2/external/hackathons`
- **POST /generate** — 5 credits. Params: `topic`, `tags`, `prompt`, `make_instrumental`, `cover_clip_id`, `negative_tags`
- **GET /clips?ids=** — poll status. Status flow: `submitted → queued → streaming → complete | error`
- **POST /stem** — 25 credits. Splits into 12 stems: Vocals, Backing Vocals, Drums, Bass, Guitar, Keyboard, Percussion, Strings, Synth, FX, Brass, Woodwinds
- Rate limits: 60 songs/min, **5 stems/min** (bottleneck), 100 clips/min
- `cover_clip_id` creates variations maintaining melody/harmony — use for coherent layer *additions*, NOT regeneration (Bug #9)
- Tags: 4-8 style tags, most important first. Genre + instrument + mood combos work best.
- Stem titles come as "Song Name - Stem Name" → extract after last " - " (Bug #4)
- **IMPORTANT**: Wait for `status=complete` before calling `/stem` (Bug #2)

### Retry Logic (suno.ts)
- Max 3 retries with exponential backoff (1s, 2s, 4s + jitter, capped at 30s)
- 429: uses `Retry-After` header if present
- 5xx: retries with backoff
- Other errors: throws immediately

## Vercel Deployment
```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "app/api/chat/route.ts": { "maxDuration": 60 },
    "app/api/generate/route.ts": { "maxDuration": 30 },
    "app/api/stem/route.ts": { "maxDuration": 30 },
    "app/api/clips/route.ts": { "maxDuration": 10 },
    "app/api/audio-proxy/route.ts": { "maxDuration": 10 },
    "app/api/stem-demucs/route.ts": { "maxDuration": 120 },
    "app/api/heygen/upload/route.ts": { "maxDuration": 120 },
    "app/api/heygen/generate/route.ts": { "maxDuration": 30 },
    "app/api/heygen/status/route.ts": { "maxDuration": 10 },
    "app/api/heygen/streaming-token/route.ts": { "maxDuration": 10 },
    "app/api/generate-backgrounds/route.ts": { "maxDuration": 120 },
    "app/api/video/upload/route.ts": { "maxDuration": 30 }
  }
}
```

## Key Patterns & Gotchas

### React Patterns
- **Ref-stable callbacks**: Use `useCallback` + `projectRef.current = project` to avoid stale closures in async polling loops
- **Dynamic import for SSR-unsafe deps**: `dynamic(() => import(...), { ssr: false })` for waveform-playlist, chat panel, and video components
- **No side effects in setState updaters**: Read state directly, don't rely on values set inside `setState(prev => ...)` (Bug #6)
- **Always render ref containers**: Never conditionally render a `<div ref={...}>` used by a mount-only `[]` deps effect (Bug #5)

### AI SDK v6 Patterns
- Tool results via `addToolOutput()`, NOT return value from `onToolCall` (Bug #7)
- Do NOT `await addToolOutput()` — causes deadlocks
- `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` for auto tool dispatch
- Small models need explicit system prompt instructions to prefer tool calls over inline text (Bug #8)

### Suno API Patterns
- Always normalize responses — may return flat object OR `{ clips: [...] }` (Bug #1, #3)
- Wait for `status=complete` before stem separation (Bug #2)
- Stem titles are "Song Name - Stem Name", not just "Stem Name" (Bug #4)
- `cover_clip_id` for coherent *additions* only, NOT for *regeneration* (Bug #9)

## Context Management: The Sink Pattern

Never let verbose commands print raw output to stdout. Decouple **Logging** from **Reporting**.

```bash
# BAD:
npm run build

# GOOD:
npm run build > .logs/build.log 2>&1
if [ $? -eq 0 ]; then
  echo "Build successful. (Logs: .logs/build.log)"
else
  echo "Build failed. Last 10 lines:"
  tail -n 10 .logs/build.log
fi
```

For sub-agents: write to `.runs/agent-name/summary.md`. Main workflow reads summary only, never raw logs.

## Debug Log

### Bug #1: Suno `/generate` response format mismatch
- **Symptom**: "No clips returned" error after clicking Generate
- **Root cause**: Suno returns flat clip object `{id, status, ...}`, not `{clips: [...]}`
- **Fix**: Normalize in `suno.ts:generateTrack()` — if `!data.clips`, wrap `[data]`

### Bug #2: Stem separation 500 — clip not ready
- **Symptom**: Generate succeeded but no layers appeared
- **Root cause**: Code called `/stem` while clip was still `streaming`. Suno requires `complete`.
- **Fix**: Set `acceptStreaming: false` in all generation flows before calling `/stem`

### Bug #3: Stem response format (preventive)
- Same normalization pattern as Bug #1, applied to `stemClip()`

### Bug #4: All layers show as "FX" — stem name mapping
- **Root cause**: Suno returns "Song Name - Vocals", not just "Vocals". Direct lookup fails.
- **Fix**: `stemTitleToType()` extracts stem name after last " - " separator

### Bug #5: Waveforms not rendering — conditional ref + mount-only effect
- **Root cause**: Playlist container `<div ref={...}>` conditionally rendered (only when `layers.length > 0`). Mount effect with `[]` deps sees null ref, never retries.
- **Fix**: Always render the container div. Empty state is an overlay, not a replacement.
- **Lesson**: Never conditionally render a ref target used by a `[]` deps effect.

### Bug #6: consumeCachedStem returns null — React batched setState
- **Root cause**: `let found = null` set inside `setProject(prev => { found = match; ... })`. React 18+ batches updates — updater runs during rendering, not at call site. `return found` executes before updater runs.
- **Fix**: Read `project.stemCache.find()` directly instead of relying on setState side effects.
- **Lesson**: Never rely on side-effects inside `setState` updaters to return values.

### Bug #7: AI SDK v6 MissingToolResultsError
- **Root cause**: `onToolCall` return value is ignored in AI SDK v6. Tool result never stored.
- **Fix**: Use `addToolOutput({ toolCallId, output })` explicitly. Do NOT await it.
- **Lesson**: AI SDK v6 requires explicit `addToolOutput()`, not return values.

### Bug #8: AI writes lyrics inline instead of calling set_lyrics
- **Root cause**: GPT-4o-mini defaults to inline text over tool calls for content-heavy responses.
- **Fix**: System prompt: "IMPORTANT: When the user asks for lyrics, ALWAYS use the set_lyrics tool."
- **Lesson**: Small models need explicit instructions to prefer tool calls.

### Bug #9: Layer regeneration produces identical audio
- **Symptom**: Regenerating a layer (e.g. bass) creates a new version but the audio is identical to the original.
- **Root cause**: `handleRegenerate` and `regenerateVocalsWithLyrics` passed `cover_clip_id: p.originalClipId` to Suno. The `cover_clip_id` parameter tells Suno to generate a *cover* — preserving the original song's melody, harmony, and structure. Extracted stems from a cover are near-identical to the originals because the cover maintains the same musical foundation.
- **Fix**: Remove `cover_clip_id` from regeneration calls. Fresh generation with stem-specific tags + the user's prompt produces genuinely different results. `cover_clip_id` is still correct for `handleAddLayer` where coherence with the existing mix is desired.
- **Lesson**: `cover_clip_id` is for coherent *additions*, not for *regeneration* where the user explicitly wants something different.

## Prize Targets
- **Suno: Best Musical Hack** — PRIMARY (guaranteed interview + 1yr Premier)
- **TreeHacks Grand Prize** ($12k)
- **Most Creative** (Pioneer DJ DDJ-FLX4)
- **Vercel: Best Deployed on Vercel** ($2k + Pro credits)
- **Greylock: Best Multi-Turn Agent** (Warriors courtside tickets) — agent mode
- **Anthropic: Human Flourishing Track** (tungsten cubes) — Claude integration
- **Anthropic: Best Use of Claude Agent SDK** ($2.5k credits) — agent mode
- **Decagon: Best Conversation Assistant** (Nintendo Switch 2) — chat panel
- **Modal: Inference Track** ($5k credits + office visit) — Demucs pipeline
