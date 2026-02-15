declare module 'waveform-playlist' {
  import EventEmitter from 'event-emitter';

  interface TrackConfig {
    src: string;
    name: string;
    gain?: number;
    muted?: boolean;
    soloed?: boolean;
    customClass?: string;
    waveOutlineColor?: string;
    start?: number;
    cuein?: number;
    cueout?: number;
    states?: Record<string, boolean>;
    fadeIn?: { shape: string; duration: number };
    fadeOut?: { shape: string; duration: number };
    selected?: { start: number; end: number };
    peaks?: { type: string; mono: boolean };
    stereoPan?: number;
    effects?: unknown;
  }

  interface PlaylistConfig {
    container: HTMLElement;
    ac?: AudioContext;
    samplesPerPixel?: number;
    sampleRate?: number;
    mono?: boolean;
    waveHeight?: number;
    collapsedWaveHeight?: number;
    isAutomaticScroll?: boolean;
    isContinuousPlay?: boolean;
    linkedEndpoints?: boolean;
    timescale?: boolean;
    state?: string;
    fadeType?: string;
    exclSolo?: boolean;
    barWidth?: number;
    barGap?: number;
    colors?: {
      waveOutlineColor?: string;
      timeColor?: string;
      fadeColor?: string;
    };
    controls?: {
      show?: boolean;
      width?: number;
      widgets?: {
        muteOrSolo?: boolean;
        volume?: boolean;
        stereoPan?: boolean;
        collapse?: boolean;
        remove?: boolean;
      };
    };
    zoomLevels?: number[];
    seekStyle?: string;
    annotationList?: {
      annotations?: unknown[];
      controls?: unknown[];
      editable?: boolean;
      linkEndpoints?: boolean;
      isContinuousPlay?: boolean;
    };
    effects?: unknown;
  }

  interface Track {
    src: string;
    getStartTime(): number;
    getEndTime(): number;
    getDuration(): number;
    setStartTime(time: number): void;
    setName(name: string): void;
    setGainLevel(gain: number): void;
    setMasterGainLevel(gain: number): void;
    setStereoPanValue(value: number): void;
    setBuffer(buffer: AudioBuffer): void;
    setCues(cuein: number, cueout: number): void;
    setCustomClass(customClass: string | undefined): void;
    setEventEmitter(ee: EventEmitter): void;
    setEnabledStates(states: Record<string, boolean>): void;
    setFadeIn(duration: number, shape: string): void;
    setFadeOut(duration: number, shape: string): void;
    setPeaks(peaks: unknown): void;
    calculatePeaks(samplesPerPixel: number, sampleRate: number): void;
    trim(start: number, end: number): void;
  }

  interface PlaylistInstance {
    tracks: Track[];
    duration: number;
    playbackSeconds: number;
    masterGain: number;
    ac: AudioContext;
    ee: EventEmitter;

    load(tracks: TrackConfig[]): Promise<void>;
    play(start?: number, end?: number): Promise<void>;
    pause(): void;
    stop(): Promise<void>;
    rewind(): void;
    fastForward(): void;
    clear(): Promise<void>;
    setMasterGain(gain: number): void;
    getEventEmitter(): EventEmitter;
    initExporter(): void;
    setShowTimeScale(show: boolean): void;
    setSamplesPerPixel(samplesPerPixel: number): void;
    setZoom(zoom: number): void;
    adjustDuration(): void;
    drawRequest(): void;
    draw(tree: unknown): void;
    render(): unknown;
    isPlaying(): boolean;
    getTimeSelection(): { start: number; end: number };
    setTimeSelection(start: number, end: number): void;
  }

  export function init(
    config: PlaylistConfig,
    ee?: EventEmitter
  ): PlaylistInstance;

  export default function WaveformPlaylist(
    config: PlaylistConfig,
    ee?: EventEmitter
  ): PlaylistInstance;
}

declare module 'event-emitter' {
  interface EventEmitter {
    on(event: string, listener: (...args: unknown[]) => void): EventEmitter;
    off(event: string, listener: (...args: unknown[]) => void): EventEmitter;
    emit(event: string, ...args: unknown[]): void;
    once(event: string, listener: (...args: unknown[]) => void): EventEmitter;
  }

  function ee(target?: object): EventEmitter;
  export = ee;
}
