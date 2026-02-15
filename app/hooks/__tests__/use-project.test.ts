import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProject } from '../use-project';
import { StemType } from '@/lib/layertune-types';

// Mock localStorage
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((key) => delete store[key]);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
    length: 0,
    key: vi.fn(() => null),
  });
});

function makeLayer(overrides?: Partial<{ stemType: StemType; name: string }>) {
  return {
    name: overrides?.name ?? 'Test Layer',
    stemType: overrides?.stemType ?? ('drums' as StemType),
    prompt: 'test',
    audioUrl: 'https://example.com/audio.mp3',
    previousAudioUrl: null,
    volume: 0.8,
    isMuted: false,
    isSoloed: false,
    position: 0,
    sunoClipId: null,
    generationJobId: null,
    projectId: 'test-project',
  };
}

describe('useProject', () => {
  it('creates a project with empty layers', () => {
    const { result } = renderHook(() => useProject());
    expect(result.current.project.layers).toEqual([]);
    expect(result.current.project.id).toBeTruthy();
  });

  it('adds a layer', () => {
    const { result } = renderHook(() => useProject());
    act(() => {
      result.current.addLayer(makeLayer());
    });
    expect(result.current.project.layers).toHaveLength(1);
    expect(result.current.project.layers[0].name).toBe('Test Layer');
    expect(result.current.project.layers[0].stemType).toBe('drums');
  });

  it('removes a layer', () => {
    const { result } = renderHook(() => useProject());
    let layerId: string;
    act(() => {
      layerId = result.current.addLayer(makeLayer());
    });
    expect(result.current.project.layers).toHaveLength(1);
    act(() => {
      result.current.removeLayer(layerId);
    });
    expect(result.current.project.layers).toHaveLength(0);
  });

  it('toggles mute', () => {
    const { result } = renderHook(() => useProject());
    let layerId: string;
    act(() => {
      layerId = result.current.addLayer(makeLayer());
    });
    expect(result.current.project.layers[0].isMuted).toBe(false);
    act(() => {
      result.current.toggleMute(layerId);
    });
    expect(result.current.project.layers[0].isMuted).toBe(true);
    act(() => {
      result.current.toggleMute(layerId);
    });
    expect(result.current.project.layers[0].isMuted).toBe(false);
  });

  it('toggles solo', () => {
    const { result } = renderHook(() => useProject());
    let layerId: string;
    act(() => {
      layerId = result.current.addLayer(makeLayer());
    });
    expect(result.current.project.layers[0].isSoloed).toBe(false);
    act(() => {
      result.current.toggleSolo(layerId);
    });
    expect(result.current.project.layers[0].isSoloed).toBe(true);
  });

  it('sets layer volume clamped to [0,1]', () => {
    const { result } = renderHook(() => useProject());
    let layerId: string;
    act(() => {
      layerId = result.current.addLayer(makeLayer());
    });
    act(() => {
      result.current.setLayerVolume(layerId, 1.5);
    });
    expect(result.current.project.layers[0].volume).toBe(1);
    act(() => {
      result.current.setLayerVolume(layerId, -0.5);
    });
    expect(result.current.project.layers[0].volume).toBe(0);
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useProject());
    act(() => {
      result.current.addLayer(makeLayer());
    });
    const stored = store['producething_project'];
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored);
    expect(parsed.layers).toHaveLength(1);
  });

  it('manages A/B state transitions', () => {
    const { result } = renderHook(() => useProject());
    let layerId = '';
    act(() => {
      layerId = result.current.addLayer(makeLayer());
    });

    // Start comparison
    act(() => {
      result.current.startABComparison(layerId);
    });
    expect(result.current.project.abState[layerId]).toBe('comparing');

    // Keep B (new version)
    act(() => {
      result.current.keepB(layerId);
    });
    expect(result.current.project.abState[layerId]).toBe('none');
  });

  it('keepA reverts to previous audio', () => {
    const { result } = renderHook(() => useProject());
    let layerId = '';
    act(() => {
      layerId = result.current.addLayer({
        ...makeLayer(),
        audioUrl: 'new.mp3',
        previousAudioUrl: 'old.mp3',
      });
    });
    act(() => {
      result.current.startABComparison(layerId);
    });
    act(() => {
      result.current.keepA(layerId);
    });
    const layer = result.current.project.layers[0];
    expect(layer.audioUrl).toBe('old.mp3');
    expect(layer.previousAudioUrl).toBeNull();
    expect(result.current.project.abState[layerId]).toBe('none');
  });

  it('keepB clears previousAudioUrl and keeps current audio', () => {
    const { result } = renderHook(() => useProject());
    let layerId = '';
    act(() => {
      layerId = result.current.addLayer({
        ...makeLayer(),
        audioUrl: 'new.mp3',
        previousAudioUrl: 'old.mp3',
      });
    });
    act(() => {
      result.current.startABComparison(layerId);
    });
    act(() => {
      result.current.keepB(layerId);
    });
    const layer = result.current.project.layers[0];
    expect(layer.audioUrl).toBe('new.mp3');
    expect(layer.previousAudioUrl).toBeNull();
    expect(result.current.project.abState[layerId]).toBe('none');
  });

  it('keepA is no-op when previousAudioUrl is null', () => {
    const { result } = renderHook(() => useProject());
    let layerId = '';
    act(() => {
      layerId = result.current.addLayer(makeLayer());
    });
    const audioBefore = result.current.project.layers[0].audioUrl;
    act(() => {
      result.current.keepA(layerId);
    });
    // audioUrl should remain unchanged since previousAudioUrl was null
    expect(result.current.project.layers[0].audioUrl).toBe(audioBefore);
  });

  it('setABState directly sets state for a layer', () => {
    const { result } = renderHook(() => useProject());
    let layerId = '';
    act(() => {
      layerId = result.current.addLayer(makeLayer());
    });
    act(() => {
      result.current.setABState(layerId, 'comparing');
    });
    expect(result.current.project.abState[layerId]).toBe('comparing');
    act(() => {
      result.current.setABState(layerId, 'none');
    });
    expect(result.current.project.abState[layerId]).toBe('none');
  });

  it('resets project', () => {
    const { result } = renderHook(() => useProject());
    act(() => {
      result.current.addLayer(makeLayer());
      result.current.setVibePrompt('test vibe');
    });
    act(() => {
      result.current.resetProject();
    });
    expect(result.current.project.layers).toHaveLength(0);
    expect(result.current.project.vibePrompt).toBe('');
  });
});
