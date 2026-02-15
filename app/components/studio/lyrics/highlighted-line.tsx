"use client";

import { useState } from "react";
import { Span } from "@/lib/lyrics-types";

interface Props {
  text: string;
  spans: Span[];
}

const SPAN_COLORS: Record<Span["type"], { bg: string; border: string }> = {
  cliche: { bg: "rgba(251, 191, 36, 0.2)", border: "rgb(251, 191, 36)" },
  filler: { bg: "rgba(239, 68, 68, 0.2)", border: "rgb(239, 68, 68)" },
  vague: { bg: "rgba(168, 85, 247, 0.2)", border: "rgb(168, 85, 247)" },
  repetition: { bg: "rgba(59, 130, 246, 0.2)", border: "rgb(59, 130, 246)" },
};

interface Segment {
  text: string;
  span: Span | null;
}

function buildSegments(text: string, spans: Span[]): Segment[] {
  if (spans.length === 0) return [{ text, span: null }];

  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const span of sorted) {
    const start = Math.max(span.start, cursor);
    const end = Math.min(span.end, text.length);
    if (start >= end) continue;

    if (cursor < start) {
      segments.push({ text: text.slice(cursor, start), span: null });
    }
    segments.push({ text: text.slice(start, end), span });
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), span: null });
  }

  return segments;
}

export function HighlightedLine({ text, spans }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const segments = buildSegments(text, spans);

  return (
    <div className="whitespace-pre-wrap break-words leading-[1.5em] relative text-white/80 font-mono text-sm">
      {segments.map((seg, i) => {
        if (!seg.span) return <span key={i}>{seg.text}</span>;

        const colors = SPAN_COLORS[seg.span.type];
        return (
          <span
            key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            className="relative cursor-default"
            style={{
              background: colors.bg,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            {seg.text}
            {hoveredIdx === i && (
              <span className="absolute bottom-full left-0 bg-[#1a1a1b] text-white/50 border border-white/10 rounded px-2 py-0.5 text-[10px] font-sans whitespace-nowrap z-10 pointer-events-none mb-0.5 uppercase tracking-wide">
                {seg.span.type} — {seg.span.label}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
