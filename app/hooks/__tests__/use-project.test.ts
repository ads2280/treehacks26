import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProject } from '../use-project';
import type { StemType, CachedStem } from '@/lib/layertune-types';

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

function makeLayer(overrides?: Partial<{ stemType: StemType; name: string; audioUrl: string }>) {
  return {
    name: overrides?.name ?? 'Test Layer',
    stemType: overrides?.stemType ?? ('drums' as StemType),
    prompt: 'test',
    audioUrl: overrides?.audioUrl ?? 'https://example.com/audio.mp3',
    volume: 0.8,
    isMuted: false,
    isSoloed: false,
    position: 0,
    sunoClipId: null,
    generationJobId: null,
    projectId: 'test-project',
    versions: [],
    versionCursor: 0,
  };
}

function makeCachedStem(stemType: StemType, audioUrl?: string): CachedStem {
  return {
    stemType,
    audioUrl: audioUrl ?? `/api/audio-proxy?url=https%3A%2F%2Fcdn1.suno.ai%2F${stemType}.mp3`,
    sunoClipId: `clip-${stemType}`,
    fromClipId: 'original-clip',
    createdAt: new Date().toISOString(),
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

describe('consumeCachedStem (Bug #6 + #9 fix)', () => {
  it('returns the matching stem and removes it from cache', () => {
    const { result } = renderHook(() => useProject());
    act(() => {
      result.current.appendStemCache([
        makeCachedStem('guitar'),
        makeCachedStem('bass'),
        makeCachedStem('vocals'),
      ]);
    });
    expect(result.current.project.stemCache).toHaveLength(3);

    let found: CachedStem | null = null;
    act(() => {
      found = result.current.consumeCachedStem('bass');
    });

    // Should return the bass stem
    expect(found).not.toBeNull();
    expect(found!.stemType).toBe('bass');
    expect(found!.audioUrl).toContain('bass.mp3');

    // Should be removed from cache, others remain
    expect(result.current.project.stemCache).toHaveLength(2);
    expect(result.current.project.stemCache.map((s) => s.stemType)).toEqual(['guitar', 'vocals']);
  });

  it('returns null when stem type is not in cache', () => {
    const { result } = renderHook(() => useProject());
    act(() => {
      result.current.appendStemCache([makeCachedStem('guitar')]);
    });

    let found: CachedStem | null = null;
    act(() => {
      found = result.current.consumeCachedStem('synth');
    });

    expect(found).toBeNull();
    // Cache should be unchanged
    expect(result.current.project.stemCache).toHaveLength(1);
  });

  it('returns null for empty cache', () => {
    const { result } = renderHook(() => useProject());

    let found: CachedStem | null = null;
    act(() => {
      found = result.current.consumeCachedStem('drums');
    });

    expect(found).toBeNull();
  });

  it('skips entries with empty audioUrl', () => {
    const { result } = renderHook(() => useProject());
    // Manually set cache with a broken entry (bypass appendStemCache validation)
    act(() => {
      result.current.setStemCache([
        { stemType: 'guitar', audioUrl: '/api/audio-proxy?url=', sunoClipId: 'x', fromClipId: 'y', createdAt: '' },
        makeCachedStem('bass'),
      ]);
    });

    let found: CachedStem | null = null;
    act(() => {
      // guitar has broken URL — should be skipped
      found = result.current.consumeCachedStem('guitar');
    });
    expect(found).toBeNull();
    // Cache should be unchanged (broken entry not removed)
    expect(result.current.project.stemCache).toHaveLength(2);

    // bass should still work
    act(() => {
      found = result.current.consumeCachedStem('bass');
    });
    expect(found).not.toBeNull();
    expect(found!.stemType).toBe('bass');
  });

  it('does not clobber stems added concurrently (Bug #9 race condition)', () => {
    const { result } = renderHook(() => useProject());

    // Simulate: initial cache has bass + guitar
    act(() => {
      result.current.appendStemCache([
        makeCachedStem('bass'),
        makeCachedStem('guitar'),
      ]);
    });
    expect(result.current.project.stemCache).toHaveLength(2);

    // Now simulate the race: append synth AND consume bass in the same act()
    // (simulates background polling + user action happening close together)
    let found: CachedStem | null = null;
    act(() => {
      // Background polling adds synth
      result.current.appendStemCache([makeCachedStem('synth')]);
      // User consumes bass
      found = result.current.consumeCachedStem('bass');
    });

    // Bass should have been found and returned
    expect(found).not.toBeNull();
    expect(found!.stemType).toBe('bass');

    // Both guitar AND synth should remain — synth must NOT be clobbered
    const remaining = result.current.project.stemCache.map((s) => s.stemType);
    expect(remaining).toContain('guitar');
    expect(remaining).toContain('synth');
    expect(remaining).not.toContain('bass');
    expect(result.current.project.stemCache).toHaveLength(2);
  });

  it('consuming multiple stems sequentially works correctly', () => {
    const { result } = renderHook(() => useProject());
    act(() => {
      result.current.appendStemCache([
        makeCachedStem('drums'),
        makeCachedStem('bass'),
        makeCachedStem('guitar'),
        makeCachedStem('vocals'),
      ]);
    });

    let d: CachedStem | null = null;
    let b: CachedStem | null = null;
    let g: CachedStem | null = null;

    act(() => { d = result.current.consumeCachedStem('drums'); });
    act(() => { b = result.current.consumeCachedStem('bass'); });
    act(() => { g = result.current.consumeCachedStem('guitar'); });

    expect(d!.stemType).toBe('drums');
    expect(b!.stemType).toBe('bass');
    expect(g!.stemType).toBe('guitar');

    // Only vocals should remain
    expect(result.current.project.stemCache).toHaveLength(1);
    expect(result.current.project.stemCache[0].stemType).toBe('vocals');
  });
});

describe('appendStemCache', () => {
  it('adds stems to empty cache', () => {
    const { result } = renderHook(() => useProject());
    act(() => {
      result.current.appendStemCache([
        makeCachedStem('guitar'),
        makeCachedStem('bass'),
      ]);
    });
    expect(result.current.project.stemCache).toHaveLength(2);
  });

  it('deduplicates by stemType', () => {
    const { result } = renderHook(() => useProject());
    act(() => {
      result.current.appendStemCache([makeCachedStem('guitar')]);
    });
    act(() => {
      // Try to add guitar again — should be rejected
      result.current.appendStemCache([makeCachedStem('guitar')]);
    });
    expect(result.current.project.stemCache).toHaveLength(1);
  });

  it('rejects entries with broken audioUrl', () => {
    const { result } = renderHook(() => useProject());
    act(() => {
      result.current.appendStemCache([
        { stemType: 'guitar', audioUrl: '/api/audio-proxy?url=', sunoClipId: 'x', fromClipId: 'y', createdAt: '' },
        { stemType: 'bass', audioUrl: '', sunoClipId: 'x', fromClipId: 'y', createdAt: '' },
      ]);
    });
    expect(result.current.project.stemCache).toHaveLength(0);
  });

  it('multiple appends accumulate correctly', () => {
    const { result } = renderHook(() => useProject());
    act(() => { result.current.appendStemCache([makeCachedStem('drums')]); });
    act(() => { result.current.appendStemCache([makeCachedStem('bass')]); });
    act(() => { result.current.appendStemCache([makeCachedStem('guitar')]); });
    expect(result.current.project.stemCache).toHaveLength(3);
    expect(result.current.project.stemCache.map((s) => s.stemType)).toEqual(['drums', 'bass', 'guitar']);
  });
});
