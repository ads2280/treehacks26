"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { X, Check, ChevronDown, ChevronUp, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LyricDoc,
  Suggestion,
  ProduceOperation,
  LyricsAutocompleteSuggestion,
  LyricsCoachResponse,
  LyricsProAnalysis,
  ProTechniqueSuggestion,
} from "@/lib/lyrics-types";
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

interface CursorContext {
  lineIndex: number;
  lineStart: number;
  lineEnd: number;
  lineText: string;
  prefix: string;
  lineId: string | null;
}

interface SelectionContext {
  start: number;
  end: number;
}

const STRUCTURE_TAGS = ["[Intro]", "[Verse]", "[Chorus]", "[Bridge]", "[Outro]"];

function getCursorContext(raw: string, cursor: number, doc: LyricDoc | null): CursorContext {
  const clampedCursor = Math.max(0, Math.min(cursor, raw.length));
  const beforeCursor = raw.slice(0, clampedCursor);
  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const nextLineBreak = raw.indexOf("\n", clampedCursor);
  const lineEnd = nextLineBreak === -1 ? raw.length : nextLineBreak;
  const lineIndex = beforeCursor.split("\n").length - 1;

  return {
    lineIndex,
    lineStart,
    lineEnd,
    lineText: raw.slice(lineStart, lineEnd),
    prefix: raw.slice(lineStart, clampedCursor),
    lineId: doc?.lines[lineIndex]?.id ?? null,
  };
}

