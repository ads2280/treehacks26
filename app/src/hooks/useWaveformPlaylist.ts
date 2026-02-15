'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { Layer, StemType } from '@/lib/types';
import { STEM_COLORS } from '@/lib/constants';

interface UseWaveformPlaylistOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  layers: Layer[];
  masterVolume: number;
  zoomLevel: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onFinish: () => void;
}

interface UseWaveformPlaylistReturn {
  play: () => void;
  pause: () => void;
  stop: () => void;
  rewind: () => void;
  isLoaded: boolean;
  exportAudio: () => Promise<Blob | null>;
}

// Shared zoom levels array used both during init and runtime zoom changes.
const ZOOM_LEVELS = [256, 512, 1024, 2048, 4096, 8192, 16384];
const BASE_SPP = 4096;

/** Pick the closest samples-per-pixel value from ZOOM_LEVELS for a given
 *  logical zoom multiplier (1 = default, >1 = zoomed in). */
function sppForZoom(zoomLevel: number): number {
  const targetSpp = Math.round(BASE_SPP / zoomLevel);
  return ZOOM_LEVELS.reduce((prev, curr) =>
    Math.abs(curr - targetSpp) < Math.abs(prev - targetSpp) ? curr : prev
  );
}

// Build a stable identity key from the layers that affect track loading.
// When this key changes we need to reload tracks into waveform-playlist.
function layerTrackKey(layers: Layer[]): string {
  return layers
    .filter((l) => l.audioUrl)
    .map((l) => `${l.id}:${l.audioUrl}`)
    .join(',');
}

// Build a key for volume/mute/solo state so we can react to those changes
// without reloading the full tracks.
function layerMixKey(layers: Layer[]): string {
  return layers
    .filter((l) => l.audioUrl)
    .map((l) => `${l.id}:${l.isMuted}:${l.volume}:${l.isSoloed}`)
    .join(',');
}

