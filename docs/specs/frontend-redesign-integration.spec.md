# Specification: Frontend Redesign Integration

> To implement this spec, clear context and run:
> `/duy-workflow:execute docs/specs/frontend-redesign-integration.spec.md`

## Goal
Merge the v0-generated redesign UI (`frontend-to-redesign/`) with the real Suno API backend (`app/src/`) into the worktree at `/Users/duy/Documents/build/treehacks26-frontend/app/`, producing a production-ready `/studio` page with real audio generation, waveform visualization, and export.

## Requirements

1. **[REQ-1] Scaffold worktree with redesign base**
   - Copy redesign's config files (package.json, tsconfig, next.config, postcss, components.json) into worktree `app/`
   - Add waveform-playlist, event-emitter to dependencies
   - Add vitest, @testing-library/react, @testing-library/jest-dom, jsdom, @vitejs/plugin-react to devDependencies
   - Copy all redesign source: `app/`, `components/`, `hooks/`, `lib/`, `styles/`
   - Acceptance: `npm install` succeeds, `npm run dev` starts

2. **[REQ-2] Port types, constants, and API client**
   - Merge `lib/layertune-types.ts`: keep redesign's aesthetic types + add SunoClip, SunoGenerateRequest, SunoGenerateResponse, SunoStemResponse, GenerationJobStatus from current `lib/types.ts`
   - Expand Layer interface: add projectId, sunoClipId, generationJobId, createdAt
   - Expand Project interface: add createdAt, updatedAt
   - Add SUNO_API_BASE, STEM_TYPE_TAGS, STEM_NAME_TO_TYPE, SMART_SUGGESTIONS, POLL_INTERVALS, STEM_DISPLAY_NAMES
   - Create `lib/api.ts` from current app (client-side API: generate, pollClips, stem, proxyAudioUrl, pollUntilDone, stemTitleToType)
   - Create `lib/suno.ts` from current app (server-side Suno client: generateTrack, getClips, stemClip, fetchWithRetry)
   - Create `lib/audio-utils.ts` from current app (audioBufferToWav, downloadBlob, downloadUrl)
   - Acceptance: TypeScript compiles with no errors in lib/

3. **[REQ-3] Port Next.js API routes**
   - Create `app/api/generate/route.ts` — POST handler calling generateTrack()
   - Create `app/api/stem/route.ts` — POST handler calling stemClip()
   - Create `app/api/clips/route.ts` — GET handler calling getClips()
   - Create `app/api/audio-proxy/route.ts` — GET handler with allowlist proxy + streaming + 24h cache
   - Acceptance: Routes exist and compile

4. **[REQ-4] Port useWaveformPlaylist hook**
   - Create `hooks/use-waveform-playlist.ts` from current app's hook
   - Create `types/waveform-playlist.d.ts` from current app
   - Adjust imports to `@/lib/layertune-types`
   - All logic identical: init, track loading, mix updates (mute/solo/volume), master volume, zoom, transport, WAV export
   - Acceptance: Hook compiles and can be imported

5. **[REQ-5] Rewrite useProject as pure state management**
   - Remove all simulated generation logic (simulateGeneration, setTimeout chains)
   - Remove phase/setPhase from hook (managed in page.tsx)
   - Expose: addLayer, removeLayer, updateLayer, setLayerVolume, toggleMute, toggleSolo, setABState, startABComparison, keepA, keepB, setVibePrompt, setOriginalClipId, resetProject, updateProject
   - Match current app's useProject API surface exactly
   - Keep localStorage persistence pattern from redesign
   - Acceptance: Hook is pure state management, no API calls, no timeouts

6. **[REQ-6] Rewrite studio/page.tsx with real API integration**
   - Keep redesign's component tree: StudioHeader, CreatePanel, LayerSidebar, WaveformDisplay, TransportBar, modals, GenerationOverlay
   - Manage generationPhase state locally in page.tsx
   - Wire useWaveformPlaylist with playlistContainerRef, layers, masterVolume, zoomLevel
   - Replace simulated playback timer with real waveform-playlist play/pause/stop/rewind
   - Port handleGenerate: generate → poll → stem → poll stems → addLayer per stem
   - Port handleAddLayer: generate with cover_clip_id → stem → find matching → add one layer
   - Port handleRegenerate: A/B setup → generate → stem → swap audio
   - Port handleKeepA/handleKeepB/handleSelectABVersion from current app
   - Acceptance: Full generation workflow works end-to-end

7. **[REQ-7] Modify WaveformDisplay for real waveform-playlist**
   - Add `playlistContainerRef` prop
   - Remove fake generateWaveformData and SVG bar rendering
   - Replace with `<div ref={playlistContainerRef}>` that waveform-playlist renders into
   - Keep: empty state, time markers, scroll behavior
   - Remove redesign's custom playhead (waveform-playlist has its own cursor — style it lime green via CSS)
   - Track heights must align with LayerSidebar (waveHeight config)
   - Acceptance: Real audio waveforms render, aligned with sidebar

