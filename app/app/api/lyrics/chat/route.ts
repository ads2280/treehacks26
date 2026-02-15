import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { analyzeWithSections } from "@/lib/lyrics-analysis";
import {
  getRecentContext,
  getRhymeHintWords,
  isValidLyricDoc,
  parseFirstJsonObject,
} from "@/lib/lyrics-assistant";
import { LyricsCoachResponse, LyricDoc } from "@/lib/lyrics-types";

const ASSISTANT_MODEL = process.env.LYRICS_ASSISTANT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

interface RequestBody {
  doc?: LyricDoc;
  message?: string;
  lineId?: string;
  currentLinePrefix?: string;
  selectedText?: string;
}

interface ModelCoachResponse {
  answer?: string;
  completions?: string[];
  rhymeHints?: string[];
  focusTechnique?: string;
}

function detectFocusTechnique(message: string): string {
  const lower = message.toLowerCase();
  if (/(meta|imagery|simile|double meaning)/.test(lower)) return "metaphor";
  if (/(punch|bars|hard|impact|quotable)/.test(lower)) return "punchline";
  if (/(flow|cadence|syllable|delivery|rhythm)/.test(lower)) return "cadence";
  if (/(rhyme scheme|multisyll|internal rhyme|rhyme)/.test(lower)) return "rhyme";
  if (/(structure|verse|chorus|bridge|section)/.test(lower)) return "structure";
  return "line-finish";
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

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const annotations = analyzeWithSections(body.doc);
  const rhymeHints = getRhymeHintWords(annotations, 8);
  const recentContext = getRecentContext(body.doc, 10);
  const selectedText = typeof body.selectedText === "string" ? body.selectedText.trim() : "";
  const isSelectionTargeted = !!selectedText;
  const focusTechnique = detectFocusTechnique(message);

  const prompt = [
    "You are a lyric coach. Reply with strict JSON only.",
    "",
    "Schema:",
    "{",
    '  "answer": "short, actionable coaching response",',
    '  "completions": ["line-ending suggestion 1", "line-ending suggestion 2", "line-ending suggestion 3"],',
    '  "rhymeHints": ["hint1","hint2","hint3"]',
    "}",
    "",
    "Constraints:",
    "- answer <= 3 sentences",
    isSelectionTargeted
      ? "- completions must be rewrites/replacements of the selected phrase (max 10 words each)"
      : "- completions must be usable as line endings (max 8 words each)",
    "- max 3 completions",
    "- keep style aligned with existing lyric context",
    `- prioritize ${focusTechnique} guidance in both answer and completions`,
    "",
    `User question: ${message}`,
    `Current line prefix: ${body.currentLinePrefix ?? ""}`,
    `Current line id: ${body.lineId ?? ""}`,
    `Selected text: ${selectedText || "none"}`,
    `Target mode: ${isSelectionTargeted ? "selection rewrite" : "cursor line completion"}`,
    `Requested focus technique: ${focusTechnique}`,
    `Detected rhyme hints: ${rhymeHints.join(", ") || "none"}`,
    "",
    "Recent lyrics:",
    ...recentContext.map((line) => `- (${line.id}) ${line.text}`),
  ].join("\n");

  try {
    const { text } = await generateText({
      model: openai(ASSISTANT_MODEL),
      system: "You are an expert lyric writing assistant. Return valid JSON only.",
      prompt,
      temperature: 0.7,
      maxOutputTokens: 220,
    });

    const parsed = parseFirstJsonObject<ModelCoachResponse>(text);
    if (!parsed) {
      throw new Error("Failed to parse coach JSON");
    }

    const response: LyricsCoachResponse = {
      answer: typeof parsed.answer === "string" && parsed.answer.trim()
        ? parsed.answer.trim()
        : "Keep the emotional focus tight and end on a memorable image.",
      completions: Array.isArray(parsed.completions)
        ? parsed.completions
            .filter((completion): completion is string => typeof completion === "string")
            .map((completion) => completion.trim())
            .filter(Boolean)
            .slice(0, 3)
        : [],
      rhymeHints: Array.isArray(parsed.rhymeHints)
        ? parsed.rhymeHints.filter((hint): hint is string => typeof hint === "string").slice(0, 6)
        : rhymeHints.slice(0, 6),
      focusTechnique: typeof parsed.focusTechnique === "string" && parsed.focusTechnique.trim()
        ? parsed.focusTechnique.trim()
        : focusTechnique,
    };

    return NextResponse.json({ response });
  } catch (error) {
    console.error("[lyrics/chat] LLM error:", error);
    return NextResponse.json(
      { error: "Lyric coach failed from LLM provider. Please retry." },
      { status: 502 },
    );
  }
}
