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
import { generate, stem, pollUntilDone, proxyAudioUrl, stemTitleToType } from "@/lib/api";
import { STEM_TYPE_TAGS, POLL_INTERVALS, STEM_LABELS } from "@/lib/layertune-types";
import type { GenerationPhase, StemType, CachedStem } from "@/lib/layertune-types";

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
    consumeCachedStem,
  } = useProject();

  const { addToast } = useToasts();

  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>("idle");
  const [isGenerating, setIsGenerating] = useState(false);
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

  useEffect(() => {
    if (isPlaying) {
      playAudio();
    } else {
      pauseAudio();
    }
  }, [isPlaying, playAudio, pauseAudio]);

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
        setIsPlaying((prev) => !prev);
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setCurrentTime(0);
        rewindAudio();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [rewindAudio]);

  // A/B: swap audioUrl <-> previousAudioUrl to toggle which version is audible
  const handleSelectABVersion = useCallback(
    (layerId: string, version: "a" | "b") => {
      const currentVersion = abSelectedVersions[layerId] || "b";
      if (currentVersion === version) return;

      setAbSelectedVersions((prev) => ({ ...prev, [layerId]: version }));
      const layer = project.layers.find((l) => l.id === layerId);
      if (!layer || !layer.previousAudioUrl) return;

      updateLayer(layerId, {
        audioUrl: layer.previousAudioUrl,
        previousAudioUrl: layer.audioUrl,
      });
    },
    [project.layers, updateLayer, abSelectedVersions]
  );

  const handleKeepA = useCallback(
    (layerId: string) => {
      const currentVersion = abSelectedVersions[layerId] || "b";
      if (currentVersion === "b") {
        const layer = project.layers.find((l) => l.id === layerId);
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
      addToast("Reverted to original version", "info");
    },
    [abSelectedVersions, project.layers, updateLayer, setABState, addToast]
  );

  const handleKeepB = useCallback(
    (layerId: string) => {
      const currentVersion = abSelectedVersions[layerId] || "b";
      if (currentVersion === "a") {
        const layer = project.layers.find((l) => l.id === layerId);
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
      addToast("New version kept!", "success");
    },
    [abSelectedVersions, project.layers, updateLayer, setABState, addToast]
  );

  const handleKeepVersion = useCallback(
    (layerId: string, version: "a" | "b") => {
      if (version === "a") {
        handleKeepA(layerId);
      } else {
        handleKeepB(layerId);
      }
    },
    [handleKeepA, handleKeepB]
  );

  const handleGenerate = useCallback(
    async (
      prompt: string,
      instrumental: boolean,
      options?: { tags?: string; negative_tags?: string; lyrics?: string }
    ) => {
      setIsGenerating(true);
      setGenerationPhase("generating");
      setVibePrompt(prompt);

      try {
        const data = await generate({
          topic: prompt,
          tags: options?.tags || `drums, beat, rhythm, ${prompt}`,
          make_instrumental: instrumental,
          negative_tags: options?.negative_tags,
          prompt: options?.lyrics || undefined,
        });

        const clipIds = data.clips?.map((c) => c.id) || [];
        if (clipIds.length === 0) throw new Error("No clips returned");

        setOriginalClipId(clipIds[0]);

        // Require 'complete' -- Suno needs full completion before stem separation
        await pollUntilDone(clipIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000,
        });

        setGenerationPhase("separating");
        const stemData = await stem(clipIds[0]);
        const stemClipIds = stemData.clips?.map((c) => c.id) || [];
        if (stemClipIds.length === 0) throw new Error("No stem clips returned");

        const stemClips = await pollUntilDone(stemClipIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        setGenerationPhase("loading");
        const cachedStems: CachedStem[] = [];
        let drumsAdded = false;

        for (const stemClip of stemClips) {
          if (!stemClip.audio_url) continue;
          const stemType = (stemTitleToType(stemClip.title) || "fx") as StemType;

          if (stemType === "drums" && !drumsAdded) {
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
            drumsAdded = true;
          } else {
            cachedStems.push({
              stemType,
              audioUrl: proxyAudioUrl(stemClip.audio_url),
              sunoClipId: stemClip.id,
              fromClipId: clipIds[0],
              createdAt: new Date().toISOString(),
            });
          }
        }

        setStemCache(cachedStems);
        setGenerationPhase("complete");
        addToast("Beat ready! Add more layers to build your track.", "success");
        setTimeout(() => setGenerationPhase("idle"), 2000);
      } catch (error) {
        setGenerationPhase("error");
        addToast(
          error instanceof Error ? error.message : "Generation failed",
          "error"
        );
        setTimeout(() => setGenerationPhase("idle"), 3000);
      } finally {
        setIsGenerating(false);
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

      // Try cache first for instant layer add
      const cached = consumeCachedStem(targetStemType);
      if (cached && cached.audioUrl) {
        const displayName =
          targetStemType.charAt(0).toUpperCase() +
          targetStemType.slice(1).replace("_", " ");
        addLayer({
          name: displayName,
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

      // Not cached -- full generate + stem pipeline
      setIsGenerating(true);
      setGenerationPhase("generating");

      try {
        const data = await generate({
          topic: tags,
          tags,
          cover_clip_id: project.originalClipId,
        });

        const clipId = data.clips?.[0]?.id;
        if (!clipId) throw new Error("No clip returned");

        await pollUntilDone([clipId], {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000,
        });

        setGenerationPhase("separating");
        const stemData = await stem(clipId);
        const stemIds = stemData.clips?.map((c) => c.id) || [];
        if (stemIds.length === 0) throw new Error("No stem clips returned");

        const stemClips = await pollUntilDone(stemIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        setGenerationPhase("loading");
        const matchingStem = stemClips.find(
          (s) => stemTitleToType(s.title) === targetStemType
        );

        if (matchingStem?.audio_url) {
          addLayer({
            name: matchingStem.title,
            stemType: targetStemType,
            prompt: tags,
            audioUrl: proxyAudioUrl(matchingStem.audio_url),
            previousAudioUrl: null,
            volume: 0.8,
            isMuted: false,
            isSoloed: false,
            position: 0,
            sunoClipId: matchingStem.id,
            generationJobId: null,
            projectId: project.id,
          });
          addToast(`${matchingStem.title} layer added!`, "success");
        } else {
          throw new Error(
            `No ${targetStemType} stem found in generated track`
          );
        }

        setGenerationPhase("complete");
        setTimeout(() => setGenerationPhase("idle"), 2000);
      } catch (error) {
        setGenerationPhase("error");
        addToast(
          error instanceof Error ? error.message : "Add layer failed",
          "error"
        );
        setTimeout(() => setGenerationPhase("idle"), 3000);
      } finally {
        setIsGenerating(false);
      }
    },
    [project.originalClipId, project.id, addLayer, consumeCachedStem, addToast]
  );

  const handleRegenerate = useCallback(
    async (layerId: string, prompt: string) => {
      const layer = project.layers.find((l) => l.id === layerId);
      if (!layer || !project.originalClipId) return;

      updateLayer(layerId, { previousAudioUrl: layer.audioUrl });
      startABComparison(layerId);
      setAbSelectedVersions((prev) => ({ ...prev, [layerId]: "b" }));

      setIsGenerating(true);
      setGenerationPhase("generating");

      try {
        const stemTypeTag =
          STEM_TYPE_TAGS[layer.stemType as keyof typeof STEM_TYPE_TAGS] || "";
        const tags = `${stemTypeTag}, ${prompt}`;

        // Auto-include lyrics for vocal layers
        const isVocalLayer = layer.stemType === "vocals" || layer.stemType === "backing_vocals";
        const lyricsPrompt = isVocalLayer && lyrics.trim() ? lyrics : undefined;

        const data = await generate({
          topic: prompt,
          tags,
          cover_clip_id: project.originalClipId,
          prompt: lyricsPrompt,
        });

        const clipId = data.clips?.[0]?.id;
        if (!clipId) throw new Error("No clip returned");

        await pollUntilDone([clipId], {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000,
        });

        setGenerationPhase("separating");
        const stemData = await stem(clipId);
        const stemIds = stemData.clips?.map((c) => c.id) || [];
        if (stemIds.length === 0) throw new Error("No stem clips returned");

        const stemClips = await pollUntilDone(stemIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        const matchingStem = stemClips.find(
          (s) => stemTitleToType(s.title) === layer.stemType
        );

        if (matchingStem?.audio_url) {
          updateLayer(layerId, {
            audioUrl: proxyAudioUrl(matchingStem.audio_url),
            prompt,
            sunoClipId: matchingStem.id,
          });
          addToast(
            `${STEM_LABELS[layer.stemType]} regenerated! Compare A/B versions.`,
            "success"
          );
        } else {
          throw new Error("Matching stem not found");
        }

        setGenerationPhase("complete");
        setTimeout(() => setGenerationPhase("idle"), 2000);
      } catch (error) {
        setGenerationPhase("error");
        addToast(
          error instanceof Error ? error.message : "Regeneration failed",
          "error"
        );
        setTimeout(() => setGenerationPhase("idle"), 3000);

        // Revert A/B state on failure
        updateLayer(layerId, {
          audioUrl: layer.audioUrl,
          previousAudioUrl: null,
        });
        setABState(layerId, "none");
        setAbSelectedVersions((prev) => {
          const next = { ...prev };
          delete next[layerId];
          return next;
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [
      project.layers,
      project.originalClipId,
      updateLayer,
      startABComparison,
      setABState,
      addToast,
      lyrics,
    ]
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
    const vocalLayer = project.layers.find(
      (l) => l.stemType === "vocals" || l.stemType === "backing_vocals"
    );
    if (vocalLayer) {
      addToast("Lyrics updated", "info", {
        label: "Regenerate vocals?",
        onClick: () => handleRegenerate(vocalLayer.id, vocalLayer.prompt || "vocals"),
      });
    } else {
      addToast("Lyrics saved for next generation", "success");
    }
  }, [addToast, project.layers, handleRegenerate]);

  const handleChatGenerate = useCallback(
    (
      topic: string,
      tags: string,
      instrumental: boolean,
      options?: { negative_tags?: string; lyrics?: string }
    ) => {
      // Merge stored lyrics if no explicit lyrics provided
      const effectiveLyrics = options?.lyrics || (lyrics.trim() ? lyrics : undefined);
      handleGenerate(topic, instrumental, {
        tags,
        negative_tags: options?.negative_tags,
        lyrics: effectiveLyrics,
      });
    },
    [handleGenerate, lyrics]
  );

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d] text-white overflow-hidden">
      <StudioHeader
        projectTitle={project.title}
        layers={layers}
        lyricsOpen={lyricsOpen}
        onToggleLyrics={() => setLyricsOpen((o) => !o)}
        onExportMix={exportAudio}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: AI Chat */}
        <ChatPanel
          project={project}
          isGenerating={isGenerating}
          hasLayers={layers.length > 0}
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
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onStop={() => {
              setIsPlaying(false);
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
