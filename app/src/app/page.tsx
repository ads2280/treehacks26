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
import { Layer } from '@/lib/types';
import { generate, stem, pollUntilDone, proxyAudioUrl, stemTitleToType } from '@/lib/api';
import { STEM_NAME_TO_TYPE, STEM_TYPE_TAGS, POLL_INTERVALS } from '@/lib/constants';

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
    isLoaded,
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

  // Modal state
  const [regenModal, setRegenModal] = useState<{ isOpen: boolean; layer: Layer | null }>({
    isOpen: false,
    layer: null,
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

  // A/B version selection - swap audio URLs to toggle which is audible.
  // After regeneration the layer state is:
  //   audioUrl = NEW audio (version B)
  //   previousAudioUrl = OLD audio (version A)
  // Selecting A swaps so audioUrl=OLD, previousAudioUrl=NEW.
  // Selecting B swaps back.
  // The swap is only performed when the requested version differs from
  // the currently selected version to avoid double-swap bugs.
  const handleSelectABVersion = useCallback(
    (layerId: string, version: 'a' | 'b') => {
      const currentVersion = abSelectedVersions[layerId] || 'b';
      // No-op if already on the requested version
      if (currentVersion === version) return;

      setAbSelectedVersions((prev) => ({ ...prev, [layerId]: version }));
      const layer = project.layers.find((l) => l.id === layerId);
      if (!layer || !layer.previousAudioUrl) return;

      // Swap audioUrl <-> previousAudioUrl
      updateLayer(layerId, {
        audioUrl: layer.previousAudioUrl,
        previousAudioUrl: layer.audioUrl,
      });
    },
    [project.layers, updateLayer, abSelectedVersions]
  );

  // Keep A (original): ensure the original audio ends up as audioUrl,
  // clear previousAudioUrl, and exit comparison mode.
  // After regeneration (default state, version B selected):
  //   audioUrl = NEW, previousAudioUrl = OLD
  //   -> keepA needs to set audioUrl = OLD
  // If user toggled to A:
  //   audioUrl = OLD, previousAudioUrl = NEW
  //   -> keepA needs to keep audioUrl = OLD (already correct)
  const handleKeepA = useCallback(
    (layerId: string) => {
      const currentVersion = abSelectedVersions[layerId] || 'b';
      if (currentVersion === 'b') {
        // Currently playing B (new). Original is in previousAudioUrl.
        // Swap to original and clear.
        const layer = project.layers.find((l) => l.id === layerId);
        if (layer?.previousAudioUrl) {
          updateLayer(layerId, {
            audioUrl: layer.previousAudioUrl,
            previousAudioUrl: null,
          });
        }
      } else {
        // Currently playing A (original). It's already in audioUrl.
        // Just clear previousAudioUrl.
        updateLayer(layerId, { previousAudioUrl: null });
      }
      setAbSelectedVersions((prev) => {
        const next = { ...prev };
        delete next[layerId];
        return next;
      });
      setABState(layerId, 'none');
      showToast('Reverted to original version', 'info');
    },
    [abSelectedVersions, project.layers, updateLayer, setABState, showToast]
  );

  // Keep B (new): ensure the new audio ends up as audioUrl,
  // clear previousAudioUrl, and exit comparison mode.
  // After regeneration (default state, version B selected):
  //   audioUrl = NEW, previousAudioUrl = OLD
  //   -> keepB just clears previousAudioUrl
  // If user toggled to A:
  //   audioUrl = OLD, previousAudioUrl = NEW
  //   -> keepB needs to swap back to NEW
  const handleKeepB = useCallback(
    (layerId: string) => {
      const currentVersion = abSelectedVersions[layerId] || 'b';
      if (currentVersion === 'a') {
        // Currently playing A (original). New is in previousAudioUrl.
        // Swap to new and clear.
        const layer = project.layers.find((l) => l.id === layerId);
        if (layer?.previousAudioUrl) {
          updateLayer(layerId, {
            audioUrl: layer.previousAudioUrl,
            previousAudioUrl: null,
          });
        }
      } else {
        // Currently playing B (new). It's already in audioUrl.
        // Just clear previousAudioUrl.
        updateLayer(layerId, { previousAudioUrl: null });
      }
      setAbSelectedVersions((prev) => {
        const next = { ...prev };
        delete next[layerId];
        return next;
      });
      setABState(layerId, 'none');
      showToast('New version kept!', 'success');
    },
    [abSelectedVersions, project.layers, updateLayer, setABState, showToast]
  );

  const handleGenerate = useCallback(
    async (prompt: string, tags?: string, instrumental?: boolean) => {
      setIsGenerating(true);
      setGenerationPhase('generating');
      setVibePrompt(prompt);

      try {
        // Step 1: Generate track via Suno API
        const data = await generate({
          topic: prompt,
          tags: tags || prompt,
          make_instrumental: instrumental || false,
        });

        const clipIds = data.clips?.map((c) => c.id) || [];
        if (clipIds.length === 0) throw new Error('No clips returned');

        setOriginalClipId(clipIds[0]);

        // Step 2: Poll for clip completion (accept 'streaming' for the main clip
        // since we only need the clip ID for stem separation, not the audio_url)
        await pollUntilDone(clipIds, {
          acceptStreaming: true,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000, // 3 min timeout for generation
        });

        // Step 3: Request stem separation
        setGenerationPhase('separating');
        const stemData = await stem(clipIds[0]);
        const stemClipIds = stemData.clips?.map((c) => c.id) || [];
        if (stemClipIds.length === 0) throw new Error('No stem clips returned');

        // Step 4: Poll for stem completion (require 'complete' -- stems need
        // audio_url which is only populated at complete, not streaming)
        const stemClips = await pollUntilDone(stemClipIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000, // 5 min timeout for stem separation
        });

        // Step 5: Create layers from completed stems
        setGenerationPhase('loading');
        for (const stemClip of stemClips) {
          if (stemClip.audio_url) {
            const stemType = stemTitleToType(stemClip.title);
            addLayer({
              name: stemClip.title,
              stemType: (stemType || 'fx') as Layer['stemType'],
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
          }
        }

        setGenerationPhase('complete');
        showToast('Layers ready!', 'success');
        setTimeout(() => setGenerationPhase('idle'), 2000);
      } catch (error) {
        setGenerationPhase('error');
        showToast(error instanceof Error ? error.message : 'Generation failed', 'error');
        setTimeout(() => setGenerationPhase('idle'), 3000);
      } finally {
        setIsGenerating(false);
      }
    },
    [addLayer, setVibePrompt, setOriginalClipId, showToast]
  );

  // Add a new layer by generating a cover variation of the original clip,
  // then extracting only the requested stem type.
  const handleAddLayer = useCallback(
    async (targetStemType: string, tags: string) => {
      if (!project.originalClipId) {
        showToast('Generate a track first', 'info');
        return;
      }

      setIsGenerating(true);
      setGenerationPhase('generating');

      try {
        // Use cover_clip_id to maintain musical coherence with the original track
        const data = await generate({
          topic: tags,
          tags,
          cover_clip_id: project.originalClipId,
        });

        const clipId = data.clips?.[0]?.id;
        if (!clipId) throw new Error('No clip returned');

        // Poll for clip completion
        await pollUntilDone([clipId], {
          acceptStreaming: true,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000,
        });

        // Stem separate
        setGenerationPhase('separating');
        const stemData = await stem(clipId);
        const stemIds = stemData.clips?.map((c) => c.id) || [];
        if (stemIds.length === 0) throw new Error('No stem clips returned');

        // Poll stems until fully complete (need audio_url)
        const stemClips = await pollUntilDone(stemIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        // Find and add only the matching stem type
        setGenerationPhase('loading');
        const matchingStem = stemClips.find((s) => {
          const type = stemTitleToType(s.title);
          return type === targetStemType;
        });

        if (matchingStem?.audio_url) {
          addLayer({
            name: matchingStem.title,
            stemType: (targetStemType as Layer['stemType']),
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
    [project.originalClipId, addLayer, showToast]
  );

  const handleRegenerate = useCallback(
    async (layerId: string, prompt: string) => {
      const layer = project.layers.find((l) => l.id === layerId);
      if (!layer || !project.originalClipId) return;

      // Store current audio as previous for A/B comparison
      updateLayer(layerId, { previousAudioUrl: layer.audioUrl });
      startABComparison(layerId);
      setAbSelectedVersions((prev) => ({ ...prev, [layerId]: 'b' }));

      setIsGenerating(true);
      setGenerationPhase('generating');

      try {
        // Use stem-type-specific tags from constants (single source of truth)
        const stemTypeTag = STEM_TYPE_TAGS[layer.stemType as keyof typeof STEM_TYPE_TAGS] || '';
        const tags = `${stemTypeTag}, ${prompt}`;

        // Generate a cover variation using cover_clip_id for coherence
        const data = await generate({
          topic: prompt,
          tags,
          cover_clip_id: project.originalClipId,
        });

        const clipId = data.clips?.[0]?.id;
        if (!clipId) throw new Error('No clip returned');

        // Poll clip until ready (accept streaming since we just need ID for stem)
        await pollUntilDone([clipId], {
          acceptStreaming: true,
          intervalMs: POLL_INTERVALS.clip,
          timeoutMs: 180000,
        });

        // Stem separate
        setGenerationPhase('separating');
        const stemData = await stem(clipId);
        const stemIds = stemData.clips?.map((c) => c.id) || [];
        if (stemIds.length === 0) throw new Error('No stem clips returned');

        // Poll stems until fully complete (need audio_url populated)
        const stemClips = await pollUntilDone(stemIds, {
          acceptStreaming: false,
          intervalMs: POLL_INTERVALS.stem,
          timeoutMs: 300000,
        });

        // Find the matching stem by type using the shared mapping
        const matchingStem = stemClips.find((s) => {
          const type = stemTitleToType(s.title);
          return type === layer.stemType;
        });

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

        // Clean up A/B state on failure: revert to original audio
        // and exit comparison mode so the UI doesn't show a broken A/B panel.
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
          if (layer) setRegenModal({ isOpen: true, layer });
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
        isOpen={regenModal.isOpen}
        layer={regenModal.layer}
        onRegenerate={handleRegenerate}
        onClose={() => setRegenModal({ isOpen: false, layer: null })}
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
