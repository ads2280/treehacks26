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
} from "@/lib/lyrics-assistant";
import { Annotations, LyricsLLMInsights, LyricDoc } from "@/lib/lyrics-types";

const ASSISTANT_MODEL = process.env.LYRICS_ASSISTANT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

interface RequestBody {
  doc?: LyricDoc;
  includeLLM?: boolean;
}

interface InsightModelResponse {
  theme?: string;
  context?: string;
  rhymeTargets?: Array<{
    target?: string;
    rhymes?: string[];
    rationale?: string;
  }>;
  writingTips?: string[];
}

function buildFallbackInsights(doc: LyricDoc, annotations: Annotations): LyricsLLMInsights {
  const contextLines = getRecentContext(doc, 3).map((line) => line.text);
  const rhymeHints = getRhymeHintWords(annotations, 5);

  return {
    theme: contextLines[0] ? contextLines[0].slice(0, 80) : "Untitled lyric idea",
    context: contextLines.join(" / ") || "Add a few lines so the assistant can infer theme and narrative.",
    rhymeTargets: rhymeHints.map((hint) => ({
      target: hint,
      rhymes: [],
      rationale: "Detected as an ending word in your draft.",
    })),
    writingTips: [
      "Keep line lengths consistent inside each section.",
      "Use one concrete image per 2-3 lines to avoid generic phrasing.",
      "Repeat your strongest phrase near section transitions.",
    ],
  };
}

async function generateInsights(
  doc: LyricDoc,
  annotations: Annotations,
): Promise<LyricsLLMInsights> {
  const nonStructureLines = getNonStructureLines(doc);
  const recentLines = getRecentContext(doc, 8);
  const rhymeHints = getRhymeHintWords(annotations, 8);

  const prompt = [
    "Analyze these lyrics and return strict JSON only.",
    "",
    "JSON schema:",
    "{",
    '  "theme": "short phrase",',
    '  "context": "1-2 sentence summary of story/emotion",',
    '  "rhymeTargets": [{"target":"word","rhymes":["word1","word2","word3"],"rationale":"short reason"}],',
    '  "writingTips": ["tip1","tip2","tip3"]',
    "}",
    "",
    "Constraints:",
    "- theme: <= 10 words",
    "- context: <= 2 sentences",
    "- rhymeTargets: max 4 entries",
    "- each rhymes array: max 5 single-word rhymes",
    "- writingTips: exactly 3 concise, actionable tips",
    "",
    `Detected end-word hints: ${rhymeHints.join(", ") || "none"}`,
    `Total lyrical lines: ${nonStructureLines.length}`,
    "",
    "Recent lyric context:",
    ...recentLines.map((line) => `- (${line.id}) ${line.text}`),
  ].join("\n");

  const { text } = await generateText({
    model: openai(ASSISTANT_MODEL),
    system: "You are an expert lyric editor. Return valid JSON only.",
    prompt,
    temperature: 0.4,
    maxOutputTokens: 350,
  });

  const parsed = parseFirstJsonObject<InsightModelResponse>(text);
  if (!parsed) {
    throw new Error("Failed to parse insight JSON response");
  }

  return {
    theme: typeof parsed.theme === "string" && parsed.theme.trim()
      ? parsed.theme.trim()
      : "Untitled lyric idea",
    context: typeof parsed.context === "string" && parsed.context.trim()
      ? parsed.context.trim()
      : "Refine your narrative arc by clarifying who is speaking and to whom.",
    rhymeTargets: Array.isArray(parsed.rhymeTargets)
      ? parsed.rhymeTargets
          .slice(0, 4)
          .map((target) => ({
            target: typeof target.target === "string" ? target.target : "",
            rhymes: Array.isArray(target.rhymes)
              ? target.rhymes.filter((word): word is string => typeof word === "string").slice(0, 5)
              : [],
            rationale: typeof target.rationale === "string" ? target.rationale : undefined,
          }))
          .filter((target) => target.target)
      : [],
    writingTips: Array.isArray(parsed.writingTips)
      ? parsed.writingTips.filter((tip): tip is string => typeof tip === "string").slice(0, 3)
      : [],
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

  const annotations = analyzeWithSections(body.doc);

  if (!body.includeLLM) {
    return NextResponse.json({ annotations });
  }

  try {
    const llmInsights = await generateInsights(body.doc, annotations);
    return NextResponse.json({ annotations, llmInsights });
  } catch (error) {
    console.error("[lyrics/analyze] LLM insight error, returning fallback:", error);
    return NextResponse.json({
      annotations,
      llmInsights: buildFallbackInsights(body.doc, annotations),
      llmFallback: true,
    });
  }
}