8. **[REQ-8] Wire StudioHeader export functionality**
   - Add onExportMix prop: `() => Promise<Blob | null>`
   - Wire "Export Full Mix" → call onExportMix, download as `{title}.wav`
   - Wire "Download All Stems" → iterate layers, download each audio URL
   - Wire individual layer buttons → download single layer audio
   - Port downloadBlob/downloadUrl from lib/audio-utils.ts
   - Acceptance: WAV export works, stem downloads work

9. **[REQ-9] Adapt CreatePanel for async API flow**
   - Change onAddLayer to `(stemType: StemType, tags: string) => void` (no boolean return)
   - Remove client-side success/failure return handling (toasts handled in page.tsx)
   - Keep all styling identical
   - Acceptance: Buttons trigger generation without UI errors

10. **[REQ-10] Port tests**
    - Port use-project.test.ts (adjust for new hook API — no generateInitial, pure state)
    - Port suno.test.ts (verbatim with import adjustments)
    - Port audio-utils.test.ts (verbatim)
    - Create vitest.config.ts
    - Add test/test:watch scripts to package.json
    - Acceptance: All tests pass

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Waveform rendering | Real waveform-playlist | Shows actual audio data, not decorative |
| Generation overlay | Full-screen redesign overlay | Better UX during long waits, matches aesthetic |
| Dependencies | Redesign full stack + audio deps | shadcn components actively used |
| Generation logic location | page.tsx callbacks | Clean separation of state vs orchestration |
| Layer type | Current app's full type | Needs sunoClipId etc for API tracking |
| Branding | Redesign's DesignThing | User preference |
| CSS approach | Tailwind v4 + OKLCH + shadcn | Redesign's system |

## Completion Criteria
- [ ] All 10 REQs implemented
- [ ] `npm run build` succeeds
- [ ] `npm test` — all tests pass
- [ ] Manual test: generate → stems → play → regen → A/B → export

## Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Suno API rate limit (429) | Retry with exponential backoff (3x), then error toast |
| Generation timeout (3min clip, 5min stems) | Error toast, phase reverts to idle |
| Stem type not found in Suno response | Error toast "No {type} stem found" |
| Regeneration fails mid-process | Revert audioUrl to original, exit A/B mode |
| No originalClipId when adding layer | Info toast "Generate a track first" |
| Audio proxy URL not on allowlist | 403 response |
| Export timeout (30s) | Silent fail, returns null |
| waveform-playlist load fails | isLoaded stays false, empty state shown |

## Out of Scope
- Landing page changes
- Mobile responsiveness
- New features
- Database/backend beyond API routes
- Deployment config
- CI/CD

## Technical Context

### Key Files (source → destination in worktree)

**From redesign (aesthetic/UI):**
- `frontend-to-redesign/components/studio/*` → `app/components/studio/*`
- `frontend-to-redesign/components/ui/*` → `app/components/ui/*`
- `frontend-to-redesign/app/globals.css` → `app/app/globals.css`
- `frontend-to-redesign/app/layout.tsx` → `app/app/layout.tsx`
- `frontend-to-redesign/app/studio/page.tsx` → `app/app/studio/page.tsx` (then rewrite)

**From current app (logic/backend):**
- `app/src/lib/suno.ts` → `app/lib/suno.ts`
- `app/src/lib/api.ts` → `app/lib/api.ts`
- `app/src/lib/audio-utils.ts` → `app/lib/audio-utils.ts`
- `app/src/hooks/useWaveformPlaylist.ts` → `app/hooks/use-waveform-playlist.ts`
- `app/src/types/waveform-playlist.d.ts` → `app/types/waveform-playlist.d.ts`
- `app/src/app/api/*/route.ts` → `app/app/api/*/route.ts`

### Patterns to Follow
- Redesign naming: kebab-case files (use-project.ts not useProject.ts)
- Redesign imports: `@/lib/layertune-types` not `@/lib/types` + `@/lib/constants`
- shadcn components for Button, Dialog, Slider (not custom)
- Lime green accent: `#c4f567` for CTAs, playhead, focus rings
- Dark theme: `bg-[#0d0d0d]`, `bg-[#0a0a0a]`, `border-white/10`
- Toast system: redesign's custom ToastProvider (not sonner)

## Execution Strategy
**Mode:** Subagent delegation

**REQ Groups:**

| Group | REQs | Layer | Files |
|-------|------|-------|-------|
| A: Foundation | 1, 2, 3, 4 | Scaffold + ports | package.json, lib/*, hooks/use-waveform-playlist, api routes |
| B: Core Integration | 5, 6, 7 | State + page + waveform | hooks/use-project, app/studio/page.tsx, waveform-display.tsx |
| C: Polish + Tests | 8, 9, 10 | Export, create panel, tests | studio-header, create-panel, __tests__/* |
