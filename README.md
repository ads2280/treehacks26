# ProduceThing

**AI-powered music composition studio with music video generation.** Describe a vibe, build your track layer by layer, then turn it into a lip-synced music video with your face as the avatar.

Built at **TreeHacks 2026**.

---

## What It Does

### 1. Compose Music Through Conversation
Describe a mood ("chill lo-fi sunset vibes") and ProduceThing generates a full track via Suno. The track is automatically separated into stems (drums, bass, vocals, guitar, etc.) so you can:

- **Add layers** individually from cached stems or generate new ones
- **Regenerate** any single layer without affecting the rest
- **A/B compare** old vs new versions of a layer
- **Mix** with per-layer volume, mute, and solo controls
- **Export** the final mix as WAV or download individual stems

### 2. AI Chat Assistant
Talk to the AI to control your composition hands-free. Supports two modes:

- **Normal mode** (GPT-5 Nano) — fast, lightweight responses
- **Agent mode** (Claude Opus 4.6) — autonomous multi-step composition from a single prompt. Plans, executes, observes, and iterates.

Six tools available: `generate_track`, `add_layer`, `regenerate_layer`, `remove_layer`, `set_lyrics`, `get_composition_state`.

### 3. Music Video Generation
Take a selfie, pick a visual style, and ProduceThing creates a music video:

1. **Selfie capture** via browser camera
2. **Style selection** — preset themes or custom text prompt
3. **Background generation** — GPT-5 writes a scene description from lyrics, DALL-E generates the image
4. **Avatar creation** — your selfie becomes a HeyGen talking-photo avatar
5. **Video rendering** — HeyGen lip-syncs your avatar to the song audio with background and lyrics overlay
6. **Result** — shareable MP4 video

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, React 19, TypeScript, App Router |
| Styling | Tailwind CSS 4, Radix UI, lucide-react |
| AI Chat | Vercel AI SDK v6 — GPT-5 Nano + Claude Opus 4.6 |
| Music Generation | Suno API (generate, stem separation) |
| Stem Separation | Suno /stem (12 stems) + Modal Demucs (3 stems, GPU-accelerated) |
| Audio Playback | waveform-playlist + Web Audio API |
| Video Generation | HeyGen API v2 (talking photo avatars, video rendering) |
| Background Images | OpenAI DALL-E 2 + GPT-5 (scene descriptions) |
| Lyrics Parsing | Custom parser with structure tag detection |
| Persistence | localStorage (no database) |
| Deployment | Vercel (iad1 region) + Modal (Demucs T4 GPU) |
| Testing | Vitest + Testing Library + Playwright |

---

## Setup

```bash
cd app
cp .env.example .env.local   # then fill in the values below
npm install
npm run dev                   # http://localhost:3000
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUNO_API_KEY` | Yes | Suno API bearer token for music generation + stem separation |
| `OPENAI_API_KEY` | Yes | OpenAI key for AI chat (GPT-5 Nano) and background generation (DALL-E 2) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic key for Claude Opus 4.6 agent mode |
| `HEYGEN_API_KEY` | Yes | HeyGen API key for music video generation |
| `MODAL_DEMUCS_URL` | Optional | Modal Demucs endpoint URL for faster stem separation |

### Requirements

- Node.js 18+
- npm

---

## Architecture

### Pages

| Route | Description |
|---|---|
| `/` | Landing page with animated card gallery |
| `/studio` | Main composition studio — layers, waveforms, chat, transport |
| `/studio/video` | Music video generation — camera, style, generation, result |

### API Routes

| Route | Method | Description |
|---|---|---|
| `/api/generate` | POST | Suno track generation proxy |
| `/api/stem` | POST | Suno 12-stem separation proxy |
| `/api/stem-demucs` | POST | Modal Demucs 3-stem separation |
| `/api/clips` | GET | Suno clip status polling |
| `/api/chat` | POST | AI chat with dual model routing + tool calling |
| `/api/audio-proxy` | GET | CDN audio proxy (Suno + Modal URLs) |
| `/api/generate-backgrounds` | POST | GPT-5 scene description + DALL-E image generation |
| `/api/heygen/upload` | POST | Asset upload to HeyGen (images, audio, talking photos) |
| `/api/heygen/generate` | POST | HeyGen video generation |
| `/api/heygen/status` | GET | HeyGen video status polling |
| `/api/heygen/streaming-token` | POST | HeyGen streaming session token |
| `/api/video/upload` | POST | Local video file storage |

### Key Files

```
app/
├── app/studio/page.tsx           # Studio orchestrator — generation, stems, layers
├── app/studio/video/page.tsx     # Video generation pipeline — camera → style → render
├── hooks/use-project.ts          # All project state + localStorage persistence
├── hooks/use-waveform-playlist.ts # Waveform rendering + Web Audio playback
├── lib/api.ts                    # Client-side API helpers + polling functions
├── lib/suno.ts                   # Server-side Suno client (retry, normalize)
├── lib/heygen.ts                 # Server-side HeyGen client (upload, avatar, video)
├── lib/lyrics-parser.ts          # Lyrics → sections with structure tags
├── lib/layertune-types.ts        # Shared types, constants, color maps
├── components/studio/            # Studio UI components (chat, layers, transport, etc.)
├── components/video/             # Video UI components (camera, styles, overlay, result)
└── components/ui/                # Radix-based headless primitives
modal/
└── demucs_endpoint.py            # Modal GPU function — htdemucs stem separation
```

### Generation Pipelines

**Music generation** (parallel stem delivery):
```
User prompt → Suno generate → poll until complete →
  ├── Demucs (3 stems, ~20s) ─┐
  └── Suno /stem (12 stems) ──┤→ deduplicate → layers
                               └── first-to-deliver wins
```

**Video generation** (sequential):
```
Selfie capture → style selection →
  GPT-5 scene description → DALL-E background →
  Upload selfie → HeyGen avatar group → poll until ready →
  Upload audio + background →
  HeyGen video generate → poll until rendered → MP4 result
```

---

## Commands

```bash
cd app && npm run dev          # Dev server (port 3000)
cd app && npm run build        # Production build
cd app && npm test             # Run tests
cd app && npm run test:watch   # Watch mode
```

---

## Deployment

Configured for Vercel with function-specific timeouts in `vercel.json`. The Demucs stem separation runs on Modal with a T4 GPU. All generated backgrounds and videos are stored locally in `public/generated-backgrounds/` and `public/generated-videos/` (gitignored).

---

## Prize Targets

- **Suno: Best Musical Hack** — layer-by-layer composition with stem separation
- **TreeHacks Grand Prize** — full-stack AI creative tool
- **Greylock: Best Multi-Turn Agent** — Claude Opus agent mode
- **Anthropic: Best Use of Claude Agent SDK** — autonomous composition agent
- **Vercel: Best Deployed on Vercel** — Next.js 16 App Router
- **Modal: Inference Track** — Demucs GPU pipeline
- **Decagon: Best Conversation Assistant** — AI chat with 6 tools
- **Most Creative** — music video from selfie + AI
