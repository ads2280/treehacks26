"use client";

import { useState, useEffect, useRef } from "react";
import { LyricDoc, Annotations } from "@/lib/lyrics-types";
import { analyzeWithSections } from "@/lib/lyrics-analysis";

export function useLyricsAnalysis(
  doc: LyricDoc | null,
  debounceMs = 300,
): Annotations | null {
  const [annotations, setAnnotations] = useState<Annotations | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!doc || doc.lines.length === 0) {
      setAnnotations(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const result = analyzeWithSections(doc);
      setAnnotations(result);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [doc, debounceMs]);

  return annotations;
}
