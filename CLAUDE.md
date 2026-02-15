# LayerTune - AI Music Composition App (TreeHacks 2026)

## Project Vision
Layer-by-layer music composition through natural language. Users describe vibes, add layers (drums, melody, vocals, bass), regenerate individual layers, and export. "I made this myself" feeling.

## Core Principles
- **Progressive Composition** - Build music incrementally, not all at once
- **Surgical Control** - Regenerate individual layers without affecting others
- **Ownership Through Process** - Multiple creative decisions = authentic ownership
- **Simplicity Over Features** - No knobs, no DAW complexity, just describe and refine

## Prize Targets
- **Suno: Best Musical Hack** (1st: guaranteed Suno interview + 1yr Premier) - PRIMARY
- **TreeHacks Grand Prize** ($12k)
- **Most Creative** (Pioneer DJ DDJ-FLX4)
- **Vercel: Best Deployed on Vercel** ($2k + Pro credits)
- **Anthropic: Human Flourishing Track** (tungsten cubes)

## Tech Stack
- **Frontend**: React 18, TypeScript, TailwindCSS, Vite
- **Backend**: Express.js/Node.js
- **AI Music**: Suno API (primary, UNLIMITED credits) + optionally ACE-Step on Modal
- **Audio**: Web Audio API for client-side mixing/playback (consider waveform-playlist npm package)
- **Deploy**: Vercel (frontend) + separate backend
- **DB**: SQLite via better-sqlite3 (from ace-step-ui reference)
- **Icons**: lucide-react

## API Access
- **Suno TreeHacks API**: `https://studio-api.prod.suno.com/api/v2/external/hackathons/`
  - POST /generate (5 credits, topic/tags/prompt/make_instrumental/cover_clip_id/negative_tags)
  - GET /clips?ids= (check status, get audio_url)
  - POST /stem (25 credits, splits into 12 stems)
  - Rate limits: 60 songs/min, 5 stems/min, 100 clip fetches/min
  - Streaming: audio_url available when status="streaming" (~30s), final MP3 at status="complete" (~2min)
  - Status flow: submitted → queued → streaming → complete | error
  - Token: Bearer token from Suno booth
  - **UNLIMITED credits** - spam freely
- **Suno Tags**: Use 4-8 style tags for best results. Place most important tags first. Tags control genre, instruments, mood, vocal style.
  - Structure tags go in lyrics field: [Intro], [Verse], [Chorus], [Bridge], [Outro]
  - Instrument tags: "drums, trap, 808s", "piano, acoustic, minimal", etc.
  - cover_clip_id: Create variations maintaining musical coherence
- **RunPod**: GPU serverless (for self-hosted models, FlashBoot <250ms cold start)
- **Modal**: GPU compute + sandboxes (has official ACE-Step example on L40S)
- **Other**: OpenAI, Google Cloud, NVIDIA, Anthropic Claude, Perplexity Sonar, Cloudflare, Browserbase

## Research Findings (Feb 14, 2026)

### Suno API - PRIMARY ENGINE
- Best quality output (commercial-grade)
- 12 clean stems: Vocals, Backing Vocals, Drums, Bass, Guitar, Keyboard, Percussion, Strings, Synth, FX, Brass, Woodwinds
- Limitation: Can't surgically regen ONE stem - must generate full track + re-separate
- Tags parameter controls instrument dominance (e.g., "drums, trap" biases toward drums)
- cover_clip_id creates variations maintaining melody/harmony - USE THIS for layer regen coherence
- Streaming playback starts at ~30s, full song done ~2min
- **Stem rate limit is the bottleneck**: 5 stems/min. Batch layer regens when possible.
- **demucs-web exists in ace-step-ui reference** (`server/public/demucs-web/`) - FREE browser-based stem separation as alternative to 25-credit /stem calls
- Layer regen strategy: use cover_clip_id + targeted tags → stem → swap single layer

