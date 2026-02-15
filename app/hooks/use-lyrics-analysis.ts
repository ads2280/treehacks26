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

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/lyrics/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc }),
        });

        if (!res.ok) {
          throw new Error(`Analyze request failed (${res.status})`);
        }

        const data = (await res.json()) as { annotations?: Annotations };
        if (!data.annotations) {
          throw new Error("Analyze response missing annotations");
        }

        setAnnotations(data.annotations);
      } catch (error) {
        console.error("[useLyricsAnalysis] API analyze failed, using local fallback:", error);
        const result = analyzeWithSections(doc);
        setAnnotations(result);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [doc, debounceMs]);

  return annotations;
}
