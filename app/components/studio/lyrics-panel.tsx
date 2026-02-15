"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LyricDoc, Suggestion, ProduceOperation } from "@/lib/lyrics-types";
import { stringToLyricDoc, lyricDocToString, isStructureTag } from "@/lib/lyrics-utils";
import { useLyricsAnalysis } from "@/hooks/use-lyrics-analysis";
import { HighlightedLine } from "./lyrics/highlighted-line";
import { AnalysisSummary } from "./lyrics/analysis-summary";
import { SuggestionCard } from "./lyrics/suggestion-card";

interface LyricsPanelProps {
  lyrics: string;
  onLyricsChange: (lyrics: string) => void;
  onClose: () => void;
  onUseLyrics: () => void;
}

const STRUCTURE_TAGS = ["[Intro]", "[Verse]", "[Chorus]", "[Bridge]", "[Outro]"];

export function LyricsPanel({
  lyrics,
  onLyricsChange,
  onClose,
  onUseLyrics,
}: LyricsPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isProducing, setIsProducing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Convert string to LyricDoc for analysis
  const doc = useMemo<LyricDoc | null>(() => {
    if (!lyrics.trim()) return null;
    return stringToLyricDoc(lyrics);
  }, [lyrics]);

  // Debounced analysis
  const annotations = useLyricsAnalysis(doc);

  const insertTag = (tag: string) => {
    const newLyrics = lyrics ? `${lyrics}\n\n${tag}\n` : `${tag}\n`;
    onLyricsChange(newLyrics);
  };

  // Sync scroll between textarea and overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Call the produce API
  const handleProduce = useCallback(
    async (operation: ProduceOperation = "tighten") => {
      if (!doc || isProducing) return;

      setIsProducing(true);
      setShowSuggestions(true);

      try {
        const res = await fetch("/api/lyrics/produce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc, annotations, operation }),
        });

        if (!res.ok) {
          const err = await res.json();
          console.error("[LyricsPanel] Produce error:", err);
          return;
        }

        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch (err) {
        console.error("[LyricsPanel] Produce fetch error:", err);
      } finally {
        setIsProducing(false);
      }
    },
    [doc, annotations, isProducing],
  );

  // Accept a suggestion: apply replace_line ops
  const handleAcceptSuggestion = useCallback(
    (suggestion: Suggestion) => {
      if (!doc) return;

      let updatedDoc: LyricDoc = { lines: [...doc.lines] };
      for (const op of suggestion.ops) {
        if (op.type === "replace_line") {
          updatedDoc = {
            lines: updatedDoc.lines.map((l) =>
              l.id === op.line_id ? { ...l, text: op.text } : l,
            ),
          };
        }
      }

      const newLyrics = lyricDocToString(updatedDoc);
      onLyricsChange(newLyrics);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    },
    [doc, onLyricsChange],
  );

  const handleDismissSuggestion = useCallback((suggestion: Suggestion) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  }, []);

  // Build highlighted overlay lines
  const overlayLines = useMemo(() => {
    if (!doc) return null;

    return doc.lines.map((line) => {
      if (isStructureTag(line.text)) {
        return (
          <div key={line.id} className="text-white/30 italic font-mono text-sm leading-[1.5em] whitespace-pre-wrap break-words">
            {line.text}
          </div>
        );
      }

      const lineSpans = annotations?.spans.filter((s) => s.line_id === line.id) ?? [];
      if (lineSpans.length === 0) {
        return (
          <div key={line.id} className="text-transparent font-mono text-sm leading-[1.5em] whitespace-pre-wrap break-words">
            {line.text || "\u00A0"}
          </div>
        );
      }

      return (
        <HighlightedLine key={line.id} text={line.text} spans={lineSpans} />
      );
    });
  }, [doc, annotations]);

  const hasAnnotations = annotations && (annotations.spans.length > 0 || Object.keys(annotations.rhyme.clusters).length > 0);

  return (
    <div className="w-80 flex flex-col bg-[#0a0a0a] border-l border-white/10 max-h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-white/80">Lyrics</span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Structure tag buttons */}
      <div className="px-3 py-2 border-b border-white/10 shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {STRUCTURE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => insertTag(tag)}
              className="px-2.5 py-1 text-xs rounded-md bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20 font-mono transition-all"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis summary bar */}
      {hasAnnotations && (
        <AnalysisSummary
          annotations={annotations}
          onTighten={() => handleProduce("tighten")}
          isProducing={isProducing}
        />
      )}

      {/* Editor area with overlay */}
      <div className="flex-1 p-3 min-h-0">
        <div className="relative w-full h-full">
          {/* Highlighted overlay */}
          {overlayLines && (
            <div
              ref={overlayRef}
              className="absolute inset-0 bg-white/5 border border-white/10 rounded-lg p-3 overflow-hidden pointer-events-none"
              aria-hidden
            >
              {overlayLines}
            </div>
          )}

          {/* Textarea (transparent text when highlights exist, visible when no annotations) */}
          <textarea
            ref={textareaRef}
            value={lyrics}
            onChange={(e) => onLyricsChange(e.target.value)}
            onScroll={handleScroll}
            placeholder={"[Verse]\nWrite your lyrics here...\n\n[Chorus]\n..."}
            className={`w-full h-full border border-white/10 rounded-lg p-3 text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#c4f567]/50 resize-none transition-colors relative z-10 leading-[1.5em] ${
              annotations && annotations.spans.length > 0
                ? "bg-transparent text-transparent caret-[#c4f567] selection:bg-[#c4f567]/20"
                : "bg-white/5 text-white/80"
            }`}
            style={{ caretColor: "#c4f567" }}
          />
        </div>
      </div>

      {/* Suggestions area (collapsible) */}
      {suggestions.length > 0 && (
        <div className="shrink-0 border-t border-white/10">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            <span className="font-mono uppercase tracking-wider">
              {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
            </span>
            {showSuggestions ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronUp className="w-3 h-3" />
            )}
          </button>
          {showSuggestions && doc && (
            <div className="max-h-48 overflow-y-auto">
              {suggestions.map((sug) => (
                <SuggestionCard
                  key={sug.id}
                  suggestion={sug}
                  doc={doc}
                  onAccept={handleAcceptSuggestion}
                  onDismiss={handleDismissSuggestion}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Use Lyrics button */}
      <div className="px-3 py-3 border-t border-white/10 shrink-0">
        <Button
          onClick={onUseLyrics}
          disabled={!lyrics.trim()}
          className="w-full bg-[#c4f567] text-black hover:bg-[#b8e557] font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          Use These Lyrics
        </Button>
      </div>
    </div>
  );
}
