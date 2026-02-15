"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Project, Layer, ABState, StemType, CachedStem } from "@/lib/layertune-types";

const STORAGE_KEY = "producething_project";

function createEmptyProject(): Project {
  return {
    id: crypto.randomUUID(),
    title: "Untitled Project",
    vibePrompt: "",
    duration: 120,
    layers: [],
    originalClipId: null,
    stemCache: [],
    abState: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function loadProject(): Project {
  if (typeof window === "undefined") return createEmptyProject();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const project = JSON.parse(raw) as Project;
      // Clean up stale generation state: generationStatus is ephemeral (tied to
      // async polling loops). After a page reload those loops are dead, so layers
      // stuck in "generating"/"separating"/"loading" will never resolve.
      // - Layers WITH audioUrl: clear status → playable
      // - Layers WITHOUT audioUrl: dead placeholders → remove entirely
      project.layers = project.layers
        .filter((l) => l.audioUrl || !l.generationStatus)
        .map((l) => {
          if (l.generationStatus) {
            const { generationStatus: _, ...clean } = l;
            return clean as typeof l;
          }
          return l;
        });
      return project;
    }
  } catch {
    // ignore
  }
  return createEmptyProject();
}

function saveProject(project: Project) {
  if (typeof window === "undefined") return;
  try {
    // Strip generationStatus before saving — it's ephemeral runtime state
    // tied to async flows that won't survive a page reload
    const toSave = {
      ...project,
      layers: project.layers.map(({ generationStatus: _, ...rest }) => rest),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // ignore - localStorage full
  }
}

export function useProject() {
  const [project, setProject] = useState<Project>(createEmptyProject);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setProject(loadProject());
    }
  }, []);

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

  const setVibePrompt = useCallback(
    (prompt: string) => {
      updateProject({ vibePrompt: prompt });
    },
    [updateProject]
  );

  const setOriginalClipId = useCallback(
    (clipId: string) => {
      updateProject({ originalClipId: clipId });
    },
    [updateProject]
  );

  const resetProject = useCallback(() => {
    setProject(createEmptyProject());
  }, []);

  const addLayer = useCallback(
    (layer: Omit<Layer, "id" | "createdAt">): string => {
      const id = crypto.randomUUID();
      const newLayer: Layer = {
        ...layer,
        id,
        createdAt: new Date().toISOString(),
      };
      setProject((prev) => ({
        ...prev,
        layers: [...prev.layers, newLayer],
        updatedAt: new Date().toISOString(),
      }));
      return id;
    },
    []
  );

  const removeLayer = useCallback((layerId: string) => {
    setProject((prev) => {
      const abCopy = { ...prev.abState };
      delete abCopy[layerId];
      return {
        ...prev,
        layers: prev.layers.filter((l) => l.id !== layerId),
        abState: abCopy,
        updatedAt: new Date().toISOString(),
      };
    });
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

  const toggleMute = useCallback((layerId: string) => {
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === layerId ? { ...l, isMuted: !l.isMuted } : l
      ),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const toggleSolo = useCallback((layerId: string) => {
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === layerId ? { ...l, isSoloed: !l.isSoloed } : l
      ),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setABState = useCallback((layerId: string, state: ABState) => {
    setProject((prev) => ({
      ...prev,
      abState: { ...prev.abState, [layerId]: state },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const startABComparison = useCallback(
    (layerId: string) => {
      setABState(layerId, "comparing");
    },
    [setABState]
  );

  const keepA = useCallback((layerId: string) => {
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
        abState: { ...prev.abState, [layerId]: "none" },
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const keepB = useCallback((layerId: string) => {
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === layerId ? { ...l, previousAudioUrl: null } : l
      ),
      abState: { ...prev.abState, [layerId]: "none" },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setStemCache = useCallback(
    (stems: CachedStem[]) => {
      updateProject({ stemCache: stems });
    },
    [updateProject]
  );

  const consumeCachedStem = useCallback(
    (stemType: StemType): CachedStem | null => {
      let found: CachedStem | null = null;
      setProject((prev) => {
        const idx = prev.stemCache.findIndex((s) => s.stemType === stemType);
        if (idx === -1) return prev;
        found = prev.stemCache[idx];
        return {
          ...prev,
          stemCache: [
            ...prev.stemCache.slice(0, idx),
            ...prev.stemCache.slice(idx + 1),
          ],
          updatedAt: new Date().toISOString(),
        };
      });
      return found;
    },
    []
  );

  return {
    project,
    layers: project.layers,
    masterVolume,
    setMasterVolume,

    updateProject,
    setVibePrompt,
    setOriginalClipId,
    resetProject,
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
  };
}