### ACE-Step 1.5 - OPTIONAL SECONDARY
- Open-source 3.5B model, quality between Suno v4.5 and v5
- Task types: text2music, repaint (time regions), edit (FlowEdit), extend, retake, audio2audio
- ACE-Step 1.5 also has: Lego (one track at a time), Extract (isolate stems), Complete (fill missing tracks)
- Repaint: regenerate specific TIME REGION, not per-instrument (latent space mask)
- Runs on 4GB VRAM minimum, <2s per song on A100, <10s on RTX 3090
- Deploy on Modal (official example exists) or RunPod (~$0.13/gen on A40)
- Reference app (ace-step-ui) connects via @gradio/client

### MusicGen (Meta) - NOT RECOMMENDED
- No native multi-stem, no vocals, 64s latency, $0.089/run on Replicate
- MusicGen-Stem (3 stems: bass, drums, other) - code NOT publicly released (PR #509 unmerged)

### Audio Separation Alternatives
- Suno built-in: 12 stems, zero setup, best for our use case
- Demucs: 4-6 stems, open-source, good quality, needs self-hosting
- Meta SAM-Audio (Dec 2025): text-prompted separation, too new/risky for hackathon

### Client-Side Audio Libraries
- **waveform-playlist** (npm): React multitrack editor with mute/solo/volume, canvas waveforms, WAV export, Tone.js effects - has stem tracks example
- **Tone.js**: Lower-level, sample-accurate scheduling, effects chain
- **Raw Web Audio API**: AudioContext + GainNode per stem + StereoPannerNode

## References Directory

### `references/ace-step-ui/` - Full music gen UI (React/TS/TailwindCSS + Express)
**Copy-paste ready components:**
- Toast.tsx (54 lines) - success/error/info notifications, auto-dismiss
- ConfirmDialog.tsx (90 lines) - modal with backdrop blur, escape key, danger mode
- EditableSlider.tsx (~100 lines) - slider with inline text editing
- Sidebar.tsx (~226 lines) - collapsible nav, theme toggle, profile section
- AlbumCover.tsx - seed-based placeholder art
- ResponsiveContext.tsx - isMobile/isDesktop via matchMedia
- AuthContext.tsx - JWT token management, localStorage persistence

**Adapt for LayerTune:**
- Player.tsx (~840 lines) - full player with progress, volume, speed control → adapt for multi-stem Web Audio
- CreatePanel.tsx (~1000+ lines) - generation form with simple/custom modes → simplify for layer prompts
- SongList.tsx (~500+ lines) - filterable list with search, drag-drop → becomes LayersList
- RightSidebar.tsx (~400+ lines) - song details panel → layer info with solo/mute/volume

**Server architecture (fully reusable):**
- Express.js + Helmet + CORS + static serving
- SQLite via better-sqlite3 with helper functions (generateUUID, toJSON, transaction, batchInsert)
- JWT authentication (username-only, no passwords)
- Generation queue (priority tiers, fairness, per-user concurrency, batch window)
- Storage abstraction (local/S3/Azure factory pattern)
- Gradio client integration for ACE-Step
- Cron-based cleanup service

**Key dependencies (frontend):** react 19, lucide-react, @ffmpeg/ffmpeg, vite 6
**Key dependencies (server):** express, better-sqlite3, @gradio/client, helmet, jsonwebtoken, multer, node-cron, uuid

### `references/ComfyUI_ACE-Step/` - ACE-Step model pipeline code
- Model: music_dcae (encoder/decoder) + ACEStepTransformer (28 blocks, 1536 hidden, 24 heads) + vocoder + umt5-base text encoder
- Total model size: ~3.35GB
- Pipeline supports: text2music, repaint, edit, extend, retake, audio2audio tasks
- Repaint algorithm: latent-space masked diffusion on time regions
- FlowEdit: velocity blending between source and target prompts
- LoRA support for style fine-tuning

## Key Architecture Decisions
- **Suno-first approach**: Generate full track → stem separate → display as layers → regen via new full track + stem swap
- **Client-side mixing**: Web Audio API with GainNode per stem for volume/mute
- **Non-blocking generation**: Polling-based status updates while user continues working
- **A/B comparison**: Side-by-side playback of before/after when regenerating a layer
- **waveform-playlist** for timeline UI (React, mute/solo/volume, waveform viz, WAV export)

## Suno API Workflow for Layers
1. User describes vibe → POST /generate with topic+tags
2. Poll GET /clips?ids= every 5-10s until status="streaming" or "complete"
3. POST /stem on completed clip → 12 stems (poll all 12 IDs via /clips until complete)
4. Display relevant stems as layers in timeline with waveforms
5. To regen a layer: POST /generate with layer-specific tags → POST /stem → replace that stem
6. Web Audio API mixes all active stems client-side
7. Export: WAV via waveform-playlist or download individual stems

## PRD - User Flow

### 1. Project Creation
- Blank canvas with single text input: "Describe your music..."
- User types vibe/genre/feeling (e.g., "lofi hip-hop, rainy day, nostalgic")
- System generates 15-30 second sketch → auto-stems → first layers appear
- Text updates: "Analyzing vibe..." → "Generating foundation..." → "Separating layers..."
- Non-blocking (user can continue working)

### 2. Layer Management
- Smart suggestions: [+ Add drums] [+ Add melody] [+ Add vocals] [+ Add bass]
- Freeform text input for custom layer descriptions
- Each layer shows: name, waveform, volume slider, mute/solo buttons, regenerate button
- Layers generate in background with progress indicators

### 3. Layer Regeneration
- Click regenerate icon next to any layer
- Prompt: "How should this change?" with text input
- System generates new full track with layer-specific tags → stems → swaps that layer
- A/B comparison mode: side-by-side before/after playback
- User picks which version to keep

### 4. Visual Layout - Timeline View
- Horizontal timeline with playhead scrubber
- Each layer as a track with waveform visualization
- Per-layer controls: volume, mute, solo, regenerate, delete
- Global transport: play/pause, timeline position, total duration
- "Add layer" button at bottom

### 5. Playback
- Play full mix from any position
- Per-layer mute/solo for focused listening
- Volume faders per layer
- A/B comparison when regenerating (synced playback)

### 6. Export
- Full mix as MP3/WAV
- Individual stems download
- Auto-save (every action persists)

### 7. Error Handling
- "Not what you wanted?" → [Try Again] or [Refine with prompt]
- No system quality judgment - user decides
- Simple retry with same or modified prompt

## Technical Constraints
- Non-blocking layer generation
- Support up to 10 concurrent layers
- Maximum track length: 3 minutes (v1)
- Desktop browser primary target
- Deploy on Vercel (frontend) + separate backend host

## File Structure
```
src/
  components/       # React UI components
    Sidebar.tsx
    Player.tsx       # Multi-stem audio player
    LayersList.tsx   # Layer management panel
    Timeline.tsx     # Waveform timeline view
    CreatePanel.tsx  # Vibe description + layer addition
    Toast.tsx
    ConfirmDialog.tsx
  services/
    api.ts          # Backend API client
    suno.ts         # Suno API types/helpers
  hooks/
    useAudioMixer.ts # Web Audio API multi-stem mixing
    usePolling.ts    # Generation status polling
  context/
    AuthContext.tsx
    ProjectContext.tsx # Current composition state
    ResponsiveContext.tsx
  types/
    index.ts        # Layer, Project, Stem types
  utils/
    audio.ts        # Audio helpers
server/
  src/
    index.ts        # Express entry point
    routes/
      generate.ts   # Suno generation + stem endpoints
      projects.ts   # Project CRUD
    services/
      suno.ts       # Suno API client (generate, clips, stem)
      queue.ts      # Generation job queue
    db/
      index.ts      # SQLite setup
      schema.sql    # projects, layers, stems, generation_jobs tables
```

## Database Schema (SQLite)
```sql
projects(id, title, vibe_prompt, bpm, key_scale, duration, created_at, updated_at)
layers(id, project_id, name, stem_type, prompt, audio_url, volume, is_muted, is_soloed, position, created_at)
generation_jobs(id, project_id, layer_id, suno_clip_id, status, params, result, error, created_at)
stems(id, generation_job_id, stem_name, suno_stem_id, audio_url, status, created_at)
```