function normalizeCompletionForInsertion(prefix: string, completion: string): string {
  const trimmed = completion.replace(/\r?\n/g, " ").trim();
  if (!trimmed) return "";

  const needsLeadingSpace =
    !!prefix && /[A-Za-z0-9'"`)]$/.test(prefix) && !/^[\s,.;!?)]/.test(trimmed);

  return needsLeadingSpace ? ` ${trimmed}` : trimmed;
}

export function LyricsPanel({
  lyrics,
  onLyricsChange,
  onClose,
  onUseLyrics,
}: LyricsPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isProducing, setIsProducing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [selection, setSelection] = useState<SelectionContext>({ start: 0, end: 0 });
  const [ghostSuggestion, setGhostSuggestion] = useState<LyricsAutocompleteSuggestion | null>(null);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);

  const [showCoach, setShowCoach] = useState(false);
  const [coachInput, setCoachInput] = useState("");
  const [coachResponse, setCoachResponse] = useState<LyricsCoachResponse | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [showProPanel, setShowProPanel] = useState(false);
  const [proAnalysis, setProAnalysis] = useState<LyricsProAnalysis | null>(null);
  const [proError, setProError] = useState<string | null>(null);
  const [isProLoading, setIsProLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const autocompleteRequestRef = useRef(0);
  const lastAutocompleteKeyRef = useRef("");

  const doc = useMemo<LyricDoc | null>(() => {
    if (!lyrics.trim()) return null;
    return stringToLyricDoc(lyrics);
  }, [lyrics]);

  const annotations = useLyricsAnalysis(doc);
  const cursorContext = useMemo(
    () => getCursorContext(lyrics, cursorPos, doc),
    [lyrics, cursorPos, doc],
  );
  const hasSelection = selection.end > selection.start;
  const selectedText = hasSelection ? lyrics.slice(selection.start, selection.end) : "";
  const isAtLineEnd = cursorPos === cursorContext.lineEnd;

  const insertTag = (tag: string) => {
    const newLyrics = lyrics ? `${lyrics}\n\n${tag}\n` : `${tag}\n`;
    onLyricsChange(newLyrics);
    setGhostSuggestion(null);
    setCoachResponse(null);
  };

  const handleScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const updateCursorFromTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    setCursorPos(start);
    setSelection({ start, end });
  }, []);

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

  const applyInlineCompletion = useCallback((rawCompletion: string) => {
    const normalized = hasSelection
      ? rawCompletion.replace(/\r?\n/g, " ").trim()
      : normalizeCompletionForInsertion(cursorContext.prefix, rawCompletion);
    if (!normalized) return;

    const start = selection.start ?? cursorPos;
    const end = selection.end ?? start;

    const nextLyrics = `${lyrics.slice(0, start)}${normalized}${lyrics.slice(end)}`;
    const nextPos = start + normalized.length;

    onLyricsChange(nextLyrics);
    setCursorPos(nextPos);
    setSelection({ start: nextPos, end: nextPos });
    setGhostSuggestion((prev) => (
      prev
        ? {
            ...prev,
            completion: "",
            alternatives: prev.alternatives.filter((alt) => alt !== rawCompletion),
          }
        : null
    ));

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextPos, nextPos);
      handleScroll();
    });
  }, [cursorContext.prefix, cursorPos, handleScroll, lyrics, onLyricsChange, selection.end, selection.start]);

  const replaceLineById = useCallback((lineId: string, replacement: string) => {
    if (!doc) return false;
    const targetIndex = doc.lines.findIndex((line) => line.id === lineId);
    if (targetIndex < 0) return false;

    const updatedDoc: LyricDoc = {
      lines: doc.lines.map((line, index) => (
        index === targetIndex ? { ...line, text: replacement } : line
      )),
    };
    onLyricsChange(lyricDocToString(updatedDoc));
    return true;
  }, [doc, onLyricsChange]);

  const applyProSuggestion = useCallback((suggestion: ProTechniqueSuggestion) => {
    if (suggestion.rewrite) {
      if (suggestion.lineId && replaceLineById(suggestion.lineId, suggestion.rewrite)) {
        return;
      }

      if (hasSelection) {
        applyInlineCompletion(suggestion.rewrite);
        return;
      }

      applyInlineCompletion(suggestion.rewrite);
      return;
    }

    if (suggestion.insertion) {
      applyInlineCompletion(suggestion.insertion);
    }
  }, [applyInlineCompletion, hasSelection, replaceLineById]);

  const handleRunProPass = useCallback(async () => {
    if (!doc || isProLoading) return;

    setIsProLoading(true);
    setProError(null);

    try {
      const res = await fetch("/api/lyrics/pro-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc,
          focusLineId: cursorContext.lineId,
          selectedText: selectedText || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || `Pro pass failed (${res.status})`);
      }

      const data = (await res.json()) as { analysis?: LyricsProAnalysis };
      if (!data.analysis) {
        throw new Error("Pro pass response missing analysis");
      }

      setProAnalysis(data.analysis);
      setShowProPanel(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pro analysis failed";
      setProError(message);
    } finally {
      setIsProLoading(false);
    }
  }, [cursorContext.lineId, doc, isProLoading, selectedText]);

  const handleAcceptSuggestion = useCallback(
    (suggestion: Suggestion) => {
      if (!doc) return;

      let updatedDoc: LyricDoc = { lines: [...doc.lines] };
      for (const op of suggestion.ops) {
        if (op.type === "replace_line") {
          updatedDoc = {
            lines: updatedDoc.lines.map((line) =>
              line.id === op.line_id ? { ...line, text: op.text } : line,
            ),
          };
        } else if (op.type === "insert_line_after") {
          const idx = updatedDoc.lines.findIndex((line) => line.id === op.line_id);
          if (idx !== -1) {
            const nextLines = [...updatedDoc.lines];
            nextLines.splice(idx + 1, 0, op.new_line);
            updatedDoc = { lines: nextLines };
          }
        }
      }

      const newLyrics = lyricDocToString(updatedDoc);
      onLyricsChange(newLyrics);
      setSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
    },
    [doc, onLyricsChange],
  );

  const handleDismissSuggestion = useCallback((suggestion: Suggestion) => {
    setSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
  }, []);

  const handleAskCoach = useCallback(async () => {
    if (!doc || !coachInput.trim() || isCoachLoading) return;

    setIsCoachLoading(true);
    setCoachError(null);

    try {
      const res = await fetch("/api/lyrics/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc,
          message: coachInput.trim(),
          lineId: cursorContext.lineId,
          currentLinePrefix: cursorContext.prefix,
          selectedText: selectedText || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || `Coach request failed (${res.status})`);
      }

      const data = (await res.json()) as { response?: LyricsCoachResponse };
      if (!data.response) {
        throw new Error("Coach response missing content");
      }

      setCoachResponse(data.response);
      setCoachInput("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Coach request failed";
      setCoachError(message);
    } finally {
      setIsCoachLoading(false);
    }
  }, [coachInput, cursorContext.lineId, cursorContext.prefix, doc, isCoachLoading, selectedText]);

  useEffect(() => {
    if (!doc || !cursorContext.lineId) {
      setGhostSuggestion(null);
      return;
    }

    if (!isAtLineEnd || hasSelection) {
      setGhostSuggestion(null);
      return;
    }

    if (!cursorContext.prefix.trim() || isStructureTag(cursorContext.lineText)) {
      setGhostSuggestion(null);
      return;
    }

    if (cursorContext.prefix.trim().length < 4) {
      setGhostSuggestion(null);
      return;
    }

    const autocompleteKey = `${cursorContext.lineId}:${cursorContext.prefix}`;
    if (autocompleteKey === lastAutocompleteKeyRef.current) return;

    const requestId = ++autocompleteRequestRef.current;
    const controller = new AbortController();

    const timerId = setTimeout(async () => {
      try {
        setIsAutocompleteLoading(true);

        const res = await fetch("/api/lyrics/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doc,
            lineId: cursorContext.lineId,
            prefix: cursorContext.prefix,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Autocomplete failed (${res.status})`);
        }

        const data = (await res.json()) as { suggestion?: LyricsAutocompleteSuggestion };
        if (requestId !== autocompleteRequestRef.current) return;

        lastAutocompleteKeyRef.current = autocompleteKey;
        if (data.suggestion?.completion) {
          setGhostSuggestion(data.suggestion);
        } else {
          setGhostSuggestion(null);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("[LyricsPanel] autocomplete error:", error);
      } finally {
        if (requestId === autocompleteRequestRef.current) {
          setIsAutocompleteLoading(false);
        }
      }
    }, 650);

    return () => {
      controller.abort();
      clearTimeout(timerId);
    };
  }, [
    cursorContext.lineEnd,
    cursorContext.lineId,
    cursorContext.lineText,
    cursorContext.prefix,
    cursorPos,
    doc,
    hasSelection,
    isAtLineEnd,
  ]);

  const ghostCompletion = ghostSuggestion?.completion ?? "";

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

      const lineSpans = annotations?.spans.filter((span) => span.line_id === line.id) ?? [];
      const shouldRenderGhostOnLine =
        !!ghostCompletion &&
        isAtLineEnd &&
        cursorContext.lineId === line.id;
      if (lineSpans.length === 0) {
        return (
          <div key={line.id} className="text-transparent font-mono text-sm leading-[1.5em] whitespace-pre-wrap break-words">
            <span className="text-white/80">{line.text || "\u00A0"}</span>
            {shouldRenderGhostOnLine ? <span className="text-white/30">{ghostCompletion}</span> : null}
          </div>
        );
      }

      return (
        <HighlightedLine
          key={line.id}
          text={line.text}
          spans={lineSpans}
          ghostText={shouldRenderGhostOnLine ? ghostCompletion : undefined}
        />
      );
    });
  }, [doc, annotations, cursorContext.lineId, ghostCompletion, isAtLineEnd]);

  const hasAnnotations = annotations && (
    annotations.spans.length > 0 ||
    Object.keys(annotations.rhyme.clusters).length > 0
  );

  return (
    <div className="w-80 flex flex-col bg-[#0a0a0a] border-l border-white/10 max-h-full">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-white/80">Lyrics</span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

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
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCoach((prev) => !prev)}
            className="px-2 py-1 text-[10px] rounded bg-[#c4f567]/10 text-[#c4f567] border border-[#c4f567]/25 hover:bg-[#c4f567]/20 font-mono uppercase tracking-wider transition-colors"
          >
            {showCoach ? "Hide Lyric Coach" : "Lyric Coach"}
          </button>
          <button
            type="button"
            onClick={() => void handleRunProPass()}
            disabled={!doc || isProLoading}
            className="px-2 py-1 text-[10px] rounded bg-blue-500/10 text-blue-300 border border-blue-500/25 hover:bg-blue-500/20 font-mono uppercase tracking-wider transition-colors disabled:opacity-40"
          >
            {isProLoading ? "Running Pro Pass..." : "Pro Rap Pass"}
          </button>
          {ghostCompletion && (
            <span className="text-[10px] text-white/45 font-mono">
              Press <span className="text-white/70">Tab</span> to accept suggestion
            </span>
          )}
          {isAutocompleteLoading && (
            <Loader2 className="w-3 h-3 text-white/35 animate-spin ml-auto" />
          )}
        </div>
        {hasSelection && (
          <p className="mt-1 text-[10px] text-white/45 font-mono">
            Target selection: "{selectedText.slice(0, 48)}{selectedText.length > 48 ? "..." : ""}"
          </p>
        )}
      </div>

      {showCoach && (
        <div className="px-3 py-2 border-b border-white/10 bg-white/[0.02] shrink-0">
          <div className="flex gap-2">
            <input
              value={coachInput}
              onChange={(event) => setCoachInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAskCoach();
                }
              }}
              placeholder="Ask to finish a line, improve cadence, rhyme ideas..."
              className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 placeholder:text-white/35 focus:outline-none focus:border-[#c4f567]/40"
            />
            <button
              type="button"
              disabled={!coachInput.trim() || isCoachLoading || !doc}
              onClick={() => void handleAskCoach()}
              className="px-2.5 py-1.5 rounded bg-[#c4f567] text-black text-xs font-semibold hover:bg-[#b8e557] disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              {isCoachLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Ask
            </button>
          </div>

          {coachError && (
            <p className="mt-2 text-[11px] text-red-300">{coachError}</p>
          )}

          {coachResponse && (
            <div className="mt-2 space-y-2">
              {coachResponse.focusTechnique && (
                <span className="inline-block px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-[10px] text-white/65 font-mono uppercase tracking-wide">
                  focus: {coachResponse.focusTechnique}
                </span>
              )}
              <p className="text-[11px] text-white/75 leading-relaxed">{coachResponse.answer}</p>
              {coachResponse.completions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {coachResponse.completions.map((completion) => (
                    <button
                      key={completion}
                      type="button"
                      onClick={() => applyInlineCompletion(completion)}
                      className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-white/65 hover:text-white hover:bg-white/10 transition-colors font-mono"
                    >
                      {completion}
                    </button>
                  ))}
                </div>
              )}
              {coachResponse.rhymeHints.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {coachResponse.rhymeHints.map((hint) => (
                    <span
                      key={hint}
                      className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 font-mono"
                    >
                      {hint}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(showProPanel || proError) && (
        <div className="px-3 py-2 border-b border-white/10 bg-white/[0.03] shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-mono uppercase tracking-wide text-white/70">
              Pro Rap Analysis
            </p>
            <button
              type="button"
              onClick={() => setShowProPanel((prev) => !prev)}
              className="text-[10px] text-white/45 hover:text-white/75 font-mono"
            >
              {showProPanel ? "Collapse" : "Expand"}
            </button>
          </div>

          {proError && (
            <p className="text-[11px] text-red-300 mb-2">{proError}</p>
          )}

          {showProPanel && proAnalysis && (
            <div className="space-y-2">
              <p className="text-[11px] text-white/75 leading-relaxed">{proAnalysis.summary}</p>

              <div className="flex flex-wrap gap-1">
                <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/70 font-mono">
                  cadence {proAnalysis.cadence.avgSyllables} avg
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/70 font-mono">
                  swing {proAnalysis.cadence.swing}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/70 font-mono">
                  target {proAnalysis.cadence.targetRange[0]}-{proAnalysis.cadence.targetRange[1]} syl
                </span>
              </div>

              {proAnalysis.rhymeScheme.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-white/50 font-mono uppercase">Rhyme Scheme</p>
                  <div className="flex flex-wrap gap-1">
                    {proAnalysis.rhymeScheme.slice(-10).map((entry) => (
                      <span
                        key={entry.lineId}
                        className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 font-mono"
                        title={entry.text}
                      >
                        {entry.scheme}:{entry.endWord || "—"}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-[10px] text-white/50 font-mono uppercase">Structure</p>
                <p className="text-[11px] text-white/75">
                  Next section: <span className="text-[#c4f567]">{proAnalysis.structure.recommendedNextSection}</span>
                </p>
                <p className="text-[10px] text-white/50 leading-relaxed">{proAnalysis.structure.rationale}</p>
              </div>

              {proAnalysis.suggestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-white/50 font-mono uppercase">Technique Upgrades</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {proAnalysis.suggestions.map((suggestion) => (
                      <div key={suggestion.id} className="rounded border border-white/10 bg-black/25 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-white/80 font-medium">
                            {suggestion.title}
                          </p>
                          <span className="text-[9px] px-1 py-0.5 rounded bg-white/10 text-white/55 font-mono uppercase tracking-wide">
                            {suggestion.type}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-white/55 leading-relaxed">
                          {suggestion.explanation}
                        </p>
                        {(suggestion.rewrite || suggestion.insertion) && (
                          <button
                            type="button"
                            onClick={() => applyProSuggestion(suggestion)}
                            className="mt-1.5 px-2 py-0.5 rounded bg-[#c4f567]/10 border border-[#c4f567]/20 text-[10px] text-[#c4f567] hover:bg-[#c4f567]/20 transition-colors font-mono"
                          >
                            Apply Suggestion
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {hasAnnotations && (
        <AnalysisSummary
          annotations={annotations}
          onTighten={() => handleProduce("tighten")}
          onDecliche={() => handleProduce("decliche")}
          onHookify={() => handleProduce("hookify")}
          isProducing={isProducing}
        />
      )}

      <div className="flex-1 p-3 min-h-0">
        <div className="relative w-full h-full">
          {overlayLines && (
            <div
              ref={overlayRef}
              className="absolute inset-0 bg-white/5 border border-white/10 rounded-lg p-3 overflow-hidden pointer-events-none"
              aria-hidden
            >
              {overlayLines}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={lyrics}
            onChange={(event) => {
              onLyricsChange(event.target.value);
              const start = event.target.selectionStart ?? 0;
              const end = event.target.selectionEnd ?? start;
              setCursorPos(start);
              setSelection({ start, end });
            }}
            onScroll={handleScroll}
            onClick={updateCursorFromTextarea}
            onSelect={updateCursorFromTextarea}
            onKeyUp={updateCursorFromTextarea}
            onKeyDown={(event) => {
              if (event.key === "Tab" && ghostCompletion) {
                event.preventDefault();
                applyInlineCompletion(ghostCompletion);
              }
            }}
            placeholder={"[Verse]\nWrite your lyrics here...\n\n[Chorus]\n..."}
            className="w-full h-full border border-white/10 rounded-lg p-3 text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#c4f567]/50 resize-none transition-colors relative z-10 leading-[1.5em] bg-transparent text-transparent caret-[#c4f567] selection:bg-[#c4f567]/20"
            style={{ caretColor: "#c4f567" }}
          />
        </div>
      </div>

      {ghostSuggestion && (
        ghostSuggestion.alternatives.length > 0
        || ghostSuggestion.contextHint
        || ghostSuggestion.rhymeHints.length > 0
        || ghostSuggestion.targetSyllables
        || ghostSuggestion.targetRhyme
      ) && (
        <div className="px-3 pb-2 shrink-0 border-t border-white/10">
          {(ghostSuggestion.targetSyllables || ghostSuggestion.targetRhyme) && (
            <div className="pt-2 flex flex-wrap gap-1">
              {ghostSuggestion.targetSyllables ? (
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 border border-white/15 text-white/65 font-mono">
                  target {ghostSuggestion.targetSyllables} syl
                </span>
              ) : null}
              {ghostSuggestion.targetRhyme ? (
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 border border-white/15 text-white/65 font-mono">
                  rhyme {ghostSuggestion.targetRhyme}
                </span>
              ) : null}
            </div>
          )}
          {ghostSuggestion.contextHint && (
            <p className="pt-2 text-[10px] text-white/45 font-mono">
              {ghostSuggestion.contextHint}
            </p>
          )}
          {ghostSuggestion.alternatives.length > 0 && (
            <div className="pt-2 flex flex-wrap gap-1.5">
              {ghostSuggestion.alternatives.map((alternative) => (
                <button
                  key={alternative}
                  type="button"
                  onClick={() => applyInlineCompletion(alternative)}
                  className="px-2 py-0.5 text-[10px] rounded bg-white/5 border border-white/10 text-white/55 hover:text-white hover:bg-white/10 transition-colors font-mono"
                >
                  {alternative}
                </button>
              ))}
            </div>
          )}
          {ghostSuggestion.rhymeHints.length > 0 && (
            <div className="pt-2 pb-1 flex flex-wrap gap-1">
              {ghostSuggestion.rhymeHints.map((hint) => (
                <span
                  key={hint}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono"
                >
                  {hint}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

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
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  doc={doc}
                  onAccept={handleAcceptSuggestion}
                  onDismiss={handleDismissSuggestion}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
