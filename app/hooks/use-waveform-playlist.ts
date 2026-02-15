"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { Layer, StemType } from "@/lib/layertune-types";
import { STEM_COLORS } from "@/lib/layertune-types";

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

const ZOOM_LEVELS = [256, 512, 1024, 2048, 4096, 8192, 16384];
const BASE_SPP = 4096;
const EXPORT_TIMEOUT_MS = 30_000;

function sppForZoom(zoomLevel: number): number {
  const targetSpp = Math.round(BASE_SPP / zoomLevel);
  return ZOOM_LEVELS.reduce((prev, curr) =>
    Math.abs(curr - targetSpp) < Math.abs(prev - targetSpp) ? curr : prev
  );
}

function layerTrackKey(layers: Layer[]): string {
  return layers
    .filter((l) => l.audioUrl)
    .map((l) => `${l.id}:${l.audioUrl}`)
    .join(",");
}

function layerMixKey(layers: Layer[]): string {
  return layers
    .filter((l) => l.audioUrl)
    .map((l) => `${l.id}:${l.isMuted}:${l.volume}:${l.isSoloed}`)
    .join(",");
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

  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onDurationChangeRef = useRef(onDurationChange);
  const onFinishRef = useRef(onFinish);

  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onDurationChangeRef.current = onDurationChange; }, [onDurationChange]);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  // Initialize the playlist instance once on mount
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    let cancelled = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onTimeUpdateListener: ((...args: any[]) => void) | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onFinishedListener: ((...args: any[]) => void) | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onRenderedListener: ((...args: any[]) => void) | undefined;

    const init = async () => {
      const EventEmitter = (await import("event-emitter")).default;
      const WaveformPlaylist = (await import("waveform-playlist")).default;

      if (cancelled || !containerRef.current) return;

      const ee = EventEmitter();
      eeRef.current = ee;

      const playlist = WaveformPlaylist(
        {
          container: containerRef.current,
          samplesPerPixel: sppForZoom(zoomLevel),
          mono: true,
          waveHeight: 55,
          isAutomaticScroll: true,
          timescale: false,
          state: "cursor",
          colors: {
            waveOutlineColor: "#a78bfa",
            timeColor: "#71717a",
            fadeColor: "#3f3f46",
          },
          controls: { show: false },
          zoomLevels: ZOOM_LEVELS,
          seekStyle: "line",
        },
        ee
      );

      if (cancelled) return;

      playlistRef.current = playlist;
      isInitializedRef.current = true;
      setIsInitialized(true);

      onTimeUpdateListener = (seconds: unknown) => {
        onTimeUpdateRef.current(seconds as number);
      };
      ee.on("timeupdate", onTimeUpdateListener);

      onFinishedListener = () => {
        onFinishRef.current();
      };
      ee.on("finished", onFinishedListener);

      onRenderedListener = () => {
        if (playlistRef.current) {
          onDurationChangeRef.current(playlistRef.current.duration);
        }
      };
      ee.on("audiosourcesrendered", onRenderedListener);
    };

    init();

    return () => {
      cancelled = true;

      const ee = eeRef.current;
      if (ee) {
        if (onTimeUpdateListener) ee.off("timeupdate", onTimeUpdateListener);
        if (onFinishedListener) ee.off("finished", onFinishedListener);
        if (onRenderedListener) ee.off("audiosourcesrendered", onRenderedListener);
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      playlistRef.current = null;
      eeRef.current = null;
      isInitializedRef.current = false;
      exporterInitializedRef.current = false;
      setIsInitialized(false);
      setIsLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load / reload tracks when the set of audio URLs changes
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
      gain: layer.volume,
      muted: layer.isMuted,
      soloed: layer.isSoloed,
      waveOutlineColor: STEM_COLORS[layer.stemType as StemType] || "#a78bfa",
    }));

    const playlist = playlistRef.current;

    try {
      if (playlist.isPlaying && playlist.isPlaying()) {
        eeRef.current.emit("stop");
      }
    } catch {
      // isPlaying may throw if no tracks loaded yet
    }

    // clear() hangs on empty playlist, so only call it when tracks exist
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
        console.error("Failed to load tracks into waveform-playlist:", err);
        setIsLoaded(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, isInitialized]);

  // Update per-track volume / mute / solo without full reload
  const mixKey = layerMixKey(layers);

  useEffect(() => {
    if (!playlistRef.current || !isLoaded) return;

    const playlist = playlistRef.current;
    const tracksWithAudio = layers.filter((l) => l.audioUrl);
    const anySoloed = tracksWithAudio.some((l) => l.isSoloed);

    tracksWithAudio.forEach((layer, index) => {
      const track = playlist.tracks[index];
      if (!track) return;

      let effectiveVolume: number;
      if (layer.isMuted) {
        effectiveVolume = 0;
      } else if (anySoloed && !layer.isSoloed) {
        effectiveVolume = 0;
      } else {
        effectiveVolume = layer.volume;
      }

      track.setGainLevel(effectiveVolume);
    });

    playlist.mutedTracks = [];
    playlist.soloedTracks = [];
    tracksWithAudio.forEach((layer, index) => {
      const track = playlist.tracks[index];
      if (!track) return;
      if (layer.isMuted) playlist.mutedTracks.push(track);
      if (layer.isSoloed) playlist.soloedTracks.push(track);
    });
    playlist.adjustTrackPlayout();
    playlist.drawRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixKey, isLoaded]);

  // Update master volume
  useEffect(() => {
    if (!playlistRef.current || !isLoaded) return;

    const playlist = playlistRef.current;
    playlist.masterGain = masterVolume;
    playlist.tracks.forEach((track: { setMasterGainLevel: (gain: number) => void }) => {
      track.setMasterGainLevel(masterVolume);
    });
  }, [masterVolume, isLoaded]);

  // Update zoom level
  useEffect(() => {
    if (!eeRef.current || !isLoaded) return;

    const closestSpp = sppForZoom(zoomLevel);
    const playlist = playlistRef.current;
    if (playlist && playlist.samplesPerPixel !== closestSpp) {
      playlist.setZoom(closestSpp);
      playlist.drawRequest();
    }
  }, [zoomLevel, isLoaded]);

  // Transport controls
  const play = useCallback(() => {
    if (!eeRef.current || !isLoaded) return;
    eeRef.current.emit("play");
  }, [isLoaded]);

  const pause = useCallback(() => {
    if (!eeRef.current || !isLoaded) return;
    eeRef.current.emit("pause");
  }, [isLoaded]);

  const stop = useCallback(() => {
    if (!eeRef.current || !isLoaded) return;
    eeRef.current.emit("stop");
    onTimeUpdateRef.current(0);
  }, [isLoaded]);

  const rewind = useCallback(() => {
    if (!eeRef.current || !isLoaded) return;
    eeRef.current.emit("rewind");
    onTimeUpdateRef.current(0);
  }, [isLoaded]);

  // Export audio as WAV blob
  const exportAudio = useCallback(async (): Promise<Blob | null> => {
    if (!eeRef.current || !playlistRef.current || !isLoaded) return null;

    if (!exporterInitializedRef.current) {
      playlistRef.current.initExporter();
      exporterInitializedRef.current = true;
    }

    return new Promise<Blob | null>((resolve) => {
      const ee = eeRef.current;

      const timeout = setTimeout(() => {
        ee.off("audiorenderingfinished", onRenderFinished);
        console.error("Audio export timed out");
        resolve(null);
      }, EXPORT_TIMEOUT_MS);

      const onRenderFinished = (_type: unknown, blob: unknown) => {
        clearTimeout(timeout);
        ee.off("audiorenderingfinished", onRenderFinished);
        resolve(blob as Blob);
      };

      ee.on("audiorenderingfinished", onRenderFinished);
      ee.emit("startaudiorendering", "wav");
    });
  }, [isLoaded]);

  return { play, pause, stop, rewind, isLoaded, exportAudio };
}