export function useWaveformPlaylist({
  containerRef,
  layers,
  masterVolume,
  zoomLevel,
  onTimeUpdate,
  onDurationChange,
  onFinish,
}: UseWaveformPlaylistOptions): UseWaveformPlaylistReturn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playlistRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eeRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const isInitializedRef = useRef(false);
  const exporterInitializedRef = useRef(false);

  // Store latest callbacks in refs so the playlist event listeners always
  // call the current version without needing to re-subscribe.
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onDurationChangeRef = useRef(onDurationChange);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    onDurationChangeRef.current = onDurationChange;
  }, [onDurationChange]);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // ---------------------------------------------------------------
  // Initialize the playlist instance once on mount
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    let cancelled = false;

    // Keep references to listeners so we can remove them on cleanup.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onTimeUpdateListener: ((...args: any[]) => void) | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onFinishedListener: ((...args: any[]) => void) | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onRenderedListener: ((...args: any[]) => void) | undefined;

    const init = async () => {
      // Dynamic imports to avoid SSR issues - waveform-playlist uses
      // browser-only APIs (AudioContext, canvas, etc.)
      const EventEmitter = (await import('event-emitter')).default;
      const WaveformPlaylist = (await import('waveform-playlist')).default;

      if (cancelled || !containerRef.current) return;

      const ee = EventEmitter();
      eeRef.current = ee;

      const closestSpp = sppForZoom(zoomLevel);

      const playlist = WaveformPlaylist(
        {
          container: containerRef.current,
          samplesPerPixel: closestSpp,
          mono: true,
          waveHeight: 55,
          isAutomaticScroll: true,
          timescale: false,
          state: 'cursor',
          colors: {
            waveOutlineColor: '#a78bfa',
            timeColor: '#71717a',
            fadeColor: '#3f3f46',
          },
          controls: {
            show: false,
          },
          zoomLevels: ZOOM_LEVELS,
          seekStyle: 'line',
        },
        ee
      );

      if (cancelled) return;

      playlistRef.current = playlist;
      isInitializedRef.current = true;
      setIsInitialized(true);

      // --- Subscribe to playlist events ---
      // Store listener references for cleanup.

      onTimeUpdateListener = (seconds: unknown) => {
        onTimeUpdateRef.current(seconds as number);
      };
      ee.on('timeupdate', onTimeUpdateListener);

      onFinishedListener = () => {
        onFinishRef.current();
      };
      ee.on('finished', onFinishedListener);

      onRenderedListener = () => {
        // After tracks are rendered we can read the duration
        if (playlistRef.current) {
          onDurationChangeRef.current(playlistRef.current.duration);
        }
      };
      ee.on('audiosourcesrendered', onRenderedListener);
    };

    init();

    return () => {
      cancelled = true;

      // Remove event listeners to prevent memory leaks
      const ee = eeRef.current;
      if (ee) {
        if (onTimeUpdateListener) ee.off('timeupdate', onTimeUpdateListener);
        if (onFinishedListener) ee.off('finished', onFinishedListener);
        if (onRenderedListener) ee.off('audiosourcesrendered', onRenderedListener);
      }

      // Clean up the DOM that waveform-playlist rendered
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      playlistRef.current = null;
      eeRef.current = null;
      isInitializedRef.current = false;
      exporterInitializedRef.current = false;
      setIsInitialized(false);
      setIsLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount-only

  // ---------------------------------------------------------------
  // Load / reload tracks when the set of audio URLs changes
  // ---------------------------------------------------------------
  const trackKey = layerTrackKey(layers);

  useEffect(() => {
    if (!playlistRef.current || !eeRef.current || !isInitialized) return;

    const tracksWithAudio = layers.filter((l) => l.audioUrl);
    if (tracksWithAudio.length === 0) {
      setIsLoaded(false);
      return;
    }

    const tracks = tracksWithAudio.map((layer) => ({
      src: layer.audioUrl!,
      name: layer.name,
      // waveform-playlist gain property is 0-1 scale (passed directly to
      // track.setGainLevel which sets volumeGain.gain.value).
      gain: layer.volume,
      muted: layer.isMuted,
      soloed: layer.isSoloed,
      waveOutlineColor: STEM_COLORS[layer.stemType as StemType] || '#a78bfa',
    }));

    // Clear existing tracks before loading new ones
    const playlist = playlistRef.current;

    // Stop playback before reloading
    try {
      if (playlist.isPlaying && playlist.isPlaying()) {
        eeRef.current.emit('stop');
      }
    } catch {
      // isPlaying may throw if no tracks loaded yet
    }

    // Load tracks. Clear first if there are existing tracks,
    // otherwise load directly (clear() may hang on empty playlist).
    const loadTracks = playlist.tracks && playlist.tracks.length > 0
      ? playlist.clear().then(() => playlist.load(tracks))
      : playlist.load(tracks);

    loadTracks
      .then(() => {
        setIsLoaded(true);
        if (playlistRef.current) {
          onDurationChangeRef.current(playlistRef.current.duration);
        }
      })
      .catch((err: Error) => {
        console.error('Failed to load tracks into waveform-playlist:', err);
        setIsLoaded(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, isInitialized]);

  // ---------------------------------------------------------------
  // Update per-track volume / mute / solo without full reload
  // ---------------------------------------------------------------
  const mixKey = layerMixKey(layers);

  useEffect(() => {
    if (!playlistRef.current || !isLoaded) return;

    const playlist = playlistRef.current;
    const tracksWithAudio = layers.filter((l) => l.audioUrl);
    const anySoloed = tracksWithAudio.some((l) => l.isSoloed);

    tracksWithAudio.forEach((layer, index) => {
      const track = playlist.tracks[index];
      if (!track) return;

      // Compute effective gain considering solo state.
      // track.setGainLevel() expects a 0-1 value (it sets
      // volumeGain.gain.value directly in the Web Audio graph).
      let effectiveVolume: number;
      if (layer.isMuted) {
        effectiveVolume = 0;
      } else if (anySoloed && !layer.isSoloed) {
        effectiveVolume = 0;
      } else {
        effectiveVolume = layer.volume;
      }

      // Set gain directly on the track object (0-1 scale)
      track.setGainLevel(effectiveVolume);
    });

    // Also sync waveform-playlist's internal mute/solo arrays so that
    // shouldTrackPlay() returns correct values during play() scheduling.
    // Clear existing arrays and rebuild from current layer state.
    playlist.mutedTracks = [];
    playlist.soloedTracks = [];
    tracksWithAudio.forEach((layer, index) => {
      const track = playlist.tracks[index];
      if (!track) return;
      if (layer.isMuted) {
        playlist.mutedTracks.push(track);
      }
      if (layer.isSoloed) {
        playlist.soloedTracks.push(track);
      }
    });
    // Update shouldPlay gain nodes to match
    playlist.adjustTrackPlayout();

    // Request a redraw so the waveform visuals update
    playlist.drawRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixKey, isLoaded]);

  // ---------------------------------------------------------------
  // Update master volume
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!playlistRef.current || !isLoaded) return;

    // setMasterGainLevel() sets masterGain.gain.value directly,
    // expecting a 0-1 scale. All tracks share the same masterGainNode
    // so we only need to set it once, but iterating is harmless since
    // they all reference the same GainNode.
    const playlist = playlistRef.current;
    playlist.masterGain = masterVolume;
    playlist.tracks.forEach((track: { setMasterGainLevel: (gain: number) => void }) => {
      track.setMasterGainLevel(masterVolume);
    });
  }, [masterVolume, isLoaded]);

  // ---------------------------------------------------------------
  // Update zoom level
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!eeRef.current || !isLoaded) return;

    const closestSpp = sppForZoom(zoomLevel);

    const playlist = playlistRef.current;
    if (playlist && playlist.samplesPerPixel !== closestSpp) {
      playlist.setZoom(closestSpp);
      playlist.drawRequest();
    }
  }, [zoomLevel, isLoaded]);

  // ---------------------------------------------------------------
  // Transport controls
  // ---------------------------------------------------------------
  const play = useCallback(() => {
    if (!eeRef.current || !isLoaded) return;
    eeRef.current.emit('play');
  }, [isLoaded]);

  const pause = useCallback(() => {
    if (!eeRef.current || !isLoaded) return;
    eeRef.current.emit('pause');
  }, [isLoaded]);

  const stop = useCallback(() => {
    if (!eeRef.current || !isLoaded) return;
    eeRef.current.emit('stop');
    onTimeUpdateRef.current(0);
  }, [isLoaded]);

  const rewind = useCallback(() => {
    if (!eeRef.current || !isLoaded) return;
    eeRef.current.emit('rewind');
    onTimeUpdateRef.current(0);
  }, [isLoaded]);

  // ---------------------------------------------------------------
  // Export audio as WAV blob
  // ---------------------------------------------------------------
  const EXPORT_TIMEOUT_MS = 30_000;

  const exportAudio = useCallback(async (): Promise<Blob | null> => {
    if (!eeRef.current || !playlistRef.current || !isLoaded) return null;

    // Only initialize the export worker once to avoid orphaning InlineWorkers
    if (!exporterInitializedRef.current) {
      playlistRef.current.initExporter();
      exporterInitializedRef.current = true;
    }

    return new Promise<Blob | null>((resolve) => {
      const ee = eeRef.current;

      // Timeout guard so the Promise does not hang forever if rendering fails
      const timeout = setTimeout(() => {
        ee.off('audiorenderingfinished', onRenderFinished);
        console.error('Audio export timed out');
        resolve(null);
      }, EXPORT_TIMEOUT_MS);

      const onRenderFinished = (_type: unknown, blob: unknown) => {
        clearTimeout(timeout);
        ee.off('audiorenderingfinished', onRenderFinished);
        resolve(blob as Blob);
      };

      ee.on('audiorenderingfinished', onRenderFinished);
      ee.emit('startaudiorendering', 'wav');
    });
  }, [isLoaded]);

  return {
    play,
    pause,
    stop,
    rewind,
    isLoaded,
    exportAudio,
  };
}
