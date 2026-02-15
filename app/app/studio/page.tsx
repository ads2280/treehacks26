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
import { generate, stem, pollUntilDone, pollStemsProgressively, proxyAudioUrl, stemTitleToType } from "@/lib/api";
import { STEM_TYPE_TAGS, POLL_INTERVALS, STEM_LABELS } from "@/lib/layertune-types";
import type { GenerationPhase, StemType, CachedStem } from "@/lib/layertune-types";

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

  const regenLayer = layers.find((l) => l.id === regenLayerId);
  const playlistContainerRef = useRef<HTMLDivElement>(null);

  // Stable refs for callbacks that need current state without re-creating
  const projectRef = useRef(project);
  const abSelectedRef = useRef(abSelectedVersions);
  const lyricsRef = useRef(lyrics);
  useEffect(() => { projectRef.current = project; });
  useEffect(() => { abSelectedRef.current = abSelectedVersions; });
  useEffect(() => { lyricsRef.current = lyrics; });

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

        // Wait for full completion before stem separation
        await pollUntilDone(clipIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000,
        });

        setGenerationPhase("separating");
        const stemData = await stem(clipIds[0]);
        const stemClipIds = stemData.clips?.map((c) => c.id) || [];
        if (stemClipIds.length === 0) throw new Error("No stem clips returned");

        // Progressive stem loading — waveforms populate one by one as each stem completes
        const cachedStems: CachedStem[] = [];
        let drumsAdded = false;

        await pollStemsProgressively(
          stemClipIds,
          (stemClip) => {
            if (!stemClip.audio_url) return;
            const stemType = (stemTitleToType(stemClip.title) || "fx") as StemType;

            if (stemType === "drums" && !drumsAdded) {
              drumsAdded = true;
              setGenerationPhase("loading");
              addLayer({
                name: stemClip.title,
                stemType,
                prompt,
                audioUrl: proxyAudioUrl(stemClip.audio_url),
                previousAudioUrl: null,
                volume: 0.8,
                isMuted: false,
                isSoloed: false,
                position: 0,
                sunoClipId: stemClip.id,
                generationJobId: null,
                projectId: project.id,
              });
              addToast("Drums ready! More stems loading...", "success");
            } else {
              cachedStems.push({
                stemType,
                audioUrl: proxyAudioUrl(stemClip.audio_url),
                sunoClipId: stemClip.id,
                fromClipId: clipIds[0],
                createdAt: new Date().toISOString(),
              });
            }
          },
          {
            intervalMs: POLL_INTERVALS.stem,
            timeoutMs: 300000,
          }
        );

        setStemCache(cachedStems);
        setGenerationPhase("complete");
        addToast("All stems ready! Add more layers to build your track.", "success");
        setTimeout(() => setGenerationPhase("idle"), 2000);
      } catch (error) {
        setGenerationPhase("error");
        addToast(
          error instanceof Error ? error.message : "Generation failed",
          "error"
        );
        setTimeout(() => setGenerationPhase("idle"), 3000);
      }
    },
    [addLayer, setVibePrompt, setOriginalClipId, setStemCache, addToast, project.id]
  );

  const handleAddLayer = useCallback(
    async (targetStemType: StemType, tags: string) => {
      if (!project.originalClipId) {
        addToast("Generate a track first", "info");
        return;
      }

      // Try cache first for instant layer add (read state directly — see Bug #6)
      const cached = project.stemCache.find((s) => s.stemType === targetStemType);
      if (cached?.audioUrl) {
        setStemCache(project.stemCache.filter((s) => s !== cached));
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
        return;
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

        const stemClips = await pollUntilDone(stemIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        updateLayer(placeholderId, { generationStatus: "loading" });
        const matchingStem = stemClips.find(
          (s) => stemTitleToType(s.title) === targetStemType
        );

        if (matchingStem?.audio_url) {
          updateLayer(placeholderId, {
            name: matchingStem.title,
            audioUrl: proxyAudioUrl(matchingStem.audio_url),
            sunoClipId: matchingStem.id,
            generationStatus: undefined,
          });
          addToast(`${matchingStem.title} layer added!`, "success");
        } else {
          throw new Error(
            `No ${targetStemType} stem found in generated track`
          );
        }
      } catch (error) {
        updateLayer(placeholderId, { generationStatus: "error" });
        addToast(
          error instanceof Error ? error.message : "Add layer failed",
          "error"
        );
      }
    },
    [project.originalClipId, project.id, project.stemCache, addLayer, updateLayer, setStemCache, addToast]
  );

  const handleRegenerate = useCallback(
    async (layerId: string, prompt: string) => {
      const p = projectRef.current;
      const layer = p.layers.find((l) => l.id === layerId);
      if (!layer || !p.originalClipId) return;

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

        // Fast path: for regeneration we only need this layer's stem, not all stems.
        const targetStemIds = stemData.clips
          ?.filter((clip) => stemTitleToType(clip.title) === layer.stemType)
          .map((clip) => clip.id) || [];
        const idsToPoll = targetStemIds.length > 0 ? targetStemIds : stemIds;

        const stemClips = await pollUntilDone(idsToPoll, {
          // For layer regen, streaming stem output is sufficient for immediate A/B.
          acceptStreaming: true,
          intervalMs: Math.min(POLL_INTERVALS.stem, 3000),
          timeoutMs: 300000,
        });

        const matchingStem = stemClips.find(
          (s) => stemTitleToType(s.title) === layer.stemType
        ) || stemData.clips.find((s) => stemTitleToType(s.title) === layer.stemType);

        if (matchingStem?.audio_url) {
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
        } else {
          throw new Error("Matching stem not found");
        }
      } catch (error) {
        addToast(
          error instanceof Error ? error.message : "Regeneration failed",
          "error"
        );

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
    (
      topic: string,
      tags: string,
      instrumental: boolean,
      options?: { negative_tags?: string; lyrics?: string }
    ) => {
      // Merge stored lyrics if no explicit lyrics provided
      const currentLyrics = lyricsRef.current;
      const effectiveLyrics = options?.lyrics || (currentLyrics.trim() ? currentLyrics : undefined);
      handleGenerate(topic, instrumental, {
        tags,
        negative_tags: options?.negative_tags,
        lyrics: effectiveLyrics,
      });
    },
    [handleGenerate]
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
          onAddLayer={handleAddLayer}
          onRegenerateLayer={handleRegenerate}
          onRemoveLayer={(id) => {
            removeLayer(id);
            addToast("Layer removed", "info");
          }}
          onSetLyrics={handleSetLyrics}
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
