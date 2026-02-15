import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { analyzeWithSections } from "@/lib/lyrics-analysis";
import { getRecentContext, isValidLyricDoc, parseFirstJsonObject } from "@/lib/lyrics-assistant";
import {
  LyricsProAnalysis,
  LyricDoc,
  ProTechniqueSuggestion,
  ProTechniqueType,
} from "@/lib/lyrics-types";
import {
  buildCadenceProfile,
  buildRhymeScheme,
  buildStructureSections,
  suggestNextSectionTag,
} from "@/lib/rap-theory";

const ASSISTANT_MODEL = process.env.LYRICS_ASSISTANT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

interface RequestBody {
  doc?: LyricDoc;
  focusLineId?: string;
  selectedText?: string;
}

interface ModelSuggestion {
  type?: ProTechniqueType;
  title?: string;
  explanation?: string;
  lineId?: string;
  rewrite?: string;
  insertion?: string;
}

interface ModelResponse {
  summary?: string;
  recommendedNextSection?: string;
  structureRationale?: string;
  suggestions?: ModelSuggestion[];
}

function sanitizeSuggestion(
  suggestion: ModelSuggestion,
  index: number,
): ProTechniqueSuggestion | null {
  if (!suggestion.type || !suggestion.title || !suggestion.explanation) {
    return null;
  }

  const type = suggestion.type;
  const allowedTypes: ProTechniqueType[] = [
    "multisyllabic-rhyme",
    "internal-rhyme",
    "metaphor",
    "punchline",
    "cadence",
    "structure",
  ];

  if (!allowedTypes.includes(type)) return null;

  const rewrite = typeof suggestion.rewrite === "string" ? suggestion.rewrite.trim() : "";
  const insertion = typeof suggestion.insertion === "string" ? suggestion.insertion.trim() : "";

  return {
    id: `pro-${index + 1}`,
    type,
    title: suggestion.title.trim(),
    explanation: suggestion.explanation.trim(),
    lineId: typeof suggestion.lineId === "string" ? suggestion.lineId : undefined,
    rewrite: rewrite || undefined,
    insertion: insertion || undefined,
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
  const rhymeScheme = buildRhymeScheme(body.doc, annotations);
  const cadence = buildCadenceProfile(annotations);
  const sections = buildStructureSections(body.doc);
  const recentContext = getRecentContext(body.doc, 12);
  const suggestedNextSection = suggestNextSectionTag(sections);
  const selectedText = typeof body.selectedText === "string" ? body.selectedText.trim() : "";

  const prompt = [
    "You are a professional rap + songwriting theory coach.",
    "Analyze the draft and return STRICT JSON only.",
    "",
    "JSON schema:",
    "{",
    '  "summary": "2-3 sentence technical critique focused on flow, rhyme, and imagery",',
    '  "recommendedNextSection": "e.g. [Chorus] or [Verse 2]",',
    '  "structureRationale": "1 concise sentence on section sequencing",',
    '  "suggestions": [',
    "    {",
    '      "type": "multisyllabic-rhyme|internal-rhyme|metaphor|punchline|cadence|structure",',
    '      "title": "short label",',
    '      "explanation": "why this improves technical quality",',
    '      "lineId": "optional target line id",',
    '      "rewrite": "optional rewritten line or phrase",',
    '      "insertion": "optional text to append/insert"',
    "    }",
    "  ]",
    "}",
    "",
    "Constraints:",
    "- suggestions: 6 to 10 entries",
    "- must include at least 1 metaphor suggestion, 1 multisyllabic-rhyme, 1 cadence, 1 structure",
    "- rewrites should preserve artist voice and be performance-ready",
    "- prioritize rap theory: internal rhymes, end-rhyme consistency, bar symmetry, punchline setup/payoff",
    "",
    `Focused line id: ${body.focusLineId ?? "none"}`,
    `Selected text: ${selectedText || "none"}`,
    `Suggested next section from baseline: ${suggestedNextSection}`,
    "",
    `Cadence baseline: avg ${cadence.avgSyllables}, range ${cadence.minSyllables}-${cadence.maxSyllables}, variance ${cadence.variance}, swing ${cadence.swing}`,
    "Rhyme scheme baseline (lineId:scheme:endWord:syllables):",
    ...rhymeScheme.map((entry) => `- ${entry.lineId}:${entry.scheme}:${entry.endWord}:${entry.syllables}`),
    "",
    "Section baseline (tag -> lineCount):",
    ...sections.map((section) => `- ${section.tag} -> ${section.lineCount}`),
    "",
    "Recent lyric context:",
    ...recentContext.map((line) => `- (${line.id}) ${line.text}`),
  ].join("\n");

  try {
    const { text } = await generateText({
      model: openai(ASSISTANT_MODEL),
      system: "You are an elite rap writing room co-writer. Return valid JSON only.",
      prompt,
      temperature: 0.7,
      maxOutputTokens: 900,
    });

    const parsed = parseFirstJsonObject<ModelResponse>(text);
    if (!parsed) {
      throw new Error("Failed to parse pro analysis JSON");
    }

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .map((suggestion, idx) => sanitizeSuggestion(suggestion, idx))
          .filter((suggestion): suggestion is ProTechniqueSuggestion => !!suggestion)
      : [];

    if (suggestions.length === 0) {
      throw new Error("LLM returned no actionable pro suggestions");
    }

    const analysis: LyricsProAnalysis = {
      summary: typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "Your draft has a strong idea; tighten rhyme consistency and cadence for stronger delivery.",
      rhymeScheme,
      cadence,
      structure: {
        sections,
        recommendedNextSection:
          typeof parsed.recommendedNextSection === "string" && parsed.recommendedNextSection.trim()
            ? parsed.recommendedNextSection.trim()
            : suggestedNextSection,
        rationale:
          typeof parsed.structureRationale === "string" && parsed.structureRationale.trim()
            ? parsed.structureRationale.trim()
            : "Rotate verse and chorus to balance narrative detail with hook memorability.",
      },
      suggestions,
    };

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("[lyrics/pro-assist] LLM error:", error);
    return NextResponse.json(
      { error: "Pro rap analysis failed from LLM provider. Please retry." },
      { status: 502 },
    );
  }
}
