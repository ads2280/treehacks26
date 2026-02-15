# Progressive Layer-by-Layer Composition Spec

## Status: IMPLEMENTED

## Summary
Initial generation shows only drums layer. Remaining 11 stems are cached in `project.stemCache`. "Add Layer" checks cache first for instant results, falls back to fresh generation on cache miss.

## Key Changes
1. **CachedStem type** (`types.ts`) — `{ stemType, audioUrl, sunoClipId, fromClipId, createdAt }`
2. **Project.stemCache** — persisted via localStorage alongside layers
3. **useProject** — `setStemCache(stems)` and `consumeCachedStem(stemType)` functions
4. **handleGenerate** — shows drums only, caches rest. Tags emphasize drums.
5. **handleAddLayer** — cache-first with fallback to cover_clip_id generation
6. **CreatePanel** — filters suggestions by existing layers, hides text input when layers exist
7. **LayerTimeline** — empty state says "Describe your vibe to create a beat"
