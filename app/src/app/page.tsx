'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Layers } from 'lucide-react';
import { CreatePanel } from '@/components/CreatePanel';
import { LayerTimeline } from '@/components/LayerTimeline';
import { TransportBar } from '@/components/TransportBar';
import { GenerationStatus, GenerationPhase } from '@/components/GenerationStatus';
import { RegenerateModal } from '@/components/RegenerateModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ExportPanel } from '@/components/ExportPanel';
import { useProject } from '@/hooks/useProject';
import { useWaveformPlaylist } from '@/hooks/useWaveformPlaylist';
import { useToast } from '@/context/ToastContext';
import { Layer, CachedStem, StemType } from '@/lib/types';
import { generate, stem, pollUntilDone, proxyAudioUrl, stemTitleToType } from '@/lib/api';
import { STEM_TYPE_TAGS, STEM_DISPLAY_NAMES, POLL_INTERVALS } from '@/lib/constants';

export default function Home() {
  const {
    project,
    addLayer,
    removeLayer,
    toggleMute,
    toggleSolo,
    setLayerVolume,
    setVibePrompt,
    updateLayer,
    setOriginalClipId,
    setStemCache,
    startABComparison,
    setABState,
  } = useProject();

  const { showToast } = useToast();
  const playlistContainerRef = useRef<HTMLDivElement>(null);

  // Transport state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [zoomLevel, setZoomLevel] = useState(1);

  // A/B selected versions (which version is currently audible per layer)
  const [abSelectedVersions, setAbSelectedVersions] = useState<Record<string, 'a' | 'b'>>({});

  // Waveform playlist integration
  const {
    play: playAudio,
    pause: pauseAudio,
    stop: stopAudio,
    rewind: rewindAudio,
    exportAudio,
  } = useWaveformPlaylist({
    containerRef: playlistContainerRef,
    layers: project.layers,
    masterVolume,
    zoomLevel,
    onTimeUpdate: setCurrentTime,
    onDurationChange: setDuration,
    onFinish: () => setIsPlaying(false),
  });

  // Sync play/pause state with playlist
  useEffect(() => {
    if (isPlaying) {
      playAudio();
    } else {
      pauseAudio();
    }
  }, [isPlaying, playAudio, pauseAudio]);

  // Generation state
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
  const [isGenerating, setIsGenerating] = useState(false);

  // Modal state — regenKey forces remount to reset internal state
  const [regenModal, setRegenModal] = useState<{ isOpen: boolean; layer: Layer | null; key: number }>({
    isOpen: false,
    layer: null,
    key: 0,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; layerId: string | null }>({
    isOpen: false,
    layerId: null,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        setCurrentTime(0);
        rewindAudio();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [rewindAudio]);

  // Swap audioUrl <-> previousAudioUrl to toggle which version is audible.
  // Only swaps when the requested version differs from current to prevent double-swap.
  const handleSelectABVersion = useCallback(
    (layerId: string, version: 'a' | 'b') => {
      const currentVersion = abSelectedVersions[layerId] || 'b';
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

  // Resolve an A/B comparison by keeping the specified version.
  // If the user toggled to a different version than what's requested,
  // we need to swap audioUrl <-> previousAudioUrl before clearing.
  const resolveABComparison = useCallback(
    (layerId: string, keepVersion: 'a' | 'b') => {
      const currentVersion = abSelectedVersions[layerId] || 'b';
      if (currentVersion !== keepVersion) {
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
      setABState(layerId, 'none');
    },
    [abSelectedVersions, project.layers, updateLayer, setABState]
  );

  const handleKeepA = useCallback(
    (layerId: string) => {
      resolveABComparison(layerId, 'a');
      showToast('Reverted to original version', 'info');
    },
    [resolveABComparison, showToast]
  );

  const handleKeepB = useCallback(
    (layerId: string) => {
      resolveABComparison(layerId, 'b');
      showToast('New version kept!', 'success');
    },
    [resolveABComparison, showToast]
  );

  const handleGenerate = useCallback(
    async (prompt: string, tags?: string, instrumental?: boolean) => {
      setIsGenerating(true);
      setGenerationPhase('generating');
      setVibePrompt(prompt);

      try {
        // Emphasize drums in tags since we show that layer first
        const drumsTags = `drums, beat, rhythm, ${tags || prompt}`;
        const data = await generate({
          topic: prompt,
          tags: drumsTags,
          make_instrumental: instrumental || false,
        });

        const clipIds = data.clips?.map((c) => c.id) || [];
        if (clipIds.length === 0) throw new Error('No clips returned');

        setOriginalClipId(clipIds[0]);

        // Require 'complete' — Suno needs full completion before stem separation
        await pollUntilDone(clipIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000,
        });

        setGenerationPhase('separating');
        const stemData = await stem(clipIds[0]);
        const stemClipIds = stemData.clips?.map((c) => c.id) || [];
        if (stemClipIds.length === 0) throw new Error('No stem clips returned');

        // Stems need audio_url which is only populated at 'complete'
        const stemClips = await pollUntilDone(stemClipIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        setGenerationPhase('loading');
        const cachedStems: CachedStem[] = [];
        let drumsAdded = false;

        for (const stemClip of stemClips) {
          if (!stemClip.audio_url) continue;
          const stemType = (stemTitleToType(stemClip.title) || 'fx') as StemType;

          if (stemType === 'drums' && !drumsAdded) {
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

        setGenerationPhase('complete');
        showToast('Beat ready! Add more layers to build your track.', 'success');
        setTimeout(() => setGenerationPhase('idle'), 2000);
      } catch (error) {
        setGenerationPhase('error');
        showToast(error instanceof Error ? error.message : 'Generation failed', 'error');
        setTimeout(() => setGenerationPhase('idle'), 3000);
      } finally {
        setIsGenerating(false);
      }
    },
    [addLayer, setVibePrompt, setOriginalClipId, setStemCache, showToast]
  );

  const handleAddLayer = useCallback(
    async (targetStemType: string, tags: string) => {
      if (!project.originalClipId) {
        showToast('Generate a track first', 'info');
        return;
      }

      // Check cache synchronously by reading project.stemCache directly
      // (can't use setProject updater for this — React batches the execution)
      const cached = project.stemCache.find((s) => s.stemType === targetStemType);
      if (cached) {
        setStemCache(project.stemCache.filter((s) => s !== cached));
        addLayer({
          name: STEM_DISPLAY_NAMES[targetStemType as StemType] || targetStemType,
          stemType: targetStemType as StemType,
          prompt: tags,
          audioUrl: cached.audioUrl,
          previousAudioUrl: null,
          volume: 0.8,
          isMuted: false,
          isSoloed: false,
          position: 0,
          sunoClipId: cached.sunoClipId,
          generationJobId: null,
        });
        showToast('Layer added from cache!', 'success');
        return;
      }

      setIsGenerating(true);
      setGenerationPhase('generating');

      try {
        const data = await generate({
          topic: tags,
          tags,
          cover_clip_id: project.originalClipId,
        });

        const clipId = data.clips?.[0]?.id;
        if (!clipId) throw new Error('No clip returned');

        await pollUntilDone([clipId], {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000,
        });

        setGenerationPhase('separating');
        const stemData = await stem(clipId);
        const stemIds = stemData.clips?.map((c) => c.id) || [];
        if (stemIds.length === 0) throw new Error('No stem clips returned');

        const stemClips = await pollUntilDone(stemIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        setGenerationPhase('loading');
        const matchingStem = stemClips.find((s) => stemTitleToType(s.title) === targetStemType);

        if (matchingStem?.audio_url) {
          addLayer({
            name: matchingStem.title,
            stemType: targetStemType as StemType,
            prompt: tags,
            audioUrl: proxyAudioUrl(matchingStem.audio_url),
            previousAudioUrl: null,
            volume: 0.8,
            isMuted: false,
            isSoloed: false,
            position: 0,
            sunoClipId: matchingStem.id,
            generationJobId: null,
          });
          showToast(`${matchingStem.title} layer added!`, 'success');
        } else {
          throw new Error(`No ${targetStemType} stem found in generated track`);
        }

        setGenerationPhase('complete');
        setTimeout(() => setGenerationPhase('idle'), 2000);
      } catch (error) {
        setGenerationPhase('error');
        showToast(error instanceof Error ? error.message : 'Add layer failed', 'error');
        setTimeout(() => setGenerationPhase('idle'), 3000);
      } finally {
        setIsGenerating(false);
      }
    },
    [project.originalClipId, project.stemCache, addLayer, setStemCache, showToast]
  );

  const handleRegenerate = useCallback(
    async (layerId: string, prompt: string) => {
      const layer = project.layers.find((l) => l.id === layerId);
      if (!layer || !project.originalClipId) return;

      updateLayer(layerId, { previousAudioUrl: layer.audioUrl });
      startABComparison(layerId);
      setAbSelectedVersions((prev) => ({ ...prev, [layerId]: 'b' }));

      setIsGenerating(true);
      setGenerationPhase('generating');

      try {
        const stemTypeTag = STEM_TYPE_TAGS[layer.stemType as keyof typeof STEM_TYPE_TAGS] || '';
        const tags = `${stemTypeTag}, ${prompt}`;

        const data = await generate({
          topic: prompt,
          tags,
          cover_clip_id: project.originalClipId,
        });

        const clipId = data.clips?.[0]?.id;
        if (!clipId) throw new Error('No clip returned');

        await pollUntilDone([clipId], {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000,
        });

        setGenerationPhase('separating');
        const stemData = await stem(clipId);
        const stemIds = stemData.clips?.map((c) => c.id) || [];
        if (stemIds.length === 0) throw new Error('No stem clips returned');

        const stemClips = await pollUntilDone(stemIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        const matchingStem = stemClips.find((s) => stemTitleToType(s.title) === layer.stemType);

        if (matchingStem?.audio_url) {
          updateLayer(layerId, {
            audioUrl: proxyAudioUrl(matchingStem.audio_url),
            prompt,
            sunoClipId: matchingStem.id,
          });
          showToast(`${layer.name} regenerated! Compare A/B versions.`, 'success');
        } else {
          throw new Error('Matching stem not found');
        }

        setGenerationPhase('complete');
        setTimeout(() => setGenerationPhase('idle'), 2000);
      } catch (error) {
        setGenerationPhase('error');
        showToast(error instanceof Error ? error.message : 'Regeneration failed', 'error');
        setTimeout(() => setGenerationPhase('idle'), 3000);

        // Revert A/B state on failure
        updateLayer(layerId, {
          audioUrl: layer.audioUrl,
          previousAudioUrl: null,
        });
        setABState(layerId, 'none');
        setAbSelectedVersions((prev) => {
          const next = { ...prev };
          delete next[layerId];
          return next;
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [project.layers, project.originalClipId, updateLayer, startABComparison, setABState, showToast]
  );

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="border-b border-white/10 bg-zinc-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers size={24} className="text-purple-400" />
          <h1 className="text-lg font-semibold text-white">LayerTune</h1>
        </div>
        <div className="flex items-center gap-4">
          <GenerationStatus phase={generationPhase} />
          <ExportPanel
            layers={project.layers}
            onExportMix={exportAudio}
            projectTitle={project.title}
          />
        </div>
      </header>

      {/* Create Panel */}
      <CreatePanel
        onGenerate={handleGenerate}
        onAddLayer={handleAddLayer}
        isGenerating={isGenerating}
        hasLayers={project.layers.length > 0}
        existingStemTypes={project.layers.map((l) => l.stemType)}
      />

      {/* Timeline */}
      <LayerTimeline
        layers={project.layers}
        playlistContainerRef={playlistContainerRef}
        onToggleMute={toggleMute}
        onToggleSolo={toggleSolo}
        onVolumeChange={setLayerVolume}
        onRegenerate={(layerId) => {
          const layer = project.layers.find((l) => l.id === layerId);
          if (layer) setRegenModal((prev) => ({ isOpen: true, layer, key: prev.key + 1 }));
        }}
        onDelete={(layerId) => setDeleteConfirm({ isOpen: true, layerId })}
        abState={project.abState}
        abSelectedVersions={abSelectedVersions}
        onSelectABVersion={handleSelectABVersion}
        onKeepA={handleKeepA}
        onKeepB={handleKeepB}
      />

      {/* Transport Bar */}
      <TransportBar
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        masterVolume={masterVolume}
        zoomLevel={zoomLevel}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onStop={() => { setIsPlaying(false); setCurrentTime(0); stopAudio(); }}
        onRewind={() => { setCurrentTime(0); rewindAudio(); }}
        onVolumeChange={setMasterVolume}
        onZoomIn={() => setZoomLevel((z) => Math.min(z * 1.5, 10))}
        onZoomOut={() => setZoomLevel((z) => Math.max(z / 1.5, 0.25))}
      />

      {/* Modals */}
      <RegenerateModal
        key={regenModal.key}
        isOpen={regenModal.isOpen}
        layer={regenModal.layer}
        onRegenerate={handleRegenerate}
        onClose={() => setRegenModal((prev) => ({ isOpen: false, layer: null, key: prev.key }))}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Layer"
        message="Are you sure you want to remove this layer? This cannot be undone."
        onConfirm={() => {
          if (deleteConfirm.layerId) removeLayer(deleteConfirm.layerId);
          setDeleteConfirm({ isOpen: false, layerId: null });
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, layerId: null })}
      />
    </div>
  );
}
