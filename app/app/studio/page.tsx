"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
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
import type { GenerationPhase, StemType, CachedStem, ModelProvider } from "@/lib/layertune-types";

function stemTypeDisplayName(stemType: StemType): string {
  return stemType.charAt(0).toUpperCase() + stemType.slice(1).replace("_", " ");
}

const ChatPanel = dynamic(
  () => import("@/components/studio/chat-panel").then((m) => m.ChatPanel),
  { ssr: false }
);

function StudioApp() {
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
    setOriginalClipId,
    setABState,
    startABComparison,
    setStemCache,
  } = useProject();

  const { addToast } = useToasts();

  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>("idle");
  const isInitialGenerating = generationPhase !== "idle";
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [regenLayerId, setRegenLayerId] = useState<string | null>(null);
  const [deleteLayerId, setDeleteLayerId] = useState<string | null>(null);
  const [abSelectedVersions, setAbSelectedVersions] = useState<Record<string, "a" | "b">>({});
  const [lyrics, setLyrics] = useState("");
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [modelProvider, setModelProvider] = useState<ModelProvider>("openai");
  const [agentMode, setAgentMode] = useState(false);

  const regenLayer = layers.find((l) => l.id === regenLayerId);
  const playlistContainerRef = useRef<HTMLDivElement>(null);

  // Stable refs for callbacks that need current state without re-creating
  const projectRef = useRef(project);
  const abSelectedRef = useRef(abSelectedVersions);
  const lyricsRef = useRef(lyrics);
  useEffect(() => { projectRef.current = project; });
  useEffect(() => { abSelectedRef.current = abSelectedVersions; });
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

  // A/B: swap audioUrl <-> previousAudioUrl to toggle which version is audible
  const handleSelectABVersion = useCallback(
    (layerId: string, version: "a" | "b") => {
      const currentVersion = abSelectedRef.current[layerId] || "b";
      if (currentVersion === version) return;

      setAbSelectedVersions((prev) => ({ ...prev, [layerId]: version }));
      const layer = projectRef.current.layers.find((l) => l.id === layerId);
      if (!layer || !layer.previousAudioUrl) return;

      updateLayer(layerId, {
        audioUrl: layer.previousAudioUrl,
        previousAudioUrl: layer.audioUrl,
      });
    },
    [updateLayer]
  );

  const handleKeepVersion = useCallback(
    (layerId: string, version: "a" | "b") => {
      const currentlyShowing = abSelectedRef.current[layerId] || "b";

      // If the displayed version differs from the one to keep, swap audio URLs
      if (currentlyShowing !== version) {
        const layer = projectRef.current.layers.find((l) => l.id === layerId);
        if (layer?.previousAudioUrl) {
          updateLayer(layerId, {
            audioUrl: layer.previousAudioUrl,
            previousAudioUrl: null,
          });
        }
      } else {
        updateLayer(layerId, { previousAudioUrl: null });
      }

      setAbSelectedVersions((prev) => {
        const next = { ...prev };
        delete next[layerId];
        return next;
      });
      setABState(layerId, "none");

      if (version === "a") {
        addToast("Reverted to original version", "info");
      } else {
        addToast("New version kept!", "success");
      }
    },
    [updateLayer, setABState, addToast]
  );

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

        // Wait for clip to fully complete before loading into waveform-playlist.
        // waveform-playlist needs the complete audio buffer for decodeAudioData() —
        // streaming URLs (audiopipe.suno.ai) block the download until generation
        // finishes, causing a long "Loading audio" hang.
        const completedClips = await pollUntilDone(clipIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000,
        });

        const completedClip = completedClips[0];
        if (!completedClip.audio_url) throw new Error("No audio URL returned from generation");

        // Add full mix layer with final CDN URL — download + decode is fast (~2-3s)
        setGenerationPhase("loading");
        const mixLayerId = addLayer({
          name: "Full Mix",
          stemType: "drums" as StemType,
          prompt,
          audioUrl: proxyAudioUrl(completedClip.audio_url),
          previousAudioUrl: null,
          volume: 0.8,
          isMuted: false,
          isSoloed: false,
          position: 0,
          sunoClipId: clipIds[0],
          generationJobId: null,
          projectId: project.id,
        });
        addToast("Track ready! Separating stems in background...", "success");

        setGenerationPhase("separating");

        // Phase 3: Parallel stem separation — Demucs (fast, 3 stems) + Suno (12 stems)
        const deliveredStems = new Set<StemType>();
        const cachedStems: CachedStem[] = [];
        let firstStemReplaced = false;

        const deliverStem = (stemType: StemType, audioUrl: string, stemClipId: string) => {
          if (deliveredStems.has(stemType)) return;
          deliveredStems.add(stemType);

          if (!firstStemReplaced && stemType === "drums") {
            // Replace the Full Mix with the first real stem (drums)
            firstStemReplaced = true;
            updateLayer(mixLayerId, {
              name: stemTypeDisplayName(stemType),
              stemType,
              audioUrl,
              sunoClipId: stemClipId,
            });
          } else {
            cachedStems.push({
              stemType,
              audioUrl,
              sunoClipId: stemClipId,
              fromClipId: clipIds[0],
              createdAt: new Date().toISOString(),
            });
          }
        };

        const demucsPromise = stemDemucs(completedClip.audio_url, clipIds[0])
          .then((r) => {
            for (const s of r.stems) {
              deliverStem(s.stemType, proxyAudioUrl(s.audioUrl), clipIds[0]);
            }
          })
          .catch((err) => console.warn("Demucs failed (falling back to Suno):", err));

        const sunoPromise = (async () => {
          const stemData = await stem(clipIds[0]);
          const stemClipIds = stemData.clips?.map((c) => c.id) || [];
          if (stemClipIds.length === 0) throw new Error("No stem clips returned");

          await pollStemsProgressively(
            stemClipIds,
            (stemClip) => {
              if (!stemClip.audio_url) return;
              const stemType = (stemTitleToType(stemClip.title) || "fx") as StemType;
              deliverStem(stemType, proxyAudioUrl(stemClip.audio_url), stemClip.id);
            },
            { intervalMs: POLL_INTERVALS.stem, timeoutMs: 300000 }
          );
        })();

        await Promise.allSettled([demucsPromise, sunoPromise]);

        if (!firstStemReplaced && cachedStems.length === 0) {
          // Stems failed but full mix is still playing — graceful degradation
          addToast("Stem separation failed, but your track is playing.", "info");
        }

        setStemCache(cachedStems);
        setGenerationPhase("complete");
        addToast("All stems ready! Add more layers to build your track.", "success");
        setTimeout(() => setGenerationPhase("idle"), 2000);
        return { cachedStemTypes: cachedStems.map((s) => s.stemType) };
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
    [addLayer, setVibePrompt, setOriginalClipId, setStemCache, addToast, project.id]
  );

  const handleAddLayer = useCallback(
    async (targetStemType: StemType, tags: string) => {
      if (!project.originalClipId) {
        addToast("Generate a track first", "info");
        return "Error: No track generated yet. Call generate_track first.";
      }

      // Try cache first for instant layer add (read state directly — see Bug #6)
      const cached = project.stemCache.find((s) => s.stemType === targetStemType);
      if (cached?.audioUrl) {
        const remaining = project.stemCache.filter((s) => s !== cached);
        setStemCache(remaining);
        addLayer({
          name: stemTypeDisplayName(targetStemType),
          stemType: targetStemType,
          prompt: tags,
          audioUrl: cached.audioUrl,
          previousAudioUrl: null,
          volume: 0.8,
          isMuted: false,
          isSoloed: false,
          position: 0,
          sunoClipId: cached.sunoClipId,
          generationJobId: null,
          projectId: project.id,
        });
        addToast("Layer added from cache!", "success");
        const remainingTypes = remaining.map((s) => s.stemType).join(", ");
        return `${stemTypeDisplayName(targetStemType)} added from cache (instant). Layers: ${project.layers.length + 1}. Remaining cached: ${remainingTypes || "none"}.`;
      }

      // Not cached -- create placeholder layer with per-layer generation status
      const placeholderId = addLayer({
        name: stemTypeDisplayName(targetStemType),
        stemType: targetStemType,
        prompt: tags,
        audioUrl: null,
        previousAudioUrl: null,
        volume: 0.8,
        isMuted: false,
        isSoloed: false,
        position: 0,
        sunoClipId: null,
        generationJobId: null,
        projectId: project.id,
        generationStatus: "generating",
      });

      try {
        const data = await generate({
          topic: tags,
          tags,
          cover_clip_id: project.originalClipId,
        });

        const clipId = data.clips?.[0]?.id;
        if (!clipId) throw new Error("No clip returned");

        await pollUntilDone([clipId], {
          // Layer add can use streaming-ready audio to reduce wait time.
          acceptStreaming: true,
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
        return `${stemTypeDisplayName(targetStemType)} layer generated and added. Layers: ${project.layers.length + 1}.`;
      } catch (error) {
        updateLayer(placeholderId, { generationStatus: "error" });
        const msg = error instanceof Error ? error.message : "Add layer failed";
        console.error(`[handleAddLayer] Failed for "${targetStemType}":`, msg);
        addToast(msg, "error");
        return `Failed to add ${stemTypeDisplayName(targetStemType)}: ${msg}`;
      }
    },
    [project.originalClipId, project.id, project.stemCache, addLayer, updateLayer, setStemCache, addToast]
  );

  const handleRegenerate = useCallback(
    async (layerId: string, prompt: string) => {
      const p = projectRef.current;
      const layer = p.layers.find((l) => l.id === layerId);
      if (!layer || !p.originalClipId) return "Error: Layer not found or no track generated.";

      updateLayer(layerId, { previousAudioUrl: layer.audioUrl, generationStatus: "generating" });
      startABComparison(layerId);
      setAbSelectedVersions((prev) => ({ ...prev, [layerId]: "b" }));

      try {
        const stemTypeTag =
          STEM_TYPE_TAGS[layer.stemType as keyof typeof STEM_TYPE_TAGS] || "";
        const tags = `${stemTypeTag}, ${prompt}`;

        // Auto-include lyrics for vocal layers
        const isVocalLayer = layer.stemType === "vocals" || layer.stemType === "backing_vocals";
        const currentLyrics = lyricsRef.current;
        const lyricsPrompt = isVocalLayer && currentLyrics.trim() ? currentLyrics : undefined;

        const data = await generate({
          topic: lyricsPrompt ? undefined : prompt,
          prompt: lyricsPrompt,
          tags,
          cover_clip_id: p.originalClipId,
        });

        const clipId = data.clips?.[0]?.id;
        if (!clipId) throw new Error("No clip returned");

        await pollUntilDone([clipId], {
          // Regeneration can use streaming-ready audio to reduce wait time.
          acceptStreaming: true,
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
          `${STEM_LABELS[layer.stemType]} regenerated! Compare A/B versions.`,
          "success"
        );
        return `${STEM_LABELS[layer.stemType]} regenerated with: "${prompt}". A/B comparison available — user can pick version.`;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Regeneration failed";
        addToast(msg, "error");

        // Revert A/B state on failure
        updateLayer(layerId, {
          audioUrl: layer.audioUrl,
          previousAudioUrl: null,
          generationStatus: undefined,
        });
        setABState(layerId, "none");
        setAbSelectedVersions((prev) => {
          const next = { ...prev };
          delete next[layerId];
          return next;
        });
        return `Regeneration failed: ${msg}`;
      }
    },
    [updateLayer, startABComparison, setABState, addToast]
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
    const vocalLayer = projectRef.current.layers.find(
      (l) => l.stemType === "vocals" || l.stemType === "backing_vocals"
    );
    if (vocalLayer) {
      addToast("Lyrics updated - regenerating vocals", "info");
      void handleRegenerate(vocalLayer.id, vocalLayer.prompt || "vocals");
    } else {
      addToast("Lyrics saved for next generation", "success");
    }
  }, [addToast, handleRegenerate]);

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
        return `Track generated and playing. Stems separated. Cached stems available: ${result.cachedStemTypes.join(", ")}. Call add_layer with any stem type — cached stems load instantly.`;
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

  // Landing → Chat flow: store prompt, let ChatPanel send it to the AI agent
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const handleLandingSubmit = useCallback((prompt: string) => {
    setPendingMessage(prompt);
  }, []);

  // Show landing when no project content, not generating, and no pending message
  const showLanding =
    layers.length === 0 &&
    !project.originalClipId &&
    generationPhase === "idle" &&
    !pendingMessage;

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d] text-white overflow-hidden">
      <StudioHeader
        projectTitle={project.title}
        layers={layers}
        lyricsOpen={lyricsOpen}
        onToggleLyrics={() => setLyricsOpen((o) => !o)}
        onExportMix={exportAudio}
      />

      {/* Landing overlay — covers the studio when no project */}
      {showLanding && (
        <StudioLanding
          onSubmit={handleLandingSubmit}
          isSubmitting={isInitialGenerating}
        />
      )}

      {/* Studio layout — always rendered for waveform-playlist init, hidden behind landing */}
      <div className={`flex-1 flex overflow-hidden ${showLanding ? "invisible absolute" : ""}`}>
        {/* Left: AI Chat */}
        <ChatPanel
          project={project}
          isGenerating={isInitialGenerating}
          hasLayers={layers.length > 0}
          pendingMessage={pendingMessage}
          onPendingMessageConsumed={() => setPendingMessage(null)}
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
                abState={project.abState}
                onToggleMute={toggleMute}
                onToggleSolo={toggleSolo}
                onVolumeChange={setLayerVolume}
                onRegenerate={(id) => setRegenLayerId(id)}
                onDelete={(id) => setDeleteLayerId(id)}
                onSelectAB={handleSelectABVersion}
                onKeepVersion={handleKeepVersion}
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

    </div>
  );
}

export default function StudioPage() {
  return (
    <ToastProvider>
      <StudioApp />
    </ToastProvider>
  );
}
