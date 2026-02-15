"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useProject } from "@/hooks/use-project";
import { useWaveformPlaylist } from "@/hooks/use-waveform-playlist";
import { useToasts, ToastProvider } from "@/components/studio/toast-provider";
import { StudioHeader } from "@/components/studio/studio-header";
import { LyricsPanel } from "@/components/studio/lyrics-panel";
import { LayerSidebar } from "@/components/studio/layer-sidebar";
import { WaveformDisplay } from "@/components/studio/waveform-display";
import { TransportBar } from "@/components/studio/transport-bar";
import { RegenerateModal, DeleteDialog } from "@/components/studio/modals";
import { GenerationOverlay } from "@/components/studio/generation-overlay";
import { StudioLanding } from "@/components/studio/studio-landing";
import { generate, stem, stemDemucs, pollUntilDone, pollStemsProgressively, pollForTargetStem, proxyAudioUrl, stemTitleToType } from "@/lib/api";
import { STEM_TYPE_TAGS, POLL_INTERVALS, STEM_LABELS } from "@/lib/layertune-types";
import type { GenerationPhase, StemType, ModelProvider } from "@/lib/layertune-types";

function stemTypeDisplayName(stemType: StemType): string {
  return stemType.charAt(0).toUpperCase() + stemType.slice(1).replace("_", " ");
}

const ChatPanel = dynamic(
  () => import("@/components/studio/chat-panel").then((m) => m.ChatPanel),
  { ssr: false }
);

