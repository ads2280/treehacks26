'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Project, Layer, StemType, ABState, CachedStem } from '@/lib/types';

const STORAGE_KEY = 'layertune_project';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function createEmptyProject(): Project {
  return {
    id: generateId(),
    title: 'Untitled',
    vibePrompt: '',
    duration: 0,
    layers: [],
    originalClipId: null,
    stemCache: [],
    abState: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function loadProject(): Project {
  if (typeof window === 'undefined') return createEmptyProject();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return createEmptyProject();
}

function saveProject(project: Project) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // ignore - localStorage full
  }
}

export function useProject() {
  const [project, setProject] = useState<Project>(createEmptyProject);
  const initialized = useRef(false);

  // Load from localStorage on mount (client only).
  // This must be an effect because localStorage is unavailable during SSR.
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProject(loadProject());
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (initialized.current) {
      saveProject(project);
    }
  }, [project]);

  const updateProject = useCallback((updates: Partial<Project>) => {
    setProject((prev) => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setVibePrompt = useCallback((prompt: string) => {
    updateProject({ vibePrompt: prompt });
  }, [updateProject]);

  const setOriginalClipId = useCallback((clipId: string) => {
    updateProject({ originalClipId: clipId });
  }, [updateProject]);

  const addLayer = useCallback(
    (layer: Omit<Layer, 'id' | 'projectId' | 'createdAt'>) => {
      const newLayer: Layer = {
        ...layer,
        id: generateId(),
        projectId: project.id,
        createdAt: new Date().toISOString(),
      };
      setProject((prev) => ({
        ...prev,
        layers: [...prev.layers, newLayer],
        updatedAt: new Date().toISOString(),
      }));
      return newLayer.id;
    },
    [project.id]
  );

  const removeLayer = useCallback((layerId: string) => {
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== layerId),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updateLayer = useCallback(
    (layerId: string, updates: Partial<Layer>) => {
      setProject((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === layerId ? { ...l, ...updates } : l
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    []
  );

  const setLayerVolume = useCallback(
    (layerId: string, volume: number) => {
      updateLayer(layerId, { volume: Math.max(0, Math.min(1, volume)) });
    },
    [updateLayer]
  );

  const toggleMute = useCallback(
    (layerId: string) => {
      setProject((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === layerId ? { ...l, isMuted: !l.isMuted } : l
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    []
  );

  const toggleSolo = useCallback(
    (layerId: string) => {
      setProject((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === layerId ? { ...l, isSoloed: !l.isSoloed } : l
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    []
  );

  const setABState = useCallback(
    (layerId: string, state: ABState) => {
      setProject((prev) => ({
        ...prev,
        abState: { ...prev.abState, [layerId]: state },
        updatedAt: new Date().toISOString(),
      }));
    },
    []
  );

  const startABComparison = useCallback(
    (layerId: string) => {
      setABState(layerId, 'comparing');
    },
    [setABState]
  );

  const keepA = useCallback(
    (layerId: string) => {
      setProject((prev) => {
        const layer = prev.layers.find((l) => l.id === layerId);
        if (!layer || !layer.previousAudioUrl) return prev;
        return {
          ...prev,
          layers: prev.layers.map((l) =>
            l.id === layerId
              ? { ...l, audioUrl: l.previousAudioUrl, previousAudioUrl: null }
              : l
          ),
          abState: { ...prev.abState, [layerId]: 'none' },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    []
  );

  const keepB = useCallback(
    (layerId: string) => {
      setProject((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === layerId ? { ...l, previousAudioUrl: null } : l
        ),
        abState: { ...prev.abState, [layerId]: 'none' },
        updatedAt: new Date().toISOString(),
      }));
    },
    []
  );

  const setStemCache = useCallback((stems: CachedStem[]) => {
    updateProject({ stemCache: stems });
  }, [updateProject]);

  const consumeCachedStem = useCallback((stemType: StemType): CachedStem | null => {
    let found: CachedStem | null = null;
    setProject((prev) => {
      const match = prev.stemCache.find((s) => s.stemType === stemType);
      if (!match) return prev;
      found = match;
      return {
        ...prev,
        stemCache: prev.stemCache.filter((s) => s !== match),
        updatedAt: new Date().toISOString(),
      };
    });
    return found;
  }, []);

  const resetProject = useCallback(() => {
    const fresh = createEmptyProject();
    setProject(fresh);
  }, []);

  return {
    project,
    setVibePrompt,
    setOriginalClipId,
    addLayer,
    removeLayer,
    updateLayer,
    setLayerVolume,
    toggleMute,
    toggleSolo,
    setABState,
    startABComparison,
    keepA,
    keepB,
    setStemCache,
    consumeCachedStem,
    resetProject,
    updateProject,
  };
}
