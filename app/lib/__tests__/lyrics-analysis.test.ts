import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/lyrics-analysis";
import { LyricDoc } from "@/lib/lyrics-types";

describe("lyrics analysis", () => {
  it("computes syllables, spans, repetition, and rhyme clusters while skipping structure tags", () => {
    const doc: LyricDoc = {
      lines: [
        { id: "L1", text: "I wear my heart on my sleeve tonight" },
        { id: "L2", text: "basically I run run run to you" },
        { id: "L3", text: "[Chorus]" },
        { id: "L4", text: "I still chase your light in the night" },
      ],
    };

    const annotations = analyze(doc);

    expect(annotations.line_metrics.L1?.syllables).toBeGreaterThan(0);
    expect(annotations.line_metrics.L2?.words).toBeGreaterThan(0);
    expect(annotations.line_metrics.L3).toBeUndefined();

    expect(annotations.spans.some((span) => span.type === "cliche" && span.line_id === "L1")).toBe(true);
    expect(annotations.spans.some((span) => span.type === "filler" && span.line_id === "L2")).toBe(true);
    expect(annotations.spans.some((span) => span.type === "repetition" && span.label.includes("run"))).toBe(true);

    expect(annotations.repetition.unigrams.some((u) => u.token === "run" && u.count >= 3)).toBe(true);
    expect(Object.values(annotations.rhyme.clusters).some((lineIds) => lineIds.includes("L1") && lineIds.includes("L4"))).toBe(true);
  });

  it("creates repetition spans for each repeated token occurrence in a line", () => {
    const doc: LyricDoc = {
      lines: [{ id: "L1", text: "Fire fire fire now" }],
    };

    const annotations = analyze(doc);
    const fireSpans = annotations.spans.filter(
      (span) => span.type === "repetition" && span.label.includes("fire"),
    );

    expect(fireSpans.length).toBe(3);
  });
});
