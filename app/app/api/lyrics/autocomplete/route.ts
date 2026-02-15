import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { analyzeWithSections } from "@/lib/lyrics-analysis";
import {
  getNonStructureLines,
  getRecentContext,
  getRhymeHintWords,
  isValidLyricDoc,
  parseFirstJsonObject,
  sanitizeCompletion,
} from "@/lib/lyrics-assistant";
import { LyricsAutocompleteSuggestion, LyricDoc } from "@/lib/lyrics-types";
import { isStructureTag } from "@/lib/lyrics-utils";

const ASSISTANT_MODEL = process.env.LYRICS_ASSISTANT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

interface RequestBody {
  doc?: LyricDoc;
  lineId?: string;
  prefix?: string;
}

interface ModelAutocompleteResponse {
  completion?: string;
  alternatives?: string[];
  rhymeHints?: string[];
  contextHint?: string;
}

interface FlowTargets {
  targetSyllables: number | null;
  targetRhyme: string | null;
}

function withNaturalLeadingSpace(prefix: string, completion: string): string {
  if (!completion) return "";
  if (!prefix) return completion;
  if (!/[A-Za-z0-9'"`)]$/.test(prefix)) return completion;
  if (/^[\s,.;!?)]/.test(completion)) return completion;
  return ` ${completion}`;
}

function resolveTargetLine(
  doc: LyricDoc,
  lineId?: string,
): { id: string; text: string } | null {
  if (lineId) {
    const explicit = doc.lines.find((line) => line.id === lineId);
    if (explicit && !isStructureTag(explicit.text)) return explicit;
  }

  const nonStructureLines = getNonStructureLines(doc);
  return nonStructureLines.length > 0 ? nonStructureLines[nonStructureLines.length - 1] : null;
}

async function generateAutocomplete(
  doc: LyricDoc,
  targetLine: { id: string; text: string },
  prefix: string,
  rhymeHints: string[],
  flowTargets: FlowTargets,
): Promise<LyricsAutocompleteSuggestion> {
  const recentLines = getRecentContext(doc, 8);

  const prompt = [
    "Complete the lyric line with a natural continuation for rap/songwriting flow.",
    "Return strict JSON only.",
    "",
    "JSON schema:",
    "{",
    '  "completion": "suffix only, do not repeat prefix",',
    '  "alternatives": ["suffix alt 1", "suffix alt 2"],',
    '  "rhymeHints": ["word1","word2","word3"],',
    '  "contextHint": "brief writing hint"',
    "}",
    "",
    "Constraints:",
    "- completion: max 12 words",
    "- alternatives: max 2 entries",
    "- no line breaks",
    "- keep tone consistent with context and bar cadence",
    "- if possible, end with a word that rhymes with nearby endings",
    "- favor internal rhyme or assonance where natural",
    "",
    `Current line ID: ${targetLine.id}`,
    `Current line prefix: "${prefix}"`,
    `Target syllables (for full line): ${flowTargets.targetSyllables ?? "none"}`,
    `Preferred end-rhyme word/key: ${flowTargets.targetRhyme ?? "none"}`,
    `Detected rhyme hints: ${rhymeHints.join(", ") || "none"}`,
    "",
    "Recent lyrics:",
    ...recentLines.map((line) => `- ${line.text}`),
  ].join("\n");

  const { text } = await generateText({
    model: openai(ASSISTANT_MODEL),
    system: "You are a songwriting autocomplete engine. Return valid JSON only.",
    prompt,
    temperature: 0.7,
    maxOutputTokens: 140,
  });

  const parsed = parseFirstJsonObject<ModelAutocompleteResponse>(text);
  if (!parsed) {
    throw new Error("Failed to parse autocomplete JSON");
  }

  const cleaned = sanitizeCompletion(typeof parsed.completion === "string" ? parsed.completion : "", prefix);
  const completion = withNaturalLeadingSpace(prefix, cleaned);
  const alternatives = Array.isArray(parsed.alternatives)
    ? parsed.alternatives
        .filter((alt): alt is string => typeof alt === "string")
        .map((alt) => withNaturalLeadingSpace(prefix, sanitizeCompletion(alt, prefix, 90)))
        .filter(Boolean)
        .slice(0, 2)
    : [];

  return {
    completion,
    alternatives,
    rhymeHints: Array.isArray(parsed.rhymeHints)
      ? parsed.rhymeHints.filter((hint): hint is string => typeof hint === "string").slice(0, 6)
      : rhymeHints.slice(0, 6),
    contextHint: typeof parsed.contextHint === "string" && parsed.contextHint.trim()
      ? parsed.contextHint.trim()
      : "Match your strongest image and keep momentum in the cadence.",
    targetSyllables: flowTargets.targetSyllables ?? undefined,
    targetRhyme: flowTargets.targetRhyme ?? undefined,
  };
}

function computeFlowTargets(
  doc: LyricDoc,
  targetLineId: string,
  annotations: ReturnType<typeof analyzeWithSections>,
): FlowTargets {
  const nonStructureLines = getNonStructureLines(doc);
  const lineIndex = nonStructureLines.findIndex((line) => line.id === targetLineId);
  const lookback = nonStructureLines.slice(Math.max(0, lineIndex - 2), lineIndex);

  const syllableCandidates = lookback
    .map((line) => annotations.line_metrics[line.id]?.syllables ?? 0)
    .filter((value) => value > 0);
  const targetSyllables = syllableCandidates.length > 0
    ? Math.round(syllableCandidates.reduce((sum, value) => sum + value, 0) / syllableCandidates.length)
    : null;

  const endWordCandidates = lookback
    .map((line) => annotations.line_metrics[line.id]?.end_word?.toLowerCase() ?? "")
    .filter(Boolean);
  const targetRhyme = endWordCandidates.length > 0 ? endWordCandidates[endWordCandidates.length - 1] : null;

  return {
    targetSyllables,
    targetRhyme,
  };
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidLyricDoc(body.doc)) {
    return NextResponse.json(
      { error: "Missing or invalid 'doc.lines' - expected array of { id, text }" },
      { status: 400 },
    );
  }

  const targetLine = resolveTargetLine(body.doc, body.lineId);
  if (!targetLine) {
    return NextResponse.json({ error: "No valid lyric line found for autocomplete" }, { status: 400 });
  }

  const prefix = typeof body.prefix === "string" ? body.prefix : targetLine.text;
  const annotations = analyzeWithSections(body.doc);
  const rhymeHints = getRhymeHintWords(annotations, 8);
  const flowTargets = computeFlowTargets(body.doc, targetLine.id, annotations);

  if (prefix.trim().length < 4) {
    return NextResponse.json({
      suggestion: {
        completion: "",
        alternatives: [],
        rhymeHints: rhymeHints.slice(0, 6),
        contextHint: "",
        targetSyllables: flowTargets.targetSyllables ?? undefined,
        targetRhyme: flowTargets.targetRhyme ?? undefined,
      } satisfies LyricsAutocompleteSuggestion,
    });
  }

  try {
    const suggestion = await generateAutocomplete(body.doc, targetLine, prefix, rhymeHints, flowTargets);
    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("[lyrics/autocomplete] LLM error:", error);
    return NextResponse.json(
      { error: "Autocomplete failed from LLM provider. Please retry." },
      { status: 502 },
    );
  }
}
