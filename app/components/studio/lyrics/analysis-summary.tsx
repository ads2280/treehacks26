"use client";

import { Annotations } from "@/lib/lyrics-types";
import { Loader2 } from "lucide-react";

interface Props {
  annotations: Annotations | null;
  onTighten: () => void;
  isProducing: boolean;
}

export function AnalysisSummary({ annotations, onTighten, isProducing }: Props) {
  if (!annotations) return null;

  const issueCount = annotations.spans.length;
  const rhymeCount = Object.keys(annotations.rhyme.clusters).length;
  const lineIds = Object.keys(annotations.line_metrics);
  const avgSyllables = lineIds.length > 0
    ? Math.round(
        lineIds.reduce((sum, id) => sum + (annotations.line_metrics[id]?.syllables ?? 0), 0) /
          lineIds.length,
      )
    : 0;

  return (
    <div className="px-3 py-1.5 border-b border-white/10 flex items-center gap-1.5 flex-wrap">
      {issueCount > 0 && (
        <span className="px-2 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
          {issueCount} issue{issueCount !== 1 ? "s" : ""}
        </span>
      )}
      {rhymeCount > 0 && (
        <span className="px-2 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
          {rhymeCount} rhyme{rhymeCount !== 1 ? "s" : ""}
        </span>
      )}
      {avgSyllables > 0 && (
        <span className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-white/40 border border-white/10 font-mono">
          avg {avgSyllables} syl
        </span>
      )}
      <div className="flex-1" />
      <button
        onClick={onTighten}
        disabled={isProducing}
        className="px-2.5 py-0.5 text-[10px] rounded bg-[#c4f567]/10 text-[#c4f567] border border-[#c4f567]/20 hover:bg-[#c4f567]/20 font-mono uppercase tracking-wider disabled:opacity-40 flex items-center gap-1 transition-colors"
      >
        {isProducing ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Working...
          </>
        ) : (
          "Tighten"
        )}
      </button>
    </div>
  );
}