function StudioApp() {
  const router = useRouter();

  const {
    project,
    layers,
    masterVolume,
    setMasterVolume,
    updateProject,
    addLayer,
    removeLayer,
    updateLayer,
    toggleMute,
    toggleSolo,
    setLayerVolume,
    setVibePrompt,
    setProjectLyrics,
    setOriginalClipId,
    resetProject,
    pushVersion,
    navigateVersionOlder,
    navigateVersionNewer,
    appendStemCache,
    consumeCachedStem,
  } = useProject();

  const { addToast } = useToasts();

  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>("idle");
  const isInitialGenerating = generationPhase !== "idle";
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [regenLayerId, setRegenLayerId] = useState<string | null>(null);
  const [deleteLayerId, setDeleteLayerId] = useState<string | null>(null);
  // Lyrics are persisted in project state (project.lyrics)
  const lyrics = project.lyrics;
  const setLyrics = setProjectLyrics;
  const [lyricsOpen, setLyricsOpen] = useState(false);

  // Persist ephemeral UI state to sessionStorage for seamless back-navigation
  useEffect(() => {
    try { sessionStorage.setItem("producething_zoom", String(zoom)); } catch { /* ignore */ }
  }, [zoom]);
  useEffect(() => {
    try { sessionStorage.setItem("producething_lyricsOpen", String(lyricsOpen)); } catch { /* ignore */ }
  }, [lyricsOpen]);

  // Persist model/agent preferences in localStorage
  const [modelProvider, setModelProviderState] = useState<ModelProvider>("openai");
  const [agentMode, setAgentModeState] = useState(false);
  const prefsInitialized = useRef(false);
  useEffect(() => {
    if (!prefsInitialized.current) {
      prefsInitialized.current = true;
      try {
        const saved = localStorage.getItem("producething_prefs");
        if (saved) {
          const prefs = JSON.parse(saved);
          if (prefs.modelProvider) setModelProviderState(prefs.modelProvider);
          if (prefs.agentMode != null) setAgentModeState(prefs.agentMode);
        }
      } catch { /* ignore */ }
    }
  }, []);

  // Hydrate UI state from storage after mount — must happen in useEffect (not
  // useState initializer) to avoid SSR hydration mismatch. React 18 batches
  // all these updates into a single re-render so the flash is imperceptible.
  const uiHydrated = useRef(false);
  useEffect(() => {
    if (uiHydrated.current) return;
    uiHydrated.current = true;
    try {
      const z = parseFloat(sessionStorage.getItem("producething_zoom") || "1");
      if (z && z !== 1) setZoom(z);
    } catch { /* ignore */ }
    try {
      if (sessionStorage.getItem("producething_lyricsOpen") === "true") setLyricsOpen(true);
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem("producething_chat_messages");
      if (raw) {
        const msgs = JSON.parse(raw);
        if (Array.isArray(msgs) && msgs.length > 0) setChatActive(true);
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem("producething_project");
      if (raw) {
        const data = JSON.parse(raw);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data.layers?.some((l: any) => !!l.audioUrl)) setSessionStarted(true);
      }
    } catch { /* ignore */ }
  }, []);
  const setModelProvider = useCallback((p: ModelProvider) => {
    setModelProviderState(p);
    try { localStorage.setItem("producething_prefs", JSON.stringify({ modelProvider: p, agentMode: agentMode })); } catch { /* ignore */ }
  }, [agentMode]);
  const setAgentMode = useCallback((m: boolean) => {
    setAgentModeState(m);
    try { localStorage.setItem("producething_prefs", JSON.stringify({ modelProvider: modelProvider, agentMode: m })); } catch { /* ignore */ }
  }, [modelProvider]);

  const regenLayer = layers.find((l) => l.id === regenLayerId);
  const playlistContainerRef = useRef<HTMLDivElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  // Stable refs for callbacks that need current state without re-creating
  const projectRef = useRef(project);
  const lyricsRef = useRef(lyrics);
  useEffect(() => { projectRef.current = project; });
  useEffect(() => { lyricsRef.current = lyrics; });
  const agentModeRef = useRef(agentMode);
  useEffect(() => { agentModeRef.current = agentMode; });

  const {
    play: playAudio,
    pause: pauseAudio,
    stop: stopAudio,
    rewind: rewindAudio,
    seek: seekAudio,
    exportAudio,
  } = useWaveformPlaylist({
    containerRef: playlistContainerRef,
    layers: project.layers,
    masterVolume,
    zoomLevel: zoom,
    onTimeUpdate: setCurrentTime,
    onDurationChange: (d: number) => updateProject({ duration: d }),
    onFinish: () => setIsPlaying(false),
  });

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    playAudio();
  }, [playAudio]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    pauseAudio();
  }, [pauseAudio]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (prev) { pauseAudio(); } else { playAudio(); }
      return !prev;
    });
  }, [playAudio, pauseAudio]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setCurrentTime(0);
        rewindAudio();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [rewindAudio, handleTogglePlay]);

  const handleGenerate = useCallback(
    async (
      prompt: string,
      instrumental: boolean,
      options?: { tags?: string; negative_tags?: string; lyrics?: string }
    ) => {
      setGenerationPhase("generating");
      setVibePrompt(prompt);

      try {
        const hasLyrics = !!options?.lyrics?.trim();
        const data = await generate({
          topic: hasLyrics ? undefined : prompt,
          prompt: hasLyrics ? options?.lyrics : undefined,
          tags: options?.tags || `drums, beat, rhythm, ${prompt}`,
          make_instrumental: instrumental,
          negative_tags: options?.negative_tags,
        });

        const clipIds = data.clips?.map((c) => c.id) || [];
        if (clipIds.length === 0) throw new Error("No clips returned");

        setOriginalClipId(clipIds[0]);

        // Phase 1: Poll until streaming (~15-20s) — start audio preview immediately
        // so the user hears their track while Suno finishes generating.
        const streamingClips = await pollUntilDone(clipIds, {
          acceptStreaming: true,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000,
        });

        const streamingClip = streamingClips[0];
        const isAlreadyComplete = streamingClip.status === "complete";

        // Start audio preview via <audio> element — works with streaming URLs
        if (streamingClip.audio_url && previewAudioRef.current) {
          previewAudioRef.current.src = proxyAudioUrl(streamingClip.audio_url);
          previewAudioRef.current.volume = 0.8;
          previewAudioRef.current.play().catch(() => {});
        }

        let completedClip = streamingClip;

        if (!isAlreadyComplete) {
          // Phase 2: User hears streaming preview — continue polling until complete
          // waveform-playlist needs the full audio buffer (decodeAudioData),
          // but the user is already listening to their track.
          setGenerationPhase("previewing");
          const finalClips = await pollUntilDone(clipIds, {
            acceptStreaming: false,
            intervalMs: POLL_INTERVALS.clip,
            timeoutMs: 180000,
          });
          completedClip = finalClips[0];
        }

        if (!completedClip.audio_url) throw new Error("No audio URL returned from generation");

        // Stop preview audio — waveform-playlist takes over playback
        if (previewAudioRef.current) {
          previewAudioRef.current.pause();
          previewAudioRef.current.removeAttribute("src");
          previewAudioRef.current.load();
        }

        // Add full mix layer with final CDN URL — download + decode is fast (~2-3s)
        setGenerationPhase("loading");
        const mixLayerId = addLayer({
          name: "Full Mix",
          stemType: "drums" as StemType,
          prompt,
          audioUrl: proxyAudioUrl(completedClip.audio_url),

          volume: 0.8,
          isMuted: false,
          isSoloed: false,
          position: 0,
          sunoClipId: clipIds[0],
          generationJobId: null,
          projectId: project.id,
          versions: [],
          versionCursor: 0,
        });
        addToast("Preview playing — splitting into stems...", "success");

        // Overlay clears immediately — user previews the full mix while stems separate
        setGenerationPhase("complete");
        setTimeout(() => setGenerationPhase("idle"), 500);

        // --- Background auto-split ---
        // Strategy: buffer core stems (drums, vocals, bass). Once all 3 arrive,
        // atomically swap: remove the full mix, add each stem as its own layer.
        // Non-core stems (guitar, keyboard, etc.) go to cache for manual add.
        // This way the audio transition is seamless — the 3 stems reconstruct the song.
        const CORE_STEMS: StemType[] = ["drums", "vocals", "bass"];
        const deliveredStems = new Set<StemType>();
        const pendingCore = new Map<StemType, { audioUrl: string; stemClipId: string }>();
        let swapped = false;

        const trySwap = () => {
          if (swapped) return;
          const ready = CORE_STEMS.every((s) => pendingCore.has(s));
          if (!ready) return;
          swapped = true;

          // Remove the full mix preview layer
          removeLayer(mixLayerId);

          // Add each core stem as its own layer
          for (const st of CORE_STEMS) {
            const d = pendingCore.get(st)!;
            addLayer({
              name: stemTypeDisplayName(st),
              stemType: st,
              prompt,
              audioUrl: d.audioUrl,
    
              volume: 0.8,
              isMuted: false,
              isSoloed: false,
              position: 0,
              sunoClipId: d.stemClipId,
              generationJobId: null,
              projectId: project.id,
              versions: [],
              versionCursor: 0,
            });
          }
          addToast("Stems split! You can now mix individual layers.", "success");
        };

        const deliverStem = (stemType: StemType, audioUrl: string, stemClipId: string) => {
          if (deliveredStems.has(stemType)) return;
          if (!audioUrl || audioUrl === "/api/audio-proxy?url=") return;
          deliveredStems.add(stemType);

          if (!swapped && CORE_STEMS.includes(stemType)) {
            // Buffer core stem and check if we can swap
            pendingCore.set(stemType, { audioUrl, stemClipId });
            trySwap();
          } else if (swapped && CORE_STEMS.includes(stemType)) {
            // Late-arriving core stem (already swapped) — add directly as a layer
            addLayer({
              name: stemTypeDisplayName(stemType),
              stemType,
              prompt,
              audioUrl,
    
              volume: 0.8,
              isMuted: false,
              isSoloed: false,
              position: 0,
              sunoClipId: stemClipId,
              generationJobId: null,
              projectId: project.id,
              versions: [],
              versionCursor: 0,
            });
          } else {
            // Non-core stem → cache for user to add manually
            appendStemCache([{
              stemType,
              audioUrl,
              sunoClipId: stemClipId,
              fromClipId: clipIds[0],
              createdAt: new Date().toISOString(),
            }]);
          }
        };

        // Fire both pipelines — neither blocks the UI
        const demucsPromise = stemDemucs(completedClip.audio_url, clipIds[0])
          .then((r) => {
            for (const s of r.stems) {
              deliverStem(s.stemType, proxyAudioUrl(s.audioUrl), clipIds[0]);
            }
          })
          .catch((err) => console.warn("Demucs failed (falling back to Suno):", err));

        const sunoPromise = stem(clipIds[0])
          .then((sunoData) => {
            const stemClipIds = sunoData.clips?.map((c) => c.id) || [];
            if (stemClipIds.length === 0) return;
            return pollStemsProgressively(
              stemClipIds,
              (stemClip) => {
                if (!stemClip.audio_url) return;
                const stemType = (stemTitleToType(stemClip.title) || "fx") as StemType;
                deliverStem(stemType, proxyAudioUrl(stemClip.audio_url), stemClip.id);
              },
              { intervalMs: POLL_INTERVALS.stem, timeoutMs: 300000 }
            );
          })
          .catch((err) => console.warn("Suno stems failed:", err));

        // Non-blocking: notify user if both pipelines fail
        Promise.allSettled([demucsPromise, sunoPromise]).then(() => {
          if (deliveredStems.size === 0) {
            addToast("Stem separation failed, but your track is playing.", "info");
          }
        });

        return { cachedStemTypes: [] as StemType[] };
      } catch (error) {
        setGenerationPhase("error");
        addToast(
          error instanceof Error ? error.message : "Generation failed",
          "error"
        );
        setTimeout(() => setGenerationPhase("idle"), 3000);
        return null;
      }
    },
    [addLayer, removeLayer, updateLayer, setVibePrompt, setOriginalClipId, appendStemCache, addToast, project.id]
  );

  const handleAddLayer = useCallback(
    async (targetStemType: StemType, tags: string) => {
      // Read latest state via ref — closure `project` can be stale when background
      // polling (appendStemCache) has queued updates that haven't re-rendered yet.
      const p = projectRef.current;
      if (!p.originalClipId) {
        addToast("Generate a track first", "info");
        return "Error: No track generated yet. Call generate_track first.";
      }

      // Atomic cache consume — uses flushSync + setProject(prev => ...) internally,
      // so it reads the absolute latest state (including pending appendStemCache
      // additions that haven't rendered yet). Also atomically removes the entry,
      // preventing the race where a stale setStemCache overwrites concurrent cache
      // additions from background polling (Bug #6 + Bug #9).
      const cached = consumeCachedStem(targetStemType);
      if (cached) {
        addLayer({
          name: stemTypeDisplayName(targetStemType),
          stemType: targetStemType,
          prompt: tags,
          audioUrl: cached.audioUrl,

          volume: 0.8,
          isMuted: false,
          isSoloed: false,
          position: 0,
          sunoClipId: cached.sunoClipId,
          generationJobId: null,
          projectId: p.id,
          versions: [],
          versionCursor: 0,
        });
        addToast("Layer added from cache!", "success");
        // After flushSync in consumeCachedStem, projectRef is fresh
        const remainingTypes = projectRef.current.stemCache
          .filter((s) => s.audioUrl && s.audioUrl !== "/api/audio-proxy?url=")
          .map((s) => s.stemType).join(", ");
        return `${stemTypeDisplayName(targetStemType)} added from cache (instant). Layers: ${p.layers.length + 1}. Remaining cached: ${remainingTypes || "none"}.`;
      }

      // Not cached -- create placeholder layer with per-layer generation status
      const placeholderId = addLayer({
        name: stemTypeDisplayName(targetStemType),
        stemType: targetStemType,
        prompt: tags,
        audioUrl: null,
        volume: 0.8,
        isMuted: false,
        isSoloed: false,
        position: 0,
        sunoClipId: null,
        generationJobId: null,
        projectId: p.id,
        generationStatus: "generating",
        versions: [],
        versionCursor: 0,
      });

      try {
        const data = await generate({
          topic: tags,
          tags,
          cover_clip_id: p.originalClipId,
        });

        const clipId = data.clips?.[0]?.id;
        if (!clipId) throw new Error("No clip returned");

        await pollUntilDone([clipId], {
          // Stem separation requires status=complete (Bug #2)
          acceptStreaming: false,
          intervalMs: Math.min(POLL_INTERVALS.clip, 2500),
          timeoutMs: 180000,
        });

        updateLayer(placeholderId, { generationStatus: "separating" });
        const stemData = await stem(clipId);
        const stemIds = stemData.clips?.map((c) => c.id) || [];
        if (stemIds.length === 0) throw new Error("No stem clips returned");

        // Poll until the target stem is ready — resolves as soon as it completes
        // instead of waiting for all 12 stems (saves 30-90s)
        const matchingStem = await pollForTargetStem(stemIds, targetStemType, {
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        updateLayer(placeholderId, { generationStatus: "loading" });
        updateLayer(placeholderId, {
          name: matchingStem.title,
          audioUrl: proxyAudioUrl(matchingStem.audio_url),
          sunoClipId: matchingStem.id,
          generationStatus: undefined,
        });
        addToast(`${stemTypeDisplayName(targetStemType)} layer added!`, "success");
        return `${stemTypeDisplayName(targetStemType)} layer generated and added. Layers: ${projectRef.current.layers.length}.`;
      } catch (error) {
        updateLayer(placeholderId, { generationStatus: "error" });
        const msg = error instanceof Error ? error.message : "Add layer failed";
        console.error(`[handleAddLayer] Failed for "${targetStemType}":`, msg);
        addToast(msg, "error");
        return `Failed to add ${stemTypeDisplayName(targetStemType)}: ${msg}`;
      }
    },
    [addLayer, updateLayer, consumeCachedStem, addToast] // eslint-disable-line react-hooks/exhaustive-deps -- reads from projectRef for freshness
  );

  const handleRegenerate = useCallback(
    async (layerId: string, prompt: string) => {
      const p = projectRef.current;
      const layer = p.layers.find((l) => l.id === layerId);
      if (!layer || !p.originalClipId) return "Error: Layer not found or no track generated.";

      // Push current audio to version history before overwriting
      if (layer.audioUrl) {
        pushVersion(layerId, {
          audioUrl: layer.audioUrl,
          sunoClipId: layer.sunoClipId,
          prompt: layer.prompt,
          createdAt: new Date().toISOString(),
        });
      }

      updateLayer(layerId, { generationStatus: "generating" });

      try {
        const stemTypeTag =
          STEM_TYPE_TAGS[layer.stemType as keyof typeof STEM_TYPE_TAGS] || "";
        const tags = `${stemTypeTag}, ${prompt}`;

        // Auto-include lyrics for vocal layers
        const isVocalLayer = layer.stemType === "vocals" || layer.stemType === "backing_vocals";
        const currentLyrics = lyricsRef.current;
        const lyricsPrompt = isVocalLayer && currentLyrics.trim() ? currentLyrics : undefined;

        // Do NOT pass cover_clip_id for regeneration — covers maintain the
        // original song's melody/harmony/structure, so extracted stems end up
        // nearly identical to the originals.  Fresh generation with stem-specific
        // tags + the user's prompt produces a genuinely different result.
        const data = await generate({
          topic: lyricsPrompt ? undefined : prompt,
          prompt: lyricsPrompt,
          tags,
        });

        const clipId = data.clips?.[0]?.id;
        if (!clipId) throw new Error("No clip returned");

        await pollUntilDone([clipId], {
          // Stem separation requires status=complete (Bug #2)
          acceptStreaming: false,
          intervalMs: Math.min(POLL_INTERVALS.clip, 2500),
          timeoutMs: 180000,
        });

        updateLayer(layerId, { generationStatus: "separating" });
        const stemData = await stem(clipId);
        const stemIds = stemData.clips?.map((c) => c.id) || [];
        if (stemIds.length === 0) throw new Error("No stem clips returned");

        // Poll until the target stem is ready — resolves as soon as it completes
        // instead of waiting for all 12 stems (saves 30-90s)
        const matchingStem = await pollForTargetStem(stemIds, layer.stemType as StemType, {
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        updateLayer(layerId, {
          audioUrl: proxyAudioUrl(matchingStem.audio_url),
          prompt,
          sunoClipId: matchingStem.id,
          generationStatus: undefined,
        });
        addToast(
          `${STEM_LABELS[layer.stemType]} regenerated! Use version history to compare.`,
          "success"
        );
        return `${STEM_LABELS[layer.stemType]} regenerated with: "${prompt}". Previous version saved to history — navigate with version controls.`;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Regeneration failed";
        addToast(msg, "error");

        // Revert on failure — version history already has the old version
        updateLayer(layerId, { generationStatus: undefined });
        return `Regeneration failed: ${msg}`;
      }
    },
    [updateLayer, pushVersion, addToast]
  );

  const regenerateVocalsWithLyrics = useCallback(
    async (vocalLayerId: string, lyricsText: string) => {
      const p = projectRef.current;
      const layer = p.layers.find((l) => l.id === vocalLayerId);
      if (!layer || !p.originalClipId) {
        addToast("Cannot regenerate: layer or original track missing", "error");
        return;
      }

      if (layer.generationStatus) {
        addToast("Vocals are already being regenerated", "info");
        return;
      }

      // Push current audio to version history before overwriting
      if (layer.audioUrl) {
        pushVersion(vocalLayerId, {
          audioUrl: layer.audioUrl,
          sunoClipId: layer.sunoClipId,
          prompt: layer.prompt,
          createdAt: new Date().toISOString(),
        });
      }

      updateLayer(vocalLayerId, { generationStatus: "generating" });

      try {
        // No cover_clip_id — same reasoning as handleRegenerate: covers
        // preserve the original's vocal melody, producing near-identical stems.
        const data = await generate({
          prompt: lyricsText,
          tags: STEM_TYPE_TAGS[layer.stemType as keyof typeof STEM_TYPE_TAGS] || "vocals, singing, voice",
        });

        const clipId = data.clips?.[0]?.id;
        if (!clipId) throw new Error("No clip returned");

        await pollUntilDone([clipId], {
          // Stem separation requires status=complete (Bug #2)
          acceptStreaming: false,
          intervalMs: Math.min(POLL_INTERVALS.clip, 2500),
          timeoutMs: 180000,
        });

        updateLayer(vocalLayerId, { generationStatus: "separating" });
        const stemData = await stem(clipId);
        const stemIds = stemData.clips?.map((c) => c.id) || [];
        if (stemIds.length === 0) throw new Error("No stem clips returned");

        const matchingStem = await pollForTargetStem(stemIds, layer.stemType as StemType, {
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        updateLayer(vocalLayerId, {
          audioUrl: proxyAudioUrl(matchingStem.audio_url),
          prompt: lyricsText,
          sunoClipId: matchingStem.id,
          generationStatus: undefined,
        });

        addToast("Vocals regenerated with new lyrics!", "success");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Vocal regeneration failed";
        addToast(msg, "error");
        updateLayer(vocalLayerId, { generationStatus: undefined });
      }
    },
    [updateLayer, pushVersion, addToast]
  );

  const handleModalRegenerate = useCallback(
    (prompt: string) => {
      if (!regenLayerId) return;
      handleRegenerate(regenLayerId, prompt);
      setRegenLayerId(null);
    },
    [regenLayerId, handleRegenerate]
  );

  const handleDelete = useCallback(() => {
    if (!deleteLayerId) return;
    removeLayer(deleteLayerId);
    addToast("Layer removed", "info");
  }, [deleteLayerId, removeLayer, addToast]);

  const handleSetLyrics = useCallback((newLyrics: string) => {
    setLyrics(newLyrics);
    setLyricsOpen(true);
  }, []);

  const handleUseLyrics = useCallback(() => {
    const currentLyrics = lyricsRef.current.trim();
    if (!currentLyrics) {
      addToast("Please write some lyrics first", "info");
      return;
    }

    const pLayers = projectRef.current.layers;
    const vocalLayer =
      pLayers.find((l) => l.stemType === "vocals") ||
      pLayers.find((l) => l.stemType === "backing_vocals");

    // Close panel first — gives visual space for sidebar loading animation
    setLyricsOpen(false);

    if (vocalLayer) {
      void regenerateVocalsWithLyrics(vocalLayer.id, currentLyrics);
    } else {
      addToast("Lyrics saved for next generation", "success");
    }
  }, [addToast, regenerateVocalsWithLyrics]);

  const handleChatGenerate = useCallback(
    async (
      topic: string,
      tags: string,
      instrumental: boolean,
      options?: { negative_tags?: string; lyrics?: string }
    ): Promise<string> => {
      const currentLyrics = lyricsRef.current;
      const effectiveLyrics = options?.lyrics || (currentLyrics.trim() ? currentLyrics : undefined);
      const genOpts = { tags, negative_tags: options?.negative_tags, lyrics: effectiveLyrics };

      if (agentModeRef.current) {
        const result = await handleGenerate(topic, instrumental, genOpts);
        if (!result) return "Track generation failed. Check error details and try again with different tags.";
        return `Track generated and playing. Stems are separating in background — call get_composition_state to check which stems are cached before adding layers. Cached stems load instantly via add_layer.`;
      }

      handleGenerate(topic, instrumental, genOpts);
      return `Started generating track: "${topic}" with tags: ${tags}`;
    },
    [handleGenerate]
  );

  const handleChatAddLayer = useCallback(
    async (stemType: StemType, tags: string): Promise<string> => {
      if (agentModeRef.current) {
        return handleAddLayer(stemType, tags);
      }
      handleAddLayer(stemType, tags);
      return `Adding ${stemTypeDisplayName(stemType)} layer`;
    },
    [handleAddLayer]
  );

  const handleChatRegenerate = useCallback(
    async (layerId: string, description: string): Promise<string> => {
      if (agentModeRef.current) {
        return handleRegenerate(layerId, description);
      }
      handleRegenerate(layerId, description);
      return `Regenerating layer with: "${description}"`;
    },
    [handleRegenerate]
  );

  // Landing → Chat flow: read prompt from URL via useSearchParams (works
  // reliably during Next.js App Router client-side navigation, unlike
  // window.location.search which may not be committed yet on first render).
  const searchParams = useSearchParams();
  const urlPrompt = searchParams.get("prompt");

  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [chatActive, setChatActive] = useState(false);
  // Incrementing chatSessionKey forces ChatPanel to remount fresh —
  // clears stale initialMessages (including incomplete tool calls that
  // would keep useChat status stuck and block sendMessage).
  const [chatSessionKey, setChatSessionKey] = useState(0);

  // Shared "start fresh session" logic for both entry modes
  const startFreshSession = useCallback((prompt: string) => {
    resetProject();
    try { localStorage.removeItem("producething_chat_messages"); } catch { /* ignore */ }
    setChatSessionKey((k) => k + 1);
    setPendingMessage(prompt);
    setChatActive(true);
  }, [resetProject]);

  // Pick up prompt from URL (landing page → studio navigation)
  const urlPromptConsumed = useRef(false);
  useEffect(() => {
    if (urlPrompt && !urlPromptConsumed.current) {
      urlPromptConsumed.current = true;
      startFreshSession(urlPrompt);
      window.history.replaceState({}, "", "/studio");
    }
  }, [urlPrompt, startFreshSession]);

  const handleLandingSubmit = useCallback((prompt: string) => {
    startFreshSession(prompt);
  }, [startFreshSession]);

  // Stable callback — inline arrows would create new refs every render,
  // causing ChatPanel's useEffect to re-run and cancel the sendMessage timeout.
  const handlePendingConsumed = useCallback(() => setPendingMessage(null), []);

  // Track whether the user has actively started a session in this tab.
  // Initialized from sessionStorage so it survives page navigations (e.g.
  // studio → video → back) and refreshes, but clears when the tab closes
  // so new tabs always show the landing page.
  const [sessionStarted, setSessionStarted] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("producething_session_active") === "true";
  });

  // Persist session flag to sessionStorage whenever it becomes true
  useEffect(() => {
    if (sessionStarted) {
      try { sessionStorage.setItem("producething_session_active", "true"); } catch { /* ignore */ }
    }
  }, [sessionStarted]);

  // Detect existing project: if localStorage has layers with audio, this is a
  // valid project the user was working on — skip straight to the studio.
  const hasExistingProject = layers.some((l) => !!l.audioUrl);

  useEffect(() => {
    if (!sessionStarted && (hasExistingProject || generationPhase !== "idle" || pendingMessage || chatActive || urlPrompt)) {
      setSessionStarted(true);
    }
  }, [sessionStarted, hasExistingProject, generationPhase, pendingMessage, chatActive, urlPrompt]);

  // Show landing unless the user has an existing project or has actively started something.
  const showLanding =
    !sessionStarted &&
    generationPhase === "idle" &&
    !pendingMessage &&
    !chatActive &&
    !urlPrompt;

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d] text-white overflow-hidden">
      <StudioHeader
        projectTitle={project.title}
        layers={layers}
        lyricsOpen={lyricsOpen}
        onToggleLyrics={() => setLyricsOpen((o) => !o)}
        onExportMix={exportAudio}
        showLanding={showLanding}
        onCreateVideo={() => {
          // Stop audio before navigating — cleanup also runs on unmount,
          // but explicitly stopping is more reliable and immediate
          stopAudio();
          setIsPlaying(false);
          if (previewAudioRef.current) {
            previewAudioRef.current.pause();
          }
          router.push("/studio/video");
        }}
      />

      {/* Landing overlay — covers the studio when no project */}
      {showLanding && (
        <StudioLanding
          onSubmit={handleLandingSubmit}
          isSubmitting={!!pendingMessage || chatActive}
          pendingPrompt={pendingMessage ?? undefined}
          modelProvider={modelProvider}
          onModelProviderChange={setModelProvider}
          agentMode={agentMode}
          onAgentModeChange={setAgentMode}
          lyrics={lyrics}
          onLyricsChange={setLyrics}
        />
      )}

      {/* Studio layout — always rendered for waveform-playlist init, hidden behind landing */}
      <div className={`flex-1 flex overflow-hidden ${showLanding ? "invisible absolute" : ""}`}>
        {/* Left: AI Chat */}
        <ChatPanel
          key={chatSessionKey}
          project={project}
          isGenerating={isInitialGenerating}
          hasLayers={layers.length > 0}
          pendingMessage={pendingMessage}
          onPendingMessageConsumed={handlePendingConsumed}
          onGenerateTrack={handleChatGenerate}
          onAddLayer={handleChatAddLayer}
          onRegenerateLayer={handleChatRegenerate}
          onRemoveLayer={(id) => {
            removeLayer(id);
            addToast("Layer removed", "info");
          }}
          onSetLyrics={handleSetLyrics}
          modelProvider={modelProvider}
          onModelProviderChange={setModelProvider}
          agentMode={agentMode}
          onAgentModeChange={setAgentMode}
        />

        {/* Center: Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 flex overflow-hidden">
            {layers.length > 0 && (
              <LayerSidebar
                layers={layers}
                onToggleMute={toggleMute}
                onToggleSolo={toggleSolo}
                onVolumeChange={setLayerVolume}
                onRegenerate={(id) => setRegenLayerId(id)}
                onDelete={(id) => setDeleteLayerId(id)}
                onNavigateOlder={navigateVersionOlder}
                onNavigateNewer={navigateVersionNewer}
              />
            )}
            <WaveformDisplay
              layers={layers}
              playlistContainerRef={playlistContainerRef}
            />
          </div>
          <GenerationOverlay phase={generationPhase} />
          <TransportBar
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={project.duration}
            zoom={zoom}
            masterVolume={masterVolume}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={() => {
              handlePause();
              setCurrentTime(0);
              stopAudio();
            }}
            onRewind={() => {
              setCurrentTime(0);
              rewindAudio();
            }}
            onSeek={setCurrentTime}
            onSeekCommit={seekAudio}
            onZoomIn={() => setZoom((z) => Math.min(z * 1.25, 10))}
            onZoomOut={() => setZoom((z) => Math.max(z / 1.25, 0.25))}
            onMasterVolumeChange={setMasterVolume}
          />
        </div>

        {/* Right: Lyrics Panel */}
        {lyricsOpen && (
          <LyricsPanel
            lyrics={lyrics}
            onLyricsChange={setLyrics}
            onClose={() => setLyricsOpen(false)}
            onUseLyrics={handleUseLyrics}
            hasVocalLayer={layers.some((l) => l.stemType === "vocals" || l.stemType === "backing_vocals")}
          />
        )}
      </div>

      <RegenerateModal
        open={!!regenLayerId}
        layerName={regenLayer ? STEM_LABELS[regenLayer.stemType] : ""}
        onClose={() => setRegenLayerId(null)}
        onRegenerate={handleModalRegenerate}
      />

      <DeleteDialog
        open={!!deleteLayerId}
        onClose={() => setDeleteLayerId(null)}
        onConfirm={handleDelete}
      />

      {/* Hidden audio element for streaming preview during generation */}
      <audio ref={previewAudioRef} hidden />
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense>
      <ToastProvider>
        <StudioApp />
      </ToastProvider>
    </Suspense>
  );
}
